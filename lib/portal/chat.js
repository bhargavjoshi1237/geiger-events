import { adminClient } from "@/lib/supabase/admin";
import { togglePollVote } from "@/lib/chat/poll";

// Server-only member-side data layer for Community chat. All access is via the
// service role and strictly scoped to the session member's id — a member only
// ever touches channels they participate in. The buyer identity is denormalized
// onto messages (author_name) so nothing here leaks other members' records.
// Mirrors the organiser layer's view-model shapes (lib/supabase/chat.js).

const CHANNELS = "chat_channels";
const PARTICIPANTS = "chat_participants";
const MESSAGES = "chat_messages";

function mapMessage(row) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    channelId: row.channel_id,
    authorKey: row.author_user_id
      ? `u:${row.author_user_id}`
      : row.author_member_id
        ? `m:${row.author_member_id}`
        : "system",
    authorName: row.author_name || (row.sender_kind === "system" ? "" : "Someone"),
    senderKind: row.sender_kind || "member",
    text: row.body || "",
    reactions: meta.reactions && typeof meta.reactions === "object" ? meta.reactions : {},
    replyTo: meta.replyTo || null,
    type: meta.type || "text",
    poll: meta.poll || null,
    deleted: Boolean(row.deleted_at),
    createdAt: row.created_at,
  };
}

function mapChannel(row, extra = {}) {
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    kind: row.kind || "event",
    name: row.name || "Event chat",
    topic: row.topic || "",
    postingMode: row.posting_mode || "announce",
    status: row.status || "active",
    unread: 0,
    lastMessageAt: null,
    lastPreview: "",
    ...extra,
  };
}

// Resolve the member's participant row for a channel (ownership gate).
async function participantFor(sb, memberId, channelId) {
  const { data } = await sb
    .from(PARTICIPANTS)
    .select("id, muted, last_read_at")
    .eq("channel_id", channelId)
    .eq("member_id", memberId)
    .maybeSingle();
  return data || null;
}

export async function listMemberChannels(memberId, { kind = null } = {}) {
  const sb = adminClient();
  if (!sb || !memberId) return [];
  const { data: parts, error } = await sb
    .from(PARTICIPANTS)
    .select("channel_id, last_read_at")
    .eq("member_id", memberId);
  if (error) {
    console.error("[portal.chat.list]", error.message);
    return [];
  }
  const rows = parts || [];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.channel_id);
  const readBy = Object.fromEntries(rows.map((r) => [r.channel_id, r.last_read_at]));

  let channelsQuery = sb
    .from(CHANNELS)
    .select("*")
    .in("id", ids)
    .eq("status", "active")
    .is("deleted_at", null);
  if (kind) channelsQuery = channelsQuery.eq("kind", kind);
  const { data: channels } = await channelsQuery;

  // Latest message + unread per channel.
  const { data: msgs } = await sb
    .from(MESSAGES)
    .select("channel_id, body, author_member_id, created_at")
    .in("channel_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const last = {};
  const unread = {};
  const msgCount = {};
  for (const m of msgs || []) {
    if (!(m.channel_id in last)) last[m.channel_id] = m;
    msgCount[m.channel_id] = (msgCount[m.channel_id] || 0) + 1;
    const readAt = readBy[m.channel_id];
    const isOwn = m.author_member_id === memberId;
    if (!isOwn && (!readAt || new Date(m.created_at) > new Date(readAt))) {
      unread[m.channel_id] = (unread[m.channel_id] || 0) + 1;
    }
  }

  // Attendee counts (members only — exclude organiser rows) for the thread cards.
  const memberCount = {};
  const { data: parts2 } = await sb
    .from(PARTICIPANTS)
    .select("channel_id, member_id")
    .in("channel_id", ids);
  for (const p of parts2 || []) {
    if (p.member_id) memberCount[p.channel_id] = (memberCount[p.channel_id] || 0) + 1;
  }

  return (channels || [])
    .map((c) =>
      mapChannel(c, {
        unread: unread[c.id] || 0,
        lastMessageAt: last[c.id]?.created_at || c.created_at,
        lastPreview: last[c.id]?.body || "",
        participantCount: memberCount[c.id] || 0,
        messageCount: msgCount[c.id] || 0,
      }),
    )
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

export async function getMemberChannel(memberId, channelId) {
  const sb = adminClient();
  if (!sb || !memberId || !channelId) return null;
  const part = await participantFor(sb, memberId, channelId);
  if (!part) return null; // not a participant

  const { data: channel } = await sb
    .from(CHANNELS)
    .select("*")
    .eq("id", channelId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!channel) return null;

  const { data: messages } = await sb
    .from(MESSAGES)
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(300);

  // Opening the channel clears unread for this member.
  await sb
    .from(PARTICIPANTS)
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", part.id);

  return {
    ...mapChannel(channel),
    muted: Boolean(part.muted),
    canPost: channel.posting_mode === "open" && !part.muted,
    messages: (messages || []).map(mapMessage),
  };
}

export async function postMemberMessage(memberId, memberName, channelId, { body, replyTo = null }) {
  const sb = adminClient();
  if (!sb || !memberId || !channelId || !body?.trim()) return { error: "bad_request" };
  const part = await participantFor(sb, memberId, channelId);
  if (!part) return { error: "forbidden" };
  if (part.muted) return { error: "muted" };

  const { data: channel } = await sb
    .from(CHANNELS)
    .select("posting_mode, status")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel || channel.status !== "active") return { error: "unavailable" };
  if (channel.posting_mode !== "open") return { error: "announce_only" };

  const { data, error } = await sb
    .from(MESSAGES)
    .insert({
      channel_id: channelId,
      author_member_id: memberId,
      sender_kind: "member",
      author_name: memberName || "Attendee",
      body: body.trim().slice(0, 4000),
      metadata: replyTo ? { replyTo } : {},
    })
    .select("*")
    .single();
  if (error) {
    console.error("[portal.chat.post]", error.message);
    return { error: "failed" };
  }
  // Keep the member's own read cursor current.
  await sb
    .from(PARTICIPANTS)
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", part.id);
  return { message: mapMessage(data) };
}

export async function toggleMemberReaction(memberId, channelId, messageId, emojiKey) {
  const sb = adminClient();
  if (!sb || !memberId || !channelId || !messageId || !emojiKey) return { error: "bad_request" };
  const part = await participantFor(sb, memberId, channelId);
  if (!part) return { error: "forbidden" };

  const { data: row } = await sb
    .from(MESSAGES)
    .select("metadata, channel_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!row || row.channel_id !== channelId) return { error: "not_found" };

  const meta = row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {};
  const reactions = { ...(meta.reactions || {}) };
  const key = `m:${memberId}`;
  const set = new Set(reactions[emojiKey] || []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  if (set.size) reactions[emojiKey] = [...set];
  else delete reactions[emojiKey];
  meta.reactions = reactions;

  const { data, error } = await sb
    .from(MESSAGES)
    .update({ metadata: meta })
    .eq("id", messageId)
    .select("*")
    .single();
  if (error) {
    console.error("[portal.chat.react]", error.message);
    return { error: "failed" };
  }
  return { message: mapMessage(data) };
}

export async function voteMemberPoll(memberId, channelId, messageId, optionId) {
  const sb = adminClient();
  if (!sb || !memberId || !channelId || !messageId || !optionId) return { error: "bad_request" };
  const part = await participantFor(sb, memberId, channelId);
  if (!part) return { error: "forbidden" };

  const { data: row } = await sb
    .from(MESSAGES)
    .select("metadata, channel_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!row || row.channel_id !== channelId || !row.metadata?.poll) return { error: "not_found" };

  const meta = { ...row.metadata, poll: togglePollVote(row.metadata.poll, optionId, `m:${memberId}`) };
  const { data, error } = await sb
    .from(MESSAGES)
    .update({ metadata: meta })
    .eq("id", messageId)
    .select("*")
    .single();
  if (error) {
    console.error("[portal.chat.vote]", error.message);
    return { error: "failed" };
  }
  return { message: mapMessage(data) };
}

export async function markMemberRead(memberId, channelId) {
  const sb = adminClient();
  if (!sb || !memberId || !channelId) return false;
  const part = await participantFor(sb, memberId, channelId);
  if (!part) return false;
  const { error } = await sb
    .from(PARTICIPANTS)
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", part.id);
  return !error;
}
