"use client";

import { ChevronDown, Ticket } from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import {
  Shell,
  StickyBuyBar,
  EventMetaLine,
  OVER_COVER,
  priceLabel,
} from "./shared";

export function SpotlightLayout({ ctx }) {
  const {
    event,
    contentWidth,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    sidebarRest,
    register,
    disclaimerSlot,
    meta,
    cta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  return (
    <>
      <div className="relative z-10 min-h-[88vh] w-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-0",
            event.coverUrl ? "" : coverClass,
          )}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <CoverImage event={event} />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/50"
        />

        <div
          className="relative flex min-h-[88vh] flex-col"
          style={OVER_COVER}
        >
          <Shell width={contentWidth} className="pt-8">
            {brandBar}
          </Shell>

          <Shell width={contentWidth} className="flex flex-1 items-end pb-16">
            <div className="max-w-3xl space-y-5">
              <div className="flex flex-wrap gap-2">
                {meta.tags.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                {event.name}
              </h1>
              {themed && ctx.theme.tagline ? (
                <p className="max-w-xl text-lg text-text-secondary">
                  {ctx.theme.tagline}
                </p>
              ) : null}
              <EventMetaLine event={event} />
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  style={cta.soldOut ? undefined : cta.primaryBtnStyle}
                  disabled={cta.soldOut}
                  className={cn(
                    "disabled:opacity-60",
                    cta.soldOut || !cta.ctaHover
                      ? "hover:opacity-90"
                      : cta.ctaHover,
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
          </Shell>

          <div className="pb-6 text-center">
            <ChevronDown className="mx-auto h-5 w-5 animate-bounce text-text-tertiary" />
          </div>
        </div>
      </div>

      <Shell width={contentWidth} className="relative z-10 py-16">
        {disclaimerSlot("top", "mb-8")}
        {disclaimerSlot("hero", "mb-8")}
        <div
          className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
          style={sectionGapStyle}
        >
          {parts.hostsBlock}
          {parts.gallery}
          {blocks.map((b) => b.node)}
          <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
            <div>{register}</div>
            <div className="space-y-4">{sidebarRest.map((b) => b.node)}</div>
          </div>
          {disclaimerSlot("content")}
        </div>
      </Shell>

      <StickyBuyBar ctx={ctx} />
      <div aria-hidden className="h-24" />
    </>
  );
}
