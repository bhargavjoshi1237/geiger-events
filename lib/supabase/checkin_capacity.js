"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Dashboard data for Capacity Control: per-zone caps, live occupancy (the zone_occupancy view), arrivals/exits
// over time (checkin_timeline) and the supervisor override log. Never throws.

const CAPS = "checkin_capacity";
const OCCUPANCY = "zone_occupancy";
const OVERRIDES = "capacity_overrides";

export const REENTRY_RULES = ["inherit", "once", "multi"];

export function normalizeCapacityRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    zoneKey: row.zone_key ?? "",
    zoneName: row.zone_name ?? "",
    hardCap: row.hard_cap === null || row.hard_cap === undefined ? null : Number(row.hard_cap),
    warnPct: Number(row.warn_pct ?? 85),
    reentry: REENTRY_RULES.includes(row.reentry) ? row.reentry : "inherit",
    updatedAt: row.updated_at ?? null,
  };
}

function capacityToRow(input) {
  const cap = input.hardCap === "" || input.hardCap === null || input.hardCap === undefined ? null : Math.max(0, Math.round(Number(input.hardCap)));
  return {
    project_id: input.projectId,
    event_id: input.eventId,
    zone_key: input.zoneKey || "",
    zone_name: input.zoneName || "",
    hard_cap: Number.isFinite(cap) ? cap : null,
    warn_pct: Math.min(100, Math.max(1, Math.round(Number(input.warnPct) || 85))),
    reentry: REENTRY_RULES.includes(input.reentry) ? input.reentry : "inherit",
    deleted_at: null,
  };
}

export function normalizeOccupancy(row) {
  if (!row) return null;
  return {
    eventId: row.event_id ?? null,
    // Lower-cased zone name ("" = the venue); attendance stores zone names, so occupancy is keyed by name.
    nameKey: row.zone_key ?? "",
    zone: row.zone ?? "",
    admitted: Number(row.admitted ?? 0),
    exited: Number(row.exited ?? 0),
    occupancy: Number(row.occupancy ?? 0),
    overCapacityAdmits: Number(row.over_capacity_admits ?? 0),
    offlineAdmits: Number(row.offline_admits ?? 0),
    lastMovementAt: row.last_movement_at ?? null,
  };
}

export function normalizeOverride(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    zone: row.zone ?? "",
    attendeeName: row.attendee_name ?? "",
    partySize: Number(row.party_size ?? 1),
    occupancy: Number(row.occupancy ?? 0),
    cap: Number(row.cap ?? 0),
    reason: row.reason ?? "",
    roleName: row.role_name ?? "",
    staff: row.staff ?? "",
    deviceId: row.device_id ?? "",
    createdAt: row.created_at ?? null,
  };
}

export async function listCapacityRules(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(CAPS)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null);
    if (error) {
      console.error("[checkin_capacity.listRules]", error.message);
      return null;
    }
    return (data || []).map(normalizeCapacityRule);
  } catch (e) {
    console.error("[checkin_capacity.listRules]", e);
    return null;
  }
}

// Upsert one zone's (or the venue's, zoneKey "") cap → the saved rule or null.
export async function saveCapacityRule(input) {
  if (!input?.eventId || !input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(CAPS)
      .upsert(capacityToRow(input), { onConflict: "event_id,zone_key" })
      .select("*")
      .single();
    if (error) {
      console.error("[checkin_capacity.saveRule]", error.message);
      return null;
    }
    return normalizeCapacityRule(data);
  } catch (e) {
    console.error("[checkin_capacity.saveRule]", e);
    return null;
  }
}

export async function listZoneOccupancy(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient().from(OCCUPANCY).select("*").eq("event_id", eventId);
    if (error) {
      console.error("[checkin_capacity.listOccupancy]", error.message);
      return null;
    }
    return (data || []).map(normalizeOccupancy);
  } catch (e) {
    console.error("[checkin_capacity.listOccupancy]", e);
    return null;
  }
}

// Arrivals and exits per bucket, per zone, over the last `hours` of activity → [{ bucket, nameKey, arrivals, exits }].
export async function getCheckinTimeline(eventId, { hours = 6, bucketMinutes = 15 } = {}) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient().rpc("checkin_timeline", {
      p_event: eventId,
      p_hours: hours,
      p_bucket_minutes: bucketMinutes,
    });
    if (error) {
      console.error("[checkin_capacity.timeline]", error.message);
      return null;
    }
    return (data || []).map((r) => ({
      bucket: r.bucket,
      nameKey: r.zone_key ?? "",
      arrivals: Number(r.arrivals ?? 0),
      exits: Number(r.exits ?? 0),
    }));
  } catch (e) {
    console.error("[checkin_capacity.timeline]", e);
    return null;
  }
}

export async function listCapacityOverrides(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(OVERRIDES)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[checkin_capacity.listOverrides]", error.message);
      return null;
    }
    return (data || []).map(normalizeOverride);
  } catch (e) {
    console.error("[checkin_capacity.listOverrides]", e);
    return null;
  }
}
