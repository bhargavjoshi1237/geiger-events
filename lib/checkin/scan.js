// Turning a scanned code into a check-in lookup, and check-in refusals into staff-facing text.

const UUID = /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i;

// Tickets, badges, the portal and the app encode a full order or registration id, sometimes inside a URL.
export function scanQuery(text) {
  const raw = String(text ?? "").trim();
  const match = raw.match(UUID);
  if (!match) return { query: raw, id: null };
  const hex = match[0].replace(/-/g, "").toLowerCase();
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { query: id, id };
}

// The row a scan means: the exact id, then the exact 8-character code, then a lone result.
export function pickScanMatch(rows, text) {
  if (!rows?.length) return null;
  const { query, id } = scanQuery(text);
  if (id) return rows.find((r) => r.registrationId === id || r.orderId === id) || null;
  const code = query.toUpperCase();
  return rows.find((r) => r.ticketCode === code) || (rows.length === 1 ? rows[0] : null);
}

const REASONS = {
  cancelled: "This ticket was cancelled",
  refunded: "This ticket was refunded",
  waitlisted: "This guest is still on the waitlist",
  pending: "This registration is waiting for approval",
  declined: "This registration was declined",
  not_found: "That ticket isn't for this event",
};

export function blockedMessage(reason, name) {
  const text = REASONS[reason] || "This ticket can't be admitted";
  return name ? `${text}: ${name}` : text;
}

export function rowKey(row) {
  return row?.registrationId || row?.orderId || "";
}
