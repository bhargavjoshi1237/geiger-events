// Generic 2D geometry for Event Design — metres, y grows downward (SVG), rotations are degrees clockwise.

export const EPSILON = 1e-9;
// Two footprints touching edge-to-edge are not an overlap; they must interpenetrate by more than this (metres).
export const OVERLAP_TOLERANCE_M = 0.005;

export const degToRad = (deg) => (Number(deg) || 0) * (Math.PI / 180);
export const radToDeg = (rad) => (Number(rad) || 0) * (180 / Math.PI);

// Any angle → [0, 360).
export function normaliseRotation(deg) {
  const n = Number(deg) || 0;
  const r = ((n % 360) + 360) % 360;
  return Math.abs(r - 360) < 1e-9 ? 0 : Math.round(r * 1e6) / 1e6;
}

export function snapAngle(deg, step = 15) {
  if (!step) return normaliseRotation(deg);
  return normaliseRotation(Math.round((Number(deg) || 0) / step) * step);
}

// Rotates [x, y] clockwise by `deg` around `origin`.
export function rotatePoint([x, y], deg, [ox, oy] = [0, 0]) {
  if (!deg) return [x, y];
  const t = degToRad(deg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  const dx = x - ox;
  const dy = y - oy;
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
}

// Local point (relative to a centre, unrotated) → world, given centre + rotation.
export function localToWorld([lx, ly], { x = 0, y = 0, rotation = 0 } = {}) {
  const [rx, ry] = rotatePoint([lx, ly], rotation);
  return [x + rx, y + ry];
}

// World point → local frame of a centre + rotation.
export function worldToLocal([wx, wy], { x = 0, y = 0, rotation = 0 } = {}) {
  return rotatePoint([wx - x, wy - y], -rotation);
}

export function rectPolygon(minX, minY, maxX, maxY) {
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
}

// Ellipse approximated as a convex N-gon (good enough for collision and bounds).
export function ellipsePolygon(cx, cy, rx, ry, segments = 24) {
  const pts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

export function aabbOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points || []) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

export function unionAabb(boxes) {
  const list = (boxes || []).filter(Boolean);
  if (!list.length) return null;
  return list.reduce(
    (acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX),
      maxY: Math.max(acc.maxY, b.maxY),
    }),
    { ...list[0] },
  );
}

export const aabbWidth = (b) => b.maxX - b.minX;
export const aabbHeight = (b) => b.maxY - b.minY;
export const aabbCenter = (b) => [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];

// True when two boxes interpenetrate by more than `tol` on both axes.
export function aabbIntersects(a, b, tol = 0) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > tol &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > tol
  );
}

export function aabbContains(outer, inner, tol = 0) {
  return (
    inner.minX >= outer.minX - tol &&
    inner.minY >= outer.minY - tol &&
    inner.maxX <= outer.maxX + tol &&
    inner.maxY <= outer.maxY + tol
  );
}

// Box from two corner points in any order (a marquee drag).
export function aabbFromPoints([x1, y1], [x2, y2]) {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}

function projectPolygon(points, [ax, ay]) {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of points) {
    const p = x * ax + y * ay;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

function edgeNormals(points) {
  const normals = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    if (len > EPSILON) normals.push([-ey / len, ex / len]);
  }
  return normals;
}

// Separating-axis test for two CONVEX polygons; overlap must exceed `tol` on every axis.
export function polygonsOverlap(p, q, tol = OVERLAP_TOLERANCE_M) {
  if (!p?.length || !q?.length) return false;
  for (const axis of [...edgeNormals(p), ...edgeNormals(q)]) {
    const [pMin, pMax] = projectPolygon(p, axis);
    const [qMin, qMax] = projectPolygon(q, axis);
    if (Math.min(pMax, qMax) - Math.max(pMin, qMin) <= tol) return false;
  }
  return true;
}

// Ray-casting point-in-polygon (works for concave outlines); points on the boundary count as inside within `tol`.
export function pointInPolygon([x, y], polygon, tol = 1e-6) {
  if (!polygon?.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (distanceToSegment([x, y], [xi, yi], [xj, yj]) <= tol) return true;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPSILON) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const cross = ([ax, ay], [bx, by], [cx, cy]) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

// Proper crossing of segments AB and CD (shared endpoints / collinear touching don't count).
export function segmentsCross(a, b, c, d) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return (
    ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
    ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
  );
}

// Every vertex of `inner` inside `outer` (within `tol` metres) and no edges crossing — handles concave rooms.
export function polygonInsidePolygon(inner, outer, tol = 0.01) {
  if (!inner?.length || !outer?.length) return false;
  for (const pt of inner) {
    if (!pointInPolygon(pt, outer, tol)) return false;
  }
  for (let i = 0; i < inner.length; i += 1) {
    const a = inner[i];
    const b = inner[(i + 1) % inner.length];
    for (let j = 0; j < outer.length; j += 1) {
      if (segmentsCross(a, b, outer[j], outer[(j + 1) % outer.length])) return false;
    }
  }
  return true;
}

// Shoelace area (absolute), square metres.
export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function snapToGrid(value, step) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

// Candidate snap lines of a box along one axis: its two edges and its centre.
const lines = (box, axis) =>
  axis === "x"
    ? [box.minX, (box.minX + box.maxX) / 2, box.maxX]
    : [box.minY, (box.minY + box.maxY) / 2, box.maxY];

function bestSnap(moving, targets, axis, threshold) {
  let best = null;
  const own = lines(moving, axis);
  for (const target of targets) {
    for (const t of lines(target, axis)) {
      for (const o of own) {
        const delta = t - o;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, at: t };
        }
      }
    }
  }
  return best;
}

// Snaps a moving box: object/room edges and centres within `threshold` win, else its centre falls on `grid`; returns the offset + guide lines.
export function snapBox(box, { targets = [], threshold = 0, grid = 0 } = {}) {
  const guides = [];
  let dx = 0;
  let dy = 0;
  const [cx, cy] = aabbCenter(box);
  const sx = threshold > 0 ? bestSnap(box, targets, "x", threshold) : null;
  const sy = threshold > 0 ? bestSnap(box, targets, "y", threshold) : null;
  if (sx) {
    dx = sx.delta;
    guides.push({ axis: "x", at: sx.at });
  } else if (grid > 0) {
    dx = snapToGrid(cx, grid) - cx;
  }
  if (sy) {
    dy = sy.delta;
    guides.push({ axis: "y", at: sy.at });
  } else if (grid > 0) {
    dy = snapToGrid(cy, grid) - cy;
  }
  return { dx, dy, guides };
}
