import test from "node:test";
import assert from "node:assert/strict";

import { eventDetails, mergeTickets, parseEventPatch, ticketView } from "./event_fields.js";

test("a patch maps app fields to columns and only touches what was sent", () => {
  const { row, publicChange } = parseEventPatch({ name: "  Finals ", capacity: "500", date: "2026-12-01", time: "19:30" });
  assert.deepEqual(row, { name: "Finals", capacity: 500, event_date: "2026-12-01", event_time: "19:30" });
  assert.equal(publicChange, false);
});

test("clearing a date or time stores null", () => {
  const { row } = parseEventPatch({ date: "", time: null });
  assert.deepEqual(row, { event_date: null, event_time: null });
});

test("status, visibility and listing changes are flagged so the route can require the publish permission", () => {
  assert.equal(parseEventPatch({ status: "On Sale" }).publicChange, true);
  assert.equal(parseEventPatch({ visibility: "Public" }).publicChange, true);
  assert.equal(parseEventPatch({ isListable: true }).publicChange, true);
  assert.throws(() => parseEventPatch({ status: "Published" }), (e) => e.status === 400);
});

test("bad values are 400s naming the field", () => {
  assert.throws(() => parseEventPatch({ name: "" }), (e) => e.status === 400 && Boolean(e.fields?.name));
  assert.throws(() => parseEventPatch({ capacity: -1 }), (e) => Boolean(e.fields?.capacity));
  assert.throws(() => parseEventPatch({ capacity: 2.5 }), (e) => Boolean(e.fields?.capacity));
  assert.throws(() => parseEventPatch({ date: "01/12/2026" }), (e) => Boolean(e.fields?.date));
  assert.throws(() => parseEventPatch({ timezone: "Mars/Olympus" }), (e) => Boolean(e.fields?.timezone));
  assert.throws(() => parseEventPatch({ visibility: "Hidden" }), (e) => Boolean(e.fields?.visibility));
  assert.throws(() => parseEventPatch({}), (e) => e.status === 400);
});

test("creating needs a name and can't set a status", () => {
  assert.throws(() => parseEventPatch({ city: "Leeds" }, { create: true }), (e) => Boolean(e.fields?.name));
  const { row } = parseEventPatch({ name: "New", status: "On Sale" }, { create: true });
  assert.deepEqual(row, { name: "New" });
});

test("details default sensibly and lower-case the currency", () => {
  assert.deepEqual(eventDetails({ revenue: "120.50", currency: "GBP", is_listable: true }), {
    type: "In-person", address: "", revenue: 120.5, visibility: "Public", organizer: "", summary: "", isListable: true, currency: "gbp",
  });
});

test("tickets merge by id so dashboard-only keys survive an edit", () => {
  const current = [
    { id: "t1", name: "GA", price: 10, qty: 100, description: "", ticketTypeId: "type-1", groupId: "g", discountIds: ["d"], releases: [{ id: "r" }] },
    { id: "t2", name: "VIP", price: 50, qty: 10, description: "" },
  ];
  let n = 0;
  const next = mergeTickets(current, [{ id: "t1", name: "General", price: "12.499", qty: 120 }, { name: "Late", price: 0, qty: 0 }], () => `new-${++n}`);
  assert.equal(next.length, 2);
  assert.deepEqual(next[0], { ...current[0], name: "General", price: 12.5, qty: 120, description: "" });
  assert.deepEqual(next[1], {
    id: "new-1", name: "Late", price: 0, qty: 0, description: "", ticketTypeId: null, groupId: null, discountIds: [], releases: [],
  });
});

test("a repeated or unknown id becomes a new ticket rather than a duplicate", () => {
  let n = 0;
  const next = mergeTickets([{ id: "t1", name: "GA", price: 1, qty: 1 }], [
    { id: "t1", name: "A", price: 1, qty: 1 },
    { id: "t1", name: "B", price: 1, qty: 1 },
    { id: "ghost", name: "C", price: 1, qty: 1 },
  ], () => `new-${++n}`);
  assert.deepEqual(next.map((t) => t.id), ["t1", "new-1", "new-2"]);
});

test("invalid tickets are refused", () => {
  const id = () => "x";
  assert.throws(() => mergeTickets([], "nope", id), (e) => e.status === 400);
  assert.throws(() => mergeTickets([], [{ name: "", price: 1, qty: 1 }], id), (e) => e.status === 400);
  assert.throws(() => mergeTickets([], [{ name: "A", price: -1, qty: 1 }], id), (e) => e.status === 400);
  assert.throws(() => mergeTickets([], [{ name: "A", price: 1, qty: 1.5 }], id), (e) => e.status === 400);
});

test("a ticket's view says whether the dashboard attached rules to it", () => {
  assert.deepEqual(ticketView({ id: "t", name: "GA", price: "5", qty: "3", ticketTypeId: "x", releases: [{}, {}] }), {
    id: "t", name: "GA", price: 5, qty: 3, description: "", hasType: true, releases: 2,
  });
});
