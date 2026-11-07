"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { portalFetch } from "@/lib/portal/portal_fetch";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";

// Data-access layer for events.venue_bookings (Instant Book). Bookings are created, confirmed and
// cancelled only through RPCs that lock the space and price server-side; members may edit descriptive
// fields directly. Pure: console.error on failure, return null / false / [], never throw.

const BOOKINGS = "venue_bookings";

export { normalizeVenueBooking };

// The only columns members may write directly; everything else moves through the RPCs.
function bookingToRow(input) {
  const row = {};
  if ("title" in input) row.title = String(input.title || "").slice(0, 200);
  if ("eventId" in input) row.event_id = input.eventId || null;
  if ("contactName" in input) row.contact_name = String(input.contactName || "").slice(0, 200);
  if ("contactEmail" in input) row.contact_email = String(input.contactEmail || "").trim().toLowerCase().slice(0, 320);
  if ("contactPhone" in input) row.contact_phone = String(input.contactPhone || "").slice(0, 60);
  if ("notes" in input) row.notes = String(input.notes || "").slice(0, 4000);
  if ("metadata" in input) row.metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  return row;
}

// Bookings in the project, newest first; `since` narrows to bookings ending after it.
export async function listVenueBookings(projectId, { venueId, spaceId, since, limit = 1000 } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb.from(BOOKINGS).select("*").eq("project_id", projectId).is("deleted_at", null);
    if (venueId) query = query.eq("venue_id", venueId);
    if (spaceId) query = query.eq("space_id", spaceId);
    if (since) query = query.gte("ends_at", new Date(since).toISOString());
    const { data, error } = await query.order("starts_at", { ascending: false }).limit(limit);
    if (error) {
      console.error("[venue_bookings.listVenueBookings]", error.message);
      return null;
    }
    return (data || []).map(normalizeVenueBooking);
  } catch (e) {
    console.error("[venue_bookings.listVenueBookings]", e);
    return null;
  }
}

// Live bookings linked to one event, soonest first.
export async function listBookingsForEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BOOKINGS)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true });
    if (error) {
      console.error("[venue_bookings.listBookingsForEvent]", error.message);
      return null;
    }
    return (data || []).map(normalizeVenueBooking);
  } catch (e) {
    console.error("[venue_bookings.listBookingsForEvent]", e);
    return null;
  }
}

export async function getVenueBooking(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(BOOKINGS).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[venue_bookings.getVenueBooking]", error.message);
      return null;
    }
    return normalizeVenueBooking(data);
  } catch (e) {
    console.error("[venue_bookings.getVenueBooking]", e);
    return null;
  }
}

export async function updateVenueBooking(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(BOOKINGS).update(bookingToRow(patch)).eq("id", id).select("*").single();
    if (error) {
      console.error("[venue_bookings.updateVenueBooking]", error.message);
      return null;
    }
    return normalizeVenueBooking(data);
  } catch (e) {
    console.error("[venue_bookings.updateVenueBooking]", e);
    return null;
  }
}

// RPC envelope -> { ok, booking } | { ok: false, code, message }.
function rpcResult(fn, data, error) {
  if (error) {
    console.error(`[venue_bookings.${fn}]`, error.message);
    return { ok: false, code: "ERROR", message: error.message || "Something went wrong." };
  }
  const res = Array.isArray(data) ? data[0] : data;
  if (!res || typeof res !== "object") {
    return { ok: false, code: "ERROR", message: "Instant Book isn't available yet." };
  }
  if (res.ok !== true) return { ok: false, code: res.code || "ERROR", message: res.message || "Couldn't save the booking." };
  return { ok: true, booking: normalizeVenueBooking(res.booking) };
}

// status: "hold" | "confirmed". The server validates the slot and prices it from the stored rates.
export async function bookVenueSpace(input) {
  if (!input?.spaceId || !isSupabaseConfigured()) {
    return { ok: false, code: "ERROR", message: "Instant Book isn't available here." };
  }
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("book_venue_space", {
      p_space_id: input.spaceId,
      p_starts_at: new Date(input.startsAt).toISOString(),
      p_ends_at: new Date(input.endsAt).toISOString(),
      p_status: input.status === "hold" ? "hold" : "confirmed",
      p_hold_hours: Number(input.holdHours) || 48,
      p_event_id: input.eventId || null,
      p_title: input.title || "",
      p_setup_style: input.setupStyle || "",
      p_attendees: Math.max(0, Math.round(Number(input.attendees) || 0)),
      p_contact_name: input.contactName || "",
      p_contact_email: input.contactEmail || "",
      p_contact_phone: input.contactPhone || "",
      p_notes: input.notes || "",
    });
    return rpcResult("bookVenueSpace", data, error);
  } catch (e) {
    console.error("[venue_bookings.bookVenueSpace]", e);
    return { ok: false, code: "ERROR", message: "Couldn't reach the server." };
  }
}

export async function confirmVenueBooking(id) {
  if (!id || !isSupabaseConfigured()) return { ok: false, code: "ERROR", message: "Instant Book isn't available here." };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("confirm_venue_booking", { p_booking_id: id });
    return rpcResult("confirmVenueBooking", data, error);
  } catch (e) {
    console.error("[venue_bookings.confirmVenueBooking]", e);
    return { ok: false, code: "ERROR", message: "Couldn't reach the server." };
  }
}

export async function cancelVenueBooking(id, reason = "") {
  if (!id || !isSupabaseConfigured()) return { ok: false, code: "ERROR", message: "Instant Book isn't available here." };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("cancel_venue_booking", { p_booking_id: id, p_reason: reason || "" });
    return rpcResult("cancelVenueBooking", data, error);
  } catch (e) {
    console.error("[venue_bookings.cancelVenueBooking]", e);
    return { ok: false, code: "ERROR", message: "Couldn't reach the server." };
  }
}

// kind: "confirmation" | "hold" | "cancellation". Emails the venue contact and the booking contact.
export async function sendVenueBookingEmail(bookingId, kind) {
  if (!bookingId) return { ok: false, error: "Missing booking." };
  try {
    const res = await portalFetch("/api/venue-bookings/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, kind }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}`, sent: data?.sent || [] };
    return { ok: data?.ok === true, error: data?.error || "", sent: Array.isArray(data?.sent) ? data.sent : [] };
  } catch (e) {
    console.error("[venue_bookings.sendVenueBookingEmail]", e);
    return { ok: false, error: "Couldn't reach the server.", sent: [] };
  }
}
