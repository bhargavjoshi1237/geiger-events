import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveRoomState, OPENING_SOON_MS } from "./state.js";

const at = (iso) => new Date(iso).getTime();
const room = (over = {}) => ({ status: "Scheduled", startsAt: null, endsAt: null, config: {}, ...over });

test("a room with no schedule is manual — the organiser drives it", () => {
  const r = resolveRoomState(room(), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Manual");
  assert.equal(r.secondsUntilStart, null);
});

test("a manual override always wins over the schedule", () => {
  const r = resolveRoomState(
    room({ startsAt: "2026-08-10T12:00:00Z", config: { manualState: "Live" } }),
    at("2026-08-10T09:00:00Z"),
  );
  assert.equal(r.state, "Live");
});

test("before the window it is Scheduled, with a countdown", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Scheduled");
  assert.equal(r.secondsUntilStart, 7200);
});

test("inside the opening-soon window it flips to Opening soon", () => {
  const start = at("2026-08-10T12:00:00Z");
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), start - OPENING_SOON_MS + 1000);
  assert.equal(r.state, "Opening soon");
});

test("exactly at the start time the room is Live", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-08-10T12:00:00Z"));
  assert.equal(r.state, "Live");
});

test("exactly at the end time the room is Ended", () => {
  const r = resolveRoomState(
    room({ startsAt: "2026-08-10T12:00:00Z", endsAt: "2026-08-10T13:00:00Z" }),
    at("2026-08-10T13:00:00Z"),
  );
  assert.equal(r.state, "Ended");
});

test("a start with no end stays Live indefinitely", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-09-01T00:00:00Z"));
  assert.equal(r.state, "Live");
});

test("an unparseable date is treated as no schedule, not as epoch zero", () => {
  const r = resolveRoomState(room({ startsAt: "Day 1 · 09:00" }), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Manual");
});
