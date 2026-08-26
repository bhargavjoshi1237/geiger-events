"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { EventMap } from "@/components/internal/screens/events/event_map";
import {
  WEEKDAY_INITIALS,
  eventDays,
  locatedEvents,
  monthGrid,
  monthLabel,
  parseISO,
  todayISO,
} from "./wall_agenda";

function CalendarCard({ events, day, onDay, accent }) {
  const today = todayISO();
  const anchor = parseISO(day) || parseISO(events[0]?.date) || parseISO(today);
  const [cursor, setCursor] = useState({
    year: anchor.year,
    month: anchor.monthIndex,
  });

  const days = useMemo(() => eventDays(events), [events]);
  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const step = (delta) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="ev-surface rounded-2xl border border-border bg-surface-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-semibold text-foreground">
          {monthLabel(cursor.year, cursor.month)}
        </p>
        <div className="flex items-center gap-1 text-text-secondary">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-active hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = parseISO(today);
              setCursor({ year: t.year, month: t.monthIndex });
            }}
            aria-label="Jump to this month"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-active hover:text-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next month"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-active hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span
            key={`${initial}-${i}`}
            className="pb-1 text-center text-xs font-medium text-text-tertiary"
          >
            {initial}
          </span>
        ))}
        {cells.map((cell) => {
          const has = days.has(cell.iso);
          const picked = day === cell.iso;
          const isToday = cell.iso === today;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!has}
              onClick={() => onDay(picked ? "" : cell.iso)}
              aria-pressed={picked}
              className={cn(
                "relative mx-auto flex h-7 w-7 flex-col items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                has
                  ? "font-semibold text-foreground hover:bg-surface-active"
                  : "cursor-default",
                !has && (cell.inMonth ? "text-text-secondary" : "text-text-tertiary/50"),
              )}
              style={
                picked
                  ? { backgroundColor: accent.color, color: accent.text }
                  : isToday && !picked
                    ? { color: accent.color }
                    : undefined
              }
            >
              {cell.day}
              {has ? (
                <span
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full"
                  style={{ backgroundColor: picked ? accent.text : accent.color }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusToggle({ status, onStatus, accent }) {
  return (
    <div className="ev-surface mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-subtle p-1">
      {["upcoming", "past"].map((key) => {
        const active = status === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onStatus(key)}
            className={cn(
              "rounded-lg py-1.5 text-sm font-medium capitalize transition-colors",
              active ? "" : "text-text-secondary hover:text-foreground",
            )}
            style={
              active
                ? { backgroundColor: accent.color, color: accent.text }
                : undefined
            }
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

function MapCard({ events }) {
  const located = useMemo(() => locatedEvents(events), [events]);
  if (!located.length) return null;

  const [lead, ...rest] = located;
  const places = rest.map(({ event, lat, lng }) => ({
    name: event.name,
    kind: "Venue",
    detail: [event.venue, event.city].filter(Boolean).join(", "),
    lat,
    lng,
  }));

  return (
    <EventMap
      className="mt-3 h-[230px]"
      coords={{ lat: lead.lat, lng: lead.lng }}
      places={places}
      label={lead.event.name}
      address={[lead.event.venue, lead.event.city].filter(Boolean).join(", ")}
    />
  );
}

export function WallSidebar({ events, status, onStatus, day, onDay, accent }) {
  return (
    <aside className="order-first lg:sticky lg:top-6 lg:order-none">
      <CalendarCard events={events} day={day} onDay={onDay} accent={accent} />
      <StatusToggle status={status} onStatus={onStatus} accent={accent} />
      <MapCard events={events} />
    </aside>
  );
}

export default WallSidebar;
