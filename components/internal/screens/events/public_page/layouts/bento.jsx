"use client";

import { CalendarDays, Gauge, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatDate } from "../../sample_data";
import { CoverImage, venueLine } from "../hero";
import { Shell, OVER_COVER, priceLabel } from "./shared";

const WIDE = new Set([
  "schedule",
  "location",
  "guests",
  "whosgoing",
  "infographics",
  "columns",
  "image",
  "video",
  "embed",
]);

function Tile({ className, children }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface-subtle p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FactTile({ icon: Icon, label, value }) {
  return (
    <Tile className="flex flex-col justify-between gap-6 lg:col-span-2">
      <Icon className="h-5 w-5 text-text-tertiary" />
      <div>
        <p className="text-xs uppercase tracking-widest text-text-tertiary">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold leading-tight text-foreground">
          {value}
        </p>
      </div>
    </Tile>
  );
}

export function BentoLayout({ ctx }) {
  const {
    event,
    contentWidth,
    themed,
    brandBar,
    blocks,
    register,
    sidebarRest,
    disclaimerSlot,
    meta,
    cta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  return (
    <Shell width={contentWidth} className="relative z-10 py-12">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}

      <div className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-2 lg:grid-cols-6">
        <Tile className="relative min-h-[19rem] p-0 lg:col-span-4 lg:row-span-2">
          <div
            className={cn("absolute inset-0", event.coverUrl ? "" : coverClass)}
            style={event.coverUrl ? undefined : coverStyle}
          >
            <CoverImage event={event} />
          </div>
          {event.coverUrl ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"
            />
          ) : null}
          <div
            className="relative flex h-full flex-col justify-end p-6"
            style={event.coverUrl ? OVER_COVER : undefined}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {meta.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="mt-2 max-w-lg text-sm text-text-secondary">
                {ctx.theme.tagline}
              </p>
            ) : null}
          </div>
        </Tile>

        <div className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
          {register}
        </div>

        <FactTile
          icon={CalendarDays}
          label="Date"
          value={`${formatDate(event.date)} · ${event.time}`}
        />
        <FactTile icon={MapPin} label="Venue" value={venueLine(event)} />
        <FactTile
          icon={Gauge}
          label="Tickets"
          value={cta.soldOut ? "Sold out" : priceLabel(cta.tickets)}
        />

        {disclaimerSlot("hero", "sm:col-span-2 lg:col-span-6")}

        <div className="empty:hidden sm:col-span-2 lg:col-span-6">
          {parts.hostsBlock}
        </div>
        {parts.gallery ? (
          <Tile className="sm:col-span-2 lg:col-span-6">{parts.gallery}</Tile>
        ) : null}

        {blocks.map((b) => (
          <Tile
            key={b.id}
            className={cn(
              "empty:hidden",
              WIDE.has(b.type)
                ? "sm:col-span-2 lg:col-span-6"
                : "lg:col-span-3",
            )}
          >
            {b.node}
          </Tile>
        ))}

        {sidebarRest.map((b) => (
          <div key={b.id} className="lg:col-span-3">
            {b.node}
          </div>
        ))}

        {disclaimerSlot("content", "sm:col-span-2 lg:col-span-6")}
      </div>
    </Shell>
  );
}
