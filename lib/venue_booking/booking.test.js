import { test } from "node:test";
import assert from "node:assert/strict";

import { billableHours, priceDay, priceSegments } from "./pricing.js";
import { checkSlot, dayWindow, evaluateSlot, findClash, freeSlots, quote } from "./availability.js";
import { fromWall, toWall, zonedDateTime, zonedInstant } from "./time.js";

const RATES = { hourly: 100, halfDay: 350, fullDay: 600, currency: "GBP" };

test("priceDay picks the cheapest mix of day, half-day and hourly", () => {
  assert.equal(priceDay(2, RATES).amount, 200);
  assert.equal(priceDay(4, RATES).amount, 350);
  assert.equal(priceDay(5, RATES).amount, 450);
  assert.equal(priceDay(7, RATES).amount, 600);
  assert.equal(priceDay(10, RATES).amount, 600);
  assert.deepEqual(priceDay(10, RATES).items.map((i) => i.kind), ["full_day"]);
  assert.deepEqual(priceDay(5, RATES).items.map((i) => i.kind), ["half_day", "hourly"]);
});

test("priceDay works with a partial rate card", () => {
  assert.equal(priceDay(9, { halfDay: 300 }).amount, 900);
  assert.equal(priceDay(3.5, { hourly: 40 }).amount, 140);
  assert.equal(priceDay(3, { fullDay: 500 }).amount, 500);
  assert.equal(priceDay(3, {}).amount, 0);
  assert.equal(priceDay(0, RATES).amount, 0);
});

test("billable hours round up to the half hour", () => {
  assert.equal(billableHours(61), 1.5);
  assert.equal(billableHours(90), 1.5);
  assert.equal(billableHours(91), 2);
});

test("wall clock conversion survives a DST change", () => {
  const tz = "Europe/London";
  const summer = zonedInstant("2026-07-01", "09:00", tz);
  assert.equal(summer.toISOString(), "2026-07-01T08:00:00.000Z");
  const winter = zonedInstant("2026-12-01", "09:00", tz);
  assert.equal(winter.toISOString(), "2026-12-01T09:00:00.000Z");
  assert.deepEqual(zonedDateTime(summer, tz), { date: "2026-07-01", time: "09:00" });
  const wall = toWall(summer, tz);
  assert.equal(fromWall(wall, tz).toISOString(), summer.toISOString());
});

const SPACE = {
  id: "s1",
  minHours: 2,
  bufferMinutes: 30,
  rateHourly: 100,
  rateHalfDay: 350,
  rateFullDay: 600,
  currency: "GBP",
  capacities: { theatre: 100 },
  openingHours: {
    mon: { open: "08:00", close: "22:00" },
    tue: { open: "08:00", close: "22:00" },
    wed: { open: "08:00", close: "22:00" },
    thu: { open: "08:00", close: "22:00" },
    fri: { open: "08:00", close: "22:00" },
    sat: { open: "10:00", close: "18:00" },
    sun: { closed: true },
  },
  blackoutDates: [{ from: "2026-12-24", to: "2026-12-26", reason: "Christmas" }],
};
const TZ = "Europe/London";
const at = (date, time) => zonedInstant(date, time, TZ);

test("opening hours, closures, blackouts and the minimum are enforced", () => {
  assert.equal(evaluateSlot(SPACE, at("2026-12-07", "09:00"), at("2026-12-07", "17:00"), TZ).ok, true);
  assert.equal(evaluateSlot(SPACE, at("2026-12-07", "07:00"), at("2026-12-07", "10:00"), TZ).code, "BEFORE_OPENING");
  assert.equal(evaluateSlot(SPACE, at("2026-12-07", "20:00"), at("2026-12-07", "23:00"), TZ).code, "AFTER_CLOSING");
  assert.equal(evaluateSlot(SPACE, at("2026-12-06", "10:00"), at("2026-12-06", "12:00"), TZ).code, "CLOSED");
  assert.equal(evaluateSlot(SPACE, at("2026-12-24", "10:00"), at("2026-12-24", "12:00"), TZ).code, "BLACKOUT");
  assert.equal(evaluateSlot(SPACE, at("2026-12-07", "10:00"), at("2026-12-07", "11:00"), TZ).code, "BELOW_MINIMUM");
  assert.equal(dayWindow({}, "sun").close, 1440);
});

test("multi-day bookings bill each day's opening-hours overlap", () => {
  const res = evaluateSlot(SPACE, at("2026-12-07", "14:00"), at("2026-12-08", "12:00"), TZ);
  assert.equal(res.ok, true);
  assert.deepEqual(res.segments.map((s) => s.billableMinutes), [480, 240]);
  const priced = priceSegments(res.segments, { hourly: 100, halfDay: 350, fullDay: 600 });
  assert.equal(priced.total, 600 + 350);
});

test("turnover buffer blocks the slot after a booking", () => {
  const bookings = [
    { id: "b1", spaceId: "s1", status: "confirmed", startsAt: at("2026-12-07", "09:00"), endsAt: at("2026-12-07", "12:00"), blockedUntil: at("2026-12-07", "12:30") },
  ];
  assert.ok(findClash(bookings, "s1", at("2026-12-07", "12:00"), at("2026-12-07", "14:00"), 30));
  assert.equal(findClash(bookings, "s1", at("2026-12-07", "12:30"), at("2026-12-07", "14:30"), 30), null);
  // A booking placed before must leave its own buffer.
  assert.ok(findClash(bookings, "s1", at("2026-12-07", "06:45"), at("2026-12-07", "08:45"), 30));
  assert.equal(findClash(bookings, "s1", at("2026-12-07", "06:30"), at("2026-12-07", "08:30"), 30), null);
});

test("expired holds stop blocking; live holds still block", () => {
  const now = at("2026-12-01", "09:00").getTime();
  const hold = (expires) => ({ id: "h", spaceId: "s1", status: "hold", holdExpiresAt: expires, startsAt: at("2026-12-07", "09:00"), endsAt: at("2026-12-07", "12:00") });
  const live = [hold(at("2026-12-02", "09:00"))];
  const dead = [hold(at("2026-11-30", "09:00"))];
  assert.ok(findClash(live, "s1", at("2026-12-07", "10:00"), at("2026-12-07", "12:00"), 0, { now }));
  assert.equal(findClash(dead, "s1", at("2026-12-07", "10:00"), at("2026-12-07", "12:00"), 0, { now }), null);
});

test("checkSlot reports capacity and clashes with a quote", () => {
  const now = at("2026-12-01", "09:00").getTime();
  const res = checkSlot({ space: SPACE, timeZone: TZ, startsAt: at("2026-12-07", "09:00"), endsAt: at("2026-12-07", "13:00"), bookings: [], setupStyle: "theatre", attendees: 150, now });
  assert.equal(res.code, "OVER_CAPACITY");
  const ok = checkSlot({ space: SPACE, timeZone: TZ, startsAt: at("2026-12-07", "09:00"), endsAt: at("2026-12-07", "13:00"), bookings: [], setupStyle: "theatre", attendees: 80, now });
  assert.equal(ok.ok, true);
  assert.equal(ok.quote.total, 350);
});

test("freeSlots carves bookings and buffers out of opening hours", () => {
  const now = at("2026-12-01", "09:00").getTime();
  const bookings = [
    { id: "b1", spaceId: "s1", status: "confirmed", startsAt: at("2026-12-07", "12:00"), endsAt: at("2026-12-07", "14:00"), blockedUntil: at("2026-12-07", "14:30") },
  ];
  const slots = freeSlots(SPACE, bookings, "2026-12-07", TZ, { now });
  assert.deepEqual(slots.map((s) => [s.startMinute, s.endMinute]), [[480, 690], [870, 1320]]);
  assert.deepEqual(freeSlots(SPACE, bookings, "2026-12-06", TZ, { now }), []);
});

test("quote() works from a bare rate card", () => {
  const res = quote(RATES, at("2026-12-07", "09:00"), at("2026-12-07", "15:00"), { timeZone: TZ });
  assert.equal(res.ok, true);
  assert.equal(res.total, 550);
});
