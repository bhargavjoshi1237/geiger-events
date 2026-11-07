import { aabbIntersects, aabbOf, distanceToSegment, localToWorld, polygonsOverlap, rectPolygon } from "./geometry.js";
import { drawsChairs } from "./chairs.js";
import { footprintPolygon } from "./footprint.js";
import { normaliseSetupStyle, planStats, roomAabb, roomArea, seatTotal, setupStyleLabel } from "./plan.js";

// Setup-style capacity engine: occupancy estimates from planning rules, and egress / clearance checks on a placed plan.

// Styles estimated from usable floor area (m² per person) vs from the length of table edge that fits (perimeter).
export const AREA_STYLES = ["theatre", "classroom", "banquet", "cabaret", "reception", "custom"];
export const PERIMETER_STYLES = ["boardroom", "u_shape", "hollow_square"];
// Styles with seats; reception is standing, so its estimate is a standing headcount.
export const STANDING_STYLES = ["reception"];
// The eight named styles a room's capacity chart covers (custom has no standard figure).
export const CAPACITY_STYLES = ["theatre", "classroom", "banquet", "cabaret", "reception", "boardroom", "u_shape", "hollow_square"];

// Planning defaults (industry rules of thumb, metres): theatre ≈0.75 m²/person (8 sq ft), classroom ≈1.6 (17 sq ft),
// banquet rounds ≈1.1 (12 sq ft), cabaret ≈1.5 (16 sq ft, front arc open), reception standing ≈0.8 (9 sq ft).
export const DEFAULT_PLANNING_RULES = {
  areaPerPerson: { theatre: 0.75, classroom: 1.6, banquet: 1.1, cabaret: 1.5, reception: 0.8, custom: 1.2 },
  // Table edge per seat for boardroom / U-shape / hollow square (30 in).
  seatPitchM: 0.75,
  // Table edge to wall for perimeter layouts: pulled-out chair + a walkway behind it.
  perimeterSetbackM: 1.5,
  // Main and side aisles (fire-route width).
  mainAisleM: 1.1,
  // Chair back to chair back between neighbouring tables.
  tableClearanceM: 0.9,
  // Clear zone kept in front of every door and emergency exit.
  exitClearanceM: 1.5,
  // Service space around stages, bars, buffets and AV (counted on the working side).
  featureClearanceM: 1,
  // Front of house: front wall or stage edge to the first row.
  frontZoneM: 2,
  // Theatre row pitch, chair back to chair back.
  rowSpacingM: 0.9,
  // Most seats in a row between two aisles.
  maxSeatsPerRow: 14,
};

// Longest single boardroom table and longest U / hollow-square run the estimates assume.
export const BOARDROOM_MAX_LENGTH_M = 12;
export const PERIMETER_MAX_RUN_M = 20;
// Under this gap two pieces are treated as one joined run (not an aisle).
export const JOINED_GAP_M = 0.05;
const THEATRE_CHAIR_W = 0.5;
const PERIMETER_TABLE_DEPTH_M = 0.762;
const BOARDROOM_TABLE_DEPTH_M = 1.219;

export const RULE_LIMITS = {
  areaPerPerson: [0.3, 10],
  seatPitchM: [0.45, 1.5],
  perimeterSetbackM: [0.6, 4],
  mainAisleM: [0.6, 4],
  tableClearanceM: [0.3, 3],
  exitClearanceM: [0.3, 5],
  featureClearanceM: [0, 4],
  frontZoneM: [0, 10],
  rowSpacingM: [0.7, 1.5],
  maxSeatsPerRow: [4, 40],
};

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v, [lo, hi], fallback) => Math.min(hi, Math.max(lo, num(v, fallback)));

// Stored rules (partial, any shape) → a complete, clamped rule set.
export function normalisePlanningRules(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const d = DEFAULT_PLANNING_RULES;
  const areaPerPerson = {};
  for (const style of AREA_STYLES) {
    areaPerPerson[style] = clamp(src.areaPerPerson?.[style], RULE_LIMITS.areaPerPerson, d.areaPerPerson[style]);
  }
  const out = { areaPerPerson };
  for (const key of Object.keys(d)) {
    if (key === "areaPerPerson") continue;
    out[key] = clamp(src[key], RULE_LIMITS[key], d[key]);
  }
  out.maxSeatsPerRow = Math.round(out.maxSeatsPerRow);
  return out;
}

// --- Fixtures, features and zones ---------------------------------------------

const DOOR_SYMBOLS = new Set(["door", "door_double", "exit"]);
const FEATURE_CATEGORIES = new Set(["staging", "bars_catering", "dance_entertainment", "av"]);
// Objects whose working front needs an aisle kept clear of seating.
const SERVICE_CATEGORIES = new Set(["staging", "bars_catering"]);

export const isDoor = (o) => DOOR_SYMBOLS.has(o?.symbol);
export const isExit = (o) => o?.symbol === "exit";
export const isSeatedTable = (o) => o?.category === "tables" && drawsChairs(o);
export const isSeatBearing = (o) => (Number(o?.seats) || 0) > 0;
// Furniture that takes floor away from seating (stages, bars, dance floors, AV) — not tables or chairs.
export const isFeature = (o) => FEATURE_CATEGORIES.has(o?.category) && !isSeatBearing(o);

// The clear zone of a door / exit: its width, `depth` metres out on both faces (the room side wins; outside is never furnished).
export function exitZone(door, depth) {
  const w = (Number(door?.width_m) || 0) / 2;
  const d = (Number(door?.depth_m) || 0) / 2 + Math.max(0, Number(depth) || 0);
  const frame = { x: Number(door?.x_m) || 0, y: Number(door?.y_m) || 0, rotation: Number(door?.rotation) || 0 };
  return rectPolygon(-w, -d, w, d).map((p) => localToWorld(p, frame));
}

// --- Polygon distance ----------------------------------------------------------

function closestOnSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return [ax + t * dx, ay + t * dy];
}

// Shortest gap between two non-overlapping polygons, with the closest pair of points (for drawing the gap).
export function polygonGap(p, q) {
  let best = { distance: Infinity, a: null, b: null };
  const scan = (from, to, flip) => {
    for (const pt of from) {
      for (let i = 0; i < to.length; i += 1) {
        const a = to[i];
        const b = to[(i + 1) % to.length];
        const d = distanceToSegment(pt, a, b);
        if (d < best.distance) {
          const other = closestOnSegment(pt, a, b);
          best = flip ? { distance: d, a: other, b: pt } : { distance: d, a: pt, b: other };
        }
      }
    }
  };
  if (!p?.length || !q?.length) return best;
  scan(p, q, false);
  scan(q, p, true);
  return best;
}

const grow = (box, by) => ({ minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by });

// --- Estimates -----------------------------------------------------------------

// Room → the frame estimates work in: area, extents and (for polygon rooms) how much of the bounding box is floor.
function roomFrame(room) {
  const box = roomAabb(room);
  const width = box.maxX - box.minX;
  const length = box.maxY - box.minY;
  const area = roomArea(room);
  const fill = width * length > 0 ? Math.min(1, area / (width * length)) : 1;
  return { width, length, area, fill };
}

// Floor lost to fixtures and features already on the plan (pillars, stages, bars, AV, dance floors) and exit clear zones.
export function capacityDeductions(objects, rules) {
  const r = normalisePlanningRules(rules);
  let features = 0;
  let exits = 0;
  let structure = 0;
  for (const o of objects || []) {
    const w = Number(o.width_m) || 0;
    const d = Number(o.depth_m) || 0;
    if (isDoor(o)) {
      exits += w * r.exitClearanceM;
    } else if (o.category === "structure") {
      structure += w * d;
    } else if (isFeature(o)) {
      // Footprint plus clearance along half the perimeter (the working front and one side).
      features += w * d + (w + d) * r.featureClearanceM;
    }
  }
  return { features, exits, structure };
}

function areaEstimate(style, frame, objects, r) {
  const ded = capacityDeductions(objects, r);
  // Rows need an aisle per block of `maxSeatsPerRow`; table layouts keep one main service aisle.
  const rowStyle = style === "theatre" || style === "classroom";
  const blockWidth = r.maxSeatsPerRow * (style === "classroom" ? 0.61 : THEATRE_CHAIR_W);
  const across = Math.max(0, frame.width - 2 * r.mainAisleM);
  const aisleCount = rowStyle ? Math.max(1, Math.ceil(across / Math.max(blockWidth, 1)) - 1) : 1;
  const aisles = frame.width > 4 ? aisleCount * r.mainAisleM * frame.length * frame.fill : 0;
  const deductions = [
    { key: "features", label: "Stages, bars, AV & dance floors", areaM2: ded.features },
    { key: "structure", label: "Pillars & fixtures", areaM2: ded.structure },
    { key: "exits", label: "Exit clear zones", areaM2: ded.exits },
    { key: "aisles", label: aisleCount > 1 ? `${aisleCount} main aisles` : "Main aisle", areaM2: aisles },
  ].filter((x) => x.areaM2 > 0.01);
  const usable = Math.max(0, frame.area - deductions.reduce((s, x) => s + x.areaM2, 0));
  const perPerson = r.areaPerPerson[style] || r.areaPerPerson.custom;
  return {
    method: "area",
    usableAreaM2: usable,
    areaPerPerson: perPerson,
    deductions,
    estimate: Math.max(0, Math.floor(usable / perPerson)),
  };
}

const runSeats = (len, pitch) => Math.max(0, Math.floor((len + 1e-9) / pitch));

// Table-edge capacity for the three perimeter styles, from the floor left inside the setback.
export function perimeterEstimate(style, width, length, rules, { stage = 0 } = {}) {
  const r = normalisePlanningRules(rules);
  const p = r.seatPitchM;
  const w = Math.max(0, width - 2 * r.perimeterSetbackM);
  const l = Math.max(0, length - 2 * r.perimeterSetbackM);
  const t = PERIMETER_TABLE_DEPTH_M;
  if (style === "boardroom") {
    const long = Math.min(Math.max(w, l), BOARDROOM_MAX_LENGTH_M);
    const short = Math.min(w, l);
    if (long < 1.5 || short < 0.9) return { estimate: 0, tableLengthM: 0 };
    const ends = short >= BOARDROOM_TABLE_DEPTH_M ? 2 : 0;
    return { estimate: 2 * runSeats(long, p) + ends, tableLengthM: long };
  }
  if (style === "u_shape") {
    // Open end faces the front, which keeps a presenter zone clear.
    const base = Math.min(w, PERIMETER_MAX_RUN_M);
    const arm = Math.min(Math.max(0, length - r.perimeterSetbackM - Math.max(r.frontZoneM, stage)), PERIMETER_MAX_RUN_M);
    if (base - 2 * t < 1.5 || arm - t < p) return { estimate: 0 };
    return { estimate: runSeats(base, p) + 2 * runSeats(arm - t, p), baseM: base, armM: arm };
  }
  if (style === "hollow_square") {
    const across = Math.min(w, PERIMETER_MAX_RUN_M);
    const deep = Math.min(l, PERIMETER_MAX_RUN_M);
    if (across - 2 * t < 1.5 || deep - 2 * t < 1.5) return { estimate: 0 };
    return { estimate: 2 * runSeats(across, p) + 2 * runSeats(deep - 2 * t, p), acrossM: across, deepM: deep };
  }
  return { estimate: 0 };
}

// Max occupancy of a room for one setup style. `room` is plan-like ({ widthM, lengthM, outline, objects? }).
export function estimateCapacity(room, style, rules) {
  const r = normalisePlanningRules(rules);
  const s = normaliseSetupStyle(style);
  const frame = roomFrame(room);
  const objects = room?.objects || [];
  if (PERIMETER_STYLES.includes(s)) {
    const res = perimeterEstimate(s, frame.width, frame.length, r);
    return {
      style: s,
      label: setupStyleLabel(s),
      method: "perimeter",
      grossAreaM2: frame.area,
      usableAreaM2: null,
      areaPerPerson: null,
      deductions: [],
      seatPitchM: r.seatPitchM,
      standing: false,
      estimate: res.estimate,
    };
  }
  const res = areaEstimate(s, frame, objects, r);
  return { style: s, label: setupStyleLabel(s), grossAreaM2: frame.area, standing: STANDING_STYLES.includes(s), ...res };
}

// Estimates for every named style — the venue capacity chart for a bare room.
export function estimateAllStyles(room, rules) {
  return Object.fromEntries(CAPACITY_STYLES.map((s) => [s, estimateCapacity(room, s, rules)]));
}

// Venue space (metres, may lack dimensions) → plan-like room, or null.
export function spaceRoom(space) {
  const w = Number(space?.widthM);
  const l = Number(space?.lengthM);
  if (!(w > 0) || !(l > 0)) return null;
  return { widthM: w, lengthM: l, outline: { type: "rect" }, objects: [] };
}

// Fire-certificate max occupancy recorded on a venue space (config.maxOccupancy), or null.
export function spaceMaxOccupancy(space) {
  const n = Math.floor(Number(space?.config?.maxOccupancy));
  return n > 0 ? n : null;
}

// The space's stated capacity for a style (venue_spaces.capacities), or null.
export function spaceStatedCapacity(space, style) {
  const n = Math.floor(Number(space?.capacities?.[style]));
  return n > 0 ? n : null;
}

// --- Plan validation -------------------------------------------------------------

const nameOf = (o) => {
  if (!o) return "An object";
  if (o.label && o.category === "tables") return /^\d+$/.test(o.label) ? `Table ${o.label}` : o.label;
  return o.label || o.name || "An object";
};

const fmt = (m) => `${Math.round(m * 100) / 100} m`;

// Rows of single theatre-style chairs (same facing, same line, touching) longer than the max between aisles.
function longRows(objects, maxSeats) {
  const singles = objects.filter((o) => o.category === "seating" && (Number(o.seats) || 0) === 1);
  const lines = new Map();
  for (const o of singles) {
    const t = ((Number(o.rotation) || 0) * Math.PI) / 180;
    const along = o.x_m * Math.cos(t) + o.y_m * Math.sin(t);
    const perp = -o.x_m * Math.sin(t) + o.y_m * Math.cos(t);
    const key = `${Math.round(Number(o.rotation) || 0)}|${Math.round(perp / 0.2)}`;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ o, along });
  }
  const out = [];
  for (const list of lines.values()) {
    list.sort((a, b) => a.along - b.along);
    let run = [list[0]];
    const flush = () => {
      if (run.length > maxSeats) out.push(run.map((x) => x.o));
    };
    for (let i = 1; i < list.length; i += 1) {
      const prev = run[run.length - 1];
      const gap = list[i].along - prev.along - (list[i].o.width_m + prev.o.width_m) / 2;
      if (gap > 0.3) {
        flush();
        run = [list[i]];
      } else {
        run.push(list[i]);
      }
    }
    flush();
  }
  return out;
}

// Everything that's wrong with a plan's capacity and egress, as issues carrying object ids (and shapes) to highlight.
export function validatePlanCapacity(plan, { rules, space } = {}) {
  const r = normalisePlanningRules(rules);
  const style = normaliseSetupStyle(plan?.setupStyle);
  const objects = plan?.objects || [];
  const seats = seatTotal(objects);
  const estimate = estimateCapacity(plan, style, r);
  const stated = spaceStatedCapacity(space, style);
  const maxOccupancy = spaceMaxOccupancy(space);
  const standing = STANDING_STYLES.includes(style);
  const occupancy = standing ? estimate.estimate : seats;
  const issues = [];

  if (maxOccupancy && occupancy > maxOccupancy) {
    issues.push({
      id: "max-occupancy",
      kind: "max_occupancy",
      severity: "error",
      group: "capacity",
      title: standing ? "Standing estimate tops max occupancy" : "Over the room's max occupancy",
      detail: `${occupancy} ${standing ? "guests" : "seats"} against a certified maximum of ${maxOccupancy}.`,
      objectIds: [],
    });
  }
  if (!standing && stated && seats > stated) {
    issues.push({
      id: "stated",
      kind: "over_stated",
      severity: "warning",
      group: "capacity",
      title: `Above the space's ${estimate.label.toLowerCase()} capacity`,
      detail: `${seats} seats placed; ${space?.name || "the space"} lists ${stated} for ${estimate.label.toLowerCase()}.`,
      objectIds: [],
    });
  }
  if (!standing && style !== "custom" && estimate.estimate > 0 && seats > estimate.estimate) {
    issues.push({
      id: "estimate",
      kind: "over_estimate",
      severity: "warning",
      group: "capacity",
      title: "More seats than the planning rules allow",
      detail: `${seats} seats placed; ${estimate.label.toLowerCase()} planning allows about ${estimate.estimate} here.`,
      objectIds: [],
    });
  }

  // Exit and door clear zones.
  const zones = [];
  for (const door of objects.filter(isDoor)) {
    const zone = exitZone(door, r.exitClearanceM);
    const zoneBox = aabbOf(zone);
    const blockers = objects.filter((o) => {
      // Dance floors are floor coverings — people can walk across them to the door.
      if (o.id === door.id || o.category === "structure" || o.symbol === "dance") return false;
      const fp = footprintPolygon(o, { withChairs: true });
      return aabbIntersects(aabbOf(fp), zoneBox, 0.005) && polygonsOverlap(fp, zone, 0.005);
    });
    zones.push({ id: door.id, polygon: zone, exit: isExit(door), blocked: blockers.length > 0 });
    if (blockers.length) {
      issues.push({
        id: `exit-${door.id}`,
        kind: "exit_blocked",
        severity: isExit(door) ? "error" : "warning",
        group: "egress",
        title: isExit(door) ? "Emergency exit blocked" : "Doorway blocked",
        detail: `${blockers.slice(0, 3).map(nameOf).join(", ")}${blockers.length > 3 ? ` and ${blockers.length - 3} more` : ""} inside the ${fmt(r.exitClearanceM)} clear zone.`,
        objectIds: [door.id, ...blockers.map((b) => b.id)],
        zone,
      });
    }
  }

  // Narrow gaps: table to table (chair to chair), and seating to the working front of stages and bars.
  const seated = objects.filter(isSeatedTable);
  const seatingAll = objects.filter((o) => isSeatedTable(o) || o.category === "seating");
  const service = objects.filter((o) => SERVICE_CATEGORIES.has(o.category) && !isSeatBearing(o));
  const fp = new Map();
  const polyOf = (o) => {
    if (!fp.has(o.id)) fp.set(o.id, footprintPolygon(o, { withChairs: true }));
    return fp.get(o.id);
  };
  const gapIssue = (a, b, min, kind) => {
    const pa = polyOf(a);
    const pb = polyOf(b);
    if (!aabbIntersects(grow(aabbOf(pa), min), aabbOf(pb), 0)) return;
    if (polygonsOverlap(pa, pb, 0.005)) return;
    const gap = polygonGap(pa, pb);
    if (!(gap.distance >= JOINED_GAP_M && gap.distance < min - 0.005)) return;
    issues.push({
      id: `${kind}-${a.id}-${b.id}`,
      kind,
      severity: "warning",
      group: "egress",
      title: kind === "narrow_aisle" ? "Narrow gap between tables" : `Tight aisle at the ${b.category === "staging" ? "stage" : "bar"}`,
      detail: `${nameOf(a)} and ${nameOf(b)} are ${fmt(gap.distance)} apart (needs ${fmt(min)}).`,
      objectIds: [a.id, b.id],
      segment: [gap.a, gap.b],
      gapM: gap.distance,
    });
  };
  for (let i = 0; i < seated.length; i += 1) {
    for (let j = i + 1; j < seated.length; j += 1) gapIssue(seated[i], seated[j], r.tableClearanceM, "narrow_aisle");
  }
  for (const s of seatingAll) {
    for (const f of service) gapIssue(s, f, r.mainAisleM, "service_aisle");
  }

  for (const row of longRows(objects, r.maxSeatsPerRow)) {
    issues.push({
      id: `row-${row[0].id}`,
      kind: "long_row",
      severity: "warning",
      group: "egress",
      title: "Row too long between aisles",
      detail: `${row.length} seats in one run (max ${r.maxSeatsPerRow} between aisles).`,
      objectIds: row.map((o) => o.id),
    });
  }

  const stats = planStats(plan);
  if (stats.outsideIds.length) {
    issues.push({
      id: "outside",
      kind: "outside_room",
      severity: "error",
      group: "layout",
      title: `${stats.outsideIds.length} object${stats.outsideIds.length === 1 ? "" : "s"} outside the room`,
      detail: "Move them inside the walls — they can't be set up there.",
      objectIds: stats.outsideIds,
    });
  }
  if (stats.overlappingIds.length) {
    issues.push({
      id: "overlap",
      kind: "overlap",
      severity: "warning",
      group: "layout",
      title: `${stats.overlappingIds.length} objects overlap`,
      detail: "Chairs or furniture collide — spread them out.",
      objectIds: stats.overlappingIds,
    });
  }

  const limits = [stated, maxOccupancy, style === "custom" ? null : estimate.estimate || null].filter((n) => n > 0);
  const egress = issues.filter((i) => i.group === "egress");
  return {
    style,
    label: estimate.label,
    standing,
    seats,
    occupancy,
    estimate,
    stated,
    maxOccupancy,
    capacity: limits.length ? Math.min(...limits) : null,
    issues,
    zones,
    flaggedIds: [...new Set(issues.flatMap((i) => i.objectIds))],
    counts: {
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      egress: egress.length,
      total: issues.length,
    },
  };
}

// The style a room seats most people in, with its estimate.
export function largestEstimate(estimates) {
  let best = null;
  for (const s of CAPACITY_STYLES) {
    const e = estimates?.[s];
    if (e && (!best || e.estimate > best.estimate)) best = e;
  }
  return best;
}
