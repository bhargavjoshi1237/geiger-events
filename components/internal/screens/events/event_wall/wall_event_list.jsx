"use client";

import React from "react";
import Link from "next/link";
import { CalendarX2, MapPin, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { coverKind } from "@/lib/events/gallery";
import { cardPriceLabel, isSoldOut } from "./wall_layout";
import { formatTime, groupByDate } from "./wall_agenda";

// The agenda body of the public wall: events grouped by day, in either the
// roomy card view or the compact list view. Both views read the same groups, so
// switching between them can never change which events are shown.

// A cover can be a video (event pages allow one), and no player chrome fits a
// thumbnail — so it plays muted and unattended, first frame only.
function Cover({ event, className }) {
  if (!event.coverUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-active text-text-tertiary",
          className,
        )}
      >
        <MapPin className="h-6 w-6" />
      </div>
    );
  }
  if (coverKind(event.coverUrl) === "video") {
    return (
      <video
        src={event.coverUrl}
        muted
        playsInline
        preload="metadata"
        className={cn("bg-black object-cover", className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.coverUrl}
      alt={`${event.name} cover`}
      className={cn("object-cover", className)}
    />
  );
}

// Sold out reads as a waitlist to a buyer; otherwise the lead ticket price.
// Returns null when there's nothing to say, so callers can skip the whole row
// rather than leave its margin behind.
function StatusChip({ event, meta }) {
  if (isSoldOut(event)) return <Badge variant="info">Waitlist</Badge>;
  if (!meta.price) return null;
  const price = cardPriceLabel(event);
  return price ? <Badge variant="success">{price}</Badge> : null;
}

function hasStatusChip(event, meta) {
  return isSoldOut(event) || (meta.price && cardPriceLabel(event) !== null);
}

function HostLine({ event, className }) {
  if (!event.organizer) return null;
  return (
    <span className={cn("flex items-center gap-1.5 text-sm text-text-secondary", className)}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-active text-[9px] font-semibold uppercase text-text-secondary">
        {event.organizer.trim().charAt(0)}
      </span>
      By {event.organizer}
    </span>
  );
}

function VenueLine({ event, className }) {
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  if (!place) return null;
  return (
    <span className={cn("flex items-center gap-1.5 text-sm text-text-secondary", className)}>
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{place}</span>
    </span>
  );
}

// Card view — the event gets room for its cover, host, and venue.
function EventCardRow({ event, meta, featured, accent }) {
  return (
    <Link
      href={`/e/${event.id}`}
      className="ev-surface group flex gap-4 rounded-2xl border border-border bg-surface-subtle p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-secondary">
          {formatTime(event.time)}
          {featured ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: accent.color }}
            >
              <Star className="h-3 w-3" /> Featured
            </span>
          ) : null}
          {meta.type && event.type ? (
            <span className="text-xs text-text-tertiary">· {event.type}</span>
          ) : null}
        </span>
        <p className="text-lg font-semibold leading-snug text-foreground">
          {event.name}
        </p>
        {meta.host ? <HostLine event={event} /> : null}
        {meta.venue ? <VenueLine event={event} /> : null}
        {hasStatusChip(event, meta) ? (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusChip event={event} meta={meta} />
          </span>
        ) : null}
      </div>
      <Cover
        event={event}
        className="h-[104px] w-[104px] shrink-0 rounded-xl transition-transform group-hover:scale-[1.02] sm:h-[124px] sm:w-[124px]"
      />
    </Link>
  );
}

// List view — one line per event, time in a fixed gutter so the titles align.
function EventListRow({ event, meta, featured, accent }) {
  return (
    <Link
      href={`/e/${event.id}`}
      className="group flex gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface-hover"
    >
      <span className="w-20 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-text-secondary">
        {formatTime(event.time)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold leading-snug text-foreground">
          {event.name}
          {featured ? (
            <Star
              className="ml-1.5 inline h-3.5 w-3.5 align-[-2px]"
              style={{ color: accent.color }}
            />
          ) : null}
        </p>
        {meta.host ? <HostLine event={event} /> : null}
        {meta.venue ? <VenueLine event={event} /> : null}
      </div>
      <span className="shrink-0 pt-0.5">
        <StatusChip event={event} meta={meta} />
      </span>
    </Link>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center text-text-secondary">
      <CalendarX2 className="h-10 w-10" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function WallEventList({
  events,
  view,
  meta,
  accent,
  featuredIds,
  emptyMessage = "No events to show right now — check back soon.",
}) {
  const groups = groupByDate(events);
  if (!groups.length) return <EmptyState message={emptyMessage} />;

  const featured = new Set(featuredIds || []);
  const cards = view === "cards";

  return (
    <div className={cn(cards ? "space-y-6" : "space-y-8")}>
      {groups.map((group) => (
        <section
          key={group.date}
          // In card view the group hangs off a dated timeline rail, so a run of
          // days reads as one agenda rather than a stack of unrelated blocks.
          className={cn(cards && "relative border-l border-dashed border-border pl-6")}
        >
          {cards ? (
            <span
              className="absolute -left-[4px] top-[0.4rem] h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: accent.color }}
            />
          ) : null}
          <header
            className={cn(
              "flex items-baseline gap-2",
              cards ? "mb-3" : "mb-1 border-b border-border pb-2",
            )}
          >
            <h3 className="font-semibold text-foreground">
              {group.parsed ? `${group.parsed.month} ${group.parsed.day}` : group.date}
            </h3>
            {group.parsed ? (
              <span className="text-sm text-text-secondary">{group.parsed.weekday}</span>
            ) : null}
          </header>

          {cards ? (
            <div className="space-y-3">
              {group.events.map((event) => (
                <EventCardRow
                  key={event.id}
                  event={event}
                  meta={meta}
                  accent={accent}
                  featured={featured.has(event.id)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {group.events.map((event) => (
                <EventListRow
                  key={event.id}
                  event={event}
                  meta={meta}
                  accent={accent}
                  featured={featured.has(event.id)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default WallEventList;
