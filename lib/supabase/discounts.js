"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Discount-code validation for the public checkout. A buyer's typed code is
// validated against the coupons ATTACHED TO THE TICKET they are buying
// (metadata.tickets[].discountIds) through the public_event_discount()
// SECURITY DEFINER RPC — so only codes that ticket accepts, that are active,
// within their window and under their usage limit resolve, and the member-only
// ticketing_records table is never exposed to anon buyers. Pure: returns a
// plain result object, never throws, never toasts (the checkout owns UX).
//
// The RPC also resolves the coupon's rule list server-side and hands back the
// winning reward (type + value + whether it was per-order or per-ticket), plus
// the ceiling from maxDiscount. Turning that reward into money is
// discountAmountFor() in lib/events/discount_rules.js, which mirrors the SQL
// exactly so the preview, the order row and Stripe cannot disagree.

// Base amount a discount applies to. "tickets" → ticket price × qty only;
// "order" (default) → the full (price + add-ons) × qty subtotal.
export function discountBase({ price, qty, addonUnit }, appliesTo) {
  const p = Number(price) || 0;
  const a = Number(addonUnit) || 0;
  const q = Math.max(1, Number(qty) || 1);
  return appliesTo === "tickets" ? p * q : (p + a) * q;
}

// Validate a code for a ticket. `opts` carries { ticketId, qty, base }:
// ticketId scopes the code, qty drives the quantity/time rules, and base is the
// amount a percentage would be taken from (pass it to also get a server-side
// `amount` back).
//
// Returns { ok, id, code, discountType, value, applyPer, maxDiscount, amount,
// ruleId, ruleLabel, matched } on success, or { ok:false, reason } — one of
// "empty" | "not_allowed" | "invalid" | "limit" | "pending" | "expired" |
// "min_qty" | "max_qty" | "error" | "unavailable".
export async function validateEventDiscount(eventId, code, opts = {}) {
  const trimmed = (code || "").trim();
  if (!eventId || !trimmed) return { ok: false, reason: "empty" };
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_event_discount", {
      p_event_id: eventId,
      p_code: trimmed,
      p_ticket_id: opts.ticketId ?? null,
      p_qty: Math.max(1, Number(opts.qty) || 1),
      p_base: opts.base == null ? null : Number(opts.base) || 0,
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
      applyPer: row.apply_per || "order",
      maxDiscount: row.max_discount == null ? null : Number(row.max_discount),
      amount: Number(row.amount) || 0,
      ruleId: row.rule_id || null,
      ruleLabel: row.rule_label || "",
      matched: !!row.matched,
    };
  } catch (e) {
    console.error("[discounts.validate]", e);
    return { ok: false, reason: "error" };
  }
}
