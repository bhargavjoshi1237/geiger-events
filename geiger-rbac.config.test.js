import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { evaluate } from "@geiger/rbac";

test("operations catalog boots and role templates enforce record action permissions and event scope", async () => {
  // Addon manifests import browser UI. Only that unrelated boundary is replaced;
  // the product catalog, role templates and RBAC validation/evaluator stay real.
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/addons") {
        return { url: "data:text/javascript,export const ADDON_PERMISSIONS = [];", shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  let config;
  try {
    ({ default: config } = await import("./geiger-rbac.config.js"));
  } finally {
    hooks.deregister();
  }
  const actions = ["events.operations.view", "events.operations.configure",
    "events.operations.record_create", "events.operations.record_update", "events.operations.record_archive"];
  for (const roleKey of ["owner", "admin", "manager", "member", "viewer"]) {
    const template = config.systemRoles.find(role => role.key === roleKey);
    const roles = [{ ...template, id: "role-1" }];
    const grants = [{ id: "grant-1", roleId: "role-1", scope: { event: ["event-1"] } }];
    for (const action of actions) {
      assert.equal(evaluate(action, { config, roles, grants, scopeId: "event-1" }).allowed,
        ["owner", "admin", "manager"].includes(roleKey), `${roleKey}: ${action}`);
      assert.equal(evaluate(action, { config, roles, grants, scopeId: "event-2" }).allowed,
        false, `${roleKey}: ${action} must respect event scope`);
    }
  }
});
