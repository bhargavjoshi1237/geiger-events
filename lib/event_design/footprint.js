import {
  aabbIntersects,
  aabbOf,
  ellipsePolygon,
  localToWorld,
  OVERLAP_TOLERANCE_M,
  polygonsOverlap,
  rectPolygon,
} from "./geometry.js";
import { localExtents } from "./chairs.js";

// Object footprints in plan space: the rotated outline every collision, bounds and selection test runs on.

const frameOf = (instance) => ({
  x: Number(instance?.x_m) || 0,
  y: Number(instance?.y_m) || 0,
  rotation: Number(instance?.rotation) || 0,
});

const isRoundish = (instance) => instance?.shape === "round" || instance?.shape === "oval";

// Convex world-space outline. Round/oval → N-gon; rect/custom → rotated rectangle (custom uses its bounding box).
export function footprintPolygon(instance, { withChairs = false, segments = 20 } = {}) {
  const ext = localExtents(instance, { withChairs });
  const symmetric =
    Math.abs(ext.minX + ext.maxX) < 1e-9 && Math.abs(ext.minY + ext.maxY) < 1e-9;
  const local =
    isRoundish(instance) && symmetric
      ? ellipsePolygon(0, 0, ext.maxX, ext.maxY, segments)
      : rectPolygon(ext.minX, ext.minY, ext.maxX, ext.maxY);
  const frame = frameOf(instance);
  return local.map((p) => localToWorld(p, frame));
}

// Axis-aligned bounds of the rotated footprint.
export const instanceAabb = (instance, opts) => aabbOf(footprintPolygon(instance, opts));

// The four rotated corners of the object's own rectangle (no chairs) — selection outlines and handles use these.
export function instanceCorners(instance) {
  const w = (Number(instance?.width_m) || 0) / 2;
  const d = (Number(instance?.depth_m) || 0) / 2;
  const frame = frameOf(instance);
  return rectPolygon(-w, -d, w, d).map((p) => localToWorld(p, frame));
}

// Stage risers and dance floors sit under furniture; only same-kind pairs (or anything vs structure) can clash.
export function layersCanClash(a, b) {
  const la = a?.layer || "furniture";
  const lb = b?.layer || "furniture";
  if (la === "floor" || lb === "floor") return la === lb;
  return true;
}

// Real overlap between two placed objects (chairs included by default), ignoring edge-to-edge contact.
export function instancesOverlap(a, b, { withChairs = true, tol = OVERLAP_TOLERANCE_M } = {}) {
  if (!a || !b || a.id === b.id || !layersCanClash(a, b)) return false;
  const pa = footprintPolygon(a, { withChairs });
  const pb = footprintPolygon(b, { withChairs });
  if (!aabbIntersects(aabbOf(pa), aabbOf(pb), tol)) return false;
  return polygonsOverlap(pa, pb, tol);
}
