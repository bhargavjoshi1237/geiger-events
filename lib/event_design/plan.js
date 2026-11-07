import {
  aabbCenter,
  aabbIntersects,
  aabbOf,
  normaliseRotation,
  polygonArea,
  polygonInsidePolygon,
  rectPolygon,
  rotatePoint,
  unionAabb,
} from "./geometry.js";
import { CHAIR_MODES } from "./chairs.js";
import { footprintPolygon, instanceAabb, instancesOverlap } from "./footprint.js";
import { LAYER_ORDER, LAYERS, SHAPES, normaliseCategory } from "./catalog.js";
import { newInstanceId } from "./ids.js";
import { normaliseUnit } from "./units.js";

// Floor plan model: setup styles, instance validation, plan stats (seats, area, out-of-room / overlap flags) and bulk edits.

export const SETUP_STYLES = [
  { value: "theatre", label: "Theatre" },
  { value: "classroom", label: "Classroom" },
  { value: "banquet", label: "Banquet" },
  { value: "cabaret", label: "Cabaret" },
  { value: "reception", label: "Reception" },
  { value: "boardroom", label: "Boardroom" },
  { value: "u_shape", label: "U-shape" },
  { value: "hollow_square", label: "Hollow square" },
  { value: "custom", label: "Custom" },
];
export const SETUP_STYLE_VALUES = SETUP_STYLES.map((s) => s.value);
export const setupStyleLabel = (value) => SETUP_STYLES.find((s) => s.value === value)?.label || "Custom";
export const normaliseSetupStyle = (value) => (SETUP_STYLE_VALUES.includes(value) ? value : "custom");

export const PLAN_KINDS = ["plan", "template", "library"];
export const PLAN_STATUSES = ["draft", "final"];

export const DEFAULT_ROOM = { widthM: 20, lengthM: 15 };
export const MIN_ROOM_M = 1;
export const MAX_ROOM_M = 500;

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clampRoom = (v, fallback) => Math.min(MAX_ROOM_M, Math.max(MIN_ROOM_M, num(v, fallback)));

// Room outline: { type: "rect" } (the width × length box) or { type: "polygon", points: [[x, y]…] } in metres.
export function normaliseOutline(outline) {
  if (outline?.type === "polygon" && Array.isArray(outline.points) && outline.points.length >= 3) {
    const points = outline.points
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([x, y]) => [num(x), num(y)]);
    if (points.length >= 3) return { type: "polygon", points };
  }
  return { type: "rect" };
}

export function roomPolygon(plan) {
  const outline = normaliseOutline(plan?.outline);
  if (outline.type === "polygon") return outline.points;
  return rectPolygon(0, 0, clampRoom(plan?.widthM, DEFAULT_ROOM.widthM), clampRoom(plan?.lengthM, DEFAULT_ROOM.lengthM));
}

export const roomAabb = (plan) => aabbOf(roomPolygon(plan));
export const roomArea = (plan) => polygonArea(roomPolygon(plan));

// Coerces one stored instance into the canonical shape, or null when it can't be placed.
export function normaliseInstance(raw) {
  if (!raw || typeof raw !== "object") return null;
  const width = num(raw.width_m);
  const depth = num(raw.depth_m);
  if (!(width > 0) || !(depth > 0)) return null;
  const shape = SHAPES.includes(raw.shape) ? raw.shape : "rect";
  const mode = CHAIR_MODES.includes(raw.chairs?.mode) ? raw.chairs.mode : "none";
  const instance = {
    id: typeof raw.id === "string" && raw.id ? raw.id : newInstanceId(),
    objectId: typeof raw.objectId === "string" && raw.objectId ? raw.objectId : null,
    name: String(raw.name ?? "Object"),
    category: normaliseCategory(raw.category),
    shape,
    x_m: num(raw.x_m),
    y_m: num(raw.y_m),
    rotation: normaliseRotation(raw.rotation),
    width_m: width,
    depth_m: depth,
    height_m: raw.height_m === null || raw.height_m === undefined || raw.height_m === "" ? null : num(raw.height_m),
    seats: Math.max(0, Math.floor(num(raw.seats))),
    chairs: mode === "sides" && raw.chairs?.ends ? { mode, ends: true } : { mode },
    label: String(raw.label ?? ""),
    locked: raw.locked === true,
    layer: LAYERS.includes(raw.layer) ? raw.layer : "furniture",
  };
  if (typeof raw.symbol === "string" && raw.symbol) instance.symbol = raw.symbol;
  if (Array.isArray(raw.points) && raw.points.length >= 3) {
    instance.points = raw.points.map(([x, y]) => [num(x), num(y)]);
  }
  return instance;
}

// Normalises a stored objects array; drops unplaceable rows and re-ids duplicates so every id is unique.
export function normaliseObjects(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const inst = normaliseInstance(raw);
    if (!inst) continue;
    if (seen.has(inst.id)) inst.id = newInstanceId();
    seen.add(inst.id);
    out.push(inst);
  }
  return out;
}

// Stable draw order: floor layer first, structure last, array order within a layer.
export function sortForRender(objects) {
  return (objects || [])
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (LAYER_ORDER[a.o.layer] ?? 1) - (LAYER_ORDER[b.o.layer] ?? 1) || a.i - b.i)
    .map(({ o }) => o);
}

export const seatTotal = (objects) =>
  (objects || []).reduce((sum, o) => sum + Math.max(0, Math.floor(num(o.seats))), 0);

// Every overlapping pair (chairs included), AABB-prefiltered.
export function findOverlaps(objects, { withChairs = true } = {}) {
  const list = objects || [];
  const boxes = list.map((o) => instanceAabb(o, { withChairs }));
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (!aabbIntersects(boxes[i], boxes[j], 0.005)) continue;
      if (instancesOverlap(list[i], list[j], { withChairs })) pairs.push([list[i].id, list[j].id]);
    }
  }
  return pairs;
}

// Ids of objects whose footprint (chairs included) leaves the room outline.
export function objectsOutsideRoom(plan, objects = plan?.objects, { withChairs = true } = {}) {
  const room = roomPolygon(plan);
  return (objects || [])
    .filter((o) => !polygonInsidePolygon(footprintPolygon(o, { withChairs }), room, 0.01))
    .map((o) => o.id);
}

// Everything the status bar and gallery cards report about a plan.
export function planStats(plan) {
  const objects = plan?.objects || [];
  const overlapPairs = findOverlaps(objects);
  const outsideIds = objectsOutsideRoom(plan, objects);
  const overlappingIds = [...new Set(overlapPairs.flat())];
  return {
    objectCount: objects.length,
    seats: seatTotal(objects),
    tables: objects.filter((o) => o.category === "tables").length,
    areaM2: roomArea(plan),
    outsideIds,
    overlapPairs,
    overlappingIds,
    flaggedIds: [...new Set([...outsideIds, ...overlappingIds])],
  };
}

// Cheap counts for list views (no collision work).
export const planSummary = (plan) => ({
  objectCount: (plan?.objects || []).length,
  seats: seatTotal(plan?.objects),
  areaM2: roomArea(plan),
});

// Structural validation before a save; returns { ok, errors }.
export function validatePlan(plan) {
  const errors = [];
  const w = num(plan?.widthM, NaN);
  const l = num(plan?.lengthM, NaN);
  if (!(w >= MIN_ROOM_M && w <= MAX_ROOM_M)) errors.push(`Room width must be between ${MIN_ROOM_M} and ${MAX_ROOM_M} m.`);
  if (!(l >= MIN_ROOM_M && l <= MAX_ROOM_M)) errors.push(`Room length must be between ${MIN_ROOM_M} and ${MAX_ROOM_M} m.`);
  if (!Array.isArray(plan?.objects)) errors.push("Objects must be a list.");
  const ids = new Set();
  for (const o of plan?.objects || []) {
    if (!normaliseInstance(o)) errors.push(`"${o?.label || o?.name || "An object"}" has no size.`);
    if (ids.has(o?.id)) errors.push("Two objects share an id.");
    ids.add(o?.id);
  }
  return { ok: errors.length === 0, errors };
}

// The saved content of a plan (what the editor edits and a save writes).
export function planContent(plan) {
  return {
    widthM: clampRoom(plan?.widthM, DEFAULT_ROOM.widthM),
    lengthM: clampRoom(plan?.lengthM, DEFAULT_ROOM.lengthM),
    unit: normaliseUnit(plan?.unit),
    outline: normaliseOutline(plan?.outline),
    setupStyle: normaliseSetupStyle(plan?.setupStyle),
    objects: normaliseObjects(plan?.objects),
  };
}

// Deep copy with fresh instance ids — for duplicating a plan or instantiating a template.
export const cloneObjects = (objects) =>
  normaliseObjects(objects).map((o) => ({ ...o, id: newInstanceId(), chairs: { ...o.chairs } }));

const idSet = (ids) => (ids instanceof Set ? ids : new Set(ids || []));

export function selectionAabb(objects, ids, opts) {
  const pick = idSet(ids);
  return unionAabb((objects || []).filter((o) => pick.has(o.id)).map((o) => instanceAabb(o, opts)));
}

// Ids whose footprint (chairs included) touches the box — marquee selection.
export function objectsInBox(objects, box) {
  return (objects || [])
    .filter((o) => aabbIntersects(instanceAabb(o, { withChairs: true }), box, 0))
    .map((o) => o.id);
}

// Moves the unlocked selected objects by (dx, dy) metres.
export function translateInstances(objects, ids, dx, dy) {
  const pick = idSet(ids);
  return objects.map((o) =>
    pick.has(o.id) && !o.locked ? { ...o, x_m: o.x_m + dx, y_m: o.y_m + dy } : o,
  );
}

// Rotates the unlocked selected objects by `delta` degrees around `centre` (default: the selection's centre).
export function rotateInstances(objects, ids, delta, centre) {
  const pick = idSet(ids);
  const c = centre || aabbCenter(selectionAabb(objects, pick) || { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  return objects.map((o) => {
    if (!pick.has(o.id) || o.locked) return o;
    const [x, y] = rotatePoint([o.x_m, o.y_m], delta, c);
    return { ...o, x_m: x, y_m: y, rotation: normaliseRotation(o.rotation + delta) };
  });
}

// Copies the selected objects offset by (dx, dy); returns the new list and the copies' ids.
export function duplicateInstances(objects, ids, dx = 0.5, dy = 0.5) {
  const pick = idSet(ids);
  const copies = objects
    .filter((o) => pick.has(o.id))
    .map((o) => ({ ...o, id: newInstanceId(), x_m: o.x_m + dx, y_m: o.y_m + dy, locked: false, chairs: { ...o.chairs } }));
  return { objects: [...objects, ...copies], ids: copies.map((c) => c.id) };
}

export function removeInstances(objects, ids) {
  const pick = idSet(ids);
  return objects.filter((o) => !pick.has(o.id) || o.locked);
}

// Aligns the selection's bounding boxes: left | centerX | right | top | centerY | bottom.
export function alignInstances(objects, ids, mode) {
  const pick = idSet(ids);
  const target = selectionAabb(objects, pick);
  if (!target) return objects;
  return objects.map((o) => {
    if (!pick.has(o.id) || o.locked) return o;
    const b = instanceAabb(o);
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = target.minX - b.minX;
    if (mode === "right") dx = target.maxX - b.maxX;
    if (mode === "centerX") dx = (target.minX + target.maxX) / 2 - (b.minX + b.maxX) / 2;
    if (mode === "top") dy = target.minY - b.minY;
    if (mode === "bottom") dy = target.maxY - b.maxY;
    if (mode === "centerY") dy = (target.minY + target.maxY) / 2 - (b.minY + b.maxY) / 2;
    return { ...o, x_m: o.x_m + dx, y_m: o.y_m + dy };
  });
}

// Spaces the selection's centres evenly along "x" or "y" between the outermost two.
export function distributeInstances(objects, ids, axis = "x") {
  const pick = idSet(ids);
  const key = axis === "y" ? "y_m" : "x_m";
  const chosen = objects.filter((o) => pick.has(o.id)).sort((a, b) => a[key] - b[key]);
  if (chosen.length < 3) return objects;
  const first = chosen[0][key];
  const step = (chosen[chosen.length - 1][key] - first) / (chosen.length - 1);
  const next = new Map(chosen.map((o, i) => [o.id, first + step * i]));
  return objects.map((o) => (next.has(o.id) && !o.locked ? { ...o, [key]: next.get(o.id) } : o));
}

// Next free numeric table label ("1", "2"…) — tables are numbered so seating charts can say "Table 7".
export function nextTableLabel(objects) {
  const used = (objects || [])
    .filter((o) => o.category === "tables")
    .map((o) => parseInt(o.label, 10))
    .filter((n) => Number.isFinite(n));
  return String(used.length ? Math.max(...used) + 1 : 1);
}

// Repeats one object as a rows × cols grid (spacing = its footprint incl. chairs + gap); the original stays at [0, 0].
export function arrayInstances(objects, sourceId, { rows = 1, cols = 1, gapX = 0.5, gapY = 0.5, numberTables = true } = {}) {
  const source = objects.find((o) => o.id === sourceId);
  if (!source) return { objects, ids: [] };
  const box = instanceAabb(source, { withChairs: true });
  const stepX = box.maxX - box.minX + Math.max(0, num(gapX));
  const stepY = box.maxY - box.minY + Math.max(0, num(gapY));
  const r = Math.max(1, Math.min(60, Math.floor(num(rows, 1))));
  const c = Math.max(1, Math.min(60, Math.floor(num(cols, 1))));
  let working = objects;
  const ids = [];
  for (let i = 0; i < r; i += 1) {
    for (let j = 0; j < c; j += 1) {
      if (i === 0 && j === 0) continue;
      const copy = {
        ...source,
        id: newInstanceId(),
        x_m: source.x_m + j * stepX,
        y_m: source.y_m + i * stepY,
        locked: false,
        chairs: { ...source.chairs },
        label: numberTables && source.category === "tables" ? nextTableLabel(working) : source.label,
      };
      working = [...working, copy];
      ids.push(copy.id);
    }
  }
  return { objects: working, ids: [sourceId, ...ids] };
}
