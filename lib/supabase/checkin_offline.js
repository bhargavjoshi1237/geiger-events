"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Dashboard data for Offline Check-in: the staff device registry, offline-sync conflicts and the sync log.
// Staff devices write these through the code-gated RPCs; members read and review them here. Never throws.

const DEVICES = "checkin_devices";
const CONFLICTS = "checkin_conflicts";
const SYNC_LOG = "checkin_sync_log";
const ATTENDANCE = "checkin_attendance";

export function normalizeDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    deviceId: row.device_id ?? "",
    label: row.label ?? "",
    route: row.route ?? "checkin",
    roleName: row.role_name ?? "",
    appVersion: row.app_version ?? "",
    userAgent: row.user_agent ?? "",
    snapshotCount: Number(row.snapshot_count ?? 0),
    queuedCount: Number(row.queued_count ?? 0),
    syncedTotal: Number(row.synced_total ?? 0),
    conflictsTotal: Number(row.conflicts_total ?? 0),
    lastSeenAt: row.last_seen_at ?? null,
    lastSyncAt: row.last_sync_at ?? null,
    lastSnapshotAt: row.last_snapshot_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeConflict(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    kind: row.kind ?? "duplicate",
    registrationId: row.registration_id ?? null,
    orderId: row.order_id ?? null,
    attendeeName: row.attendee_name ?? "",
    ticketCode: row.ticket_code ?? "",
    sessionId: row.session_id ?? "",
    zone: row.zone ?? "",
    firstAttendanceId: row.first_attendance_id ?? null,
    firstAt: row.first_at ?? null,
    firstGate: row.first_gate ?? "",
    firstDeviceId: row.first_device_id ?? "",
    firstOffline: !!row.first_offline,
    deviceId: row.device_id ?? "",
    gate: row.gate ?? "",
    method: row.method ?? "",
    staff: row.staff ?? "",
    scannedAt: row.scanned_at ?? null,
    attendanceId: row.attendance_id ?? null,
    occupancy: row.occupancy ?? null,
    cap: row.cap ?? null,
    reason: row.reason ?? "",
    status: row.status ?? "open",
    resolution: row.resolution ?? null,
    note: row.note ?? "",
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeSyncLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    deviceId: row.device_id ?? "",
    items: Number(row.items ?? 0),
    admitted: Number(row.admitted ?? 0),
    exited: Number(row.exited ?? 0),
    duplicates: Number(row.duplicates ?? 0),
    conflicts: Number(row.conflicts ?? 0),
    rejected: Number(row.rejected ?? 0),
    overCapacity: Number(row.over_capacity ?? 0),
    errors: Number(row.errors ?? 0),
    oldestScanAt: row.oldest_scan_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function listCheckinDevices(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(DEVICES)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("last_seen_at", { ascending: false });
    if (error) {
      console.error("[checkin_offline.listDevices]", error.message);
      return null;
    }
    return (data || []).map(normalizeDevice);
  } catch (e) {
    console.error("[checkin_offline.listDevices]", e);
    return null;
  }
}

// Rename or retire a device. patch: { label } | { removed: true }.
export async function updateCheckinDevice(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  const row = {};
  if ("label" in patch) row.label = String(patch.label || "").slice(0, 80);
  if (patch.removed) row.deleted_at = new Date().toISOString();
  try {
    const { data, error } = await createClient().from(DEVICES).update(row).eq("id", id).select("*").single();
    if (error) {
      console.error("[checkin_offline.updateDevice]", error.message);
      return null;
    }
    return normalizeDevice(data);
  } catch (e) {
    console.error("[checkin_offline.updateDevice]", e);
    return null;
  }
}

export async function listCheckinConflicts(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(CONFLICTS)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[checkin_offline.listConflicts]", error.message);
      return null;
    }
    return (data || []).map(normalizeConflict);
  } catch (e) {
    console.error("[checkin_offline.listConflicts]", e);
    return null;
  }
}

// resolution: keep_first (the second admission stays discarded) | reviewed (noted, nothing changed).
export async function resolveCheckinConflict(id, { resolution, note, resolvedBy }) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(CONFLICTS)
      .update({
        status: "resolved",
        resolution: resolution === "keep_first" ? "keep_first" : "reviewed",
        note: String(note || "").slice(0, 2000),
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[checkin_offline.resolveConflict]", error.message);
      return null;
    }
    return normalizeConflict(data);
  } catch (e) {
    console.error("[checkin_offline.resolveConflict]", e);
    return null;
  }
}

export async function reopenCheckinConflict(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(CONFLICTS)
      .update({ status: "open", resolution: null, resolved_at: null, resolved_by: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[checkin_offline.reopenConflict]", error.message);
      return null;
    }
    return normalizeConflict(data);
  } catch (e) {
    console.error("[checkin_offline.reopenConflict]", e);
    return null;
  }
}

export async function listCheckinSyncLog(eventId, limit = 200) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(SYNC_LOG)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[checkin_offline.listSyncLog]", error.message);
      return null;
    }
    return (data || []).map(normalizeSyncLog);
  } catch (e) {
    console.error("[checkin_offline.listSyncLog]", e);
    return null;
  }
}

// How many admissions for an event were made without a connection → number | null.
export async function countOfflineAdmits(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { count, error } = await createClient()
      .from(ATTENDANCE)
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "in")
      .eq("admitted_offline", true)
      .is("deleted_at", null);
    if (error) {
      console.error("[checkin_offline.countOfflineAdmits]", error.message);
      return null;
    }
    return count ?? 0;
  } catch (e) {
    console.error("[checkin_offline.countOfflineAdmits]", e);
    return null;
  }
}
