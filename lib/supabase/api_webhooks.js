"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Read side of Settings → API & Webhooks: keys, endpoints, deliveries and endpoint health. Writes (and anything holding
// a secret) go through /api/settings/* (lib/api_webhooks/client.js). Never throws: console.error and return null.

const KEY_COLUMNS = "id,project_id,name,prefix,scopes,last_used_at,last_used_ip,expires_at,revoked_at,created_at";
const ENDPOINT_COLUMNS =
  "id,project_id,url,description,event_types,active,failure_streak,last_delivery_at,last_success_at," +
  "last_failure_at,disabled_at,disabled_reason,secret_rotated_at,created_at,updated_at";
const DELIVERY_COLUMNS =
  "id,event_id,endpoint_id,event_type,status,origin,replay_of,attempts,next_attempt_at,last_attempt_at," +
  "delivered_at,response_status,response_ms,last_error,created_at,endpoint:webhook_endpoints(url)";

function keyStatus(row) {
  if (row.revoked_at) return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

export function normalizeApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name ?? "",
    prefix: row.prefix ?? "",
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    lastUsedAt: row.last_used_at ?? null,
    lastUsedIp: row.last_used_ip ?? "",
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: row.created_at ?? null,
    status: keyStatus(row),
  };
}

export function normalizeEndpoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url ?? "",
    description: row.description ?? "",
    eventTypes: Array.isArray(row.event_types) ? row.event_types : [],
    active: row.active !== false,
    failureStreak: row.failure_streak ?? 0,
    lastDeliveryAt: row.last_delivery_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    disabledAt: row.disabled_at ?? null,
    disabledReason: row.disabled_reason ?? "",
    secretRotatedAt: row.secret_rotated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    endpointId: row.endpoint_id,
    endpointUrl: row.endpoint?.url ?? "",
    eventType: row.event_type ?? "",
    status: row.status ?? "pending",
    origin: row.origin ?? "event",
    replayOf: row.replay_of ?? null,
    attempts: row.attempts ?? 0,
    nextAttemptAt: row.next_attempt_at ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    responseStatus: row.response_status ?? null,
    responseMs: row.response_ms ?? null,
    responseBody: row.response_body ?? "",
    lastError: row.last_error ?? "",
    attemptLog: Array.isArray(row.attempt_log) ? row.attempt_log : [],
    createdAt: row.created_at ?? null,
    event: row.event
      ? {
          id: row.event.id,
          type: row.event.type,
          payload: row.event.payload ?? {},
          occurredAt: row.event.occurred_at ?? null,
          projectId: row.event.project_id ?? null,
        }
      : null,
  };
}

export async function listApiKeys(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("api_keys")
      .select(KEY_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[apiWebhooks.listKeys]", error.message);
      return null;
    }
    return (data || []).map(normalizeApiKey);
  } catch (e) {
    console.error("[apiWebhooks.listKeys]", e);
    return null;
  }
}

export async function listWebhookEndpoints(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("webhook_endpoints")
      .select(ENDPOINT_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[apiWebhooks.listEndpoints]", error.message);
      return null;
    }
    return (data || []).map(normalizeEndpoint);
  } catch (e) {
    console.error("[apiWebhooks.listEndpoints]", e);
    return null;
  }
}

// The newest deliveries across every endpoint (the log filters these on screen).
export async function listWebhookDeliveries(projectId, { limit = 500 } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("webhook_deliveries")
      .select(DELIVERY_COLUMNS)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[apiWebhooks.listDeliveries]", error.message);
      return null;
    }
    return (data || []).map(normalizeDelivery);
  } catch (e) {
    console.error("[apiWebhooks.listDeliveries]", e);
    return null;
  }
}

// One delivery with its response, attempt history and the event payload it sent.
export async function getWebhookDelivery(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("webhook_deliveries")
      .select(`${DELIVERY_COLUMNS},response_body,attempt_log,event:webhook_events(id,type,payload,occurred_at,project_id)`)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[apiWebhooks.getDelivery]", error.message);
      return null;
    }
    return normalizeDelivery(data);
  } catch (e) {
    console.error("[apiWebhooks.getDelivery]", e);
    return null;
  }
}

// Per-endpoint delivery counts since `since` (default: the last 7 days), keyed by endpoint id.
export async function getWebhookHealth(projectId, since = null) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient().rpc("webhook_health", {
      p_project: projectId,
      p_since: since,
    });
    if (error) {
      console.error("[apiWebhooks.health]", error.message);
      return null;
    }
    const out = {};
    for (const row of data || []) {
      out[row.endpoint_id] = {
        total: Number(row.total) || 0,
        succeeded: Number(row.succeeded) || 0,
        failed: Number(row.failed) || 0,
        dead: Number(row.dead) || 0,
        pending: Number(row.pending) || 0,
        avgMs: row.avg_ms == null ? null : Number(row.avg_ms),
        lastAttemptAt: row.last_attempt_at ?? null,
      };
    }
    return out;
  } catch (e) {
    console.error("[apiWebhooks.health]", e);
    return null;
  }
}
