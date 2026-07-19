"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessagesSquare } from "lucide-react";

import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ChannelList, ChatThread } from "@/components/chat/chat_kit";
import { subscribeMemberChannel, normalizePortalMessage } from "@/lib/portal/chat_realtime";

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json().catch(() => null);
}
async function postJson(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

// Generic members-portal channel surface (left rail + live thread). Configured by
// `kind` so the same UI powers both the event-chat Community section and the Q&A
// section. All reads/writes go through the kind-agnostic /api/portal/chat routes.
export function PortalChannels({
  member,
  kind = "event",
  title = "Community",
  description = "",
  emptyTitle = "No chats yet",
  emptyText = "",
  subtitleFor,
}) {
  const meKey = useMemo(() => (member?.id ? `m:${member.id}` : null), [member?.id]);
  const [channels, setChannels] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const stopRef = useRef(null);
  const pollRef = useRef(null);

  const loadChannels = () =>
    getJson(`/api/portal/chat/channels?kind=${kind}`).then((d) => {
      setChannels(d?.channels ?? []);
      setLoadingList(false);
    });

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const clearLive = () => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Load a channel's messages + wire live updates (realtime, or polling fallback).
  const openChannel = async (id) => {
    clearLive();
    setActiveId(id);
    setLoadingDetail(true);
    const d = await getJson(`/api/portal/chat/channels/${id}`);
    setDetail(d?.channel || null);
    setLoadingDetail(false);
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));

    const applyRealtime = (payload) => {
      if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
      const m = normalizePortalMessage(payload.new);
      setDetail((prev) => {
        if (!prev || prev.id !== m.channelId) return prev;
        const i = prev.messages.findIndex((x) => x.id === m.id);
        const messages =
          i >= 0
            ? prev.messages.map((x) => (x.id === m.id ? m : x))
            : [...prev.messages, m];
        return { ...prev, messages };
      });
    };

    const sub = await subscribeMemberChannel(id, { onMessage: applyRealtime });
    stopRef.current = sub.stop;
    if (!sub.live) {
      pollRef.current = setInterval(async () => {
        const fresh = await getJson(`/api/portal/chat/channels/${id}`);
        if (fresh?.channel) setDetail(fresh.channel);
      }, 5000);
    }
  };

  useEffect(() => () => clearLive(), []);

  const back = () => {
    clearLive();
    setActiveId(null);
    setDetail(null);
    loadChannels();
  };

  const onSend = async (body) => {
    if (!activeId) return false;
    const { ok, data } = await postJson(`/api/portal/chat/channels/${activeId}/messages`, { body });
    if (!ok) {
      toast.error(data.error || "Couldn't send.");
      return false;
    }
    setDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, data.message] } : prev,
    );
    return true;
  };

  const onReact = async (key, msg) => {
    if (!activeId) return;
    const { ok, data } = await postJson(`/api/portal/chat/channels/${activeId}/reactions`, {
      messageId: msg.id,
      emoji: key,
    });
    if (ok && data.message) {
      setDetail((prev) =>
        prev
          ? { ...prev, messages: prev.messages.map((m) => (m.id === data.message.id ? data.message : m)) }
          : prev,
      );
    }
  };

  const onVote = async (optionId, msg) => {
    if (!activeId) return;
    const { ok, data } = await postJson(`/api/portal/chat/channels/${activeId}/vote`, {
      messageId: msg.id,
      optionId,
    });
    if (ok && data.message) {
      setDetail((prev) =>
        prev
          ? { ...prev, messages: prev.messages.map((m) => (m.id === data.message.id ? data.message : m)) }
          : prev,
      );
    }
  };

  const subtitle = detail
    ? subtitleFor
      ? subtitleFor(detail)
      : detail.postingMode === "open"
        ? "Group chat"
        : "Announcements"
    : "";

  return (
    <MainScreenWrapper>
      <ScreenHeader title={title} description={description} />

      {loadingList ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !channels.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={MessagesSquare} title={emptyTitle} description={emptyText} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Channel list — hidden on mobile once a chat is open. */}
          <div className={`w-full md:w-72 md:shrink-0 ${activeId ? "hidden md:block" : "block"}`}>
            <ChannelList channels={channels} activeId={activeId} onSelect={openChannel} />
          </div>

          {/* Thread */}
          <div className={`min-w-0 flex-1 ${activeId ? "block" : "hidden md:block"}`}>
            {!activeId ? (
              <div className="flex h-[60vh] items-center justify-center rounded-xl border border-border bg-surface-subtle text-sm text-text-secondary">
                Pick a thread to start reading.
              </div>
            ) : (
              <div className="flex h-[70vh] min-h-[380px] flex-col gap-2">
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground md:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> All threads
                </button>
                <div className="min-h-0 flex-1">
                  <ChatThread
                    title={detail?.name}
                    subtitle={subtitle}
                    messages={detail?.messages || []}
                    meKey={meKey}
                    loading={loadingDetail}
                    canPost={Boolean(detail?.canPost)}
                    composerPlaceholder={
                      detail?.muted
                        ? "You've been muted in this thread."
                        : detail?.canPost
                          ? "Write a message…"
                          : "Only the organiser can post here."
                    }
                    onSend={onSend}
                    onReact={onReact}
                    onVote={onVote}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default PortalChannels;
