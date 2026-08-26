"use client";

import React, { useMemo } from "react";
import { Accessibility, Check, ChevronRight, Ticket } from "lucide-react";

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

function qualityBadge(score) {
  if (score >= 0.8)
    return { label: "Prime", tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" };
  if (score >= 0.6)
    return { label: "Great view", tone: "border-teal-500/25 bg-teal-500/10 text-teal-300" };
  if (score >= 0.4)
    return { label: "Good view", tone: "border-sky-500/25 bg-sky-500/10 text-sky-300" };
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
          "relative flex w-full items-center gap-3 py-2 pl-4 pr-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          selected ? "bg-surface-active" : "hover:bg-surface-hover",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-0.5 transition-colors",
            selected ? "bg-primary" : "bg-transparent",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              Row {offer.rowLabel}
            </span>
            {badge ? (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4",
                  badge.tone,
                )}
              >
                {badge.label}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-text-tertiary">
            {!offer.fits
              ? `${offer.available} open · not together`
              : quantity > 1
                ? `${quantity} together · ${offer.available} open`
                : `${offer.available} open`}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatPrice(offer.price)}
        </span>
      </button>
    </li>
  );
}

function BestValue({ offer, onSelect, formatPrice, accent }) {
  if (!offer) return null;
  return (
    <div className="border-b border-border p-2.5">
      <button
        type="button"
        onClick={() => onSelect(offer)}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-primary/25 bg-primary/[0.07] py-2.5 pl-3 pr-2.5 text-left transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={accent ? { borderColor: `${accent}40` } : undefined}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-primary"
          style={accent ? { backgroundColor: accent } : undefined}
        />
        <span className="min-w-0 flex-1">
          <span
            className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-primary"
            style={accent ? { color: accent } : undefined}
          >
            Best available
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
            Sec {offer.sectionName} · Row {offer.rowLabel}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatPrice(offer.price)}
          </span>
          <ChevronRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </div>
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
  onQuantityChange,
  maxQuantity = 8,
  bestOffer,
  selectedOfferId,
  onSelectOffer,
  formatPrice,
  accent,
}) {
  const hasRange = priceRange.max > priceRange.min;
  const priceStep = hasRange
    ? Math.max(0.01, Math.round(((priceRange.max - priceRange.min) / 100) * 100) / 100)
    : 1;

  const groups = useMemo(() => {
    const bySection = new Map();
    for (const offer of offers) {
      const group = bySection.get(offer.sectionId);
      if (group) {
        group.offers.push(offer);
        group.low = Math.min(group.low, offer.price);
        group.high = Math.max(group.high, offer.price);
      } else
        bySection.set(offer.sectionId, {
          id: offer.sectionId,
          name: offer.sectionName,
          ticketName: offer.ticketName,
          low: offer.price,
          high: offer.price,
          offers: [offer],
        });
    }
    return [...bySection.values()];
  }, [offers]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          Rows on sale
        </h2>

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
                onMaxPriceChange(v >= priceRange.max ? null : v)
              }
              aria-label="Maximum price"
              className="flex-1"
            />
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                maxPrice === null ? "text-text-tertiary" : "text-primary",
              )}
              style={maxPrice !== null && accent ? { color: accent } : undefined}
            >
              {maxPrice === null ? `${formatPrice(priceRange.max)}+` : formatPrice(maxPrice)}
            </span>
          </div>
        ) : null}
      </div>

      {offers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-active">
            <Ticket className="h-5 w-5 text-text-tertiary" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Nothing at this price</p>
            <p className="text-xs text-text-tertiary">
              {accessibleOnly
                ? "No accessible rows match these filters. Widen the price or turn the filter off."
                : "No rows match these filters. Try raising the price ceiling."}
            </p>
          </div>
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
                <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-y border-border bg-surface-subtle/95 px-3 py-1.5 backdrop-blur">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                    Sec {group.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">
                    {group.low === group.high
                      ? formatPrice(group.low)
                      : `from ${formatPrice(group.low)}`}
                    <span className="mx-1 text-border-strong">·</span>
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

          <p className="flex items-center gap-1.5 border-t border-border bg-surface-subtle px-3 py-2 text-[11px] text-text-tertiary">
            <Check className="h-3 w-3 text-emerald-400" />
            <span className="tabular-nums">
              {offers.length} row{offers.length === 1 ? "" : "s"} across {groups.length} section
              {groups.length === 1 ? "" : "s"}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export default SeatOffers;
