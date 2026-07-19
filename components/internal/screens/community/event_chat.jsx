"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessagesSquare,
  MessageSquare,
  Users,
  Volume2,
  VolumeX,
  UserMinus,
  Radio,
  Megaphone,
  Archive,
} from "lucide-react";

import {
  EmptyState,
  ScreenHeader,
  SearchInput,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatThread } from "@/components/chat/chat_kit";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  listProjectChannels,
  listMessages,
  sendMessage,
  sendPoll,
  votePoll,
  toggleReaction,
  softDeleteMessage,
  listParticipants,
  setParticipantMuted,
  removeParticipant,
  subscribeChannel,
  normalizeMessage,
} from "@/lib/supabase/chat";

const MODE_FILTER = [
  { value: "all", label: "All types" },
  { value: "open", label: "Open discussion" },
  { value: "announce", label: "Announce-only" },
];
const STATUS_FILTER = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" },
];
const SORT_OPTIONS = [
  { value: "recent", label: "Recent activity" },
  { value: "name", label: "Name (A–Z)" },
  { value: "attendees", label: "Most attendees" },
  { value: "messages", label: "Most messages" },
];

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

// A slim, full-width event-chat row. Clicking drills into the chat.
function ChannelCard({ channel, onSelect }) {
  const archived = channel.status === "archived";
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover",
        archived && "opacity-70",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-[11px] font-semibold text-foreground">
        {monogram(channel.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{channel.name}</p>
          <ModeBadge mode={channel.postingMode} />
          {archived ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
              <Archive className="h-3 w-3" /> Archived
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {channel.lastPreview || "No messages yet — start the conversation."}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-4 text-[11px] text-text-tertiary sm:flex">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {channel.participantCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {channel.messageCount}
        </span>
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-text-tertiary">
        {relTime(channel.lastMessageAt)}
      </span>
    </button>
  );
}

function ParticipantsDialog({ open, onOpenChange, channelId }) {
  const [rows, setRows] = useState(null);
  const load = () => listParticipants(channelId).then((r) => setRows(r ?? []));
  useEffect(() => {
    if (open && channelId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId]);

  const members = (rows || []).filter((p) => p.memberId);

  const mute = async (p) => {
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, muted: !p.muted } : x)));
    if (!(await setParticipantMuted(p.id, !p.muted))) {
      toast.error("Couldn't update participant.");
      load();
    }
  };
  const remove = async (p) => {
    setRows((prev) => prev.filter((x) => x.id !== p.id));
    if (!(await removeParticipant(p.id))) {
      toast.error("Couldn't remove participant.");
      load();
    } else {
      toast.success("Removed from chat.");
    }
  };

  const mutedCount = members.filter((p) => p.muted).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Participants</DialogTitle>
          <DialogDescription>
            {rows === null
              ? "Loading the people in this chat…"
              : members.length
                ? `${members.length} ${members.length === 1 ? "attendee" : "attendees"}${
                    mutedCount ? ` · ${mutedCount} muted` : ""
                  } · they join automatically as tickets sell.`
                : "Attendees join automatically as they buy tickets."}
          </DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !members.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-subtle text-text-secondary">
              <Users className="h-5 w-5" />
            </span>
            <p className="text-sm text-text-secondary">
              No attendees have joined yet.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {members.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-text-secondary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm text-foreground">Attendee</span>
                  {p.muted ? (
                    <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      Muted
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={p.muted ? "Unmute" : "Mute"}
                    onClick={() => mute(p)}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    {p.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={() => remove(p)}
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EventChatScreen() {
  const { projectId } = useProject();
  const [channels, setChannels] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [meKey, setMeKey] = useState(null);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("recent");

  const stopRef = useRef(null);

  useEffect(() => {
    getUser().then((u) => u && setMeKey(`u:${u.id}`));
  }, []);

  const reloadList = () =>
    listProjectChannels(projectId).then((rows) => {
      setChannels(rows ?? []);
      setLoadingList(false);
    });

  useEffect(() => {
    let alive = true;
    listProjectChannels(projectId).then((rows) => {
      if (!alive) return;
      setChannels(rows ?? []);
      setLoadingList(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = channels.filter((c) => {
      if (mode !== "all" && c.postingMode !== mode) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.topic || "").toLowerCase().includes(q) ||
        (c.lastPreview || "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "attendees") sorted.sort((a, b) => b.participantCount - a.participantCount);
    else if (sort === "messages") sorted.sort((a, b) => b.messageCount - a.messageCount);
    else sorted.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    return sorted;
  }, [channels, search, mode, status, sort]);

  const active = channels.find((c) => c.id === activeId) || null;

  const stopLive = () => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  };

  const openChannel = async (id) => {
    stopLive();
    setActiveId(id);
    setLoadingDetail(true);
    const msgs = await listMessages(id);
    setMessages(msgs ?? []);
    setLoadingDetail(false);
    stopRef.current = subscribeChannel(id, {
      onMessage: (payload) => {
        if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
        const m = normalizeMessage(payload.new);
        setMessages((prev) => {
          const i = prev.findIndex((x) => x.id === m.id);
          if (i >= 0) {
            const next = [...prev];
            next[i] = m;
            return next;
          }
          return [...prev, m];
        });
      },
    });
  };

  useEffect(() => () => stopLive(), []);

  const back = () => {
    stopLive();
    setActiveId(null);
    setMessages([]);
    reloadList(); // refresh previews / counts after visiting a chat
  };

  const onSend = async (body) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      channelId: activeId,
      authorKey: meKey,
      authorName: "You",
      senderKind: "organiser",
      text: body,
      reactions: {},
      replyTo: null,
      type: "text",
      poll: null,
      deleted: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const saved = await sendMessage(activeId, { body, id });
    if (!saved) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.error("Couldn't send your message.");
      return false;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? saved : m)));
    return true;
  };

  const onReact = async (key, msg) => {
    const updated = await toggleReaction(msg.id, key, meKey);
    if (updated) setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const onDelete = async (msg) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted: true } : m)));
    if (!(await softDeleteMessage(msg.id))) toast.error("Couldn't delete the message.");
  };

  const onVote = async (optionId, msg) => {
    const updated = await votePoll(msg.id, optionId, meKey);
    if (updated) setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const onCreatePoll = async ({ question, options, multi }) => {
    const saved = await sendPoll(activeId, { question, options, multi });
    if (!saved) {
      toast.error("Couldn't post the poll.");
      return false;
    }
    setMessages((prev) => [...prev, saved]);
    return true;
  };

  const clearFilters = () => {
    setSearch("");
    setMode("all");
    setStatus("active");
  };

  // ---- Conversation view (full-width drill-in) -----------------------------
  if (activeId && active) {
    const archived = active.status === "archived";
    return (
      <MainScreenWrapper className="lg:flex lg:h-full lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden lg:py-0">
        <div className="flex h-[80vh] min-h-[440px] flex-col lg:h-auto lg:min-h-0 lg:flex-1">
          <ChatThread
            bare
            title={active.name}
            subtitle={active.postingMode === "open" ? "Open discussion" : "Announce-only"}
            headerLeft={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="All Event Chats"
                onClick={back}
                className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            }
            headerRight={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParticipantsOpen(true)}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <Users className="h-4 w-4" /> {active.participantCount ?? 0}
              </Button>
            }
            messages={messages}
            meKey={meKey}
            loading={loadingDetail}
            canPost={!archived}
            composerPlaceholder={archived ? "Chat archived." : "Message attendees…"}
            onSend={onSend}
            onReact={onReact}
            onDelete={onDelete}
            onVote={onVote}
            onCreatePoll={onCreatePoll}
          />
        </div>
        <ParticipantsDialog
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          channelId={activeId}
        />
      </MainScreenWrapper>
    );
  }

  // ---- List view -----------------------------------------------------------
  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Event Chat"
        description="Group chats for your events. Attendees join automatically when they buy a ticket — configure each chat in the event's Communication settings."
      />

      {loadingList ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !channels.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title="No event chats yet"
            description="Open an event's Communication settings (in the event editor) to start its chat, or publish an event and it opens as tickets sell."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search event chats…"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown value={mode} options={MODE_FILTER} onValueChange={setMode} />
              <FilterDropdown value={status} options={STATUS_FILTER} onValueChange={setStatus} />
              <FilterDropdown value={sort} options={SORT_OPTIONS} onValueChange={setSort} />
            </div>
          </div>

          {filtered.length ? (
            <div className="space-y-2">
              {filtered.map((c) => (
                <ChannelCard key={c.id} channel={c} onSelect={openChannel} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={MessagesSquare}
                title="No chats match your filters"
                description="Try a different search, type, or status."
                action={
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          )}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default EventChatScreen;
