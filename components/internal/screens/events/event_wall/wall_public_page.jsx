"use client";

import React from "react";
import Link from "next/link";
import { CalendarX2, Clock, MapPin, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_MAP, formatDate } from "../sample_data";
import {
  resolveTheme,
  themeStyle,
  themeAccent,
  resolveWidth,
} from "@/lib/events/theme";

const DEFAULT_FILTERS = { status: "upcoming", sortBy: "date_asc" };

// Apply the wall's status filter, featured-first ordering, and sort — pure
// so both the public route and any future preview can share it.
export function selectWallEvents(events, wall) {
  const filters = { ...DEFAULT_FILTERS, ...(wall?.filters || {}) };
  const featured = Array.isArray(wall?.featured) ? wall.featured : [];
  const today = new Date().toISOString().slice(0, 10);

  let list = Array.isArray(events) ? events : [];
  if (filters.status === "upcoming") list = list.filter((e) => e.date >= today);
  else if (filters.status === "past") list = list.filter((e) => e.date < today);

  const sorted = [...list].sort((a, b) => {
    if (filters.sortBy === "date_desc") return b.date.localeCompare(a.date);
    if (filters.sortBy === "recent") {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    }
    return a.date.localeCompare(b.date);
  });

  const featuredEvents = featured
    .map((id) => sorted.find((e) => e.id === id))
    .filter(Boolean);
  const rest = sorted.filter((e) => !featured.includes(e.id));
  return { featured: featuredEvents, rest };
}

function EventCard({ event, accent, featured }) {
  return (
    <Link
      href={`/e/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-subtle transition-colors hover:border-border-strong"
    >
      <div
        className="relative flex aspect-[16/9] items-center justify-center overflow-hidden text-[#3a3a3a]"
        style={
          event.coverUrl
            ? undefined
            : { backgroundImage: `linear-gradient(135deg, ${accent.color}33, transparent)` }
        }
      >
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt={`${event.name} cover`}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <MapPin className="h-8 w-8" />
        )}
        {featured ? (
          <span
            className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: accent.color, color: accent.text }}
          >
            <Star className="h-3 w-3" /> Featured
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"} className="w-fit">
          {event.type}
        </Badge>
        <p className="text-base font-semibold text-foreground">{event.name}</p>
        <div className="mt-auto space-y-1 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(event.date)} · {event.time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.venue}
            {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Chrome-less body shared by the public route (app/w/[slug]/page.js).
export function WallPublicPageContent({ wall, events }) {
  const design = { theme: wall?.theme };
  const theme = resolveTheme(design);
  const accent = themeAccent(theme);
  const wrapperStyle = themeStyle(theme);
  const contentWidth = resolveWidth(theme);
  const { featured, rest } = selectWallEvents(events, wall);
  const isEmpty = !featured.length && !rest.length;

  return (
    <div className="ev-themed min-h-screen bg-background text-foreground" style={wrapperStyle}>
      <div className="mx-auto px-4 py-14 sm:px-6 lg:px-8" style={{ maxWidth: contentWidth }}>
        <div className="mb-10 space-y-3 text-center">
          {wall?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wall.logoUrl}
              alt=""
              className="mx-auto h-10 w-auto"
            />
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {wall?.name || "Our Events"}
          </h1>
          {wall?.tagline ? (
            <p className="mx-auto max-w-xl text-sm text-text-secondary sm:text-base">
              {wall.tagline}
            </p>
          ) : null}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-text-secondary">
            <CalendarX2 className="h-10 w-10" />
            <p className="text-sm">No events to show right now — check back soon.</p>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-6",
              "grid-cols-1 sm:grid-cols-2",
              contentWidth === "88rem" ? "lg:grid-cols-3" : "lg:grid-cols-2",
            )}
          >
            {featured.map((e) => (
              <EventCard key={e.id} event={e} accent={accent} featured />
            ))}
            {rest.map((e) => (
              <EventCard key={e.id} event={e} accent={accent} />
            ))}
          </div>
        )}

        <p className="mt-14 flex items-center justify-center gap-1.5 text-center text-xs text-text-tertiary">
          Powered by Geiger Events
        </p>
      </div>
    </div>
  );
}

export default WallPublicPageContent;
