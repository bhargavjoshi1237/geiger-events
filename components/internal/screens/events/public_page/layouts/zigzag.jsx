"use client";

import { galleryItem } from "@/lib/events/gallery";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, BlockSlot, EventMetaLine, StickyBuyBar } from "./shared";

// Photos to pair with the sections, cover first. Sections beyond the supply
// simply run without one, which is what keeps the rhythm from breaking on an
// event that only uploaded a cover.
function featureImages(event) {
  return (Array.isArray(event.gallery) ? event.gallery : [])
    .map(galleryItem)
    .map((it) => it.thumbUrl)
    .filter(Boolean);
}

// Zigzag — sections alternate image-left and image-right down the page, the
// feature-row rhythm every product marketing site settles on. Each section is
// paired with one of the event's photos, so a gallery does real work here
// instead of sitting in a strip.
export function ZigzagLayout({ ctx }) {
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
    coverClass,
    coverStyle,
  } = ctx;

  const images = featureImages(event);

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <Shell width={contentWidth} className="py-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-tertiary">
          {meta.tags.join(" · ")}
        </p>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {event.name}
        </h1>
        {themed && ctx.theme.tagline ? (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            {ctx.theme.tagline}
          </p>
        ) : null}
        <EventMetaLine event={event} className="mt-5 justify-center" />
        <div
          className={cn(
            "relative mt-10 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-border",
            event.coverUrl ? "" : coverClass,
          )}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <CoverImage event={event} />
        </div>
      </Shell>

      {disclaimerSlot("hero", "pb-8")}

      <Shell width={contentWidth} className="pb-12">
        {parts.hostsBlock}

        <div className="space-y-16 pt-12">
          {blocks.map((b, i) => {
            const src = images[i % Math.max(images.length, 1)] || "";
            return (
              <BlockSlot
                key={b.id}
                className={cn(
                  "grid items-center gap-8 lg:gap-14",
                  src && "lg:grid-cols-2",
                )}
                label={
                  src ? (
                    <div
                      className={cn(
                        "relative aspect-[4/3] overflow-hidden rounded-2xl border border-border",
                        i % 2 === 1 && "lg:order-last",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null
                }
              >
                {b.node}
              </BlockSlot>
            );
          })}
        </div>

        <div className="mt-16 grid items-start gap-6 border-t border-border pt-12 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12">
          <div>{register}</div>
          <div className="space-y-4">{sidebarRest.map((b) => b.node)}</div>
        </div>
        {disclaimerSlot("content", "pt-10")}
      </Shell>

      <StickyBuyBar ctx={ctx} />
      <div aria-hidden className="h-24" />
    </div>
  );
}
