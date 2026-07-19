"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { getUser } from "./user";
import { buildPoll, togglePollVote } from "@/lib/chat/poll";
import { normalizeSpec, resolveAudienceEmails } from "@/lib/audience/resolve";

// Organiser-side data layer for Community chat (events.chat_channels /
// chat_participants / chat_messages). The dashboard reads/writes through the
// authenticated, RLS-gated events-schema client. Members use separate
// service-role portal routes; this file is organiser-only. Pure: validate,
// console.error on failure, return null / false / []; the screen owns UX.
//
// Reactions live in message metadata as { emojiKey: [actorKey] }; an actorKey is
// "u:<userId>" for an organiser and "m:<memberId>" for a member, so counts are
// unique across the two identity kinds.

const CHANNELS = "chat_channels";
const PARTICIPANTS = "chat_participants";
const MESSAGES = "chat_messages";

export function normalizeMessage(row) {
  if (!row) return null;
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

export function normalizeChannel(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id,
    eventId: row.event_id ?? null,
    kind: row.kind || "event",
    name: row.name || "Event chat",
    topic: row.topic || "",
    postingMode: row.posting_mode || "announce",
    status: row.status || "active",
    audience: meta.audience === "selected" ? "selected" : "all",
    // Live audience rule (see lib/audience/resolve.js). Migrates the legacy
    // metadata.audience string when no richer spec was stored.
    audienceSpec: normalizeSpec(meta.audienceSpec ?? meta.audience, {
      fallbackEventId: row.event_id,
    }),
    createdAt: row.created_at,
  };
}

export function normalizeParticipant(row) {
  if (!row) return null;
  return {
    id: row.id,
    channelId: row.channel_id,
    memberId: row.member_id ?? null,
    userId: row.user_id ?? null,
    role: row.role || "member",
    muted: Boolean(row.muted),
    lastReadAt: row.last_read_at ?? null,
    joinedAt: row.joined_at ?? null,
  };
}

// Ensure the event's channel exists (creating it with the chosen posting mode on
// first call) and back-fill existing buyers. Returns the channel view model.
export async function ensureEventChat(eventId, postingMode = "announce") {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data: channelId, error } = await sb.rpc("ensure_event_chat", {
      p_event_id: eventId,
      p_posting_mode: postingMode,
    });
    if (error) {
      console.error("[chat.ensure]", error.message);
      return null;
    }
    if (!channelId) return null;
    return getChannel(channelId);
  } catch (e) {
    console.error("[chat.ensure]", e);
    return null;
  }
}

// Create a Q&A thread (kind='qa') for an event and enrol its audience from a live
// audience spec. mode 'all' back-fills every buyer (and keeps auto-enrolling new
// ones via add_ticket_buyer_to_chat); 'filtered' enrols the people the spec
// resolves to now and persists the rule so reconcileChannelAudience can pick up
// future matches. Returns the channel view model.
export async function createQaThread({
  projectId,
  eventId,
  name,
  topic = "",
  postingMode = "open",
  spec,
} = {}) {
  if (!eventId || !name?.trim() || !isSupabaseConfigured()) return null;
  try {
    const s = normalizeSpec(spec, { fallbackEventId: eventId });
    const isAll = s.mode === "all";
    // Resolve the rule to concrete emails for the initial enrolment.
    const emails = isAll ? [] : (await resolveAudienceEmails(projectId, s)).emails;

    const sb = createClient();
    const { data: channelId, error } = await sb.rpc("create_qa_thread", {
      p_event_id: eventId,
      p_name: name.trim().slice(0, 120),
      p_topic: (topic || "").slice(0, 500),
      p_posting_mode: postingMode === "announce" ? "announce" : "open",
      p_audience: isAll ? "all" : "selected",
      p_emails: emails,
    });
    if (error) {
      console.error("[chat.createQaThread]", error.message);
      return null;
    }
    if (!channelId) return null;
    // Persist the live rule alongside the legacy audience string.
    await setChannelAudience(channelId, s);
    return getChannel(channelId);
  } catch (e) {
    console.error("[chat.createQaThread]", e);
    return null;
  }
}

// Persist a channel's live audience rule into metadata (merging, so reactions and
// other bag keys are preserved). Also keeps the legacy metadata.audience string
// in sync so the SQL auto-enrol path (add_ticket_buyer_to_chat) still recognises
// an 'all' thread. Returns the updated channel view model.
export async function setChannelAudience(channelId, spec) {
  if (!channelId || !isSupabaseConfigured()) return null;
  try {
    const s = normalizeSpec(spec);
    const sb = createClient();
    const { data: row } = await sb
      .from(CHANNELS)
      .select("metadata")
      .eq("id", channelId)
      .maybeSingle();
    const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const nextMeta = { ...meta, audience: s.mode === "all" ? "all" : "selected", audienceSpec: s };
    const { data, error } = await sb
      .from(CHANNELS)
      .update({ metadata: nextMeta })
      .eq("id", channelId)
      .select("*")
      .single();
    if (error) {
      console.error("[chat.setChannelAudience]", error.message);
      return null;
    }
    return normalizeChannel(data);
  } catch (e) {
    console.error("[chat.setChannelAudience]", e);
    return null;
  }
}

// Reconcile a channel's participants against its live audience rule: resolve the
// spec and additively enrol any matching members not already in the thread. Never
// removes anyone (removals stay a deliberate action in the participants dialog).
// 'all' channels need no reconcile — the SQL layer auto-enrols every buyer.
// Returns the number of members added.
export async function reconcileChannelAudience(channel, projectId) {
  if (!channel?.id || !isSupabaseConfigured()) return 0;
  const spec = normalizeSpec(channel.audienceSpec ?? channel.audience, {
    fallbackEventId: channel.eventId,
  });
  if (spec.mode === "all") return 0;
  try {
    const { emails } = await resolveAudienceEmails(projectId, spec);
    if (!emails.length) return 0;
    return addQaParticipants(channel.id, emails);
  } catch (e) {
    console.error("[chat.reconcileChannelAudience]", e);
    return 0;
  }
}

// Add members (by email) to an existing Q&A thread. Returns the number added.
export async function addQaParticipants(channelId, emails = []) {
  if (!channelId || !emails.length || !isSupabaseConfigured()) return 0;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("add_qa_participants", {
      p_channel_id: channelId,
      p_emails: emails,
    });
    if (error) {
      console.error("[chat.addQaParticipants]", error.message);
      return 0;
    }
    return Number(data) || 0;
  } catch (e) {
    console.error("[chat.addQaParticipants]", e);
    return 0;
  }
}

// Soft-delete a whole channel (used to delete an organiser-created Q&A thread).
export async function softDeleteChannel(channelId) {
  if (!channelId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(CHANNELS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", channelId);
    if (error) {
      console.error("[chat.softDeleteChannel]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[chat.softDeleteChannel]", e);
    return false;
  }
}

export async function getChannel(channelId) {
  if (!channelId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(CHANNELS).select("*").eq("id", channelId).maybeSingle();
    if (error) {
      console.error("[chat.getChannel]", error.message);
      return null;
    }
    return normalizeChannel(data);
  } catch (e) {
    console.error("[chat.getChannel]", e);
    return null;
  }
}

// All chat channels for a project (organiser workspace list), newest activity
// first, each with a last-message preview. Used by Community → Event Chat.
export async function listProjectChannels(projectId, { kind = "event" } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CHANNELS)
      .select("*")
      .eq("project_id", projectId)
      .eq("kind", kind)
      .is("deleted_at", null);
    if (error) {
      console.error("[chat.listProjectChannels]", error.message);
      return null;
    }
    const channels = (data || []).map(normalizeChannel);
    const ids = channels.map((c) => c.id);
    const previews = {};
    const lastAt = {};
    const counts = {};
    const msgCounts = {};
    if (ids.length) {
      const { data: msgs } = await sb
        .from(MESSAGES)
        .select("channel_id, body, created_at")
        .in("channel_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      for (const m of msgs || []) {
        msgCounts[m.channel_id] = (msgCounts[m.channel_id] || 0) + 1;
        if (!(m.channel_id in previews)) {
          previews[m.channel_id] = m.body;
          lastAt[m.channel_id] = m.created_at;
        }
      }
      // Participant counts (attendees only — exclude organiser rows).
      const { data: parts } = await sb
        .from(PARTICIPANTS)
        .select("channel_id, member_id")
        .in("channel_id", ids);
      for (const p of parts || []) {
        if (p.member_id) counts[p.channel_id] = (counts[p.channel_id] || 0) + 1;
      }
    }
    return channels
      .map((c) => ({
        ...c,
        lastPreview: previews[c.id] || "",
        lastMessageAt: lastAt[c.id] || c.createdAt,
        participantCount: counts[c.id] || 0,
        messageCount: msgCounts[c.id] || 0,
      }))
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  } catch (e) {
    console.error("[chat.listProjectChannels]", e);
    return null;
  }
}

export async function getEventChannel(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CHANNELS)
      .select("*")
      .eq("event_id", eventId)
      .eq("kind", "event")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[chat.getEventChannel]", error.message);
      return null;
    }
    return normalizeChannel(data);
  } catch (e) {
    console.error("[chat.getEventChannel]", e);
    return null;
  }
}

export async function updateChannel(channelId, patch) {
  if (!channelId || !isSupabaseConfigured()) return null;
  try {
    const row = {};
    if ("postingMode" in patch) row.posting_mode = patch.postingMode;
    if ("topic" in patch) row.topic = patch.topic;
    if ("status" in patch) row.status = patch.status;
    const sb = createClient();
    const { data, error } = await sb
      .from(CHANNELS)
      .update(row)
      .eq("id", channelId)
      .select("*")
      .single();
    if (error) {
      console.error("[chat.updateChannel]", error.message);
      return null;
    }
    return normalizeChannel(data);
  } catch (e) {
    console.error("[chat.updateChannel]", e);
    return null;
  }
}

export async function listMessages(channelId, { limit = 200 } = {}) {
  if (!channelId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(MESSAGES)
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) {
      console.error("[chat.listMessages]", error.message);
      return null;
    }
    return (data || []).map(normalizeMessage);
  } catch (e) {
    console.error("[chat.listMessages]", e);
    return null;
  }
}

export async function sendMessage(channelId, { body, replyTo = null, id } = {}) {
  if (!channelId || !body?.trim() || !isSupabaseConfigured()) return null;
  try {
    const user = await getUser();
    const payload = {
      channel_id: channelId,
      author_user_id: user?.id ?? null,
      sender_kind: "organiser",
      author_name: user?.name || "Organiser",
      body: body.trim().slice(0, 4000),
      metadata: replyTo ? { replyTo } : {},
    };
    if (id) payload.id = id;
    const sb = createClient();
    const { data, error } = await sb.from(MESSAGES).insert(payload).select("*").single();
    if (error) {
      console.error("[chat.sendMessage]", error.message);
      return null;
    }
    return normalizeMessage(data);
  } catch (e) {
    console.error("[chat.sendMessage]", e);
    return null;
  }
}

// Post a poll into the channel (as organiser). options is an array of labels.
export async function sendPoll(channelId, { question, options, multi = false } = {}) {
  if (!channelId || !isSupabaseConfigured()) return null;
  const poll = buildPoll({ question, options, multi });
  if (!poll.question || poll.options.length < 2) return null;
  try {
    const user = await getUser();
    const sb = createClient();
    const { data, error } = await sb
      .from(MESSAGES)
      .insert({
        channel_id: channelId,
        author_user_id: user?.id ?? null,
        sender_kind: "organiser",
        author_name: user?.name || "Organiser",
        body: poll.question,
        metadata: { type: "poll", poll },
      })
      .select("*")
      .single();
    if (error) {
      console.error("[chat.sendPoll]", error.message);
      return null;
    }
    return normalizeMessage(data);
  } catch (e) {
    console.error("[chat.sendPoll]", e);
    return null;
  }
}

// Toggle the current organiser's vote on a poll option.
export async function votePoll(messageId, optionId, actorKey) {
  if (!messageId || !optionId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const key = actorKey || `u:${(await getUser())?.id || ""}`;
    const { data: row } = await sb.from(MESSAGES).select("metadata").eq("id", messageId).maybeSingle();
    if (!row?.metadata?.poll) return null;
    const meta = { ...row.metadata, poll: togglePollVote(row.metadata.poll, optionId, key) };
    const { data, error } = await sb
      .from(MESSAGES)
      .update({ metadata: meta })
      .eq("id", messageId)
      .select("*")
      .single();
    if (error) {
      console.error("[chat.votePoll]", error.message);
      return null;
    }
    return normalizeMessage(data);
  } catch (e) {
    console.error("[chat.votePoll]", e);
    return null;
  }
}

// Toggle the current organiser's reaction on a message. Reads-modify-writes the
// metadata bag; actorKey defaults to the signed-in user.
export async function toggleReaction(messageId, emojiKey, actorKey) {
  if (!messageId || !emojiKey || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const key = actorKey || `u:${(await getUser())?.id || ""}`;
    const { data: row, error: readErr } = await sb
      .from(MESSAGES)
      .select("metadata")
      .eq("id", messageId)
      .maybeSingle();
    if (readErr || !row) {
      console.error("[chat.toggleReaction]", readErr?.message || "not found");
      return null;
    }
    const meta = row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {};
    const reactions = { ...(meta.reactions || {}) };
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
      console.error("[chat.toggleReaction]", error.message);
      return null;
    }
    return normalizeMessage(data);
  } catch (e) {
    console.error("[chat.toggleReaction]", e);
    return null;
  }
}

export async function softDeleteMessage(messageId) {
  if (!messageId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(MESSAGES)
      .update({ deleted_at: new Date().toISOString(), body: "" })
      .eq("id", messageId);
    if (error) {
      console.error("[chat.deleteMessage]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[chat.deleteMessage]", e);
    return false;
  }
}

export async function listParticipants(channelId) {
  if (!channelId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PARTICIPANTS)
      .select("*")
      .eq("channel_id", channelId)
      .order("joined_at", { ascending: true });
    if (error) {
      console.error("[chat.listParticipants]", error.message);
      return null;
    }
    return (data || []).map(normalizeParticipant);
  } catch (e) {
    console.error("[chat.listParticipants]", e);
    return null;
  }
}

export async function setParticipantMuted(participantId, muted) {
  if (!participantId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(PARTICIPANTS).update({ muted }).eq("id", participantId);
    if (error) {
      console.error("[chat.mute]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[chat.mute]", e);
    return false;
  }
}

export async function removeParticipant(participantId) {
  if (!participantId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(PARTICIPANTS).delete().eq("id", participantId);
    if (error) {
      console.error("[chat.removeParticipant]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[chat.removeParticipant]", e);
    return false;
  }
}

// Live updates for a channel. Returns an unsubscribe function. Organiser side is
// Supabase-authenticated, so RLS scopes it automatically.
export function subscribeChannel(channelId, { onMessage, onParticipant } = {}) {
  if (!channelId || !isSupabaseConfigured()) return () => {};
  const sb = createClient();
  const channel = sb
    .channel(`chat:${channelId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "events", table: MESSAGES, filter: `channel_id=eq.${channelId}` },
      (payload) => onMessage?.(payload),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "events", table: PARTICIPANTS, filter: `channel_id=eq.${channelId}` },
      (payload) => onParticipant?.(payload),
    )
    .subscribe();
  return () => {
    try {
      sb.removeChannel(channel);
    } catch {
      // ignore teardown races
    }
  };
}
