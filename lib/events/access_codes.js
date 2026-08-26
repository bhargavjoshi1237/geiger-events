
export const EMPTY_ACCESS_CODE = { code: "", label: "", ticketIds: [] };

export function normalizeAccessCode(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    code: (entry.code || "").trim(),
    label: entry.label || "",
    ticketIds: Array.isArray(entry.ticketIds) ? entry.ticketIds.map(String) : [],
  };
}

export function accessCodesEnabled(event) {
  return !!event?.ticketRules?.accessCode;
}

export function eventAccessCodes(event) {
  const raw = Array.isArray(event?.accessCodes) ? event.accessCodes : [];
  return raw.map(normalizeAccessCode).filter((e) => e && e.code);
}

export function gatedTicketIds(event) {
  if (!accessCodesEnabled(event)) return new Set();
  const ids = new Set();
  for (const e of eventAccessCodes(event)) {
    for (const id of e.ticketIds) ids.add(String(id));
  }
  return ids;
}

export function isGatedTicket(event, ticketId) {
  return gatedTicketIds(event).has(String(ticketId));
}

export function unlockedTicketIds(event, enteredCodes, { caseSensitive = false } = {}) {
  const entered = (Array.isArray(enteredCodes) ? enteredCodes : [enteredCodes])
    .map((c) => (caseSensitive ? String(c || "").trim() : String(c || "").trim().toUpperCase()))
    .filter(Boolean);
  const set = new Set(entered);
  const unlocked = new Set();
  for (const e of eventAccessCodes(event)) {
    const key = caseSensitive ? e.code : e.code.toUpperCase();
    if (set.has(key)) for (const id of e.ticketIds) unlocked.add(String(id));
  }
  return unlocked;
}
