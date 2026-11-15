import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceService, permissionFor } from "./service.js";
import { stableId } from "./send.js";
import { buildSnapshot, planCopy, remapRecord, resolveConfig } from "../carryover/snapshot.js";

const P = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const R = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fid = (n) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;
const rid = (n) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, "0")}`;
const f = (n, objectId, key, name, type, config = {}, extra = {}) =>
  ({ id: fid(n), objectId, key, name, type, config, required: false, isUnique: false, revision: 1, deletedAt: null, ...extra });
const context = { projectId: "p", eventId: "e", principal: { kind: "staff", id: "u" } };

function definition() {
  return {
    workspace: { revision: 1 },
    objects: [
      { id: P, key: "papers", name: "Paper", plural: "Papers", icon: "file-text", numberPrefix: "PAP", titleFieldId: fid(1), statuses: [{ key: "new", label: "New", color: "gray" }], revision: 3, deletedAt: null },
      { id: R, key: "reviews", name: "Review", plural: "Reviews", icon: "star", numberPrefix: "REV", titleFieldId: null, statuses: [], revision: 1, deletedAt: null },
    ],
    fields: [
      f(1, P, "title", "Title", "short_text", { maxLength: 1000 }),
      f(2, P, "code", "Code", "short_text", { maxLength: 1000 }),
      f(3, P, "score", "Score", "number", { decimals: 0 }),
      f(4, P, "double", "Double", "formula", { expression: "{score} * 2", result: "number" }),
      f(5, R, "paper", "Paper", "link_record", { targetObjectId: P, multiple: false }),
      f(6, R, "reviewer", "Reviewer", "link_event", { target: "contact", multiple: false }),
      f(7, R, "order", "Order", "link_event", { target: "order", multiple: false }),
      f(8, R, "mark", "Mark", "number", { decimals: 0 }),
    ],
    views: [{ id: rid(90), objectId: R, name: "Mine", shared: true, config: { kind: "table", columns: [{ fieldId: fid(8) }], filter: { op: "and", items: [{ field: fid(8), operator: "gte", value: 3 }] } } }],
  };
}

function fakeStore(records = []) {
  const sent = [];
  return {
    sent,
    definition: async () => definition(),
    event: async () => ({ timezone: "UTC" }),
    record: async (_, id) => records.find((record) => record.id === id) ?? null,
    records: async (_, ids) => records.filter((record) => ids.includes(record.id)),
    async *recordPages() { yield records; },
    command: async (_, command) => { sent.push(command); return { ok: true, revision: 2 }; },
  };
}

test("permissionFor mirrors the database's action → permission map", () => {
  assert.equal(permissionFor({ action: "record.create" }), "events.workspace.record_create");
  assert.equal(permissionFor({ action: "records.bulk" }), "events.workspace.record_update");
  assert.equal(permissionFor({ action: "records.restore" }), "events.workspace.record_delete");
  assert.equal(permissionFor({ action: "field.update" }), "events.workspace.configure");
  assert.equal(permissionFor({ action: "view.save" }), "events.workspace.view");
  assert.throws(() => permissionFor({ action: "records.recompute" }), { code: "invalid_input" });
});

test("a new list gets a Name field as its title when no fields are given", async () => {
  const store = fakeStore();
  await createWorkspaceService(store).runCommand(context, { action: "object.create", object: { name: "Volunteer" } });
  const command = store.sent[0];
  assert.equal(command.action, "object.create");
  assert.equal(command.object.key, "volunteer");
  assert.deepEqual(command.fields.map((field) => [field.key, field.type]), [["name", "short_text"]]);
  assert.equal(command.titleFieldKey, "name");
  assert.match(command.requestHash, /^[0-9a-f]{64}$/);
});

test("a field change that would clear values needs confirmation, then sends conversions", async () => {
  const records = [
    { id: rid(1), objectId: P, number: 1, title: "A", revision: 1, values: { [fid(1)]: "A", [fid(2)]: "12" } },
    { id: rid(2), objectId: P, number: 2, title: "B", revision: 1, values: { [fid(1)]: "B", [fid(2)]: "x" } },
  ];
  const store = fakeStore(records);
  const service = createWorkspaceService(store);
  await assert.rejects(service.runCommand(context, { action: "field.update", fieldId: fid(2), patch: { type: "number" } }),
    (error) => error.code === "confirm_required" && error.fields.impact.clears === 1);
  assert.equal(store.sent.length, 0);
  const { after } = await service.runCommand(context, { action: "field.update", fieldId: fid(2), patch: { type: "number" }, confirm: true });
  assert.deepEqual(store.sent[0].conversions, [{ recordId: rid(1), value: 12 }, { recordId: rid(2), value: null }]);
  assert.equal(after.length, 1);
});

test("bulk edits send one recalculated update per record", async () => {
  const records = [
    { id: rid(1), objectId: P, number: 1, title: "A", status: "new", revision: 1, values: { [fid(1)]: "A", [fid(3)]: 1, [fid(4)]: 2 } },
    { id: rid(2), objectId: P, number: 2, title: "B", status: "new", revision: 1, values: { [fid(1)]: "B", [fid(3)]: 2, [fid(4)]: 4 } },
  ];
  const store = fakeStore(records);
  await createWorkspaceService(store).runCommand(context, { action: "records.bulk", recordIds: [rid(1), rid(2)], values: { [fid(3)]: 5 } });
  assert.deepEqual(store.sent[0].updates, [
    { recordId: rid(1), values: { [fid(3)]: 5, [fid(4)]: 10 }, title: "A" },
    { recordId: rid(2), values: { [fid(3)]: 5, [fid(4)]: 10 }, title: "B" },
  ]);
});

test("deleting a list that others link to is blocked with a reason", async () => {
  const store = fakeStore();
  await assert.rejects(createWorkspaceService(store).runCommand(context, { action: "object.delete", objectId: P }),
    (error) => error.code === "blocked" && /Reviews/.test(error.message));
});

test("snapshots are portable, plans explain themselves, and records remap", () => {
  const def = definition();
  const snapshot = buildSnapshot(def, { objects: { [R]: { mode: "records", excludeFieldIds: [fid(8)] } } }, { views: def.views });
  const reviews = snapshot.objects[0];
  assert.equal(reviews.fields.find((field) => field.key === "paper").config.targetObjectKey, "papers");
  assert.equal(reviews.fields.some((field) => field.key === "mark"), false);
  assert.deepEqual(reviews.views[0].config.columns, []);
  const plan = planCopy(snapshot, { objects: [], fields: [] }, { linkCounts: { [fid(7)]: 4, [fid(6)]: 2 }, recordCounts: { [R]: 10 } });
  assert.ok(plan.sentences.some((s) => /Link field Paper on Reviews will be dropped/.test(s)));
  assert.ok(plan.sentences.some((s) => /Order on Reviews .* 4 links will be cleared/.test(s)));
  assert.ok(!plan.sentences.some((s) => /Reviewer on Reviews/.test(s)), "contact links carry over");
  assert.ok(plan.sentences.some((s) => /10 records will be copied into Reviews/.test(s)));
  const fieldMap = new Map([[fid(6), "t6"], [fid(7), "t7"]]);
  const contact = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const out = remapRecord({ values: {}, links: { [fid(6)]: [{ kind: "contact", id: contact }], [fid(7)]: [{ kind: "order", id: contact }] } }, plan.objects[0], { fieldMap });
  assert.deepEqual(out.links, [{ fieldId: "t6", targets: [{ kind: "contact", id: contact }] }]);
  const config = resolveConfig({ type: "link_record", config: { targetObjectKey: "papers", multiple: false } }, reviews, { objectIds: new Map([["papers", "new-p"]]), fieldIds: new Map() });
  assert.deepEqual(config, { targetObjectId: "new-p", multiple: false });
});

test("stable ids are UUIDs and repeat for the same parts", () => {
  const a = stableId("job", "record", "x");
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(stableId("job", "record", "x"), a);
  assert.notEqual(stableId("job", "record", "y"), a);
});
