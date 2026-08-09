import { test } from "node:test";
import assert from "node:assert/strict";

import { BOWL_SHAPES, bowlSeatCount, facingRotation, generateBowl } from "./bowl.js";
import { generateSeats } from "./generate.js";

const FIELD = { x: 35, y: 40, width: 30, height: 20 };
const centre = { x: FIELD.x + FIELD.width / 2, y: FIELD.y + FIELD.height / 2 };

// Distance from the bowl centre to a section's centre.
const radius = (s) =>
  Math.hypot(s.x + s.width / 2 - centre.x, s.y + s.height / 2 - centre.y);

test("facingRotation points a section's front at the bowl centre", () => {
  // Below the field: already facing up, no rotation needed.
  assert.equal(facingRotation(Math.PI / 2), 0);
  // Above the field: half turn.
  assert.equal(facingRotation(-Math.PI / 2), 180);
  // Right of the field: face left.
  assert.equal(facingRotation(0), 270);
  // Left of the field: face right.
  assert.equal(facingRotation(Math.PI), 90);
});

test("every shape is generatable and produces sections", () => {
  for (const { value } of BOWL_SHAPES) {
    const drafts = generateBowl({ shape: value, field: FIELD, tiers: 2, perSide: 4 });
    assert.ok(drafts.length > 0, `${value} produced nothing`);
  }
});

test("an oval places perSide x 4 sections per tier", () => {
  const drafts = generateBowl({ shape: "oval", field: FIELD, tiers: 2, perSide: 5 });
  assert.equal(drafts.length, 40);
});

test("a rectangular arena places perSide sections on each of four sides", () => {
  const drafts = generateBowl({ shape: "rect", field: FIELD, tiers: 1, perSide: 6 });
  assert.equal(drafts.length, 24);
  // One section per cardinal facing.
  const rotations = new Set(drafts.map((s) => s.rotation));
  assert.deepEqual([...rotations].sort((a, b) => a - b), [0, 90, 180, 270]);
});

test("tier 2 sits further out than tier 1", () => {
  const drafts = generateBowl({ shape: "oval", field: FIELD, tiers: 2, perSide: 4 });
  const tier1 = drafts.filter((s) => s.name.startsWith("1"));
  const tier2 = drafts.filter((s) => s.name.startsWith("2"));
  const mean = (list) => list.reduce((sum, s) => sum + radius(s), 0) / list.length;
  assert.ok(mean(tier2) > mean(tier1), "outer tier should sit further from the centre");
});

test("sections are named by tier", () => {
  const drafts = generateBowl({ shape: "rect", field: FIELD, tiers: 2, perSide: 2 });
  assert.ok(drafts.some((s) => s.name === "101"));
  assert.ok(drafts.some((s) => s.name === "201"));
});

test("no section is generated on top of the field", () => {
  const drafts = generateBowl({ shape: "oval", field: FIELD, tiers: 1, perSide: 6 });
  for (const s of drafts) {
    assert.ok(
      radius(s) > FIELD.height / 2,
      `${s.name} sits inside the field (r=${radius(s).toFixed(1)})`,
    );
  }
});

test("a horseshoe leaves a gap at the stage end", () => {
  const drafts = generateBowl({ shape: "horseshoe", field: FIELD, tiers: 1, perSide: 5 });
  // Nothing should sit directly above the field, where the stage goes.
  const aboveField = drafts.filter(
    (s) => s.y + s.height / 2 < FIELD.y && Math.abs(s.x + s.width / 2 - centre.x) < 6,
  );
  assert.equal(aboveField.length, 0, "horseshoe should not close over the stage");
});

test("banquet rounds skip the dance floor", () => {
  const drafts = generateBowl({ shape: "rounds", field: FIELD, tables: 16 });
  assert.ok(drafts.length > 0);
  assert.ok(drafts.every((s) => s.name.startsWith("Table ")));
  for (const s of drafts) {
    const cxs = s.x + s.width / 2;
    const cys = s.y + s.height / 2;
    const onFloor =
      cxs > FIELD.x && cxs < FIELD.x + FIELD.width && cys > FIELD.y && cys < FIELD.y + FIELD.height;
    assert.ok(!onFloor, `${s.name} landed on the dance floor`);
  }
});

test("every generated section stays on the canvas", () => {
  for (const { value } of BOWL_SHAPES) {
    for (const s of generateBowl({ shape: value, field: FIELD, tiers: 2, perSide: 5 })) {
      assert.ok(s.x >= 0 && s.x <= 100, `${value} ${s.name} x=${s.x}`);
      assert.ok(s.y >= 0 && s.y <= 100, `${value} ${s.name} y=${s.y}`);
    }
  }
});

test("bowlSeatCount totals the chairs the bowl would create", () => {
  const drafts = generateBowl({
    shape: "rect",
    field: FIELD,
    tiers: 1,
    perSide: 2,
    rows: 10,
    seatsPerRow: 12,
  });
  assert.equal(bowlSeatCount(drafts), 8 * 120);
  assert.equal(bowlSeatCount([]), 0);
  assert.equal(bowlSeatCount(null), 0);
});

test("generated sections feed generateSeats and their chairs face the field", () => {
  const drafts = generateBowl({
    shape: "rect",
    field: FIELD,
    tiers: 1,
    perSide: 1,
    rows: 4,
    seatsPerRow: 4,
  });

  for (const section of drafts) {
    const seats = generateSeats(section);
    assert.equal(seats.length, 16, `${section.name} generated ${seats.length} seats`);

    // Row A is the front row, so it must sit nearer the bowl centre than row D.
    const dist = (label) => {
      const row = seats.filter((s) => s.rowLabel === label);
      return (
        row.reduce((sum, s) => sum + Math.hypot(s.x - centre.x, s.y - centre.y), 0) / row.length
      );
    };
    assert.ok(
      dist("A") < dist("D"),
      `${section.name}: row A should be closer to the field than row D`,
    );
  }
});
