import { seatPositions, drawsChairs, CHAIR_WIDTH_M } from "./chairs.js";
import { roomPolygon, sortForRender } from "./plan.js";
import { aabbOf } from "./geometry.js";

// Standalone SVG string of a plan (no CSS, fixed neutral palette) — stored as floor_plans.thumbnail for share previews and exports.

const FILL = {
  floor: "#e9e5f5",
  furniture: "#f4f4f5",
  structure: "#d4d4d8",
};
const STROKE = "#71717a";

const f = (n) => Math.round(n * 100) / 100;
// Above this many drawn chairs the stored thumbnail skips them to stay small.
const MAX_THUMB_CHAIRS = 300;
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

function shapeSvg(o, stroke) {
  const w = o.width_m;
  const d = o.depth_m;
  const t = `translate(${f(o.x_m)} ${f(o.y_m)}) rotate(${f(o.rotation || 0)})`;
  const fill = FILL[o.layer] || FILL.furniture;
  const common = `fill="${fill}" stroke="${STROKE}" stroke-width="${f(stroke)}"`;
  if (o.shape === "round" || o.shape === "oval") {
    return `<ellipse transform="${t}" cx="0" cy="0" rx="${f(w / 2)}" ry="${f(d / 2)}" ${common}/>`;
  }
  if (o.shape === "custom" && Array.isArray(o.points)) {
    const pts = o.points.map(([x, y]) => `${f(x * w)},${f(y * d)}`).join(" ");
    return `<polygon transform="${t}" points="${pts}" ${common}/>`;
  }
  return `<rect transform="${t}" x="${f(-w / 2)}" y="${f(-d / 2)}" width="${f(w)}" height="${f(d)}" ${common}/>`;
}

export function planToSvg(plan, { size = 320, padding = 0.04 } = {}) {
  const room = roomPolygon(plan);
  const box = aabbOf(room);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY) || 1;
  const pad = span * padding;
  const vb = [box.minX - pad, box.minY - pad, box.maxX - box.minX + pad * 2, box.maxY - box.minY + pad * 2];
  const stroke = span / 400;
  const height = Math.round((size * vb[3]) / vb[2]);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(" ")}" width="${size}" height="${height}">`,
    `<title>${esc(plan?.name || "Floor plan")}</title>`,
    `<polygon points="${room.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="#ffffff" stroke="#3f3f46" stroke-width="${f(stroke * 2)}"/>`,
  ];
  const objects = sortForRender(plan?.objects || []);
  const chairCount = objects.reduce((n, o) => n + (drawsChairs(o) ? o.seats : 0), 0);
  for (const o of objects) {
    if (chairCount <= MAX_THUMB_CHAIRS && drawsChairs(o)) {
      for (const s of seatPositions(o)) {
        parts.push(`<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${f(CHAIR_WIDTH_M / 2.4)}" fill="#a1a1aa"/>`);
      }
    }
    parts.push(shapeSvg(o, stroke));
  }
  parts.push("</svg>");
  return parts.join("");
}
