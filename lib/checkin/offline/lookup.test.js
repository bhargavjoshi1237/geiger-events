import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMovement,
  buildIndex,
  capFor,
  decideAdmit,
  decideExit,
  findByScan,
  reapplyQueue,
  scopeKey,
  searchIndex,
  ticketRow,
} from "./lookup.js";

const ord = "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c";
const reg = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const tickets = [
  { id: ord, kind: "order", name: "Ada Lovelace", email: "ada@x.io", code: "3F2B9C1E", party: 2, status: "Confirmed", admissible: true, scopes: {} },
  { id: reg, kind: "registration", name: "Bo Diddley", email: "bo@x.io", code: "A1B2C3D4", party: 1, status: "Cancelled", admissible: false, scopes: {} },
];
const index = buildIndex(tickets);

test("scope keys lower-case the zone and treat blanks as the venue", () => {
  assert.equal(scopeKey(null, " VIP "), "|vip");
  assert.equal(scopeKey("s1", ""), "s1|");
});

test("a scanned full id or 8-character code finds the ticket", () => {
  assert.equal(findByScan(index, `https://x.io/t/${ord}`).id, ord);
  assert.equal(findByScan(index, "a1b2c3d4").id, reg);
  assert.equal(findByScan(index, "ZZZZZZZZ"), null);
});

test("search matches name, email and code like checkin_search", () => {
  assert.deepEqual(searchIndex(index, "ada").map((t) => t.id), [ord]);
  assert.deepEqual(searchIndex(index, "bo@x").map((t) => t.id), [reg]);
  assert.deepEqual(searchIndex(index, "3f2b9c1e").map((t) => t.id), [ord]);
});

test("rows carry the scope state", () => {
  const moved = applyMovement(tickets[0], { kind: "in", zone: "VIP", at: "2026-11-08T10:00:00Z", gate: "North", device: "d1" });
  const row = ticketRow(moved, scopeKey(null, "vip"));
  assert.equal(row.orderId, ord);
  assert.equal(row.checkedIn, true);
  assert.equal(row.firstGate, "North");
  assert.equal(ticketRow(moved, scopeKey(null, "")).checkedIn, false);
});

test("offline admit refuses cancelled tickets and duplicates, honours re-entry", () => {
  assert.equal(decideAdmit(tickets[1], {}).kind, "blocked");
  const inside = applyMovement(tickets[0], { kind: "in", at: "t", device: "d1" });
  assert.equal(decideAdmit(inside, {}).kind, "already");
  const left = applyMovement(inside, { kind: "out" });
  assert.equal(decideAdmit(left, { settings: { reentry: "once" } }).reason, "no_reentry");
  assert.equal(decideAdmit(left, { settings: { reentry: "multi" } }).kind, "admit");
  assert.equal(decideExit(left, {}).kind, "notInside");
  assert.equal(decideExit(inside, {}).kind, "exit");
});

test("a hard cap blocks offline admits unless the organiser allows it", () => {
  const caps = [{ zoneKey: "z1", zone: "VIP", hardCap: 10, reentry: "inherit" }, { zoneKey: "", zone: "", hardCap: null }];
  assert.equal(capFor(caps, "vip", null).zoneKey, "z1");
  assert.equal(capFor(caps, "", "s1"), null);
  assert.equal(decideAdmit(tickets[0], { zone: "VIP", caps }).kind, "capacity");
  assert.equal(decideAdmit(tickets[0], { zone: "VIP", caps, settings: { allowCappedZones: true } }).kind, "admit");
  assert.equal(decideAdmit(tickets[0], { caps }).kind, "admit");
});

test("pending queue items are replayed onto a fresh snapshot", () => {
  const out = reapplyQueue(tickets, [
    { seq: 2, status: "pending", kind: "out", orderId: ord },
    { seq: 1, status: "pending", kind: "in", orderId: ord, scannedAt: "t1", deviceId: "d1" },
    { seq: 3, status: "done", kind: "in", registrationId: reg },
  ]);
  assert.deepEqual(out[0].scopes["|"], { in: false, out: true, at: "t1", gate: null, device: "d1" });
  assert.deepEqual(out[1].scopes, {});
});
