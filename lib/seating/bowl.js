
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

const SUGGESTED_FIELDS = {
  oval: { shape: "pitch", x: 32, y: 33, width: 36, height: 34, label: "Pitch" },
  rect: { shape: "court", x: 34, y: 35, width: 32, height: 30, label: "Court" },
  horseshoe: { shape: "stage", x: 30, y: 34, width: 40, height: 10, label: "Stage" },
  rounds: { shape: "floor", x: 38, y: 40, width: 24, height: 20, label: "Dance floor" },
};

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

const VOMITORY = 0.2;
const MARGIN = 2;
const MIN_SECTION = 3;
const MAX_ECCENTRICITY = 2.2;
const MIN_DEPTH = 3;
const MIN_CLEARANCE = 1.5;

function sweepRange(shape, path, cx, cy) {
  if (shape !== "horseshoe") return { from: 0, to: 1 };
  const full = arcTable(path, 0, 1, cx, cy);
  return {
    from: tAtBearing(full, HORSESHOE_FROM) - 1,
    to: tAtBearing(full, HORSESHOE_TO),
  };
}

export function facingRotation(phi) {
  return facingDirection(-Math.cos(phi), -Math.sin(phi));
}

function sectionName(tierIndex, n) {
  return String((tierIndex + 1) * 100 + n);
}

function draft({ name, cx, cy, width, depth, rotation, layout, sortOrder, ar }) {
  return {
    name,
    kind: "seated",
    x: round2(xToPercent(cx - width / 2, ar)),
    y: round2(cy - depth / 2),
    width: round2(xToPercent(width, ar)),
    height: round2(depth),
    rotation: round2(((rotation % 360) + 360) % 360),
    layout: { ...DEFAULT_LAYOUT, ...layout },
    sortOrder,
  };
}

function ellipsePath(cx, cy, rx, ry) {
  return (u) => {
    const t = u * TAU;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  };
}

function roundedRectPath(cx, cy, rx, ry, r) {
  const radius = clamp(r, 0, Math.min(rx, ry));
  const ax = Math.max(0, rx - radius);
  const ay = Math.max(0, ry - radius);
  const quarter = (radius * Math.PI) / 2;
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
    }
  };
}

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
      const delta = Math.atan2(Math.sin(raw - bear[i - 1]), Math.cos(raw - bear[i - 1]));
      bear.push(bear[i - 1] + delta);
    }
  }
  return { ts, points, cum, bear, total: cum[cum.length - 1] };
}

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
  const nx = ty;
  const ny = -tx;
  const away = (here.x - cx) * nx + (here.y - cy) * ny;
  return away >= 0 ? { x: nx, y: ny } : { x: -nx, y: -ny };
}

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

function distribute({
  path, table, aisles, depth, cx, cy, tierIndex, layout, sortBase, ar, contains,
}) {
  const out = [];
  const count = aisles.length - 1;

  for (let n = 0; n < count; n += 1) {
    const from = aisles[n];
    const to = aisles[n + 1];
    const p0 = path(tAtBearing(table, from));
    const p1 = path(tAtBearing(table, to));

    const width = Math.max(0.2, Math.hypot(p1.x - p0.x, p1.y - p0.y) * (1 - VOMITORY));
    const half = width / 2;

    const t = tAtBearing(table, (from + to) / 2);
    const p = path(t);
    const normal = outwardNormal(path, t, cx, cy);
    const tangent = { x: -normal.y, y: normal.x };

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
        cx: p.x + normal.x * (boxDepth / 2),
        cy: p.y + normal.y * (boxDepth / 2),
        width,
        depth: boxDepth,
        rotation: facingDirection(-normal.x, -normal.y),
        layout,
        sortOrder: sortBase + n,
        ar,
      }),
    );
  }
  return out;
}

function banquetTables({ count, field, seatsPerTable, sortBase, ar }) {
  const canvas = canvasUnits(ar);
  const wanted = Math.max(1, Math.round(count));
  const out = [];

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

function clearingRadii(a, b, inset) {
  const clear = Math.max(inset, MIN_CLEARANCE);
  let rx = a + clear;
  let ry = b + clear;

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

  const extentFor = (n, g, d) => {
    const depth = ringDepthOf(d);
    const r = clearingRadii(a, b, ringGapOf(g));
    const step = (n - 1) * (depth + ringGapOf(g));
    const rx = r.rx + step;
    const ry = r.ry + step;
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

  const requestedTiers = clamp(Math.round(tiers) || 1, 1, 6);
  let tierCount = requestedTiers;
  let scale = solveScale(tierCount);
  while (tierCount > 1 && ringDepthOf(tierDepth * scale) < MIN_DEPTH) {
    tierCount -= 1;
    scale = solveScale(tierCount);
  }
  const ringGap = ringGapOf(gap * scale);
  const ringDepth = ringDepthOf(tierDepth * scale);
  const bowlFits = scale > 0;

  const base = clearingRadii(a, b, ringGap);

  const out = [];
  let baseArc = 0;
  let baseLines = null;

  for (let t = 0; t < tierCount; t += 1) {
    const step = t * (ringDepth + ringGap);
    const rx = base.rx + step;
    const ry = base.ry + step;

    const corner = Math.min(rx, ry) * 0.3;
    const path =
      shape === "rect"
        ? roundedRectPath(cx, cy, rx, ry, corner)
        : ellipsePath(cx, cy, rx, ry);
    const contains = outerBoundary(shape, cx, cy, rx, ry, corner, ringDepth);

    const sweep = sweepRange(shape, path, cx, cy);
    const table = arcTable(path, sweep.from, sweep.to, cx, cy);
    if (t === 0) baseArc = table.total;

    const wanted = Math.round((perSideCount * 4 * table.total) / (baseArc || table.total));

    const rhoMin =
      shape === "rect" ? corner : Math.min((rx * rx) / ry, (ry * ry) / rx);
    const maxWidth = 2 * Math.sqrt(0.25 * ringDepth * (2 * rhoMin + 1.75 * ringDepth));
    const usableArc = table.total * (1 - VOMITORY);
    const leastCount = Math.ceil(usableArc / Math.max(maxWidth, 0.01));
    const mostCount = Math.max(leastCount, Math.floor(usableArc / MIN_SECTION));
    const count = clamp(wanted, Math.max(1, leastCount), Math.max(1, mostCount));

    let lines;
    if (t === 0) {
      const share = table.total / count;
      lines = [];
      for (let n = 0; n <= count; n += 1) {
        lines.push(bearingAtT(table, tAtArc(table, share * n)));
      }
      baseLines = lines;
    } else {
      const wedges = baseLines.length - 1;
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
    aisles: (baseLines || [])
      .slice(0, Math.max(0, baseLines ? baseLines.length - 1 : 0))
      .map((b) => Math.atan2(Math.sin(b), Math.cos(b))),
  };
}

export function generateBowl(options = {}) {
  return planBowl(options).drafts;
}

export function bowlSeatCount(drafts) {
  return (drafts || []).reduce(
    (sum, s) => sum + (Number(s.layout?.rows) || 0) * (Number(s.layout?.seatsPerRow) || 0),
    0,
  );
}
