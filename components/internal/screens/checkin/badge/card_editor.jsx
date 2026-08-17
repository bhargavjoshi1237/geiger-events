"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";

import { passSvg } from "@/lib/passes/render";
import { stockSize } from "@/lib/passes/stock";
import { newElement, sideLayout } from "@/lib/passes/layout";
import { cn } from "@/lib/utils";

// Direct manipulation over the rendered pass. The SVG underneath is exactly what
// prints; this layer adds a hit box per element for select / drag / resize, and
// a draw mode that creates a new element from a dragged rectangle.
//
// Everything is stored in millimetres. `scale` is px-per-mm for the on-screen
// card, and `zoom` is React Flow's canvas zoom — pointer deltas divide by both.

const HANDLES = [
  ["nw", "-left-1 -top-1 cursor-nwse-resize"],
  ["ne", "-right-1 -top-1 cursor-nesw-resize"],
  ["sw", "-left-1 -bottom-1 cursor-nesw-resize"],
  ["se", "-right-1 -bottom-1 cursor-nwse-resize"],
];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Text has no height of its own — its y is the baseline — so its hit box is
// derived from the font size and box width.
function boxOf(el) {
  if (el.kind === "text") {
    const size = Number(el.size) || 4;
    return { x: Number(el.x), y: Number(el.y) - size, w: Number(el.w) || 20, h: size * 1.35 };
  }
  if (el.kind === "qr") {
    const size = Number(el.size) || 18;
    return { x: Number(el.x), y: Number(el.y), w: size, h: size };
  }
  return { x: Number(el.x), y: Number(el.y), w: Number(el.w) || 10, h: Number(el.h) || 10 };
}

// Apply a moved/resized box back onto the element's own shape.
function applyBox(el, box) {
  if (el.kind === "text") {
    const size = Number(el.size) || 4;
    return { ...el, x: box.x, y: box.y + size, w: Math.max(4, box.w) };
  }
  if (el.kind === "qr") {
    return { ...el, x: box.x, y: box.y, size: Math.max(6, Math.min(box.w, box.h)) };
  }
  return { ...el, x: box.x, y: box.y, w: Math.max(2, box.w), h: Math.max(2, box.h) };
}

export function CardEditor({
  template,
  event,
  attendee,
  qrSettings,
  side = "front",
  selectedId,
  onSelect,
  onChange,
  tool = "select",
  onToolDone,
  scale = 4,
  getZoom,
  snap = true,
  snapMm = 2,
}) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [dragging, setDragging] = useState(false);

  // Millimetres rounded to the snap grid. Off, or with a nonsense step, values
  // pass through untouched so dragging stays continuous.
  const grid = (mm) => {
    const step = Number(snapMm) || 0;
    if (!snap || step <= 0) return mm;
    return Math.round(mm / step) * step;
  };

  const { wMm, hMm } = stockSize(template?.stock);
  const elements = useMemo(() => sideLayout(template, side).elements || [], [template, side]);

  const svg = useMemo(
    () =>
      passSvg(
        template || {},
        { event: event || {}, attendee: attendee || {}, qrSettings: qrSettings || {} },
        { preview: true, side },
      ),
    [template, event, attendee, qrSettings, side],
  );

  const px = (mm) => mm * scale;
  const toMm = (dPx) => dPx / (scale * (getZoom?.() || 1));

  const patchElement = useCallback(
    (id, patch) =>
      onChange({
        elements: elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      }),
    [elements, onChange],
  );

  // --- move / resize ---------------------------------------------------------
  const startDrag = (el, mode) => (event_) => {
    event_.stopPropagation();
    event_.preventDefault();
    onSelect?.(el.id);
    dragRef.current = {
      id: el.id,
      mode,
      startX: event_.clientX,
      startY: event_.clientY,
      box: boxOf(el),
      el,
    };
    setDragging(true);
    event_.currentTarget.setPointerCapture?.(event_.pointerId);
  };

  const onPointerMove = (event_) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = toMm(event_.clientX - drag.startX);
      const dy = toMm(event_.clientY - drag.startY);
      const b = drag.box;
      let next;
      if (drag.mode === "move") {
        next = {
          x: clamp(grid(b.x + dx), -b.w / 2, wMm - b.w / 2),
          y: clamp(grid(b.y + dy), -b.h / 2, hMm - b.h / 2),
          w: b.w,
          h: b.h,
        };
      } else {
        const left = drag.mode.includes("w");
        const top = drag.mode.includes("n");
        const x = left ? grid(b.x + dx) : b.x;
        const y = top ? grid(b.y + dy) : b.y;
        next = {
          x,
          y,
          w: Math.max(2, left ? b.w + (b.x - x) : grid(b.w + dx)),
          h: Math.max(2, top ? b.h + (b.y - y) : grid(b.h + dy)),
        };
      }
      patchElement(drag.id, applyBox(drag.el, next));
      return;
    }

    if (draft) {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const zoom = getZoom?.() || 1;
      setDraft((d) => ({
        ...d,
        x2: (event_.clientX - rect.left) / (scale * zoom),
        y2: (event_.clientY - rect.top) / (scale * zoom),
      }));
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
    if (!draft) return;
    const x = grid(Math.min(draft.x1, draft.x2));
    const y = grid(Math.min(draft.y1, draft.y2));
    const w = grid(Math.abs(draft.x2 - draft.x1));
    const h = grid(Math.abs(draft.y2 - draft.y1));
    setDraft(null);
    // A click rather than a drag gets a sensible default size instead of nothing.
    const box = w < 3 || h < 3 ? { x, y, w: tool === "text" ? 30 : 20, h: 10 } : { x, y, w, h };
    let created;
    if (tool === "text") {
      created = newElement("text", { x: box.x, y: box.y + 4, w: box.w, size: 4 });
    } else if (tool === "image") {
      created = newElement("image", { ...box, name: "Image" });
    } else {
      created = newElement("box", { ...box, name: "Section" });
    }
    onChange({ elements: [...elements, created] });
    onSelect?.(created.id);
    onToolDone?.();
  };

  // --- draw mode -------------------------------------------------------------
  const onPointerDown = (event_) => {
    if (tool === "select") {
      onSelect?.(null);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = getZoom?.() || 1;
    const x = (event_.clientX - rect.left) / (scale * zoom);
    const y = (event_.clientY - rect.top) / (scale * zoom);
    setDraft({ x1: x, y1: y, x2: x, y2: y });
    event_.currentTarget.setPointerCapture?.(event_.pointerId);
  };

  return (
    <div
      ref={rootRef}
      // nodrag/nopan keep React Flow from panning while an element is dragged.
      className={cn(
        "nodrag nopan relative select-none",
        tool === "select" ? "cursor-default" : "cursor-crosshair",
      )}
      style={{ width: px(wMm), height: px(hMm) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden shadow-2xl [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Snap grid. Always faintly present while snapping is on so the spacing
          is legible, and it comes forward during a drag. */}
      {snap && Number(snapMm) > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-150",
            dragging || draft ? "opacity-70" : "opacity-25",
          )}
          style={{
            backgroundImage: "radial-gradient(var(--primary) 0.75px, transparent 0.75px)",
            backgroundSize: `${px(Number(snapMm))}px ${px(Number(snapMm))}px`,
            backgroundPosition: "0 0",
          }}
        />
      ) : null}

      {elements.map((el) => {
        if (el.hidden) return null;
        const b = boxOf(el);
        const active = el.id === selectedId;
        return (
          <div
            key={el.id}
            onPointerDown={tool === "select" ? startDrag(el, "move") : undefined}
            className={cn(
              "absolute",
              tool === "select" && "cursor-move",
              active
                ? "outline outline-2 outline-offset-[1px] outline-primary"
                : "hover:outline hover:outline-1 hover:outline-offset-[1px] hover:outline-primary/50",
              tool !== "select" && "pointer-events-none",
            )}
            style={{
              left: px(b.x),
              top: px(b.y),
              width: px(b.w),
              height: px(b.h),
            }}
          >
            {active && tool === "select"
              ? HANDLES.map(([mode, cls]) => (
                  <span
                    key={mode}
                    onPointerDown={startDrag(el, mode)}
                    className={cn(
                      "absolute h-2 w-2 rounded-[2px] border border-background bg-primary",
                      cls,
                    )}
                  />
                ))
              : null}
          </div>
        );
      })}

      {draft ? (
        <div
          className="pointer-events-none absolute border border-dashed border-primary bg-primary/10"
          style={{
            left: px(Math.min(draft.x1, draft.x2)),
            top: px(Math.min(draft.y1, draft.y2)),
            width: px(Math.abs(draft.x2 - draft.x1)),
            height: px(Math.abs(draft.y2 - draft.y1)),
          }}
        />
      ) : null}
    </div>
  );
}

export default CardEditor;
