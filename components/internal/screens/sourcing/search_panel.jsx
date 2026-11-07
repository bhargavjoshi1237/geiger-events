"use client";

import React, { useMemo } from "react";
import { Building2, CalendarCheck, CircleSlash, Users } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { EventDatePicker, EventTimeField } from "@/components/internal/screens/events/date_time_fields";
import { checkSlot } from "@/lib/venue_booking/availability";
import { describeItem, formatMoney } from "@/lib/venue_booking/pricing";
import { SETUP_STYLES, capacityFor, setupStyleLabel } from "@/lib/venue_booking/styles";
import { formatRange, safeTimeZone, zoneAbbreviation, zonedInstant } from "@/lib/venue_booking/time";

const ANY = "any";
const ALL = "all";

// Every bookable space checked against the requested slot: fits, availability, and a live quote.
function useResults({ search, spaces, venueById, bookings, now }) {
  return useMemo(() => {
    const attendees = Math.max(0, Number(search.attendees) || 0);
    const style = search.style === ANY ? "" : search.style;
    const rows = [];
    let tooSmall = 0;
    for (const space of spaces) {
      if (search.venueId !== ALL && space.venueId !== search.venueId) continue;
      const venue = venueById.get(space.venueId);
      const tz = safeTimeZone(venue?.timezone);
      const cap = capacityFor(space, style);
      if (attendees > 0 && cap > 0 && cap < attendees) {
        tooSmall += 1;
        continue;
      }
      if (style && attendees > 0 && !cap) {
        tooSmall += 1;
        continue;
      }
      const startsAt = zonedInstant(search.date, search.startTime, tz);
      const endsAt = zonedInstant(search.endDate || search.date, search.endTime, tz);
      const check =
        startsAt && endsAt
          ? checkSlot({ space, timeZone: tz, startsAt, endsAt, bookings, setupStyle: style, attendees, now })
          : { ok: false, message: "Pick a start and end time." };
      rows.push({ space, venue, tz, cap, startsAt, endsAt, check });
    }
    const available = rows.filter((r) => r.check.ok).sort((a, b) => (a.check.quote?.total ?? 0) - (b.check.quote?.total ?? 0));
    const unavailable = rows.filter((r) => !r.check.ok);
    return { available, unavailable, tooSmall, attendees, style };
  }, [search, spaces, venueById, bookings, now]);
}

function ResultCard({ row, style, attendees, onBook }) {
  const { space, venue, tz, cap, startsAt, endsAt, check } = row;
  const quote = check.quote;
  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{space.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {[venue?.name, venue?.city, space.floor].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-tertiary">
            <span>
              {formatRange(startsAt, endsAt, tz)} {zoneAbbreviation(startsAt, tz)}
            </span>
            {cap ? (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {style ? `${setupStyleLabel(style)} ` : "up to "}
                {cap}
              </span>
            ) : attendees ? (
              <span>Capacity not listed</span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground dark:text-white">
            {quote?.priced ? formatMoney(quote.total, quote.currency) : "No charge"}
          </p>
          <p className="max-w-56 truncate text-xs text-text-secondary">
            {quote?.lines
              .flatMap((l) => l.items)
              .map((it) => describeItem(it, quote.currency))
              .join(" + ") || "No published rate"}
          </p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onBook(row)}>
          <CalendarCheck className="h-4 w-4" /> Book
        </Button>
      </div>
    </li>
  );
}

export function SearchPanel({ search, onChange, venues, spaces, venueById, bookings, now, onBook }) {
  const results = useResults({ search, spaces, venueById, bookings, now });
  const set = (partial) => onChange({ ...search, ...partial });

  return (
    <SectionCard
      title="Find a space"
      description="Check every bookable space across your venues for a time slot and get a live quote from their published rates."
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Starts">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <EventDatePicker
                value={search.date}
                onChange={(date) => set({ date, endDate: !search.endDate || search.endDate < date ? date : search.endDate })}
              />
              <EventTimeField value={search.startTime} onChange={(v) => set({ startTime: v })} className="w-28" />
            </div>
          </Field>
          <Field label="Ends">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <EventDatePicker value={search.endDate} onChange={(v) => set({ endDate: v })} />
              <EventTimeField value={search.endTime} onChange={(v) => set({ endTime: v })} className="w-28" />
            </div>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Attendees">
            <Input type="number" min={0} value={search.attendees} onChange={(e) => set({ attendees: e.target.value })} placeholder="Any" />
          </Field>
          <Field label="Setup">
            <Select value={search.style} onValueChange={(v) => set({ style: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any setup</SelectItem>
                {SETUP_STYLES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Venue">
            <Select value={search.venueId} onValueChange={(v) => set({ venueId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name || "Untitled venue"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="border-t border-border pt-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {results.available.length
                ? `${results.available.length} space${results.available.length === 1 ? "" : "s"} free`
                : "No free spaces for this slot"}
            </p>
            {results.tooSmall ? (
              <p className="text-xs text-text-secondary">
                {results.tooSmall} {results.tooSmall === 1 ? "space doesn't" : "spaces don't"} fit{results.attendees ? ` ${results.attendees}` : ""}
                {results.style ? ` in ${setupStyleLabel(results.style).toLowerCase()}` : ""}
              </p>
            ) : null}
          </div>
          {results.available.length ? (
            <ul className="divide-y divide-border">
              {results.available.map((row) => (
                <ResultCard key={row.space.id} row={row} style={results.style} attendees={results.attendees} onBook={onBook} />
              ))}
            </ul>
          ) : null}
          {results.unavailable.length ? (
            <div className={results.available.length ? "mt-4" : ""}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">Unavailable</p>
              <ul className="space-y-1.5">
                {results.unavailable.map(({ space, venue, check }) => (
                  <li key={space.id} className="flex items-center gap-2 text-sm">
                    <CircleSlash className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <span className="truncate text-text-secondary">
                      <span className="text-foreground">{space.name}</span>
                      {venue?.name ? ` · ${venue.name}` : ""} — {check.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

export default SearchPanel;
