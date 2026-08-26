
import { aspectRatio, rotateUnits } from "./geometry.js";
import { generateSeats } from "./generate.js";

const BOUNDS_PAD = 0.75;

const round4 = (n) => Math.round(n * 10000) / 10000;

const seatKey = (seat) => `${seat?.rowLabel ?? ""}|${seat?.seatLabel ?? ""}`;

function idealised(list, section, aspect) {
  if (!Number(section?.layout?.rows) || !Number(section?.layout?.seatsPerRow)) return null;

  const ideal = new Map();
  for (const seat of generateSeats(section, aspect, { round: false })) {
    const key = seatKey(seat);
    if (ideal.has(key)) return null;
    ideal.set(key, seat);
  }

  const out = [];
  for (const seat of list) {
    const match = ideal.get(seatKey(seat));
    if (!match) return null;
    out.push({ ...seat, x: match.x, y: match.y });
  }
  return out;
}

function meanStep(values, tolerance) {
  const sorted = [...values].sort((a, b) => a - b);
  const distinct = [];
  for (const v of sorted) {
    if (!distinct.length || v - distinct[distinct.length - 1] > tolerance) distinct.push(v);
  }
  if (distinct.length < 2) return 0;
  return (distinct[distinct.length - 1] - distinct[0]) / (distinct.length - 1);
}

export function sectionSeatGrid(seats, section, aspect = 1) {
  const list = seats || [];
  if (!list.length) return { seats: [], rows: [], pitch: 0, frame: null, bounds: null };

  const ar = aspectRatio(aspect);
  const rotation = Number(section?.rotation) || 0;
  const cx = ((Number(section?.x) || 0) + (Number(section?.width) || 0) / 2) * ar;
  const cy = (Number(section?.y) || 0) + (Number(section?.height) || 0) / 2;

  const source = idealised(list, section, aspect) || list;
  const local = source.map((seat) => ({
    seat,
    ...rotateUnits((Number(seat.x) || 0) * ar, Number(seat.y) || 0, cx, cy, -rotation),
  }));

  const xs = local.map((p) => p.x);
  const ys = local.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const tolerance = Math.max(0.03, (maxX - minX + maxY - minY) / 500);

  const pitch = along > 0 && across > 0 ? Math.min(along, across) : along || across || 1;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const place = (x, y) => rotateUnits(x, y, cx, cy, rotation);

  let boundsMinX = Infinity;
  let boundsMaxX = -Infinity;
  let boundsMinY = Infinity;
  let boundsMaxY = -Infinity;

  const placed = local.map(({ seat, x, y }) => {
    const p = place(x, y);
    if (p.x < boundsMinX) boundsMinX = p.x;
    if (p.x > boundsMaxX) boundsMaxX = p.x;
    if (p.y < boundsMinY) boundsMinY = p.y;
    if (p.y > boundsMaxY) boundsMaxY = p.y;
    return { ...seat, gx: round4(p.x / ar), gy: round4(p.y) };
  });

  const firstInRow = new Map();
  for (const p of local) {
    const current = firstInRow.get(p.seat.rowLabel);
    if (!current || p.x < current.x) firstInRow.set(p.seat.rowLabel, { ...p, label: p.seat.rowLabel });
  }
  const rows = [...firstInRow.values()].map((anchor) => {
    const p = rotateUnits(anchor.x - pitch, anchor.y, cx, cy, rotation);
    return { label: anchor.label, x: round4(p.x / ar), y: round4(p.y) };
  });

  const pad = pitch * BOUNDS_PAD;
  const frameW = maxX - minX + pad * 2;
  const frameH = maxY - minY + pad * 2;
  const centre = place(midX, midY);

  return {
    seats: placed,
    rows,
    pitch,
    frame: {
      x: round4((centre.x - frameW / 2) / ar),
      y: round4(centre.y - frameH / 2),
      width: round4(frameW / ar),
      height: round4(frameH),
      rotation: round4(((rotation % 360) + 360) % 360),
    },
    bounds: {
      x: round4((boundsMinX - pad) / ar),
      y: round4(boundsMinY - pad),
      width: round4((boundsMaxX - boundsMinX + pad * 2) / ar),
      height: round4(boundsMaxY - boundsMinY + pad * 2),
    },
  };
}

export default sectionSeatGrid;
