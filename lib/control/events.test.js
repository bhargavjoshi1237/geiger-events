import test from "node:test";
import assert from "node:assert/strict";

import { arrangeEvents, localDay } from "./events.js";

const row = (id, event_date, extra = {}) => ({
  id, name: id, status: "Published", event_date, event_time: "19:00", venue: "Hall", city: "London",
  timezone: "Europe/London", capacity: 100, sold: 10, cover_url: null, ...extra,
});

test("localDay uses the event's timezone", () => {
  const now = new Date("2026-11-08T23:30:00Z");
  assert.equal(localDay(now, "Europe/London"), "2026-11-08");
  assert.equal(localDay(now, "Asia/Kolkata"), "2026-11-09");
  assert.equal(localDay(now, "Not/AZone"), "2026-11-08");
});

test("today first, then upcoming soonest-first, then unscheduled, then the latest past events", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const out = arrangeEvents(
    [row("past-old", "2026-10-01"), row("later", "2026-12-01"), row("today", "2026-11-08"), row("soon", "2026-11-09"), row("tbd", null), row("past-new", "2026-11-01")],
    now,
  );
  assert.deepEqual(out.map((e) => e.id), ["today", "soon", "later", "tbd", "past-new", "past-old"]);
  assert.deepEqual(out.map((e) => e.when), ["today", "upcoming", "upcoming", "unscheduled", "past", "past"]);
});

test("an event abroad is 'today' by its own calendar", () => {
  const now = new Date("2026-11-08T23:30:00Z");
  const [event] = arrangeEvents([row("mumbai", "2026-11-09", { timezone: "Asia/Kolkata" })], now);
  assert.equal(event.when, "today");
});

test("only the ten most recent past events are kept, in camelCase", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const past = Array.from({ length: 14 }, (_, i) => row(`p${i}`, `2026-10-${String(i + 1).padStart(2, "0")}`));
  const out = arrangeEvents(past, now);
  assert.equal(out.length, 10);
  assert.equal(out[0].id, "p13");
  assert.deepEqual(Object.keys(out[0]).sort(), ["capacity", "city", "coverUrl", "date", "id", "name", "sold", "status", "time", "timezone", "venue", "when"]);
});
