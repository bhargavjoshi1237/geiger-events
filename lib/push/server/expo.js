// Expo push service client: send in batches of 100, read receipts in batches of 1000. Pure apart from the injected fetch.

export const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
export const SEND_BATCH = 100;
export const RECEIPT_BATCH = 1000;

export function isExpoPushToken(token) {
  return typeof token === "string" && /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token.trim());
}

function headers(accessToken) {
  const h = { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

// Transient = worth retrying later: rate limits, Expo or network trouble, and auth (a rotated EXPO_ACCESS_TOKEN can be
// fixed within the backoff window instead of failing every queued push).
export function isTransientStatus(status) {
  return status === 429 || status === 401 || status === 403 || status >= 500 || status === 0;
}

// messages: [{ to, title, body, data, channelId, ... }] -> one result per message, in order:
// { ok: true, ticketId } | { ok: false, error, message, transient }.
export async function sendMessages(messages, { fetchImpl = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN } = {}) {
  const results = [];
  for (let i = 0; i < messages.length; i += SEND_BATCH) {
    const batch = messages.slice(i, i + SEND_BATCH);
    let status = 0;
    let json = null;
    try {
      const res = await fetchImpl(EXPO_SEND_URL, { method: "POST", headers: headers(accessToken), body: JSON.stringify(batch) });
      status = res.status;
      json = await res.json().catch(() => null);
    } catch (e) {
      json = { errors: [{ code: "NETWORK_ERROR", message: String(e?.message || e) }] };
    }
    const tickets = Array.isArray(json?.data) ? json.data : null;
    if (!tickets || status >= 400) {
      const err = json?.errors?.[0] || {};
      for (let j = 0; j < batch.length; j += 1) {
        results.push({
          ok: false,
          error: err.code || `HTTP_${status || 0}`,
          message: err.message || "Expo push request failed",
          transient: isTransientStatus(status),
        });
      }
      continue;
    }
    for (let j = 0; j < batch.length; j += 1) {
      const t = tickets[j];
      if (t?.status === "ok") results.push({ ok: true, ticketId: t.id || null });
      else {
        const code = t?.details?.error || "UnknownError";
        results.push({ ok: false, error: code, message: t?.message || code, transient: code === "MessageRateExceeded" });
      }
    }
  }
  return results;
}

// ids -> { [ticketId]: { status: "ok" } | { status: "error", error, message } }; ids missing from the answer aren't ready yet.
export async function getReceipts(ids, { fetchImpl = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN } = {}) {
  const out = {};
  for (let i = 0; i < ids.length; i += RECEIPT_BATCH) {
    const batch = ids.slice(i, i + RECEIPT_BATCH);
    try {
      const res = await fetchImpl(EXPO_RECEIPTS_URL, { method: "POST", headers: headers(accessToken), body: JSON.stringify({ ids: batch }) });
      const json = await res.json().catch(() => null);
      const data = json?.data && typeof json.data === "object" ? json.data : {};
      for (const [id, r] of Object.entries(data)) {
        out[id] = r?.status === "ok"
          ? { status: "ok" }
          : { status: "error", error: r?.details?.error || "UnknownError", message: r?.message || "" };
      }
    } catch (e) {
      console.error("[push.expo.receipts]", e);
    }
  }
  return out;
}
