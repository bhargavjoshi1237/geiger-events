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
import { GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Maximize2, Minus, Plus } from "lucide-react";

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

echarts.use([CustomChart, GridComponent, CanvasRenderer]);

export const SEAT_COLOR = {
  available: "#6e6e6e",
  selected: "#3b82f6",
  sold: "#2a2a2a",
  held: "#f59e0b",
  blocked: "#a78bfa",
  accessible: "#38bdf8",
  filtered: "#242424",
};

const INTERACTIVE = new Set(["available", "selected", "blocked"]);

const AMBIENT =
  "radial-gradient(115% 85% at 50% 40%, rgba(255,255,255,0.045), transparent 62%)," +
  "radial-gradient(150% 120% at 50% 50%, transparent 45%, rgba(0,0,0,0.38)), #161616";

const SEAT_FILL = 0.62;

const CAMERA_MS = 420;

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
  seatColors,
  seatInteractive = (state) => INTERACTIVE.has(state),
  onSeatClick,
  sectionMeta,
  disabledSectionIds,
  seatLabel,
  colorBySectionId,
  formatPrice,
  seatPitch = 1.2,
  className,
  onHoverSection,
  onViewChange,
  panDisabled = false,
  ambient = false,
}, ref) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const ar = aspectRatio(aspect);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [userView, setUserView] = useState(null);
  const [hover, setHover] = useState(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const viewAspect = size.height > 0 ? size.width / size.height : ar;

  const resolve = useCallback(
    (current) => clampView(current ?? fitView(aspect, viewAspect), aspect, viewAspect),
    [aspect, viewAspect],
  );
  const view = useMemo(() => resolve(userView), [resolve, userView]);
  const window_ = useMemo(() => viewWindow(view, viewAspect), [view, viewAspect]);
  const opacity = seatOpacity(view.spanY);

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const raf = useRef(0);
  const stopCamera = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const animateTo = useCallback(
    (target, { settle = false } = {}) => {
      stopCamera();
      const to = clampView(target, aspect, viewAspect);
      const from = viewRef.current;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      const arrive = () => setUserView(settle ? null : to);
      if (!from || reduced) {
        arrive();
        return;
      }

      const ratio = to.spanY / from.spanY;
      const travel = Math.hypot(to.cx - from.cx, to.cy - from.cy);
      if (Math.abs(Math.log(ratio)) < 0.02 && travel < to.spanY * 0.02) {
        arrive();
        return;
      }

      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / CAMERA_MS);
        const eased = 1 - (1 - t) ** 3;
        setUserView({
          cx: from.cx + (to.cx - from.cx) * eased,
          cy: from.cy + (to.cy - from.cy) * eased,
          spanY: from.spanY * ratio ** eased,
        });
        if (t < 1) {
          raf.current = requestAnimationFrame(tick);
          return;
        }
        raf.current = 0;
        arrive();
      };
      raf.current = requestAnimationFrame(tick);
    },
    [aspect, viewAspect, stopCamera],
  );

  useImperativeHandle(
    ref,
    () => ({
      focusSeats(target) {
        const frame = frameSeats(target || [], aspect, seatPitch);
        if (frame) animateTo(frame);
      },
      fit() {
        animateTo(fitView(aspect, viewAspect), { settle: true });
      },
      toPercent(clientX, clientY) {
        const box = hostRef.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return { x: 0, y: 0 };
        return {
          x: (window_.xMin + ((clientX - box.left) / box.width) * window_.spanX) / ar,
          y: window_.yMin + ((clientY - box.top) / box.height) * window_.spanY,
        };
      },
      toPercentDelta(dx, dy) {
        const box = hostRef.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return { x: 0, y: 0 };
        return {
          x: ((dx / box.width) * window_.spanX) / ar,
          y: (dy / box.height) * window_.spanY,
        };
      },
    }),
    [aspect, viewAspect, seatPitch, window_, ar, animateTo],
  );

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
      stopCamera();
      const anchor = toUnits(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0016);
      setUserView((current) => zoomAt(resolve(current), factor, anchor, aspect, viewAspect));
    },
    [toUnits, resolve, aspect, viewAspect, stopCamera],
  );

  const onPointerDown = useCallback(
    (event) => {
      const host = hostRef.current;
      if (!host || panDisabled) return;
      stopCamera();
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
    [view, panDisabled, stopCamera],
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
        const spanY = pinch.current.spanY;
        setUserView((current) =>
          zoomAt({ ...resolve(current), spanY }, factor, anchor, aspect, viewAspect),
        );
        return;
      }

      const gesture = drag.current;
      if (!gesture) return;
      const host = hostRef.current;
      const box = host?.getBoundingClientRect();
      if (!box?.width) return;
      const dx = ((event.clientX - gesture.clientX) / box.width) * window_.spanX;
      const dy = ((event.clientY - gesture.clientY) / box.height) * window_.spanY;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) gesture.moved = true;
      const { cx, cy } = gesture;
      setUserView((current) =>
        clampView({ ...resolve(current), cx: cx - dx, cy: cy - dy }, aspect, viewAspect),
      );
    },
    [toUnits, resolve, window_, aspect, viewAspect],
  );

  const endPointer = useCallback((event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      setTimeout(() => {
        drag.current = null;
      }, 0);
    }
  }, []);

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
            style: { fill: "#242424", stroke: "#474747", lineWidth: 1 },
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
        const colour = item.band?.hex || "#6e6e6e";
        const isHovered = hover?.kind === "section" && hover.id === item.section.id;

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

        if (opacity < 0.6 && Math.abs(width) > 34 && Math.abs(height) > 16) {
          children.push({
            type: "text",
            style: {
              x: topLeft[0] + width / 2,
              y: topLeft[1] + height / 2,
              text: item.section.name || "",
              textAlign: "center",
              textVerticalAlign: "middle",
              fill: item.disabled ? "#737373" : "#e7e7e7",
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
          const colour = palette[state] || palette.available;

          if (state === "selected") {
            return {
              type: "group",
              children: [
                {
                  type: "circle",
                  shape: { cx: centre[0], cy: centre[1], r: radius * 2.2 },
                  style: { fill: hexAlpha(colour, 0.2), opacity },
                },
                {
                  type: "circle",
                  shape: { cx: centre[0], cy: centre[1], r: radius * 1.15 },
                  style: {
                    fill: colour,
                    opacity,
                    shadowBlur: 10,
                    shadowColor: hexAlpha(colour, 0.9),
                  },
                },
              ],
            };
          }

          return {
            type: "circle",
            shape: { cx: centre[0], cy: centre[1], r: isHovered ? radius * 1.35 : radius },
            style: {
              fill: colour,
              opacity,
              stroke: isHovered ? "#f8fafc" : undefined,
              lineWidth: isHovered ? 1.25 : 0,
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
        inverse: true,
        type: "value",
        min: window_.yMin,
        max: window_.yMax,
        show: false,
        axisPointer: { show: false },
      },
      series,
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

  useEffect(() => {
    if (!size.width || !size.height) return;
    onViewChange?.(window_);
  }, [window_, size.width, size.height, onViewChange]);

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
      const section = hit.section;
      const height = Number(section.height) || 10;
      animateTo({
        cx: ((Number(section.x) || 0) + (Number(section.width) || 0) / 2) * ar,
        cy: (Number(section.y) || 0) + height / 2,
        spanY: Math.max(6, height * 1.9),
      });
    },
    [hitTest, seatState, seatInteractive, onSeatClick, disabledSectionIds, ar, animateTo],
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
    <div
      className={cn("relative min-h-0", className)}
      style={ambient ? { background: AMBIENT } : undefined}
    >
      <ul className="sr-only">
        {sections.map((section) => {
          const meta = sectionMeta?.(section) || {};
          const available = meta.available ?? 0;
          return (
            <li key={section.id}>
              {`${section.name || "Section"}: ${available} ${
                available === 1 ? "seat" : "seats"
              } available${meta.price ? `, ${meta.price}` : ""}${disabledSectionIds?.has(section.id) ? ", unavailable" : ""}`}
            </li>
          );
        })}
      </ul>

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

      {hoverLabel && hover?.point ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[15rem] -translate-x-1/2 -translate-y-[calc(100%+0.7rem)] whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-2.5 py-1.5 text-xs font-medium tracking-tight text-white shadow-xl shadow-black/50 ring-1 ring-inset ring-white/5 backdrop-blur-md"
          style={{
            left: `${((hover.point.x - window_.xMin) / window_.spanX) * 100}%`,
            top: `${((hover.point.y - window_.yMin) / window_.spanY) * 100}%`,
          }}
        >
          {hoverLabel}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-black/85" />
        </div>
      ) : null}

      <ZoomControls
        onZoom={(factor) =>
          animateTo(zoomAt(view, factor, { x: view.cx, y: view.cy }, aspect, viewAspect))
        }
        onReset={() => animateTo(fitView(aspect, viewAspect), { settle: true })}
      />
    </div>
  );
});

function ZoomControls({ onZoom, onReset }) {
  const button =
    "flex h-8 w-8 items-center justify-center text-text-secondary transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

  return (
    <div className="absolute bottom-2.5 right-2.5 z-20 flex flex-col divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/60 shadow-lg shadow-black/40 backdrop-blur-md">
      {[
        { label: "Zoom in", Icon: Plus, factor: 1.6 },
        { label: "Zoom out", Icon: Minus, factor: 1 / 1.6 },
      ].map(({ label, Icon, factor }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={() => onZoom(factor)}
          className={button}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <button
        type="button"
        aria-label="Whole venue"
        onClick={onReset}
        className={button}
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default VenueChart;
