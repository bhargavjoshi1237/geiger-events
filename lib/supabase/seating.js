"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for PER-EVENT seat state — holds and assignments over a
// venue's seat map template (owned by lib/supabase/seat_maps.js). Keeps actions
// pure: validate, console.error on failure, and return null / false / [] —
// never throw, never toast (the screen owns UX).
//
// Reads and buyer writes go through security-definer RPCs so the anon
// storefront never touches the tables directly:
//   public_event_seat_map · hold_seats · release_seats · buy_seats
// Box-office writes (block, comp, reseat) go through the table under the
// member RLS policy.

const ASSIGNMENTS = "seat_assignments";
const TOKEN_KEY = "geiger.seatToken";

export function normalizeAssignment(row) {
  if (!row) return null;
  // `seat` is the embedded chair when the caller asked for it (listAssignments
  // does), so a pass or a check-in row can print "Orchestra · F12" directly.
  const seat = row.seat || null;
  const sectionName = seat?.section?.name || "";
  const rowLabel = seat?.row_label ?? "";
  const seatLabel = seat?.seat_label ?? "";
  const label = seat
    ? [sectionName, rowLabel && seatLabel ? `${rowLabel}${seatLabel}` : ""]
        .filter(Boolean)
        .join(" · ")
    : "";
  return {
    id: row.id,
    sectionName,
    rowLabel,
    seatLabel,
    label,
    eventId: row.event_id ?? null,
    seatId: row.seat_id ?? null,
    orderId: row.order_id ?? null,
    attendeeName: row.attendee_name ?? "",
    attendeeEmail: row.attendee_email ?? "",
    ticketId: row.ticket_id ?? null,
    price: Number(row.price ?? 0),
    status: row.status ?? "sold",
    note: row.note ?? "",
    createdAt: row.created_at ?? null,
    releasedAt: row.released_at ?? null,
  };
}

// One opaque token per browser session, identifying which holds are "mine".
// Persisted in sessionStorage so a Stripe redirect returns to the same holds.
export function seatToken() {
  if (typeof window === "undefined") return "";
  try {
    let token = window.sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      window.sessionStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    // Private-mode browsers can refuse sessionStorage; a per-load token still
    // works for a single uninterrupted checkout.
    return crypto.randomUUID();
  }
}

// The map, its sections and seats, plus the ids that are already taken (sold,
// comped, blocked, or live-held). One call serves both the dashboard and the
// anon storefront. Returns null when the event has no seat map configured.
export async function getEventSeating(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_event_seat_map", {
      p_event_id: eventId,
    });
    if (error) {
      console.error("[seating.get]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.map) return null;
    return {
      map: row.map,
      sections: Array.isArray(row.sections) ? row.sections : [],
      seats: Array.isArray(row.seats) ? row.seats : [],
      taken: new Set(Array.isArray(row.taken) ? row.taken : []),
    };
  } catch (e) {
    console.error("[seating.get]", e);
    return null;
  }
}

// Claim seats for this checkout session. Steals expired holds, refuses live
// ones. `rejected` lists seats someone else took first — the screen flips those
// to sold and tells the buyer.
export async function holdSeats(eventId, seatIds, token, minutes = 10) {
  if (!eventId || !seatIds?.length || !token || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("hold_seats", {
      p_event_id: eventId,
      p_seat_ids: seatIds,
      p_token: token,
      p_minutes: minutes,
    });
    if (error) {
      console.error("[seating.hold]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      ok: row.ok === true,
      held: Array.isArray(row.held) ? row.held : [],
      rejected: Array.isArray(row.rejected) ? row.rejected : [],
      expiresAt: row.expires_at ?? null,
    };
  } catch (e) {
    console.error("[seating.hold]", e);
    return null;
  }
}

// Drop this session's holds (buyer closed the picker or changed their mind).
export async function releaseSeats(eventId, token) {
  if (!eventId || !token || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("release_seats", {
      p_event_id: eventId,
      p_token: token,
    });
    if (error) {
      console.error("[seating.release]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating.release]", e);
    return false;
  }
}

// The seated purchase. Validates holds, delegates money/inventory to
// buy_ticket, then writes the assignments — all in one transaction.
export async function buySeats(input) {
  if (!input?.eventId || !input?.seatIds?.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("buy_seats", {
      p_event_id: input.eventId,
      p_name: input.name ?? "",
      p_email: input.email ?? "",
      p_ticket: input.ticketName ?? "General Admission",
      p_price: Number(input.price) || 0,
      p_addons: Number(input.addons) || 0,
      p_meta: input.meta ?? {},
      p_stripe_session_id: input.stripeSessionId ?? null,
      p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      p_tier_id: input.tierId ?? null,
      p_slot_id: input.slotId ?? null,
      p_discount_code: input.discountCode ?? null,
      p_donation: Number(input.donation) || 0,
      p_bundle_id: input.bundleId ?? null,
      p_attendees: input.attendees ?? null,
      p_access_code: input.accessCode ?? null,
      p_seat_ids: input.seatIds,
      p_seat_token: input.token ?? null,
    });
    if (error) {
      console.error("[seating.buy]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      ok: row.ok === true,
      orderId: row.order_id ?? null,
      sold: Number(row.sold ?? 0),
      capacity: Number(row.capacity ?? 0),
      remaining: Number(row.remaining ?? 0),
      created: row.created === true,
    };
  } catch (e) {
    console.error("[seating.buy]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Box office (member-only, straight through the table under RLS)
// ---------------------------------------------------------------------------

// Live assignments for an event — what the organiser's map colours in.
export async function listAssignments(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .select("*, seat:seats(row_label, seat_label, section:seat_map_sections(name))")
      .eq("event_id", eventId)
      .is("released_at", null);
    if (error) {
      console.error("[seating.listAssignments]", error.message);
      return null;
    }
    return (data || []).map(normalizeAssignment);
  } catch (e) {
    console.error("[seating.listAssignments]", e);
    return null;
  }
}

// Hold seats off sale (production holds, house seats, sightline kills).
export async function blockSeats(eventId, seatIds, note = "") {
  if (!eventId || !seatIds?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const rows = seatIds.map((seatId) => ({
      event_id: eventId,
      seat_id: seatId,
      status: "blocked",
      note,
    }));
    const { error } = await sb.from(ASSIGNMENTS).insert(rows);
    if (error) {
      console.error("[seating.block]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating.block]", e);
    return false;
  }
}

// Return blocked seats to the pool. Only ever releases 'blocked' rows so a
// mis-click can't silently cancel a real sale.
export async function unblockSeats(eventId, seatIds) {
  if (!eventId || !seatIds?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ASSIGNMENTS)
      .update({ released_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("status", "blocked")
      .is("released_at", null)
      .in("seat_id", seatIds);
    if (error) {
      console.error("[seating.unblock]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating.unblock]", e);
    return false;
  }
}

// Hand a seat to a guest without an order (comp, offline sale, VIP).
export async function assignComp(eventId, seatId, attendee = {}) {
  if (!eventId || !seatId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .insert({
        event_id: eventId,
        seat_id: seatId,
        attendee_name: attendee.name ?? "",
        attendee_email: attendee.email ?? "",
        ticket_id: attendee.ticketId ?? null,
        status: "comp",
        note: attendee.note ?? "",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[seating.comp]", error.message);
      return null;
    }
    return normalizeAssignment(data);
  } catch (e) {
    console.error("[seating.comp]", e);
    return null;
  }
}

// Move a buyer to a different seat. Claims the target FIRST so a taken seat
// fails against the unique index and leaves the original assignment intact.
export async function reseat(assignment, nextSeatId) {
  if (!assignment?.id || !nextSeatId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .insert({
        event_id: assignment.eventId,
        seat_id: nextSeatId,
        order_id: assignment.orderId,
        attendee_name: assignment.attendeeName,
        attendee_email: assignment.attendeeEmail,
        ticket_id: assignment.ticketId,
        price: assignment.price,
        status: assignment.status,
        note: assignment.note,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[seating.reseat]", error.message);
      return null;
    }

    const { error: releaseError } = await sb
      .from(ASSIGNMENTS)
      .update({ released_at: new Date().toISOString() })
      .eq("id", assignment.id);
    if (releaseError) {
      // The move half-applied: drop the new row so the buyer keeps one seat.
      console.error("[seating.reseat]", releaseError.message);
      await sb.from(ASSIGNMENTS).delete().eq("id", data.id);
      return null;
    }
    return normalizeAssignment(data);
  } catch (e) {
    console.error("[seating.reseat]", e);
    return null;
  }
}

// Return an order's seats to the pool on refund or cancellation. Without this,
// refunded seats leak permanently.
export async function releaseOrderSeats(orderId) {
  if (!orderId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("release_order_seats", { p_order_id: orderId });
    if (error) {
      console.error("[seating.releaseOrder]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating.releaseOrder]", e);
    return false;
  }
}
