// Access-code (hidden) tickets for the public storefront.
//
// Config lives in the event metadata bag (metadata.accessCodes), gated by the
// per-event ticketRules.accessCode flag. Each entry maps one code to the event
// ticket ids it unlocks; those tickets are HIDDEN on the public page until a buyer
// enters a matching code. Code validation is authoritative server-side (the
// public_event_access_code RPC + buy_ticket re-check) — these client helpers only
// drive display gating. Pure functions — no React, no DB.
//
//   metadata.accessCodes = [ { id, code, label, ticketIds:[eventTicketId,…] } ]

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

// All configured code entries (normalized), skipping blank codes.
export function eventAccessCodes(event) {
  const raw = Array.isArray(event?.accessCodes) ? event.accessCodes : [];
  return raw.map(normalizeAccessCode).filter((e) => e && e.code);
}

// Every ticket id that is gated behind SOME code (hidden by default).
export function gatedTicketIds(event) {
  if (!accessCodesEnabled(event)) return new Set();
  const ids = new Set();
  for (const e of eventAccessCodes(event)) {
    for (const id of e.ticketIds) ids.add(String(id));
  }
  return ids;
}

// True when a ticket is hidden until unlocked.
export function isGatedTicket(event, ticketId) {
  return gatedTicketIds(event).has(String(ticketId));
}

// Ticket ids unlocked by a set of entered codes (case-insensitive unless the
// global setting is case-sensitive; validation is client-side display only).
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
