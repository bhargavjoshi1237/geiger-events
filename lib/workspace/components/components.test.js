import { test } from "node:test";
import assert from "node:assert/strict";
import { dayWindow, findClashes, movedTimes, scheduleDays, scheduleItems, snap, timelineBars } from "./schedule.js";
import { autoPlace, placementState } from "./placement.js";
import { looksLikePass, passSecret, signPass, verifyPass } from "./pass.js";

const link = (...ids) => ids.map((id) => ({ kind: "record", id, label: id }));
const session = (id, start, end, room, people = []) => ({ id, values: { start, end }, links: { room: link(room), speakers: link(...people) } });

test("schedule: items get event-time-zone days and minutes, with fallbacks for missing ends", () => {
  const items = scheduleItems([
    session("a", "2026-07-01T07:00:00Z", "2026-07-01T08:30:00Z", "r1"),
    { id: "b", values: { start: "2026-07-01T09:00:00Z", length: 2700 }, links: {} },
    { id: "c", values: { start: "2026-07-01T23:30:00Z" }, links: {} },
    { id: "skip", values: {}, links: {} },
  ], { startField: "start", endField: "end", durationField: "length", laneField: { id: "room", type: "link_record" }, timeZone: "Europe/Madrid" });
  assert.deepEqual(items.map((item) => [item.id, item.day, item.startMin, item.endMin, item.lanes]), [
    ["a", "2026-07-01", 540, 630, ["r1"]],
    ["b", "2026-07-01", 660, 705, []],
    ["c", "2026-07-02", 90, 120, []],
  ]);
});

test("schedule: clashes share a lane or a person and overlap in time", () => {
  const items = scheduleItems([
    session("a", "2026-07-01T09:00:00Z", "2026-07-01T10:00:00Z", "r1", ["p1"]),
    session("b", "2026-07-01T09:30:00Z", "2026-07-01T10:30:00Z", "r1", ["p2"]),
    session("c", "2026-07-01T10:00:00Z", "2026-07-01T11:00:00Z", "r2", ["p1"]),
    session("d", "2026-07-01T09:45:00Z", "2026-07-01T10:15:00Z", "r2", ["p1"]),
  ], { startField: "start", endField: "end", laneField: { id: "room", type: "link_record" }, peopleField: "speakers" });
  const rooms = findClashes(items);
  assert.deepEqual([...rooms.get("a")], ["b"]);
  assert.deepEqual([...rooms.get("c")].sort(), ["d"]);
  assert.equal(rooms.has("a") && !rooms.get("a").has("c"), true, "back-to-back isn't a clash");
  const people = findClashes(items, { by: "people" });
  assert.deepEqual([...people.get("d")].sort(), ["a", "c"]);
});

test("schedule: snapping, windows, days and moves across a DST change", () => {
  assert.deepEqual([snap(7), snap(8), snap(52), snap(53)], [0, 15, 45, 60]);
  assert.deepEqual(dayWindow([{ startMin: 7 * 60 + 30, endMin: 19 * 60 + 10 }]), { from: 420, to: 1200 });
  assert.deepEqual(dayWindow([]), { from: 480, to: 1080 });
  assert.deepEqual(scheduleDays([{ day: "2026-07-03" }], { startDate: "2026-07-01", count: 2 }), ["2026-07-01", "2026-07-02", "2026-07-03"]);
  const [item] = scheduleItems([session("a", "2026-03-28T09:00:00Z", "2026-03-28T10:00:00Z", "r1")], { startField: "start", endField: "end", timeZone: "Europe/London" });
  assert.deepEqual(movedTimes(item, { day: "2026-03-29", startMin: 9 * 60 + 7, timeZone: "Europe/London" }), { start: "2026-03-29T08:00:00.000Z", end: "2026-03-29T09:00:00.000Z" }, "09:00 BST is 08:00 UTC");
  assert.deepEqual(movedTimes(item, { endMin: 9 * 60 + 5, timeZone: "Europe/London" }), { start: "2026-03-28T09:00:00.000Z", end: "2026-03-28T09:15:00.000Z" }, "never shorter than a slot");
  const bars = timelineBars([{ id: "x", start: 0, end: 50 }, { id: "y", start: 150, end: 300 }, { id: "z", start: 400, end: 500 }], 100, 300);
  assert.deepEqual(bars.map((bar) => [bar.id, bar.left, bar.width]), [["y", 0.25, 0.75]]);
});

const place = (id, capacity, track, start, end) => ({ id, values: { cap: capacity, track, start, end }, links: {} });
const item = (id, placeIds = [], track = null) => ({ id, values: { track }, links: { room: link(...placeIds) } });

test("placement: fill, the tray, over capacity and double-booked items", () => {
  const places = [place("p1", 2, "ai", "2026-07-01T09:00:00Z", "2026-07-01T10:00:00Z"), place("p2", 1, "web", "2026-07-01T09:30:00Z", "2026-07-01T11:00:00Z"), place("p3", null, "ai")];
  const items = [item("i1", ["p1"]), item("i2", ["p1", "p2"]), item("i3", ["p2"]), item("i4"), item("i5", ["gone"])];
  const state = placementState({ items, places, linkFieldId: "room", capacityFieldId: "cap", startField: "start", endField: "end" });
  assert.deepEqual(state.places.map((entry) => [entry.id, entry.used, entry.capacity, entry.over]), [["p1", 2, 2, false], ["p2", 2, 1, true], ["p3", 0, null, false]]);
  assert.deepEqual(state.tray.map((entry) => entry.id), ["i4", "i5"], "links to unknown places count as unplaced");
  assert.deepEqual(state.overlaps, [{ itemId: "i2", places: ["p1", "p2"] }]);
});

test("placement: auto-place fills open capacity in order and can match a choice", () => {
  const places = [place("p1", 1, "ai"), place("p2", 2, "web"), place("p3", 0, "ai")];
  const items = [item("i1", [], "web"), item("i2", [], "ai"), item("i3", [], "ai"), item("i4", [], "web"), item("i5", [], "web")];
  assert.deepEqual(autoPlace({ items, places, linkFieldId: "room", capacityFieldId: "cap" }).map((pair) => `${pair.itemId}>${pair.placeId}`), ["i1>p1", "i2>p2", "i3>p2"]);
  assert.deepEqual(autoPlace({ items, places, linkFieldId: "room", capacityFieldId: "cap", match: { itemField: "track", placeField: "track" } }).map((pair) => `${pair.itemId}>${pair.placeId}`),
    ["i1>p2", "i2>p1", "i4>p2"], "matching choices; i3 finds no ai room left");
  assert.equal(autoPlace({ items, places: [place("open", null)], linkFieldId: "room", capacityFieldId: "cap" }).length, 5, "no capacity means no limit");
});

test("passes: signed, event-bound and unforgeable", () => {
  const key = passSecret({ WORKSPACE_PASS_SECRET: "s3cret" });
  const event = "9b1f2c3d-1111-4222-8333-444455556666";
  const record = "0f0e0d0c-aaaa-4bbb-8ccc-dddddddddddd";
  const code = signPass(event, record, key);
  assert.match(code, /^ws1\.9b1f2c3d\.0f0e0d0c-aaaa-4bbb-8ccc-dddddddddddd\.[A-Za-z0-9_-]{22}$/);
  assert.ok(looksLikePass(code) && !looksLikePass("3F2B9C1E"));
  assert.equal(verifyPass(code, event, key), record);
  assert.equal(verifyPass(` ${code} `, event, key), record, "whitespace from scanners is ignored");
  assert.equal(verifyPass(code, "9b1f2c3d-1111-4222-8333-000000000000", key), null, "another event with the same prefix");
  assert.equal(verifyPass(code.replace(record, "0f0e0d0c-aaaa-4bbb-8ccc-ddddddddddde"), event, key), null, "another record");
  assert.equal(verifyPass(code, event, passSecret({ WORKSPACE_PASS_SECRET: "other" })), null, "another secret");
  assert.equal(verifyPass(`${code.slice(0, -1)}x`, event, key), null);
  assert.throws(() => passSecret({}), /No secret/);
});

test("blocks: schedule, placement, scanner and calendar settings validate against the lists", async () => {
  const { validateBlock, defaultBlockConfig } = await import("../portal/blocks.js");
  const S = "33333333-3333-4333-8333-333333333333";
  const R = "44444444-4444-4444-8444-444444444444";
  const A = "55555555-5555-4555-8555-555555555555";
  const field = (id, objectId, key, type, config = {}) => ({ id, objectId, key, name: key, type, config, required: false, isUnique: false, position: 0, revision: 1, deletedAt: null });
  const definition = {
    objects: [
      { id: S, key: "sessions", name: "Session", plural: "Sessions", numberPrefix: "SES", statuses: [], position: 0, deletedAt: null },
      { id: R, key: "rooms", name: "Room", plural: "Rooms", numberPrefix: "ROO", statuses: [], position: 1, deletedAt: null },
      { id: A, key: "attendance", name: "Attendance", plural: "Attendance", numberPrefix: "ATT", statuses: [], position: 2, deletedAt: null },
    ],
    fields: [
      field("f-start", S, "start", "datetime"), field("f-end", S, "end", "datetime"), field("f-day", S, "day", "date"),
      field("f-room", S, "room", "link_record", { targetObjectId: R }), field("f-cap", R, "capacity", "number"),
      field("f-who", A, "who", "link_record", { targetObjectId: R }), field("f-session", A, "session", "link_record", { targetObjectId: S }),
      field("f-at", A, "at", "datetime"),
    ],
  };
  const ctx = { definition, kind: "page", objectId: null, audience: {} };
  const schedule = validateBlock({ kind: "schedule", config: { source: { objectId: S }, startField: "f-start", endField: "f-day", laneField: "f-room", startDate: "2026-07-01", days: 40 } }, ctx);
  assert.deepEqual([schedule.endField, schedule.laneField, schedule.startDate, schedule.days], [null, "f-room", "2026-07-01", 14], "date-only ends are dropped; days are capped");
  assert.throws(() => validateBlock({ kind: "schedule", config: { source: { objectId: S }, startField: "f-day" } }, ctx), /date-and-time/);
  const placement = validateBlock({ kind: "placement", config: { source: { objectId: S }, linkField: "f-room", capacityField: "f-cap", match: { itemField: "nope", placeField: "f-cap" } } }, ctx);
  assert.deepEqual([placement.linkField, placement.capacityField, placement.match], ["f-room", "f-cap", null]);
  const scanner = validateBlock({ kind: "scanner", config: { objectId: A, personField: "f-who", contextField: "f-session", context: "page" } }, ctx);
  assert.equal(scanner.context, "choose", "“this record” only works on the context list's record page");
  const onPage = validateBlock({ kind: "scanner", config: { objectId: A, personField: "f-who", contextField: "f-session", context: "page" } }, { ...ctx, kind: "record", objectId: S });
  assert.equal(onPage.context, "page");
  assert.equal(validateBlock({ kind: "calendar", config: { source: { objectId: S }, dateField: "f-day", startDate: "soon" } }, ctx).startDate, null);
  for (const kind of ["schedule", "timeline", "placement", "scanner", "pass"]) {
    const config = defaultBlockConfig(kind, { definition, objectId: kind === "scanner" ? A : S });
    assert.doesNotThrow(() => validateBlock({ kind, config }, ctx), `${kind} defaults validate`);
  }
});
