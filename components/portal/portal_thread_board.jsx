"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessagesSquare,
  MessageSquare,
  Users,
  Radio,
  Megaphone,
} from "lucide-react";

import { EmptyState, ScreenHeader, SearchInput } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/chat_kit";
import { cn } from "@/lib/utils";
import { subscribeMemberChannel, normalizePortalMessage } from "@/lib/portal/chat_realtime";

// Members-portal thread board — mirrors the organiser dashboard's Q&A / Event Chat
// look (a full-width list of thread cards that opens into a full-width chat), but
// read-only on structure: a member reads and chats, they don't create or moderate.
// Reads/writes go through the kind-agnostic /api/portal/chat routes.

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

function relTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function monogram(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function ModeBadge({ mode }) {
  const open = mode === "open";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        open
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-sky-500/20 bg-sky-500/10 text-sky-400",
      )}
    >
      {open ? <Radio className="h-2.5 w-2.5" /> : <Megaphone className="h-2.5 w-2.5" />}
      {open ? "Open" : "Announce"}
    </span>
  );
}

// A slim, full-width thread row (matches the dashboard's ThreadCard).
function ThreadCard({ channel, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-[11px] font-semibold text-foreground">
        {monogram(channel.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {channel.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
          <p
            className={cn(
              "truncate text-sm text-foreground",
              channel.unread ? "font-semibold" : "font-medium",
            )}
          >
            {channel.name}
          </p>
          <ModeBadge mode={channel.postingMode} />
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {channel.lastPreview || "No messages yet — join the conversation."}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-4 text-[11px] text-text-tertiary sm:flex">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {channel.participantCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {channel.messageCount ?? 0}
        </span>
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-text-tertiary">
        {relTime(channel.lastMessageAt)}
      </span>
    </button>
  );
}

export function PortalThreadBoard({
  member,
  kind = "qa",
  title = "Q&A",
  description = "",
  emptyTitle = "No threads yet",
  emptyText = "",
  subtitleFor,
}) {
  const meKey = useMemo(() => (member?.id ? `m:${member.id}` : null), [member?.id]);
  const [channels, setChannels] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
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
          i >= 0 ? prev.messages.map((x) => (x.id === m.id ? m : x)) : [...prev.messages, m];
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
    setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, data.message] } : prev));
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.lastPreview || "").toLowerCase().includes(q),
    );
  }, [channels, search]);

  const active = channels.find((c) => c.id === activeId) || null;

  // ---- Thread view (full-width drill-in) -----------------------------------
  if (activeId && active) {
    const subtitle = detail
      ? subtitleFor
        ? subtitleFor(detail)
        : detail.postingMode === "open"
          ? "Open discussion"
          : "Announcements"
      : "";
    return (
      <MainScreenWrapper>
        <div className="flex h-[calc(100dvh-11rem)] min-h-[440px] flex-col">
          <ChatThread
            bare
            title={active.name}
            subtitle={subtitle}
            headerLeft={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="All threads"
                onClick={back}
                className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            }
            headerRight={
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                <Users className="h-4 w-4" /> {active.participantCount ?? 0}
              </span>
            }
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
      </MainScreenWrapper>
    );
  }

  // ---- List view -----------------------------------------------------------
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
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search threads…"
            className="sm:max-w-xs"
          />
          {filtered.length ? (
            <div className="space-y-2">
              {filtered.map((c) => (
                <ThreadCard key={c.id} channel={c} onSelect={openChannel} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={MessagesSquare}
                title="No threads match your search"
                description="Try a different search."
              />
            </div>
          )}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default PortalThreadBoard;
