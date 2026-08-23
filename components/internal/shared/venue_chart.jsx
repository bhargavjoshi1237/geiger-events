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

import * as echarts from "echarts/core";
import { CustomChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";

import { aspectRatio } from "@/lib/seating/geometry";
import {
  clampView,
  fitView,
  frameSeats,
  seatOpacity,
  seatsInView,
  viewWindow,
  zoomAt,
} from "@/lib/seating/viewport";
import { cn } from "@/lib/utils";

// The venue, drawn on a canvas by ECharts.
//
// It replaces a DOM renderer that had run out of road: every chair was an
// element, strokes had to be counter-scaled against a zoom of 15, chair boxes
// landed sub-pixel and rounded to different device pixels, and the whole thing
// only stayed upright because just ONE section's seats were ever mounted. The
// "Whole venue" drill-in existed to serve that budget rather than the buyer.
//
// Here there is no drill-in. One continuous zoom runs from the whole arena down
// to a single chair, and detail arrives on the way (see viewport.js): chairs
// fade in once the visible span is small enough to be worth them, and only the
// chairs inside the window are ever handed to the renderer. The element count
// is bounded by the VIEWPORT, not by the venue, so a 20,000-seat bowl costs the
// same to draw as a 200-seat theatre.
//
// Pan and zoom are ours rather than ECharts'. `dataZoom: inside` re-renders the
// whole series on every wheel tick and roam over a custom series is documented
// as slow; both are the hot path here. Driving the axis window directly is a
// dozen lines and keeps the aspect lock that makes a chair come out square.
//
// It owns no data and no persistence: the caller supplies the sections, the
// seats, a state per seat, the colours, and the handlers.

echarts.use([CustomChart, CanvasRenderer]);

// Fill colours per seat state. The DOM renderer told these apart with Tailwind
// classes; a canvas needs the values.
export const SEAT_COLOR = {
  available: "#6b7280",
  selected: "#3b82f6",
  sold: "#2b2f36",
  held: "#f59e0b",
  blocked: "#a78bfa",
  accessible: "#38bdf8",
  filtered: "#23262b",
};

const INTERACTIVE = new Set(["available", "selected", "blocked"]);

// Share of the chair pitch a chair fills. Below this the block reads as one
// slab you cannot aim at; above it the gutters close up.
const SEAT_FILL = 0.62;

// ECharts turns anticlockwise in radians; the geometry is stored as clockwise
// degrees, the way CSS draws it.
const toRadians = (deg) => (-(Number(deg) || 0) * Math.PI) / 180;

const hexAlpha = (hex, alpha) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return hex;
  const n = parseInt(value, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const VenueChart = forwardRef(function VenueChart({
  sections = [],
  seats = [],
  field = null,
  aspect = "16/10",
  seatState,
  // Colours per state, merged over the buyer-facing defaults. The editor paints
  // by seat KIND rather than by availability, and it is the caller that knows
  // which vocabulary its `seatState` speaks.
  seatColors,
  // Which states may be clicked. Defaults to the buyer's answer (an open seat);
  // the editor lets every chair be clicked, because there it changes the seat's
  // KIND rather than buying it.
  seatInteractive = (state) => INTERACTIVE.has(state),
  onSeatClick,
  sectionMeta,
  disabledSectionIds,
  seatLabel,
  colorBySectionId,
  formatPrice,
  // Chair pitch in units, measured by the caller from the seats it holds. The
  // renderer will not guess it: an arena and a studio theatre disagree by an
  // order of magnitude.
  seatPitch = 1.2,
  className,
  onHoverSection,
  // The editor layers real DOM controls over the canvas — draggable section
  // boxes, a resize handle — and has to position them against whatever slice of
  // the venue is on screen. It gets the window rather than the transform: the
  // window is in the same percent space the geometry is stored in, so the boxes
  // are placed by the same numbers that get saved.
  onViewChange,
  // Panning is suspended while a section is being dragged, so the floor doesn't
  // slide out from under the block.
  panDisabled = false,
}, ref) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const ar = aspectRatio(aspect);

  const [size, setSize] = useState({ width: 0, height: 0 });
  // null means "nobody has touched the map yet", so it keeps framing the whole
  // venue as the dialog is resized. The view is DERIVED rather than stored:
  // holding an unclamped view in state and re-clamping it from an effect is a
  // cascading render, and it lets an impossible view exist for a frame.
  const [userView, setUserView] = useState(null);
  const [hover, setHover] = useState(null);
  // Pointer bookkeeping for pan and pinch, kept out of state so a drag doesn't
  // re-render on every move.
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const viewAspect = size.height > 0 ? size.width / size.height : ar;

  // Whatever the buyer asked for, made legal for the viewport it has to fit.
  const resolve = useCallback(
    (current) => clampView(current ?? fitView(aspect, viewAspect), aspect, viewAspect),
    [aspect, viewAspect],
  );
  const view = useMemo(() => resolve(userView), [resolve, userView]);
  const window_ = useMemo(() => viewWindow(view, viewAspect), [view, viewAspect]);
  const opacity = seatOpacity(view.spanY);

  // Picking a row in the rail should move the map to it. Imperative on purpose:
  // it is a response to an event, not a value the map can derive, and driving it
  // from an effect would re-frame the venue every time the offer list changed.
  useImperativeHandle(
    ref,
    () => ({
      focusSeats(target) {
        const frame = frameSeats(target || [], aspect, seatPitch);
        if (frame) setUserView(clampView(frame, aspect, viewAspect));
      },
      fit() {
        setUserView(null);
      },
      // Pointer position -> percent of the map, the space the geometry tables
      // store. Same contract as MapCanvas, so a caller layering DOM controls
      // over the canvas does the same arithmetic it always did.
      toPercent(clientX, clientY) {
        const box = hostRef.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return { x: 0, y: 0 };
        return {
          x: (window_.xMin + ((clientX - box.left) / box.width) * window_.spanX) / ar,
          y: window_.yMin + ((clientY - box.top) / box.height) * window_.spanY,
        };
      },
      // A drag delta in pixels -> a delta in percent, so a block tracks the
      // cursor at any zoom.
      toPercentDelta(dx, dy) {
        const box = hostRef.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return { x: 0, y: 0 };
        return {
          x: ((dx / box.width) * window_.spanX) / ar,
          y: (dy / box.height) * window_.spanY,
        };
      },
    }),
    [aspect, viewAspect, seatPitch, window_, ar],
  );

  // --- the chart instance -----------------------------------------------------

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, null, { renderer: "canvas" });
    chartRef.current = chart;

    const measure = () => {
      const box = host.getBoundingClientRect();
      setSize({ width: box.width, height: box.height });
      chart.resize();
    };
    measure();

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(host);

    return () => {
      observer?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // --- pointer -> view --------------------------------------------------------

  // Client pixels -> units, against the window currently on screen.
  const toUnits = useCallback(
    (clientX, clientY) => {
      const host = hostRef.current;
      if (!host) return null;
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      return {
        x: window_.xMin + ((clientX - box.left) / box.width) * window_.spanX,
        y: window_.yMin + ((clientY - box.top) / box.height) * window_.spanY,
      };
    },
    [window_],
  );

  const onWheel = useCallback(
    (event) => {
      event.preventDefault();
      const anchor = toUnits(event.clientX, event.clientY);
      // A trackpad reports many small deltas and a mouse a few large ones;
      // exponentiating keeps both feeling like the same gesture.
      const factor = Math.exp(-event.deltaY * 0.0016);
      setUserView((current) => zoomAt(resolve(current), factor, anchor, aspect, viewAspect));
    },
    [toUnits, resolve, aspect, viewAspect],
  );

  const onPointerDown = useCallback(
    (event) => {
      const host = hostRef.current;
      if (!host || panDisabled) return;
      host.setPointerCapture?.(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          spanY: view.spanY,
        };
        drag.current = null;
        return;
      }
      drag.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        cx: view.cx,
        cy: view.cy,
        moved: false,
      };
    },
    [view, panDisabled],
  );

  const onPointerMove = useCallback(
    (event) => {
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (pinch.current && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const anchor = toUnits((a.x + b.x) / 2, (a.y + b.y) / 2);
        const factor = distance / pinch.current.distance;
        setUserView((current) =>
          zoomAt(
            { ...resolve(current), spanY: pinch.current.spanY },
            factor,
            anchor,
            aspect,
            viewAspect,
          ),
        );
        return;
      }

      if (!drag.current) return;
      const host = hostRef.current;
      const box = host?.getBoundingClientRect();
      if (!box?.width) return;
      const dx = ((event.clientX - drag.current.clientX) / box.width) * window_.spanX;
      const dy = ((event.clientY - drag.current.clientY) / box.height) * window_.spanY;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) drag.current.moved = true;
      setUserView((current) =>
        clampView(
          { ...resolve(current), cx: drag.current.cx - dx, cy: drag.current.cy - dy },
          aspect,
          viewAspect,
        ),
      );
    },
    [toUnits, resolve, window_, aspect, viewAspect],
  );

  const endPointer = useCallback((event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      // Held for the click handler, which has to know a drag from a tap.
      setTimeout(() => {
        drag.current = null;
      }, 0);
    }
  }, []);

  // --- what to draw -----------------------------------------------------------

  const visibleSeats = useMemo(
    () => (opacity > 0 ? seatsInView(seats, window_, aspect) : []),
    [opacity, seats, window_, aspect],
  );

  const palette = useMemo(() => ({ ...SEAT_COLOR, ...(seatColors || {}) }), [seatColors]);

  const option = useMemo(() => {
    const seatSize = seatPitch * SEAT_FILL;

    const sectionData = sections.map((section) => {
      const band = colorBySectionId?.[section.id];
      const meta = sectionMeta?.(section) || {};
      const disabled = disabledSectionIds?.has(section.id) || meta.available === 0;
      return {
        value: [
          (Number(section.x) || 0) * ar,
          Number(section.y) || 0,
          (Number(section.width) || 0) * ar,
          Number(section.height) || 0,
        ],
        section,
        band,
        meta,
        disabled,
      };
    });

    const series = [];

    if (field && field.shape !== "none" && Number(field.width) > 0) {
      series.push({
        type: "custom",
        silent: true,
        z: 1,
        data: [
          [
            (Number(field.x) || 0) * ar,
            Number(field.y) || 0,
            (Number(field.width) || 0) * ar,
            Number(field.height) || 0,
          ],
        ],
        renderItem: (params, api) => {
          const topLeft = api.coord([api.value(0), api.value(1)]);
          const bottomRight = api.coord([
            api.value(0) + api.value(2),
            api.value(1) + api.value(3),
          ]);
          return {
            type: field.shape === "ellipse" ? "ellipse" : "rect",
            shape:
              field.shape === "ellipse"
                ? {
                    cx: (topLeft[0] + bottomRight[0]) / 2,
                    cy: (topLeft[1] + bottomRight[1]) / 2,
                    rx: Math.abs(bottomRight[0] - topLeft[0]) / 2,
                    ry: Math.abs(bottomRight[1] - topLeft[1]) / 2,
                  }
                : {
                    x: topLeft[0],
                    y: topLeft[1],
                    width: bottomRight[0] - topLeft[0],
                    height: bottomRight[1] - topLeft[1],
                    r: 4,
                  },
            style: { fill: "#23262b", stroke: "#31353b", lineWidth: 1 },
          };
        },
      });
    }

    series.push({
      type: "custom",
      z: 2,
      data: sectionData,
      renderItem: (params, api) => {
        const item = sectionData[params.dataIndex];
        if (!item) return null;
        const topLeft = api.coord([api.value(0), api.value(1)]);
        const bottomRight = api.coord([
          api.value(0) + api.value(2),
          api.value(1) + api.value(3),
        ]);
        const width = bottomRight[0] - topLeft[0];
        const height = bottomRight[1] - topLeft[1];
        const colour = item.band?.hex || "#6b7280";
        const isHovered = hover?.kind === "section" && hover.id === item.section.id;

        // Once the chairs are up, the sections behind them are context — let
        // them recede rather than compete with what the buyer is aiming at.
        const alpha = item.disabled ? 0.1 : (isHovered ? 0.42 : 0.24) * (1 - opacity * 0.55);

        const children = [
          {
            type: "rect",
            shape: { x: topLeft[0], y: topLeft[1], width, height, r: 3 },
            style: {
              fill: hexAlpha(colour, alpha),
              stroke: hexAlpha(colour, item.disabled ? 0.2 : 0.65),
              lineWidth: isHovered ? 2 : 1,
            },
          },
        ];

        // The name only while there is room for it and no chairs to name
        // themselves.
        if (opacity < 0.6 && Math.abs(width) > 34 && Math.abs(height) > 16) {
          children.push({
            type: "text",
            style: {
              x: topLeft[0] + width / 2,
              y: topLeft[1] + height / 2,
              text: item.section.name || "",
              textAlign: "center",
              textVerticalAlign: "middle",
              fill: item.disabled ? "#6b7280" : "#e6e9ee",
              fontSize: 11,
              fontWeight: 500,
            },
          });
        }

        return {
          type: "group",
          rotation: toRadians(item.section.rotation),
          originX: topLeft[0] + width / 2,
          originY: topLeft[1] + height / 2,
          children,
        };
      },
    });

    if (visibleSeats.length) {
      series.push({
        type: "custom",
        z: 3,
        // Batched so a viewport full of chairs paints across frames rather than
        // blocking the one the buyer is panning in.
        progressive: 800,
        progressiveThreshold: 1200,
        data: visibleSeats.map((seat) => [
          (Number(seat.x) || 0) * ar,
          Number(seat.y) || 0,
        ]),
        renderItem: (params, api) => {
          const seat = visibleSeats[params.dataIndex];
          if (!seat) return null;
          const centre = api.coord([api.value(0), api.value(1)]);
          const edge = api.coord([api.value(0) + seatSize, api.value(1)]);
          const radius = Math.max(1.4, Math.abs(edge[0] - centre[0]) / 2);
          const state = seatState?.(seat) || "available";
          const isHovered = hover?.kind === "seat" && hover.id === seat.id;
          return {
            type: "circle",
            shape: { cx: centre[0], cy: centre[1], r: isHovered ? radius * 1.35 : radius },
            style: {
              fill: palette[state] || palette.available,
              opacity,
            },
          };
        },
      });
    }

    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
      xAxis: {
        type: "value",
        min: window_.xMin,
        max: window_.xMax,
        show: false,
        axisPointer: { show: false },
      },
      yAxis: {
        // Stored geometry grows downward, the way a screen does.
        inverse: true,
        type: "value",
        min: window_.yMin,
        max: window_.yMax,
        show: false,
        axisPointer: { show: false },
      },
      series,
      tooltip: { show: false },
    };
  }, [
    ar,
    sections,
    visibleSeats,
    field,
    window_,
    opacity,
    hover,
    colorBySectionId,
    sectionMeta,
    disabledSectionIds,
    seatState,
    seatPitch,
    palette,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: false, silent: true });
  }, [option]);

  // Publish the window so anything layered over the canvas can be placed
  // against it. Reported rather than derived by the caller because only the
  // chart knows how big its host ended up.
  useEffect(() => {
    if (!size.width || !size.height) return;
    onViewChange?.(window_);
  }, [window_, size.width, size.height, onViewChange]);

  // --- hit testing ------------------------------------------------------------

  // What is under a point, chairs first — they sit on top of their section.
  const hitTest = useCallback(
    (clientX, clientY) => {
      const point = toUnits(clientX, clientY);
      if (!point) return null;

      if (opacity > 0.4) {
        const reach = seatPitch * 0.8;
        let best = null;
        let bestDistance = reach;
        for (const seat of visibleSeats) {
          const distance = Math.hypot((Number(seat.x) || 0) * ar - point.x, (Number(seat.y) || 0) - point.y);
          if (distance < bestDistance) {
            best = seat;
            bestDistance = distance;
          }
        }
        if (best) return { kind: "seat", id: best.id, seat: best, point };
      }

      // Sections are rotated, so a point is tested in each one's own frame.
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        const x = (Number(section.x) || 0) * ar;
        const y = Number(section.y) || 0;
        const width = (Number(section.width) || 0) * ar;
        const height = Number(section.height) || 0;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const angle = ((Number(section.rotation) || 0) * Math.PI) / 180;
        const dx = point.x - cx;
        const dy = point.y - cy;
        const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
        const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
        if (Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2) {
          return { kind: "section", id: section.id, section, point };
        }
      }
      return null;
    },
    [toUnits, opacity, visibleSeats, sections, ar, seatPitch],
  );

  const onMove = useCallback(
    (event) => {
      onPointerMove(event);
      if (drag.current?.moved || pinch.current) return;
      const hit = hitTest(event.clientX, event.clientY);
      setHover((current) => {
        if (current?.kind === hit?.kind && current?.id === hit?.id) return current;
        return hit;
      });
      if (hit?.kind === "section") onHoverSection?.(hit.section);
      else onHoverSection?.(null);
    },
    [onPointerMove, hitTest, onHoverSection],
  );

  const onClick = useCallback(
    (event) => {
      if (drag.current?.moved) return;
      const hit = hitTest(event.clientX, event.clientY);
      if (!hit) return;

      if (hit.kind === "seat") {
        const state = seatState?.(hit.seat) || "available";
        if (seatInteractive(state)) onSeatClick?.(hit.seat);
        return;
      }
      if (disabledSectionIds?.has(hit.id)) return;
      // Clicking a section is a zoom request, not a mode change: go in far
      // enough that its chairs are worth drawing.
      const section = hit.section;
      const height = Number(section.height) || 10;
      setUserView(
        clampView(
          {
            cx: ((Number(section.x) || 0) + (Number(section.width) || 0) / 2) * ar,
            cy: (Number(section.y) || 0) + height / 2,
            spanY: Math.max(6, height * 1.9),
          },
          aspect,
          viewAspect,
        ),
      );
    },
    [hitTest, seatState, seatInteractive, onSeatClick, disabledSectionIds, ar, aspect, viewAspect],
  );

  const hoverLabel = useMemo(() => {
    if (!hover) return null;
    if (hover.kind === "seat") {
      const seat = hover.seat;
      const state = seatState?.(seat) || "available";
      return seatLabel ? seatLabel(seat, state) : `Row ${seat.rowLabel} seat ${seat.seatLabel}`;
    }
    const meta = sectionMeta?.(hover.section) || {};
    const price = meta.price ? ` · ${meta.price}` : "";
    return `${hover.section.name}${price} · ${meta.available ?? 0} open`;
  }, [hover, seatState, seatLabel, sectionMeta]);

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={hostRef}
        role="presentation"
        aria-hidden="true"
        className="h-full w-full touch-none select-none"
        style={{ cursor: hover ? "pointer" : "grab" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          endPointer(e);
          setHover(null);
          onHoverSection?.(null);
        }}
        onClick={onClick}
      />

      {/* What the pointer is over. Follows the cursor rather than sitting in a
          corner, so the buyer's eye never leaves the seat they're aiming at. */}
      {hoverLabel && hover?.point ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[15rem] -translate-x-1/2 -translate-y-[calc(100%+0.6rem)] whitespace-nowrap rounded-md border border-border bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur"
          style={{
            left: `${((hover.point.x - window_.xMin) / window_.spanX) * 100}%`,
            top: `${((hover.point.y - window_.yMin) / window_.spanY) * 100}%`,
          }}
        >
          {hoverLabel}
        </div>
      ) : null}

      <ZoomControls
        onZoom={(factor) =>
          setUserView((current) => {
            const from = resolve(current);
            return zoomAt(from, factor, { x: from.cx, y: from.cy }, aspect, viewAspect);
          })
        }
        // Back to null, not to a fitted view — the map goes on tracking the
        // dialog's shape again as if it had never been touched.
        onReset={() => setUserView(null)}
      />
    </div>
  );
});

function ZoomControls({ onZoom, onReset }) {
  return (
    <div className="absolute bottom-2 right-2 z-20 flex flex-col gap-1">
      {[
        { label: "Zoom in", glyph: "+", factor: 1.6 },
        { label: "Zoom out", glyph: "−", factor: 1 / 1.6 },
      ].map((control) => (
        <button
          key={control.label}
          type="button"
          aria-label={control.label}
          onClick={() => onZoom(control.factor)}
          className="h-7 w-7 rounded-md border border-border bg-background/90 text-sm text-text-secondary backdrop-blur transition-colors hover:text-foreground"
        >
          {control.glyph}
        </button>
      ))}
      <button
        type="button"
        aria-label="Whole venue"
        onClick={onReset}
        className="h-7 w-7 rounded-md border border-border bg-background/90 text-[10px] text-text-secondary backdrop-blur transition-colors hover:text-foreground"
      >
        Fit
      </button>
    </div>
  );
}

export default VenueChart;
