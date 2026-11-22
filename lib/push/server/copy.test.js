import test from "node:test";
import assert from "node:assert/strict";

import { clip, renderRow } from "./copy.js";

const event = { id: "e1", name: "Winter Finals", event_date: "2026-11-28", event_time: "19:00", timezone: "Europe/London", venue: "Hall", city: "London", address: "1 Road" };
const order = { id: "o1", event_id: "e1", ticket_name: "General Admission", quantity: 2, metadata: {} };
const row = (type, ref = {}, extra = {}) => ({ id: "n1", type, ref, member_id: "m1", event_id: "e1", ...extra });

test("order_confirmed names the event, tickets, time and opens the ticket", () => {
  const out = renderRow(row("order_confirmed", { orderId: "o1" }), { order, event });
  assert.equal(out.title, "You're going to Winter Finals");
  assert.equal(out.body, "2 × General Admission · Sat, Nov 28 · 7:00 PM · Hall, London. Your pass is in the app.");
  assert.equal(out.route, "/tickets/o1");
  assert.deepEqual(out.data, { orderId: "o1", eventId: "e1", type: "order_confirmed", notificationId: "n1", route: "/tickets/o1" });
});

test("group organiser confirmation goes home with the group size", () => {
  const out = renderRow(row("order_confirmed", { orderId: "o1", organizer: true, groupSize: 4 }), { order, event });
  assert.equal(out.title, "Your group booking is confirmed");
  assert.match(out.body, /^4 tickets for Winter Finals/);
  assert.equal(out.route, "/home");
});

test("ticket_gifted credits the organiser", () => {
  const out = renderRow(row("ticket_gifted", { orderId: "o1" }), { order, event, organizerName: "Priya" });
  assert.equal(out.title, "Priya got you a ticket");
});

test("event_starting: 1 hour opens the pass, a day ahead opens the ticket", () => {
  const hour = renderRow(row("event_starting", { offset: 60, orderId: "o1" }), { event });
  assert.equal(hour.title, "Winter Finals starts in 1 hour");
  assert.equal(hour.route, "/pass/o1");
  assert.equal(hour.body, "Sat, Nov 28 · 7:00 PM · Hall, London. Tap for your pass.");
  const day = renderRow(row("event_starting", { offset: 1440, orderId: "o1" }), { event });
  assert.equal(day.title, "Tomorrow: Winter Finals");
  assert.equal(day.route, "/tickets/o1");
  const regOnly = renderRow(row("event_starting", { offset: 2880 }), { event });
  assert.equal(regOnly.title, "Winter Finals is in 2 days");
  assert.equal(regOnly.route, "/home");
});

test("registration_update covers each status and defers to an order", () => {
  const registration = { id: "r1", event_id: "e1", status: "Confirmed" };
  assert.equal(renderRow(row("registration_update", { status: "Confirmed", previous: "Waitlisted" }), { registration, event }).title, "A spot opened up");
  assert.equal(renderRow(row("registration_update", { status: "Confirmed", previous: "Pending" }), { registration, event }).title, "You're approved for Winter Finals");
  assert.equal(renderRow(row("registration_update", { status: "Waitlisted", position: 4 }), { registration, event }).body, "Winter Finals is full. You're #4 on the waitlist. We'll tell you the moment a spot opens.");
  assert.deepEqual(renderRow(row("registration_update", { status: "Confirmed" }), { registration, event, coveredByOrder: true }), { skip: "covered" });
});

test("event_changed says what moved", () => {
  assert.equal(renderRow(row("event_changed", { changed: ["time"] }), { event }).body, "Now Sat, Nov 28 · 7:00 PM.");
  assert.equal(renderRow(row("event_changed", { changed: ["venue"] }), { event }).title, "Venue change: Winter Finals");
  assert.equal(renderRow(row("event_changed", { changed: ["time", "venue"] }), { event }).title, "Winter Finals has moved");
  assert.deepEqual(renderRow(row("event_changed", { changed: ["time"] }), { event: { ...event, deleted_at: "x" } }), { skip: "render" });
});

test("refund_update formats money only when the currency is known", () => {
  assert.equal(renderRow(row("refund_update", { status: "Issued", amount: 25, orderId: "o1" }), { order, event, currency: "gbp" }).body,
    "£25.00 is on its way for Winter Finals. It can take 5–10 business days to appear.");
  assert.match(renderRow(row("refund_update", { status: "Approved", amount: 25 }), { order, event }).body, /^Your refund for Winter Finals/);
});

test("community copy routes Q&A and chat differently and strips markup", () => {
  const channel = { id: "c1", name: "General", kind: "event" };
  const chatMessage = { author_name: "Sam", body: "<b>Doors</b> moved   to 7" };
  const reply = renderRow(row("chat_reply", { channelId: "c1", messageId: "x" }), { chatMessage, channel });
  assert.equal(reply.title, "Sam replied to you");
  assert.equal(reply.body, "General · Doors moved to 7");
  assert.equal(reply.route, "/community/c1");
  const qa = renderRow(row("qa_answer", {}), { chatMessage, channel: { ...channel, kind: "qa" } });
  assert.equal(qa.route, "/qa/c1");
});

test("prerendered copy passes through with type and id added", () => {
  const out = renderRow(row("meeting_request", { copy: { title: "New meeting request", body: "Sam wants to meet", route: "/notifications", data: { requestId: "q" } } }), {});
  assert.equal(out.title, "New meeting request");
  assert.deepEqual(out.data, { requestId: "q", type: "meeting_request", notificationId: "n1", route: "/notifications" });
});

test("missing source records skip instead of sending half a message", () => {
  assert.deepEqual(renderRow(row("order_confirmed", { orderId: "gone" }), {}), { skip: "render" });
  assert.deepEqual(renderRow(row("unknown_type"), {}), { skip: "render" });
});

test("clip trims long bodies with an ellipsis", () => {
  const out = clip("x".repeat(300));
  assert.equal(out.length, 178);
  assert.ok(out.endsWith("…"));
});
