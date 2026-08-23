import { test } from "node:test";
import assert from "node:assert/strict";

import { buildRowQuality, rowQualityKey } from "./quality.js";

const ASPECT = "16/10";

// A field in the middle of the canvas, wider than it is tall — so its long axis
// runs across x, the way a pitch or a boxing ring sits in a bowl.
const FIELD = { shape: "rect", x: 35, y: 40, width: 30, height: 20 };

// Three seats across, at a given depth, all in one row.
function row(sectionId, rowLabel, y, xs = [45, 50, 55]) {
  return xs.map((x, i) => ({
    id: `${sectionId}-${rowLabel}-${i}`,
    sectionId,
    rowLabel,
    seatLabel: String(i + 1),
    x,
    y,
  }));
}

function section(id, box) {
  return { id, name: id, kind: "seated", rotation: 0, ...box };
}

test("a row nearer the field outranks a row further from it", () => {
  const sections = [section("near", { x: 40, y: 62, width: 20, height: 8 }), section("far", { x: 40, y: 82, width: 20, height: 8 })];
  const seats = [...row("near", "A", 64), ...row("far", "A", 86)];

  const quality = buildRowQuality({ sections, seats, field: FIELD, aspect: ASPECT });
  assert.ok(
    quality[rowQualityKey("near", "A")].score > quality[rowQualityKey("far", "A")].score,
  );
});

// This is the ordering the rail actually needed: with one flat ticket price,
// Row A and Row N of the same section were indistinguishable.
test("within one section the front row outranks the back row", () => {
  const sections = [section("104", { x: 40, y: 62, width: 20, height: 20 })];
  const seats = [...row("104", "A", 64), ...row("104", "B", 70), ...row("104", "C", 76)];

  const quality = buildRowQuality({ sections, seats, field: FIELD, aspect: ASPECT });
  const a = quality[rowQualityKey("104", "A")].score;
  const b = quality[rowQualityKey("104", "B")].score;
  const c = quality[rowQualityKey("104", "C")].score;

  assert.ok(a > b, "row A should beat row B");
  assert.ok(b > c, "row B should beat row C");
});

test("a row square on to the field outranks a corner row the same distance away", () => {
  // Both rows sit exactly 30 units from the field centre at (80, 50), so
  // nearness cancels and only the offset along the field's long axis is left
  // to tell them apart. Straight below: (80, 80). Off the corner: (56, 68).
  const sections = [section("centre", { x: 45, y: 76, width: 10, height: 6 }), section("corner", { x: 30, y: 64, width: 10, height: 6 })];
  const seats = [...row("centre", "A", 80, [50]), ...row("corner", "A", 68, [35])];

  const quality = buildRowQuality({ sections, seats, field: FIELD, aspect: ASPECT });
  assert.ok(
    quality[rowQualityKey("centre", "A")].score > quality[rowQualityKey("corner", "A")].score,
  );
});

test("every score lands between 0 and 1", () => {
  const sections = [section("a", { x: 10, y: 70, width: 20, height: 10 }), section("b", { x: 70, y: 20, width: 20, height: 10 })];
  const seats = [...row("a", "A", 72), ...row("a", "B", 78), ...row("b", "A", 22)];

  const quality = buildRowQuality({ sections, seats, field: FIELD, aspect: ASPECT });
  for (const entry of Object.values(quality)) {
    assert.ok(entry.score >= 0 && entry.score <= 1, `${entry.score} out of range`);
  }
});

test("a map with no field falls back to the centre of the canvas", () => {
  const sections = [section("near", { x: 45, y: 55, width: 10, height: 6 }), section("far", { x: 45, y: 90, width: 10, height: 6 })];
  const seats = [...row("near", "A", 57, [50]), ...row("far", "A", 92, [50])];

  const quality = buildRowQuality({ sections, seats, field: null, aspect: ASPECT });
  assert.ok(
    quality[rowQualityKey("near", "A")].score > quality[rowQualityKey("far", "A")].score,
  );
});

test("a field switched off is treated the same as no field", () => {
  const sections = [section("a", { x: 45, y: 55, width: 10, height: 6 })];
  const seats = row("a", "A", 57, [50]);
  const off = buildRowQuality({ sections, seats, field: { shape: "none", x: 0, y: 0, width: 0, height: 0 }, aspect: ASPECT });
  const none = buildRowQuality({ sections, seats, field: null, aspect: ASPECT });
  assert.deepEqual(off, none);
});

test("GA zones have no rows to rank", () => {
  const sections = [{ ...section("ga", { x: 40, y: 70, width: 20, height: 10 }), kind: "ga" }];
  const seats = row("ga", "A", 72);
  assert.deepEqual(buildRowQuality({ sections, seats, field: FIELD, aspect: ASPECT }), {});
});

test("one row on its own scores without dividing by zero", () => {
  const sections = [section("a", { x: 45, y: 70, width: 10, height: 6 })];
  const quality = buildRowQuality({
    sections,
    seats: row("a", "A", 72, [50]),
    field: FIELD,
    aspect: ASPECT,
  });
  const entry = quality[rowQualityKey("a", "A")];
  assert.ok(Number.isFinite(entry.score));
  assert.ok(entry.score >= 0 && entry.score <= 1);
});

test("empty input degrades rather than throwing", () => {
  assert.deepEqual(buildRowQuality(), {});
  assert.deepEqual(buildRowQuality({ sections: [], seats: [] }), {});
});
