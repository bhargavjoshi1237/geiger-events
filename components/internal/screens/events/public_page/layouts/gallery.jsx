"use client";

import { useMemo } from "react";

import { galleryItem } from "@/lib/events/gallery";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine } from "./shared";

const MOSAIC_MAX = 4;

function mosaic(event) {
  const shots = (Array.isArray(event.gallery) ? event.gallery : [])
    .map(galleryItem)
    .map((it) => it.thumbUrl)
    .filter(Boolean);
  const total = (Array.isArray(event.gallery) ? event.gallery : []).length;
  return { photos: shots.slice(0, MOSAIC_MAX), rest: total > MOSAIC_MAX };
}

export function GalleryLayout({ ctx }) {
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

  const { photos, rest } = useMemo(() => mosaic(event), [event.gallery]);

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <div className="mt-4 grid gap-1.5 px-1.5 sm:grid-cols-3 lg:grid-cols-4">
        <div
          className={cn(
            "relative col-span-full aspect-[16/9] overflow-hidden sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[26rem] lg:col-span-2",
            event.coverUrl ? "" : coverClass,
          )}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <CoverImage event={event} />
        </div>
        {photos.map((src) => (
          <div
            key={src}
            className="relative hidden aspect-[4/3] overflow-hidden sm:block"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      <Shell width={contentWidth} className="py-12">
        <header className="space-y-4 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-tertiary">
            {meta.tags.join(" · ")}
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {event.name}
          </h1>
          {themed && ctx.theme.tagline ? (
            <p className="max-w-2xl text-lg text-text-secondary">
              {ctx.theme.tagline}
            </p>
          ) : null}
          <EventMetaLine event={event} />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          <div
            className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
            style={sectionGapStyle}
          >
            {disclaimerSlot("hero")}
            {parts.hostsBlock}
            {rest ? parts.gallery : null}
            {blocks.map((b) => b.node)}
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
