"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Access-code validation for the public checkout. A buyer's typed code is checked
// against the event's configured access codes (metadata.accessCodes) through the
// public_event_access_code() SECURITY DEFINER RPC — so anon buyers can unlock
// hidden tickets without the member-only records table ever being exposed, and the
// same code is re-validated authoritatively in buy_ticket. Pure: returns a plain
// result object, never throws, never toasts (the checkout owns UX).

// Validate a code for an event. Returns { ok, ticketIds:[…] } when the code
// unlocks tickets, or { ok:false, reason } ("empty" | "invalid" | "error" |
// "unavailable").
export async function validateEventAccessCode(eventId, code) {
  const trimmed = (code || "").trim();
  if (!eventId || !trimmed) return { ok: false, reason: "empty" };
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_event_access_code", {
      p_event_id: eventId,
      p_code: trimmed,
    });
    if (error) {
      console.error("[access_codes.validate]", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) return { ok: false, reason: row?.reason || "invalid" };
    return {
      ok: true,
      code: row.code || trimmed,
      ticketIds: Array.isArray(row.ticket_ids) ? row.ticket_ids.map(String) : [],
    };
  } catch (e) {
    console.error("[access_codes.validate]", e);
    return { ok: false, reason: "error" };
  }
}
