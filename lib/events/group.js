
export const EMPTY_GROUP = {
  minSeats: 5,
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

export function groupAllowsTicket(event, ticketId) {
  const c = groupConfig(event);
  if (c.eligibleTickets === "all") return true;
  return ticketId != null && c.eligibleTickets.includes(String(ticketId));
}

export function isGroupQty(event, ticketId, qty) {
  if (!groupPurchaseEnabled(event) || !groupAllowsTicket(event, ticketId)) return false;
  const c = groupConfig(event);
  const q = Number(qty) || 0;
  if (q < c.minSeats) return false;
  if (c.maxSeats > 0 && q > c.maxSeats) return false;
  return true;
}

export function groupDiscountAmount(event, ticketSubtotal) {
  const c = groupConfig(event);
  const base = Number(ticketSubtotal) || 0;
  if (base <= 0 || c.discountPercent <= 0) return 0;
  return Math.max(0, Math.round((base * c.discountPercent) / 100 * 100) / 100);
}

export function attendeesValid(attendees, qty) {
  if (!Array.isArray(attendees) || attendees.length !== Number(qty)) return false;
  return attendees.every((a) => a && typeof a.email === "string" && a.email.includes("@"));
}
