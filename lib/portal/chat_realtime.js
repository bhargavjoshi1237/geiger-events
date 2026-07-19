"use client";

import { createClient } from "@/lib/supabase/client";

// Client-side Realtime for the members portal. Members authenticate with a
// custom cookie session (not Supabase Auth), so we mint a short-lived scoped JWT
// (POST /api/portal/chat/realtime-token) carrying member_id and hand it to the
// Realtime connection; RLS (events.chat_channel_member) scopes the rows they
// receive. If the token can't be minted (e.g. SUPABASE_JWT_SECRET unset), the
// caller polls instead — subscribeMemberChannel resolves { live: false }.

let _client = null;
function client() {
  if (!_client) _client = createClient();
  return _client;
}

// Map a raw events.chat_messages row (from a Realtime payload) to the portal
// view-model — same shape the /api/portal/chat routes return.
export function normalizePortalMessage(row) {
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

// Subscribe to a channel's messages. Resolves { live, stop }. When live is false
// the token wasn't available and the caller should poll.
export async function subscribeMemberChannel(channelId, { onMessage } = {}) {
  const noop = { live: false, stop: () => {} };
  if (!channelId) return noop;

  let token = null;
  try {
    const r = await fetch("/api/portal/chat/realtime-token", { method: "POST" });
    if (r.ok) token = (await r.json()).token;
  } catch {
    // ignore — fall back to polling
  }
  if (!token) return noop;

  try {
    const sb = client();
    sb.realtime.setAuth(token);
    const ch = sb
      .channel(`portal-chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "events",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => onMessage?.(payload),
      )
      .subscribe();
    return {
      live: true,
      stop: () => {
        try {
          sb.removeChannel(ch);
        } catch {
          // ignore teardown races
        }
      },
    };
  } catch {
    return noop;
  }
}
