"use client";

import { Fragment } from "react";

import { Badge } from "@geiger/ui/badge";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, StickyBuyBar } from "./shared";

const READ_WIDTH = "44rem";

export function MagazineLayout({ ctx }) {
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
    coverClass,
    coverStyle,
    parts,
  } = ctx;

  const breakAt = blocks.length > 1 ? 1 : blocks.length;

  return (
    <>
      <Shell width={contentWidth} className="relative z-10 pt-8">
        {brandBar}
      </Shell>

      <header className="relative z-10 pt-10">
        <Shell width={READ_WIDTH} className="space-y-5 text-center">
          {disclaimerSlot("top", "mb-8")}
          <div className="flex flex-wrap justify-center gap-2">
            {meta.tags.map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            {event.name}
          </h1>
          {themed && ctx.theme.tagline ? (
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-text-secondary">
              {ctx.theme.tagline}
            </p>
          ) : null}
          <EventMetaLine event={event} className="justify-center" />
        </Shell>

        {event.coverUrl ? (
          <div
            className={cn(
              "relative mt-10 aspect-[21/9] w-full overflow-hidden",
              coverClass,
            )}
            style={coverStyle}
          >
            <CoverImage event={event} />
          </div>
        ) : null}
        {parts.gallery ? (
          <Shell width={contentWidth} className="mt-6">
            {parts.gallery}
          </Shell>
        ) : null}
      </header>

      <Shell width={READ_WIDTH} className="relative z-10 py-14">
        {disclaimerSlot("hero", "mb-10")}
        <div
          className={cn("min-w-0", themed ? "flex flex-col" : "space-y-12")}
          style={sectionGapStyle}
        >
          {parts.hostsBlock}
          {blocks.slice(0, breakAt).map((b) => b.node)}

          <div className="border-y border-border py-8">{register}</div>

          {blocks.slice(breakAt).map((b) => b.node)}
          {sidebarRest.map((b) => (
            <Fragment key={b.id}>{b.node}</Fragment>
          ))}
          {disclaimerSlot("content")}
        </div>
      </Shell>

      <StickyBuyBar ctx={ctx} />
      <div aria-hidden className="h-24" />
    </>
  );
}
