import test from "node:test";
import assert from "node:assert/strict";

import { dueEventOffsets, eventReminderRows, inWindow, liveRoomRows, meetingReminderRows, membershipReminderRows } from "./plan_rules.js";

const event = { id: "e1", project_id: "p1", event_date: "2026-11-28", event_time: "19:00", timezone: "Europe/London" };
const start = new Date("2026-11-28T19:00:00Z");

test("inWindow looks 10 minutes ahead and 15 back", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  assert.equal(inWindow(new Date("2026-11-28T12:09:00Z"), now), true);
  assert.equal(inWindow(new Date("2026-11-28T12:11:00Z"), now), false);
  assert.equal(inWindow(new Date("2026-11-28T11:46:00Z"), now), true);
  assert.equal(inWindow(new Date("2026-11-28T11:44:00Z"), now), false);
});

test("dueEventOffsets picks the offsets falling due now", () => {
  assert.deepEqual(dueEventOffsets(event, [1440, 60], new Date("2026-11-28T17:55:00Z")).due, [60]);
  assert.deepEqual(dueEventOffsets(event, [1440, 60], new Date("2026-11-27T18:58:00Z")).due, [1440]);
  assert.deepEqual(dueEventOffsets(event, [1440, 60], new Date("2026-11-28T14:00:00Z")).due, []);
  // After the start nothing is due
  assert.deepEqual(dueEventOffsets(event, [1440, 60], new Date("2026-11-28T19:05:00Z")).due, []);
});

test("date-only events only get day-level reminders", () => {
  const dateOnly = { ...event, event_time: "" };
  // starts 09:00 London; 60 min would be 08:00
  assert.deepEqual(dueEventOffsets(dateOnly, [1440, 60], new Date("2026-11-28T08:00:00Z")).due, []);
  assert.deepEqual(dueEventOffsets(dateOnly, [1440, 60], new Date("2026-11-27T09:00:00Z")).due, [1440]);
});

test("eventReminderRows: one row per holder with dedupe, schedule and expiry", () => {
  const rows = eventReminderRows(event, start, 60, [{ memberId: "m1", orderId: "o1" }, { memberId: "m2", orderId: null }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    member: "m1", project: "p1", event: "e1", type: "event_starting",
    ref: { eventId: "e1", offset: 60, orderId: "o1" },
    dedupe: "event_starting:e1:60:2026-11-28T19:00:00.000Z:m1",
    sendAfter: "2026-11-28T18:00:00.000Z",
    expiresAt: "2026-11-28T19:00:00.000Z",
  });
});

test("meetingReminderRows fires 10 minutes before for every participant", () => {
  const meeting = { id: "mt", project_id: "p1", event_id: "e1", participants: ["a", "b"], starts_at: "2026-11-28T15:00:00Z", status: "scheduled" };
  const rows = meetingReminderRows(meeting, new Date("2026-11-28T14:45:00Z"));
  assert.deepEqual(rows.map((r) => r.member), ["a", "b"]);
  assert.equal(rows[0].sendAfter, "2026-11-28T14:50:00.000Z");
  assert.deepEqual(meetingReminderRows({ ...meeting, status: "cancelled" }, new Date("2026-11-28T14:45:00Z")), []);
});

test("membershipReminderRows: lead days and the expiry itself", () => {
  const m = { id: "mm", project_id: "p1", status: "Active", expires_at: "2026-12-05T10:00:00Z" };
  const week = membershipReminderRows(m, "u1", [7, 1], new Date("2026-11-28T10:05:00Z"));
  assert.deepEqual(week.map((r) => [r.type, r.ref.days]), [["membership_expiring", 7]]);
  const expired = membershipReminderRows(m, "u1", [7, 1], new Date("2026-12-05T11:00:00Z"));
  assert.deepEqual(expired.map((r) => r.type), ["membership_expired"]);
  assert.deepEqual(membershipReminderRows(m, null, [7], new Date("2026-11-28T10:05:00Z")), []);
  // An extended membership gets fresh keys, so its new expiry is reminded too.
  const extended = membershipReminderRows({ ...m, expires_at: "2027-01-05T10:00:00Z" }, "u1", [7], new Date("2026-12-29T10:05:00Z"));
  assert.notEqual(extended[0].dedupe, week[0].dedupe);
});

test("liveRoomRows keys dedupe on the start so a rescheduled room notifies again", () => {
  const rows = liveRoomRows({ id: "r1", project_id: "p1", starts_at: "2026-11-28T18:00:00Z" }, ["m1"]);
  assert.equal(rows[0].dedupe, "live_starting:r1:2026-11-28T18:00:00.000Z:m1");
  assert.equal(rows[0].expiresAt, "2026-11-28T18:30:00.000Z");
});
