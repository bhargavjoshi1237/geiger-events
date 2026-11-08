import { normaliseRotation } from "./geometry.js";
import { CHAIR_MODES } from "./chairs.js";
import { newInstanceId } from "./ids.js";
import { STANDARD_CATALOG } from "./standard_catalog.js";
import { BOOTH_CATEGORY, normaliseBoothFields } from "./expo.js";

// Object catalog helpers: categories, layers, catalog search, and turning a catalog object into a placed instance.

export const CATEGORIES = [
  { key: "tables", label: "Tables", layer: "furniture" },
  { key: "seating", label: "Seating", layer: "furniture" },
  { key: "staging", label: "Staging", layer: "floor" },
  { key: "bars_catering", label: "Bars & catering", layer: "furniture" },
  { key: "dance_entertainment", label: "Dance & entertainment", layer: "floor" },
  { key: "av", label: "AV", layer: "furniture" },
  { key: "decor", label: "Decor", layer: "furniture" },
  { key: "structure", label: "Fixtures & structure", layer: "structure" },
  { key: "expo", label: "Expo booths", layer: "furniture" },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const SHAPES = ["rect", "round", "oval", "custom"];
export const SHAPE_LABELS = { rect: "Rectangle", round: "Round", oval: "Oval", custom: "Custom" };

// Draw / stacking order: floor coverings under furniture, structure on top.
export const LAYERS = ["floor", "furniture", "structure"];
export const LAYER_ORDER = { floor: 0, furniture: 1, structure: 2 };
export const LAYER_LABELS = { floor: "Floor (stages, dance floors)", furniture: "Furniture", structure: "Structure" };

export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || "Other";

export const normaliseCategory = (key) => (CATEGORY_KEYS.includes(key) ? key : "decor");

// A catalog object's layer: explicit config.layer, else its category default.
export function layerFor(object) {
  const explicit = object?.config?.layer ?? object?.layer;
  if (LAYERS.includes(explicit)) return explicit;
  return CATEGORIES.find((c) => c.key === object?.category)?.layer || "furniture";
}

export function normaliseChairLayout(layout, shape) {
  const mode = CHAIR_MODES.includes(layout?.mode)
    ? layout.mode
    : shape === "round" || shape === "oval"
      ? "around"
      : "none";
  return mode === "sides" && layout?.ends ? { mode, ends: true } : { mode };
}

// The global catalog as served: DB rows when the seed exists, else the bundled standard set; project objects always appended.
export function resolveCatalog(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const hasGlobal = list.some((o) => !o.projectId);
  const merged = hasGlobal ? list : [...STANDARD_CATALOG, ...list];
  return [...merged].sort(
    (a, b) =>
      CATEGORY_KEYS.indexOf(a.category) - CATEGORY_KEYS.indexOf(b.category) ||
      Number(Boolean(a.projectId)) - Number(Boolean(b.projectId)) ||
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      String(a.name).localeCompare(String(b.name)),
  );
}

export const catalogById = (objects) => new Map((objects || []).map((o) => [o.id, o]));

// Filters by free-text query, category key ("all" for any) and source ("all" | "standard" | "custom").
export function searchCatalog(objects, { query = "", category = "all", source = "all" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return (objects || []).filter((o) => {
    if (category !== "all" && o.category !== category) return false;
    if (source === "standard" && o.projectId) return false;
    if (source === "custom" && !o.projectId) return false;
    if (q && !`${o.name} ${categoryLabel(o.category)} ${o.description || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function groupByCategory(objects) {
  return CATEGORIES.map((c) => ({
    ...c,
    objects: (objects || []).filter((o) => o.category === c.key),
  })).filter((g) => g.objects.length > 0);
}

// Places a catalog object: the instance snapshots everything needed to render it without the catalog.
export function createInstance(object, { x = 0, y = 0, rotation = 0, label = "", id } = {}) {
  const shape = object?.shape || "rect";
  const points = Array.isArray(object?.config?.points) ? object.config.points : null;
  const symbol = typeof object?.config?.symbol === "string" ? object.config.symbol : "";
  return {
    id: id || newInstanceId(),
    objectId: object?.id || null,
    name: object?.name || "Object",
    category: normaliseCategory(object?.category),
    shape,
    x_m: Number(x) || 0,
    y_m: Number(y) || 0,
    rotation: normaliseRotation(rotation),
    width_m: Number(object?.widthM) || 1,
    depth_m: Number(object?.depthM) || 1,
    height_m: object?.heightM === null || object?.heightM === undefined ? null : Number(object.heightM),
    seats: Math.max(0, Math.floor(Number(object?.seats) || 0)),
    chairs: normaliseChairLayout(object?.chairLayout, shape),
    label: label || "",
    locked: false,
    layer: layerFor(object),
    ...(symbol ? { symbol } : {}),
    ...(points ? { points } : {}),
    ...(object?.category === BOOTH_CATEGORY ? { booth: normaliseBoothFields() } : {}),
  };
}

// Catalog object → a one-object plan for previews (object centred with a margin).
export function previewPlanFor(object, margin = 0.6) {
  const instance = createInstance(object, { id: `preview-${object?.id || "new"}` });
  const reach = instance.seats > 0 && instance.chairs.mode !== "integral" && instance.chairs.mode !== "none" ? 0.5 : 0;
  const widthM = instance.width_m + (reach + margin) * 2;
  const lengthM = instance.depth_m + (reach + margin) * 2;
  return {
    widthM,
    lengthM,
    unit: "m",
    outline: { type: "rect" },
    objects: [{ ...instance, x_m: widthM / 2, y_m: lengthM / 2 }],
  };
}
