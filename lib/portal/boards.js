import { NextResponse } from "next/server";

import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberProjectIds } from "@/lib/portal/memberships";
import { normalizeContact } from "@/lib/supabase/contacts";
import { normalizeSegment } from "@/lib/supabase/segments";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { boardVisibleTo, guestFor, specIsFiltered } from "@/lib/boards/access";
import { boardReplyEmailHtml } from "@/lib/boards/email";
import {
  LIMITS,
  REPORT_REASONS,
  excerpt,
  findBannedWords,
  normalizeSettings,
  normalizeTags,
  reactionKindFor,
  withinEditWindow,
} from "@/lib/boards/constants";

// Member-side Discussion Boards (service role). Every entry point re-derives which boards the member can see
// (project ties + board audience), so a member never reaches a board, topic or reply outside their audience.

const NEW_WINDOW_MS = 14 * 864e5;
// Postgres / PostgREST codes for a table that isn't migrated yet.
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
// Case-insensitive exact email match: escape LIKE wildcards so `_`/`%` in an address can't widen it.
const emailPattern = (email) => String(email || "").trim().replace(/[\\%_]/g, (c) => `\\${c}`);
const TOPIC_COLUMNS =
  "id, board_id, project_id, author_kind, author_member_id, author_name, title, body, tags, pinned, locked, status, reply_count, view_count, reaction_counts, score, last_activity_at, last_reply_name, accepted_post_id, published_at, edited_at, created_at, deleted_at";
const POST_COLUMNS =
  "id, topic_id, project_id, parent_post_id, author_kind, author_member_id, author_name, body, status, reaction_counts, score, published_at, edited_at, created_at, deleted_at";

const ERRORS = {
  unavailable: [503, "Discussions aren't available right now."],
  not_found: [404, "This discussion isn't available."],
  banned: [403, "You've been restricted from posting in these discussions."],
  moderators_only: [403, "Only the organiser can start topics on this board."],
  locked: [409, "This topic is locked."],
  blocked_words: [422, "Your post contains words that aren't allowed here."],
  edit_window: [403, "The time to change this has passed."],
  forbidden: [403, "You can't do that."],
  bad_request: [400, "Check what you entered and try again."],
  failed: [500, "Something went wrong. Try again."],
};

// Route helper: { error, message } -> JSON error response, anything else -> 200 JSON.
export function respond(result) {
  if (result && result.error) {
    const [status, fallback] = ERRORS[result.error] || ERRORS.failed;
    return NextResponse.json({ error: result.message || fallback }, { status });
  }
  return NextResponse.json(result ?? {});
}

// Route wrapper: resolves the portal session, then responds with whatever `work(member)` returns.
export async function withMember(work) {
  const member = await getSessionMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return respond(await work(member));
}

const lc = (s) => String(s || "").trim().toLowerCase();
const asObject = (v) => (v && typeof v === "object" ? v : {});
const displayName = (member) => String(member?.name || "").trim().slice(0, 80) || "Member";
const nowIso = () => new Date().toISOString();
const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

function isBanActive(ban) {
  return !ban.deleted_at && (!ban.expires_at || new Date(ban.expires_at).getTime() > Date.now());
}

// --- context -----------------------------------------------------------------------------------------------------

async function loadContext(member) {
  const sb = adminClient();
  if (!sb) return { error: "unavailable" };
  if (!member?.id || !member?.email) return { error: "not_found" };
  const email = lc(member.email);
  const base = {
    sb,
    member,
    email,
    boards: [],
    boardById: new Map(),
    settingsByProject: new Map(),
    bannedProjects: new Set(),
    eventNames: new Map(),
  };

  const projectIds = await listMemberProjectIds(member.email);
  if (!projectIds.length) return base;

  const [boardsRes, ordersRes, bansRes, settingsRes] = await Promise.all([
    sb
      .from("boards")
      .select("*")
      .in("project_id", projectIds)
      .eq("archived", false)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    sb
      .from("event_orders")
      .select("event_id, project_id, buyer_email, buyer_name, ticket_name, status, metadata, cancelled_at")
      .ilike("buyer_email", emailPattern(member.email)),
    sb.from("board_bans").select("project_id, expires_at, deleted_at").eq("member_id", member.id).is("deleted_at", null),
    sb.from("board_settings").select("project_id, config").in("project_id", projectIds),
  ]);
  if (boardsRes.error) {
    console.error("[portal.boards.context]", boardsRes.error.message);
    return base;
  }
  const rows = boardsRes.data || [];

  const ordersByEvent = new Map();
  for (const o of ordersRes.data || []) {
    if (!o.event_id) continue;
    if (!ordersByEvent.has(o.event_id)) ordersByEvent.set(o.event_id, []);
    ordersByEvent.get(o.event_id).push(o);
  }

  // Filtered audiences need the member's contact (tags/status), registrations and the project's segments.
  const guestByProject = new Map();
  const segmentsByProject = new Map();
  const filteredProjects = [...new Set(rows.filter(specIsFiltered).map((b) => b.project_id))];
  if (filteredProjects.length) {
    const [contactsRes, regsRes, segRes] = await Promise.all([
      sb
        .from("contacts")
        .select("*")
        .in("project_id", filteredProjects)
        .ilike("email", emailPattern(member.email))
        .is("deleted_at", null),
      sb
        .from("registrations")
        .select("project_id, event_id")
        .in("project_id", filteredProjects)
        .ilike("email", emailPattern(member.email))
        .is("deleted_at", null),
      sb.from("contact_segments").select("*").in("project_id", filteredProjects).is("deleted_at", null),
    ]);
    for (const pid of filteredProjects) {
      const contactRow = (contactsRes.data || []).find((c) => c.project_id === pid) || null;
      const eventIds = [
        ...new Set((regsRes.data || []).filter((r) => r.project_id === pid && r.event_id).map((r) => r.event_id)),
      ];
      if (contactRow || eventIds.length) {
        guestByProject.set(
          pid,
          guestFor({
            email,
            name: member.name,
            contact: contactRow ? normalizeContact(contactRow) : null,
            registrationEventIds: eventIds,
          }),
        );
      }
      segmentsByProject.set(
        pid,
        (segRes.data || []).filter((s) => s.project_id === pid).map(normalizeSegment),
      );
    }
  }

  const visible = rows.filter((b) =>
    boardVisibleTo(b, { email, ordersByEvent, guestByProject, segmentsByProject }),
  );

  const eventIds = [...new Set(visible.map((b) => b.event_id).filter(Boolean))];
  const eventNames = new Map();
  if (eventIds.length) {
    const { data: events } = await sb.from("events").select("id, name").in("id", eventIds);
    for (const e of events || []) eventNames.set(e.id, e.name || "Event");
  }

  return {
    ...base,
    boards: visible,
    boardById: new Map(visible.map((b) => [b.id, b])),
    settingsByProject: new Map(
      projectIds.map((pid) => [
        pid,
        normalizeSettings((settingsRes.data || []).find((s) => s.project_id === pid)?.config),
      ]),
    ),
    bannedProjects: new Set((bansRes.data || []).filter(isBanActive).map((b) => b.project_id)),
    eventNames,
  };
}

const settingsFor = (ctx, projectId) => ctx.settingsByProject.get(projectId) || normalizeSettings(null);

// Topic + board the member may see, or null.
async function loadTopicFor(ctx, topicId) {
  if (!topicId) return null;
  const { data: topic } = await ctx.sb
    .from("board_topics")
    .select(TOPIC_COLUMNS)
    .eq("id", topicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!topic) return null;
  const board = ctx.boardById.get(topic.board_id);
  if (!board) return null;
  const mine = topic.author_member_id === ctx.member.id;
  if (topic.status === "hidden" || (topic.status === "pending" && !mine)) return null;
  return { topic, board };
}

async function upsertRead(ctx, { projectId, kind, targetId }) {
  const { error } = await ctx.sb
    .from("board_reads")
    .upsert(
      { project_id: projectId, member_id: ctx.member.id, target_kind: kind, target_id: targetId, read_at: nowIso() },
      { onConflict: "member_id,target_id" },
    );
  if (error) console.error("[portal.boards.read]", error.message);
}

async function readMarkers(ctx) {
  const { data } = await ctx.sb
    .from("board_reads")
    .select("target_id, target_kind, read_at")
    .eq("member_id", ctx.member.id);
  const boards = new Map();
  const topics = new Map();
  for (const r of data || []) (r.target_kind === "board" ? boards : topics).set(r.target_id, r.read_at);
  return { boards, topics };
}

// --- view models ---------------------------------------------------------------------------------------------------

function boardView(ctx, b, extra = {}) {
  const banned = ctx.bannedProjects.has(b.project_id);
  return {
    id: b.id,
    projectId: b.project_id,
    eventId: b.event_id ?? null,
    eventName: b.event_id ? ctx.eventNames.get(b.event_id) || "Event" : "",
    name: b.name || "Board",
    slug: b.slug || "",
    description: b.description || "",
    icon: b.icon || "MessagesSquare",
    format: b.format || "discussion",
    postingPolicy: b.posting_policy || "members",
    requireApproval: Boolean(b.require_approval),
    reactionKind: reactionKindFor(b.format),
    topicCount: b.topic_count ?? 0,
    postCount: b.post_count ?? 0,
    lastActivityAt: b.last_activity_at ?? null,
    banned,
    canStartTopic: !banned && b.posting_policy !== "moderators_only",
    ...extra,
  };
}

function authorView(ctx, row) {
  return {
    name: row.author_name || (row.author_kind === "organiser" ? "Organiser" : "Member"),
    kind: row.author_kind || "member",
    isMe: Boolean(row.author_member_id && row.author_member_id === ctx.member.id),
  };
}

function topicView(ctx, t, board, { myReaction = null, unread = false, subscribed = undefined } = {}) {
  const author = authorView(ctx, t);
  const settings = settingsFor(ctx, t.project_id);
  const banned = ctx.bannedProjects.has(t.project_id);
  const editable = author.isMe && !banned && withinEditWindow(t.created_at, settings.editWindowMinutes);
  return {
    id: t.id,
    boardId: t.board_id,
    title: t.title || "Untitled topic",
    body: t.body || "",
    preview: excerpt(t.body, 180),
    tags: Array.isArray(t.tags) ? t.tags : [],
    pinned: Boolean(t.pinned),
    locked: Boolean(t.locked),
    status: t.status,
    replyCount: t.reply_count ?? 0,
    viewCount: t.view_count ?? 0,
    reactions: asObject(t.reaction_counts),
    score: t.score ?? 0,
    myReaction,
    lastActivityAt: t.last_activity_at,
    lastReplyName: t.last_reply_name || "",
    acceptedPostId: t.accepted_post_id ?? null,
    author,
    createdAt: t.created_at,
    editedAt: t.edited_at ?? null,
    unread,
    canEdit: editable,
    canDelete: editable,
    canAccept: board?.format === "qa" && author.isMe && !banned,
    ...(subscribed === undefined ? {} : { subscribed }),
  };
}

function postView(ctx, p, topic, myReaction) {
  const author = authorView(ctx, p);
  const settings = settingsFor(ctx, p.project_id);
  const banned = ctx.bannedProjects.has(p.project_id);
  const editable = author.isMe && !banned && withinEditWindow(p.created_at, settings.editWindowMinutes);
  return {
    id: p.id,
    parentPostId: p.parent_post_id ?? null,
    body: p.body || "",
    status: p.status,
    author,
    createdAt: p.created_at,
    editedAt: p.edited_at ?? null,
    reactions: asObject(p.reaction_counts),
    score: p.score ?? 0,
    myReaction: myReaction || null,
    accepted: topic.accepted_post_id === p.id,
    canEdit: editable,
    canDelete: editable,
    removed: false,
  };
}

// --- reads ------------------------------------------------------------------------------------------------------

export async function listBoardsForMember(member) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const prefs = { boardEmail: typeof member.metadata?.boardEmail === "boolean" ? member.metadata.boardEmail : null };
  if (!ctx.boards.length) return { boards: [], prefs };

  const reads = await readMarkers(ctx);
  const fallback = new Date(Date.now() - NEW_WINDOW_MS).toISOString();
  const floor = new Date(
    Math.min(...ctx.boards.map((b) => new Date(reads.boards.get(b.id) || fallback).getTime())),
  ).toISOString();

  const { data: recent } = await ctx.sb
    .from("board_topics")
    .select("id, board_id, last_activity_at")
    .in("board_id", ctx.boards.map((b) => b.id))
    .eq("status", "published")
    .is("deleted_at", null)
    .gt("last_activity_at", floor)
    .limit(2000);

  const newCount = new Map();
  for (const t of recent || []) {
    const seen = later(reads.topics.get(t.id), reads.boards.get(t.board_id)) || fallback;
    if (new Date(t.last_activity_at) > new Date(seen)) newCount.set(t.board_id, (newCount.get(t.board_id) || 0) + 1);
  }

  return {
    boards: ctx.boards.map((b) => boardView(ctx, b, { newCount: newCount.get(b.id) || 0 })),
    prefs,
  };
}

const SORTS = {
  latest: [["last_activity_at", false]],
  top: [["score", false], ["reply_count", false], ["last_activity_at", false]],
  new: [["created_at", false]],
};

const searchTerm = (q) =>
  String(q || "")
    .replace(/[,()*%\\:"'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export async function getBoardForMember(member, boardId, { sort = "latest", q = "", tag = "" } = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const board = ctx.boardById.get(boardId);
  if (!board) return { error: "not_found" };

  let query = ctx.sb
    .from("board_topics")
    .select(TOPIC_COLUMNS)
    .eq("board_id", boardId)
    .in("status", ["published", "pending"])
    .is("deleted_at", null)
    .order("pinned", { ascending: false });
  for (const [col, asc] of Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.latest) query = query.order(col, { ascending: asc });
  const term = searchTerm(q);
  if (term) query = query.or(`title.ilike.*${term}*,body.ilike.*${term}*`);
  const tagFilter = normalizeTags([tag])[0];
  if (tagFilter) query = query.contains("tags", [tagFilter]);

  const [{ data: rows, error }, reads, tagsRes] = await Promise.all([
    query.limit(150),
    readMarkers(ctx),
    ctx.sb
      .from("board_topics")
      .select("tags")
      .eq("board_id", boardId)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(500),
  ]);
  if (error) {
    console.error("[portal.boards.topics]", error.message);
    return { error: "failed" };
  }
  const topics = (rows || []).filter((t) => t.status === "published" || t.author_member_id === member.id);

  const ids = topics.map((t) => t.id);
  const mine = new Map();
  if (ids.length) {
    const { data: reactions } = await ctx.sb
      .from("board_reactions")
      .select("topic_id, kind")
      .eq("member_id", member.id)
      .is("post_id", null)
      .in("topic_id", ids);
    for (const r of reactions || []) mine.set(r.topic_id, r.kind);
  }

  const boardSeen = reads.boards.get(boardId) || new Date(Date.now() - NEW_WINDOW_MS).toISOString();
  await upsertRead(ctx, { projectId: board.project_id, kind: "board", targetId: boardId });

  const tagCounts = new Map();
  for (const row of tagsRes.data || []) for (const t of row.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);

  return {
    board: boardView(ctx, board),
    topics: topics.map((t) => {
      const seen = reads.topics.get(t.id) || boardSeen;
      const unread = t.status === "published" && t.author_member_id !== member.id && new Date(t.last_activity_at) > new Date(seen);
      return topicView(ctx, t, board, { myReaction: mine.get(t.id) || null, unread });
    }),
    tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => t),
  };
}

export async function getTopicForMember(member, topicId) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { topic, board } = found;

  const [postsRes, reactionsRes, subRes] = await Promise.all([
    ctx.sb.from("board_posts").select(POST_COLUMNS).eq("topic_id", topicId).order("created_at", { ascending: true }).limit(1000),
    ctx.sb.from("board_reactions").select("post_id, kind").eq("member_id", member.id).eq("topic_id", topicId),
    ctx.sb.from("board_subscriptions").select("id").eq("topic_id", topicId).eq("member_id", member.id).maybeSingle(),
  ]);

  const mine = new Map();
  let topicReaction = null;
  for (const r of reactionsRes.data || []) {
    if (r.post_id) mine.set(r.post_id, r.kind);
    else topicReaction = r.kind;
  }

  const rows = postsRes.data || [];
  const visible = (p) =>
    !p.deleted_at && (p.status === "published" || (p.status === "pending" && p.author_member_id === member.id));
  const children = new Map();
  for (const p of rows) {
    if (!p.parent_post_id) continue;
    if (!children.has(p.parent_post_id)) children.set(p.parent_post_id, []);
    children.get(p.parent_post_id).push(p);
  }
  const posts = rows
    .filter((p) => !p.parent_post_id)
    .map((p) => {
      const replies = (children.get(p.id) || []).filter(visible).map((c) => postView(ctx, c, topic, mine.get(c.id)));
      if (visible(p)) return { ...postView(ctx, p, topic, mine.get(p.id)), replies };
      if (!replies.length) return null;
      return {
        id: p.id,
        parentPostId: null,
        body: "",
        removed: true,
        author: { name: "", kind: "member", isMe: false },
        createdAt: p.created_at,
        reactions: {},
        score: 0,
        replies,
      };
    })
    .filter(Boolean);
  // Q&A boards rank answers: the accepted one first, then by upvotes; discussions stay chronological.
  if (board.format === "qa") {
    posts.sort((a, b) => Number(Boolean(b.accepted)) - Number(Boolean(a.accepted)) || (b.score || 0) - (a.score || 0));
  }

  // Mark the topic read, count the view and clear its notifications.
  await Promise.all([
    upsertRead(ctx, { projectId: board.project_id, kind: "topic", targetId: topicId }),
    ctx.sb.rpc("board_topic_viewed", { p_topic_id: topicId }),
    ctx.sb
      .from("board_notifications")
      .update({ read_at: nowIso() })
      .eq("member_id", member.id)
      .eq("topic_id", topicId)
      .is("read_at", null),
  ]);

  const banned = ctx.bannedProjects.has(board.project_id);
  const settings = settingsFor(ctx, board.project_id);
  return {
    board: boardView(ctx, board),
    topic: topicView(ctx, topic, board, { myReaction: topicReaction, subscribed: Boolean(subRes.data) }),
    posts,
    canReply: !banned && !topic.locked && topic.status === "published",
    banned,
    editWindowMinutes: settings.editWindowMinutes,
  };
}

// --- writes -----------------------------------------------------------------------------------------------------

function cleanText(value, max) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

// Banned words: 'block' rejects, 'hold' sends the post to the moderation queue.
function moderate(settings, text) {
  const hits = findBannedWords(text, settings.bannedWords);
  if (!hits.length) return { held: false };
  if (settings.bannedWordAction === "block") return { error: "blocked_words" };
  return { held: true };
}

export async function createMemberTopic(member, boardId, input = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const board = ctx.boardById.get(boardId);
  if (!board) return { error: "not_found" };
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  if (board.posting_policy === "moderators_only") return { error: "moderators_only" };

  const title = cleanText(input.title, LIMITS.title);
  const body = cleanText(input.body, LIMITS.body);
  if (title.length < 3) return { error: "bad_request", message: "Give your topic a title." };
  if (!body) return { error: "bad_request", message: "Write something to start the conversation." };

  const settings = settingsFor(ctx, board.project_id);
  const mod = moderate(settings, `${title}\n${body}`);
  if (mod.error) return mod;
  const status = board.require_approval || mod.held ? "pending" : "published";

  const { data, error } = await ctx.sb
    .from("board_topics")
    .insert({
      project_id: board.project_id,
      board_id: board.id,
      author_kind: "member",
      author_member_id: member.id,
      author_name: displayName(member),
      author_email: member.email,
      title,
      body,
      tags: normalizeTags(input.tags),
      status,
    })
    .select(TOPIC_COLUMNS)
    .single();
  if (error) {
    console.error("[portal.boards.createTopic]", error.message);
    return { error: "failed" };
  }
  await upsertRead(ctx, { projectId: board.project_id, kind: "topic", targetId: data.id });
  return { topic: topicView(ctx, data, board), pending: status === "pending" };
}

export async function updateMemberTopic(member, topicId, input = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { topic, board } = found;
  if (topic.author_member_id !== member.id) return { error: "forbidden" };
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  const settings = settingsFor(ctx, board.project_id);
  if (!withinEditWindow(topic.created_at, settings.editWindowMinutes)) return { error: "edit_window" };

  const title = cleanText(input.title ?? topic.title, LIMITS.title);
  const body = cleanText(input.body ?? topic.body, LIMITS.body);
  if (title.length < 3 || !body) return { error: "bad_request", message: "A topic needs a title and a message." };
  const mod = moderate(settings, `${title}\n${body}`);
  if (mod.error) return mod;

  const patch = { title, body, edited_at: nowIso() };
  if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
  if (mod.held) patch.status = "pending";
  const { data, error } = await ctx.sb.from("board_topics").update(patch).eq("id", topicId).select(TOPIC_COLUMNS).single();
  if (error) {
    console.error("[portal.boards.updateTopic]", error.message);
    return { error: "failed" };
  }
  return { topic: topicView(ctx, data, board), pending: data.status === "pending" };
}

export async function deleteMemberTopic(member, topicId) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { topic, board } = found;
  if (topic.author_member_id !== member.id) return { error: "forbidden" };
  if (!withinEditWindow(topic.created_at, settingsFor(ctx, board.project_id).editWindowMinutes)) {
    return { error: "edit_window" };
  }
  const { error } = await ctx.sb.from("board_topics").update({ deleted_at: nowIso() }).eq("id", topicId);
  if (error) {
    console.error("[portal.boards.deleteTopic]", error.message);
    return { error: "failed" };
  }
  return { ok: true };
}

export async function createMemberPost(member, topicId, input = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { topic, board } = found;
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  if (topic.locked) return { error: "locked" };
  if (topic.status !== "published") return { error: "forbidden" };

  const body = cleanText(input.body, LIMITS.body);
  if (!body) return { error: "bad_request", message: "Write a reply first." };
  const settings = settingsFor(ctx, board.project_id);
  const mod = moderate(settings, body);
  if (mod.error) return mod;

  let parentId = input.parentPostId || null;
  if (parentId) {
    const { data: parent } = await ctx.sb
      .from("board_posts")
      .select("id, topic_id, deleted_at")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.topic_id !== topicId) parentId = null;
  }

  const { data, error } = await ctx.sb
    .from("board_posts")
    .insert({
      project_id: board.project_id,
      topic_id: topicId,
      parent_post_id: parentId,
      author_kind: "member",
      author_member_id: member.id,
      author_name: displayName(member),
      author_email: member.email,
      body,
      status: mod.held ? "pending" : "published",
    })
    .select(POST_COLUMNS)
    .single();
  if (error) {
    console.error("[portal.boards.createPost]", error.message);
    return { error: "failed" };
  }

  const followUps = [upsertRead(ctx, { projectId: board.project_id, kind: "topic", targetId: topicId })];
  if (settings.autoSubscribe) {
    followUps.push(
      ctx.sb
        .from("board_subscriptions")
        .upsert(
          { project_id: board.project_id, topic_id: topicId, member_id: member.id },
          { onConflict: "topic_id,member_id", ignoreDuplicates: true },
        ),
    );
  }
  await Promise.all(followUps);
  return { post: { ...postView(ctx, data, topic, null), replies: [] }, pending: data.status === "pending" };
}

async function loadOwnPost(ctx, postId) {
  const { data: post } = await ctx.sb.from("board_posts").select(POST_COLUMNS).eq("id", postId).is("deleted_at", null).maybeSingle();
  if (!post) return null;
  const found = await loadTopicFor(ctx, post.topic_id);
  if (!found) return null;
  return { post, ...found };
}

export async function updateMemberPost(member, postId, input = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadOwnPost(ctx, postId);
  if (!found) return { error: "not_found" };
  const { post, topic, board } = found;
  if (post.author_member_id !== member.id) return { error: "forbidden" };
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  const settings = settingsFor(ctx, board.project_id);
  if (!withinEditWindow(post.created_at, settings.editWindowMinutes)) return { error: "edit_window" };

  const body = cleanText(input.body, LIMITS.body);
  if (!body) return { error: "bad_request", message: "A reply can't be empty." };
  const mod = moderate(settings, body);
  if (mod.error) return mod;

  const patch = { body, edited_at: nowIso() };
  if (mod.held) patch.status = "pending";
  const { data, error } = await ctx.sb.from("board_posts").update(patch).eq("id", postId).select(POST_COLUMNS).single();
  if (error) {
    console.error("[portal.boards.updatePost]", error.message);
    return { error: "failed" };
  }
  return { post: postView(ctx, data, topic, null), pending: data.status === "pending" };
}

export async function deleteMemberPost(member, postId) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadOwnPost(ctx, postId);
  if (!found) return { error: "not_found" };
  const { post, topic, board } = found;
  if (post.author_member_id !== member.id) return { error: "forbidden" };
  if (!withinEditWindow(post.created_at, settingsFor(ctx, board.project_id).editWindowMinutes)) {
    return { error: "edit_window" };
  }
  const { error } = await ctx.sb.from("board_posts").update({ deleted_at: nowIso() }).eq("id", postId);
  if (error) {
    console.error("[portal.boards.deletePost]", error.message);
    return { error: "failed" };
  }
  if (topic.accepted_post_id === postId) {
    await ctx.sb.from("board_topics").update({ accepted_post_id: null }).eq("id", topic.id);
  }
  return { ok: true };
}

// Toggle a reaction: same kind again removes it, a different kind swaps it.
export async function toggleMemberReaction(member, { topicId, postId = null, kind = null } = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { board } = found;
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  if (postId) {
    const { data: post } = await ctx.sb
      .from("board_posts")
      .select("id, topic_id, status, deleted_at")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.topic_id !== topicId || post.deleted_at || post.status !== "published") return { error: "not_found" };
  }
  const want = /^[a-z_]{2,24}$/.test(String(kind || "")) ? kind : reactionKindFor(board.format);

  let existingQuery = ctx.sb.from("board_reactions").select("id, kind").eq("member_id", member.id).eq("topic_id", topicId);
  existingQuery = postId ? existingQuery.eq("post_id", postId) : existingQuery.is("post_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  let result;
  if (existing && existing.kind === want) {
    result = await ctx.sb.from("board_reactions").delete().eq("id", existing.id);
  } else if (existing) {
    result = await ctx.sb.from("board_reactions").update({ kind: want }).eq("id", existing.id);
  } else {
    result = await ctx.sb
      .from("board_reactions")
      .insert({ project_id: board.project_id, topic_id: topicId, post_id: postId, member_id: member.id, kind: want });
  }
  if (result.error && result.error.code !== "23505") {
    console.error("[portal.boards.react]", result.error.message);
    return { error: "failed" };
  }

  const { data: target } = await ctx.sb
    .from(postId ? "board_posts" : "board_topics")
    .select("reaction_counts, score")
    .eq("id", postId || topicId)
    .maybeSingle();
  return {
    reactions: asObject(target?.reaction_counts),
    score: target?.score ?? 0,
    myReaction: existing && existing.kind === want ? null : want,
  };
}

export async function reportMemberContent(member, { topicId, postId = null, reason, details } = {}) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  // The DB trigger re-derives the topic from the post, so the post must belong to this (visible) topic.
  if (postId) {
    const { data: post } = await ctx.sb.from("board_posts").select("topic_id").eq("id", postId).maybeSingle();
    if (!post || post.topic_id !== topicId) return { error: "not_found" };
  }
  const { error } = await ctx.sb.from("board_reports").insert({
    project_id: found.board.project_id,
    topic_id: topicId,
    post_id: postId || null,
    reporter_member_id: member.id,
    reporter_name: displayName(member),
    reason: REPORT_REASONS.some((r) => r.value === reason) ? reason : "other",
    details: cleanText(details, LIMITS.reportDetails),
  });
  if (error && error.code !== "23505") {
    console.error("[portal.boards.report]", error.message);
    return { error: error.code === "P0001" ? "not_found" : "failed" };
  }
  return { ok: true };
}

export async function setMemberSubscription(member, topicId, on) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const res = on
    ? await ctx.sb
        .from("board_subscriptions")
        .upsert(
          { project_id: found.board.project_id, topic_id: topicId, member_id: member.id },
          { onConflict: "topic_id,member_id", ignoreDuplicates: true },
        )
    : await ctx.sb.from("board_subscriptions").delete().eq("topic_id", topicId).eq("member_id", member.id);
  if (res.error) {
    console.error("[portal.boards.subscribe]", res.error.message);
    return { error: "failed" };
  }
  return { subscribed: Boolean(on) };
}

export async function acceptMemberAnswer(member, topicId, postId) {
  const ctx = await loadContext(member);
  if (ctx.error) return ctx;
  const found = await loadTopicFor(ctx, topicId);
  if (!found) return { error: "not_found" };
  const { topic, board } = found;
  if (board.format !== "qa" || topic.author_member_id !== member.id) return { error: "forbidden" };
  if (ctx.bannedProjects.has(board.project_id)) return { error: "banned" };
  if (postId) {
    const { data: post } = await ctx.sb
      .from("board_posts")
      .select("id, topic_id, status, deleted_at")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.topic_id !== topicId || post.deleted_at || post.status !== "published") return { error: "not_found" };
  }
  const next = postId && topic.accepted_post_id !== postId ? postId : null;
  const { error } = await ctx.sb.from("board_topics").update({ accepted_post_id: next }).eq("id", topicId);
  if (error) {
    console.error("[portal.boards.accept]", error.message);
    return { error: "failed" };
  }
  return { acceptedPostId: next };
}

export async function setMemberBoardEmail(member, value) {
  const sb = adminClient();
  if (!sb) return { error: "unavailable" };
  const metadata = { ...(member.metadata || {}) };
  if (typeof value === "boolean") metadata.boardEmail = value;
  else delete metadata.boardEmail;
  const { error } = await sb.from("portal_members").update({ metadata }).eq("id", member.id);
  if (error) {
    console.error("[portal.boards.prefs]", error.message);
    return { error: "failed" };
  }
  return { prefs: { boardEmail: typeof value === "boolean" ? value : null } };
}

// --- notifications ----------------------------------------------------------------------------------------------

function notificationTitle(n) {
  const topic = n.title ? `"${n.title}"` : "a topic";
  const who = n.actor_name || "Someone";
  if (n.kind === "topic_reply") return `${who} replied to your topic ${topic}`;
  if (n.kind === "post_reply") return `${who} replied to you in ${topic}`;
  if (n.kind === "accepted") return `Your reply was accepted as the answer in ${topic}`;
  return `New reply in ${topic}`;
}

// Board notifications for the portal feed (merged into lib/portal/notifications.js).
export async function listBoardNotifications(memberId, seenAt) {
  const sb = adminClient();
  if (!sb || !memberId) return [];
  const { data, error } = await sb
    .from("board_notifications")
    .select("id, kind, actor_name, title, body, board_id, topic_id, read_at, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    // Table may not exist yet on an un-migrated database; the feed still works without it.
    if (!MISSING_TABLE.has(error.code)) console.error("[portal.boards.notifications]", error.message);
    return [];
  }
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  return (data || []).map((n) => ({
    id: `board:${n.id}`,
    kind: "board",
    title: notificationTitle(n),
    body: excerpt(n.body, 220),
    channel: "Discussions",
    createdAt: n.created_at,
    unread: !n.read_at && new Date(n.created_at).getTime() > seen,
    link: { tab: "discussions", topicId: n.topic_id, boardId: n.board_id },
  }));
}

// Same feed keyed by email, for lib/portal/notifications.js which only knows the member's email.
export async function listBoardNotificationsForEmail(email, seenAt) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data } = await sb.from("portal_members").select("id").ilike("email", emailPattern(email)).limit(1);
  return data?.[0]?.id ? listBoardNotifications(data[0].id, seenAt) : [];
}

function publicBase(origin) {
  const configured = process.env.GEIGER_OPERATIONS_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return origin ? `${origin}${basePath}` : "";
}

const EMAIL_SUBJECT = {
  topic_reply: (t) => `New reply to your topic: ${t}`,
  post_reply: (t) => `Someone replied to you in: ${t}`,
  subscribed: (t) => `New reply in: ${t}`,
};

// Send queued reply emails (email_status = 'pending'), claiming each row first so concurrent runs never double-send.
export async function deliverBoardEmails({ topicId = null, postId = null, origin = "", limit = 40 } = {}) {
  const sb = adminClient();
  if (!sb) return { sent: 0, failed: 0 };
  let pendingQuery = sb
    .from("board_notifications")
    .select("id")
    .eq("email_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (postId) pendingQuery = pendingQuery.eq("post_id", postId);
  else if (topicId) pendingQuery = pendingQuery.eq("topic_id", topicId);
  const { data: pending, error } = await pendingQuery;
  if (error || !pending?.length) {
    if (error && !MISSING_TABLE.has(error.code)) console.error("[portal.boards.deliver]", error.message);
    return { sent: 0, failed: 0 };
  }

  const { data: claimed } = await sb
    .from("board_notifications")
    .update({ email_status: "sending" })
    .in("id", pending.map((p) => p.id))
    .eq("email_status", "pending")
    .select("*");
  if (!claimed?.length) return { sent: 0, failed: 0 };

  const memberIds = [...new Set(claimed.map((n) => n.member_id))];
  const boardIds = [...new Set(claimed.map((n) => n.board_id).filter(Boolean))];
  const [{ data: members }, { data: boards }] = await Promise.all([
    sb.from("portal_members").select("id, email, name").in("id", memberIds),
    boardIds.length ? sb.from("boards").select("id, name").in("id", boardIds) : Promise.resolve({ data: [] }),
  ]);
  const memberById = new Map((members || []).map((m) => [m.id, m]));
  const boardName = new Map((boards || []).map((b) => [b.id, b.name]));
  const base = publicBase(origin);

  let sent = 0;
  let failed = 0;
  for (const n of claimed) {
    const to = memberById.get(n.member_id);
    let status = "skipped";
    if (to?.email) {
      const subject = (EMAIL_SUBJECT[n.kind] || EMAIL_SUBJECT.subscribed)(n.title || "a discussion");
      const data = {
        recipientName: String(to.name || "").split(/\s+/)[0] || "there",
        actorName: n.actor_name || "Someone",
        topicTitle: n.title || "",
        boardName: boardName.get(n.board_id) || "",
        excerpt: excerpt(n.body, 280),
        headline: notificationTitle(n),
        topicUrl: base && n.topic_id ? `${base}/members?topic=${n.topic_id}` : "",
      };
      // Pre-rendered html so delivery doesn't depend on a suite template; the template key is the log label.
      const res = await sendNotificationEmail({
        projectId: n.project_id,
        notification: "portal_board_reply",
        template: "events.portal_board_reply",
        to: to.email,
        subject,
        data,
        html: boardReplyEmailHtml(data),
      });
      status = res.ok ? "sent" : res.skipped ? "skipped" : "failed";
    }
    if (status === "sent") sent += 1;
    if (status === "failed") failed += 1;
    await sb
      .from("board_notifications")
      .update({ email_status: status, emailed_at: status === "sent" ? nowIso() : null })
      .eq("id", n.id);
  }
  return { sent, failed };
}
