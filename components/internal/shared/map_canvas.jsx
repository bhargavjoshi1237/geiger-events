"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@geiger/ui";
import { cn } from "@/lib/utils";

// The pan/zoom surface every map in the app draws on: seat map editor, seat map
// viewer, hall map editor, booth picker. It owns a viewport transform and an
// optional traced-over background image, and nothing else — no data, no
// persistence, no knowledge of seats or booths.
//
// Children are positioned in PERCENT of the canvas (left/top/width/height), the
// same coordinate space every geometry table in `events` stores. Callers that
// need to convert a pointer position back into that space call `toPercent()` on
// the ref rather than reading getBoundingClientRect() themselves, which would
// ignore the transform and place things wrong the moment anyone zoomed.

const MIN_SCALE = 1;
const MAX_SCALE = 12;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const IDENTITY = { scale: 1, tx: 0, ty: 0 };

export const MapCanvas = forwardRef(function MapCanvas(
  {
    children,
    aspect = "16/10",
    background = null,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
    // The editor turns panning off while a section is being dragged, so the
    // floor doesn't slide out from under the block.
    panDisabled = false,
    zoomDisabled = false,
    onCanvasPointerDown,
    overlay = null,
    controls = true,
    className,
    layerClassName,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const [view, setView] = useState(IDENTITY);
  // Live pointers, so two fingers become a pinch rather than two pans.
  const pointers = useRef(new Map());
  const panState = useRef(null);
  const pinchState = useRef(null);

  const rect = () => viewportRef.current?.getBoundingClientRect() ?? null;

  // Keep the layer covering the viewport: at scale 1 it is pinned, and beyond
  // that it may only travel as far as its own overhang.
  const clampView = useCallback((next, box) => {
    const scale = clamp(next.scale, minScale, maxScale);
    if (!box) return { ...next, scale };
    const minTx = box.width * (1 - scale);
    const minTy = box.height * (1 - scale);
    return {
      scale,
      tx: clamp(next.tx, minTx, 0),
      ty: clamp(next.ty, minTy, 0),
    };
  }, [minScale, maxScale]);

  // Zoom about a point given in viewport-local pixels, so the spot under the
  // cursor stays under the cursor.
  const zoomAt = useCallback(
    (factor, px, py) => {
      const box = rect();
      setView((prev) => {
        const scale = clamp(prev.scale * factor, minScale, maxScale);
        const ratio = scale / prev.scale;
        const anchorX = px ?? (box ? box.width / 2 : 0);
        const anchorY = py ?? (box ? box.height / 2 : 0);
        return clampView(
          {
            scale,
            tx: anchorX - (anchorX - prev.tx) * ratio,
            ty: anchorY - (anchorY - prev.ty) * ratio,
          },
          box,
        );
      });
    },
    [clampView, minScale, maxScale],
  );

  const fit = useCallback(() => setView(IDENTITY), []);

  useImperativeHandle(
    ref,
    () => ({
      // Pointer position -> percent of the canvas, transform included.
      toPercent(clientX, clientY) {
        const box = rect();
        if (!box || !box.width || !box.height) return { x: 0, y: 0 };
        return {
          x: ((clientX - box.left - view.tx) / view.scale / box.width) * 100,
          y: ((clientY - box.top - view.ty) / view.scale / box.height) * 100,
        };
      },
      // A drag delta in pixels -> a delta in percent, so a section moves with
      // the cursor at any zoom.
      toPercentDelta(dx, dy) {
        const box = rect();
        if (!box || !box.width || !box.height) return { x: 0, y: 0 };
        return {
          x: (dx / view.scale / box.width) * 100,
          y: (dy / view.scale / box.height) * 100,
        };
      },
      zoomIn: () => zoomAt(1.4),
      zoomOut: () => zoomAt(1 / 1.4),
      fit,
      scale: view.scale,
      element: viewportRef.current,
    }),
    [view, zoomAt, fit],
  );

  // Wheel zoom. Registered natively (not via onWheel) because React's synthetic
  // wheel listener is passive and cannot preventDefault the page scroll.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || zoomDisabled) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const box = node.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - box.left, e.clientY - box.top);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomAt, zoomDisabled]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const midpoint = () => {
    const [a, b] = [...pointers.current.values()];
    const box = rect();
    return {
      x: (a.x + b.x) / 2 - (box?.left ?? 0),
      y: (a.y + b.y) / 2 - (box?.top ?? 0),
    };
  };

  const handlePointerDown = (e) => {
    onCanvasPointerDown?.(e);
    if (e.defaultPrevented) return;

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && !zoomDisabled) {
      panState.current = null;
      pinchState.current = { distance: distance(), scale: view.scale };
      return;
    }
    if (pointers.current.size !== 1 || panDisabled) return;

    panState.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState.current && pointers.current.size === 2) {
      const next = distance();
      const ratio = next / (pinchState.current.distance || 1);
      const mid = midpoint();
      setView((prev) => {
        const scale = clamp(pinchState.current.scale * ratio, minScale, maxScale);
        const step = scale / prev.scale;
        return clampView(
          { scale, tx: mid.x - (mid.x - prev.tx) * step, ty: mid.y - (mid.y - prev.ty) * step },
          rect(),
        );
      });
      return;
    }

    const pan = panState.current;
    if (!pan) return;
    const box = rect();
    setView((prev) =>
      clampView(
        { scale: prev.scale, tx: pan.tx + (e.clientX - pan.x), ty: pan.ty + (e.clientY - pan.y) },
        box,
      ),
    );
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;
    if (pointers.current.size === 0) panState.current = null;
  };

  const handleDoubleClick = (e) => {
    if (zoomDisabled) return;
    const box = rect();
    if (!box) return;
    if (view.scale >= maxScale - 0.01) {
      fit();
      return;
    }
    zoomAt(2, e.clientX - box.left, e.clientY - box.top);
  };

  const backgroundLayer = useMemo(() => {
    if (!background?.url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={background.url}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        style={{ opacity: background.opacity ?? 0.6 }}
      />
    );
  }, [background?.url, background?.opacity]);

  const zoomed = view.scale > 1.001;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={handleDoubleClick}
        style={{ aspectRatio: aspect }}
        className={cn(
          "relative w-full touch-none overflow-hidden rounded-xl border border-border bg-surface-subtle",
          !panDisabled && (zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-default"),
        )}
      >
        <div
          className={cn("absolute inset-0 origin-top-left", layerClassName)}
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            // Snap back to fit without animating every pan frame.
            transition: panState.current || pinchState.current ? undefined : "transform 120ms ease-out",
          }}
        >
          {/* A faint grid so an empty floor still reads as a surface. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "5% 5%",
            }}
          />
          {backgroundLayer}
          {children}
        </div>

        {overlay}

        {controls ? (
          <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Zoom in"
              className="h-7 w-7 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => zoomAt(1.4)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Zoom out"
              className="h-7 w-7 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => zoomAt(1 / 1.4)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Fit map to view"
              disabled={!zoomed}
              className="h-7 w-7 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={fit}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default MapCanvas;
