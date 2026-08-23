"use client";

import { cn } from "@/lib/utils";

import { BannerHero } from "../hero";
import { Shell } from "./shared";

// Classic — the layout the event page has always had. Cover and detail run down
// a wide main column with the ticket panel in a sticky rail beside it. The only
// layout that honours the separate Hero style and Ticket sidebar settings.
export function ClassicLayout({ ctx }) {
  const {
    event,
    contentWidth,
    sectionGapStyle,
    themed,
    hero,
    sidebarLeft,
    brandBar,
    heroRegion,
    blocks,
    sidebarNodes,
    disclaimerSlot,
    meta,
    coverClass,
    coverStyle,
    bannerOverlay,
  } = ctx;

  return (
    <Shell width={contentWidth} className="relative z-10 py-16">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}
      {hero === "banner" ? (
        <BannerHero
          event={event}
          tags={meta.tags}
          coverClass={coverClass}
          coverStyle={coverStyle}
          bannerOverlay={bannerOverlay}
        />
      ) : null}

      <div
        className={cn(
          "grid grid-cols-1 gap-10 lg:gap-16",
          sidebarLeft ? "lg:grid-cols-[380px_1fr]" : "lg:grid-cols-[1fr_380px]",
        )}
      >
        <div
          className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
          style={sectionGapStyle}
        >
          {heroRegion}
          {disclaimerSlot("hero")}
          {blocks.map((b) => b.node)}
          {disclaimerSlot("content")}
        </div>

        <div
          className={cn(
            "space-y-4 lg:sticky lg:top-20 lg:self-start",
            sidebarLeft && "lg:order-first",
          )}
        >
          {sidebarNodes.map((b) => b.node)}
        </div>
      </div>
    </Shell>
  );
}
