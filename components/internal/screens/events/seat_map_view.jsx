"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { MapCanvas } from "@/components/internal/shared/map_canvas";
import { MapField } from "@/components/internal/shared/map_field";
import { aspectRatio } from "@/lib/seating/geometry";
import { sectionSeatGrid } from "@/lib/seating/section_grid";
import { cn } from "@/lib/utils";

import { VenueThumb } from "./seat_offers";

// Presentational seat map, shared by the buyer's picker and the organiser's box
// office. ONE canvas always draws the whole venue; picking a section glides the
// viewport into that block instead of swapping screens, so the neighbouring
// sections stay visible for orientation while the chosen section's chairs fade
// in in place. "Whole venue" glides back out. Only one section's seats exist as
// DOM nodes at a time (~50-200 no matter how big the venue) — that is the whole
// performance strategy, and zooming doesn't change it.
//
// Chairs are drawn from sectionSeatGrid(), not from their stored coordinates
// directly: the stored grid is squashed by whatever shape the section box came
// out of the ring geometry, and it is the chair PITCH, not the box, that has to
// be square for the block to read as a seating chart.
//
// It owns no data and no persistence: callers supply the sections, the seats, a
// state per seat, the colours, and the click handlers.

// Chairs are told apart by FILL alone. A border would have to be counter-scaled
// against a zoom of 15, i.e. asked to paint at 0.07px, which browsers round
// away or snap to a whole device pixel — either way the grid stops being even.
export const SEAT_STATE_STYLE = {
  available: "bg-border-strong hover:bg-primary/70",
  selected: "bg-primary",
  sold: "bg-surface-active cursor-not-allowed",
  held: "bg-amber-400/60 cursor-not-allowed",
  blocked: "bg-violet-400/60",
  accessible: "bg-sky-400/70 hover:bg-sky-300",
  // Open, but hidden by a filter the buyer switched on. Distinct from `sold`
  // so the map — and the screen reader label — don't claim it's gone.
  filtered: "bg-surface-active/50 cursor-not-allowed",
};

// Share of its cell a chair fills. Chairs sit as close as 0.94 of the pitch
// apart on a curved block, so anything much above this closes the gutter up and
// the grid reads as one slab you can't aim at.
const SEAT_FILL = 0.58;

// Counter-scale for anything carrying GLYPHS. Dividing a font-size by a zoom of
// 15 asks the browser to lay 0.6px type out and then blows the result up, which
// it renders as a white smear — so the type keeps a real size and the element
// around it is scaled down instead.
function counterScale(scale, extra = "") {
  if (scale <= 1.001) return extra ? { transform: extra } : undefined;
  return { transform: `${extra} scale(${1 / scale})`.trim() };
}

// The price bands. Rendered only when the caller supplies a legend — the box
// office colours by availability instead and passes none.
function PriceLegend({ legend, format, className }) {
  if (!legend?.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
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
  // Fill the parent's height instead of taking the shape of `aspect`. The
  // checkout dialog hands the map a flex row to fill; the box office card
  // doesn't. The geometry keeps `aspect` either way — MapCanvas letterboxes it.
  fill = false,
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
  className,
}) {
  const canvasRef = useRef(null);
  // Live zoom level. The layer transform magnifies everything inside it, so
  // borders and glyphs are divided by the scale to hold a constant ON-SCREEN
  // size while the venue geometry around them grows.
  const [scale, setScale] = useState(1);

  const ar = aspectRatio(aspect);

  const active = useMemo(
    () => sections.find((s) => s.id === activeSectionId) || null,
    [sections, activeSectionId],
  );

  const activeSeats = useMemo(
    () => (active ? seats.filter((s) => s.sectionId === active.id) : []),
    [seats, active],
  );

  // The drilled-in block's chairs on a square pitch, plus the footprint they
  // actually occupy — which is what the highlight hugs and the viewport frames.
  const grid = useMemo(
    () => (active ? sectionSeatGrid(activeSeats, active, aspect) : null),
    [active, activeSeats, aspect],
  );

  // Glide the viewport into the chosen block — padding keeps the neighbours in
  // frame — and back out to the whole venue on the way home.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!active) {
      canvas.fit();
      return;
    }
    canvas.zoomToRect(
      grid?.bounds || {
        x: active.x,
        y: active.y,
        width: active.width,
        height: active.height,
      },
    );
  }, [active, grid]);

  const zoomed = Boolean(active);
  // A chair, in percent on each axis. Sizing in percent rather than in
  // counter-scaled pixels is what keeps the grid true: a pixel box divided by a
  // zoom of 12 lands sub-pixel, and every chair then rounds to a different
  // device pixel, which is exactly what turned the block into a scatter.
  const seatSize = grid?.pitch ? grid.pitch * SEAT_FILL : 0;

  return (
    <div className={cn("flex flex-col", fill && "h-full", className)}>
      <MapCanvas
        ref={canvasRef}
        aspect={aspect}
        fill={fill}
        className={fill ? "min-h-0 flex-1" : undefined}
        background={background}
        onScaleChange={setScale}
        overlay={
          <>
            {sections.length === 0 && !active ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-text-secondary">This map has no sections yet.</p>
              </div>
            ) : null}

            {/* The way back out, over the map rather than above it — a control
                row of its own costs height the map wants. */}
            {active ? (
              <button
                type="button"
                onClick={() => onSectionChange(null)}
                className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background/85 px-2 py-1 text-xs font-medium text-text-secondary backdrop-blur transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Whole venue
              </button>
            ) : null}

            {active && activeSeats.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
                <p className="rounded-md border border-border bg-background/85 px-3 py-1.5 text-center text-sm text-text-secondary backdrop-blur">
                  {active.kind === "ga"
                    ? "This is a standing area — no individual seats to pick."
                    : "This section has no seats yet."}
                </p>
              </div>
            ) : null}

            {/* Where this section sits in the venue. Zoomed into one block, a
                buyer loses all sense of place without it. */}
            {active && sections.length ? (
              <div className="pointer-events-none absolute right-2 top-2 w-24 rounded-md border border-border bg-background/85 p-1.5 backdrop-blur">
                <VenueThumb
                  sections={sections}
                  field={field}
                  aspect={aspect}
                  highlightId={active.id}
                  className="w-full"
                />
              </div>
            ) : null}

            {legend?.length ? (
              <PriceLegend
                legend={legend}
                format={formatPrice}
                className="pointer-events-none absolute bottom-2 left-2 max-w-[60%] rounded-md border border-border bg-background/85 px-2 py-1.5 backdrop-blur"
              />
            ) : null}
          </>
        }
      >
        <MapField field={field} scale={scale} />

        {sections.map((section) => {
          const meta = sectionMeta?.(section) || {};
          const isActive = active?.id === section.id;
          const disabled = disabledSectionIds?.has(section.id);
          const soldOut = meta.available === 0;
          const band = colorBySectionId?.[section.id];

          const geometry = {
            left: `${section.x}%`,
            top: `${section.y}%`,
            width: `${section.width}%`,
            height: `${section.height}%`,
            transform: section.rotation ? `rotate(${section.rotation}deg)` : undefined,
          };
          // Zoomed in, the layer transform blows every stroke up with the
          // geometry — counter-scale the strokes back to a constant size. Glyphs
          // are handled separately, by scaling the element rather than the type.
          const chrome = zoomed
            ? { borderWidth: `${1 / scale}px`, borderRadius: `${6 / scale}px` }
            : undefined;

          if (isActive) {
            // The drilled-in block: highlighted and inert — its chairs sit on
            // top of it and take the clicks. Drawn around the chairs' own
            // footprint AND turned the way they are, so the highlight is the
            // same tilted rectangle the buyer can see inside it.
            //
            // No price-band fill and no ring here: inside the block it is the
            // CHAIRS that have to read, and a `ring` is a box-shadow the layer
            // transform scales into a 45px halo at this zoom.
            const hug = grid?.frame;
            const rotated = hug?.rotation
              ? `rotate(${hug.rotation}deg)`
              : geometry.transform;
            return (
              <div
                key={section.id}
                className={cn(
                  "pointer-events-none absolute z-10 flex flex-col items-center justify-center overflow-hidden border-primary",
                  activeSeats.length
                    ? "bg-background/60"
                    : band
                      ? band.fill
                      : section.kind === "ga"
                        ? "bg-amber-400/10"
                        : "bg-sky-400/10",
                )}
                style={{
                  ...(hug
                    ? {
                        left: `${hug.x}%`,
                        top: `${hug.y}%`,
                        width: `${hug.width}%`,
                        height: `${hug.height}%`,
                      }
                    : geometry),
                  transform: rotated,
                  ...chrome,
                  borderWidth: `${2 / scale}px`,
                }}
              >
                {/* Named only while the chairs aren't there to name themselves. */}
                {activeSeats.length === 0 ? (
                  <span
                    className="truncate px-1 text-[11px] font-semibold leading-tight text-foreground"
                    style={counterScale(scale)}
                  >
                    {section.name}
                  </span>
                ) : null}
              </div>
            );
          }

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
                "absolute flex flex-col items-center justify-center overflow-hidden border p-0.5 text-center transition-colors hover:brightness-125",
                band
                  ? [band.fill, band.stroke]
                  : section.kind === "ga"
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-sky-400/30 bg-sky-400/10",
                (disabled || soldOut) && "cursor-not-allowed opacity-40 hover:brightness-100",
                // Zoomed into a neighbour, the rest of the bowl is context —
                // keep it legible but stop it competing with the chairs.
                zoomed && "opacity-45",
              )}
              style={{ ...geometry, ...chrome }}
            >
              <span
                className="flex max-w-full flex-col items-center"
                style={counterScale(scale)}
              >
                <span className="truncate text-[10px] font-medium leading-tight text-foreground">
                  {section.name}
                </span>
                <span className="truncate text-[9px] leading-tight tabular-nums text-text-tertiary">
                  {soldOut ? "Sold out" : `${meta.available ?? 0} open`}
                </span>
              </span>
            </button>
          );
        })}

        {grid ? (
          <>
            {grid.rows.map((row) => (
              <span
                key={`row-${row.label}`}
                className="pointer-events-none absolute z-20 whitespace-nowrap text-[9px] font-medium leading-none tabular-nums text-text-tertiary"
                style={{
                  left: `${row.x}%`,
                  top: `${row.y}%`,
                  ...counterScale(scale, "translate(-50%, -50%)"),
                }}
              >
                {row.label}
              </span>
            ))}

            {grid.seats.map((seat) => {
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
                    "absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-colors",
                    SEAT_STATE_STYLE[state] || SEAT_STATE_STYLE.available,
                  )}
                  style={{
                    left: `${seat.gx}%`,
                    top: `${seat.gy}%`,
                    // Percent on both axes, divided by the aspect on x, is a
                    // true square that magnifies with the venue around it.
                    width: `${seatSize / ar}%`,
                    height: `${seatSize}%`,
                    borderRadius: "26%",
                  }}
                />
              );
            })}
          </>
        ) : null}
      </MapCanvas>
    </div>
  );
}

export default SeatMapView;
