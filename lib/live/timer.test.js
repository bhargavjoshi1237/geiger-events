import { test } from "node:test";
import assert from "node:assert/strict";

import { breakoutTimer, formatCountdown } from "./timer.js";

const at = (iso) => new Date(iso).getTime();

test("no timer set means not running", () => {
  const t = breakoutTimer({ config: {} }, at("2026-08-10T10:00:00Z"));
  assert.equal(t.running, false);
  assert.equal(t.secondsRemaining, 0);
});

test("a future end time counts down", () => {
  const t = breakoutTimer(
    { config: { timerEndsAt: "2026-08-10T10:05:00Z" } },
    at("2026-08-10T10:00:00Z"),
  );
  assert.equal(t.running, true);
  assert.equal(t.secondsRemaining, 300);
});

test("a past end time is finished, never negative", () => {
  const t = breakoutTimer(
    { config: { timerEndsAt: "2026-08-10T10:00:00Z" } },
    at("2026-08-10T10:05:00Z"),
  );
  assert.equal(t.running, false);
  assert.equal(t.secondsRemaining, 0);
});

test("unparseable timer text is treated as no timer", () => {
  const t = breakoutTimer({ config: { timerEndsAt: "25 minutes" } }, at("2026-08-10T10:00:00Z"));
  assert.equal(t.running, false);
});

test("countdown formats as mm:ss and never goes negative", () => {
  assert.equal(formatCountdown(300), "05:00");
  assert.equal(formatCountdown(65), "01:05");
  assert.equal(formatCountdown(0), "00:00");
  assert.equal(formatCountdown(-10), "00:00");
});
