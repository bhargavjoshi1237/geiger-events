
import { aspectRatio, boxToUnits, unitCentre } from "./geometry.js";

const WEIGHTS = { nearness: 0.55, depth: 0.25, centrality: 0.2 };

const round4 = (n) => Math.round(n * 10000) / 10000;

export const rowQualityKey = (sectionId, rowLabel) => `${sectionId}::${rowLabel}`;

function invNormalise(value, min, max) {
  if (!(max > min)) return 1;
  return 1 - (value - min) / (max - min);
}

function fieldFrame(field, ar) {
  if (!field || field.shape === "none" || !(Number(field.width) > 0)) {
    return { centre: { x: 50 * ar, y: 50 }, longAxis: ar >= 1 ? "x" : "y" };
  }
  const box = boxToUnits(field, ar);
  return {
    centre: unitCentre(box),
    longAxis: box.width >= box.height ? "x" : "y",
  };
}

export function buildRowQuality({ sections = [], seats = [], field = null, aspect = 1 } = {}) {
  const ar = aspectRatio(aspect);
  const sectionById = new Map((sections || []).map((s) => [s.id, s]));
  const { centre, longAxis } = fieldFrame(field, ar);

  const rows = new Map();
  for (const seat of seats || []) {
    const section = sectionById.get(seat.sectionId);
    if (!section || section.kind === "ga") continue;
    const key = rowQualityKey(seat.sectionId, seat.rowLabel);
    const entry = rows.get(key);
    const point = { x: (Number(seat.x) || 0) * ar, y: Number(seat.y) || 0 };
    if (entry) {
      entry.sumX += point.x;
      entry.sumY += point.y;
      entry.count += 1;
    } else {
      rows.set(key, {
        key,
        sectionId: seat.sectionId,
        rowLabel: seat.rowLabel,
        sumX: point.x,
        sumY: point.y,
        count: 1,
      });
    }
  }
  if (rows.size === 0) return {};

  const measured = [];
  for (const row of rows.values()) {
    const x = row.sumX / row.count;
    const y = row.sumY / row.count;
    const distance = Math.hypot(x - centre.x, y - centre.y);
    const offset = longAxis === "x" ? Math.abs(x - centre.x) : Math.abs(y - centre.y);
    measured.push({ ...row, distance, offset });
  }

  let dMin = Infinity;
  let dMax = -Infinity;
  let oMax = 0;
  const bySection = new Map();
  for (const row of measured) {
    if (row.distance < dMin) dMin = row.distance;
    if (row.distance > dMax) dMax = row.distance;
    if (row.offset > oMax) oMax = row.offset;
    const list = bySection.get(row.sectionId);
    if (list) list.push(row);
    else bySection.set(row.sectionId, [row]);
  }

  const depthBounds = new Map();
  for (const [sectionId, list] of bySection) {
    let min = Infinity;
    let max = -Infinity;
    for (const row of list) {
      if (row.distance < min) min = row.distance;
      if (row.distance > max) max = row.distance;
    }
    depthBounds.set(sectionId, { min, max });
  }

  const out = {};
  for (const row of measured) {
    const bounds = depthBounds.get(row.sectionId);
    const nearness = invNormalise(row.distance, dMin, dMax);
    const depth = invNormalise(row.distance, bounds.min, bounds.max);
    const centrality = oMax > 0 ? 1 - row.offset / oMax : 1;
    const score =
      nearness * WEIGHTS.nearness + depth * WEIGHTS.depth + centrality * WEIGHTS.centrality;

    out[row.key] = {
      sectionId: row.sectionId,
      rowLabel: row.rowLabel,
      score: round4(Math.min(1, Math.max(0, score))),
      nearness: round4(nearness),
      depth: round4(depth),
      centrality: round4(centrality),
      distance: round4(row.distance),
    };
  }
  return out;
}

export default buildRowQuality;
