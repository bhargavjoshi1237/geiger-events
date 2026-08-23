"use client";

import { Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import {
  Shell,
  BlockSlot,
  EventMetaLine,
  OVER_COVER,
  priceLabel,
} from "./shared";

function CtaBand({ ctx, tone = "accent" }) {
  const { cta, event } = ctx;
  return (
    <section
      className={cn(
        "border-y border-border py-14",
        tone === "accent" ? "bg-surface-subtle" : "",
      )}
    >
      <Shell width={ctx.contentWidth} className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {cta.soldOut ? "This event is sold out" : `Secure your place at ${event.name}`}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-text-secondary">
          {cta.soldOut
            ? "Registration has closed for this event."
            : `${priceLabel(cta.tickets)} · ${cta.showRemaining && Number.isFinite(cta.remaining) ? `${cta.remaining.toLocaleString("en-US")} tickets remaining` : "Book before it fills up"}`}
        </p>
        <Button
          size="lg"
          style={cta.soldOut ? undefined : cta.primaryBtnStyle}
          disabled={cta.soldOut}
          className={cn(
            "mt-6 disabled:opacity-60",
            cta.soldOut || !cta.ctaHover ? "hover:opacity-90" : cta.ctaHover,
          )}
          onClick={() => cta.onCheckout(null)}
        >
          <Ticket className="h-4 w-4" />
          {cta.soldOut ? "Sold out" : "Get tickets"}
        </Button>
      </Shell>
    </section>
  );
}

// Landing page — full-width alternating bands with the call to action repeated
// down the page, the way a conference's own marketing site is built. Sections
// get their own heading and their own slab of colour instead of stacking inside
// one column.
export function LandingLayout({ ctx }) {
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

  // The CTA band repeats once mid-page on longer pages, then closes the page.
  const midpoint = blocks.length >= 4 ? Math.ceil(blocks.length / 2) : -1;

  // Each section gets its own slab of colour. Sections carry their own
  // headings, so the band adds none — and an unfilled one hides rather than
  // painting an empty stripe across the page.
  const band = (b, i) => (
    <BlockSlot
      key={b.id}
      className={cn(
        "py-16",
        i % 2 === 1 ? "border-y border-border bg-surface-subtle/50" : "",
      )}
      bodyClassName="mx-auto w-full px-4 sm:px-6 lg:px-8"
      bodyStyle={{ maxWidth: contentWidth }}
    >
      {b.node}
    </BlockSlot>
  );

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <section className="relative overflow-hidden py-20 sm:py-28">
        <div
          className={cn("absolute inset-0", event.coverUrl ? "" : coverClass)}
          style={event.coverUrl ? undefined : coverStyle}
        >
          <CoverImage event={event} />
        </div>
        {event.coverUrl ? (
          <div aria-hidden className="absolute inset-0 bg-black/60" />
        ) : null}
        <Shell
          width={contentWidth}
          className="relative"
          style={event.coverUrl ? OVER_COVER : undefined}
        >
          <div className="max-w-2xl space-y-5">
            <div className="flex flex-wrap gap-2">
              {meta.tags.map((t) => (
                <Badge key={t} variant="neutral">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="max-w-xl text-lg text-text-secondary">
                {ctx.theme.tagline}
              </p>
            ) : null}
            <EventMetaLine event={event} />
            <div className="flex flex-wrap items-center gap-3 pt-2">
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
        </Shell>
      </section>

      {disclaimerSlot("hero", "py-8")}

      <section className="py-12">
        <Shell width={contentWidth} className="space-y-8">
          {parts.hostsBlock}
          {parts.gallery}
        </Shell>
      </section>

      {blocks.map((b, i) => (
        <div key={b.id}>
          {i === midpoint ? <CtaBand ctx={ctx} /> : null}
          {band(b, i)}
        </div>
      ))}

      <section className="border-t border-border py-16">
        <Shell width={contentWidth}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-12">
            <div>{register}</div>
            <div className="space-y-4">{sidebarRest.map((b) => b.node)}</div>
          </div>
        </Shell>
      </section>

      <CtaBand ctx={ctx} tone="plain" />
      {disclaimerSlot("content", "py-8")}
    </div>
  );
}
