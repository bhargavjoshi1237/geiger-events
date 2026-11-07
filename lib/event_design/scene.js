import { aabbOf, distanceToSegment, pointInPolygon, polygonArea, segmentsCross } from "./geometry.js";
import { drawsChairs, seatPositions } from "./chairs.js";
import { roomPolygon, sortForRender } from "./plan.js";
import { footprintPolygon } from "./footprint.js";
import { normaliseUnit, METRES_PER_FOOT } from "./units.js";

// 3D scene description for the walkthrough: a plan → floor, walls with door openings, extruded parts, chairs, labels, viewpoints and walk collision.
// Plan coordinates throughout (x right, y down, metres, rotation deg clockwise) with `z` as height; the renderer maps (x, y, z) → three (x, z, y).

export const DEFAULT_CEILING_M = 3.5;
export const EYE_HEIGHT_M = 1.6;
export const SEATED_EYE_M = 1.2;
export const WALK_RADIUS_M = 0.25;
const DOOR_HEIGHT_M = 2.1;
// A door fixture whose centre is this close to a wall (beyond half its depth) cuts an opening in it.
const DOOR_SNAP_M = 0.4;
const DOOR_SYMBOLS = new Set(["door", "door_double", "exit"]);

export const isDoorLike = (o) => DOOR_SYMBOLS.has(o?.symbol);

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rad = (deg) => (num(deg) * Math.PI) / 180;

// Rotates a local offset clockwise by `deg` (the plan's convention).
function turn([lx, ly], deg) {
  const t = rad(deg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [lx * c - ly * s, lx * s + ly * c];
}

// Ceiling height: the venue space's when it is plausible, else the default — never lower than the tallest object.
export function ceilingHeight(plan, spaceHeightM) {
  const tallest = (plan?.objects || []).reduce((m, o) => Math.max(m, num(o.height_m)), 0);
  const given = num(spaceHeightM, NaN);
  const base = given >= 2 && given <= 100 ? given : DEFAULT_CEILING_M;
  return Math.max(base, tallest + 0.3);
}

// Area-weighted centroid, or the bounding-box centre when that falls outside a concave room.
export function roomCentre(polygon) {
  const bb = aabbOf(polygon);
  const fallback = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) return fallback;
  const c = [cx / (3 * a), cy / (3 * a)];
  return pointInPolygon(c, polygon) ? c : fallback;
}

// Inward unit normal of each edge (works for either winding).
function edgeFrames(polygon) {
  let signed = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    signed += x1 * y2 - x2 * y1;
  }
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = len ? (b[0] - a[0]) / len : 1;
    const dy = len ? (b[1] - a[1]) / len : 0;
    // Positive area: outward = (dy, -dx), so inward = (-dy, dx).
    const inward = signed >= 0 ? [-dy, dx] : [dy, -dx];
    return { a, b, len, dir: [dx, dy], inward };
  });
}

// What a placed object is, for modelling purposes.
export function objectKind(o) {
  const name = String(o?.name || "").toLowerCase();
  const shape = o?.shape;
  const h = num(o?.height_m, 0);
  if (o?.symbol === "exit") return "exit";
  if (o?.symbol === "door" || o?.symbol === "door_double") return "door";
  if (o?.symbol === "power") return "power";
  if (o?.symbol === "dance") return "dance";
  if (o?.symbol === "screen") return "screen";
  switch (o?.category) {
    case "structure":
      return /pillar|column/.test(name) ? "pillar" : "structure";
    case "staging":
      if (/step/.test(name)) return "steps";
      if (/podium|lectern/.test(name)) return "podium";
      return "stage";
    case "tables":
      if (shape === "custom") return "table_custom";
      if ((shape === "round" || shape === "oval") && !num(o?.seats) && h >= 0.95) return "highboy";
      return shape === "round" || shape === "oval" ? "table_round" : "table_rect";
    case "seating":
      return num(o?.width_m) <= 0.65 && num(o?.depth_m) <= 0.65 ? "chair" : "sofa";
    case "bars_catering":
      return /bar/.test(name) ? "bar" : "buffet";
    case "dance_entertainment":
      return "dj";
    case "av":
      if (shape === "round") return "speaker";
      return "desk";
    case "decor":
      if (/drape|pipe/.test(name)) return "drape";
      if (shape === "round" || /plant|flor|tree/.test(name)) return "plant";
      if (/easel|sign/.test(name)) return "easel";
      return "decor";
    default:
      return "decor";
  }
}

const box = (lx, ly, z, w, d, h, material) => ({ shape: "box", lx, ly, z, w, d, h, material });
const cyl = (lx, ly, z, w, d, h, material) => ({ shape: "cylinder", lx, ly, z, w, d, h, material });

// Local-frame parts (centre origin, z up) that model one object.
export function objectParts(o, ceilingM = DEFAULT_CEILING_M) {
  const w = Math.max(0.02, num(o.width_m, 1));
  const d = Math.max(0.02, num(o.depth_m, 1));
  const given = o.height_m === null || o.height_m === undefined ? null : num(o.height_m, null);
  const kind = objectKind(o);
  const H = given && given > 0 ? given : 0.75;
  const round = o.shape === "round" || o.shape === "oval";
  const prism = o.shape === "custom" && Array.isArray(o.points) && o.points.length >= 3
    ? o.points.map(([x, y]) => [num(x) * w, num(y) * d])
    : null;
  const body = (material, height = H, z = 0) =>
    prism
      ? { shape: "prism", lx: 0, ly: 0, z, w, d, h: height, points: prism, material }
      : round
        ? cyl(0, 0, z, w, d, height, material)
        : box(0, 0, z, w, d, height, material);

  switch (kind) {
    case "power":
      return [box(0, 0, 0, w, d, 0.03, "metal")];
    case "dance":
      return [box(0, 0, 0, w, d, Math.max(0.02, given || 0.02), "dance")];
    case "stage":
      return [body("stage", given || 0.4)];
    case "steps": {
      const top = given || 0.4;
      return [box(0, d / 4, 0, w, d / 2, top / 2, "stage"), box(0, -d / 4, 0, w, d / 2, top, "stage")];
    }
    case "podium":
      return [box(0, 0, 0, w, d, given || 1.2, "wood")];
    case "highboy": {
      const top = Math.max(0.04, H - 0.04);
      return [
        cyl(0, 0, 0, Math.min(w, 0.5), Math.min(d, 0.5), 0.03, "metal"),
        cyl(0, 0, 0.03, 0.07, 0.07, Math.max(0.05, top - 0.03), "metal"),
        cyl(0, 0, top, w, d, 0.04, "linen"),
      ];
    }
    case "table_round":
    case "table_rect":
    case "table_custom":
    case "buffet":
      return [body("linen")];
    case "chair":
      return [];
    case "sofa": {
      const seatH = Math.min(0.45, H * 0.5);
      const back = Math.min(0.25, d * 0.28);
      return [
        box(0, -back / 2, 0, w, d - back, seatH, "upholstery"),
        box(0, d / 2 - back / 2, 0, w, back, H, "upholstery"),
      ];
    }
    case "bar":
      if (prism) return [body("wood", Math.max(0.1, H - 0.04)), body("counter", 0.04, Math.max(0.1, H - 0.04))];
      return [box(0, 0, 0, w, d, Math.max(0.1, H - 0.04), "wood"), box(0, 0, Math.max(0.1, H - 0.04), w + 0.05, d + 0.05, 0.04, "counter")];
    case "dj":
    case "desk":
      return [body("dark")];
    case "screen": {
      const panelH = clamp(w * (9 / 16) + 0.1, 0.3, Math.max(0.3, H - 0.3));
      const bottom = Math.max(0.3, H - panelH);
      const frameD = Math.min(d, 0.1);
      const front = -d / 2 + frameD / 2;
      const projection = w >= 2.4;
      return [
        box(-w / 2 + 0.08, 0, 0, 0.05, Math.min(d, 0.4), bottom, "metal"),
        box(w / 2 - 0.08, 0, 0, 0.05, Math.min(d, 0.4), bottom, "metal"),
        box(0, front, bottom, w, frameD, panelH, "frame"),
        box(0, front - frameD / 2 - 0.006, bottom + 0.05, w - 0.1, 0.01, Math.max(0.05, panelH - 0.1), projection ? "screen" : "screenDark"),
      ];
    }
    case "speaker": {
      const cab = Math.min(0.6, H * 0.35);
      return [
        cyl(0, 0, 0, Math.min(w, 0.5), Math.min(d, 0.5), 0.03, "metal"),
        cyl(0, 0, 0.03, 0.05, 0.05, Math.max(0.05, H - cab - 0.03), "metal"),
        box(0, 0, H - cab, Math.min(w, 0.4), Math.min(d, 0.35), cab, "frame"),
      ];
    }
    case "drape": {
      const top = given || 2.4;
      return [
        box(0, 0, 0, w, Math.min(d, 0.06), Math.max(0.1, top - 0.05), "drape"),
        box(0, 0, top - 0.05, w, 0.05, 0.05, "metal"),
        box(-w / 2, 0, 0, 0.05, 0.05, top, "metal"),
        box(w / 2, 0, 0, 0.05, 0.05, top, "metal"),
      ];
    }
    case "plant": {
      const pot = Math.min(0.45, H * 0.35);
      return [
        cyl(0, 0, 0, w * 0.55, d * 0.55, pot, "pot"),
        { shape: "sphere", lx: 0, ly: 0, z: pot * 0.8, w, d, h: Math.max(0.2, H - pot * 0.8), material: "foliage" },
      ];
    }
    case "easel": {
      const board = Math.min(0.9, H * 0.55);
      return [
        box(-w / 3, 0, 0, 0.03, 0.03, H - 0.05, "wood"),
        box(w / 3, 0, 0, 0.03, 0.03, H - 0.05, "wood"),
        box(0, Math.min(0.2, d / 2), 0, 0.03, 0.03, H - 0.1, "wood"),
        box(0, -0.02, H - board, w, 0.03, board, "screen"),
      ];
    }
    case "pillar":
      return [body("pillar", given && given > 0 ? Math.min(given, ceilingM) : ceilingM)];
    case "structure":
      return [body("pillar", given && given > 0 ? given : ceilingM)];
    case "door":
    case "exit": {
      const dh = Math.min(given || DOOR_HEIGHT_M, ceilingM - 0.05);
      const parts = [
        box(-w / 2, 0, 0, 0.06, d, dh, "frame"),
        box(w / 2, 0, 0, 0.06, d, dh, "frame"),
        box(0, 0, dh - 0.08, w, d, 0.08, "frame"),
        box(0, 0, 0, Math.max(0.05, w - 0.12), 0.04, dh - 0.08, kind === "exit" ? "exitDoor" : "door"),
      ];
      if (kind === "exit") parts.push(box(0, 0, dh + 0.05, Math.min(0.5, w), 0.06, 0.18, "exitSign"));
      return parts;
    }
    default:
      return [body("decor")];
  }
}

// Clips grid lines at `step` metres to the room outline (even-odd), for the floor's subtle grid.
export function floorGrid(polygon, step = 1, maxLines = 400) {
  if (!(step > 0) || !polygon?.length) return [];
  const bb = aabbOf(polygon);
  const out = [];
  const clip = (horizontal, at) => {
    const hits = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      const [a1, a2, b1, b2] = horizontal ? [y1, y2, x1, x2] : [x1, x2, y1, y2];
      if (a1 === a2 || (at < Math.min(a1, a2) || at >= Math.max(a1, a2))) continue;
      hits.push(b1 + ((at - a1) / (a2 - a1)) * (b2 - b1));
    }
    hits.sort((p, q) => p - q);
    for (let k = 0; k + 1 < hits.length; k += 2) {
      out.push(horizontal ? [hits[k], at, hits[k + 1], at] : [at, hits[k], at, hits[k + 1]]);
    }
  };
  let lines = 0;
  for (let x = Math.ceil((bb.minX + 1e-6) / step) * step; x < bb.maxX - 1e-6 && lines < maxLines; x += step, lines += 1) clip(false, x);
  for (let y = Math.ceil((bb.minY + 1e-6) / step) * step; y < bb.maxY - 1e-6 && lines < maxLines; y += step, lines += 1) clip(true, y);
  return out;
}

// The opening a door fixture cuts in the nearest wall, or null when it stands free.
function doorOpening(o, frames, ceilingM) {
  const half = num(o.depth_m) / 2 + DOOR_SNAP_M;
  let best = null;
  frames.forEach((f, edge) => {
    if (!(f.len > 0)) return;
    const dist = distanceToSegment([o.x_m, o.y_m], f.a, f.b);
    if (dist > half || (best && dist >= best.dist)) return;
    const t = (o.x_m - f.a[0]) * f.dir[0] + (o.y_m - f.a[1]) * f.dir[1];
    best = { edge, dist, t };
  });
  if (!best) return null;
  const f = frames[best.edge];
  const w = Math.max(0.3, num(o.width_m, 0.9));
  const from = clamp(best.t - w / 2, 0, f.len);
  const to = clamp(best.t + w / 2, 0, f.len);
  if (to - from < 0.2) return null;
  const given = o.height_m === null || o.height_m === undefined ? null : num(o.height_m, null);
  return {
    id: o.id,
    edge: best.edge,
    from,
    to,
    height: Math.min(given && given > 0 ? given : DOOR_HEIGHT_M, ceilingM - 0.1),
    kind: o.symbol === "exit" ? "exit" : o.symbol === "door_double" ? "door_double" : "door",
  };
}

const panel = (f, from, to, bottom, top, material, offset = 0) => {
  const mid = (from + to) / 2;
  return {
    cx: f.a[0] + f.dir[0] * mid - f.inward[0] * offset,
    cy: f.a[1] + f.dir[1] * mid - f.inward[1] * offset,
    len: to - from,
    bottom,
    top,
    nx: f.inward[0],
    ny: f.inward[1],
    material,
  };
};

// Everything the renderer draws, from a plan (chairs always included — the renderer decides whether to draw them).
export function buildScene(plan, { ceilingHeightM } = {}) {
  const room = roomPolygon(plan);
  const ceilingM = ceilingHeight(plan, ceilingHeightM);
  const frames = edgeFrames(room);
  const bounds = aabbOf(room);
  const centre = roomCentre(room);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);

  const openings = [];
  const objects = [];
  const chairs = [];
  const labels = [];
  const fixtures = [];

  for (const o of sortForRender(plan?.objects || [])) {
    if (isDoorLike(o)) {
      const opening = doorOpening(o, frames, ceilingM);
      if (opening) {
        openings.push(opening);
        continue;
      }
    }
    const kind = objectKind(o);
    if (kind === "chair") {
      chairs.push({ id: o.id, x: o.x_m, y: o.y_m, rot: num(o.rotation) });
    } else if (drawsChairs(o)) {
      for (const s of seatPositions(o)) chairs.push({ id: `${o.id}:${s.index}`, x: s.x, y: s.y, rot: s.angle });
    }
    const parts = objectParts(o, ceilingM);
    const isTable = o.category === "tables" && num(o.seats) > 0;
    if (parts.length) {
      objects.push({ id: o.id, x: o.x_m, y: o.y_m, rot: num(o.rotation), kind, parts, viewpoint: isTable ? `table:${o.id}` : null });
    }
    const text = o.label || "";
    if (text) {
      const top = parts.reduce((m, p) => Math.max(m, p.z + p.h), 0);
      labels.push({ id: o.id, text: isTable && /^\d+$/.test(text) ? `Table ${text}` : text, x: o.x_m, y: o.y_m, z: top + 0.45 });
    }
  }

  // Walls: full-height runs between openings plus a lintel over each opening; a recessed door leaf fills the gap.
  const walls = [];
  frames.forEach((f, edge) => {
    if (!(f.len > 0)) return;
    const cuts = openings
      .filter((op) => op.edge === edge)
      .sort((p, q) => p.from - q.from)
      .reduce((acc, op) => {
        const last = acc[acc.length - 1];
        if (last && op.from <= last.to) {
          last.to = Math.max(last.to, op.to);
          last.height = Math.max(last.height, op.height);
          return acc;
        }
        acc.push({ ...op });
        return acc;
      }, []);
    let cursor = 0;
    for (const cut of cuts) {
      if (cut.from > cursor + 1e-3) walls.push(panel(f, cursor, cut.from, 0, ceilingM, "wall"));
      if (cut.height < ceilingM - 1e-3) walls.push(panel(f, cut.from, cut.to, cut.height, ceilingM, "wall"));
      walls.push(panel(f, cut.from, cut.to, 0, cut.height, cut.kind === "exit" ? "exitDoor" : "door", 0.04));
      cursor = cut.to;
    }
    if (f.len > cursor + 1e-3) walls.push(panel(f, cursor, f.len, 0, ceilingM, "wall"));
  });

  for (const op of openings.filter((o) => o.kind === "exit")) {
    const f = frames[op.edge];
    const mid = (op.from + op.to) / 2;
    fixtures.push({
      id: `exit-sign:${op.id}`,
      x: f.a[0] + f.dir[0] * mid + f.inward[0] * 0.04,
      y: f.a[1] + f.dir[1] * mid + f.inward[1] * 0.04,
      rot: (Math.atan2(f.dir[1], f.dir[0]) * 180) / Math.PI,
      parts: [box(0, 0, Math.min(op.height + 0.08, ceilingM - 0.2), Math.min(0.5, op.to - op.from), 0.06, 0.18, "exitSign")],
    });
  }

  const unit = normaliseUnit(plan?.unit);
  const gridStep = unit === "ft" ? 3 * METRES_PER_FOOT : 1;

  return {
    room,
    bounds,
    centre,
    span,
    ceilingM,
    area: polygonArea(room),
    grid: floorGrid(room, gridStep),
    walls,
    openings: openings.map((op) => {
      const f = frames[op.edge];
      const mid = (op.from + op.to) / 2;
      return { ...op, x: f.a[0] + f.dir[0] * mid, y: f.a[1] + f.dir[1] * mid, inward: f.inward };
    }),
    objects: [...objects, ...fixtures],
    chairs,
    labels,
  };
}

// The stage (or failing that, the screen) the room faces: { x, y, z (focus height), front: unit vector into the room }.
export function stageFocus(plan, scene) {
  const objects = plan?.objects || [];
  const pick = (list) =>
    list.reduce((best, o) => (!best || num(o.width_m) * num(o.depth_m) > num(best.width_m) * num(best.depth_m) ? o : best), null);
  const stage = pick(objects.filter((o) => objectKind(o) === "stage"));
  const target = stage || pick(objects.filter((o) => objectKind(o) === "screen"));
  if (!target) return null;
  const [cx, cy] = scene.centre;
  let fx = cx - target.x_m;
  let fy = cy - target.y_m;
  const len = Math.hypot(fx, fy);
  if (len < 0.5) {
    [fx, fy] = turn([0, 1], num(target.rotation));
  } else {
    fx /= len;
    fy /= len;
  }
  const top = stage ? num(stage.height_m, 0.4) : 0;
  return {
    id: target.id,
    isStage: Boolean(stage),
    x: target.x_m,
    y: target.y_m,
    z: top + (stage ? 1.1 : 1.6),
    top,
    front: [fx, fy],
    depth: num(target.depth_m),
  };
}

const tableNumber = (o) => {
  const n = parseInt(o.label, 10);
  return Number.isFinite(n) ? n : Infinity;
};

// Camera presets: `orbit` ones give { at, look } (plan x, y, z); `walk` ones stand a person at `at` looking at `look`.
export function planViewpoints(plan, scene) {
  const [cx, cy] = scene.centre;
  const { span, bounds } = scene;
  const focus = stageFocus(plan, scene);
  const lookFocus = focus ? [focus.x, focus.y, focus.z] : null;
  const views = [
    { key: "overview", label: "Overview", group: "room", mode: "orbit", at: [cx + span * 0.35, cy + span * 0.9, span * 0.75], look: [cx, cy, 0] },
    { key: "top", label: "Top down", group: "room", mode: "orbit", at: [cx, cy + 0.01, span * 1.25], look: [cx, cy, 0] },
  ];

  const doors = [...scene.openings].sort((a, b) => {
    const rank = { door_double: 0, door: 1, exit: 2 };
    return rank[a.kind] - rank[b.kind];
  });
  if (doors.length) {
    const d = doors[0];
    views.push({
      key: "entrance",
      label: "Entrance",
      group: "room",
      mode: "walk",
      at: [d.x + d.inward[0] * 1.5, d.y + d.inward[1] * 1.5, EYE_HEIGHT_M],
      look: [cx, cy, 1.4],
    });
  } else {
    views.push({
      key: "entrance",
      label: "Back of the room",
      group: "room",
      mode: "walk",
      at: [cx, bounds.maxY - 1.2, EYE_HEIGHT_M],
      look: lookFocus || [cx, cy, 1.4],
    });
  }

  if (focus) {
    const dist = clamp(span * 0.3, 3, 10) + focus.depth / 2;
    views.push({
      key: "stage",
      label: "Facing the stage",
      group: "room",
      mode: "walk",
      at: [focus.x + focus.front[0] * dist, focus.y + focus.front[1] * dist, EYE_HEIGHT_M],
      look: lookFocus,
    });
    if (focus.isStage) {
      views.push({
        key: "from-stage",
        label: "From the stage",
        group: "room",
        mode: "walk",
        at: [focus.x, focus.y, focus.top + EYE_HEIGHT_M],
        look: [cx, cy, 1.0],
      });
    }
  }

  views.push({
    key: "centre",
    label: "Centre of the room",
    group: "room",
    mode: "walk",
    at: [cx, cy, EYE_HEIGHT_M],
    look: lookFocus || [cx, cy - 10, EYE_HEIGHT_M],
  });

  const tables = (plan?.objects || [])
    .filter((o) => o.category === "tables" && num(o.seats) > 0)
    .sort((a, b) => tableNumber(a) - tableNumber(b) || String(a.label || a.name).localeCompare(String(b.label || b.name)));
  for (const t of tables) {
    const look = lookFocus || [t.x_m, t.y_m, 0.76];
    let at;
    if (drawsChairs(t)) {
      const seats = seatPositions(t);
      // The seat on the far side of the table from the stage sees over it.
      const seat = focus
        ? seats.reduce((best, s) => (Math.hypot(s.x - focus.x, s.y - focus.y) > Math.hypot(best.x - focus.x, best.y - focus.y) ? s : best), seats[0])
        : seats[0];
      at = [seat.x, seat.y, SEATED_EYE_M];
    } else {
      const [ox, oy] = turn([0, num(t.depth_m) / 2 + 0.6], num(t.rotation));
      at = [t.x_m + ox, t.y_m + oy, SEATED_EYE_M];
    }
    views.push({
      key: `table:${t.id}`,
      label: t.label ? (/^\d+$/.test(t.label) ? `Table ${t.label}` : t.label) : t.name,
      group: "table",
      mode: "walk",
      at,
      look,
    });
  }
  return views;
}

// --- walking ---------------------------------------------------------------

// Collision world: room walls (every edge, doors included) plus obstacles; floor-layer pads (stages, dance floors) are walkable and lift the eye.
export function walkWorld(plan, scene, { withChairs = true } = {}) {
  const walls = scene.room.map((a, i) => [a, scene.room[(i + 1) % scene.room.length]]);
  const obstacles = [];
  const pads = [];
  for (const o of plan?.objects || []) {
    const kind = objectKind(o);
    if (isDoorLike(o) || kind === "power") continue;
    const w = num(o.width_m);
    const d = num(o.depth_m);
    if (o.layer === "floor") {
      const top = num(o.height_m, 0.02);
      if (top > 0.05) pads.push({ x: o.x_m, y: o.y_m, hw: w / 2, hd: d / 2, rot: num(o.rotation), top, reach: Math.hypot(w, d) / 2 });
      continue;
    }
    if (o.shape === "round" && Math.abs(w - d) < 0.05) {
      obstacles.push({ kind: "circle", x: o.x_m, y: o.y_m, r: w / 2, reach: w / 2 });
    } else {
      obstacles.push({ kind: "box", x: o.x_m, y: o.y_m, hw: w / 2, hd: d / 2, rot: num(o.rotation), reach: Math.hypot(w, d) / 2 });
    }
  }
  if (withChairs) {
    for (const c of scene.chairs) {
      obstacles.push({ kind: "box", x: c.x, y: c.y, hw: 0.21, hd: 0.21, rot: c.rot, reach: 0.3 });
    }
  }
  return { room: scene.room, walls, obstacles, pads };
}

function hitsBox(px, py, r, o) {
  const dx = px - o.x;
  const dy = py - o.y;
  const t = -rad(o.rot);
  const c = Math.cos(t);
  const s = Math.sin(t);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.hypot(lx - clamp(lx, -o.hw, o.hw), ly - clamp(ly, -o.hd, o.hd)) < r;
}

function hitsObstacle(px, py, r, o) {
  if (Math.abs(px - o.x) > o.reach + r || Math.abs(py - o.y) > o.reach + r) return false;
  if (o.kind === "circle") return Math.hypot(px - o.x, py - o.y) < o.r + r;
  return hitsBox(px, py, r, o);
}

// Indices of the obstacles a walker of radius r overlaps at (x, y).
export function overlapping(world, [x, y], r = WALK_RADIUS_M) {
  const out = [];
  world.obstacles.forEach((o, i) => {
    if (hitsObstacle(x, y, r, o)) out.push(i);
  });
  return out;
}

function wallBlocks(world, from, to, r) {
  for (const [a, b] of world.walls) {
    if (segmentsCross(from, to, a, b)) return true;
    const next = distanceToSegment(to, a, b);
    if (next < r && next < distanceToSegment(from, a, b) - 1e-9) return true;
  }
  return false;
}

// One movement step with sliding: never enters an obstacle it wasn't already in, never crosses or presses into a wall.
export function stepWalk(world, from, [dx, dy], r = WALK_RADIUS_M) {
  if (!dx && !dy) return from;
  const already = new Set(overlapping(world, from, r));
  const ok = (to) => !wallBlocks(world, from, to, r) && overlapping(world, to, r).every((i) => already.has(i));
  const full = [from[0] + dx, from[1] + dy];
  if (ok(full)) return full;
  const xOnly = [from[0] + dx, from[1]];
  if (dx && ok(xOnly)) return xOnly;
  const yOnly = [from[0], from[1] + dy];
  if (dy && ok(yOnly)) return yOnly;
  return from;
}

// Height of the floor under (x, y): the top of a stage or dance floor the walker stands on, else 0.
export function floorHeightAt(world, [x, y]) {
  let top = 0;
  for (const p of world.pads) {
    if (Math.abs(x - p.x) > p.reach || Math.abs(y - p.y) > p.reach) continue;
    if (hitsBox(x, y, 1e-6, p) && p.top > top) top = p.top;
  }
  return top;
}

// True when (x, y) is inside the room.
export const insideRoom = (world, point) => pointInPolygon(point, world.room);

// Topmost object under a plan point (for click-to-select / comment pins), or null.
export function objectAtPoint(objects, point) {
  const ordered = sortForRender(objects || []);
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const o = ordered[i];
    if (pointInPolygon(point, footprintPolygon(o))) return o;
  }
  return null;
}
