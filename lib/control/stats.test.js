import test from "node:test";
import assert from "node:assert/strict";

import { doorCounts, projectTotals, salesByDay, salesByTicket, totals } from "./stats.js";

const row = (created_at, extra = {}) => ({ created_at, total: 20, refunded_total: 0, quantity: 2, ticket_name: "GA", cancelled_at: null, ...extra });

test("sales by day fills empty days and nets refunds and cancellations", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const days = salesByDay(
    [
      row("2026-11-08T01:00:00Z"),
      row("2026-11-08T02:00:00Z", { refunded_total: 5 }),
      row("2026-11-06T02:00:00Z", { cancelled_at: "2026-11-07T00:00:00Z" }),
      row("2026-10-01T00:00:00Z"),
    ],
    now,
    3,
  );
  assert.deepEqual(days, [
    { date: "2026-11-06", sold: 0, revenue: 0 },
    { date: "2026-11-07", sold: 0, revenue: 0 },
    { date: "2026-11-08", sold: 4, revenue: 35 },
  ]);
});

test("tickets rank by revenue", () => {
  const out = salesByTicket([row("2026-11-08T00:00:00Z", { ticket_name: "VIP", total: 100, quantity: 1 }), row("2026-11-08T00:00:00Z")]);
  assert.deepEqual(out.map((t) => t.name), ["VIP", "GA"]);
});

test("totals skip cancelled orders; project totals split today from the week", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const rows = [row("2026-11-08T06:00:00Z"), row("2026-11-04T06:00:00Z"), row("2026-11-08T07:00:00Z", { cancelled_at: "x" })];
  assert.deepEqual(totals(rows), { orders: 2, sold: 4, revenue: 40 });
  assert.deepEqual(projectTotals(rows, now), { today: { orders: 1, sold: 2, revenue: 20 }, week: { orders: 2, sold: 4, revenue: 40 } });
});

test("door counts mirror checkin_stats: orders count, a buyer's own registration doesn't double up", () => {
  const registrations = [
    { email: "ada@x.io", status: "Confirmed" },
    { email: "rsvp@x.io", status: "Confirmed" },
    { email: "wait@x.io", status: "Waitlisted" },
  ];
  const orders = [
    { buyer_email: "ADA@x.io", status: "confirmed", total: 20, refunded_total: 0, cancelled_at: null },
    { buyer_email: "b@x.io", status: "confirmed", total: 20, refunded_total: 20, cancelled_at: null },
    { buyer_email: "c@x.io", status: "cancelled", total: 20, refunded_total: 0, cancelled_at: "2026-11-01T00:00:00Z" },
    { buyer_email: "free@x.io", status: "confirmed", total: 0, refunded_total: 0, cancelled_at: null },
  ];
  const attendance = [{ id: "a1", registration_id: "r1" }, { id: "a2", registration_id: "r1" }, { id: "a3", order_id: "o1" }];
  assert.deepEqual(doorCounts(registrations, orders, attendance), { admitted: 2, expected: 3 });
});
