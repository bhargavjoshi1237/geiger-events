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
  UserPlus,
  Radio,
  Megaphone,
  Archive,
  ArchiveRestore,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatThread } from "@/components/chat/chat_kit";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
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
  updateChannel,
  softDeleteChannel,
  createQaThread,
  addQaParticipants,
  reconcileChannelAudience,
  normalizeMessage,
} from "@/lib/supabase/chat";
import { AudienceBuilder } from "@/components/internal/shared/audience/audience_builder";
import { normalizeSpec, isEmptyFilters, describeSpec } from "@/lib/audience/resolve";

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
  { value: "members", label: "Most members" },
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

// A slim, full-width thread row. Clicking drills into the thread chat.
function ThreadCard({ channel, eventName, onSelect }) {
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
          {channel.audience === "selected" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-tertiary">
              {describeSpec(channel.audienceSpec)}
            </span>
          ) : null}
          {archived ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
              <Archive className="h-3 w-3" /> Archived
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {channel.lastPreview || (eventName ? `${eventName} · No messages yet` : "No messages yet")}
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

const EMPTY_DRAFT = {
  eventId: "",
  name: "",
  topic: "",
  postingMode: "open",
};

function CreateThreadDialog({ open, onOpenChange, projectId, events, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [spec, setSpec] = useState(() => normalizeSpec({ scope: "event", mode: "all" }));
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setSpec(normalizeSpec({ scope: "event", mode: "all" }));
  };

  // Switching events re-scopes the audience rule (ticket/offering facets are
  // per-event) and clears any per-person picks.
  const chooseEvent = (value) => {
    set("eventId")(value);
    setSpec((s) => ({
      ...normalizeSpec({ scope: "event", mode: s.mode }),
      eventId: value,
    }));
  };

  const submit = async () => {
    if (!draft.eventId) {
      toast.error("Pick an event for this thread.");
      return;
    }
    if (!draft.name.trim()) {
      toast.error("Give the thread a name.");
      return;
    }
    if (spec.mode === "filtered" && isEmptyFilters(spec.filters) && !spec.include.length) {
      toast.error("Add targeting criteria or pick people, or switch to All attendees.");
      return;
    }
    setBusy(true);
    const ok = await onCreate({
      projectId,
      eventId: draft.eventId,
      name: draft.name,
      topic: draft.topic,
      postingMode: draft.postingMode,
      spec: { ...spec, scope: "event", eventId: draft.eventId },
    });
    setBusy(false);
    if (ok !== false) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Q&amp;A thread</DialogTitle>
          <DialogDescription>
            Open a discussion thread for an event. Attendees join automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Event">
            <Select value={draft.eventId} onValueChange={chooseEvent}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue placeholder="Choose an event…" />
              </SelectTrigger>
              <SelectContent>
                {events.length ? (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name || "Untitled event"}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-2 text-sm text-text-secondary">No events yet.</div>
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Thread name">
            <Input
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Parking & travel"
              className="bg-surface-card"
            />
          </Field>

          <Field label="Description" hint="Optional — a short line on what this thread is for.">
            <Textarea
              rows={2}
              value={draft.topic}
              onChange={(e) => set("topic")(e.target.value)}
              placeholder="e.g. Ask anything about getting to the venue."
              className="resize-none bg-surface-card"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Announce-only</p>
              <p className="text-xs text-text-secondary">
                Only you post; members react. Off = everyone can chat.
              </p>
            </div>
            <Switch
              checked={draft.postingMode === "announce"}
              onCheckedChange={(v) => set("postingMode")(v ? "announce" : "open")}
            />
          </label>

          <Field
            label="Who can join"
            hint="Target everyone, or a subset by ticket type, offering, add-on, tag, segment, or specific people."
          >
            {draft.eventId ? (
              <AudienceBuilder
                key={draft.eventId}
                projectId={projectId}
                eventId={draft.eventId}
                spec={spec}
                onSpecChange={setSpec}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-surface-card px-3 py-4 text-center text-xs text-text-secondary">
                Pick an event first to choose its audience.
              </p>
            )}
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create thread
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Participants + moderation for a thread. Selected threads can add more members.
function ThreadParticipantsDialog({ open, onOpenChange, projectId, channel }) {
  const channelId = channel?.id;
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [savingAdd, setSavingAdd] = useState(false);

  const load = () => listParticipants(channelId).then((r) => setRows(r ?? []));
  useEffect(() => {
    if (open && channelId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId]);

  // Reset add-mode state on close (handler, not effect).
  const closeDialog = (o) => {
    if (!o) {
      setAdding(false);
      setPicked(new Set());
    }
    onOpenChange(o);
  };
  const openAdd = () => {
    setPicked(new Set());
    setAdding(true);
  };

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
      toast.success("Removed from thread.");
    }
  };

  const saveAdd = async () => {
    if (!picked.size) return;
    setSavingAdd(true);
    const added = await addQaParticipants(channelId, [...picked]);
    setSavingAdd(false);
    if (added > 0) {
      toast.success(`Added ${added} ${added === 1 ? "member" : "members"}.`);
      setAdding(false);
      setPicked(new Set());
      load();
    } else {
      toast.error("Couldn't add those members (they may already be in the thread).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{adding ? "Add members" : "Participants"}</DialogTitle>
          {!adding ? (
            <DialogDescription>
              {rows === null
                ? "Loading members…"
                : `${members.length} ${members.length === 1 ? "member" : "members"} · ${
                    channel?.audience === "selected"
                      ? describeSpec(channel.audienceSpec)
                      : "all attendees"
                  }`}
            </DialogDescription>
          ) : (
            <DialogDescription>
              Target by ticket, offering, add-on, tag, segment, or specific people.
            </DialogDescription>
          )}
        </DialogHeader>

        {adding ? (
          <>
            {channel?.eventId ? (
              <AudienceBuilder
                key={channel.eventId}
                projectId={projectId}
                eventId={channel.eventId}
                selected={picked}
                onSelectedChange={setPicked}
              />
            ) : (
              <p className="py-6 text-center text-sm text-text-secondary">
                This thread isn&apos;t linked to an event.
              </p>
            )}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setAdding(false)}
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                Back
              </Button>
              <Button
                onClick={saveAdd}
                disabled={savingAdd || !picked.size}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {savingAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add {picked.size || ""}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {rows === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !members.length ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                No members yet.
              </p>
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
                      <span className="truncate text-sm text-foreground">Member</span>
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
            <DialogFooter>
              <Button
                variant="outline"
                onClick={openAdd}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <UserPlus className="h-4 w-4" /> Add members
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function QaThreadsScreen() {
  const { projectId } = useProject();
  const [channels, setChannels] = useState([]);
  const [eventsById, setEventsById] = useState({});
  const [events, setEvents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [meKey, setMeKey] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
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
    listProjectChannels(projectId, { kind: "qa" }).then((rows) => {
      setChannels(rows ?? []);
      setLoadingList(false);
    });

  useEffect(() => {
    let alive = true;
    Promise.all([
      listProjectChannels(projectId, { kind: "qa" }),
      listEvents(projectId),
    ]).then(([chRows, evRows]) => {
      if (!alive) return;
      setChannels(chRows ?? []);
      const evs = evRows ?? [];
      setEvents(evs);
      setEventsById(Object.fromEntries(evs.map((e) => [e.id, e.name || "Untitled event"])));
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
      const eventName = (eventsById[c.eventId] || "").toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.topic || "").toLowerCase().includes(q) ||
        eventName.includes(q) ||
        (c.lastPreview || "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "members") sorted.sort((a, b) => b.participantCount - a.participantCount);
    else if (sort === "messages") sorted.sort((a, b) => b.messageCount - a.messageCount);
    else sorted.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    return sorted;
  }, [channels, search, mode, status, sort, eventsById]);

  const active = channels.find((c) => c.id === activeId) || null;

  const stopLive = () => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  };

  const openThread = async (id) => {
    stopLive();
    setActiveId(id);
    setLoadingDetail(true);
    const msgs = await listMessages(id);
    setMessages(msgs ?? []);
    setLoadingDetail(false);
    // Live rule: additively enrol any newly-matching buyers on open.
    const ch = channels.find((c) => c.id === id);
    if (ch && ch.audienceSpec?.mode === "filtered") {
      reconcileChannelAudience(ch, projectId).then((added) => {
        if (added > 0) patchChannel(id, { participantCount: (ch.participantCount || 0) + added });
      });
    }
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
    reloadList();
  };

  const patchChannel = (id, patch) =>
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleCreate = async (input) => {
    const created = await createQaThread(input);
    if (!created) {
      toast.error("Couldn't create the thread.");
      return false;
    }
    setChannels((prev) => [
      { ...created, lastPreview: "", lastMessageAt: created.createdAt, participantCount: 0, messageCount: 0 },
      ...prev,
    ]);
    toast.success("Thread created.");
    openThread(created.id);
    return true;
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

  const toggleMode = async () => {
    if (!active) return;
    const next = active.postingMode === "open" ? "announce" : "open";
    patchChannel(active.id, { postingMode: next });
    if (!(await updateChannel(active.id, { postingMode: next }))) {
      toast.error("Couldn't update the thread.");
      patchChannel(active.id, { postingMode: active.postingMode });
    }
  };

  const toggleArchive = async () => {
    if (!active) return;
    const next = active.status === "archived" ? "active" : "archived";
    patchChannel(active.id, { status: next });
    if (!(await updateChannel(active.id, { status: next }))) {
      toast.error("Couldn't update the thread.");
      patchChannel(active.id, { status: active.status });
    } else {
      toast.success(next === "archived" ? "Thread archived." : "Thread reopened.");
    }
  };

  const deleteThread = async () => {
    if (!active) return;
    const id = active.id;
    const ok = await softDeleteChannel(id);
    if (!ok) {
      toast.error("Couldn't delete the thread.");
      return;
    }
    toast.success("Thread deleted.");
    stopLive();
    setActiveId(null);
    setMessages([]);
    setChannels((prev) => prev.filter((c) => c.id !== id));
  };

  const clearFilters = () => {
    setSearch("");
    setMode("all");
    setStatus("active");
  };

  // ---- Thread view (full-width drill-in) -----------------------------------
  if (activeId && active) {
    const archived = active.status === "archived";
    const eventName = eventsById[active.eventId] || "";
    return (
      <MainScreenWrapper className="lg:flex lg:h-full lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden lg:py-0">
        <div className="flex h-[80vh] min-h-[440px] flex-col lg:h-auto lg:min-h-0 lg:flex-1">
          <ChatThread
            bare
            title={active.name}
            subtitle={[
              eventName,
              active.postingMode === "open" ? "Open discussion" : "Announce-only",
              archived ? "Archived" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setParticipantsOpen(true)}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <Users className="h-4 w-4" /> {active.participantCount ?? 0}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Thread settings"
                      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 border-border bg-surface-subtle">
                    <DropdownMenuLabel>Thread</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onClick={toggleMode}
                    >
                      {active.postingMode === "open" ? (
                        <>
                          <Megaphone className="h-4 w-4" /> Switch to announce-only
                        </>
                      ) : (
                        <>
                          <Radio className="h-4 w-4" /> Switch to open discussion
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={toggleArchive}>
                      {archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4" /> Reopen thread
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" /> Archive thread
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                      onClick={deleteThread}
                    >
                      <Trash2 className="h-4 w-4" /> Delete thread
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
            messages={messages}
            meKey={meKey}
            loading={loadingDetail}
            canPost={!archived}
            composerPlaceholder={
              archived
                ? "Thread archived."
                : active.postingMode === "announce"
                  ? "Post an announcement…"
                  : "Message members…"
            }
            onSend={onSend}
            onReact={onReact}
            onDelete={onDelete}
            onVote={onVote}
            onCreatePoll={onCreatePoll}
          />
        </div>
        <ThreadParticipantsDialog
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          projectId={projectId}
          channel={active}
        />
      </MainScreenWrapper>
    );
  }

  // ---- List view -----------------------------------------------------------
  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Q&A"
        description="Open discussion threads for your events. Attendees join automatically — pick all attendees or a selected group per thread."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New thread
          </Button>
        }
      />

      {loadingList ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !channels.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title="No Q&A threads yet"
            description="Open a thread for an event so attendees can ask questions and chat."
            action={
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> New thread
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search threads…"
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
                <ThreadCard
                  key={c.id}
                  channel={c}
                  eventName={eventsById[c.eventId] || ""}
                  onSelect={openThread}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={MessagesSquare}
                title="No threads match your filters"
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

      <CreateThreadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        events={events}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default QaThreadsScreen;
