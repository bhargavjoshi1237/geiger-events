"use client";

import { Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { EventMetaLine, OVER_COVER, priceLabel } from "./shared";

// Split stage — the page divides down the middle. The left half is a pinned
// panel that never moves (cover, title, date, one button); the right half
// scrolls the whole page past it. The layout conference and studio sites use
// when the identity matters as much as the content.
export function SplitLayout({ ctx }) {
  const {
    event,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    sidebarNodes,
    disclaimerSlot,
    meta,
    cta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  return (
    <div className="relative z-10 lg:grid lg:min-h-screen lg:grid-cols-2">
      <aside className="relative overflow-hidden lg:sticky lg:top-0 lg:h-screen">
        <div
          className={cn("absolute inset-0", event.coverUrl ? "" : coverClass)}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <CoverImage event={event} />
        </div>
        {event.coverUrl ? (
          <div aria-hidden className="absolute inset-0 bg-black/60" />
        ) : null}

        <div
          className="relative flex h-full flex-col justify-between gap-10 p-8 lg:p-12"
          style={event.coverUrl ? OVER_COVER : undefined}
        >
          {brandBar}

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {meta.tags.map((t) => (
                <Badge key={t} variant="neutral">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="max-w-md text-base text-text-secondary">
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
        </div>
      </aside>

      <div className="px-6 py-12 sm:px-10 lg:px-12 lg:py-16">
        {disclaimerSlot("top", "mb-8")}
        <div
          className={cn(
            "mx-auto min-w-0 max-w-2xl",
            themed ? "flex flex-col" : "space-y-10",
          )}
          style={sectionGapStyle}
        >
          {disclaimerSlot("hero")}
          {parts.hostsBlock}
          {parts.gallery}
          {blocks.map((b) => b.node)}
          {sidebarNodes.map((b) => b.node)}
          {disclaimerSlot("content")}
        </div>
      </div>
    </div>
  );
}
