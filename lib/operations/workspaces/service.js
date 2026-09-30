import { createHash } from "node:crypto";
import { validateModuleSet } from "../config/dependencies.js";
import { OperationsError } from "../errors.js";
import { operationsStore } from "../server/store.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = (currentRevision) => new OperationsError("revision_conflict", 409,
  "This workspace changed. Reload and try again.", { currentRevision });

function requireRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new OperationsError("invalid_revision", 422, "Enter a valid revision.");
  }
}

function requireCommandId(value) {
  if (typeof value !== "string" || !uuid.test(value)) {
    throw new OperationsError("invalid_command", 422, "Enter a valid command ID.");
  }
}

function breaking(before, after) {
  if (!after) return true;
  const nextFields = new Map(after.fields.map((field) => [field.id, field]));
  for (const field of before.fields) {
    const next = nextFields.get(field.id);
    if (!next) return true;
    for (const key of ["type", "required", "options", "min", "max", "targetModuleKeys", "showWhen"]) {
      if (JSON.stringify(field[key] ?? null) !== JSON.stringify(next[key] ?? null)) return true;
    }
  }
  if (after.fields.some((field) => !before.fields.some((old) => old.id === field.id) && field.required)) return true;
  return before.states.some((state) => !after.states.some((next) => next.key === state.key));
}

async function ensureCompatible(context, current, modules, store) {
  const next = new Map(modules.map((item) => [item.key, item]));
  for (const before of current.modules) {
    if (breaking(before, next.get(before.key)) && await store.countModuleRecords(context, before.key) > 0) {
      throw new OperationsError("migration_required", 409,
        `Module ${before.key} has records. Export and migrate them before changing its data model.`);
    }
  }
}

export async function readWorkspace(context, store = operationsStore) {
  return store.readWorkspace(context);
}

export async function saveWorkspaceDraft(context, { expectedRevision, modules }, store = operationsStore) {
  requireRevision(expectedRevision);
  const validated = validateModuleSet(modules);
  const current = await store.readWorkspace(context);
  if (current.revision !== expectedRevision) throw conflict(current.revision);
  return store.saveDraft(context, { expectedRevision, modules: validated });
}

export async function publishWorkspace(context, { expectedRevision, commandId }, store = operationsStore) {
  requireRevision(expectedRevision);
  requireCommandId(commandId);
  const requestHash = createHash("sha256").update(JSON.stringify({ action: "publish", expectedRevision })).digest("hex");
  const receipt = await store.lookupReceipt?.(context, commandId);
  if (receipt) {
    if (receipt.request_hash !== requestHash) {
      throw new OperationsError("command_conflict", 409, "This command ID was already used.");
    }
    return receipt.response;
  }
  const current = await store.readWorkspace(context);
  if (current.revision !== expectedRevision) throw conflict(current.revision);
  const modules = validateModuleSet(current.draft);
  await ensureCompatible(context, current, modules, store);
  return store.publish(context, { expectedRevision, modules, commandId, requestHash });
}

export async function archiveModule(context, { moduleKey, expectedRevision, commandId }, store = operationsStore) {
  requireRevision(expectedRevision);
  requireCommandId(commandId);
  const requestHash = createHash("sha256").update(JSON.stringify({ action: "archive_module", moduleKey,
    expectedRevision })).digest("hex");
  const receipt = await store.lookupReceipt?.(context, commandId);
  if (receipt) {
    if (receipt.request_hash !== requestHash) {
      throw new OperationsError("command_conflict", 409, "This command ID was already used.");
    }
    return receipt.response;
  }
  const current = await store.readWorkspace(context);
  if (current.revision !== expectedRevision) throw conflict(current.revision);
  if (!current.publishedVersion) throw new OperationsError("not_found", 404, "Workspace not published.");
  if (JSON.stringify(current.draft) !== JSON.stringify(current.modules)) {
    throw new OperationsError("unpublished_draft", 409,
      "Publish or discard the saved draft before archiving a module.");
  }
  const target = current.modules.find((item) => item.key === moduleKey);
  if (!target) throw new OperationsError("not_found", 404, "Module not found.");
  if (target.enabled === false) {
    throw new OperationsError("already_archived", 409, "This module is already archived.");
  }
  const modules = validateModuleSet(current.modules.map((item) =>
    item.key === moduleKey ? { ...item, enabled: false } : item));
  return store.publish(context, { expectedRevision, modules, commandId, requestHash });
}

export async function readModuleImpact(context, moduleKey, store = operationsStore) {
  const current = await store.readWorkspace(context);
  const modules = current.draft.length ? current.draft : current.modules;
  if (!modules.some((item) => item.key === moduleKey)) {
    throw new OperationsError("not_found", 404, "Module not found.");
  }
  const dependents = modules.filter((item) => item.enabled !== false && item.key !== moduleKey &&
    ((item.requires || []).some((requirement) => requirement.providerKey === moduleKey) ||
      item.fields.some((field) => field.type === "reference" &&
        field.targetModuleKeys.includes(moduleKey)))).map((item) => item.label);
  return { recordCount: await store.countModuleRecords(context, moduleKey), dependents };
}
