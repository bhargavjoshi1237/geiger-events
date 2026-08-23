import { test } from "node:test";
import assert from "node:assert/strict";

import { generateSeats, rotatePoint } from "./generate.js";
import { sectionSeatGrid } from "./section_grid.js";

const ASPECT = "16/10";
const AR = 1.6;

// Chair-to-chair distance in UNITS, which is what the eye reads: percent is
// anisotropic on a 16:10 canvas, so comparing raw percent deltas proves nothing.
function unitGap(a, b) {
  return Math.hypot((a.gx - b.gx) * AR, a.gy - b.gy);
}

function pitches(placed) {
  const rows = new Map();
  for (const seat of placed) {
    const list = rows.get(seat.rowLabel);
    if (list) list.push(seat);
    else rows.set(seat.rowLabel, [seat]);
  }
  const labels = [...rows.keys()];
  const first = rows.get(labels[0]);
  return {
    along: unitGap(first[0], first[1]),
    across: unitGap(rows.get(labels[0])[0], rows.get(labels[1])[0]),
  };
}

// A real bowl block: its share of the arc is far wider than its tier is deep,
// so 14 chairs across and 12 rows down sit ~1.5:1 apart. That is a seating
// chart, not a fault — rows and chairs are spaced differently in every venue.
const WIDE = {
  x: 75.11,
  y: 47.83,
  width: 4.81,
  height: 4.35,
  rotation: 270,
  kind: "seated",
  layout: { rows: 12, seatsPerRow: 14, rowLabels: "alpha", numbering: "continental" },
};

test("chairs are drawn where the venue stores them", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);
  for (let i = 0; i < seats.length; i += 1) {
    assert.ok(Math.abs(placed[i].gx - seats[i].x) < 0.02);
    assert.ok(Math.abs(placed[i].gy - seats[i].y) < 0.02);
  }
});

test("row spacing and seat spacing are left to differ — that IS the chart", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);
  const before = pitches(seats.map((s) => ({ ...s, gx: s.x, gy: s.y })));
  const after = pitches(placed);
  assert.ok(before.along / before.across > 1.4, "fixture is spaced 1.5:1");
  assert.ok(Math.abs(after.along - before.along) < 0.01);
  assert.ok(Math.abs(after.across - before.across) < 0.01);
});

test("pitch is the tighter spacing, so a chair can't touch its neighbour", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed, pitch } = sectionSeatGrid(seats, WIDE, ASPECT);
  const { along, across } = pitches(placed);
  assert.ok(Math.abs(pitch - Math.min(along, across)) < 0.01);
  assert.ok(pitch <= along + 0.01 && pitch <= across + 0.01);
});

test("rotation is preserved — a turned block stays turned", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);
  const rowA = placed.filter((s) => s.rowLabel === "A");
  // At 270 degrees a row runs vertically, so every chair in it shares an x.
  const xs = new Set(rowA.map((s) => s.gx.toFixed(1)));
  assert.equal(xs.size, 1);
});

test("the frame keeps the block's facing, and its chairs sit inside it", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed, frame, pitch } = sectionSeatGrid(seats, WIDE, ASPECT);
  assert.equal(frame.rotation, 270);

  // Un-rotate each chair about the frame's centre — the same point CSS turns
  // the highlight about — and it must land inside the un-turned rect.
  const cx = (frame.x + frame.width / 2) * AR;
  const cy = frame.y + frame.height / 2;
  const halfW = (frame.width * AR) / 2;
  const halfH = frame.height / 2;
  for (const seat of placed) {
    const p = rotatePoint(seat.gx * AR, seat.gy, cx, cy, -frame.rotation);
    assert.ok(Math.abs(p.x - cx) <= halfW + 0.01, "chair inside the frame across");
    assert.ok(Math.abs(p.y - cy) <= halfH + 0.01, "chair inside the frame along");
  }
  // …and the frame is no more than a chair's padding bigger than they are.
  const spanAcross = Math.max(...placed.map((s) => s.gy)) - Math.min(...placed.map((s) => s.gy));
  assert.ok(frame.height - spanAcross < pitch * 2.5);
});

test("row labels are parked at the ends of the rows, not down one side", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { rows, pitch } = sectionSeatGrid(seats, WIDE, ASPECT);
  assert.equal(rows.length, WIDE.layout.rows);
  // Turned 270 degrees, a row runs vertically — so its label is offset
  // vertically from the row, and the twelve labels spread out horizontally.
  const xs = new Set(rows.map((r) => r.x.toFixed(1)));
  assert.ok(xs.size >= WIDE.layout.rows - 1, "one label per row, side by side");
  const ys = new Set(rows.map((r) => r.y.toFixed(1)));
  assert.equal(ys.size, 1, "all parked at the same end of their row");
  assert.ok(pitch > 0);
});

test("bounds hug the chairs, not the upright box they're stored in", () => {
  const seats = generateSeats(WIDE, ASPECT);
  const { bounds, pitch } = sectionSeatGrid(seats, WIDE, ASPECT);
  // Turned 270 degrees, the block is deeper than it is wide on screen — the
  // stored box says the opposite.
  assert.ok(bounds.height > bounds.width * AR);
  assert.ok(WIDE.width > WIDE.height);
  // Every chair sits inside, with room for its own width.
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);
  for (const seat of placed) {
    assert.ok(seat.gx >= bounds.x && seat.gx <= bounds.x + bounds.width);
    assert.ok(seat.gy >= bounds.y && seat.gy <= bounds.y + bounds.height);
  }
  assert.ok(pitch > 0);
});

test("a single row still has a pitch to draw its chairs at", () => {
  const oneRow = { ...WIDE, rotation: 0, layout: { ...WIDE.layout, rows: 1, seatsPerRow: 8 } };
  const seats = generateSeats(oneRow, ASPECT);
  const { seats: placed, pitch } = sectionSeatGrid(seats, oneRow, ASPECT);
  assert.equal(placed.length, 8);
  assert.ok(pitch > 0);
  assert.ok(Math.abs(placed[0].gy - seats[0].y) < 0.02);
});

test("rows are drawn as an exact lattice, not at storage precision", () => {
  // The stored chairs are numeric(6, 2), so a 4.81%-wide block's 0.34% seat
  // pitch arrives quantized to ~3% of itself. Drilled in at 10-40x that is a
  // visible wobble, so the drawn positions have to be the layout's own.
  const seats = generateSeats(WIDE, ASPECT);
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);

  const byRow = new Map();
  for (const seat of placed) {
    const list = byRow.get(seat.rowLabel);
    if (list) list.push(seat);
    else byRow.set(seat.rowLabel, [seat]);
  }

  // Drawn coordinates carry 4dp, so a gap can still be off by a rounding step
  // at each end — two orders of magnitude inside the 0.01 the table stores, and
  // well under a device pixel at any zoom the canvas allows.
  const EVEN = 1e-3;

  for (const row of byRow.values()) {
    const gaps = row.slice(1).map((seat, i) => unitGap(row[i], seat));
    const spread = Math.max(...gaps) - Math.min(...gaps);
    assert.ok(spread < EVEN, `chairs evenly spaced along a row (spread ${spread})`);
  }

  // …and every row runs parallel: at 270 degrees each one is a vertical line,
  // so its chairs share an x rather than scattering either side of one.
  for (const row of byRow.values()) {
    const xs = row.map((s) => s.gx);
    assert.ok(Math.max(...xs) - Math.min(...xs) < EVEN, "the row is straight");
  }
});

test("a section the layout can't account for keeps its stored coordinates", () => {
  // A CSV import carries surveyed positions and a layout that doesn't describe
  // them; snapping those onto a generated grid would move real chairs.
  const seats = generateSeats(WIDE, ASPECT).map((seat, i) =>
    i === 3 ? { ...seat, seatLabel: "SURVEYED", x: seat.x + 0.5 } : seat,
  );
  const { seats: placed } = sectionSeatGrid(seats, WIDE, ASPECT);
  for (let i = 0; i < seats.length; i += 1) {
    assert.ok(Math.abs(placed[i].gx - seats[i].x) < 1e-6);
    assert.ok(Math.abs(placed[i].gy - seats[i].y) < 1e-6);
  }
});

test("no seats degrades rather than throwing", () => {
  const empty = sectionSeatGrid([], WIDE, ASPECT);
  assert.deepEqual(empty.seats, []);
  assert.equal(empty.bounds, null);
  assert.equal(empty.pitch, 0);
});
