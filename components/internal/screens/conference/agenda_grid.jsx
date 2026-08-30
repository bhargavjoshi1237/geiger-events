"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Inbox,
  MapPin,
  Mic,
  Plus,
  Trash2,
} from "lucide-react";

import { Button, cn, SegmentedTabs } from "@geiger/ui";
import {
  agendaDays,
  agendaTracks,
  findConflicts,
  minutesToLabel,
  sessionDuration,
  sessionStart,
  toTimeValue,
} from "@/lib/agenda/sessions";

const PX_PER_MIN = 1.4;
const SNAP_MIN = 15;
const DEFAULT_WINDOW = { from: 8 * 60, to: 18 * 60 };
const MIN_BLOCK_MIN = 30;

const TRACK_STYLES = [
  { bar: "bg-orange-400", tint: "bg-orange-500/10", text: "text-orange-300" },
  { bar: "bg-sky-400", tint: "bg-sky-500/10", text: "text-sky-300" },
  { bar: "bg-violet-400", tint: "bg-violet-500/10", text: "text-violet-300" },
  { bar: "bg-emerald-400", tint: "bg-emerald-500/10", text: "text-emerald-300" },
  { bar: "bg-amber-400", tint: "bg-amber-500/10", text: "text-amber-300" },
  { bar: "bg-pink-400", tint: "bg-pink-500/10", text: "text-pink-300" },
];

export const trackStyle = (i) => TRACK_STYLES[((i % 6) + 6) % 6];

const UNTRACKED = "__untracked__";

const snap = (mins) =>
  Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.round(mins / SNAP_MIN) * SNAP_MIN));

function DayTabs({ days, value, onChange }) {
  if (days.length < 2) return null;
  return (
    <SegmentedTabs
      tabs={days.map((day) => ({ value: day, label: day, icon: CalendarDays }))}
      value={value}
      onChange={onChange}
    />
  );
}

function ConflictBanner({ pairs, onEdit }) {
  if (!pairs.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        {pairs.length} double-booking{pairs.length === 1 ? "" : "s"} on this day
      </div>
      <div className="space-y-1">
        {pairs.map((pair) => (
          <div
            key={`${pair.kind}-${pair.a.id}-${pair.b.id}`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-200/90"
          >
            <span className="font-medium">{pair.value}</span>
            <span className="text-amber-200/60">
              is booked for {pair.a.name} and {pair.b.name} at the same time
            </span>
            <button
              type="button"
              onClick={() => onEdit(pair.b)}
              className="rounded-md bg-amber-400/20 px-2 py-0.5 font-medium text-amber-100 transition-colors hover:bg-amber-400/30"
            >
              Move {pair.b.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionBlock({ session, top, height, style, conflicted, onEdit, onDelete, onDragStart }) {
  const start = sessionStart(session);
  const end = start + sessionDuration(session);
  const compact = height < 64;
  const timeRange =
    start != null ? `${minutesToLabel(start)} – ${minutesToLabel(end)}` : "unscheduled";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, session)}
      role="button"
      tabIndex={0}
      aria-label={`${session.name}, ${timeRange}`}
      onClick={() => onEdit(session)}
      onKeyDown={(e) => e.key === "Enter" && onEdit(session)}
      style={{ top, height }}
      className={cn(
        "group absolute inset-x-1 cursor-grab overflow-hidden rounded-lg border pl-2 pr-1 py-1.5 text-left transition-colors active:cursor-grabbing",
        conflicted
          ? "border-amber-500/50 bg-amber-500/10"
          : `border-border ${style.tint} hover:border-border-strong`,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          conflicted ? "bg-amber-400" : style.bar,
        )}
      />
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {session.name}
        </p>
        <button
          type="button"
          aria-label={`Delete ${session.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session);
          }}
          className="shrink-0 rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {!compact ? (
        <>
          <p
            className={cn(
              "truncate text-[11px] tabular-nums",
              conflicted ? "text-amber-300" : style.text,
            )}
          >
            {minutesToLabel(start)} – {minutesToLabel(end)}
          </p>
          {height > 88 ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-secondary">
              {session.config?.room ? (
                <span className="inline-flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5" /> {session.config.room}
                </span>
              ) : null}
              {session.config?.speaker ? (
                <span className="inline-flex items-center gap-0.5 truncate">
                  <Mic className="h-2.5 w-2.5" /> {session.config.speaker}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function UnscheduledTray({ sessions, onEdit, onDragStart }) {
  if (!sessions.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-3">
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-text-secondary" />
        <p className="text-sm font-medium text-foreground">Unscheduled</p>
        <span className="text-xs text-text-tertiary">
          {sessions.length} session{sessions.length === 1 ? "" : "s"} · drag onto the grid
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            draggable
            onDragStart={(e) => onDragStart(e, session)}
            role="button"
            tabIndex={0}
            aria-label={`${session.name}, unscheduled`}
            onClick={() => onEdit(session)}
            onKeyDown={(e) => e.key === "Enter" && onEdit(session)}
            className="cursor-grab rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-border-strong active:cursor-grabbing"
          >
            {session.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgendaGrid({
  sessions,
  allSessions,
  onEdit,
  onDelete,
  onReschedule,
  onAddAt,
}) {
  const everySession = allSessions || sessions;
  const days = useMemo(() => agendaDays(everySession), [everySession]);
  const [day, setDay] = useState(() => days[0] || "");
  const activeDay = days.includes(day) ? day : days[0] || "";

  const grabOffset = useRef(0);
  const gridRef = useRef(null);

  const tracks = useMemo(() => agendaTracks(everySession), [everySession]);
  const columns = tracks.length ? tracks : [UNTRACKED];

  const dayScheduled = useMemo(
    () =>
      sessions.filter(
        (s) => (s.config?.day || "").trim() === activeDay && sessionStart(s) != null,
      ),
    [sessions, activeDay],
  );

  const unscheduled = useMemo(
    () => sessions.filter((s) => sessionStart(s) == null),
    [sessions],
  );

  const conflicts = useMemo(() => findConflicts(everySession), [everySession]);
  const dayConflicts = useMemo(
    () =>
      conflicts.pairs.filter(
        (pair) => (pair.a.config?.day || "").trim() === activeDay,
      ),
    [conflicts, activeDay],
  );

  const window = useMemo(() => {
    if (!dayScheduled.length) return DEFAULT_WINDOW;
    const starts = dayScheduled.map(sessionStart);
    const ends = dayScheduled.map((s) => sessionStart(s) + sessionDuration(s));
    return {
      from: Math.floor(Math.min(...starts) / 60) * 60,
      to: Math.max(Math.ceil(Math.max(...ends) / 60) * 60, Math.floor(Math.min(...starts) / 60) * 60 + 120),
    };
  }, [dayScheduled]);

  const span = window.to - window.from;
  const gridHeight = span * PX_PER_MIN;
  const hours = [];
  for (let m = window.from; m <= window.to; m += 60) hours.push(m);

  const handleDragStart = (e, session) => {
    e.dataTransfer.setData("text/plain", session.id);
    e.dataTransfer.effectAllowed = "move";
    const start = sessionStart(session);
    if (start == null) {
      grabOffset.current = 0;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    grabOffset.current = (e.clientY - rect.top) / PX_PER_MIN;
  };

  const handleDrop = (track) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const session = sessions.find((s) => s.id === id);
    if (!session || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const dropped = window.from + (e.clientY - rect.top) / PX_PER_MIN - grabOffset.current;
    const start = snap(dropped);
    const duration = Math.max(MIN_BLOCK_MIN, sessionDuration(session));

    onReschedule(session, {
      day: activeDay,
      track: track === UNTRACKED ? session.config?.track || "" : track,
      startTime: toTimeValue(start),
      endTime: toTimeValue(Math.min(24 * 60 - 1, start + duration)),
    });
  };

  const handleColumnClick = (track) => (e) => {
    if (!onAddAt || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const start = snap(window.from + (e.clientY - rect.top) / PX_PER_MIN);
    onAddAt({
      day: activeDay,
      track: track === UNTRACKED ? "" : track,
      startTime: toTimeValue(start),
      endTime: toTimeValue(start + 60),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {days.length > 1 ? <DayTabs days={days} value={activeDay} onChange={setDay} /> : null}
        <span className="text-xs text-text-tertiary">
          Drag a session to move it; click an empty slot to add one.
        </span>
      </div>

      <ConflictBanner pairs={dayConflicts} onEdit={onEdit} />

      <UnscheduledTray
        sessions={unscheduled}
        onEdit={onEdit}
        onDragStart={handleDragStart}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
        <div className="min-w-[640px]">
          <div className="flex border-b border-border">
            <div className="w-20 shrink-0" />
            {columns.map((track, i) => (
              <div key={track} className="min-w-0 flex-1 px-2 py-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", trackStyle(i).bar)} />
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {track === UNTRACKED ? "All sessions" : track}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="relative w-20 shrink-0" style={{ height: gridHeight }}>
              {hours.map((mins) => (
                <span
                  key={mins}
                  style={{ top: (mins - window.from) * PX_PER_MIN }}
                  className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-text-tertiary"
                >
                  {minutesToLabel(mins)}
                </span>
              ))}
            </div>

            <div ref={gridRef} className="relative flex flex-1" style={{ height: gridHeight }}>
              {hours.map((mins) => (
                <span
                  key={mins}
                  style={{ top: (mins - window.from) * PX_PER_MIN }}
                  className="pointer-events-none absolute inset-x-0 h-px bg-border"
                />
              ))}

              {columns.map((track, i) => {
                const style = trackStyle(i);
                const blocks = dayScheduled.filter((s) =>
                  track === UNTRACKED
                    ? true
                    : (s.config?.track || "").trim() === track,
                );
                return (
                  <div
                    key={track}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={handleDrop(track)}
                    onClick={handleColumnClick(track)}
                    className="relative min-w-0 flex-1 border-l border-border first:border-l-0"
                  >
                    {blocks.map((session) => {
                      const start = sessionStart(session);
                      const duration = sessionDuration(session);
                      return (
                        <SessionBlock
                          key={session.id}
                          session={session}
                          top={(start - window.from) * PX_PER_MIN}
                          height={Math.max(28, duration * PX_PER_MIN - 4)}
                          style={style}
                          conflicted={conflicts.ids.has(session.id)}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onDragStart={handleDragStart}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!dayScheduled.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-8 text-center">
          <CalendarDays className="h-5 w-5 text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            Nothing scheduled{activeDay ? ` on ${activeDay}` : ""} yet.
          </p>
          {onAddAt ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onAddAt({ day: activeDay, track: "", startTime: "09:00", endTime: "10:00" })
              }
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add a session
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default AgendaGrid;
