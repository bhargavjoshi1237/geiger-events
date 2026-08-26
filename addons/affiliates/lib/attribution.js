"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/events";

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
      p_ip: null,
      p_ua: typeof navigator === "undefined" ? null : navigator.userAgent,
      p_landing_url: typeof window === "undefined" ? "" : window.location.href,
      p_referrer: typeof document === "undefined" ? "" : document.referrer,
    });
  } catch (e) {
    console.error("[affiliates.logClick]", e);
  }
}

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
