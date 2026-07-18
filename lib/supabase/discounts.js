"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Discount-code validation for the public checkout. A buyer's typed code is
// validated against the coupons ATTACHED to the event (metadata.attached.discount)
// through the public_event_discount() SECURITY DEFINER RPC — so only attached,
// active coupons within their usage limit resolve, and the member-only
// ticketing_records table is never exposed to anon buyers. Pure: returns a plain
// result object, never throws, never toasts (the checkout owns UX).

// Base amount a discount applies to. "tickets" → ticket price × qty only;
// "order" (default) → the full (price + add-ons) × qty subtotal.
export function discountBase({ price, qty, addonUnit }, appliesTo) {
  const p = Number(price) || 0;
  const a = Number(addonUnit) || 0;
  const q = Math.max(1, Number(qty) || 1);
  return appliesTo === "tickets" ? p * q : (p + a) * q;
}

// The money a discount takes off `base`. percent → base × value%; flat → value.
// Never exceeds the base; rounded to cents. Mirror of the SQL/Stripe math so the
// client preview, the order RPC, and Stripe all agree.
export function discountAmountFor(discount, base) {
  if (!discount || !base || base <= 0) return 0;
  const value = Number(discount.value) || 0;
  let amt = discount.discountType === "flat" ? value : (base * value) / 100;
  amt = Math.min(amt, base);
  return Math.max(0, Math.round(amt * 100) / 100);
}

// Validate a code for an event. Returns { ok, id, code, discountType, value } on
// success, or { ok:false, reason } ("empty" | "not_allowed" | "invalid" |
// "limit" | "error" | "unavailable"). Without Supabase we can't validate.
export async function validateEventDiscount(eventId, code) {
  const trimmed = (code || "").trim();
  if (!eventId || !trimmed) return { ok: false, reason: "empty" };
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_event_discount", {
      p_event_id: eventId,
      p_code: trimmed,
    });
    if (error) {
      console.error("[discounts.validate]", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) return { ok: false, reason: row?.reason || "invalid" };
    return {
      ok: true,
      id: row.id,
      code: row.code,
      discountType: row.discount_type || "percent",
      value: Number(row.value) || 0,
    };
  } catch (e) {
    console.error("[discounts.validate]", e);
    return { ok: false, reason: "error" };
  }
}
