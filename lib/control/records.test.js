import test from "node:test";
import assert from "node:assert/strict";

import {
  admitOutcome,
  codeRange,
  orderStatus,
  orderView,
  parseGuest,
  parseOrderPatch,
  parseRefund,
  searchTerm,
  ticketCode,
} from "./records.js";

const order = (extra = {}) => ({
  id: "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c", event_id: "e", buyer_name: "Ada", buyer_email: "ada@x.io", ticket_name: "GA",
  ticket_price: 49, quantity: 2, total: 98, refunded_total: 0, cancelled_at: null, created_at: "2026-11-08T09:00:00Z", note: null, ...extra,
});

test("order status follows the dashboard's derivation", () => {
  assert.equal(orderStatus(order()), "Paid");
  assert.equal(orderStatus(order({ refunded_total: 10 })), "Partially refunded");
  assert.equal(orderStatus(order({ refunded_total: 98 })), "Refunded");
  assert.equal(orderStatus(order({ cancelled_at: "2026-11-09T00:00:00Z", refunded_total: 98 })), "Cancelled");
});

test("an order's view carries its ticket code and what's left to refund", () => {
  const view = orderView(order({ refunded_total: 18.5 }), "Finals");
  assert.equal(view.code, "3F2B9C1E");
  assert.equal(view.refundable, 79.5);
  assert.equal(view.eventName, "Finals");
  assert.equal(orderView(order({ cancelled_at: "2026-11-09T00:00:00Z" })).refundable, 0);
});

test("a refund can't exceed what's left or be zero", () => {
  assert.deepEqual(parseRefund({ amount: "20", reasonCode: "duplicate", reason: " double " }, order()), {
    amount: 20, reasonCode: "duplicate", reason: "double",
  });
  assert.equal(parseRefund({ amount: 5, reasonCode: "made-up" }, order()).reasonCode, "other");
  assert.throws(() => parseRefund({ amount: 0 }, order()), (e) => e.status === 400);
  assert.throws(() => parseRefund({ amount: 99 }, order()), (e) => e.status === 400);
  assert.throws(() => parseRefund({ amount: 80 }, order({ refunded_total: 20 })), (e) => e.status === 400);
});

test("order corrections validate the email and keep the note separate", () => {
  assert.deepEqual(parseOrderPatch({ email: " Ada@X.io ", note: "comped" }), { patch: { buyer_email: "ada@x.io" }, note: "comped" });
  assert.throws(() => parseOrderPatch({ email: "nope" }), (e) => e.status === 400);
  assert.throws(() => parseOrderPatch({}), (e) => e.status === 400);
});

test("search text can't break PostgREST's or() grammar", () => {
  assert.equal(searchTerm("ada,(x)*%"), "ada x");
  assert.equal(searchTerm(null), "");
});

test("an 8-character code becomes a uuid range; anything else doesn't", () => {
  assert.deepEqual(codeRange("3F2B9C1E"), {
    from: "3f2b9c1e-0000-0000-0000-000000000000",
    to: "3f2b9c1e-ffff-ffff-ffff-ffffffffffff",
  });
  assert.equal(codeRange("3F2B9C1"), null);
  assert.equal(codeRange("ZZZZZZZZ"), null);
  assert.equal(ticketCode("3f2b9c1e-8d4a"), "3F2B9C1E");
});

test("guests need a name; email is optional but must be valid", () => {
  assert.deepEqual(parseGuest({ name: " Ada ", email: "" }), { name: "Ada", email: "", partySize: 1, phone: "" });
  assert.throws(() => parseGuest({ name: "" }), (e) => e.status === 400);
  assert.throws(() => parseGuest({ name: "A", email: "x" }), (e) => e.status === 400);
  assert.throws(() => parseGuest({ name: "A", partySize: 0 }), (e) => e.status === 400);
});

test("admit results map to the four outcomes the app renders", () => {
  assert.equal(admitOutcome({ ok: true, name: "Ada", party: 3 }).message, "Admitted, party of 3");
  assert.equal(admitOutcome({ already: true }, "Ada").status, "already");
  assert.deepEqual(admitOutcome({ capacity: true, canOverride: true }).canOverride, true);
  const blocked = admitOutcome({ reason: "refunded" }, "Ada");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.message, "This ticket was refunded");
});
