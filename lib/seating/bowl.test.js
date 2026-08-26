import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOWL_SHAPES,
  bowlSeatCount,
  facingRotation,
  generateBowl,
  planBowl,
} from "./bowl.js";
import { generateSeats } from "./generate.js";
import { aspectRatio } from "./geometry.js";

const FIELD = { x: 35, y: 40, width: 30, height: 20 };
const ASPECT = "16/10";
const AR = aspectRatio(ASPECT);
const centre = { x: (FIELD.x + FIELD.width / 2) * AR, y: FIELD.y + FIELD.height / 2 };

const bowl = (opts = {}) => generateBowl({ field: FIELD, aspect: ASPECT, ...opts });

const radius = (s) =>
  Math.hypot((s.x + s.width / 2) * AR - centre.x, s.y + s.height / 2 - centre.y);

function drawnCorners(s, ar = AR) {
  const w = s.width * ar;
  const h = s.height;
  const cx = (s.x + s.width / 2) * ar;
  const cy = s.y + s.height / 2;
  const a = ((s.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

function overlaps(A, B) {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % 4];
      const ax = -(q[1] - p[1]);
      const ay = q[0] - p[0];
      let a1 = Infinity;
      let a2 = -Infinity;
      let b1 = Infinity;
      let b2 = -Infinity;
      for (const v of A) {
        const d = v[0] * ax + v[1] * ay;
        a1 = Math.min(a1, d);
        a2 = Math.max(a2, d);
      }
      for (const v of B) {
        const d = v[0] * ax + v[1] * ay;
        b1 = Math.min(b1, d);
        b2 = Math.max(b2, d);
      }
      if (a2 <= b1 + 1e-7 || b2 <= a1 + 1e-7) return false;
    }
  }
  return true;
}

function collidingPairs(drafts, ar = AR) {
  const quads = drafts.map((s) => drawnCorners(s, ar));
  const hits = [];
  for (let i = 0; i < quads.length; i += 1) {
    for (let j = i + 1; j < quads.length; j += 1) {
      if (overlaps(quads[i], quads[j])) hits.push(`${drafts[i].name}/${drafts[j].name}`);
    }
  }
  return hits;
}

test("facingRotation points a section's front at the bowl centre", () => {
  assert.equal(facingRotation(Math.PI / 2), 0);
  assert.equal(facingRotation(-Math.PI / 2), 180);
  assert.equal(facingRotation(0), 270);
  assert.equal(facingRotation(Math.PI), 90);
});

test("every shape is generatable and produces sections", () => {
  for (const { value } of BOWL_SHAPES) {
    assert.ok(bowl({ shape: value, tiers: 2, perSide: 4 }).length > 0, `${value} produced nothing`);
  }
});

test("no two sections overlap once drawn, in any shape", () => {
  for (const { value } of BOWL_SHAPES) {
    for (const tiers of [1, 2, 3]) {
      for (const perSide of [1, 4, 8, 16]) {
        const drafts = bowl({ shape: value, tiers, perSide });
        const hits = collidingPairs(drafts);
        assert.deepEqual(
          hits,
          [],
          `${value} tiers=${tiers} perSide=${perSide} overlapped: ${hits.slice(0, 5).join(", ")}`,
        );
      }
    }
  }
});

test("sections stay clear whatever the canvas shape", () => {
  for (const aspect of ["16/10", "16/9", "4/3", "1/1", "3/4"]) {
    const ar = aspectRatio(aspect);
    const drafts = generateBowl({ field: FIELD, aspect, shape: "oval", tiers: 2, perSide: 6 });
    assert.deepEqual(collidingPairs(drafts, ar), [], `overlap at ${aspect}`);
  }
});

test("a tier's sections are all about the same width", () => {
  const tier1 = bowl({ shape: "oval", tiers: 2, perSide: 6 }).filter((s) =>
    s.name.startsWith("1"),
  );
  const widths = tier1.map((s) => s.width * AR);
  const spread = Math.max(...widths) - Math.min(...widths);
  const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  assert.ok(spread / mean < 0.08, `widths varied by ${(100 * spread / mean).toFixed(1)}%`);
});

test("a rectangular arena fills its corners rather than leaving four strips", () => {
  const drafts = bowl({ shape: "rect", tiers: 1, perSide: 6 });
  const rotations = new Set(drafts.map((s) => s.rotation));
  for (const cardinal of [0, 90, 180, 270]) {
    assert.ok(rotations.has(cardinal), `no section faces ${cardinal}`);
  }
  assert.ok(
    [...rotations].some((r) => ![0, 90, 180, 270].includes(r)),
    "corners were left empty",
  );
});

test("tier 2 sits further out than tier 1", () => {
  const drafts = bowl({ shape: "oval", tiers: 2, perSide: 4 });
  const mean = (list) => list.reduce((sum, s) => sum + radius(s), 0) / list.length;
  assert.ok(
    mean(drafts.filter((s) => s.name.startsWith("2"))) >
      mean(drafts.filter((s) => s.name.startsWith("1"))),
    "outer tier should sit further from the centre",
  );
});

function insideSection(px, py, s) {
  const cx = (s.x + s.width / 2) * AR;
  const cy = s.y + s.height / 2;
  const a = (-(s.rotation || 0) * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= (s.width * AR) / 2 && Math.abs(ly) <= s.height / 2;
}

const ray = (phi, r) => ({
  x: centre.x + Math.cos(phi) * r,
  y: centre.y + Math.sin(phi) * r,
});

function pointToSegment(p, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len = vx * vx + vy * vy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
}

function quadDistance(A, B) {
  let best = Infinity;
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (const p of P) {
      for (let i = 0; i < Q.length; i += 1) {
        best = Math.min(best, pointToSegment(p, Q[i], Q[(i + 1) % Q.length]));
      }
    }
  }
  return best;
}

test("an outer tier holds a whole multiple of the tier inside it", () => {
  const drafts = bowl({ shape: "oval", tiers: 3, perSide: 6 });
  const counts = ["1", "2", "3"].map(
    (t) => drafts.filter((s) => s.name.startsWith(t)).length,
  );
  for (const count of counts) {
    assert.equal(
      count % counts[0],
      0,
      `tier of ${count} is not a whole multiple of ${counts[0]}`,
    );
  }
});

test("every tier is laid out against the same walkways", () => {
  for (const shape of ["oval", "rect", "horseshoe"]) {
    const plan = planBowl({ field: FIELD, aspect: ASPECT, shape, tiers: 3, perSide: 6 });
    assert.ok(plan.aisles.length >= 12, `${shape} laid only ${plan.aisles.length} walkways`);

    for (const t of ["1", "2", "3"]) {
      const count = plan.drafts.filter((s) => s.name.startsWith(t)).length;
      if (!count) continue;
      assert.equal(
        count % plan.aisles.length,
        0,
        `${shape} tier ${t}: ${count} blocks doesn't divide by ${plan.aisles.length} walkways`,
      );
    }
  }
});

test("neighbouring blocks are separated by a real walkway", () => {
  for (const shape of ["oval", "rect"]) {
    const plan = planBowl({ field: FIELD, aspect: ASPECT, shape, tiers: 2, perSide: 6 });
    for (const t of ["1", "2"]) {
      const tier = plan.drafts
        .filter((s) => s.name.startsWith(t))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (let i = 0; i < tier.length; i += 1) {
        const gap = quadDistance(
          drawnCorners(tier[i]),
          drawnCorners(tier[(i + 1) % tier.length]),
        );
        assert.ok(
          gap > 0.3,
          `${shape} tier ${t}: ${tier[i].name} and its neighbour are ${gap.toFixed(2)} apart`,
        );
      }
    }
  }
});

test("sections are named by tier", () => {
  const drafts = bowl({ shape: "rect", tiers: 2, perSide: 2 });
  assert.ok(drafts.some((s) => s.name === "101"));
  assert.ok(drafts.some((s) => s.name === "201"));
});

test("no section is generated on top of the field", () => {
  const fieldQuad = [
    [FIELD.x * AR, FIELD.y],
    [(FIELD.x + FIELD.width) * AR, FIELD.y],
    [(FIELD.x + FIELD.width) * AR, FIELD.y + FIELD.height],
    [FIELD.x * AR, FIELD.y + FIELD.height],
  ];
  for (const { value } of BOWL_SHAPES) {
    if (value === "rounds") continue;
    for (const s of bowl({ shape: value, tiers: 2, perSide: 6 })) {
      assert.ok(!overlaps(drawnCorners(s), fieldQuad), `${value} ${s.name} stands on the field`);
    }
  }
});

test("a horseshoe leaves a gap at the stage end", () => {
  const drafts = bowl({ shape: "horseshoe", tiers: 1, perSide: 5 });
  const aboveField = drafts.filter(
    (s) =>
      s.y + s.height / 2 < FIELD.y &&
      Math.abs((s.x + s.width / 2) * AR - centre.x) < 6 * AR,
  );
  assert.equal(aboveField.length, 0, "horseshoe should not close over the stage");
});

test("banquet rounds skip the dance floor and stay square", () => {
  const drafts = bowl({ shape: "rounds", tables: 16 });
  assert.ok(drafts.length > 0);
  assert.ok(drafts.every((s) => s.name.startsWith("Table ")));
  for (const s of drafts) {
    const cxs = s.x + s.width / 2;
    const cys = s.y + s.height / 2;
    const onFloor =
      cxs > FIELD.x && cxs < FIELD.x + FIELD.width && cys > FIELD.y && cys < FIELD.y + FIELD.height;
    assert.ok(!onFloor, `${s.name} landed on the dance floor`);
    assert.ok(Math.abs(s.width * AR - s.height) < 0.05, `${s.name} is not square on screen`);
  }
});

test("every generated section stays on the canvas", () => {
  for (const { value } of BOWL_SHAPES) {
    for (const s of bowl({ shape: value, tiers: 2, perSide: 5 })) {
      for (const [x, y] of drawnCorners(s)) {
        assert.ok(x >= -0.5 && x <= 100 * AR + 0.5, `${value} ${s.name} x=${x.toFixed(1)}`);
        assert.ok(y >= -0.5 && y <= 100.5, `${value} ${s.name} y=${y.toFixed(1)}`);
      }
    }
  }
});

test("a bowl too deep for the canvas is squeezed, not spilled", () => {
  const plan = planBowl({ field: FIELD, aspect: ASPECT, shape: "oval", tiers: 5, tierDepth: 30 });
  assert.equal(plan.tiers, 5, "there is room for five tiers here, just shallower ones");
  assert.ok(plan.drafts[0].height < 30, `tier depth was not reduced (${plan.drafts[0].height})`);
  assert.deepEqual(collidingPairs(plan.drafts), []);
});

test("tiers are dropped once squeezing alone would leave them unusable", () => {
  const plan = planBowl({
    field: { x: 20, y: 25, width: 60, height: 50 },
    aspect: ASPECT,
    shape: "oval",
    tiers: 5,
  });
  assert.equal(plan.requestedTiers, 5);
  assert.ok(plan.tiers < 5, `should have dropped tiers, kept ${plan.tiers}`);
  assert.deepEqual(collidingPairs(plan.drafts), []);
});

test("planBowl reports a field no bowl can surround", () => {
  const plan = planBowl({
    field: { x: 0, y: 0, width: 100, height: 100 },
    aspect: ASPECT,
    shape: "oval",
  });
  assert.equal(plan.fits, false);
});

test("bowlSeatCount totals the chairs the bowl would create", () => {
  const drafts = bowl({ shape: "rect", tiers: 1, perSide: 2, rows: 10, seatsPerRow: 12 });
  assert.equal(bowlSeatCount(drafts), drafts.length * 120);
  assert.equal(bowlSeatCount([]), 0);
  assert.equal(bowlSeatCount(null), 0);
});

test("generated sections feed generateSeats and their chairs face the field", () => {
  const drafts = bowl({ shape: "rect", tiers: 1, perSide: 1, rows: 4, seatsPerRow: 4 });

  for (const section of drafts) {
    const seats = generateSeats(section, ASPECT);
    assert.equal(seats.length, 16, `${section.name} generated ${seats.length} seats`);

    const dist = (label) => {
      const row = seats.filter((s) => s.rowLabel === label);
      return (
        row.reduce((sum, s) => sum + Math.hypot(s.x * AR - centre.x, s.y - centre.y), 0) /
        row.length
      );
    };
    assert.ok(
      dist("A") < dist("D"),
      `${section.name}: row A should be closer to the field than row D`,
    );
  }
});

test("a generated section's chairs land inside the block as drawn", () => {
  for (const { value } of BOWL_SHAPES) {
    for (const section of bowl({ shape: value, tiers: 2, perSide: 5, rows: 6, seatsPerRow: 8 })) {
      const quad = drawnCorners(section);
      const xs = quad.map((p) => p[0]);
      const ys = quad.map((p) => p[1]);
      for (const seat of generateSeats(section, ASPECT)) {
        const ux = seat.x * AR;
        assert.ok(
          ux >= Math.min(...xs) - 0.3 && ux <= Math.max(...xs) + 0.3,
          `${value} ${section.name}: seat escaped its block in x`,
        );
        assert.ok(
          seat.y >= Math.min(...ys) - 0.3 && seat.y <= Math.max(...ys) + 0.3,
          `${value} ${section.name}: seat escaped its block in y`,
        );
      }
    }
  }
});
