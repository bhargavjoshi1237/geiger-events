"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { getFloorPlan, saveFloorPlan } from "./floor_plans";
import { snapshotToPlan } from "@/lib/event_design";

// Data-access layer for floor plan collaboration: share links (floor_plan_shares), canvas comments and version history.
// Links are minted by the floor_plan_share_create / _reissue RPCs — the raw token only exists in their response. Never throws.

const SHARES = "floor_plan_shares";
const VIEWS = "floor_plan_share_views";
const COMMENTS = "floor_plan_comments";
const VERSIONS = "floor_plan_versions";
const SHARE_COLUMNS =
  "id, project_id, floor_plan_id, label, permission, expires_at, revoked_at, view_count, last_viewed_at, created_by, created_at, updated_at";
const VERSION_COLUMNS =
  "id, project_id, floor_plan_id, version, object_count, seat_count, note, restored_from, created_by, author_name, created_at";

const num = (v, fallback = null) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeShare(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    planId: row.floor_plan_id ?? null,
    label: row.label ?? "",
    permission: row.permission === "comment" ? "comment" : "view",
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    viewCount: Number(row.view_count ?? 0),
    lastViewedAt: row.last_viewed_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function shareToRow(patch) {
  const row = {};
  if ("label" in patch) row.label = String(patch.label || "").trim().slice(0, 80);
  if ("permission" in patch) row.permission = patch.permission === "comment" ? "comment" : "view";
  if ("expiresAt" in patch) row.expires_at = patch.expiresAt || null;
  if ("revokedAt" in patch) row.revoked_at = patch.revokedAt || null;
  if ("revokedBy" in patch) row.revoked_by = patch.revokedBy || null;
  return row;
}

export function normalizeComment(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    planId: row.floor_plan_id ?? null,
    parentId: row.parent_id ?? null,
    xM: num(row.x_m),
    yM: num(row.y_m),
    itemId: row.item_id ?? null,
    body: row.body ?? "",
    internal: row.internal === true,
    authorKind: row.author_kind === "guest" ? "guest" : "member",
    authorId: row.author_id ?? null,
    authorName: row.author_name ?? "",
    shareId: row.share_id ?? null,
    planVersion: num(row.plan_version),
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function normalizeVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    planId: row.floor_plan_id ?? null,
    version: Number(row.version ?? 1),
    objectCount: Number(row.object_count ?? 0),
    seatCount: Number(row.seat_count ?? 0),
    note: row.note ?? "",
    restoredFrom: num(row.restored_from),
    createdBy: row.created_by ?? null,
    authorName: row.author_name ?? "",
    createdAt: row.created_at ?? null,
  };
}

async function run(label, fn, fallback) {
  if (!isSupabaseConfigured()) return fallback;
  try {
    const { data, error, count } = await fn(createClient());
    if (error) {
      console.error(`[floor_plan_sharing.${label}]`, error.message);
      return fallback;
    }
    return { data, count };
  } catch (e) {
    console.error(`[floor_plan_sharing.${label}]`, e);
    return fallback;
  }
}

// --- share links ------------------------------------------------------------

export async function listPlanShares(planId) {
  if (!planId) return null;
  const res = await run(
    "listPlanShares",
    (sb) =>
      sb.from(SHARES).select(SHARE_COLUMNS).eq("floor_plan_id", planId).is("deleted_at", null).order("created_at", { ascending: false }),
    null,
  );
  return res ? (res.data || []).map(normalizeShare) : null;
}

export async function listProjectShares(projectId) {
  if (!projectId) return null;
  const res = await run(
    "listProjectShares",
    (sb) =>
      sb.from(SHARES).select(SHARE_COLUMNS).eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
    null,
  );
  return res ? (res.data || []).map(normalizeShare) : null;
}

const minted = (res) => {
  const data = res?.data;
  if (!data?.token || !data?.share) return null;
  return { share: normalizeShare(data.share), token: String(data.token) };
};

// New link → { share, token } (the token is shown once — it is never readable again), or null.
export async function createPlanShare({ planId, label, permission, expiresAt }) {
  if (!planId) return null;
  const res = await run(
    "createPlanShare",
    (sb) =>
      sb.rpc("floor_plan_share_create", {
        p_plan: planId,
        p_label: String(label || "").trim().slice(0, 80),
        p_permission: permission === "comment" ? "comment" : "view",
        p_expires_at: expiresAt || null,
      }),
    null,
  );
  return minted(res);
}

// A fresh address for a link (the old one stops working) → { share, token } or null.
export async function reissuePlanShare(id) {
  if (!id) return null;
  return minted(await run("reissuePlanShare", (sb) => sb.rpc("floor_plan_share_reissue", { p_share: id }), null));
}

export async function updatePlanShare(id, patch) {
  if (!id) return null;
  const res = await run(
    "updatePlanShare",
    (sb) => sb.from(SHARES).update(shareToRow(patch)).eq("id", id).select(SHARE_COLUMNS).single(),
    null,
  );
  return res ? normalizeShare(res.data) : null;
}

export async function deletePlanShare(id) {
  if (!id) return false;
  const res = await run(
    "deletePlanShare",
    (sb) => sb.from(SHARES).update({ deleted_at: new Date().toISOString() }).eq("id", id),
    null,
  );
  return Boolean(res);
}

// Counted link opens across the project since `sinceIso`, or null.
export async function countShareViewsSince(projectId, sinceIso) {
  if (!projectId) return null;
  const res = await run(
    "countShareViewsSince",
    (sb) => sb.from(VIEWS).select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sinceIso),
    null,
  );
  return res ? Number(res.count ?? 0) : null;
}

// --- comments ---------------------------------------------------------------

export async function listPlanComments(planId) {
  if (!planId) return null;
  const res = await run(
    "listPlanComments",
    (sb) => sb.from(COMMENTS).select("*").eq("floor_plan_id", planId).is("deleted_at", null).order("created_at", { ascending: true }),
    null,
  );
  return res ? (res.data || []).map(normalizeComment) : null;
}

export async function listProjectComments(projectId, { limit = 500 } = {}) {
  if (!projectId) return null;
  const res = await run(
    "listProjectComments",
    (sb) =>
      sb
        .from(COMMENTS)
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit),
    null,
  );
  return res ? (res.data || []).map(normalizeComment) : null;
}

// A team comment or reply; the database stamps the author from the session.
export async function createPlanComment({ planId, parentId, xM, yM, itemId, body, internal, authorName, planVersion }) {
  const text = String(body || "").trim();
  if (!planId || !text) return null;
  const res = await run(
    "createPlanComment",
    (sb) =>
      sb
        .from(COMMENTS)
        .insert({
          floor_plan_id: planId,
          parent_id: parentId || null,
          x_m: parentId ? null : num(xM),
          y_m: parentId ? null : num(yM),
          item_id: parentId ? null : itemId || null,
          body: text.slice(0, 4000),
          internal: internal === true,
          author_kind: "member",
          author_name: String(authorName || "").slice(0, 120),
          plan_version: num(planVersion),
        })
        .select("*")
        .single(),
    null,
  );
  return res ? normalizeComment(res.data) : null;
}

// Resolve / reopen ({ resolved: bool, userId }) or edit the body.
export async function updatePlanComment(id, patch) {
  if (!id) return null;
  const row = {};
  if ("resolved" in patch) {
    row.resolved_at = patch.resolved ? new Date().toISOString() : null;
    row.resolved_by = patch.resolved ? patch.userId || null : null;
  }
  if ("body" in patch) row.body = String(patch.body || "").trim().slice(0, 4000);
  const res = await run(
    "updatePlanComment",
    (sb) => sb.from(COMMENTS).update(row).eq("id", id).select("*").single(),
    null,
  );
  return res ? normalizeComment(res.data) : null;
}

export async function deletePlanComment(id) {
  if (!id) return false;
  const res = await run(
    "deletePlanComment",
    (sb) => sb.from(COMMENTS).update({ deleted_at: new Date().toISOString() }).eq("id", id),
    null,
  );
  return Boolean(res);
}

// --- versions ---------------------------------------------------------------

export async function listPlanVersions(planId, { limit = 100 } = {}) {
  if (!planId) return null;
  const res = await run(
    "listPlanVersions",
    (sb) => sb.from(VERSIONS).select(VERSION_COLUMNS).eq("floor_plan_id", planId).order("version", { ascending: false }).limit(limit),
    null,
  );
  return res ? (res.data || []).map(normalizeVersion) : null;
}

export async function listProjectVersions(projectId, { limit = 150 } = {}) {
  if (!projectId) return null;
  const res = await run(
    "listProjectVersions",
    (sb) =>
      sb.from(VERSIONS).select(VERSION_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(limit),
    null,
  );
  return res ? (res.data || []).map(normalizeVersion) : null;
}

// One version's saved content as a renderable plan, or null.
export async function getVersionPlan(versionId) {
  if (!versionId) return null;
  const res = await run(
    "getVersionPlan",
    (sb) => sb.from(VERSIONS).select("snapshot").eq("id", versionId).maybeSingle(),
    null,
  );
  return res?.data ? snapshotToPlan(res.data.snapshot) : null;
}

export async function updateVersionNote(id, note) {
  if (!id) return null;
  const res = await run(
    "updateVersionNote",
    (sb) => sb.from(VERSIONS).update({ note: String(note || "").trim().slice(0, 500) }).eq("id", id).select(VERSION_COLUMNS).single(),
    null,
  );
  return res ? normalizeVersion(res.data) : null;
}

// Labels version `version` of a plan as a restore of `fromVersion` → the updated version or null.
export async function markVersionRestored(planId, version, fromVersion) {
  if (!planId || !version) return null;
  const res = await run(
    "markVersionRestored",
    (sb) =>
      sb
        .from(VERSIONS)
        .update({ note: `Restored from version ${fromVersion}`, restored_from: fromVersion })
        .eq("floor_plan_id", planId)
        .eq("version", version)
        .select(VERSION_COLUMNS)
        .maybeSingle(),
    null,
  );
  return res?.data ? normalizeVersion(res.data) : null;
}

// Saves an old version's layout as the plan's newest version → { plan, version } | "conflict" | null. The name is kept.
export async function restorePlanVersion(planId, version) {
  if (!planId || !version?.id) return null;
  const [current, snapshot] = await Promise.all([getFloorPlan(planId), getVersionPlan(version.id)]);
  if (!current || !snapshot) return null;
  const saved = await saveFloorPlan(planId, { ...snapshot, name: current.name }, current.version);
  if (!saved || saved === "conflict") return saved;
  return { plan: saved, version: await markVersionRestored(planId, saved.version, version.version) };
}
