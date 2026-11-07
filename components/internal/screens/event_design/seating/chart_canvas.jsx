"use client";

import React, { useRef, useState } from "react";

import { footprintPolygon, pointInPolygon } from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { PlanRenderer } from "../plan_renderer";
import { GUEST_DRAG_MIME } from "./guest_list";

// Centre zone: the plan read-only, every seat drawn as a dot (seated / VIP / empty) with initials and table fill counts.
// Click a seat or table to select it; drop a guest from the list onto a seat (or a table for its first free seat).

const NSS = "non-scaling-stroke";
const DOT_M = 0.19;
const CLICK_PX = 5;

export function ChartCanvas({ plan, blocks, index, occ, selection, hint, onSeat, onTable, onClear, onDropGuest }) {
  const rendererRef = useRef(null);
  const downRef = useRef(null);
  const [hover, setHover] = useState(null);

  // Nearest seat within reach of a plan point, else the seat-bearing object under it.
  const hitTest = (point) => {
    let best = null;
    let bestD = 0.45;
    for (const b of blocks) {
      for (const s of b.slots) {
        const d = Math.hypot(s.x - point[0], s.y - point[1]);
        if (d < bestD) {
          best = { block: b, slot: s };
          bestD = d;
        }
      }
    }
    if (best) return best;
    for (const o of plan.objects || []) {
      if (!(o.seats > 0)) continue;
      if (pointInPolygon(point, footprintPolygon(o, { withChairs: true }))) {
        const block = index.byItem.get(o.id);
        if (block) return { block, slot: null };
      }
    }
    return null;
  };

  const selectedSeat =
    selection?.type === "seat"
      ? selection.key
      : selection?.type === "guest" && selection.seatKey
        ? selection.seatKey
        : null;
  const selectedBlock = selection?.type === "table" ? index.byItem.get(selection.itemId) || null : null;

  const overlay = (ctx) => {
    const px = ctx.pxPerMetre || 0;
    const showText = px * DOT_M * 2 >= 15;
    const fontM = px > 0 ? 10 / px : 0;
    return (
      <g>
        {blocks.map((b) => {
          const filled = occ.byBlock.get(b.id)?.guests.length || 0;
          return (
            <g key={b.id}>
              {b.slots.map((s) => {
                const g = occ.bySlot.get(s.key) || null;
                const isSel = selectedSeat === s.key;
                const isHover = hover === s.key;
                return (
                  <g key={s.key} data-seat-key={s.key} className="cursor-pointer">
                    <title>{`${b.label} · Seat ${s.seatNo}${g ? ` — ${g.name}` : " — empty"}`}</title>
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={DOT_M}
                      className={cn(
                        g
                          ? g.vip
                            ? "fill-amber-500 stroke-amber-700 dark:stroke-amber-300"
                            : "fill-primary stroke-primary"
                          : "fill-background stroke-text-tertiary",
                      )}
                      strokeWidth={1}
                      vectorEffect={NSS}
                    />
                    {isSel || isHover ? (
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={DOT_M + 0.08}
                        className={isHover ? "fill-none stroke-primary" : "fill-none stroke-foreground"}
                        strokeWidth={2}
                        strokeDasharray={isHover ? "3 2" : undefined}
                        vectorEffect={NSS}
                      />
                    ) : null}
                    {g && showText ? (
                      <text
                        x={s.x}
                        y={s.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={DOT_M * 0.95}
                        className="pointer-events-none select-none fill-primary-foreground font-semibold"
                      >
                        {g.initials}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {b.kind === "table" && px > 8 ? (
                <text
                  x={b.center[0]}
                  y={b.center[1] + fontM * 1.3}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontM}
                  className={cn(
                    "pointer-events-none select-none tabular-nums",
                    filled > b.capacity ? "fill-red-600 dark:fill-red-400" : "fill-text-secondary",
                  )}
                >
                  {filled}/{b.capacity}
                </text>
              ) : null}
              {hover === b.id
                ? b.itemIds.map((id) => {
                    const o = ctx.objectById.get(id);
                    if (!o) return null;
                    return (
                      <polygon
                        key={id}
                        points={footprintPolygon(o, { withChairs: true }).map(([x, y]) => `${x},${y}`).join(" ")}
                        className="pointer-events-none fill-primary/10 stroke-primary"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        vectorEffect={NSS}
                      />
                    );
                  })
                : null}
            </g>
          );
        })}
      </g>
    );
  };

  const hud = () => (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-3 rounded-lg border border-border bg-surface-card/90 px-2.5 py-1.5 text-[11px] text-text-secondary backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Seated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> VIP
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-text-tertiary bg-background" /> Empty
        </span>
      </div>
      {hint ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-4">
          <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-2 text-xs text-text-secondary backdrop-blur">{hint}</p>
        </div>
      ) : null}
    </>
  );

  const resolveHover = (hit) => (hit ? (hit.slot ? hit.slot.key : hit.block.id) : null);

  return (
    <div
      className="relative h-full min-h-0"
      onPointerDownCapture={(e) => {
        if (e.button !== 0 || e.target.closest?.("button")) {
          downRef.current = null;
          return;
        }
        downRef.current = {
          x: e.clientX,
          y: e.clientY,
          seat: e.target.closest?.("[data-seat-key]")?.getAttribute("data-seat-key") || null,
          instance: e.target.closest?.("[data-instance-id]")?.getAttribute("data-instance-id") || null,
        };
      }}
      onPointerUpCapture={(e) => {
        const down = downRef.current;
        downRef.current = null;
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_PX) return;
        const seatHit = down.seat ? index.bySlot.get(down.seat) : null;
        if (seatHit) return onSeat(seatHit.slot, seatHit.block);
        const block = down.instance ? index.byItem.get(down.instance) : null;
        if (block) return onTable(block);
        return onClear();
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(GUEST_DRAG_MIME) || !rendererRef.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const next = resolveHover(hitTest(rendererRef.current.toWorld(e.clientX, e.clientY)));
        if (next !== hover) setHover(next);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(null);
      }}
      onDrop={(e) => {
        setHover(null);
        const key = e.dataTransfer.getData(GUEST_DRAG_MIME);
        if (!key || !rendererRef.current) return;
        e.preventDefault();
        onDropGuest(key, hitTest(rendererRef.current.toWorld(e.clientX, e.clientY)));
      }}
    >
      <PlanRenderer
        ref={rendererRef}
        plan={plan}
        interactive
        panMode="drag"
        showGrid={false}
        selectedIds={selectedBlock ? selectedBlock.itemIds : []}
        overlay={overlay}
        hud={hud}
        className="[&_[data-instance-id]]:cursor-pointer"
        aria-label="Seating chart"
      />
    </div>
  );
}

export default ChartCanvas;
