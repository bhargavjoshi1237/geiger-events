import { aabbIntersects, aabbOf, polygonInsidePolygon, polygonsOverlap, rectPolygon, rotatePoint } from "./geometry.js";
import { CHAIR_REACH_M } from "./chairs.js";
import { footprintPolygon } from "./footprint.js";
import { createInstance } from "./catalog.js";
import { STANDARD_CATALOG } from "./standard_catalog.js";
import { normaliseSetupStyle, roomAabb, roomPolygon } from "./plan.js";
import {
  BOARDROOM_MAX_LENGTH_M,
  estimateCapacity,
  exitZone,
  isDoor,
  isFeature,
  normalisePlanningRules,
  PERIMETER_MAX_RUN_M,
} from "./capacity.js";

// Auto layout: fills a room with a setup style (theatre rows, classroom rows, rounds, boardroom, U, hollow square,
// cocktail tables) around kept fixtures, exit clear zones, a stage and bars — the generated objects are ordinary instances.

// Catalog keys offered per style; the first is the default.
export const LAYOUT_TABLES = {
  theatre: ["chair-theatre", "chair-banquet"],
  classroom: ["classroom-6ft", "classroom-8ft"],
  banquet: ["round-60", "round-72", "round-48", "banquet-8ft", "banquet-6ft"],
  cabaret: ["round-60", "round-72", "round-48"],
  reception: ["cocktail-30"],
  boardroom: ["boardroom-12ft"],
  u_shape: ["banquet-6ft", "classroom-6ft"],
  hollow_square: ["banquet-6ft", "classroom-6ft"],
};

export const LAYOUT_FRONTS = [
  { value: "top", label: "Top wall" },
  { value: "bottom", label: "Bottom wall" },
  { value: "left", label: "Left wall" },
  { value: "right", label: "Right wall" },
];

// Which optional features each style can add.
export const LAYOUT_FEATURES = {
  theatre: ["stage"],
  classroom: ["stage"],
  banquet: ["stage", "danceFloor", "bar"],
  cabaret: ["stage", "danceFloor", "bar"],
  reception: ["bar"],
  boardroom: [],
  u_shape: [],
  hollow_square: [],
};

export const RECEPTION_GUESTS_PER_TABLE = 8;
// A cabaret round seats about two thirds of its banquet count, leaving the stage side open.
export const cabaretSeats = (seats) => Math.max(3, Math.round((Number(seats) || 0) * 0.65));
const RUN_BREAK_TABLES = 5;
const THETA = { top: 0, right: 90, bottom: 180, left: 270 };

function catalogLookup(catalog) {
  const list = Array.isArray(catalog) && catalog.length ? catalog : STANDARD_CATALOG;
  return (key) => list.find((o) => o.key === key && !o.projectId) || STANDARD_CATALOG.find((o) => o.key === key) || null;
}

// Local layout frame: x across the front wall, y away from it (front at y = 0) → world metres + rotation.
function frameFor(room, front) {
  const box = roomAabb(room);
  const W = box.maxX - box.minX;
  const L = box.maxY - box.minY;
  const theta = THETA[front] ?? 0;
  const shift = { 0: [0, 0], 90: [W, 0], 180: [W, L], 270: [0, L] }[theta];
  const sideways = theta === 90 || theta === 270;
  return {
    theta,
    across: sideways ? L : W,
    depth: sideways ? W : L,
    toWorld: ([x, y]) => {
      const [rx, ry] = rotatePoint([x, y], theta);
      return [box.minX + rx + shift[0], box.minY + ry + shift[1]];
    },
  };
}

// Builds the layout: `room` is plan-like (dimensions, outline, objects); returns the full objects list plus what was made.
export function generateLayout(room, style, options = {}) {
  const s = normaliseSetupStyle(style);
  const r = normalisePlanningRules(options.rules);
  const lookup = catalogLookup(options.catalog);
  const target = Math.max(0, Math.floor(Number(options.attendees) || 0));
  const keepMode = options.keep === "features" ? "features" : "fixtures";
  const existing = room?.objects || [];
  const kept = existing.filter((o) => o.category === "structure" || (keepMode === "features" && isFeature(o)));
  const notes = [];
  const result = (generated, extra = {}) => {
    const seats = generated.reduce((n, o) => n + (Number(o.seats) || 0), 0);
    const tables = generated.filter((o) => o.category === "tables" && o.seats > 0).length;
    const people = s === "reception" ? (extra.guests ?? 0) : seats;
    if (target && people < target && !notes.some((n) => n.startsWith("Capped"))) {
      notes.push(`Only ${people} fit — ${target - people} short of ${target}.`);
    }
    return { style: s, objects: [...kept, ...generated], generated, seats, tables, guests: people, target, notes, ...extra };
  };
  if (s === "custom") {
    notes.push("Pick a named setup style to generate a layout.");
    return result([]);
  }

  const frame = frameFor(room, options.front);
  const W = frame.across;
  const D = frame.depth;
  const roomPoly = roomPolygon(room);
  const blocked = [];
  const block = (poly) => blocked.push({ poly, box: aabbOf(poly) });
  const localRect = (minX, minY, maxX, maxY) => rectPolygon(minX, minY, maxX, maxY).map(frame.toWorld);
  const growPoly = (o, by) => {
    const b = aabbOf(footprintPolygon(o));
    return rectPolygon(b.minX - by, b.minY - by, b.maxX + by, b.maxY + by);
  };

  for (const o of kept) {
    if (isDoor(o)) block(exitZone(o, r.exitClearanceM));
    else if (o.category === "structure") block(growPoly(o, 0.3));
    else block(growPoly(o, o.symbol === "dance" ? 0.3 : Math.max(r.mainAisleM, r.featureClearanceM)));
  }

  const fits = (inst) => {
    const fp = footprintPolygon(inst, { withChairs: true });
    if (!polygonInsidePolygon(fp, roomPoly, 0.01)) return false;
    const box = aabbOf(fp);
    return !blocked.some((b) => aabbIntersects(b.box, box, 0.005) && polygonsOverlap(b.poly, fp, 0.005));
  };

  const place = (key, x, y, rot = 0, patch = {}) => {
    const obj = lookup(key);
    if (!obj) return null;
    const [wx, wy] = frame.toWorld([x, y]);
    return { ...createInstance(obj, { x: wx, y: wy, rotation: rot + frame.theta }), ...patch };
  };

  const features = [];
  // Kept features win over new ones of the same kind (no second stage on top of the one being kept).
  const keptHas = { stage: kept.some((o) => o.category === "staging"), bar: kept.some((o) => o.category === "bars_catering"), danceFloor: kept.some((o) => o.symbol === "dance") };
  const want = new Set((LAYOUT_FEATURES[s] || []).filter((f) => options[f] && !keptHas[f]));
  const serviceGap = Math.max(r.mainAisleM, r.featureClearanceM);

  // Stage: 8×8 ft risers centred on the front wall.
  let stageDepth = 0;
  if (want.has("stage")) {
    const riser = lookup("stage-8x8");
    const n = Math.max(1, Math.min(4, Math.floor(Math.min(W * 0.45, 9.8) / riser.widthM)));
    const sw = n * riser.widthM;
    for (let i = 0; i < n; i += 1) {
      features.push(place("stage-8x8", W / 2 - sw / 2 + riser.widthM * (i + 0.5), 0.05 + riser.depthM / 2));
    }
    stageDepth = 0.05 + riser.depthM;
    block(localRect(W / 2 - sw / 2 - serviceGap, 0, W / 2 + sw / 2 + serviceGap, stageDepth + serviceGap));
  }
  const frontY = stageDepth + r.frontZoneM;

  // Bars on the back wall (two in a wide room hosting a crowd).
  if (want.has("bar")) {
    const bar = lookup("bar-straight");
    const count = W > 12 && target > 150 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const x = count === 1 ? W / 2 : (W * (i + 1)) / 3;
      const y = D - 0.05 - bar.depthM / 2;
      features.push(place("bar-straight", x, y, 180));
      block(localRect(x - bar.widthM / 2 - serviceGap, y - bar.depthM / 2 - serviceGap, x + bar.widthM / 2 + serviceGap, D));
    }
  }

  // Dance floor just past the front zone, centred.
  let tablesFrontY = s === "banquet" || s === "cabaret" ? (stageDepth ? frontY : r.tableClearanceM) : frontY;
  if (want.has("danceFloor")) {
    const floor = lookup("dance-floor-12ft");
    const y = Math.max(frontY, r.tableClearanceM) + floor.depthM / 2;
    features.push(place("dance-floor-12ft", W / 2, y));
    block(localRect(W / 2 - floor.widthM / 2 - 0.3, y - floor.depthM / 2 - 0.3, W / 2 + floor.widthM / 2 + 0.3, y + floor.depthM / 2 + 0.3));
    tablesFrontY = Math.min(tablesFrontY, y - floor.depthM / 2);
  }

  // Slides a fixed group of pieces (boardroom table, U, hollow square) off the centre until every piece is clear.
  const settle = (pieces) => {
    const shift = (dx, dy) => pieces.map((p) => {
      const [x0, y0] = frame.toWorld([0, 0]);
      const [x1, y1] = frame.toWorld([dx, dy]);
      return { ...p, x_m: p.x_m + x1 - x0, y_m: p.y_m + y1 - y0 };
    });
    for (let ring = 0; ring <= 12; ring += 1) {
      for (let i = -ring; i <= ring; i += 1) {
        for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
          const moved = shift(dx * 0.5, dy * 0.5);
          if (moved.every(fits)) return moved;
        }
      }
    }
    return null;
  };

  const placedFeatures = features.filter(Boolean).filter((f) => polygonInsidePolygon(footprintPolygon(f), roomPoly, 0.01));
  if (placedFeatures.length < features.filter(Boolean).length) notes.push("Some features didn't fit the room and were left out.");

  // Row and table styles never exceed what the planning rules allow for this room (the editor would flag it).
  const ruleCap = ["theatre", "classroom", "banquet", "cabaret"].includes(s)
    ? estimateCapacity({ ...room, objects: [...kept, ...placedFeatures] }, s, r).estimate
    : 0;
  const limit = ruleCap ? (target ? Math.min(target, ruleCap) : ruleCap) : target;
  if (ruleCap && target > ruleCap) notes.push(`Capped at ${ruleCap} — the most the planning rules allow in this room.`);

  // Candidates arrive in preference order; take them until the limit is met, then number tables in reading order.
  const take = (candidates, seatsOf = (c) => c.seats) => {
    const out = [];
    let count = 0;
    for (const c of candidates) {
      if (limit && count >= limit) break;
      if (!fits(c.inst)) continue;
      out.push(c);
      count += seatsOf(c);
    }
    return out;
  };
  const numberTables = (list) => {
    let n = 0;
    return [...list]
      .sort((a, b) => a.row - b.row || a.x - b.x)
      .map((c) => (c.inst.category === "tables" && c.inst.seats > 0 ? { ...c.inst, label: String((n += 1)) } : c.inst));
  };
  const centreOut = (a, b) => a.row - b.row || Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2);

  // Blocks of `count` items `width` wide between aisles, centred: x centres of every item in a row.
  const rowSlots = (width, maxPerBlock) => {
    const aisle = r.mainAisleM;
    const usable = W - 2 * aisle;
    if (usable < width) return [];
    const total = Math.floor(usable / width);
    let b = total > maxPerBlock ? 2 : 1;
    let per = Math.floor((usable - (b - 1) * aisle) / (b * width));
    while (per > maxPerBlock) {
      b += 1;
      per = Math.floor((usable - (b - 1) * aisle) / (b * width));
    }
    if (per < 1) return [];
    const rowWidth = b * per * width + (b - 1) * aisle;
    const x0 = (W - rowWidth) / 2;
    const xs = [];
    for (let k = 0; k < b; k += 1) {
      for (let i = 0; i < per; i += 1) xs.push(x0 + k * (per * width + aisle) + (i + 0.5) * width);
    }
    return xs;
  };

  // Staggered (hex) grid of round footprints `reach` in radius, `pitch` centre to centre.
  const hexSlots = (reach, pitch, margin, startY) => {
    const xMin = margin + reach;
    const xMax = W - margin - reach;
    if (xMax < xMin) return [];
    const n = Math.floor((xMax - xMin) / pitch) + 1;
    const start = (W - (n - 1) * pitch) / 2;
    const out = [];
    const step = (pitch * Math.sqrt(3)) / 2;
    for (let row = 0, y = startY + reach; y <= D - margin - reach + 1e-9; row += 1, y += step) {
      const offset = row % 2 ? pitch / 2 : 0;
      for (let x = start + offset - (offset ? pitch : 0); x <= xMax + 1e-9; x += pitch) {
        if (x >= xMin - 1e-9) out.push({ x, y, row });
      }
    }
    return out;
  };

  let generated = [];
  let extra = {};

  if (s === "theatre" || s === "classroom") {
    const theatre = s === "theatre";
    const key = LAYOUT_TABLES[s].includes(options.tableKey) ? options.tableKey : LAYOUT_TABLES[s][0];
    const item = lookup(key);
    const width = item.widthM;
    const depth = item.depthM;
    const perItem = Math.max(1, item.seats);
    const xs = rowSlots(width, Math.max(1, Math.floor(r.maxSeatsPerRow / perItem)));
    const pitch = theatre ? Math.max(r.rowSpacingM, depth + 0.3) : depth + CHAIR_REACH_M + r.tableClearanceM;
    const back = theatre ? depth / 2 : depth / 2 + CHAIR_REACH_M;
    const candidates = [];
    for (let row = 0, y = frontY + depth / 2; y + back <= D - r.mainAisleM + 1e-9; row += 1, y += pitch) {
      for (const x of xs) candidates.push({ x, y, row, seats: perItem, inst: place(key, x, y) });
    }
    candidates.sort(centreOut);
    generated = numberTables(take(candidates));
  } else if (s === "banquet" || s === "cabaret") {
    const key = LAYOUT_TABLES[s].includes(options.tableKey) ? options.tableKey : LAYOUT_TABLES[s][0];
    const table = lookup(key);
    const margin = r.tableClearanceM;
    let candidates = [];
    if (table.shape === "round") {
      const seats = s === "cabaret" ? cabaretSeats(table.seats) : table.seats;
      const reach = table.widthM / 2 + CHAIR_REACH_M;
      const pitch = 2 * reach + r.tableClearanceM;
      candidates = hexSlots(reach, pitch, margin, tablesFrontY).map((c) => ({
        ...c,
        seats,
        inst: place(key, c.x, c.y, 0, { seats }),
      }));
    } else {
      // Long tables end to end in runs that point at the front, with a cross aisle every few tables.
      const across = table.depthM + 2 * CHAIR_REACH_M;
      const runPitch = across + r.tableClearanceM;
      const n = Math.floor((W - 2 * margin - across) / runPitch) + 1;
      const start = (W - (n - 1) * runPitch) / 2;
      for (let i = 0; i < n; i += 1) {
        const x = start + i * runPitch;
        let y = tablesFrontY + table.widthM / 2;
        for (let k = 0, row = 0; y + table.widthM / 2 <= D - margin + 1e-9; k += 1, row += 1) {
          candidates.push({ x, y, row, seats: table.seats, inst: place(key, x, y, 90) });
          y += table.widthM + ((k + 1) % RUN_BREAK_TABLES === 0 ? r.mainAisleM : 0);
        }
      }
    }
    candidates.sort(centreOut);
    generated = numberTables(take(candidates));
  } else if (s === "reception") {
    const table = lookup("cocktail-30");
    const area = RECEPTION_GUESTS_PER_TABLE * r.areaPerPerson.reception;
    const pitch = Math.max(table.widthM + 1.5, Math.sqrt(area));
    const reach = table.widthM / 2;
    const candidates = hexSlots(reach, pitch, r.mainAisleM, r.mainAisleM).map((c) => ({
      ...c,
      inst: place("cocktail-30", c.x, c.y),
    }));
    candidates.sort(centreOut);
    // Standing headcount comes from the area rules; one highboy per few guests.
    const standing = estimateCapacity({ ...room, objects: [...kept, ...placedFeatures] }, "reception", r).estimate;
    const guests = target ? Math.min(target, standing) : standing;
    const tablesWanted = Math.ceil(guests / RECEPTION_GUESTS_PER_TABLE);
    generated = candidates.filter((c) => fits(c.inst)).slice(0, tablesWanted).map((c) => c.inst);
    extra = { guests };
  } else if (s === "boardroom") {
    const p = r.seatPitchM;
    const alongX = W >= D;
    const long = Math.min((alongX ? W : D) - 2 * r.perimeterSetbackM, BOARDROOM_MAX_LENGTH_M);
    let perSide = Math.floor(long / p);
    if (target) perSide = Math.min(perSide, Math.max(1, Math.ceil(Math.max(0, target - 2) / 2)));
    if (perSide >= 1) {
      const seats = 2 * perSide + 2;
      const inst = place("boardroom-12ft", W / 2, D / 2, alongX ? 0 : 90, {
        width_m: Math.max(perSide * p, 1.8),
        seats,
        chairs: { mode: "sides", ends: true },
        label: "1",
      });
      const clear = settle([inst]);
      if (!clear) notes.push("The table runs into a fixture or exit zone — nudge it in the editor.");
      generated = clear || [inst];
    }
  } else if (s === "u_shape" || s === "hollow_square") {
    const key = LAYOUT_TABLES[s].includes(options.tableKey) ? options.tableKey : LAYOUT_TABLES[s][0];
    const t = lookup(key).depthM;
    const p = r.seatPitchM;
    const setback = r.perimeterSetbackM;
    const oneSide = { mode: "one_side" };
    const piece = (x, y, rot, length, seats, label) =>
      place(key, x, y, rot, { width_m: length, seats, chairs: oneSide, label });
    if (s === "u_shape") {
      const top = stageDepth + r.frontZoneM;
      let b = Math.floor(Math.min(W - 2 * setback, PERIMETER_MAX_RUN_M) / p);
      let a = Math.floor((Math.min(D - setback - top, PERIMETER_MAX_RUN_M) - t) / p);
      const innerOk = (bb) => bb * p - 2 * t >= 1.5;
      while (target && b + 2 * a > target) {
        if (a > 1 && b + 2 * (a - 1) >= target && 2 * a >= b) a -= 1;
        else if (innerOk(b - 1) && b - 1 + 2 * a >= target) b -= 1;
        else if (a > 1 && b + 2 * (a - 1) >= target) a -= 1;
        else break;
      }
      if (a >= 1 && innerOk(b)) {
        const B = b * p;
        const x0 = W / 2 - B / 2;
        const armLen = a * p;
        generated = [
          piece(W / 2, top + armLen + t / 2, 0, B, b, "Head"),
          piece(x0 + t / 2, top + armLen / 2, 90, armLen, a, "Left"),
          piece(x0 + B - t / 2, top + armLen / 2, 270, armLen, a, "Right"),
        ];
      }
    } else {
      let a = Math.floor(Math.min(W - 2 * setback, PERIMETER_MAX_RUN_M) / p);
      let v = Math.floor((Math.min(D - 2 * setback, PERIMETER_MAX_RUN_M) - 2 * t) / p);
      const innerOk = (n) => n * p - 2 * t >= 1.5;
      while (target && 2 * a + 2 * v > target) {
        if (v > 1 && 2 * a + 2 * (v - 1) >= target && v >= a) v -= 1;
        else if (innerOk(a - 1) && 2 * (a - 1) + 2 * v >= target) a -= 1;
        else if (v > 1 && 2 * a + 2 * (v - 1) >= target) v -= 1;
        else break;
      }
      if (v >= 1 && innerOk(a) && v * p >= 1.5) {
        const B = a * p;
        const V = v * p;
        const cx = W / 2;
        const cy = D / 2;
        generated = [
          piece(cx, cy - V / 2 - t / 2, 180, B, a, "Head"),
          piece(cx + B / 2 - t / 2, cy, 270, V, v, "Right"),
          piece(cx, cy + V / 2 + t / 2, 0, B, a, "Foot"),
          piece(cx - B / 2 + t / 2, cy, 90, V, v, "Left"),
        ];
      }
    }
    if (generated.length) {
      const clear = settle(generated);
      if (clear) generated = clear;
      else notes.push("Part of the layout runs into a fixture or exit zone — adjust it in the editor.");
    }
  }

  if (!generated.length) notes.push("Nothing fits — the room is too small for this style with the current clearances.");
  return result([...placedFeatures, ...generated.filter(Boolean)], extra);
}
