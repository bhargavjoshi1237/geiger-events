"use client";

import { Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import {
  Shell,
  MetaRows,
  PAIR_ITEM,
  PAIR_ROW,
  PAIR_WIDE,
  priceLabel,
} from "./shared";

const WIDE = new Set([
  "schedule",
  "location",
  "guests",
  "whosgoing",
  "infographics",
  "columns",
]);

export function MarqueeLayout({ ctx }) {
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
    cta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  const run = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="relative z-10 overflow-hidden">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <div className="border-y border-border py-6">
        <div className="flex w-max animate-[ev-marquee_30s_linear_infinite] items-center gap-8 motion-reduce:animate-none">
          {run.map((i) => (
            <span
              key={i}
              className="whitespace-nowrap text-5xl font-bold uppercase leading-none tracking-tighter text-foreground sm:text-7xl"
            >
              {event.name}
              <span className="px-8 text-text-tertiary">✦</span>
            </span>
          ))}
        </div>
        <style>{`@keyframes ev-marquee { to { transform: translateX(-50%); } }`}</style>
      </div>

      <Shell width={contentWidth} className="py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="space-y-6">
            <div
              className={cn(
                "relative aspect-[21/9] w-full overflow-hidden",
                event.coverUrl ? "" : coverClass,
              )}
              style={event.coverUrl ? undefined : coverStyle}
            >
              <CoverImage event={event} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-tertiary">
              {meta.tags.join(" · ")}
            </p>
            {themed && ctx.theme.tagline ? (
              <p className="max-w-2xl text-xl leading-snug text-foreground">
                {ctx.theme.tagline}
              </p>
            ) : null}
            <MetaRows ctx={ctx} className="font-mono" />
            {parts.hostsBlock}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                style={cta.soldOut ? undefined : cta.primaryBtnStyle}
                disabled={cta.soldOut}
                className={cn(
                  "disabled:opacity-60",
                  cta.soldOut || !cta.ctaHover ? "hover:opacity-90" : cta.ctaHover,
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

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {register}
            {sidebarRest.map((b) => b.node)}
          </div>
        </div>

        {disclaimerSlot("hero", "pt-10")}
        {parts.gallery ? <div className="pt-10">{parts.gallery}</div> : null}

        <div className={cn(PAIR_ROW, "pt-12")}>
          {blocks.map((b) => (
            <div
              key={b.id}
              className={cn(
                "empty:hidden",
                WIDE.has(b.type) ? PAIR_WIDE : PAIR_ITEM,
              )}
            >
              {b.node}
            </div>
          ))}
        </div>
        {disclaimerSlot("content", "pt-10")}
      </Shell>
    </div>
  );
}
