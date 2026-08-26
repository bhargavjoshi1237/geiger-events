"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, StickyBuyBar } from "./shared";

const STACK_WIDTH = "36rem";

export function StackLayout({ ctx }) {
  const {
    event,
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
      <Shell width={STACK_WIDTH} className="relative z-10 py-10">
        {disclaimerSlot("top", "mb-6")}
        {brandBar}

        <div className="space-y-4 pt-4">
          <div
            className={cn(
              "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border",
              event.coverUrl ? "" : coverClass,
            )}
            style={event.coverUrl ? undefined : coverStyle}
          >
            <CoverImage event={event} />
          </div>

          <div className="space-y-3 px-1">
            <div className="flex flex-wrap gap-2">
              {meta.tags.map((t) => (
                <Badge key={t} variant="neutral">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="text-sm text-text-secondary">{ctx.theme.tagline}</p>
            ) : null}
            <EventMetaLine event={event} />
          </div>

          {parts.gallery}
          {parts.hostsBlock}
          {disclaimerSlot("hero")}

          {register}

          {blocks.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-border bg-surface-subtle p-5 empty:hidden"
            >
              {b.node}
            </div>
          ))}

          {sidebarRest.map((b) => b.node)}
          {disclaimerSlot("content")}
        </div>
      </Shell>

      <StickyBuyBar ctx={ctx} />
      <div aria-hidden className="h-24" />
    </>
  );
}
