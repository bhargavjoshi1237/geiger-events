"use client";

import React from "react";
import Link from "next/link";
import { CalendarX2, Clock, MapPin, Star, Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_MAP, formatDate } from "../sample_data";
import {
  resolveTheme,
  themeStyle,
  themeAccent,
  resolveWidth,
} from "@/lib/events/theme";
import { resolveLayout, cardPriceLabel } from "./wall_layout";
import { PageFooter } from "../page_footer";
import { OrganiserProfileHeader } from "@/components/internal/screens/discovery/public_follow";

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

// Shared meta lines (date / venue / price), styled for overlay vs classic cards.
function CardMeta({ event, meta, overlay }) {
  const price = meta.price ? cardPriceLabel(event) : null;
  return (
    <div className={cn("space-y-1", overlay ? "text-white/85" : "text-text-secondary")}>
      {meta.date ? (
        <span className="flex items-center gap-1.5 text-sm">
          <Clock className="h-3.5 w-3.5" />
          {formatDate(event.date)} · {event.time}
        </span>
      ) : null}
      {meta.venue ? (
        <span className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5" />
          {event.venue}
          {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
        </span>
      ) : null}
      {price ? (
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            overlay ? "text-white" : "text-foreground",
          )}
        >
          <Ticket className="h-3.5 w-3.5" /> {price}
        </span>
      ) : null}
    </div>
  );
}

function FeaturedBadge({ accent }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: accent.color, color: accent.text }}
    >
      <Star className="h-3 w-3" /> Featured
    </span>
  );
}

function EventCard({ event, accent, featured, layout, large = false }) {
  const meta = layout.cardMeta || {};
  const overlay = layout.cardStyle === "overlay" || large;

  // Overlay / spotlight — text sits over a darkened cover image.
  if (overlay) {
    return (
      <Link
        href={`/e/${event.id}`}
        className={cn(
          "ev-surface group relative flex overflow-hidden rounded-2xl border border-border",
          large ? "min-h-[240px] sm:aspect-[21/9]" : "aspect-[4/3]",
        )}
      >
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt={`${event.name} cover`}
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(135deg, ${accent.color}55, ${accent.color}11)`,
            }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.15) 55%, transparent)",
          }}
        />
        <div className="relative z-10 mt-auto flex w-full flex-col gap-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {featured ? <FeaturedBadge accent={accent} /> : null}
            {meta.type ? (
              <Badge
                variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}
                className="w-fit"
              >
                {event.type}
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              "font-semibold text-white",
              large ? "text-2xl" : "text-lg",
            )}
          >
            {event.name}
          </p>
          <CardMeta event={event} meta={meta} overlay />
        </div>
      </Link>
    );
  }

  // Classic — cover on top, meta below.
  return (
    <Link
      href={`/e/${event.id}`}
      className="ev-surface group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-subtle transition-colors hover:border-border-strong"
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
          <span className="absolute left-3 top-3">
            <FeaturedBadge accent={accent} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {meta.type ? (
          <Badge
            variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}
            className="w-fit"
          >
            {event.type}
          </Badge>
        ) : null}
        <p className="text-base font-semibold text-foreground">{event.name}</p>
        <div className="mt-auto">
          <CardMeta event={event} meta={meta} overlay={false} />
        </div>
      </div>
    </Link>
  );
}

// Columns → responsive grid class. `auto` keeps the width-based default.
function columnsClass(columns, wide) {
  switch (columns) {
    case "2":
      return "sm:grid-cols-2";
    case "3":
      return "sm:grid-cols-2 lg:grid-cols-3";
    case "4":
      return "sm:grid-cols-2 lg:grid-cols-4";
    default:
      return wide ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  }
}

// Chrome-less body shared by the public route (app/w/[slug]/page.js).
export function WallPublicPageContent({ wall, events, profile }) {
  const design = { theme: wall?.theme };
  const theme = resolveTheme(design);
  const accent = themeAccent(theme);
  const wrapperStyle = themeStyle(theme);
  const contentWidth = resolveWidth(theme);
  const layout = resolveLayout(wall?.layout);
  const { featured, rest } = selectWallEvents(events, wall);
  const isEmpty = !featured.length && !rest.length;

  const centered = layout.header.align !== "left";
  const banner = layout.header.bannerUrl;
  const spotlight = layout.featuredStyle === "spotlight" && featured.length > 0;
  const gridClass = columnsClass(layout.columns, contentWidth === "88rem");

  const logo = wall?.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={wall.logoUrl}
      alt=""
      className={cn("h-10 w-auto", centered && !banner ? "mx-auto" : "")}
    />
  ) : null;

  return (
    <div
      className="ev-themed min-h-screen bg-background text-foreground"
      style={wrapperStyle}
    >
      <div
        className="mx-auto px-4 py-14 sm:px-6 lg:px-8"
        style={{ maxWidth: contentWidth }}
      >
        {banner ? (
          <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner}
              alt=""
              className="h-44 w-full object-cover sm:h-60"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.25) 60%, rgb(0 0 0 / 0.2))",
              }}
            />
            <div
              className={cn(
                "absolute inset-0 flex flex-col justify-end gap-2 p-6 sm:p-8",
                centered && "items-center text-center",
              )}
            >
              {logo}
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {wall?.name || "Our Events"}
              </h1>
              {wall?.tagline ? (
                <p className="max-w-xl text-sm text-white/85 sm:text-base">
                  {wall.tagline}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "mb-10 space-y-3",
              centered ? "text-center" : "text-left",
            )}
          >
            {logo}
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {wall?.name || "Our Events"}
            </h1>
            {wall?.tagline ? (
              <p
                className={cn(
                  "max-w-xl text-sm text-text-secondary sm:text-base",
                  centered && "mx-auto",
                )}
              >
                {wall.tagline}
              </p>
            ) : null}
          </div>
        )}

        <OrganiserProfileHeader profile={profile} wall={wall} centered={centered} />

        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-text-secondary">
            <CalendarX2 className="h-10 w-10" />
            <p className="text-sm">No events to show right now — check back soon.</p>
          </div>
        ) : (
          <>
            {spotlight ? (
              <div className="mb-8 space-y-6">
                {featured.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    accent={accent}
                    layout={layout}
                    featured
                    large
                  />
                ))}
              </div>
            ) : null}

            <div className={cn("grid grid-cols-1 gap-6", gridClass)}>
              {!spotlight
                ? featured.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      accent={accent}
                      layout={layout}
                      featured
                    />
                  ))
                : null}
              {rest.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  accent={accent}
                  layout={layout}
                />
              ))}
            </div>
          </>
        )}

        <PageFooter footer={wall?.footer} accent={accent} />
      </div>
    </div>
  );
}

export default WallPublicPageContent;
