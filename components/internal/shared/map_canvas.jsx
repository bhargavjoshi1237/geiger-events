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
import { aspectRatio } from "@/lib/seating/geometry";
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
//
// Percent is anisotropic, so the box those children sit in HAS to be the shape
// the geometry was authored at. That box is the STAGE, and it is not always the
// viewport: `fill` lets the viewport take whatever room a dialog gives it and
// letterboxes the stage inside. Letting the stage take the viewport's shape
// instead squashes one axis, and everything that mixes the axes then breaks
// with it — chairs stop being square, and a CSS `rotate()` (which turns things
// in PIXELS) lands a section's highlight at a different angle from the chairs
// inside it, which reads as a scatter of dots rather than a seating chart.

const MIN_SCALE = 0.25;
// Deep enough that one section of a 120-block arena can fill the viewport —
// below that, drilling in left the chosen block floating in the middle of a
// mostly-empty canvas.
const MAX_SCALE = 40;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const IDENTITY = { scale: 1, tx: 0, ty: 0 };

export const MapCanvas = forwardRef(function MapCanvas(
  {
    children,
    // The shape the geometry was authored at. Always honoured by the stage;
    // `fill` only decides whether the viewport takes that shape too.
    aspect = "16/10",
    // Fill whatever height the parent gives it instead of taking the shape of
    // `aspect` — a map inside a dialog wants the room. The stage is letterboxed
    // inside, so the coordinate space keeps its shape either way.
    fill = false,
    background = null,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
    // The editor turns panning off while a section is being dragged, so the
    // floor doesn't slide out from under the block.
    panDisabled = false,
    zoomDisabled = false,
    // Lifts the zoom level out on every change, for callers that counter-scale
    // children (constant on-screen seat size) against the layer transform.
    onScaleChange,
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
  // The viewport's own size, needed only to letterbox the stage inside it.
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !fill || typeof ResizeObserver === "undefined") return undefined;
    // Measure once up front so the first paint has a stage to draw on.
    const first = node.getBoundingClientRect();
    setViewportSize({ width: first.width, height: first.height });
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setViewportSize({ width: box.width, height: box.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fill]);

  // The coordinate space, in viewport-local pixels. Held at `aspect` and
  // centred; null when the viewport already IS that shape.
  const stage = useMemo(() => {
    if (!fill) return null;
    const { width, height } = viewportSize;
    if (!width || !height) return { left: 0, top: 0, width: 0, height: 0 };
    const ar = aspectRatio(aspect);
    const w = Math.min(width, height * ar);
    const h = w / ar;
    return { left: (width - w) / 2, top: (height - h) / 2, width: w, height: h };
  }, [fill, aspect, viewportSize]);

  // The stage in CLIENT coordinates. Every transform below is expressed against
  // the coordinate space, not the viewport it may be letterboxed in.
  const rect = useCallback(() => {
    const box = viewportRef.current?.getBoundingClientRect() ?? null;
    if (!box) return null;
    if (!stage) return { left: box.left, top: box.top, width: box.width, height: box.height };
    return {
      left: box.left + stage.left,
      top: box.top + stage.top,
      width: stage.width,
      height: stage.height,
    };
  }, [stage]);

  // Keep the layer covering the viewport: at scale 1 it is pinned, and beyond
  // that it may only travel as far as its own overhang.
  const clampView = useCallback((next, box) => {
    const scale = clamp(next.scale, minScale, maxScale);
    if (!box) return { ...next, scale };
    // Zoomed in (scale > 1) the layer overflows and may only travel as far as
    // its own overhang; zoomed out (scale < 1) it is smaller than the viewport
    // and may sit anywhere between the two edges, so the bounds flip sign.
    const spanX = box.width * (1 - scale);
    const spanY = box.height * (1 - scale);
    return {
      scale,
      tx: clamp(next.tx, Math.min(0, spanX), Math.max(0, spanX)),
      ty: clamp(next.ty, Math.min(0, spanY), Math.max(0, spanY)),
    };
  }, [minScale, maxScale]);

  // Zoom about a point given in stage-local pixels, so the spot under the
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
    [clampView, rect, minScale, maxScale],
  );

  // Programmatic moves (drill into a section, back out to the venue) read
  // better with a slower glide than the snappy follow of a wheel notch, so
  // they flip a temporary longer transition on.
  const [glide, setGlide] = useState(false);
  const glideTimer = useRef(null);
  const beginGlide = useCallback(() => {
    setGlide(true);
    clearTimeout(glideTimer.current);
    glideTimer.current = setTimeout(() => setGlide(false), 500);
  }, []);
  useEffect(() => () => clearTimeout(glideTimer.current), []);

  const fit = useCallback(() => {
    beginGlide();
    setView(IDENTITY);
  }, [beginGlide]);

  // Frame a rectangle given in percent of the canvas. `padding` shrinks the
  // zoom so the surroundings stay in frame — drilling into one section
  // shouldn't erase the buyer's sense of the venue around it.
  const zoomToRect = useCallback(
    (target, { padding = 0.8 } = {}) => {
      const box = rect();
      if (!box || !box.width || !box.height || !target) return;
      beginGlide();
      const wPct = Math.max(1, Math.abs(Number(target.width) || 0));
      const hPct = Math.max(1, Math.abs(Number(target.height) || 0));
      const scale = clamp(Math.min(100 / wPct, 100 / hPct) * padding, minScale, maxScale);
      const cx = (Number(target.x) || 0) + wPct / 2;
      const cy = (Number(target.y) || 0) + hPct / 2;
      setView(
        clampView(
          {
            scale,
            tx: box.width / 2 - (cx / 100) * box.width * scale,
            ty: box.height / 2 - (cy / 100) * box.height * scale,
          },
          box,
        ),
      );
    },
    [beginGlide, clampView, rect, minScale, maxScale],
  );

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
      zoomToRect,
      scale: view.scale,
      element: viewportRef.current,
    }),
    [view, rect, zoomAt, fit, zoomToRect],
  );

  useEffect(() => {
    onScaleChange?.(view.scale);
  }, [onScaleChange, view.scale]);

  // Wheel zoom. Registered natively (not via onWheel) because React's synthetic
  // wheel listener is passive and cannot preventDefault the page scroll.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || zoomDisabled) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const box = rect();
      if (!box) return;
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - box.left, e.clientY - box.top);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [rect, zoomAt, zoomDisabled]);

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
    <div className={cn("relative", fill && "h-full", className)}>
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={handleDoubleClick}
        style={fill ? undefined : { aspectRatio: aspect }}
        className={cn(
          "relative w-full touch-none overflow-hidden rounded-xl border border-border bg-surface-subtle",
          fill && "h-full",
          !panDisabled && (zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-default"),
        )}
      >
        <div
          className={cn("absolute origin-top-left", layerClassName)}
          style={{
            left: stage ? stage.left : 0,
            top: stage ? stage.top : 0,
            width: stage ? stage.width : "100%",
            height: stage ? stage.height : "100%",
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            // Snap back to fit without animating every pan frame.
            transition:
              panState.current || pinchState.current
                ? undefined
                : `transform ${glide ? 400 : 120}ms ease-out`,
          }}
        >
          {/* A faint grid so an empty floor still reads as a surface. Its cells
              and its hairlines are both drawn in layer space, so they magnify
              with everything else — divide both back out, and let it fade off
              once the zoom is deep enough that a floor isn't what's on show. */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.04) ${
                1 / view.scale
              }px, transparent ${1 / view.scale}px), linear-gradient(to bottom, rgba(255,255,255,0.04) ${
                1 / view.scale
              }px, transparent ${1 / view.scale}px)`,
              backgroundSize: `${5 / view.scale}% ${5 / view.scale}%`,
              opacity: view.scale > 4 ? 0 : 1,
            }}
          />
          {backgroundLayer}
          {children}
        </div>

        {overlay}

        {controls ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur"
          >
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
