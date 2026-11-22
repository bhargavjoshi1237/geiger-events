import test from "node:test";
import assert from "node:assert/strict";

import { bookingStats, bookingView, filterBookings, parseBookingPatch, parseBookingRequest, slotInstants, spaceFromRow } from "./bookings.js";
import { awardError, newRfpRow, parseBrief, parseRecipient, rfpStats, rfpSummaries, statusMove } from "./rfps.js";

test("RFP summaries count invited venues, live bids and the best non-rejected total", () => {
  const recipients = [
    { id: "a", rfpId: "r1", invitedAt: "t", status: "responded" },
    { id: "b", rfpId: "r1", invitedAt: "t", status: "viewed" },
    { id: "c", rfpId: "r1", invitedAt: null, status: "invited" },
    { id: "d", rfpId: "r1", invitedAt: "t", status: "responded" },
  ];
  const bids = [
    { recipientId: "a", total: 900, status: "submitted" },
    { recipientId: "d", total: 500, status: "rejected" },
  ];
  const s = rfpSummaries(recipients, bids);
  assert.deepEqual(s.r1, { invited: 3, responded: 2, waiting: 1, best: 900, bids: 2 });
  const stats = rfpStats([{ id: "r1", status: "sent", budgetMin: 800, budgetMax: 1000 }], recipients, bids, s);
  assert.equal(stats.open, 1);
  assert.equal(stats.waiting, 1);
  assert.equal(stats.received, 2);
});

test("a brief edit validates dates, numbers and the title", () => {
  assert.deepEqual(parseBrief({ title: " Summit ", attendees: "250", startDate: "2027-03-01", endDate: "2027-03-02", budgetMax: "" }), {
    title: "Summit", attendees: 250, startDate: "2027-03-01", endDate: "2027-03-02", budgetMax: null,
  });
  assert.throws(() => parseBrief({ title: "" }), (e) => e.status === 400);
  assert.throws(() => parseBrief({ startDate: "2027-03-02", endDate: "2027-03-01" }), (e) => e.status === 400);
  assert.throws(() => parseBrief({ attendees: 2.5 }), (e) => e.status === 400);
  assert.throws(() => parseBrief({ budgetMin: -1 }), (e) => e.status === 400);
  assert.throws(() => parseBrief({}), (e) => e.status === 400);
});

test("a new RFP starts as a draft with the dashboard's default deadline and the creator as contact", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  const row = newRfpRow({ title: "Venue for the summit" }, { projectId: "p", user: { id: "u", email: "ada@x.io", name: "Ada" }, now });
  assert.equal(row.status, "draft");
  assert.equal(row.project_id, "p");
  assert.equal(row.created_by, "u");
  assert.equal(row.contact_email, "ada@x.io");
  assert.ok(Date.parse(row.response_deadline) > now + 13 * 86400000);
  assert.equal(row.decision_date.length, 10);
});

test("only the dashboard's status moves are allowed", () => {
  assert.equal(statusMove("sent", "closed"), "closed");
  assert.equal(statusMove("closed", "sent"), "sent");
  assert.equal(statusMove("draft", "cancelled"), "cancelled");
  assert.throws(() => statusMove("draft", "closed"), (e) => e.status === 409);
  assert.throws(() => statusMove("awarded", "cancelled"), (e) => e.status === 409);
  assert.throws(() => statusMove("sent", "awarded"), (e) => e.status === 400);
});

test("a hand-added venue needs a name and a valid email when one is given", () => {
  assert.deepEqual(parseRecipient({ name: " Hall ", email: "BOOK@hall.io" }), { source: "manual", name: "Hall", contactName: "", email: "book@hall.io" });
  assert.throws(() => parseRecipient({ name: "" }), (e) => e.status === 400);
  assert.throws(() => parseRecipient({ name: "Hall", email: "nope" }), (e) => e.status === 400);
  assert.equal(awardError("ERROR: BID_SUPERSEDED"), "The venue has revised this bid — reload and award the latest version.");
});

const booking = (extra = {}) => ({
  id: "b1",
  reference: "VB-1",
  title: "Board day",
  status: "confirmed",
  holdExpiresAt: null,
  startsAt: "2026-12-01T09:00:00Z",
  endsAt: "2026-12-01T17:00:00Z",
  timezone: "Europe/London",
  spaceId: "s1",
  venueId: "v1",
  eventId: null,
  setupStyle: "boardroom",
  attendees: 12,
  total: 520,
  currency: "GBP",
  priceBreakdown: { lines: [{ date: "2026-12-01", amount: 520, items: [] }], hours: 8 },
  contactName: "Ada",
  contactEmail: "ada@x.io",
  contactPhone: "",
  notes: "",
  cancelReason: "",
  metadata: {},
  ...extra,
});

test("booking views carry the dashboard status and a calendar link", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  const view = bookingView(booking(), { spaceName: "Hall A", venueName: "The Venue" }, now);
  assert.equal(view.displayStatus, "Confirmed");
  assert.equal(view.setupStyle, "Boardroom");
  assert.match(view.calendarUrl, /^https:\/\/calendar\.google\.com/);
  assert.equal(bookingView(booking({ status: "cancelled" }), {}, now).calendarUrl, "");
  const hold = bookingView(booking({ status: "hold", holdExpiresAt: "2026-11-21T00:00:00Z" }), {}, now);
  assert.equal(hold.displayStatus, "Hold expired");
});

test("upcoming hides cancelled and finished bookings and sorts soonest first", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  const rows = [
    bookingView(booking({ id: "late", startsAt: "2026-12-05T09:00:00Z", endsAt: "2026-12-05T10:00:00Z" }), {}, now),
    bookingView(booking({ id: "soon" }), {}, now),
    bookingView(booking({ id: "gone", status: "cancelled" }), {}, now),
    bookingView(booking({ id: "past", startsAt: "2026-11-01T09:00:00Z", endsAt: "2026-11-01T10:00:00Z" }), {}, now),
  ];
  assert.deepEqual(filterBookings(rows, "upcoming", "", now).map((b) => b.id), ["soon", "late"]);
  assert.deepEqual(filterBookings(rows, "Completed", "", now).map((b) => b.id), ["past"]);
  assert.deepEqual(filterBookings(rows, "all", "board", now).length, 4);
  const stats = bookingStats([booking(), booking({ id: "h", status: "hold", holdExpiresAt: "2026-11-22T20:00:00Z" })], now);
  assert.equal(stats.upcoming, 1);
  assert.equal(stats.holds, 1);
  assert.equal(stats.holdsExpiringSoon, 1);
});

test("booking requests are checked before the RPC sees them", () => {
  const ok = parseBookingRequest({ spaceId: "s", date: "2026-12-01", startTime: "09:00", endTime: "17:00", status: "hold", holdHours: 72, attendees: "10" });
  assert.equal(ok.endDate, "2026-12-01");
  assert.equal(ok.status, "hold");
  assert.equal(ok.holdHours, 72);
  assert.equal(parseBookingRequest({ ...ok, holdHours: 5 }).holdHours, 48);
  assert.throws(() => parseBookingRequest({ ...ok, startTime: "9am" }), (e) => e.status === 400);
  assert.throws(() => parseBookingRequest({ ...ok, endDate: "2026-11-30" }), (e) => e.status === 400);
  assert.throws(() => parseBookingRequest({ ...ok, setupStyle: "rave" }), (e) => e.status === 400);
  assert.throws(() => parseBookingRequest({ ...ok, contactEmail: "nope" }), (e) => e.status === 400);
  const { startsAt } = slotInstants(ok, "Europe/London");
  assert.equal(startsAt.toISOString(), "2026-12-01T09:00:00.000Z");
  assert.deepEqual(parseBookingPatch({ notes: " bring keys " }), { notes: "bring keys" });
  assert.throws(() => parseBookingPatch({}), (e) => e.status === 400);
  assert.equal(spaceFromRow({ id: "s", rate_currency: null, opening_hours: [] }).currency, "GBP");
});
