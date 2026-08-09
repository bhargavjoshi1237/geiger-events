import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateSeats,
  rotatePoint,
  rowLabels,
  seatLabels,
  sectionSeatCount,
} from "./generate.js";

test("alpha row labels roll over past Z", () => {
  assert.deepEqual(rowLabels(3, "alpha", "A"), ["A", "B", "C"]);
  assert.equal(rowLabels(27, "alpha", "A")[26], "AA");
});

test("alpha row labels honour a start letter", () => {
  assert.deepEqual(rowLabels(2, "alpha", "C"), ["C", "D"]);
});

test("numeric row labels count from the start", () => {
  assert.deepEqual(rowLabels(3, "numeric", "1"), ["1", "2", "3"]);
});

test("continental numbering runs straight across", () => {
  assert.deepEqual(seatLabels(4, "continental"), ["1", "2", "3", "4"]);
});

test("odd-even numbering counts outward from centre", () => {
  assert.deepEqual(seatLabels(6, "odd-even"), ["5", "3", "1", "2", "4", "6"]);
});

test("odd-even handles an odd seat count", () => {
  assert.deepEqual(seatLabels(5, "odd-even"), ["5", "3", "1", "2", "4"]);
});

test("generateSeats produces rows x seatsPerRow seats", () => {
  const seats = generateSeats({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    layout: { rows: 3, seatsPerRow: 4, rowLabels: "alpha", numbering: "continental" },
  });
  assert.equal(seats.length, 12);
  assert.equal(seats[0].rowLabel, "A");
  assert.equal(seats[0].seatLabel, "1");
});

test("generateSeats keeps every seat inside the section box", () => {
  const seats = generateSeats({
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    layout: {
      rows: 5,
      seatsPerRow: 10,
      rowLabels: "alpha",
      numbering: "continental",
      curve: 20,
      rake: 40,
    },
  });
  for (const s of seats) {
    assert.ok(s.x >= 10 && s.x <= 50, `x ${s.x} out of box`);
    assert.ok(s.y >= 20 && s.y <= 50, `y ${s.y} out of box`);
  }
});

test("aisleAfter widens the gap without leaving a hole in the numbering", () => {
  const seats = generateSeats({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    layout: {
      rows: 1,
      seatsPerRow: 6,
      rowLabels: "alpha",
      numbering: "continental",
      aisleAfter: [3],
    },
  });
  assert.equal(seats.length, 6);
  assert.deepEqual(
    seats.map((s) => s.seatLabel),
    ["1", "2", "3", "4", "5", "6"],
  );
  const gap = seats[3].x - seats[2].x;
  const normal = seats[1].x - seats[0].x;
  assert.ok(gap > normal, `expected a wider gap at the aisle (${gap} vs ${normal})`);
});

test("a GA zone generates no chairs and counts by capacity", () => {
  const zone = { kind: "ga", capacity: 250, layout: {} };
  assert.deepEqual(generateSeats(zone), []);
  assert.equal(sectionSeatCount(zone), 250);
});

test("a seated section counts rows x seatsPerRow", () => {
  assert.equal(sectionSeatCount({ layout: { rows: 12, seatsPerRow: 24 } }), 288);
});

test("rotatePoint leaves a point alone at zero degrees", () => {
  assert.deepEqual(rotatePoint(10, 20, 0, 0, 0), { x: 10, y: 20 });
});

test("rotatePoint turns a quarter turn about the centre", () => {
  const p = rotatePoint(10, 0, 0, 0, 90);
  assert.ok(Math.abs(p.x) < 1e-9, `x should be ~0, got ${p.x}`);
  assert.ok(Math.abs(p.y - 10) < 1e-9, `y should be ~10, got ${p.y}`);
});

test("a rotated section carries its chairs around with it", () => {
  const base = { x: 10, y: 10, width: 40, height: 20 };
  const layout = { rows: 2, seatsPerRow: 6, rowLabels: "alpha", numbering: "continental" };
  const flat = generateSeats({ ...base, layout });
  const turned = generateSeats({ ...base, rotation: 90, layout });

  assert.equal(flat.length, turned.length);

  // A quarter turn about the box centre swaps the spans: the wide axis becomes
  // the tall one. Compare extents rather than individual seats.
  const spanX = (seats) => Math.max(...seats.map((s) => s.x)) - Math.min(...seats.map((s) => s.x));
  const spanY = (seats) => Math.max(...seats.map((s) => s.y)) - Math.min(...seats.map((s) => s.y));

  assert.ok(spanX(flat) > spanY(flat), "flat section should be wider than tall");
  assert.ok(spanY(turned) > spanX(turned), "rotated section should be taller than wide");
  assert.ok(Math.abs(spanX(flat) - spanY(turned)) < 0.1, "the wide span should become the tall one");
});

test("rotation keeps the section's centre of mass put", () => {
  const base = { x: 20, y: 30, width: 30, height: 10 };
  const layout = { rows: 3, seatsPerRow: 5 };
  const mean = (seats, key) => seats.reduce((sum, s) => sum + s[key], 0) / seats.length;

  const flat = generateSeats({ ...base, layout });
  const turned = generateSeats({ ...base, rotation: 137, layout });

  assert.ok(Math.abs(mean(flat, "x") - mean(turned, "x")) < 0.6, "centre x drifted");
  assert.ok(Math.abs(mean(flat, "y") - mean(turned, "y")) < 0.6, "centre y drifted");
});

test("a zero-row section generates nothing rather than throwing", () => {
  assert.deepEqual(generateSeats({ layout: { rows: 0, seatsPerRow: 10 } }), []);
  assert.deepEqual(generateSeats(null), []);
});
