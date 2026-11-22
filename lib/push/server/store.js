import { adminClient } from "@/lib/supabase/admin";
import { normalizeCategories, normalizeSettings } from "../types.js";

// events_push access for the server: settings, preferences, devices and the enqueue RPCs. Never throws.

export function pushDb() {
  return adminClient()?.schema("events_push") || null;
}

function settingsFromRow(row) {
  return normalizeSettings({
    types: row?.types,
    eventOffsets: row?.event_offsets,
    membershipDays: row?.membership_days,
    quietHours: row?.quiet_hours,
    paused: row?.paused,
  });
}

export async function getProjectSettings(projectId) {
  const db = pushDb();
  if (!db || !projectId) return normalizeSettings({});
  const { data, error } = await db.from("project_settings").select("*").eq("project_id", projectId).maybeSingle();
  if (error) console.error("[push.settings.get]", error.message);
  return settingsFromRow(data);
}

export async function getProjectSettingsMap(projectIds) {
  const db = pushDb();
  const list = [...new Set((projectIds || []).filter(Boolean))];
  const map = new Map();
  if (db && list.length) {
    const { data, error } = await db.from("project_settings").select("*").in("project_id", list);
    if (error) console.error("[push.settings.map]", error.message);
    for (const row of data || []) map.set(row.project_id, settingsFromRow(row));
  }
  return { get: (id) => map.get(id) || normalizeSettings({}), map };
}

export async function saveProjectSettings(projectId, settings, userId = null) {
  const db = pushDb();
  if (!db) throw new Error("events_push unavailable");
  const s = normalizeSettings(settings);
  const { data, error } = await db
    .from("project_settings")
    .upsert(
      {
        project_id: projectId,
        types: s.types,
        event_offsets: s.eventOffsets,
        membership_days: s.membershipDays,
        quiet_hours: s.quietHours,
        paused: s.paused,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return settingsFromRow(data);
}

export async function getMemberCategories(memberId) {
  const db = pushDb();
  if (!db || !memberId) return normalizeCategories({});
  const { data } = await db.from("member_preferences").select("categories").eq("member_id", memberId).maybeSingle();
  return normalizeCategories(data?.categories);
}

export async function getMemberCategoriesMap(memberIds) {
  const db = pushDb();
  const list = [...new Set((memberIds || []).filter(Boolean))];
  const map = new Map();
  if (db && list.length) {
    const { data, error } = await db.from("member_preferences").select("member_id, categories").in("member_id", list);
    if (error) console.error("[push.prefs.map]", error.message);
    for (const row of data || []) map.set(row.member_id, normalizeCategories(row.categories));
  }
  return { get: (id) => map.get(id) || normalizeCategories({}) };
}

export async function saveMemberCategories(memberId, categories) {
  const db = pushDb();
  if (!db) throw new Error("events_push unavailable");
  const clean = normalizeCategories(categories);
  const { error } = await db
    .from("member_preferences")
    .upsert({ member_id: memberId, categories: clean, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (error) throw new Error(error.message);
  return clean;
}

export async function listDevicesFor(memberIds) {
  const db = pushDb();
  const list = [...new Set((memberIds || []).filter(Boolean))];
  if (!db || !list.length) return [];
  const { data, error } = await db
    .from("devices")
    .select("id, member_id, push_token, platform")
    .in("member_id", list)
    .is("deleted_at", null);
  if (error) console.error("[push.devices.list]", error.message);
  return data || [];
}

export async function retireTokens(tokens) {
  const db = pushDb();
  const list = [...new Set((tokens || []).filter(Boolean))];
  if (!db || !list.length) return;
  // Chunked: `in` filters ride in the URL, which has a length limit.
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await db.from("devices").update({ deleted_at: new Date().toISOString() }).in("push_token", list.slice(i, i + 100));
    if (error) console.error("[push.devices.retire]", error.message);
  }
}

export async function getRuntime() {
  const db = pushDb();
  if (!db) return { paused: false, configured: false };
  const { data } = await db.from("runtime").select("base_url, secret, paused").maybeSingle();
  return { paused: Boolean(data?.paused), configured: Boolean(data?.base_url && data?.secret) };
}

// Server-side enqueue (meetings, Stripe, test sends). Returns the number of rows created.
// strict: throw on a store error (fan-outs retry) instead of logging and returning 0.
export async function enqueue({ projectId = null, eventId = null, type, memberIds = [], ref = {}, dedupe = null, sendAfter = null, expiresAt = null, supersede = false, strict = false }) {
  const db = pushDb();
  if (!db && strict) throw new Error("events_push unavailable");
  if (!db || !type || !memberIds.length) return 0;
  const { data, error } = await db.rpc("enqueue", {
    p_project: projectId,
    p_event: eventId,
    p_type: type,
    p_members: memberIds,
    p_ref: ref,
    p_dedupe: dedupe,
    p_send_after: sendAfter,
    p_expires_at: expiresAt,
    p_supersede: supersede,
  });
  if (error) {
    console.error(`[push.enqueue] ${type}`, error.message);
    if (strict) throw new Error(error.message);
    return 0;
  }
  return Number(data) || 0;
}

export async function enqueueEmails({ emails = [], strict = false, ...rest }) {
  const db = pushDb();
  if (!db && strict) throw new Error("events_push unavailable");
  if (!db || !emails.length) return 0;
  // Large audiences resolve in chunks so each RPC stays small.
  const memberIds = [];
  for (let i = 0; i < emails.length; i += 1000) {
    const { data, error } = await db.rpc("member_ids_for_emails", { p_emails: emails.slice(i, i + 1000) });
    if (error) {
      console.error("[push.enqueueEmails]", error.message);
      if (strict) throw new Error(error.message);
      return 0;
    }
    memberIds.push(...(data || []));
  }
  return enqueue({ ...rest, memberIds, strict });
}

// Planner rows: [{ member, project, event, type, ref, dedupe, sendAfter, expiresAt }] with dedupe keys as given.
export async function enqueueRows(rows) {
  const db = pushDb();
  if (!db || !rows.length) return 0;
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.rpc("enqueue_rows", { p_rows: rows.slice(i, i + 500) });
    if (error) console.error("[push.enqueueRows]", error.message);
    else total += Number(data) || 0;
  }
  return total;
}

export async function logRun(kind, startedAt, stats = {}) {
  const db = pushDb();
  if (!db) return;
  await db.from("dispatch_runs").insert({
    kind,
    started_at: new Date(startedAt).toISOString(),
    ms: Date.now() - startedAt,
    claimed: stats.claimed || 0,
    sent: stats.sent || 0,
    failed: stats.failed || 0,
    skipped: stats.skipped || 0,
    planned: stats.planned || 0,
    error: stats.error || null,
  });
}
