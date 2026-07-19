"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlignLeft,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Clock,
  LayoutGrid,
  Loader2,
  MapPin,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Type,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { conferenceApi } from "@/lib/supabase/conference";
import { getUser } from "@/lib/supabase/user";
import { formatDate, EVENT_STATUS_MAP } from "@/components/internal/screens/events/sample_data";
import { SESSION_STATUS_MAP } from "./constants";

// The Agenda Builder is a two-level screen: pick an event, then build its
// schedule. Sessions are conference_records (module "session") linked to an
// event through config.eventId, so they share the Conference store while reading
// as a per-event running order here. Mutations are optimistic + persisted.

const STATUS_VALUES = Object.keys(SESSION_STATUS_MAP);

// Event-list (level 1) filters + sort.
const EVENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "On sale", label: "On sale" },
  { value: "Sold out", label: "Sold out" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Draft", label: "Draft" },
  { value: "Ended", label: "Ended" },
];
const AGENDA_FILTER_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "with", label: "With agenda" },
  { value: "without", label: "No agenda" },
];
const EVENT_SORT_OPTIONS = [
  { value: "date", label: "Sort: Date" },
  { value: "name", label: "Sort: Name" },
  { value: "sessions", label: "Sort: Sessions" },
];

// Session (level 2) status filter.
const SESSION_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...STATUS_VALUES.map((s) => ({ value: s, label: s })),
];

// Half-hour slots ("HH:mm" value, 12-hour label) for the time selects.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${min}`;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${hour12}:${min} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

const timeLabel = (v) => TIME_OPTIONS.find((t) => t.value === v)?.label || v;

const EMPTY_SESSION = {
  name: "",
  status: "Draft",
  day: "",
  startTime: "",
  endTime: "",
  track: "",
  room: "",
  speaker: "",
  description: "",
};

// --- Session dialog ----------------------------------------------------------

// Text input with a leading icon — the polished field style used across the
// session dialog.
function IconInput({ icon: Icon, className, ...props }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}

// Small uppercase group heading between dialog sections.
function GroupLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

// Human duration between two "HH:mm" values (null when unset or non-positive).
function durationLabel(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function SessionDialog({ open, onOpenChange, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_SESSION);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial || EMPTY_SESSION);
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the session a title first.");
      return;
    }
    onSave(draft);
    onOpenChange(false);
  };

  const duration = durationLabel(draft.startTime, draft.endTime);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">
              {initial ? "Edit session" : "Add session"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              One item on the running order — its time, track, room, and speaker.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="max-h-[65vh] overflow-y-auto">
            {/* Session */}
            <div className="space-y-4 p-5">
              <Field label="Session title" htmlFor="ses-title">
                <IconInput
                  icon={Type}
                  id="ses-title"
                  value={draft.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="e.g. Keynote: The Road Ahead"
                  autoFocus
                />
              </Field>
              <Field label="Status">
                <Tabs value={draft.status} onValueChange={set("status")}>
                  <TabsList className="w-full">
                    {STATUS_VALUES.map((s) => (
                      <TabsTrigger key={s} value={s}>
                        {s}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Field>
            </div>

            {/* Schedule */}
            <div className="space-y-4 border-t border-border bg-surface-subtle/30 p-5">
              <div className="flex items-center justify-between">
                <GroupLabel>Schedule</GroupLabel>
                {duration ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
                    <Timer className="h-3 w-3" /> {duration}
                  </span>
                ) : null}
              </div>
              <Field label="Day">
                <IconInput
                  icon={CalendarDays}
                  value={draft.day}
                  onChange={(e) => set("day")(e.target.value)}
                  placeholder="e.g. Day 1 · Tue"
                />
              </Field>
              <div className="flex gap-4">
                <Field label="Start time" className="flex-1">
                  <Select value={draft.startTime} onValueChange={set("startTime")}>
                    <SelectTrigger className="w-full">
                      <Clock className="mr-2 size-4 text-muted-foreground" />
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="End time" className="flex-1">
                  <Select value={draft.endTime} onValueChange={set("endTime")}>
                    <SelectTrigger className="w-full">
                      <Clock className="mr-2 size-4 text-muted-foreground" />
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Placement */}
            <div className="space-y-4 border-t border-border p-5">
              <GroupLabel>Placement</GroupLabel>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Track">
                  <IconInput
                    icon={LayoutGrid}
                    value={draft.track}
                    onChange={(e) => set("track")(e.target.value)}
                    placeholder="e.g. Main Stage"
                  />
                </Field>
                <Field label="Room">
                  <IconInput
                    icon={MapPin}
                    value={draft.room}
                    onChange={(e) => set("room")(e.target.value)}
                    placeholder="e.g. Room 2B"
                  />
                </Field>
              </div>
              <Field label="Speaker" hint="Optional">
                <IconInput
                  icon={Mic}
                  value={draft.speaker}
                  onChange={(e) => set("speaker")(e.target.value)}
                  placeholder="e.g. Ada Lovelace"
                />
              </Field>
            </div>

            {/* Description */}
            <div className="space-y-3 border-t border-border bg-surface-subtle/30 p-5">
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <AlignLeft className="h-3.5 w-3.5 text-text-tertiary" /> Description
                  </span>
                }
                hint="Optional"
              >
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder="What this session covers…"
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {initial ? (
                "Save session"
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add session
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Per-event builder -------------------------------------------------------

function AgendaBuilder({ event, sessions, onBack, onCreate, onUpdate, onDelete }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { id, session } | null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const trackOptions = useMemo(() => {
    const tracks = [
      ...new Set(sessions.map((s) => s.config.track?.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    return [
      { value: "all", label: "All tracks" },
      ...tracks.map((t) => ({ value: t, label: t })),
    ];
  }, [sessions]);

  const visible = useMemo(
    () =>
      sessions.filter((s) => {
        if (trackFilter !== "all" && (s.config.track?.trim() || "") !== trackFilter)
          return false;
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        return true;
      }),
    [sessions, trackFilter, statusFilter],
  );

  const clearFilters = () => {
    setTrackFilter("all");
    setStatusFilter("all");
  };

  // Group by day (first-seen order; unscheduled last), sessions sorted by start.
  const groups = useMemo(() => {
    const byDay = new Map();
    for (const s of visible) {
      const key = s.config.day?.trim() || "";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(s);
    }
    const ordered = [...byDay.entries()].sort((a, b) => {
      if (a[0] === "") return 1;
      if (b[0] === "") return -1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
    return ordered.map(([day, list]) => [
      day,
      [...list].sort((a, b) =>
        (a.config.startTime || "99:99").localeCompare(b.config.startTime || "99:99"),
      ),
    ]);
  }, [visible]);

  const stats = useMemo(
    () => [
      { label: "Sessions", value: String(sessions.length), footer: "On the agenda" },
      {
        label: "Days",
        value: String(new Set(sessions.map((s) => s.config.day?.trim()).filter(Boolean)).size),
        footer: "Scheduled",
      },
      {
        label: "Tracks",
        value: String(new Set(sessions.map((s) => s.config.track?.trim().toLowerCase()).filter(Boolean)).size),
        footer: "Parallel tracks",
      },
      {
        label: "Scheduled",
        value: String(sessions.filter((s) => s.status === "Scheduled" || s.status === "Live").length),
        footer: "Confirmed slots",
      },
    ],
    [sessions],
  );

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Agenda Builder
          </button>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {event.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {[event.date ? formatDate(event.date) : null, event.venue, event.city]
              .filter(Boolean)
              .join(" · ") || "Build the running order for this event."}
          </p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" /> Add session
        </Button>
      </div>

      <StatsBar stats={stats} />

      {sessions.length > 0 ? (
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={trackFilter}
              onValueChange={setTrackFilter}
              options={trackOptions}
              height="h-9"
            />
            <FilterDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={SESSION_STATUS_FILTER_OPTIONS}
              height="h-9"
            />
          </div>
          <span className="text-xs text-text-tertiary">
            {visible.length} of {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </span>
        </Toolbar>
      ) : null}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarClock}
            title="No sessions yet"
            description="Add your first session to start building this event's running order."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add session
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarClock}
            title="No sessions match your filters"
            description="Try a different track or status."
            action={
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([day, list]) => (
            <div key={day || "unscheduled"} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <CalendarDays className="h-4 w-4 text-text-secondary" />
                <h2 className="text-sm font-semibold text-foreground">
                  {day || "Unscheduled"}
                </h2>
                <span className="text-xs text-text-tertiary">
                  {list.length} session{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-4 rounded-xl border border-border bg-surface-card px-4 py-3"
                  >
                    <div className="w-20 shrink-0 pt-0.5">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {s.config.startTime ? timeLabel(s.config.startTime) : "—"}
                      </p>
                      {s.config.endTime ? (
                        <p className="text-xs tabular-nums text-text-tertiary">
                          {timeLabel(s.config.endTime)}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <StatusPill status={s.status} map={SESSION_STATUS_MAP} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                        {s.config.track ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                            {s.config.track}
                          </span>
                        ) : null}
                        {s.config.room ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {s.config.room}
                          </span>
                        ) : null}
                        {s.config.speaker ? (
                          <span className="inline-flex items-center gap-1">
                            <Mic className="h-3 w-3" /> {s.config.speaker}
                          </span>
                        ) : null}
                      </div>
                      {s.config.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">
                          {s.config.description}
                        </p>
                      ) : null}
                    </div>
                    <div onClick={(ev) => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 border-border bg-surface-card shadow-xl"
                        >
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                            onClick={() => setEditing({ id: s.id, session: sessionToDraft(s) })}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-surface-strong" />
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-4 w-4 text-red-300" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <SessionDialog open={addOpen} onOpenChange={setAddOpen} onSave={onCreate} />
      <SessionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing?.session}
        onSave={(draft) => {
          onUpdate(editing.id, draft);
          setEditing(null);
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> from
              the agenda? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

// Flatten a session record to the dialog's flat draft shape.
function sessionToDraft(s) {
  return { ...EMPTY_SESSION, ...s.config, name: s.name, status: s.status };
}

// --- Event picker (level 1) --------------------------------------------------

export function AgendaBuilderScreen() {
  const { projectId } = useProject();
  const { eventId, openEvent, closeEvent } = useWorkspaceUrl();
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agendaFilter, setAgendaFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listEvents(projectId),
      conferenceApi.list(projectId, "session"),
    ]).then(([evts, sess]) => {
      if (!alive) return;
      setEvents(evts ?? []);
      setSessions(sess ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selectedEvent = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) || null : null),
    [eventId, events],
  );

  const sessionCounts = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      const id = s.config.eventId;
      if (id) map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [sessions]);

  const eventSessions = useMemo(
    () => (selectedEvent ? sessions.filter((s) => s.config.eventId === selectedEvent.id) : []),
    [sessions, selectedEvent],
  );

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = events.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      const count = sessionCounts[e.id] || 0;
      if (agendaFilter === "with" && count === 0) return false;
      if (agendaFilter === "without" && count > 0) return false;
      if (q && !`${e.name} ${e.venue} ${e.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sessions")
        return (sessionCounts[b.id] || 0) - (sessionCounts[a.id] || 0);
      // date: soonest first, undated last.
      return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
    });
  }, [events, search, statusFilter, agendaFilter, sortBy, sessionCounts]);

  const hasEventFilters =
    search || statusFilter !== "all" || agendaFilter !== "all";
  const clearEventFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setAgendaFilter("all");
  };

  // --- Session mutations (optimistic + persisted) ---
  const handleCreate = (draft) => {
    const { name, status, ...rest } = draft;
    const record = {
      id: crypto.randomUUID(),
      module: "session",
      name: name.trim(),
      status,
      coverUrl: "",
      config: { ...rest, eventId: selectedEvent.id },
      createdBy: userId,
      projectId,
    };
    setSessions((prev) => [record, ...prev]);
    toast.success("Session added.");
    conferenceApi.create(record).then((saved) => {
      if (!saved) toast.error("Couldn't save the session.");
      else setSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    });
  };

  const handleUpdate = (id, draft) => {
    const { name, status, ...rest } = draft;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, name: name.trim(), status, config: { ...s.config, ...rest } }
          : s,
      ),
    );
    conferenceApi
      .update(id, {
        name: name.trim(),
        status,
        config: { ...rest, eventId: selectedEvent.id },
      })
      .then((saved) => {
        if (!saved) toast.error("Couldn't save your changes.");
      });
  };

  const handleDelete = (session) => {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    toast.success(`Deleted "${session.name}".`);
    conferenceApi.remove(session.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete the session.");
    });
  };

  if (selectedEvent) {
    return (
      <AgendaBuilder
        event={selectedEvent}
        sessions={eventSessions}
        onBack={closeEvent}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    );
  }

  const totalSessions = sessions.length;
  const stats = [
    { label: "Events", value: String(events.length), footer: "In this project" },
    { label: "With agenda", value: String(Object.keys(sessionCounts).length), footer: "Have sessions" },
    { label: "Sessions", value: String(totalSessions), footer: "Across all events" },
    {
      label: "Live sessions",
      value: String(sessions.filter((s) => s.status === "Live").length),
      footer: "On air now",
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Agenda Builder"
        description="Pick an event to build its running order — sessions, tracks, rooms, and speakers, sequenced day by day."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={EVENT_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={agendaFilter}
            onValueChange={setAgendaFilter}
            options={AGENDA_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={sortBy}
            onValueChange={setSortBy}
            options={EVENT_SORT_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search events…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarDays}
            title={events.length ? "No events match your filters" : "No events yet"}
            description={
              events.length
                ? "Try clearing the search, status, or agenda filters."
                : "Create an event under All Events, then build its agenda here."
            }
            action={
              hasEventFilters && events.length ? (
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={clearEventFilters}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((e) => {
            const count = sessionCounts[e.id] || 0;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => openEvent(e.id)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {[e.date ? formatDate(e.date) : null, e.venue, e.city]
                      .filter(Boolean)
                      .join(" · ") || "No date set"}
                  </p>
                </div>
                <StatusPill status={e.status} map={EVENT_STATUS_MAP} />
                <span className="hidden w-24 shrink-0 text-right text-xs font-medium text-text-secondary sm:block">
                  {count} session{count === 1 ? "" : "s"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  {count ? "Edit agenda" : "Build agenda"}
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default AgendaBuilderScreen;
