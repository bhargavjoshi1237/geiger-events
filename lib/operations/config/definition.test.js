import assert from "node:assert/strict";
import test from "node:test";
import * as definition from "./definition.js";

const valid = {
  key: "equipment-checks", version: 1, label: "Equipment checks",
  capabilities: ["records", "forms"],
  fields: [{ id: "item", label: "Item", type: "text", required: true }],
  states: [{ key: "new", label: "New" }, { key: "complete", label: "Complete" }],
  transitions: [{ from: "new", to: "complete" }], views: ["table", "board"],
};
const registry = new Set(["records", "forms"]);

test("valid definition keeps stable keys and supports label edits", () => {
  const first = definition.validateDefinition(valid, registry);
  const renamed = definition.validateDefinition({ ...valid, label: "Workshop equipment" }, registry);
  assert.equal(first.key, renamed.key);
  assert.equal(first.fields[0].id, renamed.fields[0].id);
  assert.ok(Object.isFrozen(first.fields[0]));
});

test("duplicate fields, unknown capability, bad transition and reserved key are rejected", () => {
  const bad = [
    [{ ...valid, fields: [...valid.fields, valid.fields[0]] }, "duplicate_field"],
    [{ ...valid, capabilities: ["records", "evaluation"] }, "unknown_capability"],
    [{ ...valid, transitions: [{ from: "new", to: "gone" }] }, "invalid_transition"],
    [{ ...valid, fields: [{ ...valid.fields[0], id: "__proto__" }] }, "invalid_definition"],
  ];
  for (const [input, code] of bad) {
    assert.throws(() => definition.validateDefinition(input, registry), (error) => error.code === code);
  }
});
