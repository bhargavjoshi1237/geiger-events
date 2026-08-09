"use client";

import React, { useMemo } from "react";
import { ArrowLeft } from "lucide-react";

import { MapCanvas } from "@/components/internal/shared/map_canvas";
import { MapField } from "@/components/internal/shared/map_field";
import { cn } from "@/lib/utils";

// Presentational two-level seat map, shared by the buyer's picker and the
// organiser's box office. Level one draws the field and the section blocks only
// (~50-200 nodes no matter how big the venue); level two draws one section's
// chairs. Nothing ever renders every seat at once — that is the whole
// performance strategy, and pan/zoom does not change it: zooming magnifies the
// section blocks, clicking one still opens its seat grid.
//
// It owns no data and no persistence: callers supply the sections, the seats, a
// state per seat, the colours, and the click handlers.

export const SEAT_STATE_STYLE = {
  available: "bg-surface-strong border-border-strong hover:border-primary hover:bg-surface-active",
  selected: "bg-primary border-primary",
  sold: "bg-surface-subtle border-border cursor-not-allowed",
  held: "bg-amber-400/20 border-amber-400/40 cursor-not-allowed",
  blocked: "bg-violet-400/20 border-violet-400/40",
  accessible: "bg-sky-400/25 border-sky-400/50 hover:border-sky-300",
};

// Normalise a section's seats into 0-100 space so a small section still fills
// the drill-down view. Bowl sections are rotated, so this works off the seats'
// real extent rather than the section box.
function useNormalisedSeats(seats) {
  return useMemo(() => {
    if (!seats.length) return [];
    const xs = seats.map((s) => Number(s.x) || 0);
    const ys = seats.map((s) => Number(s.y) || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    return seats.map((seat) => ({
      ...seat,
      nx: 6 + ((Number(seat.x) - minX) / spanX) * 88,
      ny: 10 + ((Number(seat.y) - minY) / spanY) * 80,
    }));
  }, [seats]);
}

function SectionView({ section, seats, seatState, onSeatClick, seatLabel }) {
  const placed = useNormalisedSeats(seats);

  // One label per row, anchored to the row's leftmost chair.
  const rowAnchors = useMemo(() => {
    const byRow = new Map();
    for (const seat of placed) {
      const current = byRow.get(seat.rowLabel);
      if (!current || seat.nx < current.nx) byRow.set(seat.rowLabel, seat);
    }
    return [...byRow.values()];
  }, [placed]);

  return (
    <MapCanvas
      aspect="16/9"
      overlay={
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
          {section.name} · toward the front
        </div>
      }
    >
      {rowAnchors.map((seat) => (
        <span
          key={`row-${seat.rowLabel}`}
          className="pointer-events-none absolute -translate-x-full -translate-y-1/2 pr-1.5 text-[9px] font-medium tabular-nums text-text-tertiary"
          style={{ left: `${seat.nx}%`, top: `${seat.ny}%` }}
        >
          {seat.rowLabel}
        </span>
      ))}

      {placed.map((seat) => {
        const state = seatState(seat);
        const interactive = state === "available" || state === "selected" || state === "blocked";
        return (
          <button
            key={seat.id}
            type="button"
            disabled={!interactive}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => interactive && onSeatClick?.(seat)}
            aria-label={
              seatLabel
                ? seatLabel(seat, state)
                : `Row ${seat.rowLabel} seat ${seat.seatLabel}, ${state}`
            }
            title={`${seat.rowLabel}${seat.seatLabel}`}
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors",
              SEAT_STATE_STYLE[state] || SEAT_STATE_STYLE.available,
              !interactive && "opacity-60",
            )}
            style={{ left: `${seat.nx}%`, top: `${seat.ny}%` }}
          />
        );
      })}
    </MapCanvas>
  );
}

// The price bands under the map. Rendered only when the caller supplies a
// legend — the box office colours by availability instead and passes none.
function PriceLegend({ legend, format }) {
  if (!legend?.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {legend.map((band) => (
        <li key={band.key} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <span className={cn("h-2 w-2 rounded-full", band.dot)} />
          <span className="tabular-nums">{format ? format(band.price) : band.price}</span>
          {band.label ? <span className="text-text-tertiary">{band.label}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function SeatMapView({
  sections,
  seats,
  field,
  background,
  aspect = "16/10",
  activeSectionId,
  onSectionChange,
  seatState,
  onSeatClick,
  sectionMeta,
  disabledSectionIds,
  seatLabel,
  // buildPriceTiers() output. Absent -> every section renders in the neutral
  // surface colour, which is what the box office wants.
  colorBySectionId,
  legend,
  formatPrice,
}) {
  const active = useMemo(
    () => sections.find((s) => s.id === activeSectionId) || null,
    [sections, activeSectionId],
  );

  const activeSeats = useMemo(
    () => (active ? seats.filter((s) => s.sectionId === active.id) : []),
    [seats, active],
  );

  if (active) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onSectionChange(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Whole venue
        </button>
        <SectionView
          section={active}
          seats={activeSeats}
          seatState={seatState}
          onSeatClick={onSeatClick}
          seatLabel={seatLabel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MapCanvas
        aspect={aspect}
        background={background}
        overlay={
          sections.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-text-secondary">This map has no sections yet.</p>
            </div>
          ) : null
        }
      >
        <MapField field={field} />

        {sections.map((section) => {
          const meta = sectionMeta?.(section) || {};
          const disabled = disabledSectionIds?.has(section.id);
          const soldOut = meta.available === 0;
          const band = colorBySectionId?.[section.id];
          return (
            <button
              key={section.id}
              type="button"
              disabled={disabled || soldOut}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSectionChange(section.id)}
              aria-label={`${section.name}${meta.price ? `, from ${meta.price}` : ""}, ${
                meta.available ?? 0
              } available`}
              className={cn(
                "absolute flex flex-col items-center justify-center overflow-hidden rounded-md border p-0.5 text-center transition-colors hover:brightness-125",
                band
                  ? [band.fill, band.stroke]
                  : section.kind === "ga"
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-sky-400/30 bg-sky-400/10",
                (disabled || soldOut) && "cursor-not-allowed opacity-40 hover:brightness-100",
              )}
              style={{
                left: `${section.x}%`,
                top: `${section.y}%`,
                width: `${section.width}%`,
                height: `${section.height}%`,
                transform: section.rotation ? `rotate(${section.rotation}deg)` : undefined,
              }}
            >
              <span className="truncate text-[10px] font-medium leading-tight text-foreground">
                {section.name}
              </span>
              <span className="truncate text-[9px] leading-tight tabular-nums text-text-tertiary">
                {soldOut ? "Sold out" : `${meta.available ?? 0} open`}
              </span>
            </button>
          );
        })}
      </MapCanvas>

      <PriceLegend legend={legend} format={formatPrice} />
    </div>
  );
}

export default SeatMapView;
