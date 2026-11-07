"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for Smart Badges: NFC chip badges (events.nfc_credentials), their batches
// (events.smart_badge_batches), history (events.smart_badge_events) and taps (events.nfc_taps).
// Pure: console.error on failure, return null / false / [], never throw, never toast.
// Multi-row writes (import, assign, bind, replace, status) go through invoker RPCs so they run atomically under RLS.

const BADGES = "nfc_credentials";
const BATCHES = "smart_badge_batches";
const HISTORY = "smart_badge_events";
const TAPS = "nfc_taps";

const obj = (v) => (v && typeof v === "object" ? v : {});

export function normalizeBadge(row) {
  if (!row) return null;
  const meta = obj(row.metadata);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    uid: row.nfc_uid ?? "",
    serial: row.serial ?? "",
    label: row.label ?? "",
    status: row.status ?? (row.active === false ? "revoked" : "active"),
    batchId: row.batch_id ?? null,
    registrationId: row.registration_id ?? null,
    orderId: row.order_id ?? null,
    attendeeKey: row.attendee_key ?? null,
    holder: obj(meta.holder),
    rawMetadata: meta,
    replacedBy: row.replaced_by ?? null,
    replacesId: row.replaces_id ?? null,
    notes: row.notes ?? "",
    issuedAt: row.issued_at ?? row.created_at ?? null,
    boundAt: row.bound_at ?? null,
    boundBy: row.bound_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function normalizeBatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    name: row.name ?? "Untitled batch",
    source: row.source ?? "import",
    badgeCount: Number(row.badge_count ?? 0),
    serialPrefix: row.serial_prefix ?? "",
    serialStart: row.serial_start ?? null,
    serialDigits: row.serial_digits ?? null,
    notes: row.notes ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeBadgeTap(row) {
  if (!row) return null;
  const meta = obj(row.metadata);
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    entryPointId: row.entry_point_id ?? null,
    credentialId: row.credential_id ?? null,
    nfcUid: row.nfc_uid ?? "",
    attendeeName: row.attendee_name ?? "",
    amountCents: Number(row.amount_cents ?? 0),
    currency: (row.currency || "usd").toLowerCase(),
    status: row.status ?? "free",
    purpose: row.purpose ?? "gate",
    outcome: row.outcome ?? null,
    sessionId: row.session_id ?? null,
    leadId: row.lead_id ?? null,
    attendanceId: row.attendance_id ?? null,
    tappedAt: row.tapped_at ?? null,
    pointName: meta.point ?? "",
    location: meta.location ?? "",
    sessionName: meta.sessionName ?? "",
    exhibitor: meta.exhibitor ?? "",
  };
}

export function normalizeBadgeEvent(row) {
  if (!row) return null;
  const meta = obj(row.metadata);
  return {
    id: row.id,
    badgeId: row.badge_id ?? null,
    kind: row.kind ?? "status",
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status ?? null,
    holderName: row.holder_name ?? "",
    entryPointId: row.entry_point_id ?? null,
    reason: row.reason ?? "",
    actor: row.actor ?? null,
    occurredAt: row.occurred_at ?? row.created_at ?? null,
    pointName: meta.point ?? "",
    uid: meta.uid ?? "",
    previousHolder: meta.previousHolder ?? "",
  };
}

async function rpc(name, args, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc(name, args);
    if (error) {
      console.error(`[smart_badges.${tag}]`, error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.error(`[smart_badges.${tag}]`, e);
    return null;
  }
}

// --- Badges ----------------------------------------------------------------

const PAGE = 1000;
const MAX_PAGES = 50;

// Every live badge on the event, paged past PostgREST's per-request row cap.
export async function listBadges(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const out = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const { data, error } = await sb
        .from(BADGES)
        .select("*")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) {
        console.error("[smart_badges.list]", error.message);
        return null;
      }
      out.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return out.map(normalizeBadge);
  } catch (e) {
    console.error("[smart_badges.list]", e);
    return null;
  }
}

export async function updateBadgeNotes(id, notes) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BADGES)
      .update({ notes: String(notes || "") })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[smart_badges.notes]", error.message);
      return null;
    }
    return normalizeBadge(data);
  } catch (e) {
    console.error("[smart_badges.notes]", e);
    return null;
  }
}

// Return a bound badge to the spare pool (the trigger flips it to unassigned and logs the unbind).
export async function unbindBadge(badge) {
  if (!badge?.id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const metadata = { ...obj(badge.rawMetadata) };
    delete metadata.holder;
    const { data, error } = await sb
      .from(BADGES)
      .update({ registration_id: null, order_id: null, attendee_key: null, label: "", metadata })
      .eq("id", badge.id)
      .select("*")
      .single();
    if (error) {
      console.error("[smart_badges.unbind]", error.message);
      return null;
    }
    return normalizeBadge(data);
  } catch (e) {
    console.error("[smart_badges.unbind]", e);
    return null;
  }
}

export async function softDeleteBadges(ids) {
  if (!ids?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(BADGES)
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      console.error("[smart_badges.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[smart_badges.delete]", e);
    return false;
  }
}

// rows: [{ uid, serial, label?, registration_id?, order_id?, attendee_key?, holder? }]
// -> { ok, created, attached, skipped: [{ uid, serial, reason }] } | { ok:false, reason } | null
export const importBadges = (eventId, batchId, rows) =>
  eventId ? rpc("smart_badge_import", { p_event: eventId, p_batch: batchId || null, p_rows: rows || [] }, "import") : null;

// assignments: [{ badge_id, registration_id, order_id, attendee_key, label, holder }] -> { ok, assigned, skipped }
export const assignBadges = (eventId, assignments) =>
  eventId ? rpc("smart_badge_assign", { p_event: eventId, p_assignments: assignments || [] }, "assign") : null;

// -> { ok, already, badge_id, created, replaced[] } | { ok:false, reason, holder?, status? } | null
export const bindBadge = ({ eventId, uid, attendee, replace = true, batchId = null }) =>
  eventId
    ? rpc(
        "smart_badge_bind",
        { p_event: eventId, p_uid: uid, p_attendee: attendee, p_replace: !!replace, p_batch: batchId || null },
        "bind",
      )
    : null;

export const replaceBadge = (badgeId, newUid, reason = "") =>
  badgeId ? rpc("smart_badge_replace", { p_badge: badgeId, p_new_uid: newUid, p_reason: reason }, "replace") : null;

// status: active (reactivate) | lost | revoked
export const setBadgeStatus = (badgeId, status, reason = "") =>
  badgeId ? rpc("smart_badge_set_status", { p_badge: badgeId, p_status: status, p_reason: reason }, "status") : null;

// --- Batches ---------------------------------------------------------------

export async function listBatches(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BATCHES)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[smart_badges.listBatches]", error.message);
      return null;
    }
    return (data || []).map(normalizeBatch);
  } catch (e) {
    console.error("[smart_badges.listBatches]", e);
    return null;
  }
}

export async function createBatch(input) {
  if (!input?.eventId || !input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BATCHES)
      .insert({
        project_id: input.projectId,
        event_id: input.eventId,
        name: String(input.name || "").trim() || "Untitled batch",
        source: input.source || "import",
        badge_count: Number(input.badgeCount) || 0,
        serial_prefix: input.serialPrefix || "",
        serial_start: input.serialStart ?? null,
        serial_digits: input.serialDigits ?? null,
        notes: input.notes || "",
        created_by: input.createdBy || null,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[smart_badges.createBatch]", error.message);
      return null;
    }
    return normalizeBatch(data);
  } catch (e) {
    console.error("[smart_badges.createBatch]", e);
    return null;
  }
}

// Removes a batch and its still-spare badges. Bound badges keep working and simply lose the batch link.
export async function deleteBatch(batchId) {
  if (!batchId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const now = new Date().toISOString();
    const { error: badgeError } = await sb
      .from(BADGES)
      .update({ deleted_at: now })
      .eq("batch_id", batchId)
      .eq("status", "unassigned")
      .is("deleted_at", null);
    if (badgeError) {
      console.error("[smart_badges.deleteBatch]", badgeError.message);
      return false;
    }
    const { error } = await sb.from(BATCHES).update({ deleted_at: now }).eq("id", batchId);
    if (error) {
      console.error("[smart_badges.deleteBatch]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[smart_badges.deleteBatch]", e);
    return false;
  }
}

// --- Activity --------------------------------------------------------------

// { tapsToday, activeToday, rejectedToday, leads } since the given instant (the viewer's midnight).
export async function getBadgeStats(eventId, since) {
  const data = eventId
    ? await rpc("smart_badge_stats", { p_event: eventId, p_since: new Date(since).toISOString() }, "stats")
    : null;
  if (!data) return null;
  return {
    tapsToday: Number(data.taps_today ?? 0),
    activeToday: Number(data.active_today ?? 0),
    rejectedToday: Number(data.rejected_today ?? 0),
    leads: Number(data.leads ?? 0),
  };
}

// Map(badgeId -> { taps, lastTapAt }). The RPC returns one { id: [taps, lastTapAt] } object, so no row cap applies.
export async function listTapSummary(eventId) {
  const data = eventId ? await rpc("smart_badge_tap_summary", { p_event: eventId }, "tapSummary") : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return new Map(
    Object.entries(data).map(([id, v]) => [
      id,
      { taps: Number(Array.isArray(v) ? v[0] : 0) || 0, lastTapAt: Array.isArray(v) ? v[1] ?? null : null },
    ]),
  );
}

export async function listBadgeTaps(badgeId, limit = 300) {
  if (!badgeId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TAPS)
      .select("*")
      .eq("credential_id", badgeId)
      .is("deleted_at", null)
      .order("tapped_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[smart_badges.taps]", error.message);
      return null;
    }
    return (data || []).map(normalizeBadgeTap);
  } catch (e) {
    console.error("[smart_badges.taps]", e);
    return null;
  }
}

export async function listBadgeHistory(badgeId, limit = 200) {
  if (!badgeId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(HISTORY)
      .select("*")
      .eq("badge_id", badgeId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[smart_badges.history]", error.message);
      return null;
    }
    return (data || []).map(normalizeBadgeEvent);
  } catch (e) {
    console.error("[smart_badges.history]", e);
    return null;
  }
}
