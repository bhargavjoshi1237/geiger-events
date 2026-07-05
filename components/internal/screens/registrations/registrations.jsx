"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Clock,
  Download,
  Inbox,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import {
  listRegistrations,
  createRegistration,
  updateRegistration,
  softDeleteRegistration,
} from "@/lib/supabase/registrations";
import { getUser } from "@/lib/supabase/user";
import {
  REGISTRATION_STATUS_MAP,
  SOURCE_MAP,
  EVENT_TYPE_MAP_LITE,
  formatDate,
  formatDateTime,
} from "./constants";
import { countRegs, PipelineBar, PipelineChips } from "./pipeline";
import {
  RegistrationDrawer,
  AddRegistrantDialog,
  RemoveRegistrationDialog,
} from "./registration_drawer";
import { EventRegistrationsDetail } from "./event_registrations";
import { downloadCsv } from "./csv";

const todayIso = () => new Date().toISOString().slice(0, 10);

// Render caps so the hub stays light with hundreds of events / thousands of
// people — refine with search or "show more" to go past them.
const PAGE_EVENTS = 60;
const PAGE_PEOPLE = 100;

// An "action chip" in the Needs Attention strip — a number that does something.
function ActionChip({ icon: Icon, value, label, tone, onClick, disabled }) {
  const tones = {
    amber: "text-zinc-400",
    violet: "text-zinc-300",
    sky: "text-zinc-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-left transition-colors",
        disabled
          ? "cursor-default opacity-70"
          : "hover:border-border-strong hover:bg-surface-hover",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card",
          tones[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-text-secondary capitalize">{label}</p>
      </div>
      {!disabled ? (
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-text-tertiary" />
      ) : null}
    </button>
  );
}

// One event's registration funnel as a clickable card — the hub's main unit.
function EventCard({ event, counts, onOpen }) {
  const cap = event.capacity || 0;
  const full = cap > 0 && counts.seats >= cap;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{event.name}</span>
            <Badge variant={EVENT_TYPE_MAP_LITE[event.type] || "neutral"}>
              {event.type}
            </Badge>
            {full ? (
              <span className="text-[11px] font-medium uppercase tracking-wide text-red-400">
                Full
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">{formatDate(event.date)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="font-semibold text-foreground tabular-nums">
            {counts.seats}
            <span className="font-normal text-text-secondary">/{cap || "∞"}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-foreground" />
        </div>
      </div>
      <PipelineBar counts={counts} capacity={cap} />
      <PipelineChips counts={counts} />
    </button>
  );
}

export function RegistrationsScreen() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("events"); // events | people
  const [eventLimit, setEventLimit] = useState(PAGE_EVENTS);
  const [peopleLimit, setPeopleLimit] = useState(PAGE_PEOPLE);
  const [openEventId, setOpenEventId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [peopleOpenId, setPeopleOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { setTab } = useWorkspaceUrl();
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listRegistrations(projectId), listEvents(projectId)]).then(([rows, evts]) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setEvents(evts ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  const eventNames = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e.name;
    return m;
  }, [events]);

  const regsByEvent = useMemo(() => {
    const m = {};
    for (const r of regs) (m[r.eventId] ||= []).push(r);
    return m;
  }, [regs]);

  // Event cards: every event that has registrations, most-actionable first.
  const eventCards = useMemo(() => {
    return events
      .map((event) => ({
        event,
        list: regsByEvent[event.id] || [],
        counts: countRegs(regsByEvent[event.id] || []),
      }))
      .filter((c) => c.list.length > 0)
      .filter((c) =>
        search ? c.event.name.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .sort((a, b) => {
        const aAct = a.counts.Pending + a.counts.Waitlisted;
        const bAct = b.counts.Pending + b.counts.Waitlisted;
        if (aAct !== bAct) return bAct - aAct;
        return b.counts.total - a.counts.total;
      });
  }, [events, regsByEvent, search]);

  // Needs-attention tallies.
  const attention = useMemo(() => {
    const today = todayIso();
    const pending = regs.filter((r) => r.status === "Pending").length;
    const waitlisted = regs.filter((r) => r.status === "Waitlisted").length;
    const newToday = regs.filter(
      (r) => (r.createdAt || "").slice(0, 10) === today,
    ).length;
    return { pending, waitlisted, newToday };
  }, [regs]);

  // --- Mutations (optimistic + persisted) — shared by both views & detail. ---
  const handleCreate = (draft) => {
    const reg = {
      id: crypto.randomUUID(),
      eventId: draft.eventId,
      name: draft.name.trim(),
      email: (draft.email || "").trim(),
      phone: (draft.phone || "").trim(),
      status: draft.status || "Confirmed",
      source: "Organizer",
      partySize: Number(draft.partySize) || 1,
      plusOnes: [],
      dietary: (draft.dietary || "").trim(),
      accessibility: (draft.accessibility || "").trim(),
      answers: {},
      waitlistPosition: null,
      createdBy: userId,
      projectId,
      createdAt: new Date().toISOString(),
    };
    setRegs((prev) => [reg, ...prev]);
    toast.success(`Added ${reg.name}.`);
    createRegistration(reg).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the registration to the server.");
      else setRegs((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    });
  };

  const handleStatusChange = (reg, next) => {
    if (reg.status === next) return;
    setRegs((prev) =>
      prev.map((r) => (r.id === reg.id ? { ...r, status: next } : r)),
    );
    toast.success(`${reg.name} → ${next}.`);
    updateRegistration(reg.id, { status: next }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
    });
  };

  const handleBulkStatus = (ids, next) => {
    const idSet = new Set(ids);
    setRegs((prev) =>
      prev.map((r) => (idSet.has(r.id) ? { ...r, status: next } : r)),
    );
    toast.success(`${ids.length} updated → ${next}.`);
    ids.forEach((id) =>
      updateRegistration(id, { status: next }).then((res) => {
        if (res === false) toast.error("Some changes didn't save.");
      }),
    );
  };

  const handleDelete = (reg) => {
    setRegs((prev) => prev.filter((r) => r.id !== reg.id));
    toast.success(`Removed ${reg.name}.`);
    softDeleteRegistration(reg.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const handleExportAll = () => {
    if (!regs.length) {
      toast.error("No registrations to export yet.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Event", value: (r) => eventNames[r.eventId] || "" },
        { header: "Status", value: (r) => r.status },
        { header: "Source", value: (r) => r.source },
        { header: "Party", value: (r) => r.partySize },
        { header: "Dietary", value: (r) => r.dietary },
        { header: "Accessibility", value: (r) => r.accessibility },
        { header: "Registered", value: (r) => formatDateTime(r.createdAt) },
      ],
      regs,
      "registrations.csv",
    );
    toast.success(`Exported ${regs.length} registrations.`);
  };

  // --- Per-event detail takes over the screen when an event is open. ---
  const openEvent = events.find((e) => e.id === openEventId) || null;
  if (openEvent) {
    return (
      <EventRegistrationsDetail
        event={openEvent}
        regs={regsByEvent[openEvent.id] || []}
        eventNames={eventNames}
        onBack={() => setOpenEventId(null)}
        onStatusChange={handleStatusChange}
        onBulkStatus={handleBulkStatus}
        onDelete={handleDelete}
        onCreate={handleCreate}
      />
    );
  }

  // People-view: a flat, searchable cross-event list for lookups & export.
  const peopleFiltered = regs.filter((r) =>
    search
      ? `${r.name} ${r.email} ${eventNames[r.eventId] || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  );
  const peopleSelected = regs.find((r) => r.id === peopleOpenId) || null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Registrations"
        description="Everyone coming to your events — organised by event, with what needs your attention up top."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleExportAll}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCreateOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Add registrant
            </Button>
          </div>
        }
      />

      {/* Needs attention — actionable counts that link to the right queue. */}
      {!loading && regs.length ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionChip
            icon={ShieldCheck}
            value={attention.pending}
            label={attention.pending ? "waiting for approval" : "nothing to approve"}
            tone="amber"
            disabled={!attention.pending}
            onClick={() => setTab("Approval Gates")}
          />
          <ActionChip
            icon={Clock}
            value={attention.waitlisted}
            label={attention.waitlisted ? "on a waitlist" : "no one waiting"}
            tone="violet"
            disabled={!attention.waitlisted}
            onClick={() => setTab("Waitlist")}
          />
          <ActionChip
            icon={Sparkles}
            value={attention.newToday}
            label="registered today"
            tone="sky"
            disabled
          />
        </div>
      ) : null}

      <Toolbar>
        {/* Events / People view switch. */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
          {[
            { key: "events", label: "By event", icon: Inbox },
            { key: "people", label: "All people", icon: Users },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-surface-hover text-foreground"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setEventLimit(PAGE_EVENTS);
            setPeopleLimit(PAGE_PEOPLE);
          }}
          placeholder={view === "events" ? "Search events…" : "Search name, email, event…"}
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading registrations…
        </div>
      ) : view === "events" ? (
        eventCards.length ? (
          <>
            <div className="grid gap-3">
              {eventCards.slice(0, eventLimit).map(({ event, counts }) => (
                <EventCard
                  key={event.id}
                  event={event}
                  counts={counts}
                  onOpen={() => setOpenEventId(event.id)}
                />
              ))}
            </div>
            {eventCards.length > eventLimit ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setEventLimit((l) => l + PAGE_EVENTS)}
                >
                  Show more events ({eventCards.length - eventLimit} left)
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={UserPlus}
              title={regs.length ? "No events match your search" : "No registrations yet"}
              description={
                regs.length
                  ? "Try a different search."
                  : "Registrations from your event pages land here, grouped by event. You can also add one by hand."
              }
              action={
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setCreateOpen(true)}
                >
                  <UserPlus className="h-4 w-4" /> Add registrant
                </Button>
              }
            />
          </div>
        )
      ) : (
        peopleFiltered.length ? (
          <>
            <p className="text-sm text-text-tertiary">
              {search
                ? `${peopleFiltered.length.toLocaleString()} match`
                : `${regs.length.toLocaleString()} ${regs.length === 1 ? "registration" : "registrations"}`}
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
              <div className="divide-y divide-border">
                {peopleFiltered.slice(0, peopleLimit).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPeopleOpenId(r.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.name || "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {r.email || "No email"} · {eventNames[r.eventId] || "—"}
                      </p>
                    </div>
                    <Badge
                      variant={SOURCE_MAP[r.source]?.variant || "neutral"}
                      className="hidden sm:inline-flex"
                    >
                      {r.source}
                    </Badge>
                    <StatusPill status={r.status} map={REGISTRATION_STATUS_MAP} />
                  </button>
                ))}
              </div>
            </div>
            {peopleFiltered.length > peopleLimit ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setPeopleLimit((l) => l + PAGE_PEOPLE)}
                >
                  Show more ({peopleFiltered.length - peopleLimit} left)
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Users}
              title="No one matches your search"
              description="Try a different name, email, or event."
            />
          </div>
        )
      )}

      <AddRegistrantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        events={events}
        onCreate={handleCreate}
      />

      <RegistrationDrawer
        reg={peopleSelected}
        eventName={peopleSelected ? eventNames[peopleSelected.eventId] : ""}
        onStatusChange={handleStatusChange}
        onDelete={(r) => setDeleteTarget(r)}
        onClose={() => setPeopleOpenId(null)}
      />

      <RemoveRegistrationDialog
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(r) => {
          handleDelete(r);
          setDeleteTarget(null);
          setPeopleOpenId(null);
        }}
      />
    </MainScreenWrapper>
  );
}

export default RegistrationsScreen;
