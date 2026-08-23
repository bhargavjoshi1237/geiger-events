"use client";

import React, { useMemo } from "react";
import { Accessibility, Check, Sparkles, Ticket } from "lucide-react";

import {
  Button,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { OFFER_SORTS } from "@/lib/seating/offers";

// The panel beside the seat map: every row that is actually on sale, ranked and
// filtered, and the way in to any of them.
//
// A map answers "where is section 228?". It does not answer "where are two
// seats together under $80?" — the question buyers actually arrive with, and
// the reason every modern ticketing site puts a list next to the map.
//
// Two things it deliberately does NOT do any more. It no longer draws a venue
// thumbnail per row: at 56px, with every section in the venue rendered into it,
// the highlight was a smudge, and there were sections x rows x sections of them.
// And it no longer lists every row flat — a venue selling at one price produced
// fourteen indistinguishable rows of one section before it reached anything
// else. Rows are grouped under their section and led by the best seat on sale.
//
// It owns no data and no persistence: the offers, the selection and the
// handlers all come from the picker. It is also the ACCESSIBLE path to the map,
// which is a canvas: every row here is a real button.

// A postage-stamp of the whole venue with one section lit up. Still used by the
// DOM seat map (the box office), which draws its own drill-down.
export function VenueThumb({ sections, field, aspect, highlightId, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 overflow-hidden rounded border border-border bg-background",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {field && field.shape !== "none" ? (
        <span
          className="absolute rounded-[1px] bg-surface-strong"
          style={{
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: `${field.width}%`,
            height: `${field.height}%`,
          }}
        />
      ) : null}
      {sections.map((s) => (
        <span
          key={s.id}
          className={cn(
            "absolute rounded-[1px]",
            s.id === highlightId ? "bg-primary" : "bg-border-strong/70",
          )}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.width}%`,
            height: `${s.height}%`,
            transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
          }}
        />
      ))}
    </span>
  );
}

// Quality is a 0-1 score from the map's geometry (lib/seating/quality.js). Shown
// as a word rather than a number: nobody buys "0.82".
function qualityBadge(score) {
  if (score >= 0.8) return { label: "Prime", tone: "text-emerald-400" };
  if (score >= 0.6) return { label: "Great view", tone: "text-teal-400" };
  if (score >= 0.4) return { label: "Good view", tone: "text-sky-400" };
  return null;
}

function OfferRow({ offer, selected, onSelect, formatPrice, quantity }) {
  const badge = qualityBadge(offer.quality ?? 0);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(offer)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          selected ? "bg-surface-active" : "hover:bg-surface-hover",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            Row {offer.rowLabel}
          </span>
          <span className="block truncate text-xs text-text-tertiary">
            {/* "1 together" is not a thing — at a party of one the count is the
                only fact worth stating. */}
            {!offer.fits
              ? `${offer.available} open · not together`
              : quantity > 1
                ? `${quantity} together · ${offer.available} open`
                : `${offer.available} open`}
            {badge ? <span className={cn("ml-1.5", badge.tone)}>· {badge.label}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {formatPrice(offer.price)}
        </span>
      </button>
    </li>
  );
}

// The single best seat on sale, pulled out of the list. With one flat ticket
// price this is the only thing on the panel carrying a recommendation.
function BestValue({ offer, onSelect, formatPrice, accent }) {
  if (!offer) return null;
  return (
    <button
      type="button"
      onClick={() => onSelect(offer)}
      className="flex w-full items-center gap-3 border-b border-border bg-primary/5 px-3 py-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15"
        style={accent ? { backgroundColor: `${accent}26` } : undefined}
      >
        <Sparkles className="h-4 w-4 text-primary" style={accent ? { color: accent } : undefined} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-primary" style={accent ? { color: accent } : undefined}>
          Best available
        </span>
        <span className="block truncate text-sm font-medium text-foreground">
          Sec {offer.sectionName} · Row {offer.rowLabel}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatPrice(offer.price)}
      </span>
    </button>
  );
}

export function SeatOffers({
  offers,
  sort,
  onSortChange,
  maxPrice,
  priceRange,
  onMaxPriceChange,
  accessibleOnly,
  onAccessibleChange,
  quantity,
  // Present only when the buyer is free to choose their party size — in
  // type-first mode the earlier step already fixed it.
  onQuantityChange,
  maxQuantity = 8,
  bestOffer,
  selectedOfferId,
  onSelectOffer,
  formatPrice,
  accent,
}) {
  // One price on sale is not a range — a slider there can only ever remove
  // seats from a list the buyer already asked for.
  const hasRange = priceRange.max > priceRange.min;
  // The endpoints are exact prices now, so a fixed step of 1 would overshoot a
  // narrow spread and never land on either end of a wide fractional one.
  const priceStep = hasRange
    ? Math.max(0.01, Math.round(((priceRange.max - priceRange.min) / 100) * 100) / 100)
    : 1;

  // Rows under their section, in whatever order the sort put the sections in.
  // Grouping is what stops fourteen rows of one section reading as the whole
  // venue's worth of choice.
  const groups = useMemo(() => {
    const bySection = new Map();
    for (const offer of offers) {
      const group = bySection.get(offer.sectionId);
      if (group) group.offers.push(offer);
      else
        bySection.set(offer.sectionId, {
          id: offer.sectionId,
          name: offer.sectionName,
          ticketName: offer.ticketName,
          offers: [offer],
        });
    }
    return [...bySection.values()];
  }, [offers]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        {onQuantityChange ? (
          <Select value={String(quantity)} onValueChange={(v) => onQuantityChange(Number(v) || 1)}>
            <SelectTrigger aria-label="How many seats together">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? "seat" : "seats together"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex items-center gap-2">
          <SegmentedTabs
            tabs={OFFER_SORTS}
            value={sort}
            onChange={onSortChange}
            fullWidth
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={accessibleOnly}
            aria-label="Accessible seats only"
            title="Accessible seats only"
            onClick={() => onAccessibleChange(!accessibleOnly)}
            className={cn(
              "h-9 w-9 shrink-0 p-0 text-muted-foreground hover:bg-surface-active hover:text-foreground",
              accessibleOnly && "bg-surface-active text-foreground",
            )}
          >
            <Accessibility className="h-4 w-4" />
          </Button>
        </div>

        {hasRange ? (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
              {formatPrice(priceRange.min)}
            </span>
            <Slider
              min={priceRange.min}
              max={priceRange.max}
              step={priceStep}
              value={[maxPrice ?? priceRange.max]}
              onValueChange={([v]) =>
                // Top of the slider means "no ceiling", so the dearest seat
                // never filters itself out of its own range.
                onMaxPriceChange(v >= priceRange.max ? null : v)
              }
              aria-label="Maximum price"
              className="flex-1"
            />
            <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
              {maxPrice === null ? `${formatPrice(priceRange.max)}+` : formatPrice(maxPrice)}
            </span>
          </div>
        ) : null}
      </div>

      {offers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Ticket className="h-5 w-5 text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            {accessibleOnly
              ? "No accessible seats match this filter."
              : "No seats match this filter."}
          </p>
          {(maxPrice !== null || accessibleOnly) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onMaxPriceChange(null);
                onAccessibleChange(false);
              }}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <BestValue
            offer={bestOffer}
            onSelect={onSelectOffer}
            formatPrice={formatPrice}
            accent={accent}
          />

          <div className="flex-1 overflow-y-auto">
            {groups.map((group) => (
              <section key={group.id}>
                <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-border bg-surface-subtle/95 px-3 py-1.5 backdrop-blur">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Sec {group.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">
                    {group.offers.length} row{group.offers.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <ul className="divide-y divide-border/60">
                  {group.offers.map((offer) => (
                    <OfferRow
                      key={offer.id}
                      offer={offer}
                      quantity={quantity}
                      selected={offer.id === selectedOfferId}
                      onSelect={onSelectOffer}
                      formatPrice={formatPrice}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-text-tertiary">
            <Check className="h-3 w-3" />
            {offers.length} row{offers.length === 1 ? "" : "s"} across {groups.length} section
            {groups.length === 1 ? "" : "s"}
          </p>
        </>
      )}
    </div>
  );
}

export default SeatOffers;
