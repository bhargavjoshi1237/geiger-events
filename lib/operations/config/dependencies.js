import { isObject, OPERATIONS_LIMITS } from "../contracts.js";
import { OperationsError } from "../errors.js";
import { validateDefinition } from "./definition.js";
import { getModuleDefinition, isNativeModuleKey, listImplementedCapabilities } from "../modules/registry.js";

export function validateModuleSet(modules) {
  if (!Array.isArray(modules) || modules.length > OPERATIONS_LIMITS.modules) {
    throw new OperationsError("invalid_modules", 422, "Choose up to 30 modules.");
  }
  const byKey = new Map();
  for (const input of modules) {
    if (!isObject(input)) throw new OperationsError("invalid_modules", 422, "Invalid module.");
    if (byKey.has(input.key)) {
      throw new OperationsError("duplicate_module", 422, `Duplicate module: ${input.key}.`);
    }
    const native = getModuleDefinition(input.key, input.version);
    if (isNativeModuleKey(input.key) && input.sourceKind !== "native") {
      throw new OperationsError("reserved_module", 422, "A custom module cannot use a native key.");
    }
    if (!native && input.sourceKind === "native") {
      throw new OperationsError("reserved_module", 422, "Unknown native module version.");
    }
    if (native) {
      for (const required of native.fields.filter((field) => field.required)) {
        const candidate = input.fields?.find((field) => field.id === required.id);
        if (!candidate || candidate.type !== required.type || candidate.required !== true) {
          throw new OperationsError("native_invariant", 422, "A native module's required fields cannot be removed or changed.");
        }
      }
    }
    byKey.set(input.key, validateDefinition({ ...input, sourceKind: input.sourceKind ?? "custom" },
      listImplementedCapabilities()));
  }
  const active = [...byKey.values()].filter((module) => module.enabled !== false);
  const visited = new Set();
  const visiting = new Set();
  function visit(module) {
    if (visited.has(module.key)) return;
    if (visiting.has(module.key)) {
      throw new OperationsError("dependency_cycle", 422, "Module dependencies must not cycle.");
    }
    visiting.add(module.key);
    for (const { providerKey, capability } of module.requires || []) {
      const provider = byKey.get(providerKey);
      if (!provider || provider.enabled === false || !provider.capabilities.includes(capability)) {
        throw new OperationsError("missing_dependency", 422,
          `Module ${module.key} needs ${capability} from ${providerKey}.`);
      }
      visit(provider);
    }
    for (const field of module.fields) {
      if (field.type !== "reference") continue;
      for (const targetKey of field.targetModuleKeys) {
        const target = byKey.get(targetKey);
        if (!target || target.enabled === false) {
          throw new OperationsError("missing_dependency", 422,
            `Module ${module.key} references unavailable ${targetKey}.`);
        }
      }
    }
    visiting.delete(module.key);
    visited.add(module.key);
  }
  active.forEach(visit);
  return [...byKey.values()];
}
