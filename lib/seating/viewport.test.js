import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SEAT_SPAN,
  SEAT_SPAN_FULL,
  clampView,
  fitView,
  frameSeats,
  measureSeatPitch,
  seatOpacity,
  seatsInView,
  viewWindow,
  zoomAt,
} from "./viewport.js";

const ASPECT = "16/10"; // ar 1.6 -> a venue 160 units wide, 100 tall
const WIDE = 1.6; // a viewport the same shape as the venue
const TALL = 1.0; // a square dialog

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

test("fitting a venue into a viewport of its own shape shows all of it", () => {
  const view = fitView(ASPECT, WIDE);
  assert.ok(near(view.cx, 80));
  assert.ok(near(view.cy, 50));
  assert.ok(near(view.spanY, 100));
});

test("a narrower viewport zooms out until the venue's width fits", () => {
  // 160 units of width in a square window needs 160 units of height too.
  const view = fitView(ASPECT, TALL);
  assert.ok(near(view.spanY, 160));
});

// The invariant the whole file exists to hold: a chair has to come out square.
test("the window always matches the shape of the viewport", () => {
  for (const va of [0.6, 1, 1.6, 2.4]) {
    const w = viewWindow({ cx: 80, cy: 50, spanY: 40 }, va);
    assert.ok(near(w.spanX / w.spanY, va), `aspect drifted at ${va}`);
  }
});

test("the view cannot be zoomed out past the whole venue", () => {
  const clamped = clampView({ cx: 80, cy: 50, spanY: 5000 }, ASPECT, WIDE);
  assert.ok(near(clamped.spanY, fitView(ASPECT, WIDE).spanY));
});

test("the view cannot be zoomed in past a seat or two", () => {
  const clamped = clampView({ cx: 80, cy: 50, spanY: 0.001 }, ASPECT, WIDE);
  assert.ok(clamped.spanY >= 1.5);
});

test("panning cannot drag the venue off the screen", () => {
  const clamped = clampView({ cx: 100000, cy: -100000, spanY: 20 }, ASPECT, WIDE);
  // Still somewhere over a 160x100 venue, give or take the overscroll margin.
  assert.ok(clamped.cx < 200, `cx ran away to ${clamped.cx}`);
  assert.ok(clamped.cy > -50, `cy ran away to ${clamped.cy}`);
});

test("a venue smaller than its window sits in the middle rather than drifting", () => {
  const a = clampView({ cx: 0, cy: 0, spanY: 100 }, ASPECT, WIDE);
  const b = clampView({ cx: 160, cy: 100, spanY: 100 }, ASPECT, WIDE);
  assert.deepEqual(a, b);
  assert.ok(near(a.cx, 80));
  assert.ok(near(a.cy, 50));
});

// Zooming under the pointer: whatever is beneath the cursor stays beneath it.
test("zooming holds the anchor point still", () => {
  const before = { cx: 80, cy: 50, spanY: 100 };
  const anchor = { x: 40, y: 25 };
  const after = zoomAt(before, 2, anchor, ASPECT, WIDE);

  const w0 = viewWindow(before, WIDE);
  const w1 = viewWindow(after, WIDE);
  // The anchor's position within the window, as a fraction, is unchanged.
  const fx0 = (anchor.x - w0.xMin) / w0.spanX;
  const fx1 = (anchor.x - w1.xMin) / w1.spanX;
  const fy0 = (anchor.y - w0.yMin) / w0.spanY;
  const fy1 = (anchor.y - w1.yMin) / w1.spanY;
  assert.ok(near(fx0, fx1, 1e-6), `x drifted ${fx0} -> ${fx1}`);
  assert.ok(near(fy0, fy1, 1e-6), `y drifted ${fy0} -> ${fy1}`);
});

test("zooming without a usable anchor still zooms", () => {
  const after = zoomAt({ cx: 80, cy: 50, spanY: 100 }, 2, null, ASPECT, WIDE);
  assert.ok(after.spanY < 100);
});

test("chairs are hidden when zoomed out and solid when zoomed in", () => {
  assert.equal(seatOpacity(100), 0);
  assert.equal(seatOpacity(SEAT_SPAN), 0);
  assert.equal(seatOpacity(SEAT_SPAN_FULL), 1);
  assert.equal(seatOpacity(2), 1);
  const mid = seatOpacity((SEAT_SPAN + SEAT_SPAN_FULL) / 2);
  assert.ok(mid > 0 && mid < 1, "chairs should ramp, not pop");
});

test("only the seats under the window are handed to the renderer", () => {
  const seats = [
    { id: "in", x: 50, y: 50 }, // units (80, 50) — dead centre
    { id: "out", x: 5, y: 95 }, // units (8, 95) — far corner
  ];
  const window_ = viewWindow({ cx: 80, cy: 50, spanY: 10 }, WIDE);
  const visible = seatsInView(seats, window_, ASPECT);
  assert.deepEqual(visible.map((s) => s.id), ["in"]);
});

test("the margin keeps a hard edge of nothing out of view while panning", () => {
  // A seat just outside the window but inside the margin still gets drawn.
  const window_ = viewWindow({ cx: 80, cy: 50, spanY: 10 }, WIDE);
  const justOutside = [{ id: "edge", x: (window_.xMax + 1) / 1.6, y: 50 }];
  assert.equal(seatsInView(justOutside, window_, ASPECT, 0).length, 0);
  assert.equal(seatsInView(justOutside, window_, ASPECT, 0.25).length, 1);
});

test("the chair pitch is measured from the chairs, not assumed", () => {
  // A grid on a 2-unit pitch in x (percent 1.25 * ar 1.6) and 3 in y.
  const seats = [];
  for (let r = 0; r < 4; r += 1) {
    for (let s = 0; s < 4; s += 1) {
      seats.push({ x: (10 + s * 2) / 1.6, y: 20 + r * 3 });
    }
  }
  assert.ok(near(measureSeatPitch(seats, ASPECT), 2, 1e-6));
});

test("a stray outlying chair does not set the scale for the venue", () => {
  const seats = [];
  for (let s = 0; s < 20; s += 1) seats.push({ x: (10 + s * 2) / 1.6, y: 50 });
  seats.push({ x: 90, y: 95 }); // miles away
  assert.ok(near(measureSeatPitch(seats, ASPECT), 2, 1e-6));
});

test("too few chairs to measure falls back rather than dividing by zero", () => {
  assert.ok(Number.isFinite(measureSeatPitch([], ASPECT)));
  assert.ok(Number.isFinite(measureSeatPitch([{ x: 1, y: 1 }], ASPECT)));
});

test("framing a row centres it and leaves room around it", () => {
  const seats = [
    { x: 40 / 1.6, y: 60 },
    { x: 50 / 1.6, y: 60 },
  ];
  const frame = frameSeats(seats, ASPECT, 1.2);
  assert.ok(near(frame.cx, 45));
  assert.ok(near(frame.cy, 60));
  assert.ok(frame.spanY > 0, "a single row still needs a span to look at");
});

test("framing nothing returns nothing to frame", () => {
  assert.equal(frameSeats([], ASPECT), null);
});

test("empty input degrades rather than throwing", () => {
  assert.deepEqual(seatsInView(), []);
  assert.deepEqual(seatsInView([], null), []);
  assert.ok(Number.isFinite(viewWindow(null, 1).spanY));
  assert.ok(Number.isFinite(clampView(null, ASPECT, WIDE).cx));
});
