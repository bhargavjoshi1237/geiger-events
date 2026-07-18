// Group purchasing — buy a block of tickets in one payment and dispense one to
// each attendee's own email.
//
// Config lives in the event metadata bag (metadata.groupPurchase), gated by the
// per-event ticketRules.groupPurchase flag. When on and the buyer takes at least
// `minSeats`, checkout switches to group mode: a name+email row per seat and a
// group discount on the ticket subtotal. Each attendee becomes their OWN order row
// (keyed by their email) so they see their ticket in their own portal from the
// start — the buy_ticket RPC fans one payment out into N rows sharing a groupId.
// Pure functions — no React, no DB.
//
//   metadata.groupPurchase = {
//     minSeats, maxSeats, discountPercent, requireApproval,
//     eligibleTickets: "all" | [ticketId],
//   }

export const EMPTY_GROUP = {
  minSeats: 5,
  maxSeats: 0, // 0 = no max
  discountPercent: 10,
  requireApproval: false,
  eligibleTickets: "all",
};

export function normalizeGroup(cfg) {
  const c = { ...EMPTY_GROUP, ...(cfg || {}) };
  return {
    ...c,
    minSeats: Math.max(1, Number(c.minSeats) || 1),
    maxSeats: Math.max(0, Number(c.maxSeats) || 0),
    discountPercent: Math.max(0, Number(c.discountPercent) || 0),
    requireApproval: !!c.requireApproval,
    eligibleTickets:
      c.eligibleTickets === "all" || !Array.isArray(c.eligibleTickets)
        ? "all"
        : c.eligibleTickets.map(String),
  };
}

export function groupPurchaseEnabled(event) {
  return !!event?.ticketRules?.groupPurchase;
}

export function groupConfig(event) {
  return normalizeGroup(event?.groupPurchase);
}

// Is this ticket tier eligible for group ordering?
export function groupAllowsTicket(event, ticketId) {
  const c = groupConfig(event);
  if (c.eligibleTickets === "all") return true;
  return ticketId != null && c.eligibleTickets.includes(String(ticketId));
}

// Does a chosen quantity qualify as a group order for this ticket?
export function isGroupQty(event, ticketId, qty) {
  if (!groupPurchaseEnabled(event) || !groupAllowsTicket(event, ticketId)) return false;
  const c = groupConfig(event);
  const q = Number(qty) || 0;
  if (q < c.minSeats) return false;
  if (c.maxSeats > 0 && q > c.maxSeats) return false;
  return true;
}

// The group discount taken off a ticket subtotal, cents-rounded. Mirror of the
// SQL math.
export function groupDiscountAmount(event, ticketSubtotal) {
  const c = groupConfig(event);
  const base = Number(ticketSubtotal) || 0;
  if (base <= 0 || c.discountPercent <= 0) return 0;
  return Math.max(0, Math.round((base * c.discountPercent) / 100 * 100) / 100);
}

// A valid attendee list = one {name?, email} per seat, every email present + valid.
export function attendeesValid(attendees, qty) {
  if (!Array.isArray(attendees) || attendees.length !== Number(qty)) return false;
  return attendees.every((a) => a && typeof a.email === "string" && a.email.includes("@"));
}
