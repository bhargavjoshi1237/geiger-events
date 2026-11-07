// The staff-route check-in engine: admits through the server while online, falls back to this device's cached guest
// list and an IndexedDB queue when the network drops, and replays the queue (checkin_sync) when it comes back.
// One engine per mounted staff route; React reads its status through subscribe/getStatus (useSyncExternalStore).

import {
  admitCheckinDetailed,
  checkinHeartbeat,
  exitCheckinDetailed,
  fetchCheckinSnapshot,
  searchCheckinDetailed,
  syncCheckinQueue,
} from "@/lib/supabase/checkin";
import { pickScanMatch, scanQuery } from "@/lib/checkin/scan";
import {
  applyMovement,
  buildIndex,
  decideAdmit,
  decideExit,
  findByScan,
  reapplyQueue,
  scopeKey,
  searchIndex,
  ticketRow,
} from "./lookup";
import { CHECKIN_APP_VERSION, deviceAgent, getDeviceId, newClientId } from "./device";
import {
  clearSnapshot,
  deleteQueueItem,
  listQueue,
  loadSnapshot,
  readSyncState,
  saveQueueItem,
  saveQueueItems,
  saveSnapshot,
  saveTicket,
  writeSyncState,
} from "./store";
import { openCheckinDb } from "./idb";
import { forgetUnlock } from "./unlock";

const TICK_MS = 15000;
const HEARTBEAT_MS = 30000;
const ADMIT_TIMEOUT_MS = 4500;
const SYNC_BATCH = 50;
const MAX_ATTEMPTS = 6;
const DONE_KEEP_MS = 2 * 24 * 60 * 60 * 1000;

const isInvalidCode = (error) => /INVALID_CODE/.test(String(error || ""));
const nowIso = () => new Date().toISOString();

export class CheckinEngine {
  constructor({ eventId, code, role, route }) {
    this.eventId = eventId;
    this.code = code;
    this.role = role || null;
    this.route = route || "checkin";
    this.deviceId = null;
    this.index = buildIndex([]);
    this.meta = null;
    this.queue = [];
    this.listeners = new Set();
    this.timer = null;
    this.run = 0;
    this.seq = 0;
    this.lastHeartbeat = 0;
    this.syncing = false;
    this.refreshing = false;
    this.status = {
      booting: true,
      online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
      storage: true,
      deviceId: null,
      enabled: null,
      ready: false,
      snapshotAt: null,
      fetchedAt: null,
      ticketCount: 0,
      eventMeta: null,
      caps: [],
      lastSyncAt: null,
      queued: 0,
      failed: 0,
      syncing: false,
      refreshing: false,
      conflicts: 0,
      occupancy: [],
      occupancyAt: 0,
      lastError: null,
    };
  }

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getStatus = () => this.status;

  emit(patch) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  live(run) {
    return run === this.run;
  }

  // --- lifecycle --------------------------------------------------------------

  async start() {
    const run = ++this.run;
    this.deviceId = getDeviceId();
    const saved = readSyncState(this.eventId);
    this.emit({
      deviceId: this.deviceId,
      lastSyncAt: saved.lastSyncAt || null,
      conflicts: saved.conflicts || 0,
    });

    const db = await openCheckinDb();
    if (!this.live(run)) return;
    if (!db) this.emit({ storage: false });

    const cached = await loadSnapshot(this.eventId);
    if (!this.live(run)) return;
    if (cached?.meta) this.useSnapshot(cached.meta, cached.tickets);

    const queue = await listQueue(this.eventId);
    if (!this.live(run)) return;
    const cutoff = Date.now() - DONE_KEEP_MS;
    const stale = queue.filter((i) => i.status === "done" && (i.syncedAt || 0) < cutoff);
    stale.forEach((i) => deleteQueueItem(i.clientId));
    this.queue = queue.filter((i) => !stale.includes(i));
    this.seq = this.queue.reduce((m, i) => Math.max(m, i.seq || 0), 0);
    this.emitQueue();
    this.emit({ booting: false });

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    this.timer = setInterval(this.tick, TICK_MS);

    if (this.status.online) {
      await this.refreshSnapshot();
      if (this.live(run)) this.syncNow();
    }
  }

  stop() {
    this.run += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  handleOnline = () => {
    this.heartbeat();
  };

  handleOffline = () => {
    this.emit({ online: false });
  };

  tick = () => {
    if (this.pendingCount() > 0 && this.status.online) this.syncNow();
    else if (!this.status.online || Date.now() - this.lastHeartbeat > HEARTBEAT_MS) this.heartbeat();
    if (this.status.online && this.snapshotStale()) this.refreshSnapshot();
  };

  snapshotStale() {
    if (!this.meta) return true;
    const minutes = this.meta.settings?.refreshMinutes || 5;
    return Date.now() - (this.meta.fetchedAt || 0) > minutes * 60000;
  }

  // Connectivity comes from real request outcomes, not navigator.onLine (venue Wi-Fi often has no upstream).
  markOnline(online) {
    const was = this.status.online;
    if (was === online) return;
    this.emit({ online });
    if (online && !was) {
      this.syncNow();
      if (this.snapshotStale()) this.refreshSnapshot();
    }
  }

  device() {
    return {
      eventId: this.eventId,
      code: this.code,
      deviceId: this.deviceId,
      route: this.route,
      appVersion: CHECKIN_APP_VERSION,
      agent: deviceAgent(),
      queued: this.pendingCount(),
    };
  }

  // --- snapshot ---------------------------------------------------------------

  useSnapshot(meta, tickets) {
    this.meta = meta;
    this.index = buildIndex(meta.enabled ? tickets : []);
    this.emit({
      enabled: !!meta.enabled,
      ready: !!meta.enabled,
      snapshotAt: meta.generatedAt || null,
      fetchedAt: meta.fetchedAt || null,
      ticketCount: meta.enabled ? this.index.byId.size : 0,
      eventMeta: meta.event || null,
      caps: meta.caps || [],
    });
  }

  async refreshSnapshot() {
    if (this.refreshing) return;
    const run = this.run;
    this.refreshing = true;
    this.emit({ refreshing: true });
    try {
      const res = await fetchCheckinSnapshot(this.device());
      if (!this.live(run)) return;
      if (res.network) {
        this.markOnline(false);
        return;
      }
      if (!res.data) {
        if (isInvalidCode(res.error)) await this.revoke();
        else this.emit({ lastError: "Couldn't refresh the guest list" });
        return;
      }
      this.markOnline(true);
      const snap = res.data;
      const meta = {
        enabled: !!snap.enabled,
        version: snap.version ?? null,
        generatedAt: snap.generatedAt || nowIso(),
        fetchedAt: Date.now(),
        settings: snap.settings || {},
        event: snap.event || null,
        caps: snap.caps || [],
        count: snap.count || 0,
      };
      const tickets = meta.enabled ? reapplyQueue(snap.tickets || [], this.queue) : [];
      this.useSnapshot(meta, tickets);
      this.emit({ lastError: null });
      if (meta.enabled) {
        const ok = await saveSnapshot(this.eventId, meta, tickets);
        if (!ok && this.live(run)) this.emit({ storage: false });
      } else {
        await clearSnapshot(this.eventId, meta);
      }
    } finally {
      this.refreshing = false;
      if (this.live(run)) this.emit({ refreshing: false });
    }
  }

  // The code was revoked: drop the cached guest list and its offline unlock (queued scans stay until a valid code syncs them).
  async revoke() {
    this.meta = this.meta ? { ...this.meta, enabled: false } : null;
    this.index = buildIndex([]);
    this.emit({ enabled: false, ready: false, ticketCount: 0, lastError: "This access code is no longer valid" });
    await forgetUnlock(this.eventId, this.route === "kiosk" ? "kiosk" : "staff", this.code);
    await clearSnapshot(this.eventId, this.meta);
  }

  // --- lookups ----------------------------------------------------------------

  localTicket(row) {
    const id = row?.registrationId || row?.orderId;
    return id ? this.index.byId.get(id) || null : null;
  }

  // A server row with this device's view of the scope (exits and zones) laid over it when the ticket is cached.
  withLocalState(row, scope) {
    const t = this.localTicket(row);
    if (!t) return { ...row, source: "server" };
    const local = ticketRow(t, scope);
    return { ...row, checkedIn: local.checkedIn, exited: local.exited, firstAt: local.firstAt, firstGate: local.firstGate, source: "server" };
  }

  // Name/email/code search: the server while online (freshest), this device's list otherwise.
  async search(query, { sessionId, zone } = {}) {
    const q = String(query || "").trim();
    if (!q) return { rows: [] };
    const scope = scopeKey(sessionId, zone);
    const local = () => searchIndex(this.index, q).map((t) => ticketRow(t, scope));
    if (this.status.online) {
      const res = await searchCheckinDetailed(this.eventId, this.code, q, sessionId || null);
      if (!res.network) {
        this.markOnline(true);
        if (res.data) return { rows: res.data.map((r) => this.withLocalState(r, scope)), source: "server" };
        return { rows: this.status.ready ? local() : [], source: "local", failed: !this.status.ready };
      }
      this.markOnline(false);
    }
    if (!this.status.ready) return { rows: [], source: "local", unavailable: true };
    return { rows: local(), source: "local" };
  }

  // A scanned payload → the row it means. The cached list answers instantly; the server covers tickets sold since.
  async resolveScan(text, { sessionId, zone } = {}) {
    const scope = scopeKey(sessionId, zone);
    const { query, id } = scanQuery(text);
    const cached = this.status.ready ? findByScan(this.index, text) : null;
    if (cached) {
      const row = ticketRow(cached, scope);
      return { row, rows: [row], query };
    }
    const res = await this.search(query, { sessionId, zone });
    return {
      row: pickScanMatch(res.rows, text),
      rows: res.rows,
      query,
      unavailable: res.unavailable,
      byId: !!id,
      offline: res.source === "local",
    };
  }

  // --- admit / exit -----------------------------------------------------------

  base(row, opts) {
    return {
      registrationId: row.registrationId || null,
      orderId: row.orderId || null,
      name: row.name || "",
      ticketCode: row.ticketCode || null,
      gate: opts.gate || null,
      zone: opts.zone || null,
      sessionId: opts.sessionId || null,
      method: opts.method || "manual",
      staff: opts.staff || this.role?.name || null,
    };
  }

  async admit(row, opts = {}) {
    const clientId = newClientId();
    const scannedAt = nowIso();
    const base = this.base(row, opts);
    if (this.status.online) {
      const res = await admitCheckinDetailed(
        { eventId: this.eventId, code: this.code, ...base, clientId, deviceId: this.deviceId, scannedAt, overrideReason: opts.overrideReason || null },
        ADMIT_TIMEOUT_MS,
      );
      if (!res.network) {
        this.markOnline(true);
        return this.fromServer("in", res, row, base, scannedAt);
      }
      this.markOnline(false);
    }
    // Same client id as the attempt above: if the server did receive it, the sync replays the original outcome.
    return this.offline("in", row, base, clientId, scannedAt, opts);
  }

  async exit(row, opts = {}) {
    const clientId = newClientId();
    const scannedAt = nowIso();
    const base = this.base(row, opts);
    if (this.status.online) {
      const res = await exitCheckinDetailed(
        { eventId: this.eventId, code: this.code, ...base, clientId, deviceId: this.deviceId, scannedAt },
        ADMIT_TIMEOUT_MS,
      );
      if (!res.network) {
        this.markOnline(true);
        return this.fromServer("out", res, row, base, scannedAt);
      }
      this.markOnline(false);
    }
    return this.offline("out", row, base, clientId, scannedAt, opts);
  }

  fromServer(kind, res, row, base, scannedAt) {
    const d = res.data;
    if (!d) {
      if (isInvalidCode(res.error)) {
        this.revoke().catch(() => {});
        return { kind: "error", message: "This access code is no longer valid" };
      }
      return { kind: "error", message: kind === "out" ? "Couldn't record the exit" : "Couldn't record the check-in" };
    }
    const name = d.name || row.name || "";
    const where = { sessionId: base.sessionId, zone: base.zone };
    if (kind === "out") {
      if (d.ok) {
        this.moveLocal(row, { kind: "out", ...where });
        return { kind: "exit", name, party: d.party, zone: d.zone, occupancy: d.occupancy, cap: d.cap, warnPct: d.warnPct };
      }
      this.moveLocal(row, { kind: "clear", ...where });
      return { kind: "notInside", name };
    }
    if (d.ok) {
      this.moveLocal(row, { kind: "in", ...where, at: d.at || scannedAt, gate: base.gate, device: this.deviceId });
      return {
        kind: "success",
        name,
        party: d.party,
        zone: d.zone,
        occupancy: d.occupancy,
        cap: d.cap,
        warnPct: d.warnPct,
        override: !!d.override,
        reentry: !!d.reentry,
      };
    }
    if (d.capacity) {
      return { kind: "capacity", reason: "capacity_full", name, party: d.party, zone: d.zone, occupancy: d.occupancy, cap: d.cap, canOverride: !!d.canOverride };
    }
    if (d.blocked) {
      this.markBlocked(row, d.reason);
      return { kind: "blocked", reason: d.reason, name };
    }
    if (d.already) {
      if (d.reason === "inside") {
        this.moveLocal(row, { kind: "in", ...where, at: d.firstAt, gate: d.firstGate, device: d.firstDevice });
      }
      return {
        kind: "already",
        reason: d.reason,
        name,
        firstAt: d.firstAt,
        firstGate: d.firstGate,
        firstDevice: d.firstDevice,
        sameDevice: !!d.firstDevice && d.firstDevice === this.deviceId,
      };
    }
    return { kind: "error", message: "Couldn't record the check-in" };
  }

  async offline(kind, row, base, clientId, scannedAt, opts) {
    const ticket = this.localTicket(row);
    const where = { sessionId: base.sessionId, zone: base.zone };
    if (!ticket && !opts.trustUnknown) {
      return {
        kind: "error",
        offline: true,
        message: this.status.ready
          ? "Not in this device's offline guest list"
          : this.status.enabled === false
            ? "No connection — offline mode is off for this event"
            : "No connection — this device has no offline guest list yet",
      };
    }
    if (ticket) {
      const decision = kind === "out" ? decideExit(ticket, where) : decideAdmit(ticket, { ...where, caps: this.meta?.caps, settings: this.meta?.settings });
      if (decision.kind === "notInside") return { kind: "notInside", name: ticket.name, offline: true };
      if (decision.kind === "already") {
        return {
          kind: "already",
          reason: decision.reason,
          name: ticket.name,
          firstAt: decision.firstAt,
          firstGate: decision.firstGate,
          firstDevice: decision.firstDevice,
          sameDevice: decision.firstDevice === this.deviceId,
          offline: true,
        };
      }
      if (decision.kind === "blocked") return { kind: "blocked", reason: decision.reason, name: ticket.name, offline: true };
      if (decision.kind === "capacity") return { kind: "capacity", reason: decision.reason, zone: decision.zone, cap: decision.cap, offline: true };
    }

    const item = {
      clientId,
      eventId: this.eventId,
      seq: ++this.seq,
      kind,
      ...base,
      name: base.name || ticket?.name || "",
      deviceId: this.deviceId,
      scannedAt,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    };
    const stored = await saveQueueItem(item);
    if (!stored) this.emit({ storage: false });
    this.queue.push(item);
    this.moveLocal(row, { kind, ...where, at: scannedAt, gate: base.gate, device: this.deviceId });
    this.emitQueue();
    return {
      kind: kind === "out" ? "exit" : "success",
      name: item.name,
      party: ticket?.party || 1,
      zone: base.zone || "",
      offline: true,
      stored,
    };
  }

  moveLocal(row, move) {
    const t = this.localTicket(row);
    if (!t) return;
    const next = applyMovement(t, move);
    this.index.byId.set(t.id, next);
    saveTicket(this.eventId, next);
  }

  markBlocked(row, reason) {
    const t = this.localTicket(row);
    if (!t || !reason || reason === "not_found") return;
    const next = { ...t, admissible: false, status: reason.charAt(0).toUpperCase() + reason.slice(1) };
    this.index.byId.set(t.id, next);
    saveTicket(this.eventId, next);
  }

  // --- queue + sync -----------------------------------------------------------

  pendingCount() {
    return this.queue.filter((i) => i.status === "pending").length;
  }

  emitQueue() {
    this.emit({
      queued: this.pendingCount(),
      failed: this.queue.filter((i) => i.status === "failed").length,
    });
  }

  toSyncItem(item) {
    return {
      clientId: item.clientId,
      kind: item.kind,
      registrationId: item.registrationId,
      orderId: item.orderId,
      name: item.name,
      ticketCode: item.ticketCode,
      gate: item.gate,
      zone: item.zone,
      sessionId: item.sessionId,
      method: item.method,
      staff: item.staff,
      scannedAt: item.scannedAt,
    };
  }

  async syncNow({ manual = false } = {}) {
    if (this.syncing) return;
    const run = this.run;
    const pending = this.queue.filter((i) => i.status === "pending");
    if (!pending.length) {
      await this.heartbeat();
      if (manual && this.status.online && this.live(run)) await this.refreshSnapshot();
      return;
    }
    this.syncing = true;
    this.emit({ syncing: true });
    let synced = false;
    try {
      for (let i = 0; i < pending.length; i += SYNC_BATCH) {
        const batch = pending.slice(i, i + SYNC_BATCH);
        const res = await syncCheckinQueue({
          ...this.device(),
          items: batch.map((item) => this.toSyncItem(item)),
          queued: pending.length - i,
        });
        if (!this.live(run)) return;
        if (res.network) {
          this.markOnline(false);
          break;
        }
        if (!res.data) {
          // A revoked code must stop offline admits now, not at the next snapshot refresh.
          if (isInvalidCode(res.error)) await this.revoke();
          else this.emit({ lastError: "Sync failed — will retry" });
          break;
        }
        this.markOnline(true);
        await this.applyResults(batch, res.data.results || []);
        synced = true;
      }
      if (synced) {
        const at = nowIso();
        this.emit({ lastSyncAt: at, lastError: null });
        writeSyncState(this.eventId, { lastSyncAt: at, conflicts: this.status.conflicts });
      }
      if (manual && this.live(run) && this.status.online) await this.refreshSnapshot();
    } finally {
      this.syncing = false;
      if (this.live(run)) {
        this.emit({ syncing: false });
        this.emitQueue();
      }
    }
  }

  // Authoritative per-item outcomes from the server, applied back onto the queue and the cached guest list.
  async applyResults(batch, results) {
    const byClient = new Map(results.map((r) => [r.clientId, r]));
    const changed = [];
    let conflicts = 0;
    for (const item of batch) {
      const r = byClient.get(item.clientId);
      if (!r) continue;
      const row = { registrationId: item.registrationId, orderId: item.orderId };
      const where = { sessionId: item.sessionId, zone: item.zone };
      if (r.outcome === "error") {
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts >= MAX_ATTEMPTS) item.status = "failed";
      } else {
        item.status = "done";
        item.outcome = r.outcome;
        item.reason = r.reason || null;
        item.conflict = !!(r.conflict || r.overCapacity);
        item.syncedAt = Date.now();
        if (item.conflict) conflicts += 1;
        if (r.outcome === "duplicate" && r.reason === "inside") {
          this.moveLocal(row, { kind: "in", ...where, at: r.firstAt, gate: r.firstGate, device: r.firstDevice });
        } else if (r.outcome === "rejected" && r.reason === "not_inside") {
          this.moveLocal(row, { kind: "clear", ...where });
        } else if (r.outcome === "rejected") {
          this.markBlocked(row, r.reason);
        }
      }
      changed.push(item);
    }
    await saveQueueItems(changed);
    if (conflicts) this.emit({ conflicts: this.status.conflicts + conflicts });
  }

  async heartbeat() {
    const run = this.run;
    this.lastHeartbeat = Date.now();
    const res = await checkinHeartbeat(this.device());
    if (!this.live(run)) return;
    if (res.network) {
      this.markOnline(false);
      return;
    }
    if (res.data) {
      this.emit({ occupancy: Array.isArray(res.data.occupancy) ? res.data.occupancy : [], occupancyAt: Date.now() });
      this.markOnline(true);
    } else if (isInvalidCode(res.error)) {
      await this.revoke();
    }
  }
}
