import test from "node:test";
import assert from "node:assert/strict";

import { projectSummary } from "./summary.js";
import {
  campaignTransition,
  campaignView,
  deliverabilityView,
  eventFromTemplate,
  parseVenuePatch,
  parseWorkflowStatus,
  spaceView,
  templateView,
  workflowView,
} from "./views.js";

test("a template's blueprint becomes a draft event, without the dashboard's placeholder date", () => {
  const template = { id: "t", name: "Meetup", uses: 2, metadata: { blueprint: { type: "Online", capacity: 80, summary: "Hi" } } };
  assert.equal(templateView(template).blueprint.visibility, "Public");
  assert.deepEqual(eventFromTemplate(template, { projectId: "p", userId: "u" }), {
    name: "Meetup", status: "Draft", type: "Online", timezone: "Europe/London", capacity: 80, visibility: "Public", summary: "Hi", project_id: "p", created_by: "u",
  });
});

test("venue edits map to columns and refuse bad values", () => {
  assert.deepEqual(parseVenuePatch({ name: " Hall ", seatedCapacity: "200", contactEmail: "A@B.io", type: "Outdoor" }), {
    name: "Hall", seated_capacity: 200, contact_email: "a@b.io", type: "Outdoor",
  });
  assert.throws(() => parseVenuePatch({ name: "" }), (e) => Boolean(e.fields?.name));
  assert.throws(() => parseVenuePatch({ type: "Cave" }), (e) => Boolean(e.fields?.type));
  assert.throws(() => parseVenuePatch({ timezone: "Mars/Base" }), (e) => Boolean(e.fields?.timezone));
  assert.throws(() => parseVenuePatch({ website: "javascript:x" }), (e) => Boolean(e.fields?.website));
  assert.throws(() => parseVenuePatch({ standingCapacity: -1 }), (e) => Boolean(e.fields?.standingCapacity));
  assert.throws(() => parseVenuePatch({}), (e) => e.status === 400);
});

test("a space reports its largest layout capacity", () => {
  assert.equal(spaceView({ id: "s", capacities: { theatre: 120, banquet: "80", bad: "x" } }).maxCapacity, 120);
  assert.equal(spaceView({ id: "s" }).maxCapacity, 0);
});

test("workflows show their trigger by name and only toggle between Active and Paused", () => {
  const view = workflowView({ id: "w", trigger: "ticket.purchased", steps: [{}, {}] });
  assert.equal(view.triggerLabel, "Ticket purchased");
  assert.equal(view.steps, 2);
  assert.equal(parseWorkflowStatus({ status: "Paused" }), "Paused");
  assert.throws(() => parseWorkflowStatus({ status: "Draft" }), (e) => e.status === 400);
});

test("campaign transitions mirror the editor's buttons", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  assert.deepEqual(campaignTransition({ status: "draft" }, "schedule", { scheduledAt: "2026-12-01T09:00:00Z" }), {
    status: "scheduled", scheduled_at: "2026-12-01T09:00:00.000Z",
  });
  assert.throws(() => campaignTransition({ status: "draft" }, "schedule", {}), (e) => e.status === 400);
  const sent = campaignTransition({ status: "scheduled", metrics: { opened: 3 } }, "send", { recipients: 40, now });
  assert.equal(sent.status, "sent");
  assert.equal(sent.sent_at, now.toISOString());
  assert.deepEqual(sent.metrics, { recipients: 40, delivered: 40, opened: 3, clicked: 0, bounced: 0, unsubscribed: 0 });
  assert.throws(() => campaignTransition({ status: "sent" }, "send"), (e) => e.status === 409);
  assert.deepEqual(campaignTransition({ status: "scheduled" }, "unschedule"), { status: "draft", scheduled_at: null });
  assert.deepEqual(campaignTransition({ status: "sent" }, "draft"), { status: "draft" });
  assert.throws(() => campaignTransition({ status: "draft" }, "draft"), (e) => e.status === 409);
});

test("campaign and deliverability views read the content and settings bags safely", () => {
  const view = campaignView({ id: "c", content: { subject: "Hello", body: "Body" }, metrics: { recipients: "5" } });
  assert.equal(view.subject, "Hello");
  assert.equal(view.metrics.recipients, 5);
  assert.deepEqual(deliverabilityView(null).domainVerified, false);
  assert.equal(deliverabilityView({ deliverability: { fromEmail: "a@b.io", dkim: 1 } }).dkim, true);
});

test("the project summary totals sales, counts each guest inside once and ranks events", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const summary = projectSummary({
    now,
    days: 3,
    events: [{ id: "a", name: "A", capacity: 10 }, { id: "b", name: "B" }, { id: "c", name: "C" }],
    orders: [
      { event_id: "a", created_at: "2026-11-22T09:00:00Z", total: 50, refunded_total: 0, quantity: 2, cancelled_at: null },
      { event_id: "b", created_at: "2026-11-01T09:00:00Z", total: 80, refunded_total: 20, quantity: 1, cancelled_at: null },
      { event_id: "a", created_at: "2026-11-22T10:00:00Z", total: 30, refunded_total: 0, quantity: 1, cancelled_at: "x" },
    ],
    attendance: [
      { event_id: "a", registration_id: "r1" },
      { event_id: "a", registration_id: "r1" },
      { event_id: "b", order_id: "o1" },
    ],
  });
  assert.deepEqual(summary.topEvents.map((e) => [e.id, e.revenue, e.sold, e.checkedIn]), [["b", 60, 1, 1], ["a", 50, 2, 1]]);
  assert.equal(summary.totals.events, 3);
  assert.equal(summary.totals.checkedIn, 2);
  assert.equal(summary.totals.showRate, 67);
  assert.equal(summary.recent.orders, 1);
  assert.equal(summary.byDay.length, 3);
});
