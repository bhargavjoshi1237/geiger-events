import { aabbOf, normaliseRotation } from "./geometry.js";

// Expo halls: booths are plan instances in the "expo" category; a hall's sellable rows (events.hall_booths — percent of
// the canvas, top-left origin, the shape checkout and the buyer map read) are projected from them on every save.

export const BOOTH_CATEGORY = "expo";
export const BOOTH_SIZE_CLASSES = ["Standard", "Large", "Premium", "Island", "Corner"];
export const DEFAULT_BOOTH_PREFIX = "A";

// Non-booth objects smaller than this (chairs, plants, power drops) stay off the buyer's map.
const FEATURE_MIN_M2 = 1;
const MAX_FEATURES = 400;
// A legacy percent-only hall has no real size; it is drawn at this width (length follows its aspect).
export const LEGACY_HALL_WIDTH_M = 40;

export const isBooth = (o) => o?.category === BOOTH_CATEGORY;

const round2 = (n) => Math.round(n * 100) / 100;
const LABEL_RE = /^(.*?)(\d+)$/;

// The sale fields a booth instance carries beside its geometry; its number is the instance label.
export function normaliseBoothFields(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const price = Number(b.price);
  return {
    sizeClass: BOOTH_SIZE_CLASSES.includes(b.sizeClass) ? b.sizeClass : "Standard",
    price: Number.isFinite(price) && price > 0 ? round2(price) : 0,
    zone: String(b.zone ?? "").trim().slice(0, 80),
  };
}

export const boothArea = (o) => (Number(o?.width_m) || 0) * (Number(o?.depth_m) || 0);

// The next free number after the most recently numbered booth's prefix: A12 → A13; no booths yet → A1.
export function nextBoothLabel(objects) {
  const booths = (objects || []).filter(isBooth);
  const last = [...booths].reverse().find((o) => LABEL_RE.test(String(o.label || "")));
  const prefix = last ? String(last.label).match(LABEL_RE)[1] : DEFAULT_BOOTH_PREFIX;
  let max = 0;
  for (const o of booths) {
    const m = String(o.label || "").match(LABEL_RE);
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}${max + 1}`;
}

// Reading order: rows top to bottom (a row = centres within half a booth depth), left to right inside a row.
export function readingOrder(objects) {
  const list = [...(objects || [])].sort((a, b) => a.y_m - b.y_m || a.x_m - b.x_m);
  const rows = [];
  for (const o of list) {
    const row = rows[rows.length - 1];
    const tol = Math.max(0.3, (Number(o.depth_m) || 1) / 2);
    if (row && Math.abs(row.y - o.y_m) <= tol) row.items.push(o);
    else rows.push({ y: o.y_m, items: [o] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x_m - b.x_m));
}

// Numbers the given booths prefix+start, prefix+start+1… in reading order; other objects are untouched.
export function numberBooths(objects, ids, { prefix = DEFAULT_BOOTH_PREFIX, start = 1 } = {}) {
  const pick = new Set(ids || []);
  const ordered = readingOrder((objects || []).filter((o) => isBooth(o) && pick.has(o.id)));
  const labels = new Map(ordered.map((o, i) => [o.id, `${prefix}${Math.max(0, Math.floor(start)) + i}`]));
  return (objects || []).map((o) => (labels.has(o.id) ? { ...o, label: labels.get(o.id) } : o));
}

// Copies made by duplicate / repeat-as-grid continue the source booth's sequence (B4 → B5, B6…) instead of repeating it.
export function numberNewBooths(objects, newIds, refLabel = "") {
  const fresh = new Set(newIds || []);
  const targets = readingOrder((objects || []).filter((o) => isBooth(o) && fresh.has(o.id)));
  if (!targets.length) return objects;
  const rest = (objects || []).filter((o) => !fresh.has(o.id));
  const ref = String(refLabel || "").match(LABEL_RE);
  const prefix = ref ? ref[1] : nextBoothLabel(rest).match(LABEL_RE)[1];
  let max = 0;
  for (const o of rest) {
    const m = isBooth(o) ? String(o.label || "").match(LABEL_RE) : null;
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  const labels = new Map(targets.map((o, i) => [o.id, `${prefix}${max + 1 + i}`]));
  return objects.map((o) => (labels.has(o.id) ? { ...o, label: labels.get(o.id) } : o));
}

// Booths that can't be sold as numbered: no label, or a label another booth also uses (case-insensitive).
export function boothIssues(objects) {
  const booths = (objects || []).filter(isBooth);
  const counts = new Map();
  for (const o of booths) {
    const key = String(o.label || "").trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const unnumbered = [];
  const duplicates = [];
  for (const o of booths) {
    const key = String(o.label || "").trim().toLowerCase();
    if (!key) unnumbered.push(o.id);
    else if (counts.get(key) > 1) duplicates.push(o.id);
  }
  return { unnumbered, duplicates };
}

export function boothSummary(objects) {
  const booths = (objects || []).filter(isBooth);
  return {
    count: booths.length,
    value: round2(booths.reduce((sum, o) => sum + normaliseBoothFields(o.booth).price, 0)),
    areaM2: booths.reduce((sum, o) => sum + boothArea(o), 0),
  };
}

// The room's bounding box in metres (the hall canvas).
function roomBox(plan) {
  const outline = plan?.outline;
  if (outline?.type === "polygon" && Array.isArray(outline.points) && outline.points.length >= 3) {
    return aabbOf(outline.points.map(([x, y]) => [Number(x) || 0, Number(y) || 0]));
  }
  return { minX: 0, minY: 0, maxX: Number(plan?.widthM) || 1, maxY: Number(plan?.lengthM) || 1 };
}

// Plan (metres, centre origin) → { aspect, booths } in the hall_booths shape (percent of the room box, top-left origin).
// Ids are the instance ids, so a booth keeps its sales history across every save. A repeated number is sent once; the rest go blank.
export function hallBoothsFromPlan(plan) {
  const box = roomBox(plan);
  const W = Math.max(0.01, box.maxX - box.minX);
  const L = Math.max(0.01, box.maxY - box.minY);
  // hall_booths geometry is numeric(6,2); anything dragged absurdly far off the room is pinned inside that range.
  const pct = (v, total) => Math.min(9999, Math.max(-9999, round2((v / total) * 100)));
  const seen = new Set();
  const rows = [];
  let features = 0;
  for (const o of plan?.objects || []) {
    const booth = isBooth(o);
    if (!booth) {
      if (o.symbol === "power" || boothArea(o) < FEATURE_MIN_M2 || features >= MAX_FEATURES) continue;
      features += 1;
    }
    const label = String(o.label || "").trim();
    const key = label.toLowerCase();
    const code = booth && label && !seen.has(key) ? label : "";
    if (code) seen.add(key);
    const fields = booth ? normaliseBoothFields(o.booth) : null;
    rows.push({
      id: o.id,
      kind: booth ? "booth" : "feature",
      code,
      name: booth ? label : label || o.name || "",
      hall: booth ? fields.zone : "",
      sizeClass: booth ? fields.sizeClass : "Standard",
      price: booth ? fields.price : 0,
      x: pct(o.x_m - o.width_m / 2 - box.minX, W),
      y: pct(o.y_m - o.depth_m / 2 - box.minY, L),
      width: pct(o.width_m, W),
      height: pct(o.depth_m, L),
      rotation: round2(normaliseRotation(o.rotation)),
      sortOrder: rows.length,
    });
  }
  return { aspect: `${round2(W)}/${round2(L)}`, booths: rows };
}

export function aspectValue(aspect) {
  const [w, h] = String(aspect || "").split(/[/:]/).map(Number);
  return w > 0 && h > 0 ? w / h : 4 / 3;
}

// A legacy percent-only hall's rows → plan content at `widthM`, keeping every row id so its sales history carries over.
export function planFromHallBooths(booths, aspect, widthM = LEGACY_HALL_WIDTH_M) {
  const W = widthM;
  const L = round2(W / aspectValue(aspect));
  const objects = (booths || [])
    .filter((b) => b && b.active !== false)
    .map((b) => {
      const booth = (b.kind || "booth") === "booth";
      const w = Math.max(0.1, (Number(b.width) / 100) * W);
      const d = Math.max(0.1, (Number(b.height) / 100) * L);
      return {
        id: b.id,
        objectId: null,
        name: booth ? "Booth" : b.name || b.code || "Feature",
        category: booth ? BOOTH_CATEGORY : "decor",
        shape: "rect",
        x_m: round2((Number(b.x) / 100) * W + w / 2),
        y_m: round2((Number(b.y) / 100) * L + d / 2),
        rotation: normaliseRotation(b.rotation),
        width_m: round2(w),
        depth_m: round2(d),
        height_m: booth ? 2.5 : null,
        seats: 0,
        chairs: { mode: "none" },
        label: booth ? b.code || b.name || "" : b.name || b.code || "",
        locked: false,
        layer: booth ? "furniture" : "floor",
        ...(booth ? { booth: normaliseBoothFields({ sizeClass: b.sizeClass, price: b.price, zone: b.hall }) } : {}),
      };
    });
  return { widthM: W, lengthM: L, unit: "m", outline: { type: "rect" }, setupStyle: "custom", objects };
}
