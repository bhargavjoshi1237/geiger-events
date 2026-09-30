import { createHash } from "node:crypto";
import { STABLE_KEY } from "../contracts.js";
import { validateRecordValues } from "../config/fields.js";
import { OperationsError } from "../errors.js";
import { operationsStore } from "../server/store.js";
import { decodeCursor, encodeCursor } from "./projection.js";
import { resolveReferences } from "./references.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validTitle = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200;

async function activeModule(context, moduleKey, store, { allowDisabled = false } = {}) {
  if (!STABLE_KEY.test(moduleKey ?? "")) throw new OperationsError("invalid_module", 422, "Invalid module key.");
  const workspace = await store.readWorkspace(context);
  const definition = workspace.status === "active" && workspace.modules.find((item) =>
    item.key === moduleKey && (allowDisabled || item.enabled !== false));
  if (!definition) throw new OperationsError("not_found", 404, "Module not found.");
  return { definition, definitionVersion: workspace.publishedVersion };
}

async function existingRecord(context, moduleKey, recordId, expectedRevision, store) {
  if (!uuid.test(recordId ?? "")) throw new OperationsError("invalid_record", 400, "Invalid record ID.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new OperationsError("invalid_revision", 422, "Enter a valid revision.");
  }
  const record = await store.getRecord(context, recordId);
  if (!record || record.moduleKey !== moduleKey || record.archivedAt) {
    throw new OperationsError("not_found", 404, "Record not found.");
  }
  if (record.revision !== expectedRevision) {
    throw new OperationsError("revision_conflict", 409, "This record changed. Reload and try again.",
      { currentRevision: record.revision });
  }
  return record;
}

async function runCommand(context, input, action, store, prepare) {
  if (!uuid.test(input.commandId ?? "")) {
    throw new OperationsError("invalid_command", 422, "Enter a valid command ID.");
  }
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ action, ...input, commandId: undefined })).digest("hex");
  const receipt = await store.lookupReceipt?.(context, input.commandId);
  if (receipt) {
    if (receipt.request_hash !== requestHash) {
      throw new OperationsError("command_conflict", 409, "This command ID was already used.");
    }
    return receipt.response;
  }
  const { definitionVersion } = await activeModule(context, input.moduleKey, store);
  const payload = await prepare();
  return store.mutate(context, { action, moduleKey: input.moduleKey,
    definitionVersion, commandId: input.commandId, requestHash, ...payload });
}

export async function createRecord(context, input, store = operationsStore) {
  return runCommand(context, input, "create", store, async () => {
    const { definition } = await activeModule(context, input.moduleKey, store);
    if (!validTitle(input.title)) throw new OperationsError("invalid_title", 422, "Enter a record title.");
    return { title: input.title.trim(), values: validateRecordValues(definition, input.values),
      references: await resolveReferences(context, definition, input.references ?? [], store) };
  });
}

export async function updateRecord(context, input, store = operationsStore) {
  return runCommand(context, input, "update", store, async () => {
    const { definition } = await activeModule(context, input.moduleKey, store);
    await existingRecord(context, input.moduleKey, input.recordId, input.expectedRevision, store);
    if (!validTitle(input.title)) throw new OperationsError("invalid_title", 422, "Enter a record title.");
    return { recordId: input.recordId, expectedRevision: input.expectedRevision,
      title: input.title.trim(), values: validateRecordValues(definition, input.values),
      references: await resolveReferences(context, definition, input.references ?? [], store) };
  });
}

export async function transitionRecord(context, input, store = operationsStore) {
  return runCommand(context, input, "transition", store, async () => {
    const { definition } = await activeModule(context, input.moduleKey, store);
    const record = await existingRecord(context, input.moduleKey, input.recordId, input.expectedRevision, store);
    if (!definition.transitions.some((item) => item.from === record.state && item.to === input.nextState)) {
      throw new OperationsError("invalid_transition", 422, "This state transition is unavailable.");
    }
    return { recordId: input.recordId, expectedRevision: input.expectedRevision, nextState: input.nextState };
  });
}

export async function archiveRecord(context, input, store = operationsStore) {
  return runCommand(context, input, "archive", store, async () => {
    await existingRecord(context, input.moduleKey, input.recordId, input.expectedRevision, store);
    return { recordId: input.recordId, expectedRevision: input.expectedRevision };
  });
}

export async function listRecords(context, filter, store = operationsStore) {
  const { definition } = await activeModule(context, filter.moduleKey, store,
    { allowDisabled: filter.archived === true });
  if (filter.state !== undefined && !definition.states.some((item) => item.key === filter.state)) {
    throw new OperationsError("invalid_filter", 400, "Invalid state filter.");
  }
  const limit = filter.limit === undefined ? 25 : Number(filter.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new OperationsError("invalid_filter", 400, "Invalid page size.");
  }
  const cursor = decodeCursor(filter.cursor, context, filter);
  const items = await store.list(context, { moduleKey: filter.moduleKey, state: filter.state ?? null,
    archived: filter.archived === true, cursor, limit: limit + 1 });
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  return { items: page, nextCursor: hasMore ? encodeCursor(context, filter, page.at(-1)) : null };
}

export async function readRecord(context, { moduleKey, recordId, archived = false }, store = operationsStore) {
  await activeModule(context, moduleKey, store, { allowDisabled: archived });
  if (!uuid.test(recordId ?? "")) throw new OperationsError("invalid_record", 400, "Invalid record ID.");
  const record = await store.getRecord(context, recordId);
  if (!record || record.moduleKey !== moduleKey || Boolean(record.archivedAt) !== archived) {
    throw new OperationsError("not_found", 404, "Record not found.");
  }
  return record;
}
