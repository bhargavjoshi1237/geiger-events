"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatDate } from "../../sample_data";
import { getBlockMeta } from "../../page_block_library";
import { venueLine } from "../hero";

// Centered content container. Layouts that go full-bleed drop it for a band and
// re-open it around the copy inside that band.
export function Shell({ width, className, style, children }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", className)}
      style={{ maxWidth: width, ...style }}
    >
      {children}
    </div>
  );
}

// Cheapest price across the visible tiers — what a buy bar or a hero CTA quotes
// before the buyer has picked a tier.
export function priceLabel(tickets) {
  const prices = (tickets || []).map((t) => Number(t.price) || 0);
  if (!prices.length) return "";
  const low = Math.min(...prices);
  if (low === 0) return "Free";
  return prices.length > 1 ? `From $${low}` : `$${low}`;
}

// Thumb-reach purchase bar pinned to the bottom of the viewport. Used by the
// layouts whose hero doesn't carry a ticket panel of its own.
export function StickyBuyBar({ ctx }) {
  const { event, cta } = ctx;
  const { tickets, soldOut, onCheckout, primaryBtnStyle, ctaHover } = cta;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-surface-subtle/90 p-3 shadow-lg backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {event.name}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {formatDate(event.date)} · {priceLabel(tickets)}
          </p>
        </div>
        <Button
          style={soldOut ? undefined : primaryBtnStyle}
          disabled={soldOut}
          className={cn(
            "shrink-0 disabled:opacity-60",
            soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
          )}
          onClick={() => onCheckout(null)}
        >
          <Ticket className="h-4 w-4" />
          {soldOut ? "Sold out" : "Get tickets"}
        </Button>
      </div>
    </div>
  );
}

// The event's facts as label/value rows — the poster and bento layouts set them
// as a table instead of the inline icon row the classic hero uses.
export function MetaRows({ ctx, className }) {
  const { event, cta } = ctx;
  const rows = [
    ["Date", formatDate(event.date)],
    ["Time", event.time],
    ["Venue", venueLine(event)],
    ["Format", event.type],
    ["Tickets", cta.soldOut ? "Sold out" : priceLabel(cta.tickets)],
  ].filter(([, v]) => v);

  return (
    <dl className={cn("divide-y divide-border border-y border-border", className)}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-6 py-3"
        >
          <dt className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
            {label}
          </dt>
          <dd className="text-right text-sm font-medium text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Compact date/venue line reused by the layouts that don't render a full hero.
export function EventMetaLine({ event, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        {formatDate(event.date)} · {event.time}
      </span>
      <span className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {venueLine(event)}
      </span>
    </div>
  );
}

// Palette overrides for content laid over a cover photo. Same approach as
// bandTokens in lib/events/theme.js — re-point the tokens instead of forcing
// text-white onto every descendant, so the brand bar, chips, rules and meta
// rows all come along without each knowing they're on a photo.
export const OVER_COVER = {
  color: "#ffffff",
  "--foreground": "#ffffff",
  "--text-secondary": "rgb(255 255 255 / 0.78)",
  "--text-tertiary": "rgb(255 255 255 / 0.60)",
  "--border": "rgb(255 255 255 / 0.25)",
  "--border-strong": "rgb(255 255 255 / 0.4)",
  "--surface-card": "rgb(255 255 255 / 0.12)",
  "--surface-subtle": "rgb(255 255 255 / 0.08)",
  "--surface-active": "rgb(255 255 255 / 0.16)",
};

// A slot that disappears when the block inside it renders nothing. Event blocks
// return null when the organizer hasn't filled them in — no description, no
// highlights, no schedule — and any layout that gives a block a tile, a colored
// band or a margin label would otherwise draw an empty one.
// `bodyClassName`/`bodyStyle` land on the element that holds the block itself —
// nothing may sit between it and the block, or it is never empty and the guard
// never fires.
export function BlockSlot({
  className,
  label,
  bodyClassName,
  bodyStyle,
  children,
}) {
  return (
    <div className={cn("has-[[data-block-body]:empty]:hidden", className)}>
      {label}
      <div
        data-block-body
        className={cn("min-w-0", bodyClassName)}
        style={bodyStyle}
      >
        {children}
      </div>
    </div>
  );
}

// Two-up flow that never leaves a half-empty row. Flex wrapping lets the last
// item on a line grow into the space a missing partner would have taken, which
// a fixed two-column grid can't do.
export const PAIR_ROW = "flex flex-wrap items-start gap-8";
export const PAIR_ITEM = "min-w-0 grow basis-[calc(50%-1rem)]";
export const PAIR_WIDE = "min-w-0 basis-full";

export function blockLabel(block) {
  return getBlockMeta(block.type)?.label || block.type;
}

export function blockAnchor(block) {
  return `sec-${block.id}`;
}

// Sections whose label reads as a page destination. Spacers, dividers and bare
// text aren't worth a nav entry.
const NAV_SKIP = new Set(["divider", "spacer", "text", "richtext", "image"]);

export function navBlocks(blocks) {
  return blocks.filter((b) => !NAV_SKIP.has(b.type));
}

// Which anchored section is in view. Plain IntersectionObserver — the page is a
// handful of sections, so there's nothing to virtualise or throttle.
export function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0] || "");

  useEffect(() => {
    if (!ids.length) return undefined;
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.intersectionRatio));
        const best = ids
          .map((id) => [id, seen.get(id) || 0])
          .reduce((a, b) => (b[1] > a[1] ? b : a), [ids[0], 0]);
        if (best[1] > 0) setActive(best[0]);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return active;
}

// Wraps a rendered block so anchor navigation can reach it.
export function Anchored({ block, children, className }) {
  return (
    <section id={blockAnchor(block)} className={cn("scroll-mt-24", className)}>
      {children}
    </section>
  );
}
