"use client";

import React from "react";

import { MapCanvas } from "@/components/internal/shared/map_canvas";
import { MapField } from "@/components/internal/shared/map_field";
import { cn } from "@/lib/utils";

export const BOOTH_STATE_STYLE = {
  available: "border-border-strong bg-surface-strong hover:border-primary hover:bg-surface-active",
  selected: "border-primary bg-primary/25",
  sold: "border-border bg-surface-subtle cursor-not-allowed",
  held: "border-amber-400/40 bg-amber-400/15 cursor-not-allowed",
  blocked: "border-violet-400/40 bg-violet-400/15",
};

const DECOR_STYLE = {
  zone: "border-dashed border-border-strong bg-transparent",
  feature: "border-border bg-surface-subtle/60",
};

export function HallMapView({
  booths = [],
  field,
  background,
  aspect = "4/3",
  boothState,
  onBoothClick,
  boothMeta,
  boothLabel,
  colorByBoothId,
  legend,
  formatPrice,
  emptyMessage = "This hall has no booths yet.",
}) {
  return (
    <div className="space-y-3">
      <MapCanvas
        aspect={aspect}
        background={background}
        overlay={
          booths.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-text-secondary">{emptyMessage}</p>
            </div>
          ) : null
        }
      >
        <MapField field={field} />

        {booths.map((booth) => {
          const decor = booth.kind !== "booth";
          const state = decor ? "decor" : boothState?.(booth) || "available";
          const meta = boothMeta?.(booth) || {};
          const band = colorByBoothId?.[booth.id];
          const interactive = !decor && (state === "available" || state === "selected" || state === "blocked");

          const style = {
            left: `${booth.x}%`,
            top: `${booth.y}%`,
            width: `${booth.width}%`,
            height: `${booth.height}%`,
            transform: booth.rotation ? `rotate(${booth.rotation}deg)` : undefined,
          };

          if (decor) {
            return (
              <div
                key={booth.id}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute flex items-center justify-center rounded-md border text-center",
                  DECOR_STYLE[booth.kind] || DECOR_STYLE.feature,
                )}
                style={style}
              >
                <span className="truncate px-1 text-[9px] font-medium uppercase tracking-wider text-text-tertiary">
                  {booth.name || booth.code}
                </span>
              </div>
            );
          }

          return (
            <button
              key={booth.id}
              type="button"
              disabled={!interactive}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => interactive && onBoothClick?.(booth)}
              aria-label={
                boothLabel
                  ? boothLabel(booth, state)
                  : `Booth ${booth.code || booth.name}, ${state}`
              }
              title={[booth.code || booth.name, meta.price].filter(Boolean).join(" · ")}
              className={cn(
                "absolute flex flex-col items-center justify-center overflow-hidden rounded-md border p-0.5 text-center transition-colors",
                state === "available" && band ? [band.fill, band.stroke, "hover:brightness-125"] : null,
                state !== "available" || !band ? BOOTH_STATE_STYLE[state] : null,
                !interactive && "opacity-70",
              )}
              style={style}
            >
              <span className="truncate text-[9px] font-medium leading-tight text-foreground">
                {booth.code || booth.name}
              </span>
              {meta.price ? (
                <span className="truncate text-[8px] leading-tight tabular-nums text-text-tertiary">
                  {meta.price}
                </span>
              ) : null}
            </button>
          );
        })}
      </MapCanvas>

      {legend?.length ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((band) => (
            <li
              key={band.key}
              className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
            >
              <span className={cn("h-2 w-2 rounded-full", band.dot)} />
              <span className="tabular-nums">
                {formatPrice ? formatPrice(band.price) : band.price}
              </span>
              {band.label ? <span className="text-text-tertiary">{band.label}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default HallMapView;
