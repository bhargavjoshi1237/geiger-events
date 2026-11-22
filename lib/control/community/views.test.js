import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPeople,
  chatMessageView,
  meetingView,
  organiserName,
  parseChannelPatch,
  parseChatBody,
  parseMeetingPatch,
  parsePostStatus,
  parseQaThread,
  parseReply,
  parseReportResolve,
  parseTopicPatch,
  requestView,
  summarizeChannels,
} from "./views.js";

const ID = "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c";
const ID2 = "9b1f2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

test("chat messages take the attendee app's bubble shape, and a deleted one shows no text", () => {
  const msg = chatMessageView({ id: "m", channel_id: "c", author_user_id: "u1", sender_kind: "organiser", author_name: "Ada", body: "Hi", metadata: null, created_at: "t" });
  assert.equal(msg.authorKey, "u:u1");
  assert.equal(msg.text, "Hi");
  assert.deepEqual(msg.reactions, {});
  const gone = chatMessageView({ id: "m", channel_id: "c", author_member_id: "m1", body: "secret", deleted_at: "t" });
  assert.equal(gone.authorKey, "m:m1");
  assert.equal(gone.deleted, true);
  assert.equal(gone.text, "");
});

test("channel summaries count messages and attendees and sort by latest activity", () => {
  const out = summarizeChannels(
    [
      { id: "a", event_id: "e1", kind: "event", name: "A", created_at: "2026-11-01T00:00:00Z" },
      { id: "b", event_id: null, kind: "qa", name: "B", posting_mode: "open", created_at: "2026-11-02T00:00:00Z" },
    ],
    [
      { channel_id: "a", body: "newest", created_at: "2026-11-05T00:00:00Z" },
      { channel_id: "a", body: "older", created_at: "2026-11-04T00:00:00Z" },
    ],
    [{ channel_id: "a", member_id: "m1" }, { channel_id: "a", member_id: null }, { channel_id: "b", member_id: "m2" }],
    new Map([["e1", "Finals"]]),
  );
  assert.deepEqual(out.map((c) => c.id), ["a", "b"]);
  assert.equal(out[0].lastPreview, "newest");
  assert.equal(out[0].messageCount, 2);
  assert.equal(out[0].participantCount, 1);
  assert.equal(out[0].eventName, "Finals");
  assert.equal(out[1].postingMode, "open");
});

test("chat writes are validated", () => {
  assert.equal(parseChatBody({ body: "  hello " }), "hello");
  assert.throws(() => parseChatBody({ body: "  " }), (e) => e.status === 400);
  assert.deepEqual(parseChannelPatch({ postingMode: "open", status: "archived" }), { posting_mode: "open", status: "archived" });
  assert.throws(() => parseChannelPatch({ status: "locked" }), (e) => e.status === 400);
  assert.throws(() => parseChannelPatch({}), (e) => e.status === 400);
  assert.deepEqual(parseQaThread({ eventId: ID, name: " Ask the panel " }), { eventId: ID, name: "Ask the panel", topic: "", postingMode: "open" });
  assert.throws(() => parseQaThread({ eventId: "x", name: "A" }), (e) => e.status === 400);
  assert.throws(() => parseQaThread({ eventId: ID, name: "" }), (e) => e.status === 400);
});

test("topic and reply moderation accepts only the dashboard's actions", () => {
  assert.deepEqual(parseTopicPatch({ pinned: true, status: "hidden", acceptedPostId: ID }), { pinned: true, status: "hidden", accepted_post_id: ID });
  assert.deepEqual(parseTopicPatch({ acceptedPostId: null }), { accepted_post_id: null });
  assert.throws(() => parseTopicPatch({ status: "pending" }), (e) => e.status === 400);
  assert.throws(() => parseTopicPatch({ locked: "yes" }), (e) => e.status === 400);
  assert.equal(parsePostStatus({ status: "published" }), "published");
  assert.throws(() => parsePostStatus({ status: "deleted" }), (e) => e.status === 400);
  assert.deepEqual(parseReply({ body: " Thanks ", parentPostId: "nope" }), { body: "Thanks", parentPostId: null });
  assert.deepEqual(parseReportResolve({ ids: [ID, "bad"], status: "dismissed" }), { ids: [ID], status: "dismissed" });
  assert.throws(() => parseReportResolve({ ids: [ID], status: "deleted" }), (e) => e.status === 400);
});

test("meeting people are named from tickets, then profiles, else as a former attendee", () => {
  const people = buildPeople(
    [{ member_id: ID, name: "", email: "ada@x.io" }],
    [{ member_id: ID2, display_name: "Grace H", email: "g@x.io" }],
  );
  const m = meetingView({ id: "x", participants: [ID, ID2, "gone"], status: "weird" }, people);
  assert.deepEqual(m.people, ["ada", "Grace H", "Former attendee"]);
  assert.equal(m.status, "scheduled");
  const r = requestView({ id: "r", from_member: ID2, to_member: ID, proposed_slots: [1, 2] }, people);
  assert.deepEqual([r.from, r.to, r.proposedSlots, r.status], ["Grace H", "ada", 2, "pending"]);
});

test("cancelling a meeting records the organiser and the reason", () => {
  assert.deepEqual(parseMeetingPatch({ status: "cancelled", cancelReason: " Speaker ill " }), {
    status: "cancelled",
    cancelled_by: "organiser",
    cancel_reason: "Speaker ill",
  });
  assert.deepEqual(parseMeetingPatch({ status: "completed" }), { status: "completed" });
  assert.throws(() => parseMeetingPatch({ status: "postponed" }), (e) => e.status === 400);
  assert.throws(() => parseMeetingPatch({}), (e) => e.status === 400);
});

test("organiser posts are signed with the account name, else the email's local part", () => {
  assert.equal(organiserName({ user_metadata: { full_name: "Ada Lovelace" }, email: "ada@x.io" }), "Ada Lovelace");
  assert.equal(organiserName({ email: "grace@x.io" }), "grace");
  assert.equal(organiserName({}), "Organiser");
});
