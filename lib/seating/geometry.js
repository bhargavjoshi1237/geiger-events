
const round2 = (n) => Math.round(n * 100) / 100;

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

export function canvasUnits(ar) {
  return { width: 100 * ar, height: 100 };
}

export const xToUnits = (x, ar) => (Number(x) || 0) * ar;
export const xToPercent = (x, ar) => (Number(x) || 0) / ar;

export function boxToUnits(box, ar) {
  return {
    x: xToUnits(box?.x, ar),
    y: Number(box?.y) || 0,
    width: xToUnits(box?.width, ar),
    height: Number(box?.height) || 0,
  };
}

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

export function rotateUnits(x, y, cx, cy, deg) {
  const angle = ((Number(deg) || 0) * Math.PI) / 180;
  if (!angle) return { x, y };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function facingDirection(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  const deg = (Math.atan2(dx / length, -dy / length) * 180) / Math.PI;
  return round2((deg + 360) % 360);
}

export { round2 };
