import test from "node:test";
import assert from "node:assert/strict";
import { instantiatePack } from "../modules/packs.js";
import { saveWorkspaceDraft, publishWorkspace, archiveModule } from "./service.js";

const context = { eventId: "11111111-1111-4111-8111-111111111111", projectId: "p", principal: { id: "u" } };
const commandId = "22222222-2222-4222-8222-222222222222";
const makeModule = () => ({ ...instantiatePack("conference").modules[0], key: "custom-task", sourceKind: "custom" });
const state = (overrides = {}) => ({ revision: 2, status: "active", publishedVersion: 1,
  draft: [makeModule()], modules: [makeModule()], ...overrides });
const fake = (initial, counts = {}) => {
  const calls = [];
  return { calls, readWorkspace: async () => initial,
    countModuleRecords: async (_, key) => counts[key] ?? 0,
    saveDraft: async (...args) => { calls.push(["save", ...args]); return { revision: 3 }; },
    publish: async (...args) => { calls.push(["publish", ...args]); return { revision: 3, publishedVersion: 2 }; },
  };
};

test("draft rejects duplicate keys and unavailable capabilities before storage", async () => {
  const store = fake(state());
  await assert.rejects(saveWorkspaceDraft(context, { expectedRevision: 2, modules: [makeModule(), makeModule()] }, store),
    { code: "duplicate_module", status: 422 });
  await assert.rejects(saveWorkspaceDraft(context, { expectedRevision: 2,
    modules: [{ ...makeModule(), capabilities: ["records", "evaluation"] }] }, store),
  { code: "unknown_capability", status: 422 });
  assert.equal(store.calls.length, 0);
});

test("breaking field edits with records are rejected while nonbreaking additions publish", async () => {
  const original = makeModule();
  const store = fake(state({ draft: [{ ...original, fields: original.fields.map((field, index) =>
    index === 0 ? { ...field, type: "textarea" } : field) }] }), { [original.key]: 1 });
  await assert.rejects(publishWorkspace(context, { expectedRevision: 2, commandId }, store),
    { code: "migration_required", status: 409 });
  assert.equal(store.calls.length, 0);
  const extended = { ...original, fields: [...original.fields, { id: "memo", label: "Memo", type: "text" }] };
  const next = fake(state({ draft: [extended] }), { [original.key]: 1 });
  await publishWorkspace(context, { expectedRevision: 2, commandId }, next);
  assert.equal(next.calls[0][0], "publish");
  assert.equal(next.calls[0][2].modules[0].fields.at(-1).id, "memo");
});

test("stale publish reports current revision and archives without deleting records", async () => {
  const store = fake(state(), { [makeModule().key]: 5 });
  await assert.rejects(publishWorkspace(context, { expectedRevision: 1, commandId }, store),
    (error) => error.code === "revision_conflict" && error.fields.currentRevision === 2);
  await archiveModule(context, { moduleKey: makeModule().key, expectedRevision: 2, commandId }, store);
  assert.equal(store.calls[0][0], "publish");
  assert.equal(store.calls[0][2].modules[0].enabled, false);
});
