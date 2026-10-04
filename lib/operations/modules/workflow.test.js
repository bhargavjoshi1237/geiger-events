import test from "node:test";
import assert from "node:assert/strict";
import * as registry from "./registry.js";
import { validateModuleSet } from "../config/dependencies.js";
import { createRecord, listRecords } from "../records/service.js";

test("native workflow definitions cannot be shadowed or have core constraints weakened", () => {
  assert.equal(typeof registry.getWorkflowModules, "function");
  const modules = registry.getWorkflowModules();
  assert.deepEqual(modules.map((item) => item.key), ["ops-people", "ops-resources", "ops-activities"]);
  assert.equal(validateModuleSet(modules).length, 3);
  const person = structuredClone(modules[0]);
  person.fields = person.fields.filter((field) => field.id !== "email");
  assert.throws(() => validateModuleSet([person, ...modules.slice(1)]), { code: "native_invariant" });
  const resource = structuredClone(modules[1]);
  resource.fields.find((field) => field.id === "capacity").min = -1;
  assert.throws(() => validateModuleSet([modules[0], resource, modules[2]]), { code: "native_invariant" });
  const another = registry.getWorkflowModules();
  another[0].label = "Renamed";
  assert.equal(registry.getWorkflowModules()[0].label, "People");
});

test("generic record routes cannot bypass native domain services", async () => {
  const store = { readWorkspace() { throw new Error("Native record route reached storage"); } };
  for (const moduleKey of ["ops-people", "ops-resources", "ops-activities"]) {
    await assert.rejects(createRecord({}, { moduleKey, commandId: "11111111-1111-4111-8111-111111111111" }, store),
      { code: "native_workflow_required", status: 422 });
    await assert.rejects(listRecords({}, { moduleKey }, store),
      { code: "native_workflow_required", status: 422 });
  }
});
