import { OperationsError } from "../errors.js";
import { getModuleDefinition } from "./registry.js";

const packs = Object.freeze({
  conference: { version: 1, modules: ["accepted-items", "speaker-preparation"] },
  workshop: { version: 1, modules: ["course-preparation", "equipment-checks"] },
  competition: { version: 1, modules: ["entries", "judge-onboarding"] },
});

export function instantiatePack(packKey) {
  const pack = Object.hasOwn(packs, packKey) ? packs[packKey] : null;
  if (!pack) throw new OperationsError("unknown_pack", 422, "Choose an available pack.");
  return {
    packKey,
    packVersion: pack.version,
    modules: pack.modules.map((key) => structuredClone(getModuleDefinition(key, 1))),
  };
}

export function listPacks() {
  return Object.entries(packs).map(([key, pack]) => ({
    key, version: pack.version,
    modules: pack.modules.map((moduleKey) => ({
      key: moduleKey, label: getModuleDefinition(moduleKey, 1).label,
    })),
  }));
}
