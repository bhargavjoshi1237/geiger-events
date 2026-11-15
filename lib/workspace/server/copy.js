import { randomUUID } from "node:crypto";
import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { buildSnapshot, planCopy, remapRecord, resolveConfig, resolveViewConfig } from "../carryover/snapshot.js";
import { compileQuery } from "../records/query.js";
import { computeFormulaValues, titleFor } from "../records/values.js";
import { liveFields, liveObjects, validateFieldInput, validateObjectInput } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { commandSender, stableId } from "./send.js";
import { workspaceStore } from "./store.js";

const PAGE = 200;
const STRUCTURE_ORDER = { link_record: 1, formula: 2, lookup: 3, rollup: 3 };
const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };

// `extras` carries stage rules, automations, review setups, documents and the portal draft: { collect, install, sentence }.
export function createCopyService({ store = workspaceStore, recomputeObject, extras = null } = {}) {
  const send = commandSender(store);

  async function sourceSnapshot(context, { sourceContext, templateId, choices }) {
    if (templateId) {
      if (!UUID.test(templateId)) bad("Choose a template.");
      const template = await store.template(context.projectId, templateId);
      if (!template) throw new WorkspaceError("not_found", 404, "That template no longer exists.");
      return { snapshot: { ...template.snapshot, objects: template.snapshot.objects.map((object) => ({ ...object, mode: "structure", viewId: null })) }, label: template.name };
    }
    const definition = await store.definition(sourceContext);
    if (!definition.workspace) throw new WorkspaceError("not_found", 404, "That event has no workspace.");
    const event = await store.event(sourceContext);
    const snapshot = buildSnapshot(definition, choices, { views: definition.views });
    if (extras && choices?.extras !== false && snapshot.objects.length) {
      snapshot.extras = await extras.collect(sourceContext, definition, snapshot.objects.map((object) => object.sourceId));
    }
    return { snapshot, definition, label: event?.name ?? "another event" };
  }

  async function counts(sourceContext, snapshot, definition) {
    const recordCounts = {};
    const linkCounts = {};
    for (const object of snapshot.objects.filter((item) => item.mode === "records")) {
      const view = definition.views.find((item) => item.id === object.viewId);
      const plan = compileQuery(definition, object.sourceId, { filter: view?.config.filter, limit: 1 });
      const page = await store.query(sourceContext, plan);
      recordCounts[object.sourceId] = Number(page.total);
      for (const field of object.fields.filter((item) => item.type === "link_event")) {
        const linked = compileQuery(definition, object.sourceId, { filter: { op: "and", items: [{ field: field.sourceId, operator: "is_not_empty" }] }, limit: 1 });
        linkCounts[field.sourceId] = Number((await store.query(sourceContext, linked)).total);
      }
    }
    return { recordCounts, linkCounts };
  }

  // Creates the lists, fields and shared views of a plan; returns maps from source ids to the new ids.
  async function applyStructure(context, plan) {
    let target = await store.definition(context);
    const objectIds = new Map(liveObjects(target).map((object) => [object.key, object.id]));
    const fieldIds = new Map(target.fields.filter((field) => !field.deletedAt)
      .map((field) => [`${target.objects.find((object) => object.id === field.objectId)?.key}:${field.key}`, field.id]));
    const fieldMap = new Map();
    const objectMap = new Map();
    const refresh = async () => { target = await store.definition(context); };

    for (const object of plan.objects.filter((item) => !item.targetObjectId)) {
      const id = randomUUID();
      const validated = validateObjectInput({ name: object.name, plural: object.plural, icon: object.icon, numberPrefix: object.numberPrefix, statuses: object.statuses }, { definition: target });
      const key = target.objects.some((item) => item.key === object.key) ? validated.key : object.key;
      const simple = object.fields.filter((field) => !STRUCTURE_ORDER[field.type]);
      const working = { objects: [...target.objects, { ...validated, key, id, deletedAt: null }], fields: [...target.fields] };
      const fields = simple.map((field) => {
        const input = validateFieldInput({ name: field.name, type: field.type, config: field.config, required: field.required, isUnique: field.isUnique },
          { definition: working, objectId: id });
        const created = { ...input, key: field.key, id: randomUUID(), objectId: id, deletedAt: null };
        working.fields.push(created);
        return created;
      });
      await send(context, "object.create", {
        object: { ...validated, key, id }, fields,
        ...(simple.some((field) => field.key === object.titleFieldKey) ? { titleFieldKey: object.titleFieldKey } : {}),
      });
      objectIds.set(object.key, id);
      for (const field of fields) fieldIds.set(`${object.key}:${field.key}`, field.id);
      await refresh();
    }

    for (const object of plan.objects) {
      const objectId = objectIds.get(object.key);
      objectMap.set(object.sourceId, objectId);
      const pending = object.fields.filter((field) => !fieldIds.has(`${object.key}:${field.key}`))
        .sort((a, b) => (STRUCTURE_ORDER[a.type] ?? 0) - (STRUCTURE_ORDER[b.type] ?? 0));
      for (const field of pending) {
        const config = resolveConfig(field, object, { objectIds, fieldIds });
        let input;
        try {
          input = validateFieldInput({ name: field.name, type: field.type, config, required: field.required, isUnique: field.isUnique }, { definition: target, objectId });
        } catch {
          continue;
        }
        const id = randomUUID();
        await send(context, "field.create", { objectId, field: { ...input, id } });
        fieldIds.set(`${object.key}:${field.key}`, id);
        await refresh();
      }
      for (const field of object.fields) {
        const id = fieldIds.get(`${object.key}:${field.key}`);
        if (id) fieldMap.set(field.sourceId, id);
      }
      for (const view of object.views ?? []) {
        await send(context, "view.save", { objectId, name: view.name, shared: true, config: resolveViewConfig(view.config, object, fieldIds) }).catch(() => {});
      }
    }
    return { objectMap: Object.fromEntries(objectMap), fieldMap: Object.fromEntries(fieldMap), objectIds, fieldIds };
  }

  async function copyFiles(context, job, sourceFiles) {
    const out = new Map();
    for (const file of sourceFiles) {
      const source = await store.file({ projectId: context.projectId, eventId: job.source.eventId }, file.id);
      if (!source) continue;
      const id = stableId(job.id, "file", file.id);
      const path = `${context.projectId}/${context.eventId}/copied/${id}/${source.name.replace(/[^\w.-]+/g, "_")}`;
      try {
        await store.copyFile(source.path, path);
      } catch (error) {
        if (!/exists/i.test(error?.message ?? "")) throw error;
      }
      try {
        await store.addFile({ id, project_id: context.projectId, event_id: context.eventId, field_id: job.plan.fieldMap?.[file.fieldId] ?? source.field_id,
          path, name: source.name, type: source.type, size: source.size, created_by: job.created_by });
      } catch (error) {
        if (error?.code !== "23505") throw error;
      }
      out.set(file.id, { id, name: source.name, size: Number(source.size), type: source.type });
    }
    return out;
  }

  // Copies one page of records (or of links), then saves where it got to; safe to repeat.
  async function advanceOnce(context, job) {
    const sourceContext = { ...context, eventId: job.source.eventId };
    const [sourceDef, target] = await Promise.all([store.definition(sourceContext), store.definition(context)]);
    const objects = job.plan.objects;
    const cursor = { phase: "records", index: 0, offset: 0, ...job.cursor };
    if (cursor.index >= objects.length) {
      if (cursor.phase === "records") return store.updateJob(job.id, { cursor: { phase: "links", index: 0, offset: 0 } });
      for (const object of objects) await recomputeObject(context, object.targetObjectId);
      return store.updateJob(job.id, { status: "done", progress: { ...job.progress, finishedAt: new Date().toISOString() } });
    }
    const object = objects[cursor.index];
    const view = sourceDef.views.find((item) => item.id === object.viewId);
    const plan = compileQuery(sourceDef, object.sourceObjectId, { filter: view?.config.filter, limit: PAGE, offset: cursor.offset });
    const page = await store.query(sourceContext, plan);
    const rows = page.rows;
    const links = await store.links(sourceContext, rows.map((row) => row.id));
    const linksOf = new Map();
    for (const link of links) {
      const entry = linksOf.get(link.source_record_id) ?? {};
      (entry[link.field_id] ??= []).push({ kind: link.target_kind, id: link.target_id });
      linksOf.set(link.source_record_id, entry);
    }
    const sourceObject = { fields: object.fields };
    const fieldMap = new Map(Object.entries(job.plan.fieldMap));
    const targetObject = target.objects.find((item) => item.id === object.targetObjectId && !item.deletedAt);
    if (!targetObject) throw new WorkspaceError("not_found", 404, "A list being copied into was removed.");
    const targetFields = liveFields(target, targetObject.id);

    if (cursor.phase === "records") {
      const files = job.plan.attachments ? rows.flatMap((row) => object.fields.filter((field) => field.type === "attachments")
        .flatMap((field) => (row.values[field.sourceId] ?? []).map((file) => ({ id: file.id, fieldId: field.sourceId })))) : [];
      const fileMap = job.plan.attachments ? await copyFiles(context, job, files) : null;
      const statusKeys = new Set((targetObject.statuses ?? []).map((status) => status.key));
      const importRows = rows.map((row) => {
        const { values: raw, links: eventLinks } = remapRecord({ ...row, links: linksOf.get(row.id) }, sourceObject, { fieldMap, fileMap });
        const values = {};
        for (const [fieldId, value] of Object.entries(raw)) {
          const field = targetFields.find((item) => item.id === fieldId);
          try { const next = getType(field.type).normalise(value, field.config); if (next !== null) values[fieldId] = next; } catch { /* values that don't fit the target field are left out */ }
        }
        Object.assign(values, Object.fromEntries(Object.entries(computeFormulaValues(targetFields, values)).filter(([, value]) => value !== null)));
        return {
          id: stableId(job.id, "record", row.id), values, links: eventLinks,
          status: statusKeys.has(row.status) ? row.status : null,
          title: titleFor(targetObject, targetFields, values) ?? "",
          note: `Copied from ${job.source.label}`,
        };
      });
      if (importRows.length) await send(context, "records.import", { objectId: targetObject.id, rows: importRows }, stableId(job.id, "batch", cursor.index, cursor.offset));
      const done = rows.length < PAGE;
      return store.updateJob(job.id, {
        cursor: done ? { phase: "records", index: cursor.index + 1, offset: 0 } : { ...cursor, offset: cursor.offset + rows.length },
        progress: { ...job.progress, copied: (job.progress?.copied ?? 0) + importRows.length },
      });
    }

    const linkFields = object.fields.filter((field) => field.type === "link_record" && fieldMap.get(field.sourceId));
    if (linkFields.length) {
      const copiedIds = new Set();
      const updates = [];
      for (const row of rows) {
        const own = linksOf.get(row.id) ?? {};
        const fieldLinks = linkFields.map((field) => ({
          fieldId: fieldMap.get(field.sourceId),
          targets: (own[field.sourceId] ?? []).map((link) => ({ kind: "record", id: stableId(job.id, "record", link.id), source: link.id })),
        })).filter((entry) => entry.targets.length);
        if (fieldLinks.length) updates.push({ recordId: stableId(job.id, "record", row.id), fieldLinks });
        for (const entry of fieldLinks) for (const t of entry.targets) copiedIds.add(t.id);
      }
      const existing = new Set((await store.records(context, [...copiedIds])).filter((record) => !record.deletedAt).map((record) => record.id));
      const payload = updates.map((update) => ({ recordId: update.recordId, links: update.fieldLinks.map((entry) => ({
        fieldId: entry.fieldId, targets: entry.targets.filter((t) => existing.has(t.id)).map(({ kind, id }) => ({ kind, id })),
      })) }));
      if (payload.length) await send(context, "records.recompute", { objectId: targetObject.id, updates: payload });
    }
    const done = rows.length < PAGE;
    return store.updateJob(job.id, { cursor: done ? { phase: "links", index: cursor.index + 1, offset: 0 } : { ...cursor, offset: cursor.offset + rows.length } });
  }

  return {
    async sources(context) {
      return (await store.projectEventsWithWorkspace(context)).map((row) => ({ id: row.id, name: row.name, date: row.event_date }));
    },

    async sourceDefinition(sourceContext) {
      const definition = await store.definition(sourceContext);
      if (!definition.workspace) throw new WorkspaceError("not_found", 404, "That event has no workspace.");
      return definition;
    },

    async plan(context, { sourceContext, templateId, choices }) {
      const { snapshot, definition } = await sourceSnapshot(context, { sourceContext, templateId, choices });
      if (!snapshot.objects.length) bad("Choose at least one list to copy.");
      const extra = definition ? await counts(sourceContext, snapshot, definition) : {};
      const target = await store.definition(context);
      const { sentences } = planCopy(snapshot, target.workspace ? target : { objects: [], fields: [] }, extra);
      const carried = extras?.sentence(snapshot.extras);
      return { sentences: carried ? [...sentences, carried] : sentences, lists: snapshot.objects.map((object) => ({ name: object.plural, mode: object.mode })) };
    },

    // Creates the structure now; records copy in a resumable job that advance() moves forward one page at a time.
    async start(context, { sourceContext, templateId, choices }) {
      const { snapshot, label } = await sourceSnapshot(context, { sourceContext, templateId, choices });
      if (!snapshot.objects.length) bad("Choose at least one list to copy.");
      let target = await store.definition(context);
      if (!target.workspace) {
        await send(context, "workspace.create", { createdFrom: templateId ? { kind: "template", id: templateId } : { kind: "event", id: sourceContext.eventId } });
        target = await store.definition(context);
      }
      const plan = planCopy(snapshot, target);
      const { objectMap, fieldMap, objectIds, fieldIds } = await applyStructure(context, plan);
      const carried = extras && snapshot.extras ? await extras.install(context, snapshot.extras, { objectIds, fieldIds }) : null;
      const withRecords = plan.objects.filter((object) => object.mode === "records");
      if (!withRecords.length) return { job: null, carried };
      const job = await store.createJob({
        project_id: context.projectId, event_id: context.eventId, created_by: context.principal.id,
        source: { kind: "event", eventId: sourceContext.eventId, label },
        plan: {
          attachments: snapshot.attachments, fieldMap,
          objects: withRecords.map((object) => ({ sourceObjectId: object.sourceId, targetObjectId: objectMap[object.sourceId], viewId: object.viewId, fields: object.fields })),
        },
        cursor: { phase: "records", index: 0, offset: 0 }, progress: { copied: 0 },
      });
      return { job: jobView(job), carried };
    },

    async advance(context, jobId, { budgetMs = 20_000 } = {}) {
      if (!UUID.test(jobId ?? "")) bad("Choose a copy.");
      let job = await store.job(context, jobId);
      if (!job) throw new WorkspaceError("not_found", 404, "That copy no longer exists.");
      const started = Date.now();
      while (job.status === "running" && Date.now() - started < budgetMs) {
        try {
          job = await advanceOnce(context, job);
        } catch (error) {
          job = await store.updateJob(job.id, { last_error: error?.message?.slice(0, 500) ?? "Copy failed", ...(error instanceof WorkspaceError ? { status: "failed" } : {}) });
          break;
        }
      }
      return jobView(job);
    },

    async saveTemplate(context, { name, description }) {
      const label = typeof name === "string" ? name.trim() : "";
      if (!label || label.length > 100) bad("Name the template (up to 100 characters).");
      const definition = await store.definition(context);
      const choices = { objects: Object.fromEntries(liveObjects(definition).map((object) => [object.id, { mode: "structure" }])) };
      const snapshot = buildSnapshot(definition, choices, { views: definition.views });
      if (!snapshot.objects.length) bad("Add a list before saving a template.");
      if (extras) snapshot.extras = await extras.collect(context, definition, null);
      return store.saveTemplate({ project_id: context.projectId, name: label,
        description: typeof description === "string" ? description.trim().slice(0, 500) : "", snapshot, created_by: context.principal.id });
    },

    async templates(context) {
      return (await store.templates(context.projectId)).map((row) => ({
        id: row.id, name: row.name, description: row.description, lists: (row.snapshot?.objects ?? []).map((object) => object.plural), updatedAt: row.updated_at,
      }));
    },

    // Creates the lists and fields of a snapshot (missing ones only); returns key → id maps for what follows.
    async applySnapshot(context, snapshot) {
      const target = await store.definition(context);
      const { objectIds, fieldIds } = await applyStructure(context, planCopy(snapshot, target));
      return { objectIds, fieldIds };
    },

    async deleteTemplate(context, id) {
      if (!UUID.test(id ?? "")) bad("Choose a template.");
      await store.deleteTemplate(context.projectId, id);
      return { deleted: true };
    },
  };
}

function jobView(job) {
  if (!job) return null;
  const total = job.plan?.objects?.length ?? 0;
  const index = Math.min(job.cursor?.index ?? 0, total);
  const phase = job.cursor?.phase ?? "records";
  return {
    id: job.id, status: job.status, copied: job.progress?.copied ?? 0,
    step: phase === "records" ? "Copying records" : "Linking records",
    progress: total ? Math.round(((phase === "records" ? index : total + index) / (total * 2)) * 100) : 100,
    error: job.status === "failed" ? job.last_error : null,
  };
}

