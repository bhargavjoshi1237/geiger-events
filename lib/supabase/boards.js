"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { getUser } from "./user";
import { normalizeSpec } from "@/lib/audience/resolve";
import { normalizeSettings, normalizeTags, LIMITS } from "@/lib/boards/constants";
import { portalFetch } from "@/lib/portal/portal_fetch";

// Organiser-side data layer for Discussion Boards (events.boards / board_topics / board_posts / board_reports /
// board_bans / board_settings), RLS-scoped to projects the signed-in user can access. Never throws: logs and returns
// null / false / []; the screen owns toasts. Members use the separate service-role routes under /api/portal/boards.

const asObject = (v) => (v && typeof v === "object" ? v : {});

export function normalizeBoard(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    eventId: row.event_id ?? null,
    name: row.name ?? "Untitled board",
    slug: row.slug ?? "",
    description: row.description ?? "",
    icon: row.icon || "MessagesSquare",
    sortOrder: row.sort_order ?? 0,
    audience: normalizeSpec(row.audience, { fallbackEventId: row.event_id || "" }),
    format: row.format || "discussion",
    postingPolicy: row.posting_policy || "members",
    requireApproval: Boolean(row.require_approval),
    emailNotifications: row.email_notifications || "inherit",
    archived: Boolean(row.archived),
    topicCount: row.topic_count ?? 0,
    postCount: row.post_count ?? 0,
    lastActivityAt: row.last_activity_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function boardToRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    eventId: "event_id",
    name: "name",
    slug: "slug",
    description: "description",
    icon: "icon",
    sortOrder: "sort_order",
    format: "format",
    postingPolicy: "posting_policy",
    requireApproval: "require_approval",
    emailNotifications: "email_notifications",
    archived: "archived",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("audience" in input) {
    const spec = normalizeSpec(input.audience);
    row.audience = spec;
    // The audience scope is the board's event scope; keep the two in step.
    if (!("eventId" in input)) row.event_id = spec.scope === "event" && spec.eventId ? spec.eventId : null;
  }
  if ("event_id" in row && !row.event_id) row.event_id = null;
  return row;
}

export function normalizeTopic(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    boardId: row.board_id,
    authorKind: row.author_kind || "member",
    authorMemberId: row.author_member_id ?? null,
    authorUserId: row.author_user_id ?? null,
    authorName: row.author_name || (row.author_kind === "organiser" ? "Organiser" : "Member"),
    authorEmail: row.author_email ?? "",
    title: row.title || "Untitled topic",
    body: row.body ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    pinned: Boolean(row.pinned),
    locked: Boolean(row.locked),
    status: row.status || "published",
    replyCount: row.reply_count ?? 0,
    viewCount: row.view_count ?? 0,
    reactions: asObject(row.reaction_counts),
    score: row.score ?? 0,
    lastActivityAt: row.last_activity_at ?? row.created_at,
    lastReplyName: row.last_reply_name ?? "",
    acceptedPostId: row.accepted_post_id ?? null,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  };
}

export function normalizePost(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    topicId: row.topic_id,
    parentPostId: row.parent_post_id ?? null,
    authorKind: row.author_kind || "member",
    authorMemberId: row.author_member_id ?? null,
    authorUserId: row.author_user_id ?? null,
    authorName: row.author_name || (row.author_kind === "organiser" ? "Organiser" : "Member"),
    authorEmail: row.author_email ?? "",
    body: row.body ?? "",
    status: row.status || "published",
    reactions: asObject(row.reaction_counts),
    score: row.score ?? 0,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
    topic: row.topic ? normalizeTopic(row.topic) : null,
  };
}

export function normalizeReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    topicId: row.topic_id,
    postId: row.post_id ?? null,
    reporterName: row.reporter_name || "Member",
    reason: row.reason || "other",
    details: row.details ?? "",
    status: row.status || "open",
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    topic: row.topic ? normalizeTopic(row.topic) : null,
    post: row.post ? normalizePost(row.post) : null,
  };
}

export function normalizeBan(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    memberId: row.member_id,
    memberName: row.member_name || "Member",
    memberEmail: row.member_email ?? "",
    reason: row.reason ?? "",
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
  };
}

async function run(tag, fn, fallback) {
  if (!isSupabaseConfigured()) return fallback;
  try {
    const { data, error } = await fn(createClient());
    if (error) {
      console.error(`[boards.${tag}]`, error.message);
      return fallback;
    }
    return data;
  } catch (e) {
    console.error(`[boards.${tag}]`, e);
    return fallback;
  }
}

// --- boards -------------------------------------------------------------------------------------------------------

export async function listBoards(projectId) {
  if (!projectId) return null;
  const rows = await run(
    "list",
    (sb) =>
      sb
        .from("boards")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    null,
  );
  return rows ? rows.map(normalizeBoard) : null;
}

export async function createBoard(input) {
  if (!input?.projectId) return null;
  const user = await getUser();
  const row = await run(
    "create",
    (sb) => sb.from("boards").insert({ ...boardToRow(input), created_by: user?.id ?? null }).select("*").single(),
    null,
  );
  return normalizeBoard(row);
}

export async function updateBoard(id, patch) {
  if (!id) return null;
  const row = await run("update", (sb) => sb.from("boards").update(boardToRow(patch)).eq("id", id).select("*").single(), null);
  return normalizeBoard(row);
}

// Persist a new board order (index = sort_order).
export async function reorderBoards(ids = []) {
  if (!ids.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const results = await Promise.all(
      ids.map((id, i) => sb.from("boards").update({ sort_order: i }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error("[boards.reorder]", failed.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[boards.reorder]", e);
    return false;
  }
}

export async function softDeleteBoard(id) {
  if (!id) return false;
  const res = await run("delete", (sb) => sb.from("boards").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"), null);
  return Boolean(res);
}

// --- topics -------------------------------------------------------------------------------------------------------

export async function listTopics(projectId, { limit = 500 } = {}) {
  if (!projectId) return null;
  const rows = await run(
    "listTopics",
    (sb) =>
      sb
        .from("board_topics")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("last_activity_at", { ascending: false })
        .limit(limit),
    null,
  );
  return rows ? rows.map(normalizeTopic) : null;
}

export async function getTopic(id) {
  if (!id) return null;
  const row = await run("getTopic", (sb) => sb.from("board_topics").select("*").eq("id", id).maybeSingle(), null);
  return normalizeTopic(row);
}

export async function listTopicPosts(topicId) {
  if (!topicId) return null;
  const rows = await run(
    "listPosts",
    (sb) =>
      sb
        .from("board_posts")
        .select("*")
        .eq("topic_id", topicId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1000),
    null,
  );
  return rows ? rows.map(normalizePost) : null;
}

async function organiserIdentity() {
  const user = await getUser();
  return {
    author_kind: "organiser",
    author_user_id: user?.id ?? null,
    author_name: user?.name || "Organiser",
    author_email: user?.email || "",
  };
}

export async function createOrganiserTopic({ boardId, title, body, tags = [], pinned = false }) {
  if (!boardId || !String(title || "").trim()) return null;
  const who = await organiserIdentity();
  const row = await run(
    "createTopic",
    (sb) =>
      sb
        .from("board_topics")
        .insert({
          // project_id is filled from the board by the board_topic_before trigger.
          board_id: boardId,
          ...who,
          title: String(title).trim().slice(0, LIMITS.title),
          body: String(body || "").trim().slice(0, LIMITS.body),
          tags: normalizeTags(tags),
          pinned: Boolean(pinned),
          status: "published",
        })
        .select("*")
        .single(),
    null,
  );
  return normalizeTopic(row);
}

// patch: { pinned, locked, status, boardId, acceptedPostId, title, body, tags }
export async function updateTopic(id, patch = {}) {
  if (!id) return null;
  const row = {};
  if ("pinned" in patch) row.pinned = Boolean(patch.pinned);
  if ("locked" in patch) row.locked = Boolean(patch.locked);
  if ("status" in patch) row.status = patch.status;
  if ("boardId" in patch) row.board_id = patch.boardId;
  if ("acceptedPostId" in patch) row.accepted_post_id = patch.acceptedPostId || null;
  if ("title" in patch) row.title = String(patch.title || "").trim().slice(0, LIMITS.title);
  if ("body" in patch) row.body = String(patch.body || "").trim().slice(0, LIMITS.body);
  if ("tags" in patch) row.tags = normalizeTags(patch.tags);
  const saved = await run("updateTopic", (sb) => sb.from("board_topics").update(row).eq("id", id).select("*").single(), null);
  return normalizeTopic(saved);
}

export async function softDeleteTopic(id) {
  if (!id) return false;
  const res = await run(
    "deleteTopic",
    (sb) => sb.from("board_topics").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
    null,
  );
  return Boolean(res);
}

// --- posts --------------------------------------------------------------------------------------------------------

export async function createOrganiserPost({ topicId, body, parentPostId = null }) {
  if (!topicId || !String(body || "").trim()) return null;
  const who = await organiserIdentity();
  const row = await run(
    "createPost",
    (sb) =>
      sb
        .from("board_posts")
        .insert({
          topic_id: topicId,
          parent_post_id: parentPostId || null,
          ...who,
          body: String(body).trim().slice(0, LIMITS.body),
          status: "published",
        })
        .select("*")
        .single(),
    null,
  );
  return normalizePost(row);
}

export async function updatePost(id, patch = {}) {
  if (!id) return null;
  const row = {};
  if ("status" in patch) row.status = patch.status;
  if ("body" in patch) {
    row.body = String(patch.body || "").trim().slice(0, LIMITS.body);
    row.edited_at = new Date().toISOString();
  }
  const saved = await run("updatePost", (sb) => sb.from("board_posts").update(row).eq("id", id).select("*").single(), null);
  return normalizePost(saved);
}

export async function softDeletePost(id) {
  if (!id) return false;
  const res = await run(
    "deletePost",
    (sb) => sb.from("board_posts").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
    null,
  );
  return Boolean(res);
}

// Replies held for review (banned-word hits), newest first, with their topic for context.
export async function listPendingPosts(projectId) {
  if (!projectId) return null;
  const rows = await run(
    "listPending",
    (sb) =>
      sb
        .from("board_posts")
        .select("*, topic:board_topics(*)")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    null,
  );
  return rows ? rows.map(normalizePost) : null;
}

// --- reports ------------------------------------------------------------------------------------------------------

export async function listReports(projectId) {
  if (!projectId) return null;
  const rows = await run(
    "listReports",
    (sb) =>
      sb
        .from("board_reports")
        .select("*, topic:board_topics(*), post:board_posts(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(300),
    null,
  );
  return rows ? rows.map(normalizeReport) : null;
}

export async function resolveReports(ids = [], status) {
  if (!ids.length) return false;
  const user = await getUser();
  const res = await run(
    "resolveReports",
    (sb) =>
      sb
        .from("board_reports")
        .update({ status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .in("id", ids)
        .select("id"),
    null,
  );
  return Boolean(res);
}

// --- bans ---------------------------------------------------------------------------------------------------------

export async function listBans(projectId) {
  if (!projectId) return null;
  const rows = await run(
    "listBans",
    (sb) =>
      sb
        .from("board_bans")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    null,
  );
  return rows ? rows.map(normalizeBan) : null;
}

export async function banMember({ projectId, memberId, memberName = "", memberEmail = "", reason = "", expiresAt = null }) {
  if (!projectId || !memberId) return null;
  const user = await getUser();
  const row = await run(
    "ban",
    (sb) =>
      sb
        .from("board_bans")
        .insert({
          project_id: projectId,
          member_id: memberId,
          member_name: memberName,
          member_email: memberEmail,
          reason: String(reason || "").slice(0, 500),
          expires_at: expiresAt || null,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single(),
    null,
  );
  return normalizeBan(row);
}

export async function liftBan(id) {
  if (!id) return false;
  const res = await run(
    "liftBan",
    (sb) => sb.from("board_bans").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
    null,
  );
  return Boolean(res);
}

// --- settings + stats ---------------------------------------------------------------------------------------------

export async function getBoardSettings(projectId) {
  if (!projectId) return normalizeSettings(null);
  const row = await run(
    "getSettings",
    (sb) => sb.from("board_settings").select("config").eq("project_id", projectId).maybeSingle(),
    null,
  );
  return normalizeSettings(row?.config);
}

export async function saveBoardSettings(projectId, config) {
  if (!projectId) return null;
  const row = await run(
    "saveSettings",
    (sb) =>
      sb
        .from("board_settings")
        .upsert({ project_id: projectId, config: normalizeSettings(config) }, { onConflict: "project_id" })
        .select("config")
        .single(),
    null,
  );
  return row ? normalizeSettings(row.config) : null;
}

export async function getBoardStats(projectId) {
  if (!projectId) return null;
  return run("stats", (sb) => sb.rpc("board_stats", { p_project_id: projectId }), null);
}

// Send any reply emails the database queued for this topic (after an organiser reply or approval).
export async function deliverTopicEmails(topicId) {
  if (!topicId || !isSupabaseConfigured()) return false;
  try {
    const res = await portalFetch("/api/boards/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    return res.ok;
  } catch (e) {
    console.error("[boards.deliver]", e);
    return false;
  }
}
