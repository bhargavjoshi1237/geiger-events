// Reserved (held-back) ticket allocation.
//
// Config lives in the event metadata bag (metadata.reserved), gated by the
// per-event ticketRules.reservedSeating flag. It sets aside a block of a ticket's
// inventory so it is excluded from public availability — the organiser hands those
// out or sells them offline. Lightweight by design: no seat map, just a held
// count. Availability everywhere becomes `capacity − sold − reserved`, enforced
// authoritatively in the buy_ticket RPC. Pure functions — no React, no DB.
//
//   metadata.reserved = { [eventTicketId]: { qty, note } }

export function reservedEnabled(event) {
  return !!event?.ticketRules?.reservedSeating;
}

export function reservedMap(event) {
  const m = event?.reserved && typeof event.reserved === "object" ? event.reserved : {};
  return m;
}

// Held quantity for one ticket id (0 when none or feature off).
export function reservedForTicket(event, ticketId) {
  if (!reservedEnabled(event) || ticketId == null) return 0;
  const entry = reservedMap(event)[String(ticketId)];
  return Math.max(0, Number(entry?.qty) || 0);
}

// Total held across every ticket (subtracted from the event-level cap).
export function reservedTotal(event) {
  if (!reservedEnabled(event)) return 0;
  return Object.values(reservedMap(event)).reduce(
    (sum, e) => sum + Math.max(0, Number(e?.qty) || 0),
    0,
  );
}

// Public availability for a ticket tier: its qty minus sold minus reserved. A
// tier qty of 0 = unlimited (Infinity), mirroring the capacity convention.
export function ticketAvailable(event, ticket, ticketSold = {}) {
  const qty = Number(ticket?.qty) || 0;
  if (qty <= 0) return Infinity;
  const sold = Number(ticketSold?.[ticket.id]) || 0;
  const reserved = reservedForTicket(event, ticket.id);
  return Math.max(0, qty - sold - reserved);
}
