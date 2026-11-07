"use client";

import React, { useMemo } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { Button, SegmentedTabs, cn } from "@geiger/ui";
import { blackoutOn, bookingDisplayStatus, dayWindow, isBlocking } from "@/lib/venue_booking/availability";
import {
  DAY_MINUTES,
  MINUTE_MS,
  WEEKDAY_KEYS,
  addDays,
  formatInZone,
  parseDateString,
  safeTimeZone,
  toWall,
  weekStart,
} from "@/lib/venue_booking/time";

// Spaces as rows, venue-local days/hours as columns; bookings as bars. Clicking empty time starts a booking.

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 200;
const PX_PER_HOUR = { week: 14, day: 56 };
const DEFAULT_WINDOW = { from: 7 * 60, to: 23 * 60 };
const SNAP = 30;

const BAR_STYLES = {
  Confirmed: "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200",
  Completed: "border-border bg-surface-active text-text-secondary",
  Hold: "border-dashed border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  "Hold expired": "border-dashed border-border bg-transparent text-text-tertiary",
};

// Shared hour range for the visible days: opening hours (all-day spaces use 07–23) plus any booking.
function visibleWindow(spaces, days, bookings, tzOf) {
  let from = Infinity;
  let to = -Infinity;
  for (const space of spaces) {
    for (const date of days) {
      const win = dayWindow(space.openingHours, WEEKDAY_KEYS[new Date(parseDateString(date)).getUTCDay()]);
      if (!win) continue;
      const allDay = win.open === 0 && win.close === DAY_MINUTES;
      from = Math.min(from, allDay ? DEFAULT_WINDOW.from : win.open);
      to = Math.max(to, allDay ? DEFAULT_WINDOW.to : win.close);
    }
  }
  if (!Number.isFinite(from)) ({ from, to } = DEFAULT_WINDOW);
  const spaceIds = new Set(spaces.map((s) => s.id));
  for (const b of bookings) {
    if (!spaceIds.has(b.spaceId) || b.status === "cancelled") continue;
    const tz = tzOf(b.spaceId);
    for (const date of days) {
      const day = parseDateString(date);
      const s = (toWall(b.startsAt, tz) - day) / MINUTE_MS;
      const e = (toWall(b.endsAt, tz) - day) / MINUTE_MS;
      if (e <= 0 || s >= DAY_MINUTES) continue;
      from = Math.min(from, Math.max(0, s));
      to = Math.max(to, Math.min(DAY_MINUTES, e));
    }
  }
  return { from: Math.floor(from / 60) * 60, to: Math.min(DAY_MINUTES, Math.ceil(to / 60) * 60) };
}

function DayCell({ space, date, tz, range, pxPerMin, bookings, now, onSlotClick, onBookingClick }) {
  const day = parseDateString(date);
  const span = range.to - range.from;
  const width = span * pxPerMin;
  const blackout = blackoutOn(space.blackoutDates, date);
  const win = dayWindow(space.openingHours, WEEKDAY_KEYS[new Date(day).getUTCDay()]);
  const clip = (m) => Math.max(range.from, Math.min(range.to, m));
  const nowMin = (toWall(now, tz) - day) / MINUTE_MS;

  const shades = [];
  if (blackout || !win) {
    shades.push([range.from, range.to]);
  } else {
    if (win.open > range.from) shades.push([range.from, clip(win.open)]);
    if (win.close < range.to) shades.push([clip(win.close), range.to]);
  }

  const bars = [];
  for (const b of bookings) {
    if (b.spaceId !== space.id || b.status === "cancelled") continue;
    const s = (toWall(b.startsAt, tz) - day) / MINUTE_MS;
    const e = (toWall(b.endsAt, tz) - day) / MINUTE_MS;
    if (e <= range.from || s >= range.to) continue;
    const blocking = isBlocking(b, now);
    const bufferEnd = blocking && b.blockedUntil ? (toWall(b.blockedUntil, tz) - day) / MINUTE_MS : e;
    bars.push({ booking: b, from: clip(s), to: clip(e), bufferTo: clip(bufferEnd), status: bookingDisplayStatus(b, now) });
  }

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = range.from + (e.clientX - rect.left) / pxPerMin;
    const snapped = Math.max(range.from, Math.min(range.to - SNAP, Math.floor(minute / SNAP) * SNAP));
    onSlotClick?.({ spaceId: space.id, date, minute: snapped });
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={handleClick}
      title={blackout ? `Blackout${blackout.reason ? ` — ${blackout.reason}` : ""}` : !win ? "Closed" : "Click to book"}
      style={{ width, height: ROW_HEIGHT }}
      className="relative shrink-0 cursor-pointer border-l border-border hover:bg-surface-hover/50"
    >
      {nowMin > range.from && nowMin < range.to + 1 ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-surface-active/30"
          style={{ width: (Math.min(nowMin, range.to) - range.from) * pxPerMin }}
        />
      ) : nowMin >= range.to ? (
        <span className="pointer-events-none absolute inset-0 bg-surface-active/30" />
      ) : null}
      {shades.map(([a, b]) =>
        b > a ? (
          <span
            key={`${a}-${b}`}
            className={cn(
              "pointer-events-none absolute inset-y-0",
              blackout ? "bg-red-500/10" : "bg-surface-active/70",
            )}
            style={{ left: (a - range.from) * pxPerMin, width: (b - a) * pxPerMin }}
          />
        ) : null,
      )}
      {bars.map(({ booking, from, to, bufferTo, status }) => (
        <React.Fragment key={booking.id}>
          {bufferTo > to ? (
            <span
              className="pointer-events-none absolute top-3 bottom-3 rounded-r-sm bg-sky-500/10"
              style={{ left: (to - range.from) * pxPerMin, width: (bufferTo - to) * pxPerMin }}
              title="Turnover buffer"
            />
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBookingClick?.(booking);
            }}
            title={`${booking.reference} · ${status}${booking.title ? ` · ${booking.title}` : ""}`}
            className={cn(
              "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-medium leading-tight",
              BAR_STYLES[status] || BAR_STYLES.Confirmed,
            )}
            style={{ left: (from - range.from) * pxPerMin, width: Math.max(4, (to - from) * pxPerMin) }}
          >
            <span className="block truncate pt-1">{booking.title || booking.reference}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function AvailabilityTimeline({
  spaces,
  venueById,
  bookings,
  now,
  anchor,
  onAnchorChange,
  mode,
  onModeChange,
  onSlotClick,
  onBookingClick,
}) {
  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    const start = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor, mode]);

  const tzOf = useMemo(() => {
    const bySpace = new Map(spaces.map((s) => [s.id, safeTimeZone(venueById.get(s.venueId)?.timezone)]));
    return (spaceId) => bySpace.get(spaceId) || "UTC";
  }, [spaces, venueById]);

  const range = useMemo(() => visibleWindow(spaces, days, bookings, tzOf), [spaces, days, bookings, tzOf]);
  const pxPerMin = PX_PER_HOUR[mode] / 60;
  const dayWidth = (range.to - range.from) * pxPerMin;
  const tickEvery = mode === "day" ? 60 : 180;
  const ticks = [];
  for (let m = range.from; m < range.to; m += tickEvery) ticks.push(m);

  // Group rows by venue so a multi-venue project reads cleanly.
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of spaces) {
      const list = map.get(s.venueId) || [];
      list.push(s);
      map.set(s.venueId, list);
    }
    return [...map.entries()]
      .map(([venueId, list]) => ({ venue: venueById.get(venueId), spaces: list }))
      .sort((a, b) => (a.venue?.name || "").localeCompare(b.venue?.name || ""));
  }, [spaces, venueById]);

  const step = mode === "day" ? 1 : 7;
  const rangeLabel =
    mode === "day"
      ? formatInZone(`${anchor}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : `${formatInZone(`${days[0]}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })} – ${formatInZone(`${days[6]}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => onAnchorChange(addDays(anchor, -step))}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => onAnchorChange(addDays(anchor, step))}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">{rangeLabel}</span>
        </div>
        <SegmentedTabs
          tabs={[
            { value: "day", label: "Day", icon: CalendarDays },
            { value: "week", label: "Week", icon: CalendarRange },
          ]}
          value={mode}
          onChange={onModeChange}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
        <div style={{ minWidth: LABEL_WIDTH + dayWidth * days.length }}>
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-10 shrink-0 bg-surface-subtle" style={{ width: LABEL_WIDTH }} />
            {days.map((date) => (
              <div key={date} className="shrink-0 border-l border-border" style={{ width: dayWidth }}>
                <p className="truncate px-2 pt-2 text-xs font-semibold text-foreground">
                  {formatInZone(`${date}T12:00:00Z`, "UTC", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="relative h-5">
                  {ticks.map((m) => (
                    <span
                      key={m}
                      className="absolute top-0.5 text-[10px] tabular-nums text-text-tertiary"
                      style={{ left: (m - range.from) * pxPerMin + 2 }}
                    >
                      {String(Math.floor(m / 60)).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {groups.map(({ venue, spaces: rows }) => (
            <div key={venue?.id || "none"}>
              <div className="sticky left-0 border-b border-border px-3 py-1.5" style={{ width: LABEL_WIDTH }}>
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  {venue?.name || "Venue"}
                </p>
              </div>
              {rows.map((space) => (
                <div key={space.id} className="flex border-b border-border last:border-b-0">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-border bg-surface-subtle px-3"
                    style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{space.name}</p>
                  </div>
                  {days.map((date) => (
                    <DayCell
                      key={date}
                      space={space}
                      date={date}
                      tz={tzOf(space.id)}
                      range={range}
                      pxPerMin={pxPerMin}
                      bookings={bookings}
                      now={now}
                      onSlotClick={onSlotClick}
                      onBookingClick={onBookingClick}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-sky-500/40 bg-sky-500/15" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10" /> Hold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-sky-500/10" /> Turnover
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-surface-active/70" /> Closed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-red-500/10" /> Blackout
        </span>
        <span>Times are each venue&apos;s local time. Click an open slot to book it.</span>
      </div>
    </div>
  );
}

export default AvailabilityTimeline;
