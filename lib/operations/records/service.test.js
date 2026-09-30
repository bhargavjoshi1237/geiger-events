import test from "node:test";
import assert from "node:assert/strict";
import { instantiatePack } from "../modules/packs.js";
import { validateReferenceTargets } from "../config/fields.js";
import {
  createRecord, updateRecord, transitionRecord, archiveRecord, listRecords,
} from "./service.js";

const context = { eventId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222",
  principal: { id: "33333333-3333-4333-8333-333333333333" } };
const commandId = "44444444-4444-4444-8444-444444444444";
const recordId = "55555555-5555-4555-8555-555555555555";

function fake(definition, row = null) {
  const calls = [];
  return { calls, readWorkspace: async () => ({ status: "active", publishedVersion: 1,
    modules: [definition] }),
  getRecord: async () => row,
  getReferenceTargets: async () => [],
  mutate: async (_, command) => { calls.push(command); return { id: recordId, ...command }; },
  list: async () => [],
  };
}

test("one record engine creates conference, workshop and competition records", async () => {
  for (const pack of ["conference", "workshop", "competition"]) {
    const definition = instantiatePack(pack).modules[0];
    const values = Object.fromEntries(definition.fields.filter((f) => f.required && f.type !== "reference")
      .map((f) => [f.id, f.type === "number" ? 1 : "Example"]));
    const store = fake(definition);
    await createRecord(context, { moduleKey: definition.key, title: "Example", values,
      references: [], commandId }, store);
    assert.equal(store.calls[0].moduleKey, definition.key);
    assert.deepEqual(store.calls[0].values, values);
  }
});

test("references cannot escape event or allowed module", () => {
  const definition = { fields: [{ id: "owner", type: "reference", targetModuleKeys: ["people"] }] };
  const refs = [{ fieldId: "owner", targetId: recordId }];
  const target = { id: recordId, moduleKey: "people", eventId: "other-event", projectId: context.projectId };
  assert.throws(() => validateReferenceTargets(definition, refs, [target], context),
    { code: "invalid_reference" });
  assert.throws(() => validateReferenceTargets(definition, refs,
    [{ ...target, eventId: context.eventId, moduleKey: "equipment" }], context),
  { code: "invalid_reference" });
});

test("unknown values, stale revisions and unsupported transitions fail closed", async () => {
  const definition = instantiatePack("workshop").modules[1];
  const row = { id: recordId, moduleKey: definition.key, revision: 2, state: "new", title: "Projector",
    values: { item: "Projector" }, references: [] };
  const store = fake(definition, row);
  await assert.rejects(createRecord(context, { moduleKey: definition.key, title: "Bad",
    values: { item: "Projector", __protoHack: true }, references: [], commandId }, store),
  { code: "unknown_field" });
  await assert.rejects(updateRecord(context, { moduleKey: definition.key, recordId,
    expectedRevision: 1, title: "Projector", values: row.values, references: [], commandId }, store),
  { code: "revision_conflict" });
  await assert.rejects(transitionRecord(context, { moduleKey: definition.key, recordId,
    expectedRevision: 2, nextState: "complete", commandId }, store),
  { code: "invalid_transition" });
  assert.equal(store.calls.length, 0);
});

test("archive uses mutation and list rejects malicious cursor/filter", async () => {
  const definition = instantiatePack("competition").modules[1];
  const row = { id: recordId, moduleKey: definition.key, revision: 2, state: "new" };
  const store = fake(definition, row);
  await archiveRecord(context, { moduleKey: definition.key, recordId,
    expectedRevision: 2, commandId }, store);
  assert.equal(store.calls[0].action, "archive");
  await assert.rejects(listRecords(context, { moduleKey: definition.key, cursor: "' OR true --" }, store),
    { code: "invalid_cursor" });
  await assert.rejects(listRecords(context, { moduleKey: definition.key, state: "new;drop table" }, store),
    { code: "invalid_filter" });
});
