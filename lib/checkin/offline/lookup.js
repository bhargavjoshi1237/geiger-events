// Pure offline guest-list logic: indexing the snapshot, matching scans and searches, and deciding a scan with no server.
// A ticket's `scopes` map "<sessionId>|<zone lower-case>" → { in, out, at, gate, device }, exactly as checkin_snapshot builds it.

import { scanQuery } from "../scan.js";

export const scopeKey = (sessionId, zone) =>
  `${sessionId || ""}|${String(zone || "").trim().toLowerCase()}`;

// Snapshot ticket → the row the staff routes render (the checkin_search row shape) for one scope.
export function ticketRow(ticket, scope) {
  const st = ticket?.scopes?.[scope] || null;
  return {
    kind: ticket.kind,
    registrationId: ticket.kind === "registration" ? ticket.id : null,
    orderId: ticket.kind === "order" ? ticket.id : null,
    name: ticket.name || "",
    email: ticket.email || "",
    ticketCode: ticket.code || "",
    ticketName: ticket.ticket || "",
    partySize: ticket.party || 1,
    status: ticket.status || "",
    admissible: ticket.admissible !== false,
    checkedIn: !!st?.in,
    exited: !!st?.out,
    firstAt: st?.at || null,
    firstGate: st?.gate || null,
    firstDevice: st?.device || null,
    source: "local",
  };
}

export function buildIndex(tickets) {
  const list = Array.isArray(tickets) ? tickets.filter((t) => t?.id) : [];
  const byId = new Map();
  const byCode = new Map();
  const hay = [];
  for (const t of list) {
    byId.set(t.id, t);
    if (t.code) {
      const hits = byCode.get(t.code);
      if (hits) hits.push(t.id);
      else byCode.set(t.code, [t.id]);
    }
    hay.push({ id: t.id, text: `${t.name || ""}\n${t.email || ""}`.toLowerCase() });
  }
  return { byId, byCode, hay };
}

// The ticket a scanned payload means: the full id first, then an unambiguous 8-character code.
export function findByScan(index, text) {
  const { query, id } = scanQuery(text);
  if (id) return index.byId.get(id) || null;
  const hits = index.byCode.get(query.trim().toUpperCase());
  return hits?.length === 1 ? index.byId.get(hits[0]) || null : null;
}

// Mirrors checkin_search: name/email contains, exact 8-character code, or the full id.
export function searchIndex(index, query, limit = 25) {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const { id } = scanQuery(raw);
  if (id) {
    const t = index.byId.get(id);
    return t ? [t] : [];
  }
  const q = raw.toLowerCase();
  const code = raw.toUpperCase();
  const out = [];
  for (const id of index.byCode.get(code) || []) out.push(index.byId.get(id));
  for (const h of index.hay) {
    if (out.length >= limit * 4) break;
    if (h.text.includes(q) && !out.some((t) => t.id === h.id)) out.push(index.byId.get(h.id));
  }
  return out
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .slice(0, limit);
}

// The cap that governs a scope: a named zone's own row, or the venue row for door scans outside any session.
export function capFor(caps, zone, sessionId) {
  const z = String(zone || "").trim().toLowerCase();
  const list = Array.isArray(caps) ? caps : [];
  if (z) return list.find((c) => c.zoneKey && String(c.zone || "").trim().toLowerCase() === z) || null;
  if (sessionId) return null;
  return list.find((c) => !c.zoneKey) || null;
}

export function reentryRule(cap, settings) {
  const rule = cap?.reentry && cap.reentry !== "inherit" ? cap.reentry : settings?.reentry || "once";
  return rule === "once" ? "once" : "multi";
}

// What an offline admit may do, judged only from this device's guest list and queue.
export function decideAdmit(ticket, { sessionId, zone, caps, settings } = {}) {
  if (!ticket) return { kind: "unknown" };
  if (ticket.admissible === false) {
    return { kind: "blocked", reason: String(ticket.status || "unknown").toLowerCase() };
  }
  const st = ticket.scopes?.[scopeKey(sessionId, zone)] || null;
  const cap = capFor(caps, zone, sessionId);
  const seen = { firstAt: st?.at || null, firstGate: st?.gate || null, firstDevice: st?.device || null };
  if (st?.in) return { kind: "already", reason: "inside", ...seen };
  if (st?.out && reentryRule(cap, settings) === "once") return { kind: "already", reason: "no_reentry", ...seen };
  // A hard cap can't be enforced across devices offline, so it's refused unless the organiser allowed it.
  if (cap && cap.hardCap !== null && cap.hardCap !== undefined && !settings?.allowCappedZones) {
    return { kind: "capacity", reason: "offline_capped", zone: cap.zone || zone || "", cap: cap.hardCap };
  }
  return { kind: "admit", reentry: !!st?.out, cap };
}

export function decideExit(ticket, { sessionId, zone } = {}) {
  if (!ticket) return { kind: "unknown" };
  const st = ticket.scopes?.[scopeKey(sessionId, zone)] || null;
  return st?.in ? { kind: "exit" } : { kind: "notInside" };
}

// A ticket with one movement applied to its scope (immutable). "clear" = the server says it isn't inside.
export function applyMovement(ticket, { kind, sessionId, zone, at, gate, device }) {
  const scope = scopeKey(sessionId, zone);
  const prev = ticket.scopes?.[scope] || {};
  const next =
    kind === "clear"
      ? { ...prev, in: false }
      : kind === "out"
        ? { ...prev, in: false, out: true }
        : { ...prev, in: true, at: at || prev.at || null, gate: gate || null, device: device || null };
  return { ...ticket, scopes: { ...(ticket.scopes || {}), [scope]: next } };
}

// A fresh snapshot doesn't know about scans still waiting in the queue; replay them on top so the device stays consistent.
export function reapplyQueue(tickets, items) {
  const pending = (items || []).filter((i) => i.status === "pending").sort((a, b) => a.seq - b.seq);
  if (!pending.length) return tickets;
  const byId = new Map(tickets.map((t, i) => [t.id, i]));
  const out = tickets.slice();
  for (const item of pending) {
    const at = byId.get(item.registrationId || item.orderId);
    if (at === undefined) continue;
    out[at] = applyMovement(out[at], {
      kind: item.kind,
      sessionId: item.sessionId,
      zone: item.zone,
      at: item.scannedAt,
      gate: item.gate,
      device: item.deviceId,
    });
  }
  return out;
}
