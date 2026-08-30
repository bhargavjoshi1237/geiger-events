"use client";

import { Ticket } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import {
  Shell,
  EventMetaLine,
  PAIR_ITEM,
  PAIR_ROW,
  PAIR_WIDE,
  priceLabel,
} from "./shared";

const WIDE = new Set(["schedule", "location", "guests", "whosgoing", "infographics", "columns"]);

export function ShowcaseLayout({ ctx }) {
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
    accent,
    coverClass,
    coverStyle,
  } = ctx;

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <Shell width={contentWidth} className="py-12 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-tertiary">
              {meta.tags.join(" · ")}
            </p>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="max-w-md text-lg leading-relaxed text-text-secondary">
                {ctx.theme.tagline}
              </p>
            ) : null}
            <EventMetaLine event={event} />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                size="lg"
                style={cta.soldOut ? undefined : cta.primaryBtnStyle}
                disabled={cta.soldOut}
                className={cn(
                  "disabled:opacity-60",
                  cta.soldOut || !cta.ctaHover ? "hover:opacity-90" : cta.ctaHover,
                )}
                onClick={() => cta.onCheckout(null)}
              >
                <Ticket className="h-4 w-4" />
                {cta.soldOut ? "Sold out" : "Get tickets"}
              </Button>
              <span className="text-sm font-medium text-text-secondary">
                {priceLabel(cta.tickets)}
              </span>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-[2.5rem] opacity-20 sm:-inset-6"
              style={{ backgroundColor: accent.color }}
            />
            <div
              className={cn(
                "relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-border",
                event.coverUrl ? "" : coverClass,
              )}
              style={event.coverUrl ? undefined : coverStyle}
            >
              <CoverImage event={event} />
            </div>
          </div>
        </div>
      </Shell>

      {disclaimerSlot("hero", "pb-8")}

      <Shell width={contentWidth} className="pb-12 empty:hidden">
        {parts.hostsBlock}
        {parts.gallery}
      </Shell>

      <Shell width={contentWidth} className="pb-16">
        <div className={PAIR_ROW}>
          {blocks.map((b) => (
            <div
              key={b.id}
              className={cn(
                "empty:hidden",
                WIDE.has(b.type) ? PAIR_WIDE : PAIR_ITEM,
              )}
            >
              {b.node}
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-6 border-t border-border pt-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-12">
          <div>{register}</div>
          <div className="space-y-4">{sidebarRest.map((b) => b.node)}</div>
        </div>
        {disclaimerSlot("content", "pt-8")}
      </Shell>
    </div>
  );
}
