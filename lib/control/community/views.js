import { ApiError } from "../../staff_access/errors.js";

// Community moderation for Control: view models that match the dashboard's normalizers, and validated request bodies.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);

function invalid(message) {
  return new ApiError("invalid_input", 400, message);
}

// --- chat (event chats and Q&A threads) ---------------------------------------------------------

export const CHANNEL_KINDS = ["event", "qa"];

export function channelView(row, extra = {}) {
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    kind: row.kind || "event",
    name: row.name || "Event chat",
    topic: row.topic || "",
    postingMode: row.posting_mode === "open" ? "open" : "announce",
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.created_at ?? null,
    eventName: "",
    lastPreview: "",
    lastMessageAt: row.created_at ?? null,
    participantCount: 0,
    messageCount: 0,
    ...extra,
  };
}

// The same shape the attendee app's MessageBubble already renders.
export function chatMessageView(row) {
  const meta = obj(row.metadata);
  return {
    id: row.id,
    channelId: row.channel_id,
    authorKey: row.author_user_id ? `u:${row.author_user_id}` : row.author_member_id ? `m:${row.author_member_id}` : "system",
    authorName: row.author_name || (row.sender_kind === "system" ? "" : "Someone"),
    senderKind: row.sender_kind || "member",
    text: row.deleted_at ? "" : row.body || "",
    reactions: obj(meta.reactions),
    replyTo: meta.replyTo || null,
    type: meta.type || "text",
    poll: meta.poll || null,
    deleted: Boolean(row.deleted_at),
    createdAt: row.created_at ?? null,
  };
}

// Attendees only, as the dashboard lists them; organiser rows aren't moderated.
export function participantView(row) {
  return { id: row.id, memberId: row.member_id ?? null, muted: Boolean(row.muted), joinedAt: row.joined_at ?? null };
}

// Last-message preview, message and attendee counts per channel, newest activity first.
export function summarizeChannels(rows, messages, participants, eventNames) {
  const previews = new Map();
  const counts = new Map();
  for (const m of messages) {
    counts.set(m.channel_id, (counts.get(m.channel_id) || 0) + 1);
    if (!previews.has(m.channel_id)) previews.set(m.channel_id, m);
  }
  const people = new Map();
  for (const p of participants) if (p.member_id) people.set(p.channel_id, (people.get(p.channel_id) || 0) + 1);
  return rows
    .map((row) => {
      const last = previews.get(row.id);
      return channelView(row, {
        eventName: (row.event_id && eventNames.get(row.event_id)) || "",
        lastPreview: last?.body || "",
        lastMessageAt: last?.created_at || row.created_at || null,
        participantCount: people.get(row.id) || 0,
        messageCount: counts.get(row.id) || 0,
      });
    })
    .sort((a, b) => String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")));
}

export function parseChatBody(body) {
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) throw invalid("Write a message first.");
  return text.slice(0, 4000);
}

export function parseChannelPatch(body) {
  const patch = {};
  if (body && "postingMode" in body) {
    if (!["open", "announce"].includes(body.postingMode)) throw invalid("Posting must be open or announce-only.");
    patch.posting_mode = body.postingMode;
  }
  if (body && "status" in body) {
    if (!["active", "archived"].includes(body.status)) throw invalid("A chat is either active or archived.");
    patch.status = body.status;
  }
  if (body && "topic" in body) patch.topic = String(body.topic ?? "").slice(0, 500);
  if (!Object.keys(patch).length) throw invalid("Send something to change.");
  return patch;
}

// A Q&A thread for everyone holding a ticket to the event; targeted audiences are set up on the dashboard.
export function parseQaThread(body) {
  const eventId = typeof body?.eventId === "string" && UUID.test(body.eventId) ? body.eventId : null;
  if (!eventId) throw invalid("Pick the event this thread belongs to.");
  const name = String(body?.name ?? "").trim();
  if (!name) throw invalid("Give the thread a name.");
  return {
    eventId,
    name: name.slice(0, 120),
    topic: String(body?.topic ?? "").trim().slice(0, 500),
    postingMode: body?.postingMode === "announce" ? "announce" : "open",
  };
}

// --- discussion boards --------------------------------------------------------------------------

export const TOPIC_STATUSES = ["published", "pending", "hidden"];
export const REPORT_RESOLUTIONS = ["actioned", "dismissed"];
const BODY_LIMIT = 10000;

export function boardView(row) {
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    name: row.name ?? "Untitled board",
    description: row.description ?? "",
    format: row.format || "discussion",
    requireApproval: Boolean(row.require_approval),
    archived: Boolean(row.archived),
    topicCount: row.topic_count ?? 0,
    postCount: row.post_count ?? 0,
    lastActivityAt: row.last_activity_at ?? null,
  };
}

export function topicView(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    authorKind: row.author_kind || "member",
    authorMemberId: row.author_member_id ?? null,
    authorName: row.author_name || (row.author_kind === "organiser" ? "Organiser" : "Member"),
    title: row.title || "Untitled topic",
    body: row.body ?? "",
    tags: arr(row.tags),
    pinned: Boolean(row.pinned),
    locked: Boolean(row.locked),
    status: TOPIC_STATUSES.includes(row.status) ? row.status : "published",
    replyCount: row.reply_count ?? 0,
    acceptedPostId: row.accepted_post_id ?? null,
    lastActivityAt: row.last_activity_at ?? row.created_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function postView(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    parentPostId: row.parent_post_id ?? null,
    authorKind: row.author_kind || "member",
    authorName: row.author_name || (row.author_kind === "organiser" ? "Organiser" : "Member"),
    body: row.body ?? "",
    status: TOPIC_STATUSES.includes(row.status) ? row.status : "published",
    createdAt: row.created_at ?? null,
    topic: row.topic ? topicView(row.topic) : null,
  };
}

export function reportView(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    postId: row.post_id ?? null,
    reporterName: row.reporter_name || "Member",
    reason: row.reason || "other",
    details: row.details ?? "",
    status: row.status || "open",
    createdAt: row.created_at ?? null,
    topic: row.topic ? topicView(row.topic) : null,
    post: row.post ? postView(row.post) : null,
  };
}

// Pinned/locked/hidden/approved and the accepted answer, exactly the topic actions the dashboard drawer offers.
export function parseTopicPatch(body) {
  const patch = {};
  if (body && "pinned" in body) {
    if (typeof body.pinned !== "boolean") throw invalid("Pinned must be on or off.");
    patch.pinned = body.pinned;
  }
  if (body && "locked" in body) {
    if (typeof body.locked !== "boolean") throw invalid("Locked must be on or off.");
    patch.locked = body.locked;
  }
  if (body && "status" in body) {
    if (!["published", "hidden"].includes(body.status)) throw invalid("A topic can be published or hidden.");
    patch.status = body.status;
  }
  if (body && "acceptedPostId" in body) {
    const id = body.acceptedPostId;
    if (id !== null && !(typeof id === "string" && UUID.test(id))) throw invalid("Pick a reply to mark as the answer.");
    patch.accepted_post_id = id;
  }
  if (!Object.keys(patch).length) throw invalid("Send something to change.");
  return patch;
}

export function parsePostStatus(body) {
  if (!["published", "hidden"].includes(body?.status)) throw invalid("A reply can be published or hidden.");
  return body.status;
}

export function parseReply(body) {
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) throw invalid("Write a reply first.");
  const parentPostId = typeof body?.parentPostId === "string" && UUID.test(body.parentPostId) ? body.parentPostId : null;
  return { body: text.slice(0, BODY_LIMIT), parentPostId };
}

export function parseReportResolve(body) {
  const ids = arr(body?.ids).filter((id) => typeof id === "string" && UUID.test(id));
  if (!ids.length || ids.length > 100) throw invalid("Pick the reports to resolve.");
  if (!REPORT_RESOLUTIONS.includes(body?.status)) throw invalid("Reports are actioned or dismissed.");
  return { ids, status: body.status };
}

// --- meeting scheduler --------------------------------------------------------------------------

export const MEETING_STATUSES = ["scheduled", "completed", "no_show", "cancelled"];

// Ticket holders first, then meeting profiles over them — the dashboard's buildPeople.
export function buildPeople(attendees, profiles) {
  const people = new Map();
  for (const a of arr(attendees)) {
    people.set(a.member_id, { name: a.name || String(a.email || "").split("@")[0] || "Attendee", email: a.email || "" });
  }
  for (const p of arr(profiles)) {
    const cur = people.get(p.member_id);
    people.set(p.member_id, {
      name: p.display_name || cur?.name || String(p.email || "").split("@")[0] || "Attendee",
      email: cur?.email || p.email || "",
    });
  }
  return people;
}

const nameOf = (people, id) => people.get(id)?.name || "Former attendee";

export function meetingView(row, people) {
  const participants = arr(row.participants);
  return {
    id: row.id,
    people: participants.map((id) => nameOf(people, id)),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    locationName: row.location_name ?? "",
    status: MEETING_STATUSES.includes(row.status) ? row.status : "scheduled",
    notes: row.notes ?? "",
    cancelReason: row.cancel_reason ?? "",
    cancelledBy: row.cancelled_by ?? null,
  };
}

export function requestView(row, people) {
  return {
    id: row.id,
    from: nameOf(people, row.from_member),
    to: nameOf(people, row.to_member),
    message: row.message ?? "",
    status: row.status ?? "pending",
    proposedSlots: arr(row.proposed_slots).length,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// Status and notes; cancelling records that the organiser did it, as the dashboard's updateMeeting does.
export function parseMeetingPatch(body) {
  const row = {};
  if (body && "status" in body) {
    if (!MEETING_STATUSES.includes(body.status)) throw invalid("That isn't a meeting status.");
    row.status = body.status;
    if (body.status === "cancelled") {
      row.cancelled_by = "organiser";
      row.cancel_reason = String(body.cancelReason ?? "").trim().slice(0, 500);
    }
  }
  if (body && "notes" in body) row.notes = String(body.notes ?? "").slice(0, 2000);
  if (!Object.keys(row).length) throw invalid("Send something to change.");
  return row;
}

// --- identity -----------------------------------------------------------------------------------

// How an organiser post is signed: the account's name, else the email's local part, as the dashboard's getUser does.
export function organiserName(claims) {
  const meta = obj(claims?.user_metadata);
  const email = typeof claims?.email === "string" ? claims.email : "";
  return String(meta.full_name || meta.name || email.split("@")[0] || "Organiser").slice(0, 120);
}

export function tokenClaims(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}
