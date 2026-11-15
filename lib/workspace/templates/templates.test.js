import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_TEMPLATES } from "./catalog.js";
import { dryRun, templateSummary } from "./installer.js";
import { resolveRefs, tokenizeIds } from "./refs.js";

test("templates: references resolve, and unknown ones are reported and dropped", () => {
  const maps = { list: new Map([["paper", "L1"]]), field: new Map([["paper.title", "F1"]]), role: new Map(), doc: new Map(), review: new Map(), me: "ME" };
  const { value, missing } = resolveRefs({ list: "#list:paper", ids: ["#field:paper.title", "#field:paper.gone", "plain"], "#list:paper": { x: "#me" }, "#list:gone": 1, n: 3 }, maps);
  assert.deepEqual(value, { list: "L1", ids: ["F1", "plain"], L1: { x: "ME" }, n: 3 });
  assert.deepEqual(missing.sort(), ["#field:paper.gone", "#list:gone"]);
  const tokens = new Map([["l1", "#list:paper"], ["f1", "#field:paper.title"]]);
  assert.deepEqual(tokenizeIds({ objectId: "L1", fields: { F1: "edit" }, other: "x" }, tokens), { objectId: "#list:paper", fields: { "#field:paper.title": "edit" }, other: "x" });
});

for (const template of BUILTIN_TEMPLATES) {
  test(`templates: ${template.name} builds with no code (dry run)`, () => {
    assert.deepEqual(dryRun(template), []);
    const summary = templateSummary(template);
    assert.ok(summary.lists.length >= 4 && summary.automations.length >= 2, "a complete setup");
  });
}
