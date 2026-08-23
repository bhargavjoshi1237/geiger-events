// The coordinate contract every map in `events` obeys, in one place.
//
// Maps store geometry as PERCENT-OF-CANVAS on both axes, but the canvas is not
// square — it is `aspect` wide (16/10 by default). So one x-percent is 1.6 px
// for every one y-percent, and any maths that mixes the axes (a ring, a
// rotation, a distance) is wrong if it treats percent as isotropic. CSS
// `rotate()`, meanwhile, turns things in PIXELS — so geometry computed in
// percent space and rendered with a CSS transform disagree by exactly that
// factor, which is what used to pile bowl sections on top of each other.
//
// The fix is one shared space: UNITS, where 1 unit = 1% of the canvas HEIGHT on
// both axes. Units are isotropic and agree with pixels up to a uniform scale,
// so a rotation in units is the rotation CSS will draw. Compute in units,
// store in percent.

const round2 = (n) => Math.round(n * 100) / 100;

// "16/10" | "16:9" | 1.6 -> 1.6. Falls back to 1 (square) rather than throwing,
// so a map with a junk aspect degrades to undistorted instead of blank.
export function aspectRatio(aspect) {
  if (typeof aspect === "number" && Number.isFinite(aspect) && aspect > 0) return aspect;
  const text = String(aspect ?? "").trim();
  if (!text) return 1;
  const parts = text.split(/[/:]/);
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w / h;
  }
  const single = Number(text);
  return Number.isFinite(single) && single > 0 ? single : 1;
}

// The canvas itself, in units: as tall as 100, as wide as the aspect makes it.
export function canvasUnits(ar) {
  return { width: 100 * ar, height: 100 };
}

// Percent <-> units. Only x is scaled; y is already percent-of-height.
export const xToUnits = (x, ar) => (Number(x) || 0) * ar;
export const xToPercent = (x, ar) => (Number(x) || 0) / ar;

// A box {x, y, width, height} in percent -> the same box in units.
export function boxToUnits(box, ar) {
  return {
    x: xToUnits(box?.x, ar),
    y: Number(box?.y) || 0,
    width: xToUnits(box?.width, ar),
    height: Number(box?.height) || 0,
  };
}

// …and back, rounded to the 2dp the tables store.
export function boxToPercent(box, ar) {
  return {
    x: round2(xToPercent(box.x, ar)),
    y: round2(box.y),
    width: round2(xToPercent(box.width, ar)),
    height: round2(box.height),
  };
}

export function unitCentre(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Rotate a point about a centre by `deg` clockwise (y grows downward, so this
// matches CSS). Only meaningful in unit space — rotating percent coordinates
// shears whatever it touches.
export function rotateUnits(x, y, cx, cy, deg) {
  const angle = ((Number(deg) || 0) * Math.PI) / 180;
  if (!angle) return { x, y };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// The rotation that points a block's front edge (its top, before rotation) in
// the direction `(dx, dy)`. Rotating (0,-1) by t gives (sin t, -cos t), so we
// solve sin t = dx, cos t = -dy.
export function facingDirection(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  const deg = (Math.atan2(dx / length, -dy / length) * 180) / Math.PI;
  return round2((deg + 360) % 360);
}

export { round2 };
