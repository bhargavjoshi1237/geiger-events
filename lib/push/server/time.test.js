import test from "node:test";
import assert from "node:assert/strict";

import { eventStart, fmtEventWhen, fmtLead, inQuietHours, parseEventTime, quietHoursEnd } from "./time.js";

test("parseEventTime reads 24h, 12h and ranges", () => {
  assert.equal(parseEventTime("19:00"), 1140);
  assert.equal(parseEventTime("7pm"), 1140);
  assert.equal(parseEventTime("7:30 PM - 10pm"), 1170);
  assert.equal(parseEventTime("12am"), 0);
  assert.equal(parseEventTime("12:15 pm"), 735);
  assert.equal(parseEventTime(""), null);
  assert.equal(parseEventTime("TBC"), null);
});

test("eventStart converts wall time in the event's zone, across DST", () => {
  const summer = eventStart({ event_date: "2026-07-10", event_time: "19:00", timezone: "Europe/London" });
  assert.equal(summer.start.toISOString(), "2026-07-10T18:00:00.000Z");
  assert.equal(summer.hasTime, true);
  const winter = eventStart({ event_date: "2026-12-10", event_time: "19:00", timezone: "Europe/London" });
  assert.equal(winter.start.toISOString(), "2026-12-10T19:00:00.000Z");
  const dateOnly = eventStart({ event_date: "2026-12-10", event_time: "", timezone: "Asia/Kolkata" });
  assert.equal(dateOnly.hasTime, false);
  assert.equal(dateOnly.start.toISOString(), "2026-12-10T03:30:00.000Z");
  assert.equal(eventStart({}).start, null);
});

test("fmtEventWhen and fmtLead read naturally", () => {
  assert.equal(fmtEventWhen({ event_date: "2026-11-28", event_time: "19:00", timezone: "Europe/London" }), "Sat, Nov 28 · 7:00 PM");
  assert.equal(fmtEventWhen({ event_date: "2026-11-28", timezone: "Europe/London" }), "Sat, Nov 28");
  assert.equal(fmtLead(60), "1 hour");
  assert.equal(fmtLead(180), "3 hours");
  assert.equal(fmtLead(30), "30 minutes");
  assert.equal(fmtLead(1440), "1 day");
  assert.equal(fmtLead(2880), "2 days");
});

test("quiet hours wrap midnight in the event's zone", () => {
  const qh = { enabled: true, start: "22:00", end: "08:00" };
  // 23:30 in London (winter, UTC+0)
  const late = new Date("2026-12-01T23:30:00Z");
  assert.equal(inQuietHours(late, qh, "Europe/London"), true);
  assert.equal(quietHoursEnd(late, qh, "Europe/London").toISOString(), "2026-12-02T08:00:00.000Z");
  // 02:00 London is still quiet; ends the same morning
  const early = new Date("2026-12-02T02:00:00Z");
  assert.equal(quietHoursEnd(early, qh, "Europe/London").toISOString(), "2026-12-02T08:00:00.000Z");
  // midday is not quiet; disabled is never quiet
  assert.equal(inQuietHours(new Date("2026-12-02T12:00:00Z"), qh, "Europe/London"), false);
  assert.equal(inQuietHours(late, { ...qh, enabled: false }, "Europe/London"), false);
  // 23:30 UTC is 05:00 next day in Kolkata: quiet there too
  assert.equal(inQuietHours(late, qh, "Asia/Kolkata"), true);
});
