import { randomUUID } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { normaliseRecordInput } from "../records/values.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { DB_MESSAGES } from "../server/http.js";
import { stableId } from "../server/send.js";
import { workspaceStore } from "../server/store.js";
import { requestHash, loadRecord, loadRecords } from "../process/records.js";
import { checkMove, cleanProcess } from "../process/stages.js";
import { processStore } from "../process/store.js";
import { processAfter } from "../process/after.js";
import { ApiError, apiRoute } from "../../api_webhooks/server/public_api.js";

// The workspace part of the public API (/api/v1/workspace/<eventId>/…): lists and records by field key, written as
// the API key through the system command, with the same stage rules and checks as everyone else.
const SYSTEM_SORT = new Set(["number", "title", "status", "created_at", "updated_at"]);
const MAX_LIMIT = 100;

const fail = (status, code, message) => { throw new ApiError(status, code, message); };

// Workspace and database refusals in the API's error shape.
function asApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof WorkspaceError) {
    const fields = error.fields && typeof error.fields === "object" && !Array.isArray(error.fields) ? Object.values(error.fields).filter((item) => typeof item === "string") : [];
    return new ApiError(error.status ?? 422, error.code ?? "invalid_request", fields.length ? `${error.message} ${fields.join(" ")}` : error.message);
  }
  switch (error?.code) {
    case "40001": return new ApiError(409, "revision_conflict", "The record changed since you read it. Fetch it again and retry.");
    case "42501": return new ApiError(403, "forbidden", "This key can't change that.");
    case "22023": return new ApiError(422, "invalid_request", DB_MESSAGES[error.message] ?? "Some of the details aren't valid.");
    case "23505": return new ApiError(409, error.message?.startsWith("Command ID") ? "idempotency_conflict" : "duplicate",
      error.message?.startsWith("Command ID") ? "That Idempotency-Key was used for a different request." : "Another record already has that unique value.");
    default: return null;
  }
}

// apiRoute plus the event's workspace: handler({ ...apiContext, context, definition, eventId, request, body }).
export function workspaceApiRoute(scope, handler, { write = false } = {}) {
  return apiRoute(scope, async (api) => {
    const eventId = String(api.params.eventId ?? "").toLowerCase();
    if (!UUID.test(eventId)) fail(400, "invalid_parameter", "The event id in the address must be a UUID.");
    const event = await api.db.from("events").select("id,project_id,timezone,venue_id").eq("id", eventId).is("deleted_at", null).maybeSingle();
    if (event.error) fail(503, "unavailable", "The API isn't available right now.");
    if (!event.data || event.data.project_id !== api.projectId) fail(404, "not_found", "No event with that id in this project.");
    const context = { projectId: api.projectId, eventId, principal: { kind: "api", id: api.key.id } };
    try {
      const definition = await workspaceStore.definition(context);
      if (!definition.workspace) fail(404, "not_found", "This event has no workspace.");
      let body = null;
      if (write && api.request.method !== "DELETE") {
        body = await api.request.json().catch(() => null);
        if (!isObject(body)) fail(400, "invalid_json", "Send a JSON object.");
      }
      const result = await handler({ ...api, context, definition, eventId, timeZone: event.data.timezone || "UTC", venueId: event.data.venue_id ?? null, body });
      if (write) processAfter(context);
      return result;
    } catch (error) {
      const mapped = asApiError(error);
      if (mapped) throw mapped;
      throw error;
    }
  });
}

export function listOf(definition, ref) {
  const key = String(ref ?? "");
  const object = definition.objects.find((item) => !item.deletedAt && (item.key === key || item.id === key.toLowerCase()));
  if (!object) fail(404, "not_found", `No list called "${key}" in this workspace.`);
  return object;
}

const fieldsOf = (definition, objectId) => liveFields(definition, objectId).sort((a, b) => a.position - b.position);

export function listJson(definition, object) {
  return {
    object: "workspace_list", id: object.id, key: object.key, name: object.name, plural: object.plural,
    statuses: (object.statuses ?? []).map((status) => ({ key: status.key, label: status.label })),
    fields: fieldsOf(definition, object.id).map((field) => ({
      id: field.id, key: field.key, name: field.name, type: field.type, required: Boolean(field.required), unique: Boolean(field.isUnique),
      editable: Boolean(getType(field.type)?.editable),
      ...(field.config?.options ? { options: field.config.options.map((option) => ({ id: option.id, label: option.label })) } : {}),
      ...(field.type === "link_record" ? { links_to: definition.objects.find((item) => item.id === field.config.targetObjectId)?.key ?? null, multiple: Boolean(field.config.multiple) } : {}),
      ...(field.type === "link_event" ? { links_to: field.config.target, multiple: Boolean(field.config.multiple) } : {}),
    })),
  };
}

export function recordJson(definition, object, record) {
  const values = {};
  const links = {};
  for (const field of fieldsOf(definition, object.id)) {
    if (getType(field.type)?.cast === "link") links[field.key] = (record.links?.[field.id] ?? []).map((link) => ({ kind: link.kind, id: link.id, label: link.label ?? "" }));
    else if (field.type === "lookup" || field.type === "rollup") values[field.key] = record.computed?.[field.id] ?? null;
    else values[field.key] = record.values?.[field.id] ?? null;
  }
  return {
    object: "workspace_record", id: record.id, list: object.key, number: record.number, title: record.title ?? "", status: record.status ?? null,
    created_at: record.createdAt ?? null, updated_at: record.updatedAt ?? null, revision: record.revision, values, links,
  };
}

// A filter written with field keys (or ids) → field ids; system columns pass through.
function filterIds(definition, objectId, filter, depth = 0) {
  if (!isObject(filter) || depth > 4) fail(400, "invalid_parameter", "filter must be { op, items: [{ field, operator, value }] }.");
  const byKey = new Map(liveFields(definition, objectId).flatMap((field) => [[field.key, field.id], [field.id, field.id]]));
  return {
    op: filter.op === "or" ? "or" : "and",
    items: (Array.isArray(filter.items) ? filter.items : []).slice(0, 50).map((item) => {
      if (isObject(item) && Array.isArray(item.items)) return filterIds(definition, objectId, item, depth + 1);
      if (!isObject(item)) fail(400, "invalid_parameter", "Each filter item needs a field and an operator.");
      const field = SYSTEM_SORT.has(item.field) ? item.field : byKey.get(item.field);
      if (!field) fail(400, "invalid_parameter", `filter: "${item.field}" isn't a field on this list.`);
      return { ...item, field };
    }),
  };
}

function sortOf(definition, objectId, raw) {
  if (!raw) return undefined;
  const byKey = new Map(liveFields(definition, objectId).map((field) => [field.key, field.id]));
  return String(raw).split(",").slice(0, 3).map((part) => {
    const dir = part.startsWith("-") ? "desc" : "asc";
    const name = part.replace(/^[-+]/, "").trim();
    const field = SYSTEM_SORT.has(name) ? name : byKey.get(name);
    if (!field) fail(400, "invalid_parameter", `sort: "${name}" isn't a field on this list.`);
    return { field, dir };
  });
}

// Body values by field key → values by field id; unknown keys are refused, links accept ids or { id }.
function valuesByIds(definition, objectId, input) {
  if (input === undefined) return {};
  if (!isObject(input)) fail(400, "invalid_parameter", "values must be an object of field keys and values.");
  const byKey = new Map(liveFields(definition, objectId).flatMap((field) => [[field.key, field], [field.id, field]]));
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const field = byKey.get(key);
    if (!field) fail(400, "invalid_parameter", `"${key}" isn't a field on this list.`);
    if (!getType(field.type)?.editable) fail(400, "invalid_parameter", `"${key}" is calculated and can't be set.`);
    out[field.id] = value;
  }
  return out;
}

function guard(definition, object, move) {
  return async (context) => {
    const config = (await processStore.processes(context).catch(() => new Map())).get(object.id);
    if (!config?.enforce) return;
    const problem = checkMove(cleanProcess(definition, object.id, config), object, { ...move, fields: liveFields(definition, object.id) });
    if (problem) fail(problem.code === "move_not_allowed" ? 409 : 422, problem.code === "move_not_allowed" ? "move_not_allowed" : "invalid_request", problem.message);
  };
}

async function send(context, keyId, request, action, payload) {
  const idempotency = request.headers.get("idempotency-key");
  const commandId = idempotency ? stableId(keyId, `api:${idempotency.slice(0, 200)}`) : randomUUID();
  return processStore.systemCommand(context, { kind: "api", actorId: keyId, depth: 0 }, { action, commandId, requestHash: requestHash({ action, ...payload }), ...payload });
}

export const workspaceApi = {
  async lists({ definition }) {
    return { body: { object: "list", data: definition.objects.filter((object) => !object.deletedAt).sort((a, b) => a.position - b.position).map((object) => listJson(definition, object)) } };
  },

  async records({ definition, context, params, query, venueId }) {
    const object = listOf(definition, params.list);
    const limit = query.get("limit") ? Number(query.get("limit")) : 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail(400, "invalid_parameter", `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
    const offset = query.get("offset") ? Number(query.get("offset")) : 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) fail(400, "invalid_parameter", "offset must be a whole number from 0.");
    let filter;
    if (query.get("filter")) {
      let parsed;
      try { parsed = JSON.parse(query.get("filter")); } catch { fail(400, "invalid_parameter", "filter must be JSON."); }
      filter = filterIds(definition, object.id, parsed);
    }
    const search = query.get("search")?.slice(0, 100) || undefined;
    const plan = compileQuery(definition, object.id, { filter, sort: sortOf(definition, object.id, query.get("sort")), search, limit, offset });
    const page = await workspaceStore.query(context, plan);
    const rows = await loadRecords(context, definition, object.id, page.rows.map((row) => row.id), { workspace: workspaceStore, venueId });
    const total = Number(page.total);
    return { body: { object: "list", data: rows.map((row) => recordJson(definition, object, row)), total, has_more: offset + rows.length < total } };
  },

  async record({ definition, context, params, venueId }) {
    const object = listOf(definition, params.list);
    const id = String(params.recordId ?? "").toLowerCase();
    const record = UUID.test(id) ? await loadRecord(context, definition, object.id, id, { workspace: workspaceStore, venueId }) : null;
    if (!record) fail(404, "not_found", "No record with that id on this list.");
    return { body: recordJson(definition, object, record) };
  },

  async create({ definition, context, params, body, request, key, timeZone, venueId }) {
    const object = listOf(definition, params.list);
    const values = valuesByIds(definition, object.id, body.values);
    const config = (await processStore.processes(context).catch(() => new Map())).get(object.id);
    const start = body.status ?? (config?.enforce ? cleanProcess(definition, object.id, config).moves.find((move) => move.from === null)?.to : undefined);
    const out = normaliseRecordInput(definition, object.id, { values, ...(start !== undefined ? { status: start } : {}) }, null, { timeZone });
    await guard(definition, object, { creating: true, to: out.status, values: out.values })(context);
    const result = await send(context, key.id, request, "record.create", { objectId: object.id, values: out.values, status: out.status, links: out.links, title: out.title ?? "" });
    const record = await loadRecord(context, definition, object.id, result.record.id, { workspace: workspaceStore, venueId });
    return { status: 201, body: recordJson(definition, object, record) };
  },

  async update({ definition, context, params, body, request, key, timeZone, venueId }) {
    const object = listOf(definition, params.list);
    const id = String(params.recordId ?? "").toLowerCase();
    const existing = UUID.test(id) ? await workspaceStore.record(context, id) : null;
    if (!existing || existing.deletedAt || existing.objectId !== object.id) fail(404, "not_found", "No record with that id on this list.");
    const values = valuesByIds(definition, object.id, body.values);
    const out = normaliseRecordInput(definition, object.id, { values, ...(body.status !== undefined ? { status: body.status } : {}) }, existing, { timeZone });
    if (body.status !== undefined && out.status !== existing.status) {
      const merged = { ...existing.values };
      for (const [fieldId, value] of Object.entries(out.values)) { if (value === null) delete merged[fieldId]; else merged[fieldId] = value; }
      await guard(definition, object, { from: existing.status, to: out.status, values: merged })(context);
    }
    if (body.expected_revision !== undefined && !Number.isInteger(body.expected_revision)) fail(400, "invalid_parameter", "expected_revision must be a whole number.");
    await send(context, key.id, request, "record.update", {
      recordId: existing.id, expectedRevision: body.expected_revision ?? existing.revision, values: out.values,
      ...(body.status !== undefined ? { status: out.status } : {}), ...(out.links.length ? { links: out.links } : {}), title: out.title ?? "",
    });
    const record = await loadRecord(context, definition, object.id, existing.id, { workspace: workspaceStore, venueId });
    return { body: recordJson(definition, object, record) };
  },

  async remove({ definition, context, params, request, key }) {
    const object = listOf(definition, params.list);
    const id = String(params.recordId ?? "").toLowerCase();
    const existing = UUID.test(id) ? await workspaceStore.record(context, id) : null;
    if (!existing || existing.deletedAt || existing.objectId !== object.id) fail(404, "not_found", "No record with that id on this list.");
    await send(context, key.id, request, "records.delete", { recordIds: [existing.id] });
    return { body: { object: "workspace_record", id: existing.id, deleted: true } };
  },
};
