
import { aspectRatio, canvasUnits } from "./geometry.js";

export const SEAT_SPAN = 34;
export const SEAT_SPAN_FULL = 22;

const OVERPAN = 0.35;
const MIN_SPAN = 1.5;

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function fitView(aspect, viewAspect) {
  const ar = aspectRatio(aspect);
  const { width, height } = canvasUnits(ar);
  const va = Number(viewAspect) > 0 ? Number(viewAspect) : ar;
  const spanY = Math.max(height, width / va);
  return { cx: width / 2, cy: height / 2, spanY };
}

export function viewWindow(view, viewAspect) {
  const va = Number(viewAspect) > 0 ? Number(viewAspect) : 1;
  const spanY = Math.max(MIN_SPAN, Number(view?.spanY) || MIN_SPAN);
  const spanX = spanY * va;
  const cx = Number(view?.cx) || 0;
  const cy = Number(view?.cy) || 0;
  return {
    xMin: cx - spanX / 2,
    xMax: cx + spanX / 2,
    yMin: cy - spanY / 2,
    yMax: cy + spanY / 2,
    spanX,
    spanY,
  };
}

export function clampView(view, aspect, viewAspect) {
  const ar = aspectRatio(aspect);
  const { width, height } = canvasUnits(ar);
  const fit = fitView(aspect, viewAspect);
  const spanY = clamp(Number(view?.spanY) || fit.spanY, MIN_SPAN, fit.spanY);
  const spanX = spanY * (Number(viewAspect) > 0 ? Number(viewAspect) : 1);

  const padX = spanX * OVERPAN;
  const padY = spanY * OVERPAN;
  const cx =
    spanX >= width ? width / 2 : clamp(Number(view?.cx) || 0, spanX / 2 - padX, width - spanX / 2 + padX);
  const cy =
    spanY >= height ? height / 2 : clamp(Number(view?.cy) || 0, spanY / 2 - padY, height - spanY / 2 + padY);

  return { cx, cy, spanY };
}

export function zoomAt(view, factor, anchor, aspect, viewAspect) {
  const current = viewWindow(view, viewAspect);
  const fit = fitView(aspect, viewAspect);
  const spanY = clamp((Number(view?.spanY) || fit.spanY) / factor, MIN_SPAN, fit.spanY);
  const scale = spanY / current.spanY;
  const ax = Number(anchor?.x);
  const ay = Number(anchor?.y);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) {
    return clampView({ ...view, spanY }, aspect, viewAspect);
  }
  return clampView(
    {
      cx: ax + ((Number(view?.cx) || 0) - ax) * scale,
      cy: ay + ((Number(view?.cy) || 0) - ay) * scale,
      spanY,
    },
    aspect,
    viewAspect,
  );
}

export function seatOpacity(spanY) {
  const span = Number(spanY) || 0;
  if (span >= SEAT_SPAN) return 0;
  if (span <= SEAT_SPAN_FULL) return 1;
  return (SEAT_SPAN - span) / (SEAT_SPAN - SEAT_SPAN_FULL);
}

export function seatsInView(seats = [], window_, aspect = 1, margin = 0.25) {
  if (!window_) return [];
  const ar = aspectRatio(aspect);
  const padX = window_.spanX * margin;
  const padY = window_.spanY * margin;
  const xMin = window_.xMin - padX;
  const xMax = window_.xMax + padX;
  const yMin = window_.yMin - padY;
  const yMax = window_.yMax + padY;

  const out = [];
  for (const seat of seats) {
    const x = (Number(seat.x) || 0) * ar;
    const y = Number(seat.y) || 0;
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) out.push(seat);
  }
  return out;
}

export function measureSeatPitch(seats = [], aspect = 1, sampleSize = 240) {
  const ar = aspectRatio(aspect);
  const points = [];
  for (const seat of seats) {
    points.push({ x: (Number(seat.x) || 0) * ar, y: Number(seat.y) || 0 });
  }
  if (points.length < 2) return 1.2;

  const step = Math.max(1, Math.floor(points.length / sampleSize));
  const gaps = [];
  for (let i = 0; i < points.length; i += step) {
    const a = points[i];
    let nearest = Infinity;
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      const b = points[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && d < nearest) nearest = d;
    }
    if (Number.isFinite(nearest)) gaps.push(nearest);
  }
  if (!gaps.length) return 1.2;

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return median > 0 ? median : 1.2;
}

export function frameSeats(seats = [], aspect = 1, pitch = 1.2) {
  const ar = aspectRatio(aspect);
  if (!seats.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const seat of seats) {
    const x = (Number(seat.x) || 0) * ar;
    const y = Number(seat.y) || 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = Math.max(pitch * 6, 4);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    spanY: Math.max(MIN_SPAN, maxY - minY + pad * 2),
  };
}

export { MIN_SPAN, OVERPAN };
