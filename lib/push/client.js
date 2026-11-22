"use client";

import { isPlaygroundActive } from "@/lib/playground/mode";
import { portalUrl } from "@/lib/portal/portal_fetch";
import { normalizeSettings } from "@/lib/push/types";

// Browser side of the push settings routes. Every call returns { error } or its payload; never throws.

const PLAYGROUND_ERROR = {
  error: { code: "playground", message: "Push notifications can't be managed in the playground." },
};

async function send(path, method, body) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  try {
    const response = await fetch(portalUrl(path), {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: payload?.error ?? { code: "request_failed", message: "Couldn't complete that. Please try again." } };
    }
    return payload ?? {};
  } catch {
    return { error: { code: "network_error", message: "Connection failed. Try again." } };
  }
}

// Drops empty params so the routes see only the filters in use.
function withQuery(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  return `${path}?${query}`;
}

function withSettings(result) {
  return result.error ? result : { ...result, settings: normalizeSettings(result.settings) };
}

export async function getPushSettings(projectId) {
  return withSettings(await send(withQuery("/api/settings/push", { projectId }), "GET"));
}

export async function savePushSettings(projectId, settings) {
  return withSettings(await send("/api/settings/push", "PUT", { projectId, settings }));
}

// → { items, nextCursor }
export async function listPushLog(projectId, { status, type, cursor } = {}) {
  const result = await send(withQuery("/api/settings/push/log", { projectId, status, type, cursor }), "GET");
  return result.error ? result : { items: result.items ?? [], nextCursor: result.nextCursor ?? null };
}

// → { item }
export async function retryPush(projectId, id) {
  return send("/api/settings/push/log", "POST", { projectId, action: "retry", id });
}

// → { ok, sent, message }: goes to the signed-in organiser's own app account.
export async function sendTestPush(projectId) {
  return send("/api/settings/push/log", "POST", { projectId, action: "test" });
}

// → { configured, globalPaused, paused, jobs, runs }
export async function getPushScheduler(projectId) {
  const result = await send(withQuery("/api/settings/push/scheduler", { projectId }), "GET");
  if (result.error) return result;
  return {
    configured: Boolean(result.configured),
    globalPaused: Boolean(result.globalPaused),
    paused: Boolean(result.paused),
    jobs: result.jobs ?? [],
    runs: result.runs ?? [],
  };
}
