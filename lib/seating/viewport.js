// The window onto a venue: what slice of the map is on screen, and how much
// detail that slice has earned.
//
// The canvas draws in UNITS (see geometry.js) — 1 unit = 1% of the map's height
// on both axes — so a window is square-true only while its own aspect matches
// the pixels it is painted into. Everything here keeps that invariant, which is
// why a window is stored as a CENTRE plus a VERTICAL SPAN rather than as four
// edges: the horizontal span is derived from the viewport, so it cannot drift.
//
// Detail is decided by the span, not by which section someone clicked. Zoom far
// enough in and the chairs appear wherever you happen to be looking; zoom out
// and they go away again. That is what replaces the old drill-in/drill-out mode
// and its "Whole venue" button.
//
// Pure: no DOM, no ECharts, no React.

import { aspectRatio, canvasUnits } from "./geometry.js";

// Vertical span, in units, at which individual chairs start to be worth drawing.
// The map is 100 units tall, so this is "about a third of the venue on screen".
export const SEAT_SPAN = 34;
// …and the span by which they have finished fading in. Between the two they
// ramp, so chairs arrive rather than popping.
export const SEAT_SPAN_FULL = 22;

// How far past the venue edges the buyer may drag, as a share of the span. A
// little overscroll lets a corner section reach the middle of the screen.
const OVERPAN = 0.35;
// Tightest and loosest the view may get, in units of vertical span.
const MIN_SPAN = 1.5;

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// The whole venue, letterboxed into a viewport of `viewAspect` (width/height).
export function fitView(aspect, viewAspect) {
  const ar = aspectRatio(aspect);
  const { width, height } = canvasUnits(ar);
  const va = Number(viewAspect) > 0 ? Number(viewAspect) : ar;
  // Show the whole map on both axes: take the span that covers the tighter fit.
  const spanY = Math.max(height, width / va);
  return { cx: width / 2, cy: height / 2, spanY };
}

// A view -> the axis window to draw it in. The horizontal span is ALWAYS
// derived, so squares stay square whatever shape the dialog is.
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

// Keep the view over the venue: never tighter than MIN_SPAN, never looser than
// the whole map with room to breathe, and never panned so far that the venue
// leaves the screen.
export function clampView(view, aspect, viewAspect) {
  const ar = aspectRatio(aspect);
  const { width, height } = canvasUnits(ar);
  const fit = fitView(aspect, viewAspect);
  const spanY = clamp(Number(view?.spanY) || fit.spanY, MIN_SPAN, fit.spanY);
  const spanX = spanY * (Number(viewAspect) > 0 ? Number(viewAspect) : 1);

  // Once the venue is smaller than the window on an axis, pin it to the middle
  // rather than letting it drift around inside the empty space.
  const padX = spanX * OVERPAN;
  const padY = spanY * OVERPAN;
  const cx =
    spanX >= width ? width / 2 : clamp(Number(view?.cx) || 0, spanX / 2 - padX, width - spanX / 2 + padX);
  const cy =
    spanY >= height ? height / 2 : clamp(Number(view?.cy) || 0, spanY / 2 - padY, height - spanY / 2 + padY);

  return { cx, cy, spanY };
}

// Zoom about a fixed point — the pointer, so the map grows under the cursor
// rather than under its own centre.
export function zoomAt(view, factor, anchor, aspect, viewAspect) {
  const current = viewWindow(view, viewAspect);
  const fit = fitView(aspect, viewAspect);
  const spanY = clamp((Number(view?.spanY) || fit.spanY) / factor, MIN_SPAN, fit.spanY);
  const scale = spanY / current.spanY;
  // The anchor keeps its place: move the centre toward it by however much the
  // window shrank around it.
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

// How present the chairs are at this span: 0 hidden, 1 fully drawn. Ramping
// rather than switching is what stops a whole section appearing between two
// frames of a scroll.
export function seatOpacity(spanY) {
  const span = Number(spanY) || 0;
  if (span >= SEAT_SPAN) return 0;
  if (span <= SEAT_SPAN_FULL) return 1;
  return (SEAT_SPAN - span) / (SEAT_SPAN - SEAT_SPAN_FULL);
}

// The seats actually worth handing to the renderer: the ones inside the window,
// plus a margin so panning doesn't reveal a hard edge of nothing.
//
// This is the whole performance strategy. Bounding by VIEWPORT rather than by
// section keeps the element count flat no matter how big the venue, so the
// renderer is never asked to draw twenty thousand of anything.
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

// The typical gap between neighbouring chairs, in units — how big a chair may
// be drawn without the block closing up into one slab.
//
// Measured rather than assumed: an arena and a studio theatre disagree by an
// order of magnitude, and a renderer that guesses gets one of them wrong. Taken
// as the MEDIAN nearest-neighbour distance over a sample, so a handful of
// outlying chairs (an accessible bay, a stray import) can't set the scale for
// the whole venue.
export function measureSeatPitch(seats = [], aspect = 1, sampleSize = 240) {
  const ar = aspectRatio(aspect);
  const points = [];
  for (const seat of seats) {
    points.push({ x: (Number(seat.x) || 0) * ar, y: Number(seat.y) || 0 });
  }
  if (points.length < 2) return 1.2;

  // Even stride through the list rather than the first N, so one dense section
  // at the top of the array doesn't speak for the venue.
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

// A view that frames a set of seats with room to breathe around them.
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
  // Enough context around the block to see which way it faces the field.
  const pad = Math.max(pitch * 6, 4);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    spanY: Math.max(MIN_SPAN, maxY - minY + pad * 2),
  };
}

export { MIN_SPAN, OVERPAN };
