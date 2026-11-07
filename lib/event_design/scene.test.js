import { test } from "node:test";
import assert from "node:assert/strict";

import { STANDARD_CATALOG } from "./standard_catalog.js";
import { createInstance } from "./catalog.js";
import {
  buildScene,
  ceilingHeight,
  floorGrid,
  floorHeightAt,
  objectAtPoint,
  objectKind,
  planViewpoints,
  stepWalk,
  walkWorld,
} from "./scene.js";
import {
  expiryFromOption,
  extendExpiry,
  pinNumbers,
  pinPoint,
  shareState,
  snapshotToPlan,
  threadsOf,
} from "./sharing.js";

const byKey = (key) => STANDARD_CATALOG.find((o) => o.key === key);
const place = (key, x, y, extra = {}) => ({ ...createInstance(byKey(key), { x, y, ...extra }), ...extra });

const room = (objects) => ({ widthM: 20, lengthM: 15, unit: "m", outline: { type: "rect" }, objects });

test("an empty room has four full walls and a 1 m floor grid", () => {
  const scene = buildScene(room([]));
  assert.equal(scene.walls.length, 4);
  assert.ok(scene.walls.every((w) => w.material === "wall" && w.bottom === 0 && w.top === 3.5));
  assert.deepEqual(scene.centre, [10, 7.5]);
  // 19 interior vertical lines + 14 horizontal ones.
  assert.equal(floorGrid(scene.room, 1).length, 33);
});

test("a door on a wall cuts an opening with a lintel and a recessed leaf", () => {
  const scene = buildScene(room([place("door-double", 10, 15)]));
  assert.equal(scene.openings.length, 1);
  assert.equal(scene.openings[0].kind, "door_double");
  // Bottom wall splits into two runs + a lintel + the door leaf; the other three stay whole.
  assert.equal(scene.walls.length, 3 + 4);
  assert.ok(scene.walls.some((w) => w.material === "door"));
  assert.ok(scene.walls.some((w) => w.material === "wall" && w.bottom > 2));
  assert.equal(scene.objects.length, 0);
});

test("a free-standing door is modelled as a frame, not an opening", () => {
  const scene = buildScene(room([place("door", 10, 7)]));
  assert.equal(scene.openings.length, 0);
  assert.equal(scene.objects.length, 1);
});

test("round tables extrude to linen cylinders with their chairs", () => {
  const scene = buildScene(room([place("round-60", 5, 5, { label: "7" })]));
  assert.equal(scene.objects[0].kind, "table_round");
  assert.equal(scene.objects[0].parts[0].shape, "cylinder");
  assert.equal(scene.chairs.length, 8);
  assert.equal(scene.labels[0].text, "Table 7");
});

test("object kinds cover the standard catalog", () => {
  const kinds = Object.fromEntries(STANDARD_CATALOG.map((o) => [o.key, objectKind(createInstance(o))]));
  assert.equal(kinds["cocktail-30"], "highboy");
  assert.equal(kinds["stage-8x8"], "stage");
  assert.equal(kinds["stage-steps"], "steps");
  assert.equal(kinds["dance-floor-12ft"], "dance");
  assert.equal(kinds["projection-screen"], "screen");
  assert.equal(kinds["pipe-drape-10ft"], "drape");
  assert.equal(kinds.plant, "plant");
  assert.equal(kinds.pillar, "pillar");
  assert.equal(kinds["chair-banquet"], "chair");
  assert.equal(kinds["sofa-3"], "sofa");
  assert.equal(kinds["emergency-exit"], "exit");
});

test("ceiling height prefers the space, never below the tallest object", () => {
  assert.equal(ceilingHeight(room([]), 6), 6);
  assert.equal(ceilingHeight(room([]), null), 3.5);
  assert.equal(ceilingHeight(room([place("pipe-drape-10ft", 5, 5, { height_m: 4 })]), 3), 4.3);
});

test("viewpoints include the stage, entrance and each table", () => {
  const plan = room([
    place("stage-8x8", 10, 1.5),
    place("door-double", 10, 15),
    place("round-60", 6, 9, { label: "2" }),
    place("round-60", 14, 9, { label: "1" }),
  ]);
  const scene = buildScene(plan);
  const views = planViewpoints(plan, scene);
  const keys = views.map((v) => v.key);
  assert.ok(keys.includes("overview"));
  assert.ok(keys.includes("entrance"));
  assert.ok(keys.includes("stage"));
  assert.ok(keys.includes("from-stage"));
  const tables = views.filter((v) => v.group === "table");
  assert.deepEqual(tables.map((v) => v.label), ["Table 1", "Table 2"]);
  // The seated view is behind the table, further from the stage than the table centre.
  assert.ok(tables[0].at[1] > 9);
  const entrance = views.find((v) => v.key === "entrance");
  assert.ok(entrance.at[1] < 15 && entrance.at[1] > 13);
});

test("walking slides along walls and stops at tables", () => {
  const plan = room([place("banquet-8ft", 10, 5)]);
  const scene = buildScene(plan);
  const world = walkWorld(plan, scene);
  // Blocked by the wall at x = 20.
  const atWall = stepWalk(world, [19.8, 10], [0.5, 0]);
  assert.deepEqual(atWall, [19.8, 10]);
  // Diagonal into the wall slides along it.
  const slid = stepWalk(world, [19.8, 10], [0.5, 0.3]);
  assert.deepEqual(slid, [19.8, 10.3]);
  // Can't walk into the table (or its chairs).
  const blocked = stepWalk(world, [10, 8], [0, -2.5]);
  assert.deepEqual(blocked, [10, 8]);
  // Free space is free.
  assert.deepEqual(stepWalk(world, [3, 10], [0.5, 0]), [3.5, 10]);
});

test("stages lift the walker's floor", () => {
  const plan = room([place("stage-8x8", 10, 3)]);
  const world = walkWorld(plan, buildScene(plan));
  assert.ok(Math.abs(floorHeightAt(world, [10, 3]) - 0.406) < 1e-6);
  assert.equal(floorHeightAt(world, [2, 10]), 0);
});

test("objectAtPoint finds the topmost footprint", () => {
  const objects = [place("dance-floor-12ft", 10, 7), place("round-60", 10, 7)];
  assert.equal(objectAtPoint(objects, [10, 7]).id, objects[1].id);
  assert.equal(objectAtPoint(objects, [8.5, 7]).id, objects[0].id);
  assert.equal(objectAtPoint(objects, [1, 1]), null);
});

test("share state and expiry", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  assert.equal(shareState({ expiresAt: null, revokedAt: null }, now), "active");
  assert.equal(shareState({ expiresAt: "2026-11-08T11:00:00Z" }, now), "expired");
  assert.equal(shareState({ revokedAt: "2026-11-01T00:00:00Z" }, now), "revoked");
  assert.equal(expiryFromOption("never", now), null);
  assert.equal(expiryFromOption("7", now), "2026-11-15T12:00:00.000Z");
  assert.equal(extendExpiry("2026-11-01T00:00:00Z", 7, now), "2026-11-15T12:00:00.000Z");
  assert.equal(extendExpiry("2026-11-10T00:00:00Z", 7, now), "2026-11-17T00:00:00.000Z");
});

test("threads group replies, list open first and number pins by age", () => {
  const comments = [
    { id: "a", parentId: null, xM: 1, yM: 1, createdAt: "2026-11-01T00:00:00Z", resolvedAt: "2026-11-02T00:00:00Z" },
    { id: "b", parentId: null, xM: 2, yM: 2, createdAt: "2026-11-03T00:00:00Z", resolvedAt: null },
    { id: "c", parentId: "a", createdAt: "2026-11-04T00:00:00Z" },
    { id: "d", parentId: null, xM: null, yM: null, createdAt: "2026-11-05T00:00:00Z", resolvedAt: null },
  ];
  const threads = threadsOf(comments);
  assert.deepEqual(threads.map((t) => t.id), ["d", "b", "a"]);
  assert.equal(threads[2].replies.length, 1);
  const numbers = pinNumbers(threads, new Map());
  assert.equal(numbers.get("a"), 1);
  assert.equal(numbers.get("b"), 2);
  assert.equal(numbers.has("d"), false);
  const item = { id: "t1", x_m: 5, y_m: 6 };
  assert.deepEqual(pinPoint({ id: "x", itemId: "t1", xM: 1, yM: 1 }, new Map([["t1", item]])), [5, 6]);
  assert.deepEqual(pinPoint({ id: "x", itemId: "gone", xM: 1, yM: 1 }, new Map()), [1, 1]);
});

test("snapshots round-trip to a plan", () => {
  const plan = snapshotToPlan({ name: "v3", widthM: "12", lengthM: 9, unit: "ft", setupStyle: "banquet", objects: [] });
  assert.equal(plan.widthM, 12);
  assert.equal(plan.unit, "ft");
  assert.equal(plan.setupStyle, "banquet");
  assert.equal(plan.name, "v3");
});
