"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for ticket orders / registrations. Talks to the
// public.flow_event_orders table and the flow_buy_ticket() RPC. Pure: validate,
// console.error on failure, return a plain result object — never throw, never
// toast (the checkout UI owns UX).

// Purchase `quantity` of `ticket` for an event. The RPC records the order and
// bumps the event's sold/revenue atomically (with an oversell guard), returning
// the new tallies. `addons` is the per-ticket add-on total from chosen offerings
// (folded into the order total as (price + addons) × qty); `selections` is the
// readable record of those choices, stored on the order's metadata. Without
// Supabase configured we resolve a local "ok" so the demo checkout completes.
export async function buyTicket({
  eventId,
  name,
  email,
  ticket,
  price,
  quantity,
  addons = 0,
  selections = null,
  stripeSessionId = null,
  stripePaymentIntentId = null,
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  if (!eventId) {
    return { ok: false, error: "Missing event." };
  }
  if (!isSupabaseConfigured()) {
    return { ok: true, orderId: null, local: true };
  }
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("buy_ticket", {
      p_event_id: eventId,
      p_name: name || "",
      p_email: email || "",
      p_ticket: ticket || "General Admission",
      p_price: Number(price) || 0,
      p_qty: qty,
      p_addons: Number(addons) || 0,
      p_meta: selections ? { offerings: selections } : {},
      p_stripe_session_id: stripeSessionId || null,
      p_stripe_payment_intent_id: stripePaymentIntentId || null,
    });
    if (error) {
      console.error("[orders.buy]", error.message);
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, error: "No response." };
    return {
      ok: Boolean(row.ok),
      orderId: row.order_id ?? null,
      sold: row.sold,
      capacity: row.capacity,
      remaining: row.remaining,
      // false when this call re-hit an existing stripe_session_id instead of
      // inserting — lets a return-page verify skip re-sending a confirmation.
      created: row.created !== false,
      // ok=false with a row means the oversell guard tripped (sold out).
      soldOut: row.ok === false,
    };
  } catch (e) {
    console.error("[orders.buy]", e);
    return { ok: false, error: String(e) };
  }
}

// Orders for an event, newest first (for the organizer's registrations view).
export async function listOrders(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("event_orders")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orders.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeOrder);
  } catch (e) {
    console.error("[orders.list]", e);
    return null;
  }
}

export function normalizeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.buyer_name ?? "",
    email: row.buyer_email ?? "",
    ticket: row.ticket_name ?? "",
    price: Number(row.ticket_price ?? 0),
    quantity: row.quantity ?? 1,
    total: Number(row.total ?? 0),
    status: row.status ?? "confirmed",
    // Chosen offerings (when any) live on the order's metadata bag.
    offerings:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.offerings ?? null
        : null,
    stripeSessionId: row.stripe_session_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    createdAt: row.created_at,
  };
}
