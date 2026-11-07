import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatArea,
  formatLength,
  fromMetres,
  niceScaleLength,
  parseLength,
  toMetres,
} from "./units.js";
import {
  normaliseRotation,
  pointInPolygon,
  polygonArea,
  polygonInsidePolygon,
  polygonsOverlap,
  rectPolygon,
  rotatePoint,
  snapAngle,
  snapBox,
} from "./geometry.js";
import { chairLocalPositions, localExtents, seatPositions, sidesSplit } from "./chairs.js";
import { footprintPolygon, instanceAabb, instancesOverlap } from "./footprint.js";
import { createInstance, resolveCatalog, searchCatalog } from "./catalog.js";
import { STANDARD_CATALOG } from "./standard_catalog.js";
import {
  alignInstances,
  arrayInstances,
  cloneObjects,
  duplicateInstances,
  nextTableLabel,
  normaliseObjects,
  objectsOutsideRoom,
  planStats,
  rotateInstances,
  validatePlan,
} from "./plan.js";
import { planToSvg } from "./thumbnail.js";

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const byKey = (key) => STANDARD_CATALOG.find((o) => o.key === key);

test("units convert and format both ways", () => {
  close(toMetres(6, "ft"), 1.8288);
  close(fromMetres(1.8288, "ft"), 6);
  assert.equal(formatLength(1.8288, "ft"), "6 ft");
  assert.equal(formatLength(1.5, "m"), "1.5 m");
  assert.equal(formatArea(100, "m"), "100 m²");
  close(parseLength("6ft"), 1.8288);
  close(parseLength(`72"`), 1.8288);
  close(parseLength("5' 6\""), 1.6764);
  close(parseLength("180cm"), 1.8);
  close(parseLength("3", "ft"), 0.9144);
  assert.equal(parseLength("abc"), null);
});

test("scale bar picks a round length", () => {
  const bar = niceScaleLength(20, "m", 110);
  assert.equal(bar.units, 5);
  assert.equal(bar.label, "5 m");
});

test("rotation helpers", () => {
  assert.equal(normaliseRotation(-15), 345);
  assert.equal(normaliseRotation(720), 0);
  assert.equal(snapAngle(52), 45);
  const [x, y] = rotatePoint([1, 0], 90);
  close(x, 0);
  close(y, 1);
});

test("polygons: area, containment, SAT overlap", () => {
  const room = rectPolygon(0, 0, 10, 5);
  close(polygonArea(room), 50);
  assert.ok(pointInPolygon([5, 2], room));
  assert.ok(!pointInPolygon([11, 2], room));
  assert.ok(polygonInsidePolygon(rectPolygon(1, 1, 2, 2), room));
  assert.ok(!polygonInsidePolygon(rectPolygon(9, 1, 11, 2), room));
  // concave L room: a box in the notch is outside
  const lRoom = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  assert.ok(!polygonInsidePolygon(rectPolygon(6, 6, 8, 8), lRoom));
  assert.ok(polygonInsidePolygon(rectPolygon(1, 6, 3, 8), lRoom));
  assert.ok(polygonsOverlap(rectPolygon(0, 0, 2, 2), rectPolygon(1, 1, 3, 3)));
  assert.ok(!polygonsOverlap(rectPolygon(0, 0, 2, 2), rectPolygon(2, 0, 4, 2)), "touching edges are not overlap");
});

test("snapBox prefers edges, falls back to grid centre", () => {
  const moving = { minX: 1.02, minY: 3.3, maxX: 2.02, maxY: 4.3 };
  const target = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const snapped = snapBox(moving, { targets: [target], threshold: 0.05, grid: 0.5 });
  close(snapped.dx, -0.02);
  assert.deepEqual(snapped.guides, [{ axis: "x", at: 1 }]);
  close(3.8 + snapped.dy, 4); // centre 3.8 → grid 4
});

test("chair layouts produce ordered seats", () => {
  const round = createInstance(byKey("round-60"), { x: 5, y: 5 });
  const seats = seatPositions(round);
  assert.equal(seats.length, 8);
  close(seats[0].x, 5); // first seat at the top
  assert.ok(seats[0].y < 5);
  close(seats[0].angle, -180 + 360 * 0); // faces down toward the table (180 ≡ -180)
  const banquet = createInstance(byKey("banquet-6ft"));
  assert.deepEqual(sidesSplit(banquet), { top: 3, bottom: 3, ends: 0 });
  const board = createInstance(byKey("boardroom-12ft"));
  assert.deepEqual(sidesSplit(board), { top: 5, bottom: 5, ends: 2 });
  assert.equal(chairLocalPositions(board).length, 12);
  const classroom = createInstance(byKey("classroom-6ft"));
  const ext = localExtents(classroom, { withChairs: true });
  close(ext.minY, -classroom.depth_m / 2);
  assert.ok(ext.maxY > classroom.depth_m / 2);
  const sofa = createInstance(byKey("sofa-3"));
  assert.equal(seatPositions(sofa).length, 3);
});

test("footprints rotate and overlap with chairs", () => {
  const a = createInstance(byKey("banquet-8ft"), { x: 5, y: 5, rotation: 90 });
  const box = instanceAabb(a);
  close(box.maxX - box.minX, a.depth_m, 1e-6);
  close(box.maxY - box.minY, a.width_m, 1e-6);
  const r1 = createInstance(byKey("round-60"), { x: 3, y: 3 });
  const r2 = createInstance(byKey("round-60"), { x: 3 + 1.7, y: 3 });
  assert.ok(!instancesOverlap(r1, r2, { withChairs: false }), "tables alone clear");
  assert.ok(instancesOverlap(r1, r2, { withChairs: true }), "chairs collide");
  const stage = createInstance(byKey("stage-8x8"), { x: 3, y: 3 });
  const podium = createInstance(byKey("podium"), { x: 3, y: 3 });
  assert.ok(!instancesOverlap(stage, podium), "podium may stand on a stage");
  assert.equal(footprintPolygon(r1).length, 20);
});

test("plan stats flag outside and overlapping objects", () => {
  const inside = createInstance(byKey("round-60"), { x: 5, y: 5 });
  const clash = createInstance(byKey("round-60"), { x: 5.5, y: 5 });
  const outside = createInstance(byKey("banquet-6ft"), { x: 19.5, y: 7 });
  const plan = { widthM: 20, lengthM: 15, objects: [inside, clash, outside] };
  const stats = planStats(plan);
  assert.equal(stats.seats, 22);
  assert.equal(stats.objectCount, 3);
  close(stats.areaM2, 300);
  assert.deepEqual(stats.outsideIds, [outside.id]);
  assert.deepEqual(stats.overlapPairs, [[inside.id, clash.id]]);
  assert.equal(stats.flaggedIds.length, 3);
  assert.deepEqual(objectsOutsideRoom({ ...plan, widthM: 30 }), []);
});

test("instances survive normalisation and keep ids; clones get new ones", () => {
  const a = createInstance(byKey("round-72"), { x: 1, y: 2, label: "7" });
  const [round] = normaliseObjects([JSON.parse(JSON.stringify(a))]);
  assert.deepEqual(round, a);
  const dup = normaliseObjects([a, { ...a }]);
  assert.notEqual(dup[0].id, dup[1].id);
  assert.equal(normaliseObjects([{ id: "x", width_m: 0, depth_m: 1 }]).length, 0);
  const [clone] = cloneObjects([a]);
  assert.notEqual(clone.id, a.id);
  assert.equal(clone.label, "7");
  assert.ok(validatePlan({ widthM: 10, lengthM: 10, objects: [a] }).ok);
  assert.ok(!validatePlan({ widthM: 0, lengthM: 10, objects: [] }).ok);
});

test("bulk edits: duplicate, rotate, align, array, numbering", () => {
  const t1 = createInstance(byKey("round-60"), { x: 2, y: 2, label: "1" });
  const t2 = createInstance(byKey("round-60"), { x: 6, y: 3, label: "2" });
  assert.equal(nextTableLabel([t1, t2]), "3");
  const { objects, ids } = duplicateInstances([t1, t2], [t1.id]);
  assert.equal(objects.length, 3);
  assert.equal(ids.length, 1);
  const aligned = alignInstances([t1, t2], [t1.id, t2.id], "top");
  close(aligned[1].y_m, 2);
  const rotated = rotateInstances([t1], [t1.id], 90, [0, 0]);
  close(rotated[0].x_m, -2);
  close(rotated[0].y_m, 2);
  assert.equal(rotated[0].rotation, 90);
  const grid = arrayInstances([t1], t1.id, { rows: 2, cols: 3, gapX: 1, gapY: 1 });
  assert.equal(grid.objects.length, 6);
  assert.deepEqual(grid.objects.map((o) => o.label), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(new Set(grid.objects.map((o) => o.id)).size, 6);
});

test("catalog resolves to the standard set when the DB has no global rows", () => {
  const custom = { id: "c1", projectId: "p1", name: "Custom bar", category: "bars_catering", sortOrder: 0 };
  const resolved = resolveCatalog([custom]);
  assert.equal(resolved.length, STANDARD_CATALOG.length + 1);
  assert.equal(searchCatalog(resolved, { source: "custom" }).length, 1);
  assert.ok(searchCatalog(resolved, { query: "round" }).length >= 3);
  assert.equal(new Set(STANDARD_CATALOG.map((o) => o.id)).size, STANDARD_CATALOG.length);
});

test("planToSvg emits a standalone svg", () => {
  const svg = planToSvg({ name: "Gala", widthM: 20, lengthM: 10, objects: [createInstance(byKey("round-60"), { x: 4, y: 4 })] });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("<ellipse"));
  assert.ok(svg.includes("<title>Gala</title>"));
});
