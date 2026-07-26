"use client";

import React, { useMemo } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

// Presentational two-level seat map, shared by the buyer's picker and the
// organiser's box office. Level one draws section blocks only (~50-200 nodes no
// matter how big the venue); level two draws one section's chairs. Nothing ever
// renders every seat at once — that is the whole performance strategy.
//
// It owns no data and no persistence: callers supply the sections, the seats,
// a state per seat, and the click handlers.

export const SEAT_STATE_STYLE = {
  available: "bg-surface-strong border-border-strong hover:border-primary hover:bg-surface-active",
  selected: "bg-primary border-primary",
  sold: "bg-surface-subtle border-border cursor-not-allowed",
  held: "bg-amber-400/20 border-amber-400/40 cursor-not-allowed",
  blocked: "bg-violet-400/20 border-violet-400/40",
  accessible: "bg-sky-400/25 border-sky-400/50 hover:border-sky-300",
};

// Normalise a section's seats into 0-100 space so a small section still fills
// the drill-down view.
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
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
        {section.name} · toward stage
      </div>

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
            onClick={() => interactive && onSeatClick?.(seat)}
            aria-label={seatLabel ? seatLabel(seat, state) : `Row ${seat.rowLabel} seat ${seat.seatLabel}, ${state}`}
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
    </div>
  );
}

export function SeatMapView({
  sections,
  seats,
  activeSectionId,
  onSectionChange,
  seatState,
  onSeatClick,
  sectionMeta,
  disabledSectionIds,
  seatLabel,
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
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-border-strong bg-surface-strong px-6 py-1 text-[10px] font-medium uppercase tracking-widest text-text-secondary">
        Stage
      </div>

      {sections.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-text-secondary">This map has no sections yet.</p>
        </div>
      ) : null}

      {sections.map((section) => {
        const meta = sectionMeta?.(section) || {};
        const disabled = disabledSectionIds?.has(section.id);
        const soldOut = meta.available === 0;
        return (
          <button
            key={section.id}
            type="button"
            disabled={disabled || soldOut}
            onClick={() => onSectionChange(section.id)}
            aria-label={`${section.name}${meta.price ? `, from ${meta.price}` : ""}, ${meta.available ?? 0} available`}
            className={cn(
              "absolute flex flex-col items-center justify-center rounded-lg border p-1 text-center transition-colors",
              section.kind === "ga"
                ? "border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20"
                : "border-sky-400/30 bg-sky-400/10 hover:bg-sky-400/20",
              (disabled || soldOut) && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
            style={{
              left: `${section.x}%`,
              top: `${section.y}%`,
              width: `${section.width}%`,
              height: `${section.height}%`,
              transform: section.rotation ? `rotate(${section.rotation}deg)` : undefined,
            }}
          >
            <span className="truncate text-[11px] font-medium text-foreground">
              {section.name}
            </span>
            {meta.price ? (
              <span className="text-[10px] tabular-nums text-text-secondary">
                from {meta.price}
              </span>
            ) : null}
            <span className="text-[10px] tabular-nums text-text-tertiary">
              {soldOut ? "Sold out" : `${meta.available ?? 0} open`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SeatMapView;
