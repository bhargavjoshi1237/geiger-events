import { randomUUID } from "node:crypto";
import { isObject, LIMITS, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { attachLinks, searchRecordTargets } from "../links/resolve.js";
import { compileQuery } from "../records/query.js";
import { labelLookups } from "../records/lookups.js";
import { computeFormulaValues, normaliseRecordInput, titleFor } from "../records/values.js";
import { liveFields, validateFieldInput, validateObjectInput } from "../schema/definition.js";
import { analyseFieldChange, analyseFieldDelete, analyseObjectDelete } from "../schema/impact.js";
import { getType } from "../schema/types/index.js";
import { acceptsType } from "../schema/types/links.js";
import { allowedMoves, checkMove, cleanProcess, moveError } from "../process/stages.js";
import { processStore } from "../process/store.js";
import { WORKSPACE_KEYS } from "./route.js";
import { commandSender } from "./send.js";
import { workspaceStore } from "./store.js";

const RECORD_CREATE = new Set(["record.create", "records.import"]);
const RECORD_UPDATE = new Set(["record.update", "records.bulk", "comment.add"]);
const RECORD_DELETE = new Set(["records.delete", "records.restore"]);
const STRUCTURE = new Set(["workspace.create", "workspace.delete", "object.create", "object.update", "object.delete", "object.restore",
  "object.reorder", "field.create", "field.update", "field.delete", "field.restore", "field.reorder", "change.undo"]);

// Mirrors the permission events.workspace_command checks, so the route can refuse before any work.
export function permissionFor(body) {
  const action = body?.action;
  if (RECORD_CREATE.has(action)) return WORKSPACE_KEYS.create;
  if (RECORD_UPDATE.has(action)) return WORKSPACE_KEYS.update;
  if (RECORD_DELETE.has(action)) return WORKSPACE_KEYS.delete;
  if (STRUCTURE.has(action)) return WORKSPACE_KEYS.configure;
  if (action === "view.save" || action === "view.delete") return WORKSPACE_KEYS.view;
  throw new WorkspaceError("invalid_input", 400, "Unknown action.");
}

const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const ids = (value, max = 500) => {
  if (!Array.isArray(value) || !value.length || value.length > max || value.some((id) => !UUID.test(id ?? ""))) bad("Choose records.");
  return [...new Set(value.map((id) => id.toLowerCase()))];
};
const findObject = (definition, objectId, { live = true } = {}) => {
  const object = definition.objects.find((item) => item.id === objectId && (!live || !item.deletedAt));
  if (!object) throw new WorkspaceError("not_found", 404, "That list no longer exists.");
  return object;
};
const findField = (definition, fieldId) => {
  const field = definition.fields.find((item) => item.id === fieldId);
  if (!field) throw new WorkspaceError("not_found", 404, "That field no longer exists.");
  return field;
};

export function createWorkspaceService(store = workspaceStore, processes = processStore) {
  const send = commandSender(store);

  // A list's stage rules (none when the process tables aren't there yet).
  async function processOf(context, definition, objectId) {
    const config = await processes.process(context, objectId).catch(() => null);
    return config?.enforce ? cleanProcess(definition, objectId, config) : null;
  }

  // Refuses status moves the stage rules don't allow; staff who can configure may resend with force.
  function guardMove(context, definition, process, objectId, move, force) {
    if (!process) return;
    const object = findObject(definition, objectId);
    const problem = checkMove(process, object, { ...move, fields: liveFields(definition, objectId) });
    if (!problem || (force === true && context.allowed?.[WORKSPACE_KEYS.configure])) return;
    throw moveError(problem);
  }

  const mergedValues = (before, changed) => {
    const merged = { ...(before ?? {}) };
    for (const [id, value] of Object.entries(changed)) {
      if (value === null) delete merged[id]; else merged[id] = value;
    }
    return merged;
  };

  // Refuses structure changes that would lock everyone out of a switched-on portal.
  async function guardPortal(context, { objectId, fieldId, unique }) {
    const portal = store.portalSettings ? await store.portalSettings(context) : null;
    if (!portal?.enabled) return;
    if (objectId && objectId === portal.peopleObjectId) {
      throw new WorkspaceError("blocked", 409, "This list is the portal's people list. Choose another people list or turn the portal off first.");
    }
    if (fieldId && fieldId === portal.emailFieldId && unique !== true) {
      throw new WorkspaceError("blocked", 409, "The portal signs people in with this email field, so it must stay and stay unique. Turn the portal off first.");
    }
  }

  async function timeZoneOf(context) {
    return (await store.event(context))?.timezone || "UTC";
  }

  // Re-evaluates formulas and titles for every record of an object after a structural change.
  async function recomputeObject(context, objectId) {
    const definition = await store.definition(context);
    const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
    if (!object) return 0;
    const fields = liveFields(definition, objectId);
    const timeZone = await timeZoneOf(context);
    let changed = 0;
    for await (const page of store.recordPages(context, objectId)) {
      const updates = [];
      for (const record of page) {
        const formulas = computeFormulaValues(fields, record.values, { timeZone });
        const values = {};
        const merged = { ...record.values };
        for (const [fieldId, value] of Object.entries(formulas)) {
          if (!sameJson(record.values[fieldId], value)) values[fieldId] = value;
          if (value === null) delete merged[fieldId]; else merged[fieldId] = value;
        }
        const title = titleFor(object, fields, merged);
        const fallback = `${object.numberPrefix}-${record.number}`;
        if (Object.keys(values).length || (title ?? fallback) !== record.title) {
          updates.push({ recordId: record.id, values, title: title ?? "" });
        }
      }
      if (updates.length) {
        await send(context, "records.recompute", { objectId, updates });
        changed += updates.length;
      }
    }
    return changed;
  }

  async function fieldValues(context, field) {
    const values = [];
    for await (const page of store.recordPages(context, field.objectId)) {
      for (const record of page) values.push({ recordId: record.id, value: record.values[field.id] ?? null });
    }
    return values;
  }

  const handlers = {
    async "workspace.create"(context, body) {
      const createdFrom = isObject(body.createdFrom) ? body.createdFrom : { kind: "empty" };
      return { result: await send(context, "workspace.create", { createdFrom }, body.commandId) };
    },

    async "workspace.delete"(context, body) {
      const paths = await store.filePaths(context);
      const result = await send(context, "workspace.delete", {}, body.commandId);
      if (paths.length) await store.removeFiles(paths).catch(() => {});
      return { result };
    },

    async "object.create"(context, body, definition) {
      const object = validateObjectInput(body.object ?? {}, { definition });
      const id = randomUUID();
      const working = { objects: [...definition.objects, { ...object, id, deletedAt: null }], fields: [...definition.fields] };
      const input = Array.isArray(body.fields) && body.fields.length ? body.fields : [{ name: "Name", type: "short_text" }];
      if (input.length > LIMITS.fields) bad(`A list can have up to ${LIMITS.fields} fields.`);
      const fields = input.map((raw) => {
        const field = { ...validateFieldInput(raw, { definition: working, objectId: id }), id: randomUUID(), objectId: id, deletedAt: null };
        working.fields.push(field);
        return field;
      });
      const title = fields.find((field) => field.key === body.titleFieldKey) ?? fields.find((field) => getType(field.type).titleable);
      const result = await send(context, "object.create", {
        object: { ...object, id }, fields,
        ...(title ? { titleFieldKey: title.key } : {}),
      }, body.commandId);
      return { result };
    },

    async "object.update"(context, body, definition) {
      const current = findObject(definition, body.objectId);
      if (!isObject(body.patch)) bad("Nothing to change.");
      const next = validateObjectInput({ ...current, ...body.patch }, { definition, objectId: current.id });
      const patch = {};
      for (const key of ["name", "plural", "icon", "numberPrefix", "statuses", "titleFieldId"]) {
        if (key in body.patch && !sameJson(next[key], current[key])) patch[key] = next[key];
      }
      if (!Object.keys(patch).length) return { result: { object: current, unchanged: true } };
      const result = await send(context, "object.update", { objectId: current.id, expectedRevision: body.expectedRevision ?? current.revision, patch }, body.commandId);
      const after = "titleFieldId" in patch || "numberPrefix" in patch ? [() => recomputeObject(context, current.id)] : [];
      return { result, after };
    },

    async "object.delete"(context, body, definition) {
      const object = findObject(definition, body.objectId);
      const { blocked } = analyseObjectDelete(object, definition);
      if (blocked) throw new WorkspaceError("blocked", 409, blocked);
      await guardPortal(context, { objectId: object.id });
      return { result: await send(context, "object.delete", { objectId: object.id }, body.commandId) };
    },

    async "object.restore"(context, body, definition) {
      const object = findObject(definition, body.objectId, { live: false });
      return { result: await send(context, "object.restore", { objectId: object.id }, body.commandId) };
    },

    async "object.reorder"(context, body) {
      return { result: await send(context, "object.reorder", { order: ids(body.order, LIMITS.objects) }, body.commandId) };
    },

    async "field.create"(context, body, definition) {
      const object = findObject(definition, body.objectId);
      const field = validateFieldInput(body.field ?? {}, { definition, objectId: object.id });
      const result = await send(context, "field.create", { objectId: object.id, field: { ...field, id: randomUUID() } }, body.commandId);
      return { result, after: field.type === "formula" ? [() => recomputeObject(context, object.id)] : [] };
    },

    async "field.update"(context, body, definition) {
      const field = findField(definition, body.fieldId);
      if (field.deletedAt) throw new WorkspaceError("not_found", 404, "That field is in the trash.");
      if (!isObject(body.patch)) bad("Nothing to change.");
      const next = validateFieldInput({ ...body.patch }, { definition, objectId: field.objectId, fieldId: field.id });
      const patch = {};
      for (const key of ["name", "type", "config", "required", "isUnique"]) {
        if (!sameJson(next[key], field[key])) patch[key] = next[key];
      }
      if (!Object.keys(patch).length) return { result: { field, unchanged: true } };
      if ("isUnique" in patch || "type" in patch) await guardPortal(context, { fieldId: field.id, unique: next.isUnique && ["email", "short_text"].includes(next.type) });
      let conversions = [];
      const type = getType(field.type);
      if (("type" in patch || "config" in patch) && type.stored && type.editable) {
        const impact = analyseFieldChange(field, { type: next.type, config: next.config }, await fieldValues(context, field));
        if (impact.destructive && body.confirm !== true) {
          throw new WorkspaceError("confirm_required", 409, `${impact.clears} value${impact.clears === 1 ? "" : "s"} can't be kept and will be cleared.`, {
            impact: { converts: impact.converts, clears: impact.clears, examples: impact.examples },
          });
        }
        conversions = impact.conversions;
      }
      const result = await send(context, "field.update", {
        fieldId: field.id, expectedRevision: body.expectedRevision ?? field.revision, patch, conversions,
      }, body.commandId);
      return { result, after: [() => recomputeObject(context, field.objectId)] };
    },

    async "field.delete"(context, body, definition) {
      const field = findField(definition, body.fieldId);
      const { blocked } = analyseFieldDelete(field, definition);
      if (blocked) throw new WorkspaceError("blocked", 409, blocked);
      await guardPortal(context, { fieldId: field.id });
      const result = await send(context, "field.delete", { fieldId: field.id }, body.commandId);
      return { result, after: [() => recomputeObject(context, field.objectId)] };
    },

    async "field.restore"(context, body, definition) {
      const field = findField(definition, body.fieldId);
      const result = await send(context, "field.restore", { fieldId: field.id }, body.commandId);
      return { result, after: [() => recomputeObject(context, field.objectId)] };
    },

    async "field.reorder"(context, body, definition) {
      const object = findObject(definition, body.objectId);
      return { result: await send(context, "field.reorder", { objectId: object.id, order: ids(body.order, LIMITS.fields) }, body.commandId) };
    },

    async "record.create"(context, body, definition) {
      const object = findObject(definition, body.objectId);
      const process = await processOf(context, definition, object.id);
      const status = body.status === undefined && process ? allowedMoves(process, object, null)[0] : body.status;
      const out = normaliseRecordInput(definition, object.id, { values: body.values ?? {}, status }, null, { timeZone: await timeZoneOf(context) });
      guardMove(context, definition, process, object.id, { creating: true, to: out.status, values: out.values }, body.force);
      return { result: await send(context, "record.create", {
        objectId: object.id, values: out.values, status: out.status, links: out.links, title: out.title ?? "",
      }, body.commandId) };
    },

    async "record.update"(context, body, definition) {
      if (!UUID.test(body.recordId ?? "")) bad("Choose a record.");
      const existing = await store.record(context, body.recordId);
      if (!existing || existing.deletedAt) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      const input = { values: body.values ?? {}, ...(body.status !== undefined ? { status: body.status } : {}) };
      const out = normaliseRecordInput(definition, existing.objectId, input, existing, { timeZone: await timeZoneOf(context) });
      if (body.status !== undefined && out.status !== existing.status) {
        guardMove(context, definition, await processOf(context, definition, existing.objectId), existing.objectId,
          { from: existing.status, to: out.status, values: mergedValues(existing.values, out.values) }, body.force);
      }
      return { result: await send(context, "record.update", {
        recordId: existing.id, expectedRevision: body.expectedRevision ?? existing.revision, values: out.values,
        ...(body.status !== undefined ? { status: out.status } : {}),
        ...(out.links.length ? { links: out.links } : {}),
        title: out.title ?? "",
      }, body.commandId) };
    },

    async "records.bulk"(context, body, definition) {
      const records = await store.records(context, ids(body.recordIds));
      if (!records.length) throw new WorkspaceError("not_found", 404, "Those records no longer exist.");
      const objectId = records[0].objectId;
      if (records.some((record) => record.objectId !== objectId || record.deletedAt)) bad("Choose records from one list.");
      const timeZone = await timeZoneOf(context);
      const input = { values: body.values ?? {}, ...(body.status !== undefined ? { status: body.status } : {}) };
      const process = body.status !== undefined ? await processOf(context, definition, objectId) : null;
      const updates = records.map((record) => {
        const out = normaliseRecordInput(definition, objectId, input, record, { timeZone });
        if (body.status !== undefined && out.status !== record.status) {
          try {
            guardMove(context, definition, process, objectId, { from: record.status, to: out.status, values: mergedValues(record.values, out.values) }, body.force);
          } catch (error) {
            const label = record.title || `#${record.number}`;
            throw new WorkspaceError(error.code, error.status, `${label}: ${error.message}`, error.fields);
          }
        }
        return {
          recordId: record.id, values: out.values, title: out.title ?? "",
          ...(body.status !== undefined ? { status: out.status } : {}),
          ...(out.links.length ? { links: out.links } : {}),
        };
      });
      return { result: await send(context, "records.bulk", { updates }, body.commandId) };
    },

    async "records.delete"(context, body) {
      return { result: await send(context, "records.delete", { recordIds: ids(body.recordIds) }, body.commandId) };
    },

    async "records.restore"(context, body) {
      return { result: await send(context, "records.restore", { recordIds: ids(body.recordIds) }, body.commandId) };
    },

    async "comment.add"(context, body) {
      if (!UUID.test(body.recordId ?? "")) bad("Choose a record.");
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text || text.length > 5000) bad("Comments must be 1–5,000 characters.");
      return { result: await send(context, "comment.add", { recordId: body.recordId, body: text }, body.commandId) };
    },

    async "view.save"(context, body, definition) {
      const object = findObject(definition, body.objectId);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (body.viewId === undefined && (!name || name.length > 60)) bad("Name the view (up to 60 characters).");
      const config = validateViewConfig(definition, object.id, body.config ?? {});
      return { result: await send(context, "view.save", {
        objectId: object.id, ...(body.viewId ? { viewId: body.viewId } : {}),
        ...(name ? { name } : {}), ...(typeof body.shared === "boolean" ? { shared: body.shared } : {}), config,
      }, body.commandId) };
    },

    async "view.delete"(context, body) {
      if (!UUID.test(body.viewId ?? "")) bad("Choose a view.");
      return { result: await send(context, "view.delete", { viewId: body.viewId }, body.commandId) };
    },

    async "change.undo"(context, body) {
      if (!UUID.test(body.changeId ?? "")) bad("Choose a change.");
      const result = await send(context, "change.undo", { changeId: body.changeId }, body.commandId);
      return { result, after: (body.objectId && UUID.test(body.objectId)) ? [() => recomputeObject(context, body.objectId)] : [] };
    },
  };

  function validateViewConfig(definition, objectId, config) {
    if (!isObject(config)) bad("Invalid view.");
    const kind = config.kind ?? "table";
    if (!["table", "board"].includes(kind)) bad("Choose a table or board view.");
    const fieldIds = new Set(liveFields(definition, objectId).map((field) => field.id));
    const columns = Array.isArray(config.columns) ? config.columns.slice(0, 200).filter((column) => isObject(column) && fieldIds.has(column.fieldId))
      .map((column) => ({ fieldId: column.fieldId, ...(column.hidden ? { hidden: true } : {}),
        ...(Number.isInteger(column.width) && column.width >= 60 && column.width <= 800 ? { width: column.width } : {}) })) : [];
    compileQuery(definition, objectId, { filter: config.filter ?? undefined, sort: config.sort ?? undefined, limit: 1 });
    const groupBy = config.groupBy === "status" || fieldIds.has(config.groupBy) ? config.groupBy : null;
    return { kind, columns, ...(config.filter ? { filter: config.filter } : {}), ...(config.sort ? { sort: config.sort } : {}), ...(groupBy ? { groupBy } : {}) };
  }

  return {
    async getDefinition(context) {
      const [definition, event] = await Promise.all([store.definition(context), store.event(context)]);
      return { ...definition, event: event ? { id: event.id, name: event.name, timeZone: event.timezone || "UTC" } : null };
    },

    async runCommand(context, body) {
      if (!isObject(body) || typeof body.action !== "string" || !Object.hasOwn(handlers, body.action)) bad("Unknown action.");
      if (body.commandId !== undefined && !UUID.test(body.commandId)) bad("Invalid request.");
      const definition = body.action === "workspace.create" ? null : await store.definition(context);
      if (definition && !definition.workspace) throw new WorkspaceError("not_found", 404, "Set up the workspace for this event first.");
      return handlers[body.action](context, body, definition);
    },

    recomputeObject,

    async queryRecords(context, body) {
      const definition = await store.definition(context);
      const objectId = typeof body?.objectId === "string" ? body.objectId : "";
      const plan = compileQuery(definition, objectId, body?.spec ?? {});
      const page = await store.query(context, plan);
      const event = await store.event(context);
      const rows = await attachLinks(store, context, definition, labelLookups(definition, objectId, page.rows.map((row) => ({
        ...row, number: Number(row.number), revision: Number(row.revision),
      }))), { venueId: event?.venue_id });
      return { rows, total: Number(page.total) };
    },

    async getRecord(context, recordId) {
      const [definition, record, event] = await Promise.all([store.definition(context), store.record(context, recordId), store.event(context)]);
      if (!record) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      // Lookups and rollups are calculated at read time, so fetch this one record through the query path too.
      let computed = {};
      const object = definition.objects.find((item) => item.id === record.objectId && !item.deletedAt);
      if (object && !record.deletedAt && liveFields(definition, object.id).some((field) => field.type === "lookup" || field.type === "rollup")) {
        const plan = compileQuery(definition, object.id, { filter: { op: "and", items: [{ field: "number", operator: "eq", value: record.number }] }, limit: 1 });
        const [row] = labelLookups(definition, object.id, (await store.query(context, plan)).rows);
        computed = row?.computed ?? {};
      }
      const [withLinks] = await attachLinks(store, context, definition, [{ ...record, computed }], { venueId: event?.venue_id });
      const back = await store.backlinks(context, recordId);
      const sources = new Map((await store.recordLabels(context, [...new Set(back.map((row) => row.source_record_id))]))
        .filter((row) => !row.deleted_at).map((row) => [row.id, row]));
      const groups = new Map();
      for (const row of back) {
        const source = sources.get(row.source_record_id);
        const field = definition.fields.find((item) => item.id === row.field_id && !item.deletedAt);
        const object = field && definition.objects.find((item) => item.id === field.objectId && !item.deletedAt);
        if (!source || !object) continue;
        const key = field.id;
        if (!groups.has(key)) groups.set(key, { fieldId: field.id, fieldName: field.name, objectId: object.id, objectName: object.plural, records: [] });
        groups.get(key).records.push({ id: source.id, label: source.title || `${object.numberPrefix}-${source.number}` });
      }
      const [changes, comments] = await Promise.all([store.changes(context, { recordId, limit: 50 }), store.comments(context, recordId)]);
      const names = await nameMap(context, [...changes.map((row) => row.actor_id), ...comments.map((row) => row.created_by)],
        [...changes, ...comments].filter((row) => row.actor_kind === "automation" || row.actor_kind === "api").map((row) => row.actor_id ?? row.created_by));
      return {
        record: withLinks,
        backlinks: [...groups.values()],
        activity: changes.map((row) => ({ id: row.id, action: row.action, actor: names.get(row.actor_id) ?? "Someone", before: row.before, after: row.after, at: row.created_at, undone: Boolean(row.undone_at) })),
        comments: comments.map((row) => ({ id: row.id, body: row.body, author: names.get(row.created_by) ?? "Someone", at: row.created_at })),
      };
    },

    async lookup(context, { kind, objectId, q }) {
      const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
      if (kind === "record") {
        if (!UUID.test(objectId ?? "")) bad("Choose a list.");
        return searchRecordTargets(store, context, await store.definition(context), objectId, query);
      }
      const event = await store.event(context);
      return (await store.eventData(context, kind, { q: query, venueId: event?.venue_id })).map((row) => ({ kind, ...row }));
    },

    async listChanges(context, { kind, before } = {}) {
      const rows = await store.changes(context, { kind: ["record", "structure"].includes(kind) ? kind : undefined, before, limit: 50 });
      const names = await nameMap(context, rows.map((row) => row.actor_id), rows.filter((row) => row.actor_kind === "automation" || row.actor_kind === "api").map((row) => row.actor_id));
      return rows.map((row) => ({
        id: row.id, kind: row.kind, action: row.action, objectId: row.object_id, fieldId: row.field_id, recordId: row.record_id,
        actor: names.get(row.actor_id) ?? "Someone", before: row.before, after: row.after, at: row.created_at,
        undone: Boolean(row.undone_at), undoOf: row.undo_of,
      }));
    },

    async trash(context) {
      const definition = await store.definition(context);
      const records = await store.trashedRecords(context);
      return {
        objects: definition.objects.filter((object) => object.deletedAt),
        fields: definition.fields.filter((field) => field.deletedAt && definition.objects.some((object) => object.id === field.objectId && !object.deletedAt)),
        records: records.map((row) => ({ id: row.id, objectId: row.object_id, label: row.title, number: Number(row.number), deletedAt: row.deleted_at })),
      };
    },

    async signUpload(context, { fieldId, name, size, type }) {
      const definition = await store.definition(context);
      const field = definition.fields.find((item) => item.id === fieldId && !item.deletedAt && item.type === "attachments");
      if (!field) bad("Choose a file field.");
      const fileName = typeof name === "string" ? name.trim().replace(/[\\/]/g, "_").slice(0, 255) : "";
      const mime = typeof type === "string" && /^[a-z]+\/[a-z0-9.+-]+$/i.test(type) ? type.toLowerCase() : "application/octet-stream";
      if (!fileName) bad("Name the file.");
      if (!Number.isInteger(size) || size < 0) bad("The file size isn't valid.");
      if (size > (field.config.maxBytes ?? LIMITS.fileBytes)) bad(`${fileName} is too large.`);
      if (!acceptsType(field.config.accept, mime)) bad(`${fileName} isn't an allowed file type.`);
      const id = randomUUID();
      const path = `${context.projectId}/${context.eventId}/${field.id}/${id}/${fileName.replace(/[^\w.-]+/g, "_")}`;
      const row = await store.addFile({ id, project_id: context.projectId, event_id: context.eventId, field_id: field.id,
        path, name: fileName, type: mime, size, created_by: context.principal.id });
      const signed = await store.signUpload(path);
      return { file: { id: row.id, name: row.name, size: Number(row.size), type: row.type }, uploadUrl: signed.signedUrl, token: signed.token, path };
    },

    async signDownload(context, fileId) {
      if (!UUID.test(fileId ?? "")) bad("Choose a file.");
      const file = await store.file(context, fileId);
      if (!file) throw new WorkspaceError("not_found", 404, "That file no longer exists.");
      return { url: (await store.signDownload(file.path, file.name)).signedUrl };
    },
  };

  // Staff names, plus automations and approvals (system actors) by their own names.
  async function nameMap(context, userIds, systemIds = []) {
    const [people, system] = await Promise.all([
      store.people(context, [...new Set(userIds.filter(Boolean))]),
      systemIds.length ? processes.automationNames([...new Set(systemIds.filter(Boolean))]).catch(() => new Map()) : new Map(),
    ]);
    return new Map([...people.map((row) => [row.user_id, row.name || row.email]), ...system]);
  }
}

export const workspaceService = createWorkspaceService();
