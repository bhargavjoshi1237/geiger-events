import test from "node:test";
import assert from "node:assert/strict";

import { c, nameField, options, statusField, statuses } from "./catalog/builders.js";
import { fieldValue, parseRecordInput, publicModule, recordView } from "./records_engine.js";

const poll = {
  id: "community.poll",
  store: "community",
  module: "poll",
  statuses: statuses({ Draft: { variant: "neutral" }, Live: { variant: "success" } }),
  defaults: { status: "Draft", config: { options: [], votes: 0, audience: { eventId: "" } } },
  summary: ["votes"],
  panels: [
    {
      title: "Poll",
      fields: [
        nameField("Question"),
        statusField(),
        c("votes", "Votes", "number", { min: 0 }),
        c("channel", "Channel", "select", { options: options(["In-app", "Email"]) }),
        c("options", "Options", "list"),
        c("audience", "Audience", "audience"),
      ],
    },
  ],
  source: "x",
};

const tier = {
  id: "ticketing.tier",
  store: "ticketing",
  module: "tier",
  kinds: [{ value: "tier", label: "Tier", config: { rank: 1, color: "slate" } }],
  defaults: { active: true, config: {} },
  panels: [{ title: "Tier", fields: [nameField(), c("rank", "Rank", "number", { min: 1 })] }],
  source: "x",
};

test("creating starts from the module's defaults and validates what was sent", () => {
  const row = parseRecordInput(poll, { name: " Next topic? ", config: { channel: "Email", options: ["A", " ", "B"] } });
  assert.deepEqual(row, {
    name: "Next topic?",
    status: "Draft",
    module: "poll",
    config: { options: ["A", "B"], votes: 0, audience: { eventId: "" }, channel: "Email" },
  });
});

test("ticketing records take their kind's default config and start active", () => {
  const row = parseRecordInput(tier, { name: "VIP", config: { rank: 2 } });
  assert.deepEqual(row, { name: "VIP", kind: "tier", active: true, config: { rank: 2, color: "slate" }, module: "tier" });
});

test("an update merges config so keys the app doesn't know survive", () => {
  const current = { config: { votes: 3, results: { a: 1 }, audience: { eventId: "e" } } };
  const row = parseRecordInput(poll, { status: "Live", config: { votes: 4 } }, { current });
  assert.deepEqual(row, { status: "Live", config: { votes: 4, results: { a: 1 }, audience: { eventId: "e" } } });
});

test("bad values and read-only fields are refused by name", () => {
  const current = { config: {} };
  assert.throws(() => parseRecordInput(poll, { status: "Gone" }, { current }), (e) => e.status === 400);
  assert.throws(() => parseRecordInput(poll, { config: { votes: -1 } }, { current }), (e) => Boolean(e.fields?.votes));
  assert.throws(() => parseRecordInput(poll, { config: { channel: "Fax" } }, { current }), (e) => Boolean(e.fields?.channel));
  assert.throws(() => parseRecordInput(poll, { config: { audience: {} } }, { current }), (e) => Boolean(e.fields?.audience));
  assert.throws(() => parseRecordInput(poll, { name: "" }, { current }), (e) => e.status === 400);
  assert.throws(() => parseRecordInput(poll, {}, { current }), (e) => e.status === 400);
  assert.throws(() => parseRecordInput(poll, { config: {} }), (e) => Boolean(e.fields?.name));
});

test("field types normalise their values", () => {
  assert.equal(fieldValue({ key: "d", type: "datetime" }, "2026-11-22T10:00:00Z"), "2026-11-22T10:00:00.000Z");
  assert.equal(fieldValue({ key: "d", type: "datetime" }, ""), null);
  assert.equal(fieldValue({ key: "n", type: "number" }, "12.5"), 12.5);
  assert.equal(fieldValue({ key: "e", type: "email" }, " Ada@X.io "), "ada@x.io");
  assert.throws(() => fieldValue({ key: "u", type: "url" }, "javascript:alert(1)"));
  assert.throws(() => fieldValue({ key: "r", type: "ref" }, "not-an-id"));
  assert.throws(() => fieldValue({ key: "t", type: "time" }, "9am"));
});

test("the view keeps only the config keys the module shows", () => {
  const view = recordView(poll, {
    id: "r1", name: "Q", status: "Live", cover_url: null, starts_at: null, ends_at: null, created_at: "t",
    config: { votes: 2, secret: "x", options: ["A"] },
  });
  assert.deepEqual(view.config, { votes: 2, options: ["A"] });
  assert.equal(view.status, "Live");
  assert.deepEqual(recordView(tier, { id: "t1", name: "VIP", kind: "tier", active: false, config: { rank: 2 } }).active, false);
});

test("the public catalog entry names its row shape and hides the source path", () => {
  const pub = publicModule(poll);
  assert.equal(pub.shape, "record");
  assert.equal("source" in pub, false);
});
