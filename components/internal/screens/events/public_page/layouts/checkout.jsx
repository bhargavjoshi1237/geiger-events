"use client";

import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, MetaRows } from "./shared";

// Registration first — the ticket panel is the page. Everything descriptive
// compresses into a narrow summary rail, so the buyer lands on the decision
// instead of scrolling to find it. What high-intent ticketing and paid-workshop
// pages use when the audience already knows what the event is.
export function CheckoutLayout({ ctx }) {
  const {
    event,
    contentWidth,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    register,
    sidebarRest,
    disclaimerSlot,
    meta,
    parts,
  } = ctx;

  return (
    <Shell width={contentWidth} className="relative z-10 py-12">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}

      <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <div>
          <header className="mb-8 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {event.name}
            </h1>
            <EventMetaLine event={event} />
          </header>

          {disclaimerSlot("hero", "mb-8")}

          <div className="[&_button]:text-base">{register}</div>

          <div
            className={cn(
              "mt-14 min-w-0",
              themed ? "flex flex-col" : "space-y-10",
            )}
            style={sectionGapStyle}
          >
            {parts.hostsBlock}
            {parts.gallery}
            {blocks.map((b) => b.node)}
            {disclaimerSlot("content")}
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {event.coverUrl ? (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
              <CoverImage event={event} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {meta.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary"
              >
                {t}
              </span>
            ))}
          </div>
          <MetaRows ctx={ctx} />
          {sidebarRest.map((b) => b.node)}
        </aside>
      </div>
    </Shell>
  );
}
