import { lookup } from "node:dns/promises";

import { adminClient } from "@/lib/supabase/admin";

import {
  AUTO_DISABLE_AFTER,
  DELIVERY_TIMEOUT_MS,
  MAX_ATTEMPTS,
  RESPONSE_SNIPPET_BYTES,
  retryDelaySeconds,
  webhookEnvelope,
} from "../catalog.js";
import { signatureHeader } from "../crypto.js";
import { checkWebhookUrl, isPrivateAddress } from "../url.js";

// Webhook sender: claims due deliveries through the DB lease, POSTs signed JSON, records the outcome and schedules retries.

const LEASE_SECONDS = 120;
const CONCURRENCY = 8;

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// The first couple of KB of the response, for the delivery log.
async function readSnippet(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (size < RESPONSE_SNIPPET_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    // A body that errors mid-stream keeps whatever arrived.
  } finally {
    reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(Math.min(size, RESPONSE_SNIPPET_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= bytes.length) break;
    const take = Math.min(chunk.byteLength, bytes.length - offset);
    bytes.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder().decode(bytes);
}

function describeFetchError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return `Timed out after ${DELIVERY_TIMEOUT_MS / 1000}s`;
  }
  const code = error?.cause?.code || error?.code;
  return `Couldn't connect${code ? ` (${code})` : ""}: ${error?.cause?.message || error?.message || "network error"}`;
}

// SSRF guard: a public hostname must not resolve to a private address (an error message, or null when safe).
async function privateTargetError(url) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  try {
    const answers = await lookup(host, { all: true, verbatim: true });
    if (!answers.length) return "Couldn't resolve the webhook host.";
    return answers.some((a) => isPrivateAddress(a.address))
      ? "The webhook host resolves to a private network address, which can't be reached."
      : null;
  } catch (e) {
    return `Couldn't resolve the webhook host${e?.code ? ` (${e.code})` : ""}.`;
  }
}

async function deliver(db, row) {
  const body = JSON.stringify(
    webhookEnvelope({
      id: row.event_id,
      type: row.event_type,
      occurredAt: row.occurred_at,
      projectId: row.project_id,
      data: row.payload,
    }),
  );
  const timestamp = Math.floor(Date.now() / 1000);
  const started = Date.now();
  let status = null;
  let snippet = null;
  let error = null;

  const target = checkWebhookUrl(row.url);
  const resolveError = target.ok ? await privateTargetError(target.value) : null;
  if (!target.ok) {
    error = target.error;
  } else if (resolveError) {
    error = resolveError;
  } else {
    try {
      const response = await fetch(target.value, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "GeigerEvents-Webhooks/1.0",
          "Geiger-Signature": signatureHeader(row.secret, timestamp, body),
          "Geiger-Event-Id": row.event_id,
          "Geiger-Event-Type": row.event_type,
          "Geiger-Delivery-Id": row.delivery_id,
          "Geiger-Delivery-Attempt": String(row.attempts),
        },
        body,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      status = response.status;
      snippet = await readSnippet(response);
      if (status >= 300 && status < 400) error = `Redirected (HTTP ${status}). Webhooks don't follow redirects.`;
      else if (status < 200 || status >= 300) error = `HTTP ${status}`;
    } catch (e) {
      error = describeFetchError(e);
    }
  }

  const ms = Date.now() - started;
  // A test send is a one-off check, so it never queues retries.
  const outcome = !error ? "succeeded" : row.origin === "test" || row.attempts >= MAX_ATTEMPTS ? "dead" : "failed";
  const delay = outcome === "failed" ? retryDelaySeconds(row.attempts) : null;
  const { error: recordError } = await db.rpc("webhook_record_attempt", {
    p_delivery: row.delivery_id,
    p_outcome: outcome,
    p_next_attempt_at: delay ? new Date(Date.now() + delay * 1000).toISOString() : null,
    p_response_status: status,
    p_response_ms: ms,
    p_response_body: snippet,
    p_error: error,
    p_disable_after: AUTO_DISABLE_AFTER,
  });
  if (recordError) console.error("[webhooks.record]", recordError.message);

  return {
    deliveryId: row.delivery_id,
    endpointId: row.endpoint_id,
    eventType: row.event_type,
    attempts: row.attempts,
    outcome,
    status,
    ms,
    error,
  };
}

// Sends one batch: due deliveries, or exactly `ids` (manual sends). Returns what happened to each.
export async function dispatchWebhooks({ ids = null, limit = 25 } = {}) {
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role Supabase client is not configured.", claimed: 0, results: [] };
  const { data, error } = await db.rpc("webhook_claim_deliveries", {
    p_limit: limit,
    p_ids: ids && ids.length ? ids : null,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) {
    console.error("[webhooks.claim]", error.message);
    return { ok: false, error: error.message, claimed: 0, results: [] };
  }
  const rows = data || [];
  const results = await mapLimit(rows, CONCURRENCY, (row) => deliver(db, row));
  return { ok: true, claimed: rows.length, results };
}

export async function runWebhookHousekeeping() {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db.rpc("webhook_housekeeping", { p_keep_days: 30 });
  if (error) {
    console.error("[webhooks.housekeeping]", error.message);
    return null;
  }
  return data;
}
