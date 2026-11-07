// Persistence for the offline engine: the per-event snapshot (meta + tickets) and the scan queue in IndexedDB,
// plus small per-event sync state in localStorage.

import { STORES, idbAllByEvent, idbDelete, idbGet, idbPut, idbPutMany, idbReplaceEvent } from "./idb.js";

const ticketKey = (eventId, id) => `${eventId}:${id}`;

export async function loadSnapshot(eventId) {
  const meta = await idbGet(STORES.snapshots, eventId);
  if (!meta) return null;
  const rows = meta.enabled ? await idbAllByEvent(STORES.tickets, eventId) : [];
  const tickets = rows.map((row) => {
    const t = { ...row };
    delete t.key;
    delete t.eventId;
    return t;
  });
  return { meta, tickets };
}

export async function saveSnapshot(eventId, meta, tickets) {
  const rows = (tickets || []).map((t) => ({ ...t, key: ticketKey(eventId, t.id), eventId }));
  const ok = await idbReplaceEvent(STORES.tickets, eventId, rows);
  if (!ok) return false;
  return idbPut(STORES.snapshots, { ...meta, eventId });
}

export function saveTicket(eventId, ticket) {
  return idbPut(STORES.tickets, { ...ticket, key: ticketKey(eventId, ticket.id), eventId });
}

// Drops the guest list but keeps the queue: queued scans must still reach the server.
export async function clearSnapshot(eventId, meta = null) {
  await idbReplaceEvent(STORES.tickets, eventId, []);
  if (meta) return idbPut(STORES.snapshots, { ...meta, eventId, enabled: false });
  return idbDelete(STORES.snapshots, eventId);
}

export async function listQueue(eventId) {
  const rows = await idbAllByEvent(STORES.queue, eventId);
  return rows.sort((a, b) => a.seq - b.seq);
}

export function saveQueueItem(item) {
  return idbPut(STORES.queue, item);
}

export function saveQueueItems(items) {
  return items.length ? idbPutMany(STORES.queue, items) : Promise.resolve(true);
}

export function deleteQueueItem(clientId) {
  return idbDelete(STORES.queue, clientId);
}

const stateKey = (eventId) => `checkin:sync:${eventId}`;

export function readSyncState(eventId) {
  try {
    const v = JSON.parse(localStorage.getItem(stateKey(eventId)) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function writeSyncState(eventId, patch) {
  try {
    localStorage.setItem(stateKey(eventId), JSON.stringify({ ...readSyncState(eventId), ...patch }));
  } catch {
  }
}
