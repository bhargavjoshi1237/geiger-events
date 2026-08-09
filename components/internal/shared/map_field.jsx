"use client";

import React from "react";

import { cn } from "@/lib/utils";

// The thing a bowl is built around: the pitch, court, rink, ring, runway or
// stage in the middle of the map. Purely decorative — it is never selectable and
// never sells anything, it just makes a ring of coloured blocks read as a venue.
//
// Geometry is percent-of-canvas, the same space sections and booths use, and
// lives in seat_maps.config.field / hall_maps.config.field.

export const FIELD_SHAPES = [
  { value: "stage", label: "Stage", hint: "A raised end stage — concerts and theatre." },
  { value: "pitch", label: "Pitch", hint: "Football, rugby, cricket." },
  { value: "court", label: "Court", hint: "Basketball, tennis, netball." },
  { value: "rink", label: "Rink", hint: "Ice hockey, curling." },
  { value: "ring", label: "Ring", hint: "Boxing, wrestling, in-the-round." },
  { value: "runway", label: "Runway", hint: "Catwalk and fashion shows." },
  { value: "floor", label: "Open floor", hint: "Exhibition or dance floor." },
  { value: "none", label: "None", hint: "No central feature." },
];

// Shape -> surface tint. Tailwind colour utilities at low opacity, matching how
// the rest of the app tints non-semantic surfaces.
const SHAPE_STYLE = {
  stage: "border-border-strong bg-surface-strong",
  pitch: "border-emerald-400/30 bg-emerald-400/10",
  court: "border-amber-400/30 bg-amber-400/10",
  rink: "border-sky-400/30 bg-sky-400/10",
  ring: "border-rose-400/30 bg-rose-400/10",
  runway: "border-violet-400/30 bg-violet-400/10",
  floor: "border-border bg-surface-strong/60",
};

const MARKING = "pointer-events-none absolute border-current opacity-30";

// Sport markings, drawn from the shape rather than stored, so a map never has
// to carry pitch furniture in its config.
function Markings({ shape }) {
  if (shape === "pitch" || shape === "court" || shape === "rink") {
    return (
      <>
        <span className={cn(MARKING, "left-1/2 top-0 h-full border-l")} />
        <span
          className={cn(MARKING, "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border")}
          style={{ width: "24%", aspectRatio: "1" }}
        />
      </>
    );
  }
  if (shape === "ring") {
    return (
      <span
        className={cn(MARKING, "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border")}
        style={{ width: "70%", aspectRatio: "1" }}
      />
    );
  }
  return null;
}

export function MapField({ field, className }) {
  if (!field || field.shape === "none") return null;

  const shape = field.shape || "stage";
  const label = field.label || shape.toUpperCase();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute flex items-center justify-center border text-center",
        shape === "rink" ? "rounded-[40%]" : "rounded-lg",
        SHAPE_STYLE[shape] || SHAPE_STYLE.stage,
        className,
      )}
      style={{
        left: `${Number(field.x) || 0}%`,
        top: `${Number(field.y) || 0}%`,
        width: `${Number(field.width) || 0}%`,
        height: `${Number(field.height) || 0}%`,
        transform: field.rotation ? `rotate(${field.rotation}deg)` : undefined,
      }}
    >
      <Markings shape={shape} />
      <span className="relative px-2 text-[10px] font-medium uppercase tracking-widest text-text-secondary">
        {label}
      </span>
    </div>
  );
}

export default MapField;
