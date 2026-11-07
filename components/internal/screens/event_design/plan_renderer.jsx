"use client";

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@geiger/ui";
import { cn } from "@/lib/utils";
import {
  aabbOf,
  chairLocalPositions,
  CHAIR_DEPTH_M,
  CHAIR_WIDTH_M,
  drawsChairs,
  formatLength,
  gridStepFor,
  niceScaleLength,
  roomPolygon,
  seatPositions,
  sortForRender,
} from "@/lib/event_design";

// PlanRenderer — shared to-scale SVG plan (metres): read-only for cards/share pages, pan/zoom + edit hooks (overlay/hud render-props) for the editor.

export const CATEGORY_TONE = {
  tables: "fill-surface-card stroke-text-secondary",
  seating: "fill-sky-400/20 stroke-sky-600/70 dark:stroke-sky-400/70",
  staging: "fill-violet-400/15 stroke-violet-600/60 dark:stroke-violet-400/60",
  bars_catering: "fill-emerald-400/15 stroke-emerald-600/70 dark:stroke-emerald-400/70",
  dance_entertainment: "fill-amber-400/15 stroke-amber-600/70 dark:stroke-amber-400/70",
  av: "fill-cyan-400/15 stroke-cyan-600/70 dark:stroke-cyan-400/70",
  decor: "fill-lime-400/20 stroke-lime-700/60 dark:stroke-lime-400/60",
  structure: "fill-zinc-400/40 stroke-zinc-600 dark:fill-zinc-500/40 dark:stroke-zinc-400",
};

const NSS = "non-scaling-stroke";
const LABEL_PX = 11;
const MIN_VIEW_M = 1.5;
const toSet = (ids) => (ids instanceof Set ? ids : new Set(ids || []));

// The object's own outline in its local frame (centre origin), shared by the body, selection and flag outlines.
function ShapePath({ instance, className, strokeWidth = 1, dash, inset = 0 }) {
  const w = instance.width_m + inset * 2;
  const d = instance.depth_m + inset * 2;
  const common = { className, strokeWidth, vectorEffect: NSS, strokeDasharray: dash };
  if (instance.shape === "round" || instance.shape === "oval") {
    return <ellipse cx={0} cy={0} rx={w / 2} ry={d / 2} {...common} />;
  }
  if (instance.shape === "custom" && Array.isArray(instance.points)) {
    const pts = instance.points.map(([x, y]) => `${x * w},${y * d}`).join(" ");
    return <polygon points={pts} strokeLinejoin="round" {...common} />;
  }
  return (
    <rect
      x={-w / 2}
      y={-d / 2}
      width={w}
      height={d}
      rx={Math.min(0.06, w / 8, d / 8)}
      {...common}
    />
  );
}

// Plan symbols drawn on top of the body: door swings, exit marking, dance-floor panels, screen face, power outlet.
function PlanSymbol({ instance }) {
  const w = instance.width_m;
  const d = instance.depth_m;
  const line = "fill-none stroke-text-secondary";
  if (instance.symbol === "door" || instance.symbol === "door_double") {
    const leaves = instance.symbol === "door_double" ? [-1, 1] : [-1];
    const leaf = instance.symbol === "door_double" ? w / 2 : w;
    return leaves.map((side) => {
      const hinge = side * (w / 2);
      const tip = hinge - side * leaf;
      return (
        <g key={side}>
          <line x1={hinge} y1={d / 2} x2={hinge} y2={d / 2 + leaf} className={line} vectorEffect={NSS} strokeWidth={1} />
          <path
            d={`M ${tip} ${d / 2} A ${leaf} ${leaf} 0 0 ${side < 0 ? 1 : 0} ${hinge} ${d / 2 + leaf}`}
            className={line}
            vectorEffect={NSS}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </g>
      );
    });
  }
  if (instance.symbol === "dance") {
    const panel = 0.9144;
    const cols = Math.max(1, Math.round(w / panel));
    const rows = Math.max(1, Math.round(d / panel));
    const lines = [];
    for (let i = 1; i < cols; i += 1) {
      const x = -w / 2 + (w * i) / cols;
      lines.push(<line key={`c${i}`} x1={x} y1={-d / 2} x2={x} y2={d / 2} className="stroke-amber-600/30 dark:stroke-amber-400/30" vectorEffect={NSS} strokeWidth={1} />);
    }
    for (let j = 1; j < rows; j += 1) {
      const y = -d / 2 + (d * j) / rows;
      lines.push(<line key={`r${j}`} x1={-w / 2} y1={y} x2={w / 2} y2={y} className="stroke-amber-600/30 dark:stroke-amber-400/30" vectorEffect={NSS} strokeWidth={1} />);
    }
    return lines;
  }
  if (instance.symbol === "screen") {
    return <line x1={-w / 2 + 0.05} y1={-d / 2 + 0.06} x2={w / 2 - 0.05} y2={-d / 2 + 0.06} className="stroke-cyan-700 dark:stroke-cyan-300" vectorEffect={NSS} strokeWidth={2.5} />;
  }
  if (instance.symbol === "power") {
    const r = Math.min(w, d) / 3;
    return (
      <g className={line}>
        <circle r={r} vectorEffect={NSS} strokeWidth={1} />
        <line x1={-r} y1={0} x2={r} y2={0} vectorEffect={NSS} strokeWidth={1} />
      </g>
    );
  }
  return null;
}

function displayText(instance) {
  if (instance.label) return instance.label;
  if (instance.symbol === "exit") return "EXIT";
  if (instance.category === "tables" || instance.category === "seating") return "";
  return instance.name || "";
}

const PlanObject = memo(function PlanObject({
  instance,
  selected,
  flagged,
  showChairs,
  showLabel,
  pxPerMetre,
  interactive,
}) {
  const chairs = showChairs && drawsChairs(instance) ? chairLocalPositions(instance) : [];
  const exit = instance.symbol === "exit";
  const tone = exit
    ? "fill-emerald-500/25 stroke-emerald-700 dark:stroke-emerald-400"
    : CATEGORY_TONE[instance.category] || CATEGORY_TONE.decor;
  const text = showLabel ? displayText(instance) : "";
  const fontM = pxPerMetre > 0 ? LABEL_PX / pxPerMetre : 0;
  const widthPx = instance.width_m * pxPerMetre;
  const depthPx = instance.depth_m * pxPerMetre;
  const fits =
    fontM > 0 &&
    text &&
    Math.max(widthPx, depthPx) >= text.length * LABEL_PX * 0.62 + 4 &&
    Math.min(widthPx, depthPx) >= LABEL_PX + 2;

  return (
    <g
      data-instance-id={instance.id}
      transform={`translate(${instance.x_m} ${instance.y_m}) rotate(${instance.rotation || 0})`}
      className={interactive ? "cursor-pointer" : undefined}
    >
      {chairs.map((c) => (
        <g key={c.index} transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}>
          <rect
            x={-CHAIR_WIDTH_M / 2}
            y={-CHAIR_DEPTH_M / 2}
            width={CHAIR_WIDTH_M}
            height={CHAIR_DEPTH_M}
            rx={0.07}
            className="fill-surface-strong stroke-text-tertiary"
            strokeWidth={1}
            vectorEffect={NSS}
          />
          <rect
            x={-CHAIR_WIDTH_M / 2}
            y={CHAIR_DEPTH_M / 2 - 0.09}
            width={CHAIR_WIDTH_M}
            height={0.09}
            rx={0.03}
            className="fill-text-tertiary"
          />
        </g>
      ))}
      <ShapePath instance={instance} className={tone} />
      <PlanSymbol instance={instance} />
      {flagged ? (
        <ShapePath instance={instance} className="fill-none stroke-red-500" strokeWidth={1.5} dash="4 3" inset={0.04} />
      ) : null}
      {selected ? (
        <ShapePath instance={instance} className="fill-none stroke-primary" strokeWidth={2} inset={0.06} />
      ) : null}
      {fits ? (
        <text
          transform={`rotate(${-(instance.rotation || 0)})`}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontM}
          className={cn(
            "pointer-events-none select-none font-medium",
            exit ? "fill-emerald-800 dark:fill-emerald-200" : "fill-foreground",
          )}
        >
          {text}
        </text>
      ) : null}
    </g>
  );
});

function GridLines({ box, step, pxPerMetre }) {
  if (!(step > 0) || !(pxPerMetre > 0)) return null;
  let minor = step;
  while (minor * pxPerMetre < 8) minor *= 2;
  const major = minor * 5;
  const lines = [];
  const startX = Math.ceil(box.minX / minor) * minor;
  const startY = Math.ceil(box.minY / minor) * minor;
  for (let x = startX, i = 0; x <= box.maxX + 1e-9 && i < 600; x += minor, i += 1) {
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    lines.push(<line key={`x${i}`} x1={x} y1={box.minY} x2={x} y2={box.maxY} className={isMajor ? "stroke-border-strong" : "stroke-border"} strokeWidth={1} vectorEffect={NSS} />);
  }
  for (let y = startY, i = 0; y <= box.maxY + 1e-9 && i < 600; y += minor, i += 1) {
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    lines.push(<line key={`y${i}`} x1={box.minX} y1={y} x2={box.maxX} y2={y} className={isMajor ? "stroke-border-strong" : "stroke-border"} strokeWidth={1} vectorEffect={NSS} />);
  }
  return <g className="pointer-events-none">{lines}</g>;
}

function ScaleBar({ pxPerMetre, unit }) {
  const bar = niceScaleLength(pxPerMetre, unit);
  const px = bar.metres * pxPerMetre;
  if (!(px > 4)) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-1 rounded-md border border-border bg-surface-card/90 px-2 py-1.5 backdrop-blur">
      <span className="text-[10px] font-medium tabular-nums text-text-secondary">{bar.label}</span>
      <span className="block h-1.5 border-x border-b border-foreground/70" style={{ width: px }} />
    </div>
  );
}

const ZOOM_BUTTON = "h-8 w-8 text-muted-foreground hover:bg-surface-active hover:text-foreground";

export const PlanRenderer = forwardRef(function PlanRenderer(
  {
    plan,
    interactive = false,
    panMode = "drag",
    selectedIds,
    flaggedIds,
    showGrid,
    gridM,
    showChairs = true,
    showLabels = true,
    showScale,
    showDimensions,
    padding = 0.06,
    overlay,
    hud,
    onObjectPointerDown,
    onBackgroundPointerDown,
    className,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(null);
  const panRef = useRef(null);
  const stateRef = useRef({ vb: null, size: { width: 0, height: 0 } });

  const unit = plan?.unit === "ft" ? "ft" : "m";
  const room = useMemo(() => roomPolygon(plan), [plan]);
  const roomBox = useMemo(() => aabbOf(room), [room]);
  const objects = useMemo(() => sortForRender(plan?.objects || []), [plan?.objects]);
  const objectById = useMemo(() => new Map((plan?.objects || []).map((o) => [o.id, o])), [plan?.objects]);
  const selected = useMemo(() => toSet(selectedIds), [selectedIds]);
  const flagged = useMemo(() => toSet(flaggedIds), [flaggedIds]);

  const fitBox = useMemo(() => {
    const span = Math.max(roomBox.maxX - roomBox.minX, roomBox.maxY - roomBox.minY, 1);
    const pad = span * padding + ((showDimensions ?? interactive) ? span * 0.03 : 0);
    return {
      x: roomBox.minX - pad,
      y: roomBox.minY - pad,
      w: roomBox.maxX - roomBox.minX + pad * 2,
      h: roomBox.maxY - roomBox.minY + pad * 2,
    };
  }, [roomBox, padding, showDimensions, interactive]);

  const vb = interactive && view ? view : fitBox;
  const scale = size.width && size.height ? Math.min(size.width / vb.w, size.height / vb.h) : 0;
  const offsetX = (size.width - vb.w * scale) / 2;
  const offsetY = (size.height - vb.h * scale) / 2;

  useEffect(() => {
    stateRef.current = { vb, size, scale, offsetX, offsetY };
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.width - box.width) < 0.5 && Math.abs(prev.height - box.height) < 0.5
          ? prev
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const toWorld = useCallback((clientX, clientY) => {
    const node = containerRef.current;
    const st = stateRef.current;
    if (!node || !st.scale) return [0, 0];
    const rect = node.getBoundingClientRect();
    return [
      st.vb.x + (clientX - rect.left - st.offsetX) / st.scale,
      st.vb.y + (clientY - rect.top - st.offsetY) / st.scale,
    ];
  }, []);

  const clampView = useCallback(
    (next) => {
      const maxW = fitBox.w * 4;
      const w = Math.min(maxW, Math.max(MIN_VIEW_M, next.w));
      const h = (next.h / next.w) * w;
      return { x: next.x + (next.w - w) / 2, y: next.y + (next.h - h) / 2, w, h };
    },
    [fitBox],
  );

  const zoomAround = useCallback(
    (factor, [px, py]) => {
      setView((prev) => {
        const cur = prev || fitBox;
        const w = cur.w / factor;
        const h = cur.h / factor;
        if (w < MIN_VIEW_M || w > fitBox.w * 4) return cur;
        return { x: px - (px - cur.x) / factor, y: py - (py - cur.y) / factor, w, h };
      });
    },
    [fitBox],
  );

  const zoomBy = useCallback(
    (factor) => {
      const cur = stateRef.current.vb || fitBox;
      zoomAround(factor, [cur.x + cur.w / 2, cur.y + cur.h / 2]);
    },
    [fitBox, zoomAround],
  );

  const fit = useCallback(() => setView(null), []);

  const zoomTo = useCallback(
    (box, { margin = 1.5 } = {}) => {
      if (!box) return;
      const w = Math.max(MIN_VIEW_M, box.maxX - box.minX + margin * 2);
      const h = Math.max(MIN_VIEW_M, box.maxY - box.minY + margin * 2);
      setView(clampView({ x: box.minX - (w - (box.maxX - box.minX)) / 2, y: box.minY - (h - (box.maxY - box.minY)) / 2, w, h }));
    },
    [clampView],
  );

  useImperativeHandle(
    ref,
    () => ({
      toWorld,
      toScreen: (x, y) => {
        const st = stateRef.current;
        return { x: st.offsetX + (x - st.vb.x) * st.scale, y: st.offsetY + (y - st.vb.y) * st.scale };
      },
      fit,
      zoomBy,
      zoomTo,
      getViewCenter: () => {
        const cur = stateRef.current.vb || fitBox;
        return [cur.x + cur.w / 2, cur.y + cur.h / 2];
      },
      getPxPerMetre: () => stateRef.current.scale || 0,
      element: containerRef.current,
    }),
    [toWorld, fit, zoomBy, zoomTo, fitBox],
  );

  // Wheel zoom (non-passive so the page doesn't scroll under the canvas).
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !interactive) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      zoomAround(factor, toWorld(e.clientX, e.clientY));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [interactive, toWorld, zoomAround]);

  const startPan = (e) => {
    const cur = stateRef.current.vb || fitBox;
    panRef.current = { x: e.clientX, y: e.clientY, view: cur, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerDown = (e) => {
    if (interactive && (e.button === 1 || panMode === "always")) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const hit = e.target.closest?.("[data-instance-id]");
    const instance = hit ? objectById.get(hit.getAttribute("data-instance-id")) : null;
    if (instance && onObjectPointerDown) onObjectPointerDown(e, instance);
    else if (!instance && onBackgroundPointerDown) onBackgroundPointerDown(e, toWorld(e.clientX, e.clientY));
    if (e.defaultPrevented || !interactive || panMode === "none") return;
    startPan(e);
  };

  const handlePointerMove = (e) => {
    const pan = panRef.current;
    if (!pan || pan.id !== e.pointerId) return;
    const s = stateRef.current.scale || 1;
    setView({ ...pan.view, x: pan.view.x - (e.clientX - pan.x) / s, y: pan.view.y - (e.clientY - pan.y) / s });
  };

  const endPan = (e) => {
    if (panRef.current?.id === e.pointerId) panRef.current = null;
  };

  const ctx = useMemo(
    () => ({
      plan,
      objects: plan?.objects || [],
      objectById,
      unit,
      pxPerMetre: scale,
      view: vb,
      size,
      toScreen: (x, y) => ({ x: offsetX + (x - vb.x) * scale, y: offsetY + (y - vb.y) * scale }),
      seatsOf: seatPositions,
    }),
    [plan, objectById, unit, scale, vb, size, offsetX, offsetY],
  );

  const gridOn = showGrid ?? interactive;
  const scaleOn = showScale ?? interactive;
  const dimsOn = showDimensions ?? interactive;
  const step = gridM || gridStepFor(unit);
  const roomPoints = room.map(([x, y]) => `${x},${y}`).join(" ");
  const fontM = scale > 0 ? LABEL_PX / scale : 0;
  const clipId = `room-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full select-none overflow-hidden bg-surface-subtle",
        interactive && "touch-none",
        interactive && panMode === "always" && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={ariaLabel || plan?.name || "Floor plan"}
        width="100%"
        height="100%"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points={roomPoints} />
          </clipPath>
        </defs>
        <polygon points={roomPoints} className="fill-background" />
        {gridOn ? (
          <g clipPath={`url(#${clipId})`}>
            <GridLines box={roomBox} step={step} pxPerMetre={scale} />
          </g>
        ) : null}
        <polygon
          points={roomPoints}
          className="pointer-events-none fill-none stroke-foreground/60"
          strokeWidth={2}
          vectorEffect={NSS}
        />
        {dimsOn && fontM > 0 ? (
          <g className="pointer-events-none select-none fill-text-secondary" fontSize={fontM}>
            <text x={(roomBox.minX + roomBox.maxX) / 2} y={roomBox.minY - fontM * 0.9} textAnchor="middle">
              {formatLength(roomBox.maxX - roomBox.minX, unit)}
            </text>
            <text
              transform={`translate(${roomBox.minX - fontM * 0.9} ${(roomBox.minY + roomBox.maxY) / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              {formatLength(roomBox.maxY - roomBox.minY, unit)}
            </text>
          </g>
        ) : null}
        <g className={panMode === "always" ? "pointer-events-none" : undefined}>
          {objects.map((o) => (
            <PlanObject
              key={o.id}
              instance={o}
              selected={selected.has(o.id)}
              flagged={flagged.has(o.id)}
              showChairs={showChairs}
              showLabel={showLabels}
              pxPerMetre={scale}
              interactive={Boolean(onObjectPointerDown)}
            />
          ))}
        </g>
        {overlay ? <g>{overlay(ctx)}</g> : null}
      </svg>

      {scaleOn && scale > 0 ? <ScaleBar pxPerMetre={scale} unit={unit} /> : null}
      {hud ? hud(ctx) : null}

      {interactive ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur"
        >
          <Button type="button" variant="ghost" aria-label="Zoom in" className={ZOOM_BUTTON} onClick={() => zoomBy(1.4)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" aria-label="Zoom out" className={ZOOM_BUTTON} onClick={() => zoomBy(1 / 1.4)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" aria-label="Fit plan to view" className={ZOOM_BUTTON} onClick={fit}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
});

export default PlanRenderer;
