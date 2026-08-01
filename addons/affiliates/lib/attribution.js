"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/events";

// Client half of last-touch attribution.
//
// A visit to /e/<id>?ref=<slug> validates the token, logs a click and stores it
// in a per-event cookie. When an order lands, the stored token is handed to
// events.attribute_affiliate_order.
//
// The cookie is a HINT, never an authority: every gate that decides whether
// commission is owed (program window, eligibility rules, self-referral, caps,
// budget) is re-checked server-side in that RPC, because anyone can forge a
// cookie. This module's only job is remembering which link the buyer arrived on.

const COOKIE_PREFIX = "geiger_aff_";
const DEFAULT_WINDOW_DAYS = 30;

function cookieName(eventId) {
  return `${COOKIE_PREFIX}${String(eventId).replace(/[^a-zA-Z0-9-]/g, "")}`;
}

export function storeRef(eventId, ref, windowDays = DEFAULT_WINDOW_DAYS) {
  if (typeof document === "undefined" || !eventId || !ref) return;
  const maxAge = Math.max(1, Number(windowDays) || DEFAULT_WINDOW_DAYS) * 86400;
  document.cookie = `${cookieName(eventId)}=${encodeURIComponent(ref)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function readRef(eventId) {
  if (typeof document === "undefined" || !eventId) return null;
  const name = `${cookieName(eventId)}=`;
  const hit = document.cookie
    .split("; ")
    .find((part) => part.startsWith(name));
  return hit ? decodeURIComponent(hit.slice(name.length)) : null;
}

export function clearRef(eventId) {
  if (typeof document === "undefined" || !eventId) return;
  document.cookie = `${cookieName(eventId)}=; path=/; max-age=0; SameSite=Lax`;
}

// Validate a ref token against the event's program. Returns the enrolment id on
// success, null otherwise (including "this event has no program", which is the
// normal case for most events and must stay silent).
export async function resolveRef(eventId, { ref, code } = {}) {
  if (!eventId || (!ref && !code) || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_affiliate_ref", {
      p_event_id: eventId,
      p_ref: ref || null,
      p_code: code || null,
    });
    if (error) {
      console.error("[affiliates.resolveRef]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) return null;
    return {
      enrolmentId: row.enrolment_id,
      programId: row.program_id,
      source: row.source,
    };
  } catch (e) {
    console.error("[affiliates.resolveRef]", e);
    return null;
  }
}

async function logClick(enrolmentId) {
  if (!enrolmentId || !isSupabaseConfigured()) return;
  try {
    const sb = createClient();
    await sb.rpc("log_affiliate_click", {
      p_enrolment_id: enrolmentId,
      // The browser can't see its own IP; the RPC hashes whatever it is given
      // and null is a legitimate value. User-agent is enough to dedupe reloads.
      p_ip: null,
      p_ua: typeof navigator === "undefined" ? null : navigator.userAgent,
      p_landing_url: typeof window === "undefined" ? "" : window.location.href,
      p_referrer: typeof document === "undefined" ? "" : document.referrer,
    });
  } catch (e) {
    console.error("[affiliates.logClick]", e);
  }
}

// Capture ?ref on a public event page: validate, log the click, remember it, and
// strip the parameter so a refresh doesn't double-count and the URL stays clean.
// Silently does nothing when the event has no affiliate program.
export async function captureRefFromUrl(eventId) {
  if (typeof window === "undefined" || !eventId) return false;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return false;

  const resolved = await resolveRef(eventId, { ref });

  params.delete("ref");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );

  if (!resolved) return false;
  storeRef(eventId, ref);
  await logClick(resolved.enrolmentId);
  return true;
}

// Attribute a completed order. Safe to call more than once per order — the RPC
// is idempotent on order_id. Returns true only when a commission now exists.
export async function attributeOrderFromStorage(eventId, orderId, { code } = {}) {
  if (!eventId || !orderId || !isSupabaseConfigured()) return false;
  const ref = readRef(eventId);
  if (!ref && !code) return false;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("attribute_affiliate_order", {
      p_order_id: orderId,
      p_ref: ref || null,
      p_code: code || null,
    });
    if (error) {
      console.error("[affiliates.attributeOrder]", error.message);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return Boolean(row?.ok);
  } catch (e) {
    console.error("[affiliates.attributeOrder]", e);
    return false;
  }
}
