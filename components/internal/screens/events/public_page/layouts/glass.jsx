"use client";

import { Badge } from "@geiger/ui/badge";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, OVER_COVER, StickyBuyBar } from "./shared";

export function GlassLayout({ ctx }) {
  const {
    event,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    register,
    sidebarRest,
    disclaimerSlot,
    meta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 z-0",
          event.coverUrl ? "" : coverClass,
        )}
        style={event.coverUrl ? undefined : coverStyle}
      >
        <CoverImage event={event} />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative z-10" style={OVER_COVER}>
        <Shell width="60rem" className="py-10">
          {disclaimerSlot("top", "mb-8")}
          {brandBar}

          <header className="space-y-4 py-10 text-center">
            <div className="flex flex-wrap justify-center gap-2">
              {meta.tags.map((t) => (
                <Badge key={t} variant="neutral">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="mx-auto max-w-xl text-lg text-text-secondary">
                {ctx.theme.tagline}
              </p>
            ) : null}
            <EventMetaLine event={event} className="justify-center" />
          </header>

          <div className="rounded-3xl border border-border bg-black/40 p-6 backdrop-blur-xl sm:p-10">
            <div
              className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
              style={sectionGapStyle}
            >
              {disclaimerSlot("hero")}
              {parts.hostsBlock}
              {parts.gallery}
              {blocks.map((b) => b.node)}
              <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
                <div>{register}</div>
                <div className="space-y-4">{sidebarRest.map((b) => b.node)}</div>
              </div>
              {disclaimerSlot("content")}
            </div>
          </div>
        </Shell>
      </div>

      <StickyBuyBar ctx={ctx} />
      <div aria-hidden className="h-24" />
    </>
  );
}
