"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronRight,
  Download,
  Inbox,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { countRegs, PipelineBar } from "./pipeline";
import {
  RegistrationDrawer,
  AddRegistrantDialog,
  RemoveRegistrationDialog,
} from "./registration_drawer";
import { EventRegistrationsDetail } from "./event_registrations";
import { downloadCsv } from "./csv";

// Render caps so the hub stays light with hundreds of events / thousands of
// people — refine with search or "show more" to go past them.
const PAGE_EVENTS = 60;
const PAGE_PEOPLE = 100;

// Two-letter avatar seed for a person row.
function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// One event's registration funnel as a clickable card — the hub's main unit.
function EventCard({ event, counts, onOpen }) {
  const cap = event.capacity || 0;
  const full = cap > 0 && counts.seats >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round((counts.seats / cap) * 100)) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary transition-colors group-hover:text-foreground">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="w-px self-stretch bg-border" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{event.name}</span>
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
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {counts.seats}
                <span className="font-normal text-text-secondary">/{cap || "∞"}</span>
              </span>
              {pct !== null ? (
                <p className="text-[11px] text-text-tertiary tabular-nums">{pct}% full</p>
              ) : null}
            </div>
            <ChevronRight className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-foreground" />
          </div>
        </div>
        <PipelineBar counts={counts} capacity={cap} />
      </div>
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
    toast.success(`Exported ${regs.length} Registrations.`);
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

  // People view renders through the shared DataTable, matching All Events.
  const peopleColumns = [
    {
      key: "person",
      header: "Person",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-text-secondary">
            {initials(r.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground">
                {r.name || "Unnamed"}
              </span>
              {r.partySize > 1 ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-card px-1.5 py-0.5 text-[11px] font-medium text-text-secondary tabular-nums">
                  <UserPlus className="h-3 w-3" />
                  {r.partySize - 1}
                </span>
              ) : null}
            </div>
            <span className="block truncate text-xs text-text-secondary">
              {r.email || "No email"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {eventNames[r.eventId] || "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (r) => (
        <Badge variant={SOURCE_MAP[r.source]?.variant || "neutral"}>
          {r.source}
        </Badge>
      ),
    },
    {
      key: "registered",
      header: "Registered",
      render: (r) => (
        <span className="text-xs text-text-secondary tabular-nums">
          {r.createdAt ? formatDate(r.createdAt) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      className: "text-right",
      render: (r) => <StatusPill status={r.status} map={REGISTRATION_STATUS_MAP} />,
    },
  ];

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

      <Toolbar>
        {/* Search on the left. */}
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

        {/* Events / People view switch. */}
        <div className="flex h-10 w-fit shrink-0 items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
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
        <>
          <DataTable
            columns={peopleColumns}
            data={peopleFiltered.slice(0, peopleLimit)}
            getRowKey={(r) => r.id}
            onRowClick={(r) => setPeopleOpenId(r.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Users}
                  title="No one matches your search"
                  description="Try a different name, email, or event."
                />
              </div>
            }
          />
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
