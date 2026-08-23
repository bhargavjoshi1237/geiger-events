// Pure bowl geometry. Lays a whole venue's sections out around a central field
// in one call, so an arena isn't dragged into existence one rectangle at a time.
// No DB, no React — it returns plain section drafts the editor persists.
//
// Two rules make the output read like a real venue rather than a pile of boxes:
//
// 1. Everything is computed in UNIT space (see geometry.js), because the canvas
//    is 16:10, not square. A ring built in raw percent is an egg, and the
//    facing angles it produces disagree with the CSS rotation that draws the
//    block — which is what used to stack sections on top of each other.
// 2. Sections are spread by ARC LENGTH along the ring, not by angle, and each
//    one is exactly as wide as its share of that arc minus a vomitory gap. Two
//    neighbours therefore cannot overlap however eccentric the bowl is.
//
// The convention that matters downstream: generateSeats() puts row A at the TOP
// of a section box, so an unrotated section faces UP. Every rotation below
// exists to point that front edge at the field.

import {
  aspectRatio,
  canvasUnits,
  facingDirection,
  round2,
  xToPercent,
} from "./geometry.js";

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const BOWL_SHAPES = [
  { value: "oval", label: "Oval stadium", hint: "Sections ring an elliptical pitch." },
  { value: "rect", label: "Rectangular arena", hint: "Straight sides with filled corners, around a court or rink." },
  { value: "horseshoe", label: "Theatre horseshoe", hint: "Seats fan around a stage at one end." },
  { value: "rounds", label: "Banquet rounds", hint: "Tables in a grid around a central floor." },
];

export const DEFAULT_FIELD = {
  shape: "pitch",
  x: 33,
  y: 36,
  width: 34,
  height: 28,
  rotation: 0,
  label: "Field",
};

// Where the central feature belongs for each bowl shape, as percent of canvas.
//
// A brand-new seat map inherits the legacy proscenium field — a thin strip
// pinned to y=2, hard against the top edge. There is nowhere to put a ring
// around that, so generating any bowl on a fresh map produced a hairline
// crammed into one corner. The dialog offers these instead: a bowl is defined
// by its centre feature, so laying one out means placing that too.
const SUGGESTED_FIELDS = {
  oval: { shape: "pitch", x: 32, y: 33, width: 36, height: 34, label: "Pitch" },
  rect: { shape: "court", x: 34, y: 35, width: 32, height: 30, label: "Court" },
  // Sat low, because a horseshoe's seating fans out BELOW the stage — placing
  // it high leaves the bowl hanging off the bottom of the canvas.
  horseshoe: { shape: "stage", x: 30, y: 34, width: 40, height: 10, label: "Stage" },
  rounds: { shape: "floor", x: 38, y: 40, width: 24, height: 20, label: "Dance floor" },
};

// The central feature to build `shape` around, keeping whatever label the
// organiser already typed.
export function suggestField(shape, current = null) {
  const base = SUGGESTED_FIELDS[shape] || SUGGESTED_FIELDS.oval;
  return {
    ...base,
    rotation: 0,
    label: current?.label && current.label !== "Field" ? current.label : base.label,
  };
}

const DEFAULT_LAYOUT = {
  rows: 12,
  seatsPerRow: 14,
  rowLabels: "alpha",
  rowLabelStart: "A",
  numbering: "continental",
  curve: 0,
  rake: 0,
  aisleAfter: [],
};

// Clear space left between neighbouring sections, as a share of each one's
// share of the ring — the walkway a real bowl has between blocks.
const VOMITORY = 0.2;
// Units of blank canvas kept outside the outermost tier.
const MARGIN = 2;
// Narrowest a block may be before the ring is given fewer of them. A tight ring
// asked for 50 sections would otherwise produce unreadable slivers.
const MIN_SECTION = 3;
// How stretched a ring may get. Beyond this the ends turn into cusps.
const MAX_ECCENTRICITY = 2.2;
// Shallowest a tier may be before it is dropped rather than squeezed further.
const MIN_DEPTH = 3;
// Least clear space between the field and the first ring, whatever `gap` says.
const MIN_CLEARANCE = 1.5;

// A horseshoe leaves the top 120 degrees open for the stage; the seating runs
// from upper-right, under the field, round to upper-left.
const HORSESHOE_FROM = (11 * Math.PI) / 6; // -30 degrees, once round
const HORSESHOE_TO = (7 * Math.PI) / 6; // 210 degrees

// The parameter range a shape's seating covers on THIS ring.
//
// The opening has to be defined by ANGLE, not by parameter: the same parameter
// points somewhere else on each tier's ring, so a parameter-defined opening
// widened tier by tier until the shared aisle lines fell outside it and the
// blocks at both ends collapsed into slivers.
function sweepRange(shape, path, cx, cy) {
  if (shape !== "horseshoe") return { from: 0, to: 1 };
  const full = arcTable(path, 0, 1, cx, cy);
  return {
    from: tAtBearing(full, HORSESHOE_FROM) - 1,
    to: tAtBearing(full, HORSESHOE_TO),
  };
}

// Rotation that turns a section's front edge toward the centre of a CIRCULAR
// bowl at angle `phi`. Kept for the circle case and for callers that reason in
// plain angles; ring sections use the true ellipse normal instead.
export function facingRotation(phi) {
  return facingDirection(-Math.cos(phi), -Math.sin(phi));
}

// Tier 1 -> 101, 102 … tier 2 -> 201, 202 …
function sectionName(tierIndex, n) {
  return String((tierIndex + 1) * 100 + n);
}

// A draft in UNIT space -> the percent-space row the sections table stores.
function draft({ name, cx, cy, width, depth, rotation, layout, sortOrder, ar }) {
  return {
    name,
    kind: "seated",
    x: round2(xToPercent(cx - width / 2, ar)),
    y: round2(cy - depth / 2),
    // No size floor here: widening a block after it has been fitted to its
    // share of the ring is exactly how neighbours start touching again. Slivers
    // are prevented by capping the section COUNT instead (see MIN_SECTION).
    width: round2(xToPercent(width, ar)),
    height: round2(depth),
    rotation: round2(((rotation % 360) + 360) % 360),
    layout: { ...DEFAULT_LAYOUT, ...layout },
    sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Ring paths
// ---------------------------------------------------------------------------
//
// Every shape is a closed parametric loop around the field, taken over u in
// [0, 1) and periodic beyond it, so a partial sweep is just a sub-range of u.
// One path function per shape is all the difference between an oval stadium and
// a rectangular arena — placement, spacing, facing and fitting are shared.
//
// u = 0 is the right-hand extreme; u increases downward (y grows down), which
// keeps the cardinal facings the same as the old angle-based ring.

function ellipsePath(cx, cy, rx, ry) {
  return (u) => {
    const t = u * TAU;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  };
}

// A rounded rectangle — straight sides with turned corners, which is what an
// arena bowl actually looks like. Built piecewise rather than from sign(cos u),
// which jumps at every axis crossing and tears the ring apart.
function roundedRectPath(cx, cy, rx, ry, r) {
  const radius = clamp(r, 0, Math.min(rx, ry));
  const ax = Math.max(0, rx - radius);
  const ay = Math.max(0, ry - radius);
  const quarter = (radius * Math.PI) / 2;
  // Segment lengths, in path order from (cx + rx, cy) going down.
  const segs = [ay, quarter, 2 * ax, quarter, 2 * ay, quarter, 2 * ax, quarter, ay];
  const total = segs.reduce((sum, n) => sum + n, 0) || 1;

  const arc = (acx, acy, from, s) => {
    const t = from + (radius ? s / radius : 0);
    return { x: acx + radius * Math.cos(t), y: acy + radius * Math.sin(t) };
  };

  return (u) => {
    let s = ((u % 1) + 1) % 1 * total;
    let i = 0;
    while (i < segs.length && s > segs[i]) {
      s -= segs[i];
      i += 1;
    }
    switch (i) {
      case 0: return { x: cx + rx, y: cy + s };                            // right, downward
      case 1: return arc(cx + ax, cy + ay, 0, s);                          // bottom-right
      case 2: return { x: cx + ax - s, y: cy + ry };                       // bottom
      case 3: return arc(cx - ax, cy + ay, Math.PI / 2, s);                // bottom-left
      case 4: return { x: cx - rx, y: cy + ay - s };                       // left, upward
      case 5: return arc(cx - ax, cy - ay, Math.PI, s);                    // top-left
      case 6: return { x: cx - ax + s, y: cy - ry };                       // top
      case 7: return arc(cx + ax, cy - ay, -Math.PI / 2, s);               // top-right
      default: return { x: cx + rx, y: cy - ay + s };                      // right, back to start
    }
  };
}

// Sample a path into an arc-length table so sections can be spaced by distance
// travelled rather than by angle — the whole reason neighbours stop colliding
// on an eccentric ring.
// It also records each sample's BEARING from the bowl centre, unwrapped so it
// increases monotonically along the sweep. Aisle lines are shared between tiers
// by direction, not by parameter: the same parameter on a rounder outer ring
// points somewhere else entirely, which is why parameter-matched walkways came
// out staggered.
function arcTable(path, from, to, cx, cy, samples = 720) {
  const ts = [];
  const points = [];
  const cum = [0];
  const bear = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = from + ((to - from) * i) / samples;
    const p = path(t);
    ts.push(t);
    points.push(p);
    if (i > 0) {
      const prev = points[i - 1];
      cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    }
    const raw = Math.atan2(p.y - cy, p.x - cx);
    if (i === 0) {
      bear.push(raw);
    } else {
      // Keep it continuous across the -pi/+pi seam.
      const delta = Math.atan2(Math.sin(raw - bear[i - 1]), Math.cos(raw - bear[i - 1]));
      bear.push(bear[i - 1] + delta);
    }
  }
  return { ts, points, cum, bear, total: cum[cum.length - 1] };
}

// Bearing -> the parameter that points that way. Both ring shapes are
// star-shaped about the bowl centre, so bearing rises monotonically along the
// sweep and a binary search is exact.
function tAtBearing(table, phi) {
  const last = table.bear.length - 1;
  if (phi <= table.bear[0]) return table.ts[0];
  if (phi >= table.bear[last]) return table.ts[last];
  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.bear[mid] <= phi) lo = mid;
    else hi = mid;
  }
  const span = table.bear[hi] - table.bear[lo] || 1;
  const f = (phi - table.bear[lo]) / span;
  return table.ts[lo] + (table.ts[hi] - table.ts[lo]) * f;
}

// Parameter -> bearing, for turning tier 1's evenly-spread blocks into the
// aisle directions every other tier will reuse.
function bearingAtT(table, u) {
  const last = table.ts.length - 1;
  if (u <= table.ts[0]) return table.bear[0];
  if (u >= table.ts[last]) return table.bear[last];
  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.ts[mid] <= u) lo = mid;
    else hi = mid;
  }
  const span = table.ts[hi] - table.ts[lo] || 1;
  const f = (u - table.ts[lo]) / span;
  return table.bear[lo] + (table.bear[hi] - table.bear[lo]) * f;
}

// Parameter -> distance travelled to reach it. The inverse of tAtArc, used to
// measure how wide a section spanning two aisle lines actually is.
function arcAtT(table, u) {
  const last = table.ts.length - 1;
  if (u <= table.ts[0]) return 0;
  if (u >= table.ts[last]) return table.total;
  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.ts[mid] <= u) lo = mid;
    else hi = mid;
  }
  const span = table.ts[hi] - table.ts[lo] || 1;
  const f = (u - table.ts[lo]) / span;
  return table.cum[lo] + (table.cum[hi] - table.cum[lo]) * f;
}

// Distance along the table -> the parameter t there.
function tAtArc(table, s) {
  const target = clamp(s, 0, table.total);
  let lo = 0;
  let hi = table.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = table.cum[hi] - table.cum[lo] || 1;
  const f = (target - table.cum[lo]) / span;
  return table.ts[lo] + (table.ts[hi] - table.ts[lo]) * f;
}

// Outward unit normal at t, taken from the local tangent so it is correct on a
// straight run and on a corner alike. Falls back to the radial direction if the
// path degenerates.
function outwardNormal(path, t, cx, cy) {
  const h = 1e-4;
  const a = path(t - h);
  const b = path(t + h);
  let tx = b.x - a.x;
  let ty = b.y - a.y;
  const length = Math.hypot(tx, ty);
  const here = path(t);
  if (!length) {
    const rx = here.x - cx;
    const ry = here.y - cy;
    const rl = Math.hypot(rx, ry) || 1;
    return { x: rx / rl, y: ry / rl };
  }
  tx /= length;
  ty /= length;
  // Two perpendiculars; keep the one pointing away from the bowl centre.
  const nx = ty;
  const ny = -tx;
  const away = (here.x - cx) * nx + (here.y - cy) * ny;
  return away >= 0 ? { x: nx, y: ny } : { x: -nx, y: -ny };
}

// Is a point inside the tier's outer boundary? Offsetting either ring outward
// by the tier depth is exact — an ellipse grows both radii, a rounded rect
// grows its half-extents and its corner radius by the same amount.
function outerBoundary(shape, cx, cy, rx, ry, corner, depth) {
  const RX = rx + depth;
  const RY = ry + depth;
  if (shape !== "rect") {
    return (p) => {
      const dx = (p.x - cx) / RX;
      const dy = (p.y - cy) / RY;
      return dx * dx + dy * dy <= 1;
    };
  }
  const R = corner + depth;
  const ax = Math.max(0, RX - R);
  const ay = Math.max(0, RY - R);
  return (p) => {
    const dx = Math.abs(p.x - cx);
    const dy = Math.abs(p.y - cy);
    if (dx > RX || dy > RY) return false;
    const qx = Math.max(dx - ax, 0);
    const qy = Math.max(dy - ay, 0);
    return Math.hypot(qx, qy) <= R;
  };
}

// Place one block in each gap between consecutive aisle lines, sitting just
// outside the ring and facing in.
//
// `aisles` is a list of parameter values — the walkways that run out from the
// field. Every tier is handed the SAME lines (subdivided for the outer rings),
// which is what turns the gaps between blocks into the continuous radial spokes
// a real bowl has, instead of the staggered joints you get when each ring
// divides its own circumference independently.
function distribute({
  path, table, aisles, depth, cx, cy, tierIndex, layout, sortBase, ar, contains,
}) {
  const out = [];
  const count = aisles.length - 1;

  for (let n = 0; n < count; n += 1) {
    // The wedge this block owns, and the ring points where its walkways fall.
    const from = aisles[n];
    const to = aisles[n + 1];
    const p0 = path(tAtBearing(table, from));
    const p1 = path(tAtBearing(table, to));

    // A block is a straight rectangle, so it spans the CHORD between its two
    // aisle lines, less the walkway itself.
    const width = Math.max(0.2, Math.hypot(p1.x - p0.x, p1.y - p0.y) * (1 - VOMITORY));
    const half = width / 2;

    // Centred on the middle of its wedge, so the walkway either side is the
    // same width and the aisles stay straight from tier to tier.
    const t = tAtBearing(table, (from + to) / 2);
    const p = path(t);
    const normal = outwardNormal(path, t, cx, cy);
    // Along-ring direction, so the block's corners can be placed exactly.
    const tangent = { x: -normal.y, y: normal.x };

    // A block is a straight rectangle standing on a curve, so its outer CORNERS
    // reach beyond its outer edge — far enough, on a tight ring, to cross into
    // the next tier's band. Find the deepest box whose corners still sit inside
    // this tier's outer boundary, so tiers can never collide.
    const cornersFit = (d) =>
      [-half, half].every((side) =>
        contains({
          x: p.x + normal.x * d + tangent.x * side,
          y: p.y + normal.y * d + tangent.y * side,
        }),
      );

    let boxDepth = depth;
    if (!cornersFit(depth)) {
      let lo = 0;
      let hi = depth;
      for (let i = 0; i < 20; i += 1) {
        const mid = (lo + hi) / 2;
        if (cornersFit(mid)) lo = mid;
        else hi = mid;
      }
      boxDepth = Math.max(lo, depth * 0.1);
    }

    out.push(
      draft({
        name: sectionName(tierIndex, n + 1),
        // Step out by half the depth so the block's inner edge rests on the ring.
        cx: p.x + normal.x * (boxDepth / 2),
        cy: p.y + normal.y * (boxDepth / 2),
        width,
        depth: boxDepth,
        // Face the bowl centre: the front edge points along the inward normal.
        rotation: facingDirection(-normal.x, -normal.y),
        layout,
        sortOrder: sortBase + n,
        ar,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Banquet rounds
// ---------------------------------------------------------------------------

// Tables in a grid that skips the middle, where the field (dance floor, stage)
// sits. Cells are square in UNIT space, so a table reads as a table rather than
// as a squashed oval.
function banquetTables({ count, field, seatsPerTable, sortBase, ar }) {
  const canvas = canvasUnits(ar);
  const wanted = Math.max(1, Math.round(count));
  const out = [];

  // Grow the grid until the exclusion zone has been paid for and every table
  // asked for actually fits.
  for (let extra = 0; extra <= 12 && out.length < wanted; extra += 1) {
    out.length = 0;
    const cols = Math.ceil(Math.sqrt((wanted + extra * 4) * (canvas.width / canvas.height)));
    const rows = Math.ceil((wanted + extra * 4) / cols);
    const stepX = (canvas.width - MARGIN * 2) / cols;
    const stepY = (canvas.height - MARGIN * 2) / rows;
    const size = Math.max(4, Math.min(stepX, stepY) * 0.78);

    for (let r = 0; r < rows && out.length < wanted; r += 1) {
      for (let c = 0; c < cols && out.length < wanted; c += 1) {
        const px = MARGIN + stepX * (c + 0.5);
        const py = MARGIN + stepY * (r + 0.5);
        // Skip any cell that would sit on the dance floor.
        const onFloor =
          px > field.x - size / 2 &&
          px < field.x + field.width + size / 2 &&
          py > field.y - size / 2 &&
          py < field.y + field.height + size / 2;
        if (onFloor) continue;
        out.push(
          draft({
            name: `Table ${out.length + 1}`,
            cx: px,
            cy: py,
            width: size,
            depth: size,
            rotation: 0,
            layout: {
              rows: 2,
              seatsPerRow: Math.max(1, Math.round(seatsPerTable / 2)),
              rowLabels: "numeric",
              rowLabelStart: "1",
              numbering: "continental",
            },
            sortOrder: sortBase + out.length,
            ar,
          }),
        );
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The bowl
// ---------------------------------------------------------------------------

// The smallest ring, of the field's proportions, that clears the field by
// `inset` on every side. A plain `half + inset` ellipse cuts the field's
// corners — which is how sections used to end up standing on the pitch.
//
// The ring is then de-eccentricised: a very long, flat field would otherwise
// give an ellipse whose ends are almost cusps, and blocks sitting on a cusp
// fan into each other. Real bowls round their ends off, so we do too.
function clearingRadii(a, b, inset) {
  const clear = Math.max(inset, MIN_CLEARANCE);
  let rx = a + clear;
  let ry = b + clear;

  // Expand until the field's CORNER is `clear` inside the ring, not merely on
  // it. Scaling only until the corner touches — which is what a plain
  // enclosure test gives you — leaves zero margin exactly where the diagonal
  // blocks sit, so one of them ends up standing on the pitch.
  const diagonal = Math.hypot(a, b) || 1;
  const target = 1 / (1 + clear / diagonal);
  const m = Math.hypot(a / rx, b / ry);
  if (m > target) {
    const k = m / target;
    rx *= k;
    ry *= k;
  }
  if (rx > ry * MAX_ECCENTRICITY) ry = rx / MAX_ECCENTRICITY;
  if (ry > rx * MAX_ECCENTRICITY) rx = ry / MAX_ECCENTRICITY;
  return { rx, ry };
}

// Lay out a whole bowl.
//
//   shape       oval | rect | horseshoe | rounds
//   tiers       how many concentric rings (ignored by `rounds`)
//   perSide     sections per quarter turn of the LOWER tier; outer tiers get
//               proportionally more so every block stays about the same width
//   field       { x, y, width, height } in percent — the ring is built around it
//   gap         clear space between the field and tier 1, and between tiers
//   tierDepth   how deep (how many rows' worth) each ring is
//   aspect      the map's canvas shape; geometry is wrong without it
//
// Returns { drafts, tiers, requestedTiers, fits } — the section drafts ready
// for createSection(), plus what had to be adjusted to keep the bowl on the
// canvas, so the dialog can say so instead of silently producing something
// else. Nothing is persisted here.
export function planBowl(options = {}) {
  const {
    shape = "oval",
    tiers = 2,
    perSide = 6,
    field = DEFAULT_FIELD,
    gap = 2.5,
    tierDepth = 10,
    rows = 12,
    seatsPerRow = 14,
    seatsPerTable = 10,
    tables = 16,
    aspect = "16/10",
  } = options;

  const ar = aspectRatio(aspect);
  const canvas = canvasUnits(ar);
  const layout = { ...DEFAULT_LAYOUT, rows, seatsPerRow };

  // The field, in units.
  const fx = (Number(field?.x) || 0) * ar;
  const fy = Number(field?.y) || 0;
  const fw = Math.max(0, Number(field?.width) || 0) * ar;
  const fh = Math.max(0, Number(field?.height) || 0);
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;

  if (shape === "rounds") {
    const drafts = banquetTables({
      count: tables,
      field: { x: fx, y: fy, width: fw, height: fh },
      seatsPerTable,
      sortBase: 0,
      ar,
    });
    return { drafts, tiers: 1, requestedTiers: 1, fits: true };
  }

  const perSideCount = clamp(Math.round(perSide) || 1, 1, 24);
  const a = fw / 2;
  const b = fh / 2;

  const ringGapOf = (g) => Math.max(0.5, g);
  const ringDepthOf = (d) => Math.max(1, d);

  // The bounding box the outermost of `n` tiers actually occupies. Measured
  // along the SWEEP, not from a symmetric radius: a horseshoe's wings stop at
  // the stage, so charging it for a full ring's headroom above the stage — as
  // the old symmetric extent did — squeezed the whole bowl into a sliver.
  const extentFor = (n, g, d) => {
    const depth = ringDepthOf(d);
    const r = clearingRadii(a, b, ringGapOf(g));
    const step = (n - 1) * (depth + ringGapOf(g));
    const rx = r.rx + step;
    const ry = r.ry + step;
    // The tier's OUTER boundary: offsetting a ring outward grows its radii, and
    // a rounded rect's corner radius, by the depth.
    const corner = Math.min(rx, ry) * 0.3;
    const outer =
      shape === "rect"
        ? roundedRectPath(cx, cy, rx + depth, ry + depth, corner + depth)
        : ellipsePath(cx, cy, rx + depth, ry + depth);

    const span = sweepRange(shape, outer, cx, cy);
    let x1 = Infinity;
    let x2 = -Infinity;
    let y1 = Infinity;
    let y2 = -Infinity;
    const samples = 360;
    for (let i = 0; i <= samples; i += 1) {
      const p = outer(span.from + ((span.to - span.from) * i) / samples);
      x1 = Math.min(x1, p.x);
      x2 = Math.max(x2, p.x);
      y1 = Math.min(y1, p.y);
      y2 = Math.max(y2, p.y);
    }
    return { x1, x2, y1, y2 };
  };
  const fits = (n, g, d) => {
    const e = extentFor(n, g, d);
    return (
      e.x1 >= MARGIN &&
      e.x2 <= canvas.width - MARGIN &&
      e.y1 >= MARGIN &&
      e.y2 <= canvas.height - MARGIN
    );
  };
  // Largest fraction of the requested gap/depth that keeps `n` tiers on the
  // canvas, or 0 when even a hairline ring overflows.
  const solveScale = (n) => {
    if (fits(n, gap, tierDepth)) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(n, gap * mid, tierDepth * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  // Shrink the requested gap and depth together until the outermost tier is on
  // the canvas, and drop whole tiers once shrinking alone would leave them too
  // shallow to seat anyone. The old code let the ring run off the edge and then
  // clamped every overhang onto the same strip — which is what produced the
  // pile. A bowl that doesn't fit now comes back smaller and correct.
  const requestedTiers = clamp(Math.round(tiers) || 1, 1, 6);
  let tierCount = requestedTiers;
  let scale = solveScale(tierCount);
  while (tierCount > 1 && ringDepthOf(tierDepth * scale) < MIN_DEPTH) {
    tierCount -= 1;
    scale = solveScale(tierCount);
  }
  const ringGap = ringGapOf(gap * scale);
  const ringDepth = ringDepthOf(tierDepth * scale);
  // scale === 0 means not even a hairline ring clears the canvas — the field is
  // too big, or jammed against an edge, for any bowl to surround it.
  const bowlFits = scale > 0;

  // The innermost ring, expanded once so it clears the field's corners. Outer
  // tiers step out from THIS by a constant depth + gap — re-running the
  // expansion per tier would let a wide field's tier 1 swallow tier 2.
  const base = clearingRadii(a, b, ringGap);

  const out = [];
  let baseArc = 0;
  // The aisle lines tier 1 lays down, which every outer tier then shares.
  let baseLines = null;

  for (let t = 0; t < tierCount; t += 1) {
    const step = t * (ringDepth + ringGap);
    const rx = base.rx + step;
    const ry = base.ry + step;

    // rect keeps its corners filled by rounding the ring rather than by leaving
    // four gaps between four straight strips.
    const corner = Math.min(rx, ry) * 0.3;
    const path =
      shape === "rect"
        ? roundedRectPath(cx, cy, rx, ry, corner)
        : ellipsePath(cx, cy, rx, ry);
    const contains = outerBoundary(shape, cx, cy, rx, ry, corner, ringDepth);

    // The stretch of ring this shape actually seats — a full loop everywhere
    // but a horseshoe, which leaves the stage end open.
    const sweep = sweepRange(shape, path, cx, cy);
    const table = arcTable(path, sweep.from, sweep.to, cx, cy);
    if (t === 0) baseArc = table.total;

    // Sections per tier scale with the ring's circumference, so a block in the
    // upper bowl is about as wide as one in the lower bowl — the way a real
    // arena has more 200-level sections than 100-level ones.
    const wanted = Math.round((perSideCount * 4 * table.total) / (baseArc || table.total));

    // …then bounded at both ends. Too many blocks on a tight ring makes
    // unreadable slivers; too few makes each one a chord so long it cannot fit
    // in the band at any useful depth, which is what produced the sections that
    // lay across the pitch. The widest a block may be follows from keeping at
    // least three quarters of the tier depth after the corner fit below.
    const rhoMin =
      shape === "rect" ? corner : Math.min((rx * rx) / ry, (ry * ry) / rx);
    const maxWidth = 2 * Math.sqrt(0.25 * ringDepth * (2 * rhoMin + 1.75 * ringDepth));
    const usableArc = table.total * (1 - VOMITORY);
    const leastCount = Math.ceil(usableArc / Math.max(maxWidth, 0.01));
    const mostCount = Math.max(leastCount, Math.floor(usableArc / MIN_SECTION));
    const count = clamp(wanted, Math.max(1, leastCount), Math.max(1, mostCount));

    // The aisle lines, held as DIRECTIONS out from the field. Tier 1 sets them
    // by dividing its own ring evenly; every tier outside it reuses the same
    // directions, split by a whole number, so the walkways run straight out
    // instead of jinking at each ring.
    let lines;
    if (t === 0) {
      // Divide the innermost ring by arc, so its blocks come out even, then
      // keep the resulting directions as the venue's aisles.
      const share = table.total / count;
      lines = [];
      for (let n = 0; n <= count; n += 1) {
        lines.push(bearingAtT(table, tAtArc(table, share * n)));
      }
      baseLines = lines;
    } else {
      const wedges = baseLines.length - 1;
      // The subdivision decides the real block count, so it — not `count` —
      // has to honour the bounds. Too few and the blocks grow into chords too
      // long to sit in the band, which is how they start overlapping again.
      const split = clamp(
        Math.max(Math.round(count / wedges), Math.ceil(leastCount / wedges)),
        1,
        8,
      );
      lines = [];
      for (let k = 0; k + 1 < baseLines.length; k += 1) {
        const from = baseLines[k];
        const to = baseLines[k + 1];
        for (let j = 0; j < split; j += 1) lines.push(from + ((to - from) * j) / split);
      }
      lines.push(baseLines[baseLines.length - 1]);
    }

    out.push(
      ...distribute({
        path,
        table,
        aisles: lines,
        depth: ringDepth,
        cx,
        cy,
        tierIndex: t,
        layout,
        sortBase: t * 1000,
        ar,
        contains,
      }),
    );
  }

  return {
    drafts: out,
    tiers: tierCount,
    requestedTiers,
    fits: bowlFits,
    // The walkway directions every tier was laid out against, as bearings from
    // the bowl centre in [-pi, pi). Exposed so the layout can be checked
    // against its own intent rather than reverse-engineered from the blocks.
    aisles: (baseLines || [])
      .slice(0, Math.max(0, baseLines ? baseLines.length - 1 : 0))
      .map((b) => Math.atan2(Math.sin(b), Math.cos(b))),
  };
}

// The drafts alone, for callers that don't care what was adjusted.
export function generateBowl(options = {}) {
  return planBowl(options).drafts;
}

// How many chairs a generated bowl would hold — shown in the dialog before the
// organiser commits to writing a few thousand rows.
export function bowlSeatCount(drafts) {
  return (drafts || []).reduce(
    (sum, s) => sum + (Number(s.layout?.rows) || 0) * (Number(s.layout?.seatsPerRow) || 0),
    0,
  );
}
