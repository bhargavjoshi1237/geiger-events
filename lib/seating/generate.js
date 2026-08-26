
import { aspectRatio, canvasUnits, rotateUnits } from "./geometry.js";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function fromAlpha(label) {
  const clean = String(label || "A").toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return 0;
  let n = 0;
  for (const ch of clean) n = n * 26 + (ALPHA.indexOf(ch) + 1);
  return n - 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

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

export function sectionSeatCount(section) {
  if (!section) return 0;
  if (section.kind === "ga") return Math.max(0, Number(section.capacity) || 0);
  const rows = Math.max(0, Number(section.layout?.rows) || 0);
  const perRow = Math.max(0, Number(section.layout?.seatsPerRow) || 0);
  return rows * perRow;
}

export const rotatePoint = rotateUnits;

export function generateSeats(section, aspect = 1, { round = true } = {}) {
  if (!section || section.kind === "ga") return [];

  const layout = section.layout || {};
  const rows = Math.max(0, Number(layout.rows) || 0);
  const perRow = Math.max(0, Number(layout.seatsPerRow) || 0);
  if (rows === 0 || perRow === 0) return [];

  const ar = aspectRatio(aspect);
  const boxX = (Number(section.x) || 0) * ar;
  const boxY = Number(section.y) || 0;
  const boxW = Math.max(0, Number(section.width) || 0) * ar;
  const boxH = Math.max(0, Number(section.height) || 0);

  const rLabels = rowLabels(rows, layout.rowLabels || "alpha", layout.rowLabelStart || "A");
  const sLabels = seatLabels(perRow, layout.numbering || "continental");

  const aisles = Array.isArray(layout.aisleAfter) ? layout.aisleAfter : [];
  const slots = perRow + aisles.length;
  const slotW = boxW / Math.max(1, slots);

  const curve = Math.min(90, Math.max(0, Number(layout.curve) || 0));
  const depth = (curve / 90) * boxH * 0.15;
  const usableH = Math.max(0, boxH - depth);

  const rake = Math.min(100, Math.max(0, Number(layout.rake) || 0)) / 100;
  const weights = [];
  for (let r = 0; r < rows; r += 1) {
    weights.push(1 + rake * (rows === 1 ? 0 : r / (rows - 1)));
  }
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

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

      const u = perRow === 1 ? 0 : (s / (perRow - 1)) * 2 - 1;
      const y = rowY + depth * u * u;

      const cx0 = Math.min(boxX + boxW, Math.max(boxX, x));
      const cy0 = Math.min(boxY + boxH, Math.max(boxY, y));
      const p = rotateUnits(cx0, cy0, cx, cy, rotation);

      seats.push({
        rowLabel: rLabels[r],
        seatLabel: sLabels[s],
        x: fix(p.x / ar),
        y: fix(p.y),
        kind: "standard",
      });
    }
  }
  return seats;
}

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
