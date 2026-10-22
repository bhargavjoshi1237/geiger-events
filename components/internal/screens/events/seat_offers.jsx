"use client";

import React, { useMemo } from "react";
import { Accessibility, Check, ChevronRight, Star, Ticket } from "lucide-react";

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
    return { label: "Prime", tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (score >= 0.6)
    return { label: "Great view", tone: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300" };
  if (score >= 0.4)
    return { label: "Good view", tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300" };
  return null;
}

function QualityBadge({ score }) {
  const badge = qualityBadge(score ?? 0);
  if (!badge) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4",
        badge.tone,
      )}
    >
      {badge.label}
    </span>
  );
}

function availability(offer, quantity) {
  if (!offer.fits) return `${offer.available} open · not together`;
  return quantity > 1 ? `${quantity} together · ${offer.available} open` : `${offer.available} open`;
}

const tinted = (accent) => (accent ? { color: accent } : undefined);

// Price lives on the section header (one ticket per section), so a row only says what's open.
function OfferRow({ offer, selected, onSelect, quantity, accent }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(offer)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-2 py-2 pl-7 pr-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          selected ? "bg-surface-active" : "hover:bg-surface-hover",
        )}
      >
        <span className="shrink-0 text-sm font-medium text-foreground">Row {offer.rowLabel}</span>
        <QualityBadge score={offer.quality} />
        <span
          className={cn(
            "ml-auto min-w-0 truncate pl-2 text-xs tabular-nums",
            offer.fits ? "text-text-tertiary" : "text-amber-600 dark:text-amber-400",
          )}
        >
          {availability(offer, quantity)}
        </span>
        {selected ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" style={tinted(accent)} />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        )}
      </button>
    </li>
  );
}

function BestValue({ offer, selected, onSelect, formatPrice, quantity, accent }) {
  if (!offer) return null;
  return (
    <div className="border-b border-border p-3">
      <button
        type="button"
        onClick={() => onSelect(offer)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg border bg-surface-card p-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          selected
            ? "border-border-strong"
            : "border-border hover:border-border-strong hover:bg-surface-hover",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-active">
          <Star className="h-4 w-4 text-primary" style={tinted(accent)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Best available
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
            Sec {offer.sectionName} · Row {offer.rowLabel}
          </span>
          <span className="block truncate text-xs tabular-nums text-text-tertiary">
            {availability(offer, quantity)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatPrice(offer.price)}
          </span>
          {selected ? (
            <Check className="h-4 w-4 text-primary" style={tinted(accent)} />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
          )}
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
  colorBySectionId,
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
      <div className="space-y-3 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Rows on sale
          </h2>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-pressed={accessibleOnly}
            onClick={() => onAccessibleChange(!accessibleOnly)}
            className={cn(
              "h-7 border px-2 text-text-secondary hover:bg-surface-active hover:text-foreground",
              accessibleOnly
                ? "border-border-strong bg-surface-active text-foreground"
                : "border-border",
            )}
          >
            <Accessibility className="h-3.5 w-3.5" />
            Accessible
          </Button>
        </div>

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

        <SegmentedTabs
          tabs={OFFER_SORTS}
          value={sort}
          onChange={onSortChange}
          fullWidth
          buttonClassName="px-2"
        />

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
              style={maxPrice !== null ? tinted(accent) : undefined}
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
          {/* With a single row the card would only repeat the list. */}
          {offers.length > 1 ? (
            <BestValue
              offer={bestOffer}
              selected={bestOffer?.id === selectedOfferId}
              onSelect={onSelectOffer}
              formatPrice={formatPrice}
              quantity={quantity}
              accent={accent}
            />
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {groups.map((group) => (
              <section key={group.id} className="border-b border-border/60 pb-1 last:border-b-0">
                <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-surface-subtle/95 px-3 pb-1 pt-2.5 backdrop-blur">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      colorBySectionId?.[group.id]?.dot || "bg-border-strong",
                    )}
                  />
                  <span className="shrink-0 text-xs font-semibold text-foreground">
                    Sec {group.name}
                  </span>
                  {group.ticketName ? (
                    <span className="min-w-0 truncate text-xs text-text-tertiary">
                      {group.ticketName}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 pl-2 text-xs font-semibold tabular-nums text-foreground">
                    {group.low === group.high
                      ? formatPrice(group.low)
                      : `from ${formatPrice(group.low)}`}
                  </span>
                </h3>
                <ul>
                  {group.offers.map((offer) => (
                    <OfferRow
                      key={offer.id}
                      offer={offer}
                      quantity={quantity}
                      selected={offer.id === selectedOfferId}
                      onSelect={onSelectOffer}
                      accent={accent}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="flex items-center gap-1.5 border-t border-border bg-surface-subtle px-3 py-2 text-[11px] text-text-tertiary">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
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
