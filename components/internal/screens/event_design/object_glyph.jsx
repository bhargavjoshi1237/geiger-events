"use client";

import React, { useMemo } from "react";

import {
  CHAIR_DEPTH_M,
  CHAIR_WIDTH_M,
  chairLocalPositions,
  createInstance,
  drawsChairs,
  localExtents,
} from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { CATEGORY_TONE } from "./plan_renderer";

// Tiny fixed-size SVG of one catalog object (shape + chairs) for library lists, where a full renderer per row is overkill.
export function ObjectGlyph({ object, size = 36, className }) {
  const instance = useMemo(() => createInstance(object, { id: "glyph" }), [object]);
  const ext = localExtents(instance, { withChairs: true });
  const span = Math.max(ext.maxX - ext.minX, ext.maxY - ext.minY) * 1.12 || 1;
  const chairs = drawsChairs(instance) ? chairLocalPositions(instance) : [];
  const w = instance.width_m;
  const d = instance.depth_m;
  const tone = CATEGORY_TONE[instance.category] || CATEGORY_TONE.decor;
  const cx = (ext.minX + ext.maxX) / 2;
  const cy = (ext.minY + ext.maxY) / 2;

  return (
    <svg
      viewBox={`${cx - span / 2} ${cy - span / 2} ${span} ${span}`}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {chairs.map((c) => (
        <rect
          key={c.index}
          x={-CHAIR_WIDTH_M / 2}
          y={-CHAIR_DEPTH_M / 2}
          width={CHAIR_WIDTH_M}
          height={CHAIR_DEPTH_M}
          rx={0.08}
          transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}
          className="fill-surface-strong stroke-text-tertiary"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {instance.shape === "round" || instance.shape === "oval" ? (
        <ellipse rx={w / 2} ry={d / 2} className={tone} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ) : instance.shape === "custom" && instance.points ? (
        <polygon
          points={instance.points.map(([x, y]) => `${x * w},${y * d}`).join(" ")}
          className={tone}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(0.05, w / 8, d / 8)} className={tone} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

export default ObjectGlyph;
