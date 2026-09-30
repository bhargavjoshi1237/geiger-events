import assert from "node:assert/strict";
import test from "node:test";
import * as fields from "./fields.js";

const inspection = {
  key: "vendor-inspection", version: 1,
  fields: [
    { id: "name", label: "Vendor", type: "text", required: true },
    { id: "approved", label: "Approved", type: "boolean" },
    { id: "count", label: "Count", type: "number", min: 0 },
    { id: "category", label: "Category", type: "select", options: ["Food", "Equipment"] },
    { id: "due", label: "Due", type: "date" },
  ],
};

test("inspection preserves false and zero without admitting structured values", () => {
  assert.deepEqual(fields.validateRecordValues(inspection,
    { name: "Vendor", approved: false, count: 0 }),
  { name: "Vendor", approved: false, count: 0 });
  assert.throws(() => fields.validateRecordValues(inspection, { name: { value: "Vendor" } }),
    (error) => error.code === "invalid_values" && Boolean(error.fields.name));
});

test("unknown, prototype and invalid choices fail before persistence", () => {
  assert.throws(() => fields.validateRecordValues(inspection,
    JSON.parse('{"name":"Vendor","__proto__":{}}')),
  (error) => error.code === "unknown_field");
  assert.throws(() => fields.validateRecordValues(inspection, { name: "Vendor", category: "Catering" }),
    (error) => error.code === "invalid_values" && Boolean(error.fields.category));
  assert.throws(() => fields.validateRecordValues(inspection, { name: "Vendor", count: -1 }),
    (error) => error.code === "invalid_values" && Boolean(error.fields.count));
  assert.throws(() => fields.validateRecordValues(inspection, { name: "Vendor", due: "2026-02-30" }),
    (error) => error.code === "invalid_values" && Boolean(error.fields.due));
});

test("workshop and competition fields use one validator and stable IDs", () => {
  const workshop = { fields: [{ id: "item", label: "Item", type: "text", required: true }] };
  const competition = { fields: [{ id: "item", label: "Entry", type: "text", required: true }] };
  assert.deepEqual(fields.validateRecordValues(workshop, { item: "Projector" }), { item: "Projector" });
  assert.deepEqual(fields.validateRecordValues(competition, { item: "Team A" }), { item: "Team A" });
  assert.throws(() => fields.validateRecordValues(competition, {}),
    (error) => error.code === "invalid_values" && Boolean(error.fields.item));
});

test("references must target an allowed module within the same event", () => {
  const definition = { fields: [{ id: "owner", type: "reference", targetModuleKeys: ["people"] }] };
  const intent = [{ fieldId: "owner", targetId: "person" }];
  const scope = { projectId: "project", eventId: "event" };
  const targets = [{ id: "person", moduleKey: "people", projectId: "project", eventId: "event" }];
  assert.deepEqual(fields.validateReferenceTargets(definition, intent, targets, scope), intent);
  assert.throws(() => fields.validateReferenceTargets(definition, intent,
    [{ ...targets[0], eventId: "other" }], scope),
  (error) => error.code === "invalid_reference");
  assert.throws(() => fields.validateReferenceTargets(definition, intent,
    [{ ...targets[0], moduleKey: "rooms" }], scope),
  (error) => error.code === "invalid_reference");
});
