"use client";

import { CoverImage } from "../hero";
import { Shell, MetaRows, BlockSlot } from "./shared";

// Poster — the type is the hero. An oversized title runs edge to edge, the
// facts are set as a data table instead of an icon row, and every section is
// labelled in the margin like a printed programme. Needs no cover image at all,
// which is what makes it the fallback for events that have no artwork yet.
export function PosterLayout({ ctx }) {
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
    parts,
  } = ctx;

  return (
    <Shell width={contentWidth} className="relative z-10 py-12">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}

      <header className="border-b border-border pb-10 pt-6">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-text-tertiary">
          {meta.tags.join(" / ")}
        </p>
        <h1 className="text-balance text-5xl font-bold uppercase leading-[0.92] tracking-tighter text-foreground sm:text-7xl lg:text-8xl">
          {event.name}
        </h1>
        {themed && ctx.theme.tagline ? (
          <p className="mt-6 max-w-2xl text-lg leading-snug text-text-secondary">
            {ctx.theme.tagline}
          </p>
        ) : null}
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div>
          <MetaRows ctx={ctx} className="mb-10 font-mono" />
          {event.coverUrl ? (
            <div className="mb-10 aspect-[3/2] w-full overflow-hidden border border-border">
              <CoverImage event={event} />
            </div>
          ) : null}
          {parts.gallery ? <div className="mb-10">{parts.gallery}</div> : null}
          <div className="mb-10">{parts.hostsBlock}</div>
          {disclaimerSlot("hero", "mb-10")}

          {/* Sections are numbered in the margin like a printed programme.
              Their own headings already name them — repeating the name here
              would just set it twice. */}
          <div className="divide-y divide-border border-t border-border">
            {blocks.map((b, i) => (
              <BlockSlot
                key={b.id}
                className="grid gap-4 py-10 sm:grid-cols-[4rem_1fr] sm:gap-8"
                label={
                  <p className="font-mono text-xs tabular-nums tracking-[0.2em] text-text-tertiary">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                }
              >
                {b.node}
              </BlockSlot>
            ))}
          </div>
          {disclaimerSlot("content")}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {register}
          {sidebarRest.map((b) => b.node)}
        </div>
      </div>
    </Shell>
  );
}
