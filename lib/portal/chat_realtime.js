"use client";

import { createClient } from "@/lib/supabase/client";
import { portalFetch } from "@/lib/portal/portal_fetch";


let _client = null;
function client() {
  if (!_client) _client = createClient();
  return _client;
}

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

export async function subscribeMemberChannel(channelId, { onMessage } = {}) {
  const noop = { live: false, stop: () => {} };
  if (!channelId) return noop;

  let token = null;
  try {
    const r = await portalFetch("/api/portal/chat/realtime-token", { method: "POST" });
    if (r.ok) token = (await r.json()).token;
  } catch {
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
        }
      },
    };
  } catch {
    return noop;
  }
}
