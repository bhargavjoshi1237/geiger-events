import { test } from "node:test";
import assert from "node:assert/strict";

import { assignAttendees } from "./assign.js";

const rooms = [
  { id: "r1", capacity: 2 },
  { id: "r2", capacity: 2 },
];
const people = ["a", "b", "c", "d"];

test("balanced mode spreads attendees evenly", () => {
  const out = assignAttendees(people, rooms, { mode: "balanced" });
  assert.equal(out.r1.length, 2);
  assert.equal(out.r2.length, 2);
});

test("nobody is assigned to two rooms", () => {
  const out = assignAttendees(people, rooms, { mode: "balanced" });
  const all = [...out.r1, ...out.r2];
  assert.equal(new Set(all).size, all.length);
});

test("capacity is never exceeded and the overflow is reported", () => {
  const out = assignAttendees([...people, "e"], rooms, { mode: "balanced" });
  assert.equal(out.r1.length + out.r2.length, 4);
  assert.deepEqual(out.__unassigned, ["e"]);
});

test("zero rooms leaves everyone unassigned rather than throwing", () => {
  const out = assignAttendees(people, [], { mode: "balanced" });
  assert.deepEqual(out.__unassigned, people);
});

test("sequential mode fills each room before starting the next", () => {
  const out = assignAttendees(people, rooms, { mode: "sequential" });
  assert.deepEqual(out.r1, ["a", "b"]);
  assert.deepEqual(out.r2, ["c", "d"]);
});

test("a duplicated attendee is placed once, not twice", () => {
  const out = assignAttendees(["a", "a", "b"], rooms, { mode: "balanced" });
  const all = [...out.r1, ...out.r2, ...out.__unassigned];
  assert.deepEqual(all.sort(), ["a", "b"]);
});

test("a zero-capacity room is skipped rather than filled", () => {
  const out = assignAttendees(["a"], [{ id: "r1", capacity: 0 }, { id: "r2", capacity: 1 }]);
  assert.deepEqual(out.r1, []);
  assert.deepEqual(out.r2, ["a"]);
});
