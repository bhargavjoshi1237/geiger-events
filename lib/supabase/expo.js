"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeBackground, normalizeField } from "./seat_maps";

// Data-access layer for PER-EVENT booth state — holds and assignments over a
// venue's hall map template (owned by lib/supabase/hall_maps.js). The booth
// mirror of lib/supabase/seating.js, down to the return contract: validate,
// console.error on failure, return null / false / [] — never throw, never toast.
//
// Reads and exhibitor writes go through security-definer RPCs so the anon
// storefront never touches the tables directly:
//   public_event_hall_map · hold_booths · release_booths · buy_booths
// Box-office writes (block, comp, reassign) go through the table under the
// member RLS policy.

const ASSIGNMENTS = "booth_assignments";
const TOKEN_KEY = "geiger.boothToken";

export function normalizeBoothAssignment(row) {
  if (!row) return null;
  // `booth` is the embedded stall when the caller asked for it
  // (listBoothAssignments does), so a row can print "Hall 1 · A12" directly.
  const booth = row.booth || null;
  const code = booth?.code ?? "";
  const hall = booth?.hall ?? "";
  return {
    id: row.id,
    boothCode: code,
    boothName: booth?.name ?? "",
    hall,
    label: [hall, code].filter(Boolean).join(" · "),
    eventId: row.event_id ?? null,
    boothId: row.booth_id ?? null,
    orderId: row.order_id ?? null,
    exhibitorName: row.exhibitor_name ?? "",
    exhibitorEmail: row.exhibitor_email ?? "",
    ticketId: row.ticket_id ?? null,
    price: Number(row.price ?? 0),
    status: row.status ?? "sold",
    note: row.note ?? "",
    createdAt: row.created_at ?? null,
    releasedAt: row.released_at ?? null,
  };
}

// One opaque token per browser session, identifying which holds are "mine".
// Kept separate from the seat token so an event selling both seats and booths
// doesn't have one release wipe the other's holds.
export function boothToken() {
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

// The hall map, its booths, and the ids already taken (sold, comped, blocked or
// live-held). One call serves both the dashboard and the anon storefront.
// Returns null when the event has no hall map configured.
export async function getEventExpo(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_event_hall_map", {
      p_event_id: eventId,
    });
    if (error) {
      console.error("[expo.get]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.map) return null;
    const config = row.map.config && typeof row.map.config === "object" ? row.map.config : {};
    return {
      map: row.map,
      // The canvas furniture, resolved here so the picker and the box office
      // draw the same floor without repeating it.
      aspect: config.aspect || "4/3",
      field: normalizeField(config.field ? config : { field: { shape: "none" } }),
      background: normalizeBackground(config),
      booths: Array.isArray(row.booths) ? row.booths : [],
      taken: new Set(Array.isArray(row.taken) ? row.taken : []),
    };
  } catch (e) {
    console.error("[expo.get]", e);
    return null;
  }
}

// Claim booths for this checkout session. Steals expired holds, refuses live
// ones. `rejected` lists booths someone else took first — the screen flips
// those to sold and tells the exhibitor.
export async function holdBooths(eventId, boothIds, token, minutes = 15) {
  if (!eventId || !boothIds?.length || !token || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("hold_booths", {
      p_event_id: eventId,
      p_booth_ids: boothIds,
      p_token: token,
      p_minutes: minutes,
    });
    if (error) {
      console.error("[expo.hold]", error.message);
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
    console.error("[expo.hold]", e);
    return null;
  }
}

// Drop this session's holds (exhibitor closed the map or changed their mind).
export async function releaseBooths(eventId, token) {
  if (!eventId || !token || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("release_booths", {
      p_event_id: eventId,
      p_token: token,
    });
    if (error) {
      console.error("[expo.release]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[expo.release]", e);
    return false;
  }
}

// The booth purchase. Validates holds, delegates money/inventory to buy_ticket,
// then writes the assignments — all in one transaction.
export async function buyBooths(input) {
  if (!input?.eventId || !input?.boothIds?.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("buy_booths", {
      p_event_id: input.eventId,
      p_name: input.name ?? "",
      p_email: input.email ?? "",
      p_ticket: input.ticketName ?? "Exhibitor space",
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
      p_booth_ids: input.boothIds,
      p_booth_token: input.token ?? null,
    });
    if (error) {
      console.error("[expo.buy]", error.message);
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
    console.error("[expo.buy]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Box office (member-only, straight through the table under RLS)
// ---------------------------------------------------------------------------

// Live assignments for an event — what the organiser's floor colours in.
export async function listBoothAssignments(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .select("*, booth:hall_booths(code, name, hall)")
      .eq("event_id", eventId)
      .is("released_at", null);
    if (error) {
      console.error("[expo.listAssignments]", error.message);
      return null;
    }
    return (data || []).map(normalizeBoothAssignment);
  } catch (e) {
    console.error("[expo.listAssignments]", e);
    return null;
  }
}

// Hold booths off sale (organiser reserves, sponsor allocations, fire lanes).
export async function blockBooths(eventId, boothIds, note = "") {
  if (!eventId || !boothIds?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const rows = boothIds.map((boothId) => ({
      event_id: eventId,
      booth_id: boothId,
      status: "blocked",
      note,
    }));
    const { error } = await sb.from(ASSIGNMENTS).insert(rows);
    if (error) {
      console.error("[expo.block]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[expo.block]", e);
    return false;
  }
}

// Return blocked booths to the pool. Only ever releases 'blocked' rows so a
// mis-click can't silently cancel a real sale.
export async function unblockBooths(eventId, boothIds) {
  if (!eventId || !boothIds?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ASSIGNMENTS)
      .update({ released_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("status", "blocked")
      .is("released_at", null)
      .in("booth_id", boothIds);
    if (error) {
      console.error("[expo.unblock]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[expo.unblock]", e);
    return false;
  }
}

// Hand a booth to an exhibitor without an order (sponsor allocation, offline
// deal, association partner).
export async function assignBooth(eventId, boothId, exhibitor = {}) {
  if (!eventId || !boothId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .insert({
        event_id: eventId,
        booth_id: boothId,
        exhibitor_name: exhibitor.name ?? "",
        exhibitor_email: exhibitor.email ?? "",
        ticket_id: exhibitor.ticketId ?? null,
        price: Number(exhibitor.price) || 0,
        status: "comp",
        note: exhibitor.note ?? "",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[expo.assign]", error.message);
      return null;
    }
    return normalizeBoothAssignment(data);
  } catch (e) {
    console.error("[expo.assign]", e);
    return null;
  }
}

// Move an exhibitor to a different booth. Claims the target FIRST so a taken
// booth fails against the unique index and leaves the original intact.
export async function reassignBooth(assignment, nextBoothId) {
  if (!assignment?.id || !nextBoothId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .insert({
        event_id: assignment.eventId,
        booth_id: nextBoothId,
        order_id: assignment.orderId,
        exhibitor_name: assignment.exhibitorName,
        exhibitor_email: assignment.exhibitorEmail,
        ticket_id: assignment.ticketId,
        price: assignment.price,
        status: assignment.status,
        note: assignment.note,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[expo.reassign]", error.message);
      return null;
    }

    const { error: releaseError } = await sb
      .from(ASSIGNMENTS)
      .update({ released_at: new Date().toISOString() })
      .eq("id", assignment.id);
    if (releaseError) {
      // The move half-applied: drop the new row so the exhibitor keeps one booth.
      console.error("[expo.reassign]", releaseError.message);
      await sb.from(ASSIGNMENTS).delete().eq("id", data.id);
      return null;
    }
    return normalizeBoothAssignment(data);
  } catch (e) {
    console.error("[expo.reassign]", e);
    return null;
  }
}

// Return an order's booths to the pool on refund or cancellation. Without this,
// refunded booths leak permanently.
export async function releaseOrderBooths(orderId) {
  if (!orderId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("release_order_booths", { p_order_id: orderId });
    if (error) {
      console.error("[expo.releaseOrder]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[expo.releaseOrder]", e);
    return false;
  }
}
