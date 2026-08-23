// Pure seat geometry. Turns a section's layout parameters into concrete seats
// with percent-of-canvas coordinates — venue exports essentially never carry
// coordinates, so every position in the app is computed here. No DB, no React.
//
// Everything is laid out in UNIT space (see geometry.js) and converted back to
// percent on the way out, because the canvas isn't square: rotating percent
// coordinates directly would shear a turned section away from the CSS-rotated
// block it belongs to.

import { aspectRatio, canvasUnits, rotateUnits } from "./geometry.js";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 0 -> A, 25 -> Z, 26 -> AA (spreadsheet-style, so rows never run out).
function toAlpha(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = ALPHA[rem] + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// "A" -> 0, "AA" -> 26. Unknown characters are ignored so a stray label degrades
// to row A rather than producing NaN positions.
function fromAlpha(label) {
  const clean = String(label || "A").toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return 0;
  let n = 0;
  for (const ch of clean) n = n * 26 + (ALPHA.indexOf(ch) + 1);
  return n - 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Row labels down a section: "alpha" (A, B, … Z, AA) or "numeric" (1, 2, 3).
export function rowLabels(count, scheme = "alpha", start = "A") {
  const total = Math.max(0, Number(count) || 0);
  const out = [];
  if (scheme === "numeric") {
    const first = Number.parseInt(start, 10) || 1;
    for (let i = 0; i < total; i += 1) out.push(String(first + i));
    return out;
  }
  const first = fromAlpha(start);
  for (let i = 0; i < total; i += 1) out.push(toAlpha(first + i));
  return out;
}

// Seat labels across a row.
//   continental — straight 1..N left to right
//   odd-even    — odds house-left descending, evens house-right ascending,
//                 i.e. numbering counts outward from the centre aisle
export function seatLabels(count, numbering = "continental") {
  const total = Math.max(0, Number(count) || 0);
  const out = [];
  if (numbering !== "odd-even") {
    for (let i = 0; i < total; i += 1) out.push(String(i + 1));
    return out;
  }
  const left = Math.ceil(total / 2);
  const right = total - left;
  for (let i = left; i >= 1; i -= 1) out.push(String(i * 2 - 1));
  for (let i = 1; i <= right; i += 1) out.push(String(i * 2));
  return out;
}

// How many chairs a section holds. GA zones carry a plain capacity and generate
// no chairs at all — they stay on the counter-based inventory path.
export function sectionSeatCount(section) {
  if (!section) return 0;
  if (section.kind === "ga") return Math.max(0, Number(section.capacity) || 0);
  const rows = Math.max(0, Number(section.layout?.rows) || 0);
  const perRow = Math.max(0, Number(section.layout?.seatsPerRow) || 0);
  return rows * perRow;
}

// Rotate a point about a centre by `deg`. Bowl sections on the sides and ends
// are rotated to face the field, and their chairs have to travel with them —
// the block's CSS transform doesn't move the stored coordinates. Re-exported
// from geometry.js so callers keep one import for seat maths.
export const rotatePoint = rotateUnits;

// Lay a section's chairs out inside its box. Rows run front (nearest the field)
// to back; `curve` bows each row's ends away from the field, `rake` widens the
// gap between successive rows, and `aisleAfter` inserts empty slots without
// renumbering the seats around them. Coordinates stay inside the box until the
// section's rotation is applied, which by design carries them outside it.
//
// `aspect` is the map's canvas shape ("16/10" or a ratio). Pass it whenever the
// section can be rotated — without it a turned section's chairs land on a
// sheared grid that doesn't match the block the buyer clicked.
//
// Coordinates come back rounded to the 2dp the seats table stores. Callers that
// only DRAW the lattice (rather than persisting it) pass `round: false`: the
// drill-down magnifies the map up to 40x, and at that zoom a hundredth of a
// percent is a visible wobble.
export function generateSeats(section, aspect = 1, { round = true } = {}) {
  if (!section || section.kind === "ga") return [];

  const layout = section.layout || {};
  const rows = Math.max(0, Number(layout.rows) || 0);
  const perRow = Math.max(0, Number(layout.seatsPerRow) || 0);
  if (rows === 0 || perRow === 0) return [];

  // Unit space: x scaled by the aspect so a rotation here is the rotation CSS
  // draws on the block.
  const ar = aspectRatio(aspect);
  const boxX = (Number(section.x) || 0) * ar;
  const boxY = Number(section.y) || 0;
  const boxW = Math.max(0, Number(section.width) || 0) * ar;
  const boxH = Math.max(0, Number(section.height) || 0);

  const rLabels = rowLabels(rows, layout.rowLabels || "alpha", layout.rowLabelStart || "A");
  const sLabels = seatLabels(perRow, layout.numbering || "continental");

  // Aisles consume horizontal slots so the chairs either side spread apart.
  const aisles = Array.isArray(layout.aisleAfter) ? layout.aisleAfter : [];
  const slots = perRow + aisles.length;
  const slotW = boxW / Math.max(1, slots);

  // Reserve vertical room for the bow so curved rows can't escape the box.
  const curve = Math.min(90, Math.max(0, Number(layout.curve) || 0));
  const depth = (curve / 90) * boxH * 0.15;
  const usableH = Math.max(0, boxH - depth);

  // Rake spreads later rows further apart; weights are normalised so the rows
  // always fill exactly the usable height regardless of the rake value.
  const rake = Math.min(100, Math.max(0, Number(layout.rake) || 0)) / 100;
  const weights = [];
  for (let r = 0; r < rows; r += 1) {
    weights.push(1 + rake * (rows === 1 ? 0 : r / (rows - 1)));
  }
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

  // Rotation happens last, about the box centre, so the layout maths above
  // stays in comfortable axis-aligned space.
  const rotation = Number(section.rotation) || 0;
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;

  const fix = round ? round2 : (n) => n;

  const seats = [];
  let consumed = 0;
  for (let r = 0; r < rows; r += 1) {
    const band = (weights[r] / weightTotal) * usableH;
    const rowY = boxY + consumed + band / 2;
    consumed += band;

    for (let s = 0; s < perRow; s += 1) {
      const before = aisles.filter((a) => Number(a) <= s).length;
      const x = boxX + slotW * (s + before + 0.5);

      // Parabolic bow: centre seats sit closest to the stage.
      const u = perRow === 1 ? 0 : (s / (perRow - 1)) * 2 - 1;
      const y = rowY + depth * u * u;

      // Clamp inside the box first, then rotate — clamping after rotation would
      // crush a rotated section's chairs back into an axis-aligned rectangle.
      const cx0 = Math.min(boxX + boxW, Math.max(boxX, x));
      const cy0 = Math.min(boxY + boxH, Math.max(boxY, y));
      const p = rotateUnits(cx0, cy0, cx, cy, rotation);

      seats.push({
        rowLabel: rLabels[r],
        seatLabel: sLabels[s],
        // Back to percent-of-canvas, the space the seats table stores.
        x: fix(p.x / ar),
        y: fix(p.y),
        kind: "standard",
      });
    }
  }
  return seats;
}

// Lay a single section's chairs out for the DRILL-DOWN view — the screen a
// buyer gets after clicking a block, where that one section fills the canvas.
//
// Two corrections the naive version skipped, both of which mattered:
//
//  - UN-ROTATE. A bowl section is turned to face the field, so its stored
//    chairs form a tilted rectangle. Stretching that tilt's bounding box to
//    fill the view sheared the grid into a diamond and the rows stopped
//    reading as rows. Turning it back by the section's own rotation restores a
//    straight grid with row A at the top, which is what "toward the front"
//    promises the buyer.
//  - SCALE UNIFORMLY. Fitting x and y independently squashed seat spacing
//    differently on each axis, so a wide shallow section came out as a grid of
//    stretched, unevenly-spaced dots. One factor for both axes keeps the real
//    proportions.
//
// Returns the seats with `nx`/`ny` added: percent-of-canvas in the DRILL-DOWN
// canvas's own space (`targetAspect`), ready to render.
export function layoutSectionSeats(
  seats,
  section,
  mapAspect = 1,
  { targetAspect = "16/9", fillX = 0.86, fillY = 0.78 } = {},
) {
  const list = seats || [];
  if (!list.length) return [];

  const ar = aspectRatio(mapAspect);
  const target = aspectRatio(targetAspect);
  const view = canvasUnits(target);

  const rotation = -(Number(section?.rotation) || 0);
  const cx = ((Number(section?.x) || 0) + (Number(section?.width) || 0) / 2) * ar;
  const cy = (Number(section?.y) || 0) + (Number(section?.height) || 0) / 2;

  // Percent -> units -> un-rotated units.
  const flat = list.map((seat) => ({
    seat,
    ...rotateUnits((Number(seat.x) || 0) * ar, Number(seat.y) || 0, cx, cy, rotation),
  }));

  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;

  const boxW = view.width * fillX;
  const boxH = view.height * fillY;
  const scale = Math.min(spanX ? boxW / spanX : boxW, spanY ? boxH / spanY : boxH);
  const offsetX = (view.width - spanX * scale) / 2;
  const offsetY = (view.height - spanY * scale) / 2;

  return flat.map(({ seat, x, y }) => ({
    ...seat,
    nx: round2((offsetX + (x - minX) * scale) / target),
    ny: round2(offsetY + (y - minY) * scale),
  }));
}
