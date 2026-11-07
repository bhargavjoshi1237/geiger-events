"use client";

import React, { useRef, useState } from "react";
import { Grid3x3, Hand, Magnet, MousePointer2, Redo2, Undo2 } from "lucide-react";

import { Button } from "@geiger/ui";
import { cn } from "@/lib/utils";
import {
  aabbCenter,
  aabbFromPoints,
  gridStepFor,
  instanceAabb,
  localToWorld,
  normaliseRotation,
  objectsInBox,
  radToDeg,
  roomAabb,
  rotatePoint,
  selectionAabb,
  snapAngle,
  snapBox,
} from "@/lib/event_design";
import { PlanRenderer } from "../plan_renderer";

// The editable canvas: drag-move with edge/grid snapping, rotate handle (15° steps, Alt = free), marquee + shift selection, library drops.

export const DRAG_MIME = "application/x-geiger-design-object";
const DRAG_THRESHOLD_PX = 3;
const SNAP_PX = 8;
const HANDLE_PX = 28;

// Window-level move/up listeners for one gesture.
function listen(onMove, onUp) {
  const move = (e) => onMove(e);
  const up = (e) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onUp(e);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function ToolButton({ active, label, onClick, disabled, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 text-muted-foreground hover:bg-surface-active hover:text-foreground",
        active && "bg-surface-active text-foreground",
      )}
    >
      {children}
    </Button>
  );
}

export function EditorCanvas({
  doc,
  selectedIds,
  flaggedIds,
  onSelect,
  history,
  tool,
  onToolChange,
  panning,
  snapOn,
  onSnapChange,
  gridOn,
  onGridChange,
  onDropObject,
  rendererRef,
  extensionOverlay,
  extensionHud,
}) {
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [dropping, setDropping] = useState(false);
  const gestureRef = useRef(null);
  const gridM = gridStepFor(doc.unit);

  const onObjectPointerDown = (e, instance) => {
    e.preventDefault();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const wasSelected = selectedIds.includes(instance.id);
    let selection = selectedIds;
    if (additive) {
      selection = wasSelected ? selectedIds.filter((id) => id !== instance.id) : [...selectedIds, instance.id];
      onSelect(selection);
      if (wasSelected) return;
    } else if (!wasSelected) {
      selection = [instance.id];
      onSelect(selection);
    }

    const renderer = rendererRef.current;
    const moving = doc.objects.filter((o) => selection.includes(o.id) && !o.locked);
    if (!renderer || !moving.length) return;
    const origins = new Map(moving.map((o) => [o.id, [o.x_m, o.y_m]]));
    const box = selectionAabb(moving, [...origins.keys()]);
    const targets = [roomAabb(doc), ...doc.objects.filter((o) => !origins.has(o.id)).map((o) => instanceAabb(o))];
    const start = renderer.toWorld(e.clientX, e.clientY);
    const threshold = SNAP_PX / (renderer.getPxPerMetre() || 1);
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const useSnap = snapOn;
    const grid = gridOn ? gridM : 0;
    gestureRef.current = { started: false, x: e.clientX, y: e.clientY };

    listen(
      (ev) => {
        const g = gestureRef.current;
        if (!g) return;
        if (!g.started) {
          if (Math.hypot(ev.clientX - g.x, ev.clientY - g.y) < DRAG_THRESHOLD_PX) return;
          g.started = true;
          history.begin();
        }
        const [wx, wy] = renderer.toWorld(ev.clientX, ev.clientY);
        let dx = wx - start[0];
        let dy = wy - start[1];
        if (useSnap && !ev.altKey) {
          const moved = { minX: box.minX + dx, maxX: box.maxX + dx, minY: box.minY + dy, maxY: box.maxY + dy };
          const snap = snapBox(moved, { targets, threshold, grid });
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides);
        } else {
          setGuides([]);
        }
        history.preview((cur) => ({
          ...cur,
          objects: cur.objects.map((o) =>
            origins.has(o.id) ? { ...o, x_m: origins.get(o.id)[0] + dx, y_m: origins.get(o.id)[1] + dy } : o,
          ),
        }));
      },
      () => {
        const g = gestureRef.current;
        gestureRef.current = null;
        setGuides([]);
        if (g?.started) history.commit();
        else if (!additive && wasSelected && selectedIds.length > 1) onSelect([instance.id]);
      },
    );
  };

  const startRotate = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const renderer = rendererRef.current;
    const moving = doc.objects.filter((o) => selectedIds.includes(o.id) && !o.locked);
    if (!renderer || !moving.length) return;
    const single = moving.length === 1 ? moving[0] : null;
    const centre = single ? [single.x_m, single.y_m] : aabbCenter(selectionAabb(moving, moving.map((o) => o.id)));
    const origins = new Map(moving.map((o) => [o.id, o]));
    const [px0, py0] = renderer.toWorld(e.clientX, e.clientY);
    const a0 = Math.atan2(py0 - centre[1], px0 - centre[0]);
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    history.begin();

    listen(
      (ev) => {
        const [px, py] = renderer.toWorld(ev.clientX, ev.clientY);
        const raw = radToDeg(Math.atan2(py - centre[1], px - centre[0]) - a0);
        let delta;
        if (single) {
          const target = ev.altKey ? Math.round(single.rotation + raw) : snapAngle(single.rotation + raw, 15);
          delta = target - single.rotation;
        } else {
          delta = ev.altKey ? Math.round(raw) : Math.round(raw / 15) * 15;
        }
        history.preview((cur) => ({
          ...cur,
          objects: cur.objects.map((o) => {
            const orig = origins.get(o.id);
            if (!orig) return o;
            const [x, y] = rotatePoint([orig.x_m, orig.y_m], delta, centre);
            return { ...o, x_m: x, y_m: y, rotation: normaliseRotation(orig.rotation + delta) };
          }),
        }));
      },
      () => history.commit(),
    );
  };

  const onBackgroundPointerDown = (e, point) => {
    e.preventDefault();
    const renderer = rendererRef.current;
    if (!renderer) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = additive ? selectedIds : [];
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    e.currentTarget?.setPointerCapture?.(e.pointerId);

    listen(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD_PX) return;
        moved = true;
        setMarquee({ a: point, b: renderer.toWorld(ev.clientX, ev.clientY) });
      },
      (ev) => {
        setMarquee(null);
        if (!moved) {
          if (!additive) onSelect([]);
          return;
        }
        const hit = objectsInBox(doc.objects, aabbFromPoints(point, renderer.toWorld(ev.clientX, ev.clientY)));
        onSelect(additive ? [...new Set([...base, ...hit])] : hit);
      },
    );
  };

  const selected = doc.objects.filter((o) => selectedIds.includes(o.id));
  const canRotate = selected.some((o) => !o.locked);

  const overlay = (ctx) => {
    const px = ctx.pxPerMetre || 1;
    const room = roomAabb(doc);
    let handle = null;
    if (canRotate && !marquee) {
      const single = selected.length === 1 ? selected[0] : null;
      const groupBox = single ? null : selectionAabb(selected, selectedIds);
      const offset = HANDLE_PX / px;
      const [ax, ay] = single
        ? localToWorld([0, -single.depth_m / 2], { x: single.x_m, y: single.y_m, rotation: single.rotation })
        : [(groupBox.minX + groupBox.maxX) / 2, groupBox.minY];
      const [hx, hy] = single
        ? localToWorld([0, -single.depth_m / 2 - offset], { x: single.x_m, y: single.y_m, rotation: single.rotation })
        : [ax, ay - offset];
      handle = (
        <g>
          {groupBox ? (
            <rect
              x={groupBox.minX}
              y={groupBox.minY}
              width={groupBox.maxX - groupBox.minX}
              height={groupBox.maxY - groupBox.minY}
              className="pointer-events-none fill-none stroke-primary/70"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <line x1={ax} y1={ay} x2={hx} y2={hy} className="pointer-events-none stroke-primary" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle
            cx={hx}
            cy={hy}
            r={6 / px}
            role="presentation"
            onPointerDown={startRotate}
            className="cursor-grab fill-background stroke-primary"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }
    return (
      <>
        {guides.map((g, i) =>
          g.axis === "x" ? (
            <line key={i} x1={g.at} y1={room.minY - 1} x2={g.at} y2={room.maxY + 1} className="pointer-events-none stroke-sky-500" strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          ) : (
            <line key={i} x1={room.minX - 1} y1={g.at} x2={room.maxX + 1} y2={g.at} className="pointer-events-none stroke-sky-500" strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          ),
        )}
        {handle}
        {extensionOverlay ? extensionOverlay(ctx) : null}
        {marquee ? (
          <rect
            x={Math.min(marquee.a[0], marquee.b[0])}
            y={Math.min(marquee.a[1], marquee.b[1])}
            width={Math.abs(marquee.b[0] - marquee.a[0])}
            height={Math.abs(marquee.b[1] - marquee.a[1])}
            className="pointer-events-none fill-primary/5 stroke-primary/70"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </>
    );
  };

  const hud = (ctx) => (
    <>
      {doc.objects.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-4">
          <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-2 text-xs text-text-secondary backdrop-blur">
            Drag objects in from the library, or click one to drop it in the room.
          </p>
        </div>
      ) : null}
      {extensionHud ? extensionHud(ctx) : null}
    </>
  );

  return (
    <div
      className={cn("relative h-full min-h-0", dropping && "ring-2 ring-inset ring-primary/40")}
      onPointerDownCapture={() => {
        // Canvas gestures preventDefault, so release a focused inspector field by hand (keeps Delete/arrows on the canvas).
        const active = document.activeElement;
        if (active?.matches?.("input, textarea, select, [role='combobox']")) active.blur();
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropping) setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false);
        const objectId = e.dataTransfer.getData(DRAG_MIME);
        if (!objectId || !rendererRef.current) return;
        e.preventDefault();
        onDropObject(objectId, rendererRef.current.toWorld(e.clientX, e.clientY));
      }}
    >
      <PlanRenderer
        ref={rendererRef}
        plan={doc}
        interactive
        panMode={tool === "pan" || panning ? "always" : "drag"}
        selectedIds={selectedIds}
        flaggedIds={flaggedIds}
        showGrid={gridOn}
        gridM={gridM}
        overlay={overlay}
        hud={hud}
        onObjectPointerDown={onObjectPointerDown}
        onBackgroundPointerDown={onBackgroundPointerDown}
        className="[&_[data-instance-id]]:cursor-move"
        aria-label="Floor plan canvas"
      />

      <div className="absolute left-3 top-3 flex items-center gap-0.5 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur">
        <ToolButton active={tool === "select"} label="Select (V)" onClick={() => onToolChange("select")}>
          <MousePointer2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton active={tool === "pan"} label="Pan (H, or hold Space)" onClick={() => onToolChange("pan")}>
          <Hand className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton active={snapOn} label="Snap to edges" onClick={() => onSnapChange(!snapOn)}>
          <Magnet className="h-4 w-4" />
        </ToolButton>
        <ToolButton active={gridOn} label="Grid" onClick={() => onGridChange(!gridOn)}>
          <Grid3x3 className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton label="Undo (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>
    </div>
  );
}

export default EditorCanvas;
