import { test } from "node:test";
import assert from "node:assert/strict";

import { createInstance } from "./catalog.js";
import { STANDARD_CATALOG } from "./standard_catalog.js";
import { normaliseInstance, planContent } from "./plan.js";
import {
  boothIssues,
  hallBoothsFromPlan,
  nextBoothLabel,
  numberBooths,
  numberNewBooths,
  planFromHallBooths,
} from "./expo.js";

const byKey = (key) => STANDARD_CATALOG.find((o) => o.key === key);
const booth = (x, y, label = "", extra = {}) => ({ ...createInstance(byKey("booth-3x3"), { x, y, label }), ...extra });

test("booth fields survive normalisation; other objects never gain them", () => {
  const b = normaliseInstance({ ...booth(5, 5, "A1"), booth: { sizeClass: "Island", price: "1250.5", zone: " Hall 2 " } });
  assert.deepEqual(b.booth, { sizeClass: "Island", price: 1250.5, zone: "Hall 2" });
  const junk = normaliseInstance({ ...booth(5, 5), booth: { sizeClass: "Huge", price: -3 } });
  assert.deepEqual(junk.booth, { sizeClass: "Standard", price: 0, zone: "" });
  const table = normaliseInstance({ ...createInstance(byKey("round-60"), { x: 1, y: 1 }), booth: { price: 9 } });
  assert.equal(table.booth, undefined);
});

test("nextBoothLabel continues the latest prefix", () => {
  assert.equal(nextBoothLabel([]), "A1");
  assert.equal(nextBoothLabel([booth(0, 0, "A1"), booth(0, 0, "A7"), booth(0, 0, "B2")]), "B3");
  assert.equal(nextBoothLabel([booth(0, 0, "101"), booth(0, 0, "")]), "102");
});

test("numberBooths numbers in reading order and reports clashes", () => {
  const objects = [booth(10, 2), booth(2, 2.4), booth(6, 8), booth(2, 8)];
  const ids = objects.map((o) => o.id);
  const numbered = numberBooths(objects, ids, { prefix: "B", start: 10 });
  const labelAt = (x, y) => numbered.find((o) => o.x_m === x && o.y_m === y).label;
  assert.equal(labelAt(2, 2.4), "B10");
  assert.equal(labelAt(10, 2), "B11");
  assert.equal(labelAt(2, 8), "B12");
  assert.equal(labelAt(6, 8), "B13");
  const issues = boothIssues([booth(0, 0, "a1"), booth(4, 0, "A1"), booth(8, 0, "")]);
  assert.equal(issues.duplicates.length, 2);
  assert.equal(issues.unnumbered.length, 1);
});

test("copies continue the source booth's sequence", () => {
  const src = booth(2, 2, "B4");
  const objects = [booth(0, 0, "A9"), src, booth(6, 2, "B4"), booth(10, 2, "B4")];
  const out = numberNewBooths(objects, [objects[2].id, objects[3].id], src.label);
  assert.deepEqual(out.map((o) => o.label), ["A9", "B4", "B5", "B6"]);
});

test("hall projection round-trips a legacy percent hall and keeps row ids", () => {
  const rows = [
    { id: "b1", kind: "booth", code: "A1", hall: "North", sizeClass: "Large", price: 900, x: 10, y: 20, width: 8, height: 6, rotation: 0 },
    { id: "b2", kind: "booth", code: "A2", hall: "", sizeClass: "Standard", price: 0, x: 40, y: 50, width: 10, height: 10, rotation: 90 },
    { id: "f1", kind: "feature", name: "Cafe", x: 70, y: 70, width: 20, height: 20, rotation: 0 },
    { id: "gone", kind: "booth", code: "Z9", x: 1, y: 1, width: 5, height: 5, active: false },
  ];
  const content = planContent(planFromHallBooths(rows, "4/3", 40));
  assert.equal(content.objects.length, 3);
  const { aspect, booths } = hallBoothsFromPlan(content);
  assert.equal(aspect, "40/30");
  const byId = new Map(booths.map((b) => [b.id, b]));
  for (const src of rows.slice(0, 3)) {
    const out = byId.get(src.id);
    assert.ok(out, `row ${src.id} kept`);
    for (const k of ["x", "y", "width", "height"]) assert.ok(Math.abs(out[k] - src[k]) < 0.02, `${src.id}.${k}`);
  }
  assert.equal(byId.get("b1").code, "A1");
  assert.equal(byId.get("b1").price, 900);
  assert.equal(byId.get("b1").hall, "North");
  assert.equal(byId.get("b2").rotation, 90);
  assert.equal(byId.get("f1").kind, "feature");
});

test("a repeated booth number is only sent once, and tiny decor stays off the buyer map", () => {
  const plan = {
    widthM: 20,
    lengthM: 10,
    outline: { type: "rect" },
    objects: [booth(3, 3, "A1"), booth(8, 3, "a1"), createInstance(byKey("plant"), { x: 15, y: 8 })],
  };
  const { booths } = hallBoothsFromPlan(plan);
  assert.equal(booths.length, 2);
  assert.deepEqual(booths.map((b) => b.code), ["A1", ""]);
});
