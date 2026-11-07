import test from "node:test";
import assert from "node:assert/strict";
import { blockedMessage, pickScanMatch, scanQuery } from "./scan.js";

const order = "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c";
const reg = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const rows = [
  { orderId: order, registrationId: null, ticketCode: "3F2B9C1E", name: "Ada" },
  { orderId: null, registrationId: reg, ticketCode: "A1B2C3D4", name: "Bo" },
];

test("a bare order id from a ticket QR is used as the lookup", () => {
  assert.deepEqual(scanQuery(order), { query: order, id: order });
});

test("an id inside a URL or without dashes is normalised", () => {
  assert.equal(scanQuery(`https://geiger.studio/events/checkin?t=${order}`).id, order);
  assert.equal(scanQuery(order.replace(/-/g, "").toUpperCase()).id, order);
});

test("names and short codes pass through untouched", () => {
  assert.deepEqual(scanQuery("  3f2b9c1e "), { query: "3f2b9c1e", id: null });
  assert.deepEqual(scanQuery("Ada Lovelace"), { query: "Ada Lovelace", id: null });
});

test("a scanned id picks its own row even when others match", () => {
  assert.equal(pickScanMatch(rows, order).name, "Ada");
  assert.equal(pickScanMatch(rows, reg).name, "Bo");
});

test("a scanned id with no matching row picks nothing", () => {
  assert.equal(pickScanMatch(rows, "00000000-0000-4000-8000-000000000000"), null);
});

test("a short code picks its row, and a lone result is picked", () => {
  assert.equal(pickScanMatch(rows, "a1b2c3d4").name, "Bo");
  assert.equal(pickScanMatch([rows[0]], "Ada").name, "Ada");
  assert.equal(pickScanMatch(rows, "a"), null);
});

test("refusals read as staff-facing text", () => {
  assert.equal(blockedMessage("refunded", "Ada"), "This ticket was refunded: Ada");
  assert.equal(blockedMessage("mystery"), "This ticket can't be admitted");
});
