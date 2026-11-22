import test from "node:test";
import assert from "node:assert/strict";

import {
  attendeeCsv,
  contactView,
  csvCell,
  dataRequestView,
  dietaryReport,
  exportFilename,
  notesFeed,
  parseContact,
  parseDataRequestStatus,
  parseFormStatus,
  parsePromoteCount,
  parseTagRename,
  segmentView,
  sortWaitlist,
  tagList,
  withNote,
  withoutNote,
} from "./views.js";

test("contacts parse like the dashboard drawer: trimmed, lower-cased email, de-duplicated tags", () => {
  assert.deepEqual(parseContact({ name: " Ada ", email: " Ada@X.io ", tags: ["VIP", "vip", " Press "] }, { create: true }), {
    name: "Ada",
    email: "ada@x.io",
    tags: ["VIP", "Press"],
  });
  assert.deepEqual(parseContact({ company: "Acme" }), { company: "Acme" });
  assert.throws(() => parseContact({ email: "ada" }), (e) => e.status === 400);
  assert.throws(() => parseContact({}, { create: true }), (e) => Boolean(e.fields?.name));
  assert.throws(() => parseContact({}), (e) => e.status === 400);
});

test("a contact's view carries its notes but not the rest of its metadata", () => {
  const view = contactView({ id: "c1", name: "Ada", tags: ["VIP"], metadata: { notes: [{ id: "n1", body: "Met at the bar", createdAt: "t" }], secret: 1 } });
  assert.deepEqual(view.notes, [{ id: "n1", body: "Met at the bar", createdAt: "t" }]);
  assert.equal("metadata" in view, false);
});

test("notes are added newest first and removed by id, keeping other metadata", () => {
  const meta = { notes: [{ id: "a", body: "old" }], other: true };
  const added = withNote(meta, { id: "b", body: "new" });
  assert.deepEqual(added.notes.map((n) => n.id), ["b", "a"]);
  assert.equal(added.other, true);
  assert.deepEqual(withoutNote(added, "a").notes.map((n) => n.id), ["b"]);
});

test("the notes feed flattens every contact's notes, newest first", () => {
  const feed = notesFeed([
    { id: "c1", name: "Ada", email: "a@x.io", metadata: { notes: [{ id: "1", body: "x", createdAt: "2026-01-01" }] } },
    { id: "c2", name: "Bo", email: "b@x.io", metadata: { notes: [{ id: "2", body: "y", createdAt: "2026-02-01" }] } },
  ]);
  assert.deepEqual(feed.map((n) => [n.id, n.contactName]), [["2", "Bo"], ["1", "Ada"]]);
});

test("tags merge the catalog with usage on contacts, most used first", () => {
  const list = tagList([{ id: "t1", name: "VIP", color: "violet" }], [{ tags: ["VIP", "Press"] }, { tags: ["VIP"] }]);
  assert.deepEqual(list.map((t) => [t.name, t.count, t.id]), [["VIP", 2, "t1"], ["Press", 1, null]]);
  assert.throws(() => parseTagRename({ from: "VIP", to: "VIP" }), (e) => e.status === 400);
});

test("segments read as plain-language rules with their member count", () => {
  const view = segmentView({ id: "s", name: "VIPs", rules: [{ field: "tag", op: "is", value: "VIP" }, { field: "company", value: "Acme" }], metadata: { manualIds: ["x"] } }, 12);
  assert.deepEqual(view.rules, ["Tag is VIP", "Company contains Acme"]);
  assert.equal(view.handPicked, 1);
  assert.equal(view.members, 12);
});

test("closing a data request stamps it resolved; reopening clears it", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  assert.deepEqual(parseDataRequestStatus({ status: "Completed" }, now), { status: "Completed", resolved_at: "2026-11-22T10:00:00.000Z" });
  assert.deepEqual(parseDataRequestStatus({ status: "In Progress" }, now), { status: "In Progress", resolved_at: null });
  assert.throws(() => parseDataRequestStatus({ status: "Done" }), (e) => e.status === 400);
  assert.equal(dataRequestView({ id: "r", status: "New", due_at: "2026-11-01T00:00:00Z" }, now).overdue, true);
  assert.equal(dataRequestView({ id: "r", status: "Completed", due_at: "2026-11-01T00:00:00Z" }, now).overdue, false);
  assert.throws(() => parseFormStatus({ status: "Live" }), (e) => e.status === 400);
});

test("the waitlist runs in position order, then join order; promote counts are bounded", () => {
  const out = sortWaitlist([
    { id: "c", waitlist_position: null, created_at: "1" },
    { id: "b", waitlist_position: 2, created_at: "3" },
    { id: "a", waitlist_position: 1, created_at: "9" },
  ]);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c"]);
  assert.equal(parsePromoteCount({}), 1);
  assert.throws(() => parsePromoteCount({ count: 0 }), (e) => e.status === 400);
});

test("the dietary report counts live registrations only, by tag and by inquiry answer", () => {
  const report = dietaryReport(
    [
      { id: "1", name: "Ada", status: "Confirmed", dietary: "Vegan, nut allergy", party_size: 2, answers: { "dietary:q1": "Wheelchair" } },
      { id: "2", name: "Bo", status: "Confirmed", accessibility: "Step-free access", answers: { "dietary:q1": ["Wheelchair"] } },
      { id: "3", name: "Cy", status: "Cancelled", dietary: "Vegan" },
    ],
    [{ id: "q1", label: "Access needs", options: [{ label: "Wheelchair" }, { label: "Hearing loop" }] }],
  );
  assert.deepEqual(report.totals, { withNeeds: 2, heads: 3, dietary: 1, accessibility: 1 });
  assert.deepEqual(report.tags, [{ tag: "Vegan", count: 1 }, { tag: "Nut allergy", count: 1 }]);
  assert.deepEqual(report.questions[0].counts, [{ label: "Wheelchair", count: 2 }, { label: "Hearing loop", count: 0 }]);
  assert.deepEqual(report.guests.map((g) => g.name), ["Ada", "Bo"]);
});

test("the attendee CSV quotes cells and defuses formulas", () => {
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  const csv = attendeeCsv([{ name: "Ada", email: "a@x.io", tags: ["VIP", "Press"], created_at: "2026-11-01T10:00:00Z" }]);
  assert.equal(csv.split("\r\n")[1], '"Ada","a@x.io","","","1","","","","VIP; Press","2026-11-01"');
  assert.equal(exportFilename("Finals: Night 1!", new Date("2026-11-22T00:00:00Z")), "finals-night-1-attendees-2026-11-22.csv");
});
