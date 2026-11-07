"use client";

import { isPlaygroundActive } from "@/lib/playground/mode";
import { portalUrl } from "@/lib/portal/portal_fetch";
import { normalizeApiKey, normalizeEndpoint } from "@/lib/supabase/api_webhooks";

// Browser side of the API & Webhooks settings routes. Every call returns { error } or its payload; never throws.

const PLAYGROUND_ERROR = {
  error: { code: "playground", message: "API keys and webhooks can't be changed in the playground." },
};

async function send(path, method, body) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  try {
    const response = await fetch(portalUrl(path), {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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

function withKey(result) {
  return result.error ? result : { ...result, key: normalizeApiKey(result.key) };
}

function withEndpoint(result) {
  return result.error || !result.endpoint ? result : { ...result, endpoint: normalizeEndpoint(result.endpoint) };
}

// → { key, secret }: the secret is shown once.
export async function createApiKey(projectId, { name, scopes, expiry }) {
  return withKey(await send("/api/settings/api-keys", "POST", { projectId, name, scopes, expiry }));
}

export async function revokeApiKey(projectId, id) {
  return withKey(await send("/api/settings/api-keys", "DELETE", { projectId, id }));
}

export async function createWebhookEndpoint(projectId, { url, description, eventTypes }) {
  return withEndpoint(await send("/api/settings/webhooks", "POST", { projectId, url, description, eventTypes }));
}

export async function updateWebhookEndpoint(projectId, id, patch) {
  return withEndpoint(await send("/api/settings/webhooks", "PATCH", { projectId, id, ...patch }));
}

export async function deleteWebhookEndpoint(projectId, id) {
  return send("/api/settings/webhooks", "DELETE", { projectId, id });
}

export async function revealWebhookSecret(projectId, id) {
  return send("/api/settings/webhooks/secret", "POST", { projectId, id, action: "reveal" });
}

export async function rotateWebhookSecret(projectId, id) {
  return withEndpoint(await send("/api/settings/webhooks/secret", "POST", { projectId, id, action: "rotate" }));
}

// → { deliveryId, result: { outcome, status, ms, error } | null, busy }
export async function sendWebhookTest(projectId, endpointId) {
  return send("/api/settings/webhooks/deliveries", "POST", { projectId, action: "test", endpointId });
}

export async function retryWebhookDelivery(projectId, deliveryId) {
  return send("/api/settings/webhooks/deliveries", "POST", { projectId, action: "retry", deliveryId });
}

export async function replayWebhookDelivery(projectId, deliveryId) {
  return send("/api/settings/webhooks/deliveries", "POST", { projectId, action: "replay", deliveryId });
}
