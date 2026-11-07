import { localToWorld } from "./geometry.js";

// Chair layouts: how an object's `seats` turn into physical chair positions — the seat indices Seating Charts assigns guests to.

// none: no seats. integral: the object IS the seating (a chair, a sofa). around: evenly round a round/oval table.
// sides: split along both long sides (optionally one at each end). one_side: all along the +y side (classroom, desks).
export const CHAIR_MODES = ["none", "integral", "around", "sides", "one_side"];

export const CHAIR_MODE_LABELS = {
  none: "No seats",
  integral: "Seats built in",
  around: "Around the table",
  sides: "Both long sides",
  one_side: "One side only",
};

// Modes whose chairs are separate furniture drawn around the object.
export const DRAWN_CHAIR_MODES = new Set(["around", "sides", "one_side"]);

export const CHAIR_WIDTH_M = 0.45;
export const CHAIR_DEPTH_M = 0.45;
// Chair centre sits this far out from the table edge (tucked in slightly).
export const CHAIR_OFFSET_M = 0.25;
// How far a chair ring reaches beyond the table edge.
export const CHAIR_REACH_M = CHAIR_OFFSET_M + CHAIR_DEPTH_M / 2;

export function chairMode(instance) {
  const mode = instance?.chairs?.mode;
  return CHAIR_MODES.includes(mode) ? mode : "none";
}

export const drawsChairs = (instance) =>
  DRAWN_CHAIR_MODES.has(chairMode(instance)) && (Number(instance?.seats) || 0) > 0;

const seatsOf = (instance) => Math.max(0, Math.floor(Number(instance?.seats) || 0));

// Split of `sides` seats: { top, bottom, ends } where ends is 0 or 2.
export function sidesSplit(instance) {
  const n = seatsOf(instance);
  const ends = instance?.chairs?.ends && n >= 4 ? 2 : 0;
  const along = n - ends;
  return { top: Math.ceil(along / 2), bottom: Math.floor(along / 2), ends };
}

const spread = (count, span) =>
  Array.from({ length: count }, (_, i) => -span / 2 + (span * (i + 0.5)) / count);

// Seat positions in the object's LOCAL frame (centre origin, unrotated), clockwise from top-left; `angle` turns an up-facing chair to face the table.
export function chairLocalPositions(instance) {
  const n = seatsOf(instance);
  if (!n) return [];
  const mode = chairMode(instance);
  const w = Number(instance.width_m) || 0;
  const d = Number(instance.depth_m) || 0;
  const out = [];

  if (mode === "around") {
    const rx = w / 2 + CHAIR_OFFSET_M;
    const ry = d / 2 + CHAIR_OFFSET_M;
    for (let i = 0; i < n; i += 1) {
      const phi = -90 + (360 * i) / n;
      const t = (phi * Math.PI) / 180;
      out.push({ x: rx * Math.cos(t), y: ry * Math.sin(t), angle: phi - 90 });
    }
  } else if (mode === "sides") {
    const { top, bottom, ends } = sidesSplit(instance);
    const yTop = -(d / 2 + CHAIR_OFFSET_M);
    const yBottom = d / 2 + CHAIR_OFFSET_M;
    spread(top, w).forEach((x) => out.push({ x, y: yTop, angle: 180 }));
    if (ends) out.push({ x: w / 2 + CHAIR_OFFSET_M, y: 0, angle: -90 });
    spread(bottom, w)
      .reverse()
      .forEach((x) => out.push({ x, y: yBottom, angle: 0 }));
    if (ends) out.push({ x: -(w / 2 + CHAIR_OFFSET_M), y: 0, angle: 90 });
  } else if (mode === "one_side") {
    spread(n, w).forEach((x) => out.push({ x, y: d / 2 + CHAIR_OFFSET_M, angle: 0 }));
  } else if (mode === "integral") {
    spread(n, w).forEach((x) => out.push({ x, y: 0, angle: 0 }));
  }

  return out.map((p, index) => ({ index, ...p }));
}

// Seat positions in plan (world) metres — `{ index, x, y, angle }`; stable index order, the contract Seating Charts keys on.
export function seatPositions(instance) {
  const frame = { x: Number(instance?.x_m) || 0, y: Number(instance?.y_m) || 0, rotation: Number(instance?.rotation) || 0 };
  return chairLocalPositions(instance).map((p) => {
    const [x, y] = localToWorld([p.x, p.y], frame);
    return { index: p.index, x, y, angle: p.angle + frame.rotation };
  });
}

// Local extents of an object, optionally grown to include its drawn chairs: { minX, maxX, minY, maxY } around the centre.
export function localExtents(instance, { withChairs = false } = {}) {
  const w = Math.max(0, Number(instance?.width_m) || 0);
  const d = Math.max(0, Number(instance?.depth_m) || 0);
  const ext = { minX: -w / 2, maxX: w / 2, minY: -d / 2, maxY: d / 2 };
  if (!withChairs || !drawsChairs(instance)) return ext;
  const mode = chairMode(instance);
  const r = CHAIR_REACH_M;
  if (mode === "around") {
    return { minX: ext.minX - r, maxX: ext.maxX + r, minY: ext.minY - r, maxY: ext.maxY + r };
  }
  if (mode === "sides") {
    const { top, bottom, ends } = sidesSplit(instance);
    return {
      minX: ends ? ext.minX - r : ext.minX,
      maxX: ends ? ext.maxX + r : ext.maxX,
      minY: top ? ext.minY - r : ext.minY,
      maxY: bottom ? ext.maxY + r : ext.maxY,
    };
  }
  return { ...ext, maxY: ext.maxY + r };
}
