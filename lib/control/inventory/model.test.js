import test from "node:test";
import assert from "node:assert/strict";

import {
  deskRoleView,
  itemTree,
  newDeskCode,
  parseAllocation,
  parseDeskRolePatch,
  parseIssueOrReturn,
  parseItemPatch,
  parseMember,
  parseMovement,
  parsePoStatus,
  poRef,
  receivePlan,
  stockStatus,
} from "./model.js";

const E = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";
const item = (extra = {}) => ({ id: I, name: "Tee", variant_label: "", on_hand: 10, reorder_point: 0, ...extra });

test("stock status follows the reorder point, with 0 switching the low band off", () => {
  assert.equal(stockStatus(0, 5), "Out of stock");
  assert.equal(stockStatus(4, 5), "Low stock");
  assert.equal(stockStatus(4, 0), "In stock");
});

test("parents roll their variants' stock up and take the worst status", () => {
  const tree = itemTree([
    { id: "p", name: "Tee", on_hand: 0 },
    { id: "v1", parent_id: "p", name: "Tee", variant_label: "S", on_hand: 3, reorder_point: 5 },
    { id: "v2", parent_id: "p", name: "Tee", variant_label: "M", on_hand: 7 },
    { id: "solo", name: "Mug", on_hand: 0 },
  ]);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].onHand, 10);
  assert.equal(tree[0].status, "Low stock");
  assert.equal(tree[0].variants[0].label, "Tee — S");
  assert.equal(tree[1].status, "Out of stock");
});

test("item edits are the drawer's fields, validated", () => {
  assert.deepEqual(parseItemPatch({ name: " Hoodie ", unitPrice: "40", category: "Merch" }), { name: "Hoodie", unit_price: 40, category: "Merch" });
  assert.throws(() => parseItemPatch({ category: "Weapons" }), (e) => e.status === 400);
  assert.throws(() => parseItemPatch({ unitCost: -1 }), (e) => e.status === 400);
  assert.throws(() => parseItemPatch({}), (e) => e.status === 400);
  assert.throws(() => parseItemPatch({ sku: "X" }, { create: true }), (e) => e.status === 400);
});

test("movements are signed by kind and never take stock below zero", () => {
  assert.equal(parseMovement({ kind: "receive", qty: 5 }, item()).qty, 5);
  assert.equal(parseMovement({ kind: "waste", qty: "2" }, item()).qty, -2);
  assert.equal(parseMovement({ kind: "adjust", qty: 3, direction: "out" }, item()).qty, -3);
  assert.equal(parseMovement({ kind: "adjust", qty: 3 }, item()).qty, 3);
  assert.throws(() => parseMovement({ kind: "transfer", qty: 11 }, item()), (e) => Boolean(e.fields?.qty));
  assert.throws(() => parseMovement({ kind: "steal", qty: 1 }, item()), (e) => Boolean(e.fields?.kind));
  assert.throws(() => parseMovement({ kind: "receive", qty: 0 }, item()), (e) => Boolean(e.fields?.qty));
});

test("allocations need an event and item; ticket issuance only keeps the event's own tickets", () => {
  const row = parseAllocation({ eventId: E, itemId: I, plannedQty: 50, issuance: "ticket", ticketIds: ["t1", "ghost"], qtyPerAttendee: 2 }, [{ id: "t1" }]);
  assert.deepEqual(row.ticket_ids, ["t1"]);
  assert.equal(row.qty_per_attendee, 2);
  assert.equal(parseAllocation({ eventId: E, itemId: I, issuance: "audience" }, []).issuance, "internal");
  assert.throws(() => parseAllocation({ eventId: E, itemId: I, issuance: "ticket", ticketIds: ["ghost"] }, [{ id: "t1" }]), (e) => e.status === 400);
  assert.throws(() => parseAllocation({ itemId: I }, []), (e) => Boolean(e.fields?.eventId));
});

test("issuing is capped by what's outstanding and on hand; returning by what was issued", () => {
  const allocation = { planned_qty: 10, issued_qty: 4 };
  const issued = parseIssueOrReturn({ mode: "issue", qty: 6 }, allocation, item({ on_hand: 8 }));
  assert.deepEqual(issued.movement, { kind: "issue", qty: -6, reason: "Issued to event" });
  assert.deepEqual(issued.patch, { issued_qty: 10, status: "Issued" });
  assert.throws(() => parseIssueOrReturn({ mode: "issue", qty: 7 }, allocation, item({ on_hand: 20 })), (e) => e.status === 400);
  assert.throws(() => parseIssueOrReturn({ mode: "issue", qty: 6 }, allocation, item({ on_hand: 5 })), (e) => e.status === 400);
  assert.deepEqual(parseIssueOrReturn({ mode: "return", qty: 4 }, allocation, item()).patch, { issued_qty: 0 });
  assert.throws(() => parseIssueOrReturn({ mode: "return", qty: 5 }, allocation, item()), (e) => e.status === 400);
});

test("purchase orders: settable statuses only, and receiving moves every outstanding line", () => {
  assert.deepEqual(parsePoStatus({ status: "Ordered" }, { status: "Draft" }, "2026-11-22"), { status: "Ordered", ordered_at: "2026-11-22" });
  assert.throws(() => parsePoStatus({ status: "Received" }, { status: "Ordered" }, "x"), (e) => e.status === 400);
  assert.throws(() => parsePoStatus({ status: "Draft" }, { status: "Cancelled" }, "x"), (e) => e.status === 400);
  const plan = receivePlan({ status: "Ordered", lines: [{ itemId: I, qty: 10, receivedQty: 4 }, { itemId: "x", qty: 2, receivedQty: 2 }] }, "2026-11-22");
  assert.deepEqual(plan.movements, [{ itemId: I, qty: 6 }]);
  assert.equal(plan.patch.status, "Received");
  assert.equal(plan.patch.received_at, "2026-11-22");
  assert.throws(() => receivePlan({ status: "Ordered", lines: [{ itemId: I, qty: 1, receivedQty: 1 }] }, "x"), (e) => e.status === 400);
  assert.equal(poRef({ id: "abcdef12-0000", code: "" }), "PO-ABCDEF");
});

test("desk codes are six digits and ability edits keep the dashboard's allocation scope", () => {
  assert.match(newDeskCode(), /^\d{6}$/);
  const patch = parseDeskRolePatch({ canReturn: true }, { permissions: { canIssue: true, allocationIds: ["a1"] } });
  assert.deepEqual(patch.permissions, { canIssue: true, canReturn: true, canOverride: false, allocationIds: ["a1"] });
  assert.match(parseDeskRolePatch({ regenerate: true }, {}).access_code, /^\d{6}$/);
  assert.equal(deskRoleView({ id: "r", permissions: { allocationIds: ["a", "b"] } }).allocationCount, 2);
  assert.throws(() => parseDeskRolePatch({}, {}), (e) => e.status === 400);
});

test("members need an email on create and a plan from this project", () => {
  const plans = new Set(["plan-1"]);
  assert.deepEqual(parseMember({ name: "Ada", email: " ADA@x.io ", membershipId: "plan-1" }, { create: true, plans }), {
    name: "Ada",
    email: "ada@x.io",
    membership_id: "plan-1",
  });
  assert.throws(() => parseMember({ name: "Ada" }, { create: true, plans }), (e) => e.status === 400);
  assert.throws(() => parseMember({ membershipId: "other" }, { plans }), (e) => e.status === 400);
  assert.equal(parseMember({ expiresAt: "" }, { plans }).expires_at, null);
  assert.equal(parseMember({ status: "Cancelled" }, { plans }).status, "Cancelled");
  assert.throws(() => parseMember({ status: "Paused" }, { plans }), (e) => e.status === 400);
});
