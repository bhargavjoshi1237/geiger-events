
export function reservedEnabled(event) {
  return !!event?.ticketRules?.reservedSeating;
}

export function reservedMap(event) {
  const m = event?.reserved && typeof event.reserved === "object" ? event.reserved : {};
  return m;
}

export function reservedForTicket(event, ticketId) {
  if (!reservedEnabled(event) || ticketId == null) return 0;
  const entry = reservedMap(event)[String(ticketId)];
  return Math.max(0, Number(entry?.qty) || 0);
}

export function reservedTotal(event) {
  if (!reservedEnabled(event)) return 0;
  return Object.values(reservedMap(event)).reduce(
    (sum, e) => sum + Math.max(0, Number(e?.qty) || 0),
    0,
  );
}

export function ticketAvailable(event, ticket, ticketSold = {}) {
  const qty = Number(ticket?.qty) || 0;
  if (qty <= 0) return Infinity;
  const sold = Number(ticketSold?.[ticket.id]) || 0;
  const reserved = reservedForTicket(event, ticket.id);
  return Math.max(0, qty - sold - reserved);
}
