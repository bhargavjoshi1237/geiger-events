// How good a row is, worked out from geometry the map already stores.
//
// A price sort cannot rank a venue that sells at one price. In type-first
// checkout every offer carries the SAME ticket price, so "Lowest price" had
// nothing to compare and fell through to section-then-row — which is why the
// rail listed fourteen identical-looking rows of section 104 before it reached
// anything else. Ranking needs a second axis, and the map already contains one.
//
// Three signals, all derived, none configurable:
//
//   nearness    how close the row sits to the middle of the field
//   depth       how far forward the row sits INSIDE its own section
//   centrality  how square on to the field the row is, rather than off an end
//
// `nearness` is normalised across the whole venue, so it separates the lower
// bowl from the gods. `depth` is normalised within one section, so it separates
// Row A from Row N when both are otherwise the same seat. `centrality` is what
// puts the halfway line ahead of the corner flag.
//
// Pure: no DB, no React, no organiser setup. It works on every venue already in
// the database the moment it ships.

import { aspectRatio, boxToUnits, unitCentre } from "./geometry.js";

// Nearness leads because it is the signal buyers actually price in; depth is
// the tie-break that fixes the reported bug; centrality is a nudge, not a
// verdict — a central seat in the gods must not outrank a corner seat at the
// rail.
const WEIGHTS = { nearness: 0.55, depth: 0.25, centrality: 0.2 };

const round4 = (n) => Math.round(n * 10000) / 10000;

export const rowQualityKey = (sectionId, rowLabel) => `${sectionId}::${rowLabel}`;

// 1 at the low end of the spread, 0 at the high end. A spread of zero carries no
// information, so everything scores 1 rather than 0 — an undifferentiated signal
// should not drag every score down with it.
function invNormalise(value, min, max) {
  if (!(max > min)) return 1;
  return 1 - (value - min) / (max - min);
}

// The middle of the field, in units, and which way its long axis runs.
//
// Without a field — or with one switched off — the middle of the canvas is the
// best available guess, and it is the right one for a map drawn around a centre
// feature that simply has not been marked up.
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

// Every row on the map, scored 0-1. Keyed by `sectionId::rowLabel`:
//
//   { score, nearness, depth, centrality, distance }
//
// GA zones sell by capacity and have no rows, so they are not ranked.
export function buildRowQuality({ sections = [], seats = [], field = null, aspect = 1 } = {}) {
  const ar = aspectRatio(aspect);
  const sectionById = new Map((sections || []).map((s) => [s.id, s]));
  const { centre, longAxis } = fieldFrame(field, ar);

  // Gather each row's seats, in units, dropping anything that isn't sellable.
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

  // Measure each row from its centroid.
  const measured = [];
  for (const row of rows.values()) {
    const x = row.sumX / row.count;
    const y = row.sumY / row.count;
    const distance = Math.hypot(x - centre.x, y - centre.y);
    // How far off the field's centre line the row sits, measured ALONG the long
    // axis — the difference between the halfway line and the corner.
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

  // Depth is normalised inside each section, so a shallow section's back row
  // isn't punished for sitting in front of a deep section's front row.
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
