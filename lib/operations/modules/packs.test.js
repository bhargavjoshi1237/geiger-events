import assert from "node:assert/strict";
import test from "node:test";
import * as packs from "./packs.js";
import * as registry from "./registry.js";
import * as dependencies from "../config/dependencies.js";

test("three packs copy independent modules through the same registry", () => {
  const first = packs.instantiatePack("workshop");
  const second = packs.instantiatePack("workshop");
  first.modules[0].label = "Edited";
  assert.equal(second.modules[0].label, "Course preparation");
  for (const kind of ["conference", "workshop", "competition"]) {
    const selected = packs.instantiatePack(kind);
    assert.equal(selected.modules.length, 2);
    assert.ok(selected.modules.every((module) => module.capabilities.includes("records")));
    assert.deepEqual(dependencies.validateModuleSet(selected.modules).map((module) => module.key),
      selected.modules.map((module) => module.key));
  }
  assert.equal(registry.getModuleDefinition("equipment-checks", 1).key, "equipment-checks");
  assert.equal(registry.getModuleDefinition("equipment-checks", 2), null);
});

test("unknown and unimplemented capabilities fail even inside a valid record module", () => {
  const base = packs.instantiatePack("workshop").modules[0];
  for (const capability of ["run-javascript", "evaluation"]) {
    assert.throws(() => dependencies.validateModuleSet([
      { ...base, capabilities: ["records", capability] },
    ]), (error) => error.code === "unknown_capability");
  }
  assert.deepEqual([...registry.listImplementedCapabilities()].sort(), ["forms", "records"]);
});

test("duplicate keys, unsupported views and custom shadows of native keys fail", () => {
  const [base] = packs.instantiatePack("competition").modules;
  assert.throws(() => dependencies.validateModuleSet([base, base]),
    (error) => error.code === "duplicate_module");
  assert.throws(() => dependencies.validateModuleSet([{ ...base, views: ["calendar"] }]),
    (error) => error.code === "invalid_definition");
  assert.throws(() => dependencies.validateModuleSet([{ ...base, sourceKind: "custom" }]),
    (error) => error.code === "reserved_module");
  assert.throws(() => dependencies.validateModuleSet([{ ...base, version: 2, sourceKind: "custom" }]),
    (error) => error.code === "reserved_module");
});

test("dependencies must be active providers and may not cycle", () => {
  const [course, equipment] = packs.instantiatePack("workshop").modules;
  const required = { ...course, requires: [{ providerKey: equipment.key, capability: "records" }] };
  assert.deepEqual(dependencies.validateModuleSet([required, equipment]).map((module) => module.key),
    [course.key, equipment.key]);
  assert.throws(() => dependencies.validateModuleSet([required]),
    (error) => error.code === "missing_dependency");
  assert.throws(() => dependencies.validateModuleSet([required, { ...equipment, enabled: false }]),
    (error) => error.code === "missing_dependency");
  assert.throws(() => dependencies.validateModuleSet([
    required, { ...equipment, requires: [{ providerKey: course.key, capability: "records" }] },
  ]), (error) => error.code === "dependency_cycle");
});
