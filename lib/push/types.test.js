import test from "node:test";
import assert from "node:assert/strict";

import { CATEGORY_KEYS, PUSH_TYPES, categoryOf, isTypeEnabled, normalizeCategories, normalizeSettings } from "./types.js";

test("every type belongs to a known category and keys are unique", () => {
  const keys = PUSH_TYPES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const t of PUSH_TYPES) assert.ok(CATEGORY_KEYS.includes(t.category), t.key);
  assert.equal(categoryOf("order_confirmed"), "tickets");
  assert.equal(categoryOf("nope"), null);
});

test("normalizeSettings fills defaults and drops unknown types", () => {
  const s = normalizeSettings({ types: { order_confirmed: false, bogus: false, checked_in: "no" } });
  assert.deepEqual(s.types, { order_confirmed: false });
  assert.deepEqual(s.eventOffsets, [1440, 60]);
  assert.deepEqual(s.membershipDays, [7, 1]);
  assert.deepEqual(s.quietHours, { enabled: false, start: "22:00", end: "08:00" });
  assert.equal(s.paused, false);
  assert.equal(isTypeEnabled(s, "order_confirmed"), false);
  assert.equal(isTypeEnabled(s, "checked_in"), true);
});

test("normalizeSettings bounds, dedupes and sorts offsets", () => {
  const s = normalizeSettings({ eventOffsets: [60, 60, 1, 99999, "30", 1440, 2880, 10080], membershipDays: [0, 7, 1, 90] });
  assert.deepEqual(s.eventOffsets, [10080, 2880, 1440, 60]);
  assert.deepEqual(s.membershipDays, [7, 1]);
});

test("normalizeSettings rejects malformed quiet hours", () => {
  const s = normalizeSettings({ quietHours: { enabled: 1, start: "25:00", end: "7:00" } });
  assert.deepEqual(s.quietHours, { enabled: true, start: "22:00", end: "08:00" });
});

test("normalizeCategories treats missing keys as on", () => {
  assert.deepEqual(normalizeCategories({ community: false, extra: false }), {
    tickets: true, reminders: true, updates: true, messages: true, community: false, meetings: true,
  });
});
