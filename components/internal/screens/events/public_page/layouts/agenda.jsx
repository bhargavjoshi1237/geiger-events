"use client";

import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, OVER_COVER } from "./shared";

export function AgendaLayout({ ctx }) {
  const {
    event,
    contentWidth,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    sidebarNodes,
    disclaimerSlot,
    meta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  const schedule = blocks.find((b) => b.type === "schedule") || null;
  const rest = blocks.filter((b) => b !== schedule);

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <section className="relative mt-6 overflow-hidden">
        <div
          className={cn(
            "relative flex min-h-[15rem] items-end",
            event.coverUrl ? "" : coverClass,
          )}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <div className="absolute inset-0">
            <CoverImage event={event} />
          </div>
          {event.coverUrl ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
            />
          ) : null}
          <Shell
            width={contentWidth}
            className="relative py-8"
            style={event.coverUrl ? OVER_COVER : undefined}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                  {meta.tags.join(" · ")}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {event.name}
                </h1>
              </div>
              <EventMetaLine event={event} />
            </div>
          </Shell>
        </div>
      </section>

      <Shell width={contentWidth} className="py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div
            className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
            style={sectionGapStyle}
          >
            {disclaimerSlot("hero")}
            {schedule ? (
              <div className="rounded-2xl border border-border bg-surface-subtle/40 p-5 empty:hidden sm:p-7">
                {schedule.node}
              </div>
            ) : null}
            {parts.hostsBlock}
            {parts.gallery}
            {rest.map((b) => b.node)}
            {disclaimerSlot("content")}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {sidebarNodes.map((b) => b.node)}
          </div>
        </div>
      </Shell>
    </div>
  );
}
