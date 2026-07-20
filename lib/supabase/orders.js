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
  // The tier's stable id (when a real editor-configured tier was chosen). Drives
  // the RPC's per-tier inventory guard; null for synthesized/untiered tickets.
  ticketId = null,
  price,
  quantity,
  addons = 0,
  selections = null,
  // Conditional purchasables the buyer chose (readable records) + the booked
  // slot, both stored on the order metadata. slotId drives the RPC's per-slot
  // inventory guard (like ticketId does per tier).
  purchasables = null,
  slot = null,
  slotId = null,
  // A discount code the buyer applied. The RPC re-validates it against the
  // event's attached coupons and reduces the total authoritatively.
  discountCode = null,
  // A one-off donation added to the order total (once, not × qty). The RPC
  // records it authoritatively on the order metadata.
  donation = 0,
  // Group purchasing: one { name, email } per seat. When present the RPC fans
  // this one payment out into a separate order row per attendee (each email-keyed
  // so it lands in that attendee's own portal), sharing a groupId.
  attendees = null,
  // A bundle id (metadata.bundles[].id). The RPC prices from the bundle and
  // decrements each included ticket's inventory.
  bundleId = null,
  // An access code for a gated (hidden) ticket. The RPC re-validates it against
  // metadata.accessCodes before allowing the purchase.
  accessCode = null,
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
    const meta = {};
    if (selections) meta.offerings = selections;
    if (Array.isArray(purchasables) && purchasables.length) meta.purchasables = purchasables;
    if (slot) meta.slot = slot;
    const args = {
      p_event_id: eventId,
      p_name: name || "",
      p_email: email || "",
      p_ticket: ticket || "General Admission",
      p_price: Number(price) || 0,
      p_qty: qty,
      p_addons: Number(addons) || 0,
      p_meta: meta,
      p_stripe_session_id: stripeSessionId || null,
      p_stripe_payment_intent_id: stripePaymentIntentId || null,
      p_tier_id: ticketId != null ? String(ticketId) : null,
    };
    // Only send the newer params when used so plain checkouts resolve against the
    // base RPC signature without needing the newer migrations.
    if (slotId != null) args.p_slot_id = String(slotId);
    if (discountCode) args.p_discount_code = String(discountCode);
    if (Number(donation) > 0) args.p_donation = Number(donation);
    if (Array.isArray(attendees) && attendees.length) args.p_attendees = attendees;
    if (bundleId) args.p_bundle_id = String(bundleId);
    if (accessCode) args.p_access_code = String(accessCode);
    const { data, error } = await sb.rpc("buy_ticket", args);
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

// All orders in a project, newest first — powers the cross-event Orders list on
// the Tickets → Orders & Attendees screen. event_orders carries a denormalized
// project_id (stamped by buy_ticket / zz_project_access.sql).
export async function listProjectOrders(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("event_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orders.listProject]", error.message);
      return null;
    }
    return (data || []).map(normalizeOrder);
  } catch (e) {
    console.error("[orders.listProject]", e);
    return null;
  }
}

// Derive the operational display status the Orders cockpit renders, from the
// stored status + refund/cancel lifecycle. Disputes are tracked separately (the
// Disputes screen), so they don't factor in here.
export function deriveOrderStatus(row) {
  if (row?.cancelled_at) return "Cancelled";
  const total = Number(row?.total ?? 0);
  const refunded = Number(row?.refunded_total ?? 0);
  if (refunded > 0 && refunded >= total && total > 0) return "Refunded";
  if (refunded > 0) return "Partially refunded";
  return "Paid";
}

// A single order by id (for the detail drawer / deep-link).
export async function getOrder(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("event_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[orders.get]", error.message);
      return null;
    }
    return normalizeOrder(data);
  } catch (e) {
    console.error("[orders.get]", e);
    return null;
  }
}

// Cancel an order — stamps cancelled_at and logs a timeline entry. Does not move
// money; pair with a refund when the buyer is owed one.
export async function cancelOrder(id, { actor = "" } = {}) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("event_orders")
      .update({ cancelled_at: new Date().toISOString(), status: "cancelled" })
      .eq("id", id)
      .select("project_id")
      .single();
    if (error) {
      console.error("[orders.cancel]", error.message);
      return false;
    }
    await sb.from("order_events").insert({
      order_id: id,
      project_id: data?.project_id ?? null,
      type: "cancelled",
      summary: "Order cancelled",
      actor: actor || "",
    });
    return true;
  } catch (e) {
    console.error("[orders.cancel]", e);
    return false;
  }
}

export function normalizeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    projectId: row.project_id ?? null,
    name: row.buyer_name ?? "",
    email: row.buyer_email ?? "",
    ticket: row.ticket_name ?? "",
    price: Number(row.ticket_price ?? 0),
    quantity: row.quantity ?? 1,
    total: Number(row.total ?? 0),
    refundedTotal: Number(row.refunded_total ?? 0),
    cancelledAt: row.cancelled_at ?? null,
    // Raw persisted status (confirmed/refunded); the cockpit uses displayStatus.
    status: row.status ?? "confirmed",
    displayStatus: deriveOrderStatus(row),
    // Chosen offerings / purchasables + the booked slot (when any) live on the
    // order's metadata bag.
    offerings:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.offerings ?? null
        : null,
    purchasables:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.purchasables ?? null
        : null,
    slot:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.slot ?? null
        : null,
    discount:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.discount ?? null
        : null,
    // Add-on features (donation / early-bird savings / bundle contents / group
    // context) also ride on the order metadata bag.
    donation:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.donation ?? null
        : null,
    earlybird:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.earlybird ?? null
        : null,
    bundle:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.bundle ?? null
        : null,
    group:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.group ?? null
        : null,
    stripeSessionId: row.stripe_session_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    createdAt: row.created_at,
  };
}
