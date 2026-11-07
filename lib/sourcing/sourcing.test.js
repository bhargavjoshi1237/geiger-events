import test from "node:test";
import assert from "node:assert/strict";

import { applyPreset, BUILT_IN_PRESETS, draftFromEvent, presetFromRfp } from "./drafting.js";
import { renderRfpEmail, rfpEmailContext } from "./email.js";
import {
  bidPayloadFromDraft,
  bidTotals,
  deadlineInfo,
  suggestedLineItems,
  validateBidDraft,
  validateRfpForSend,
} from "./rfp_model.js";
import { normalizeRfp, rfpToRow } from "./rows.js";
import { capacityScore, categoryTotals, compareBids, termsScore } from "./scoring.js";
import { buildCandidates, pipelineRecipients, rankCandidates, recipientHistory, venueDraftFromRecipient } from "./suggest.js";

const NOW = Date.parse("2026-11-08T12:00:00Z");

const rfp = {
  attendees: 300,
  budgetMax: 50000,
  currency: "USD",
  decisionDate: "2027-01-15",
  scoringWeights: { price: 40, capacity: 25, concessions: 15, terms: 20 },
};

const bid = (id, total, extra = {}) => ({
  recipient: { id: `r${id}`, name: `Venue ${id}`, status: "responded", details: {} },
  bid: {
    id: `b${id}`,
    revision: 1,
    status: "submitted",
    total,
    subtotal: total,
    taxesFees: 0,
    lineItems: [{ category: "room", qty: 1, unitPrice: total, total }],
    concessions: [],
    ...extra,
  },
});

test("bid totals round to the cent and ignore negative fees", () => {
  assert.deepEqual(bidTotals([{ qty: 3, unitPrice: 33.335 }, { qty: 2, unitPrice: 10 }], -5), {
    subtotal: 120.01,
    taxesFees: 0,
    total: 120.01,
  });
});

test("category totals bucket line items, unknown categories land in other", () => {
  const t = categoryTotals([
    { category: "room", total: 100 },
    { category: "fnb", total: 50 },
    { category: "weird", total: 7 },
  ]);
  assert.equal(t.room, 100);
  assert.equal(t.fnb, 50);
  assert.equal(t.other, 7);
});

test("capacity fit punishes undersized rooms harder than oversized ones", () => {
  assert.equal(capacityScore(300, 300).score, 100);
  assert.equal(capacityScore(450, 300).score, 100);
  assert.ok(capacityScore(150, 300).score < capacityScore(900, 300).score);
  assert.equal(capacityScore(null, 300).known, false);
});

test("terms reward low deposits and generous attrition, and flag offers that lapse", () => {
  const good = termsScore({ depositPct: 10, attritionPct: 25 }, rfp);
  const bad = termsScore({ depositPct: 50, attritionPct: 0, validUntil: "2027-01-01" }, rfp);
  assert.ok(good.score > bad.score);
  assert.equal(bad.lapses, true);
});

test("compareBids ranks by weighted score and explains the recommendation", () => {
  const cmp = compareBids(rfp, [
    bid(1, 40000, { capacity: 320, concessions: ["Wi-Fi", "Parking"], depositPct: 20, attritionPct: 20 }),
    bid(2, 36000, { capacity: 150, depositPct: 50 }),
    bid(3, 60000, { capacity: 400, status: "rejected" }),
  ]);
  assert.equal(cmp.lowest, 36000);
  assert.equal(cmp.rows[0].recipientId, "r1");
  assert.equal(cmp.rows[0].rank, 1);
  assert.equal(cmp.rows.find((r) => r.recipientId === "r3").weighted, null);
  assert.equal(cmp.recommendation.recipientId, "r1");
  assert.ok(cmp.recommendation.reasons.some((r) => r.includes("more than Venue 2")));
  const r2 = cmp.rows.find((r) => r.recipientId === "r2");
  assert.equal(r2.vsBudget, -14000);
  assert.equal(r2.perAttendee, 120);
});

test("declined recipients drop out of the comparison", () => {
  const e = bid(1, 1000);
  e.recipient.status = "declined";
  assert.equal(compareBids(rfp, [e, bid(2, 2000)]).rows.length, 1);
});

test("send validation lists what is missing", () => {
  const issues = validateRfpForSend({ title: "", attendees: 0 }, NOW);
  assert.ok(issues.length >= 4);
  assert.deepEqual(
    validateRfpForSend(
      {
        title: "Summit",
        startDate: "2027-03-10",
        endDate: "2027-03-11",
        attendees: 300,
        roomRequirements: [{ label: "Main", setup_style: "theatre", capacity: 300, days: 2 }],
        responseDeadline: "2026-12-01T17:00:00Z",
      },
      NOW,
    ),
    [],
  );
});

test("bid drafts need a priced line and sane percentages", () => {
  assert.ok(validateBidDraft({ lineItems: [{ label: "Room", qty: "1", unitPrice: "" }] }));
  assert.ok(validateBidDraft({ lineItems: [{ label: "Room", qty: "1", unitPrice: "100" }], depositPct: "150" }));
  assert.equal(validateBidDraft({ lineItems: [{ label: "Room", qty: "2", unitPrice: "100" }] }), null);
  const payload = bidPayloadFromDraft({ lineItems: [{ category: "room", label: " Hall ", qty: "2", unitPrice: "100" }], concessions: ["", "Wi-Fi"] });
  assert.deepEqual(payload.lineItems[0], { category: "room", label: "Hall", qty: 2, unitPrice: 100 });
  assert.deepEqual(payload.concessions, ["Wi-Fi"]);
});

test("suggested line items follow the brief", () => {
  const items = suggestedLineItems({
    startDate: "2027-03-10",
    endDate: "2027-03-11",
    roomRequirements: [{ label: "Main", setup_style: "theatre", capacity: 300, days: 2 }],
    sleepingRooms: { nights: [{ date: "2027-03-09", rooms: 100 }, { date: "2027-03-10", rooms: 100 }] },
    avNeeds: "Projector",
  });
  assert.deepEqual(items.map((i) => i.category), ["room", "sleeping", "av"]);
  assert.equal(items[1].qty, 200);
});

test("deadline countdown tones escalate as it nears", () => {
  assert.equal(deadlineInfo("2026-11-20T12:00:00Z", NOW).tone, "info");
  assert.equal(deadlineInfo("2026-11-09T12:00:00Z", NOW).tone, "warning");
  assert.equal(deadlineInfo("2026-11-08T18:00:00Z", NOW).tone, "danger");
  assert.equal(deadlineInfo("2026-11-01T12:00:00Z", NOW).past, true);
});

test("presets scale to the RFP's headcount and date the room block from day one", () => {
  const conf = BUILT_IN_PRESETS.find((p) => p.id === "builtin:conference-300");
  const patch = applyPreset({ attendees: 600, startDate: "2027-03-10" }, conf);
  assert.equal(patch.roomRequirements[0].capacity, 600);
  assert.equal(patch.endDate, "2027-03-11");
  assert.deepEqual(patch.sleepingRooms.nights.map((n) => n.date), ["2027-03-09", "2027-03-10"]);
  assert.equal(patch.sleepingRooms.nights[0].rooms, 240);
  const round = presetFromRfp({ attendees: 600, startDate: "2027-03-10", endDate: "2027-03-11", ...patch });
  assert.equal(round.days, 2);
  assert.deepEqual(round.roomsPerNight, [240, 240]);
});

test("drafting from an event takes its date, capacity and city", () => {
  const d = draftFromEvent({ id: "e1", name: "Summit", date: "2027-03-10", capacity: 250, sold: 300, city: "Berlin" }, { now: NOW });
  assert.equal(d.attendees, 300);
  assert.equal(d.location, "Berlin");
  assert.equal(d.startDate, "2027-03-10");
  assert.ok(Date.parse(d.responseDeadline) > NOW);
});

test("suggestions rank by fit and skip anyone already invited", () => {
  const candidates = buildCandidates({
    venues: [
      { id: "v1", name: "Big Hall", city: "Berlin", seatedCapacity: 400, contactEmail: "a@hall.de", status: "Active" },
      { id: "v2", name: "Tiny Room", city: "Paris", seatedCapacity: 40, contactEmail: "b@room.fr", status: "Active" },
    ],
    venueLeads: [
      { id: "l1", name: "Linked", status: "Shortlisted", config: { venueId: "v1", city: "Berlin" } },
      { id: "l2", name: "Lead Hall", status: "Shortlisted", config: { city: "Berlin", capacity: 350 } },
    ],
    stays: [{ id: "h1", name: "Hotel", status: "Available", config: { kind: "Transport" } }],
  });
  assert.deepEqual(candidates.map((c) => c.key), ["venue:v1", "venue:v2", "lead:l2"]);
  const history = recipientHistory(
    [{ rfpId: "old", venueId: "v1", invitedAt: "2026-01-01", status: "awarded", respondedAt: "2026-01-02" }],
    "new",
  );
  const ranked = rankCandidates({ rfp: { attendees: 300, location: "Berlin" }, candidates, recipients: [{ pipelineRecordId: "l2" }], history });
  assert.deepEqual(ranked.map((c) => c.key), ["venue:v1", "venue:v2"]);
  assert.ok(ranked[0].reasons.some((r) => r.includes("won 1 before")));
  assert.equal(ranked[1].contactable, true);
});

test("converted leads ride on their venue so an award still books the lead", () => {
  const venues = [{ id: "v1", name: "Big Hall", city: "Berlin", contactEmail: "a@hall.de", status: "Active" }];
  const leads = [
    { id: "l1", name: "Linked", status: "Shortlisted", config: { venueId: "v1", city: "Berlin" } },
    { id: "l2", name: "Lead Hall", status: "Shortlisted", config: { city: "Berlin", contactEmail: "x@lead.de" } },
    { id: "l3", name: "Same Email", status: "Shortlisted", config: { contactEmail: "X@lead.de" } },
  ];
  assert.equal(buildCandidates({ venues, venueLeads: leads })[0].pipelineRecordId, "l1");
  const list = pipelineRecipients(leads, venues);
  assert.deepEqual(list.map((r) => [r.source, r.venueId, r.pipelineRecordId]), [["venue", "v1", "l1"], ["pipeline", null, "l2"]]);
  assert.equal(list[0].email, "a@hall.de");
});

test("award venue draft carries the recipient snapshot", () => {
  const v = venueDraftFromRecipient(
    { name: "Lead Hall", email: "x@y.com", contactName: "Sam", details: { city: "Berlin", capacity: 300, latitude: "52.5" } },
    { capacity: 350 },
  );
  assert.equal(v.seatedCapacity, 350);
  assert.equal(v.latitude, 52.5);
  assert.equal(v.contactEmail, "x@y.com");
});

test("rows round-trip the brief's jsonb shapes", () => {
  const row = rfpToRow({
    title: "  ",
    roomRequirements: [{ id: "a", label: "Main", setupStyle: "banquet", capacity: "200", days: "2" }],
    currency: "XYZ",
  });
  assert.equal(row.title, "Untitled RFP");
  assert.equal(row.currency, "USD");
  assert.deepEqual(row.room_requirements, [{ id: "a", label: "Main", setup_style: "banquet", capacity: 200, days: 2 }]);
  const back = normalizeRfp({ id: "x", room_requirements: row.room_requirements, status: "bogus" });
  assert.equal(back.roomRequirements[0].setupStyle, "banquet");
  assert.equal(back.status, "draft");
});

test("emails escape what venues and organisers typed", () => {
  const ctx = rfpEmailContext({
    rfp: { title: "<b>Summit</b>", attendees: 300, startDate: "2027-03-10", responseDeadline: "2026-12-01T17:00:00Z" },
    recipient: { name: "Hall & Co" },
    organizerName: "Acme",
    url: "https://x.test/events/rfp/abc",
  });
  const { subject, html } = renderRfpEmail("invitation", ctx);
  assert.ok(subject.includes("<b>Summit</b>"));
  assert.ok(html.includes("&lt;b&gt;Summit&lt;/b&gt;"));
  assert.ok(html.includes("Hall &amp; Co"));
  assert.ok(html.includes("https://x.test/events/rfp/abc"));
  assert.ok(!renderRfpEmail("regret", ctx).html.includes("https://x.test"));
});
