import { ACCOUNT_STATUS } from "@geiger/pay";

import { isPlaygroundActive } from "@/lib/playground/mode";

const ENDPOINT = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/pay/account`;
const PLAYGROUND_ERROR = { error: { code: "playground", message: "Payments can't be changed in the playground." } };

async function send(method, { query, body } = {}) {
  try {
    const response = await fetch(query ? `${ENDPOINT}?${new URLSearchParams(query)}` : ENDPOINT, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: payload?.error ?? { code: "request_failed", message: "Couldn't reach payment settings." } };
    }
    return payload;
  } catch {
    return { error: { code: "network_error", message: "Connection failed. Try again." } };
  }
}

// `{ account, canManage, stripeConfigured, demoMode, demoAvailable }` for the project; `refresh` re-reads Stripe first.
export async function getPaymentSettings(projectId, { refresh = false } = {}) {
  if (isPlaygroundActive()) {
    return {
      account: { status: ACCOUNT_STATUS.NOT_CONNECTED },
      canManage: true,
      stripeConfigured: true,
      demoMode: true,
      demoAvailable: true,
    };
  }
  return send("GET", { query: { projectId, ...(refresh ? { refresh: "1" } : {}) } });
}

// Returns `{ url }` for Stripe-hosted onboarding, which comes back to the current page.
export async function connectStripe(projectId, { country }) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  return send("POST", { body: { projectId, country, returnUrl: window.location.href } });
}

export async function refreshStripe(projectId) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  const result = await send("PATCH", { body: { projectId } });
  return result.error ? result : result.account;
}

export async function disconnectStripe(projectId) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  const result = await send("DELETE", { body: { projectId } });
  return result.error ? result : result.account;
}

export async function setDemoMode(projectId, demoMode) {
  if (isPlaygroundActive()) return PLAYGROUND_ERROR;
  return send("PUT", { body: { projectId, demoMode } });
}
