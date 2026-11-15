import { isObject } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields, liveObjects } from "../schema/definition.js";

const MODES = new Set(["skip", "structure", "records"]);
const CARRIED_EVENT_TARGETS = new Set(["contact", "team_member"]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Field configs point at ids; a snapshot points at keys so it can be replayed into any workspace.
function portableConfig(field, definition) {
  const byId = new Map(definition.fields.map((item) => [item.id, item]));
  const objects = new Map(definition.objects.map((item) => [item.id, item]));
  const config = { ...field.config };
  if (field.type === "link_record") {
    config.targetObjectKey = objects.get(config.targetObjectId)?.key ?? null;
    delete config.targetObjectId;
  }
  if (field.type === "lookup" || field.type === "rollup") {
    config.linkFieldKey = byId.get(config.linkFieldId)?.key ?? null;
    if (config.targetFieldId) config.targetFieldKey = byId.get(config.targetFieldId)?.key ?? null;
    delete config.linkFieldId;
    delete config.targetFieldId;
  }
  return config;
}

function portableViewConfig(config, fields) {
  const keyOf = new Map(fields.map((field) => [field.id, field.key]));
  const swap = (node) => {
    if (!isObject(node)) return node;
    if (Array.isArray(node.items)) return { ...node, items: node.items.map(swap) };
    return keyOf.has(node.field) ? { ...node, field: `key:${keyOf.get(node.field)}` } : node;
  };
  return {
    ...config,
    columns: (config.columns ?? []).filter((column) => keyOf.has(column.fieldId)).map((column) => ({ ...column, fieldId: `key:${keyOf.get(column.fieldId)}` })),
    ...(config.filter ? { filter: swap(config.filter) } : {}),
    ...(config.sort ? { sort: config.sort.map((item) => (keyOf.has(item.field) ? { ...item, field: `key:${keyOf.get(item.field)}` } : item)) } : {}),
    ...(keyOf.has(config.groupBy) ? { groupBy: `key:${keyOf.get(config.groupBy)}` } : {}),
  };
}

// choices: { objects: { [objectId]: { mode, viewId?, excludeFieldIds? } }, attachments } — omitted objects are skipped.
export function buildSnapshot(definition, choices = {}, { views = [] } = {}) {
  const picks = isObject(choices.objects) ? choices.objects : {};
  const objects = [];
  for (const object of liveObjects(definition)) {
    const pick = picks[object.id] ?? { mode: "skip" };
    if (!MODES.has(pick.mode)) throw new WorkspaceError("invalid_input", 422, "Choose what to copy for each list.");
    if (pick.mode === "skip") continue;
    const excluded = new Set(Array.isArray(pick.excludeFieldIds) ? pick.excludeFieldIds : []);
    const fields = liveFields(definition, object.id).filter((field) => !excluded.has(field.id) || field.id === object.titleFieldId);
    objects.push({
      sourceId: object.id, key: object.key, name: object.name, plural: object.plural, icon: object.icon,
      numberPrefix: object.numberPrefix, statuses: object.statuses,
      titleFieldKey: fields.find((field) => field.id === object.titleFieldId)?.key ?? null,
      mode: pick.mode, viewId: pick.mode === "records" && pick.viewId ? pick.viewId : null,
      fields: fields.map((field) => ({ sourceId: field.id, key: field.key, name: field.name, type: field.type,
        config: portableConfig(field, definition), required: field.required, isUnique: field.isUnique })),
      views: views.filter((view) => view.objectId === object.id && view.shared)
        .map((view) => ({ name: view.name, config: portableViewConfig(view.config, fields) })),
    });
  }
  return { version: 1, attachments: Boolean(choices.attachments), objects };
}

// Works out what a snapshot does to a target workspace and explains it in plain sentences before anything is created.
export function planCopy(snapshot, target, { linkCounts = {}, recordCounts = {} } = {}) {
  const sentences = [];
  const existing = new Map(liveObjects(target).map((object) => [object.key, object]));
  const included = new Set(snapshot.objects.map((object) => object.key));
  const objects = snapshot.objects.map((object) => {
    const into = existing.get(object.key) ?? null;
    const targetFields = into ? liveFields(target, into.id) : [];
    const dropped = new Set();
    const fields = [];
    for (const field of object.fields) {
      if (field.type === "link_record" && !included.has(field.config.targetObjectKey) && !existing.has(field.config.targetObjectKey)) {
        dropped.add(field.key);
        sentences.push(`Link field ${field.name} on ${object.plural} will be dropped because its list isn't being copied.`);
        continue;
      }
      if ((field.type === "lookup" || field.type === "rollup") && dropped.has(field.config.linkFieldKey)) {
        dropped.add(field.key);
        sentences.push(`${field.name} on ${object.plural} will be dropped because the link it uses is being dropped.`);
        continue;
      }
      const match = targetFields.find((item) => item.key === field.key);
      if (into && match && match.type !== field.type) {
        dropped.add(field.key);
        sentences.push(`${field.name} on ${object.plural} is a different kind of field in this event, so it will be skipped.`);
        continue;
      }
      fields.push({ ...field, targetId: match?.id ?? null });
    }
    if (into) {
      sentences.push(`${object.plural} already exists here, so ${object.mode === "records" ? "copied records will be added to it" : "only missing fields will be added"}.`);
    }
    for (const field of fields.filter((item) => item.type === "link_event")) {
      const count = linkCounts[field.sourceId] ?? 0;
      if (object.mode === "records" && count && !CARRIED_EVENT_TARGETS.has(field.config.target)) {
        sentences.push(`${field.name} on ${object.plural} links to this event's own data, so ${plural(count, "link")} will be cleared.`);
      }
    }
    if (object.mode === "records") {
      const count = recordCounts[object.sourceId];
      if (count !== undefined) sentences.push(`${plural(count, "record")} will be copied into ${object.plural}${object.viewId ? " (from the chosen view)" : ""}.`);
    }
    return { ...object, fields, targetObjectId: into?.id ?? null };
  });
  if (snapshot.objects.some((object) => object.mode === "records")) {
    sentences.push("Comments and history aren't copied. Each copied record notes where it came from.");
    if (!snapshot.attachments && snapshot.objects.some((object) => object.mode === "records" && object.fields.some((field) => field.type === "attachments"))) {
      sentences.push("Attached files won't be copied.");
    }
  }
  return { objects, sentences };
}

// Turns a portable field config back into ids; fieldIds is keyed "objectKey:fieldKey".
export function resolveConfig(field, object, { objectIds, fieldIds }) {
  const config = { ...field.config };
  if (field.type === "link_record") {
    config.targetObjectId = objectIds.get(config.targetObjectKey);
    delete config.targetObjectKey;
  }
  if (field.type === "lookup" || field.type === "rollup") {
    const link = object.fields.find((item) => item.key === config.linkFieldKey);
    config.linkFieldId = fieldIds.get(`${object.key}:${config.linkFieldKey}`);
    if (config.targetFieldKey) config.targetFieldId = fieldIds.get(`${link?.config.targetObjectKey}:${config.targetFieldKey}`);
    delete config.linkFieldKey;
    delete config.targetFieldKey;
  }
  return config;
}

export function resolveViewConfig(config, object, fieldIds) {
  const id = (value) => (typeof value === "string" && value.startsWith("key:") ? fieldIds.get(`${object.key}:${value.slice(4)}`) : value);
  const swap = (node) => {
    if (!isObject(node)) return node;
    if (Array.isArray(node.items)) return { ...node, items: node.items.map(swap).filter((item) => item.field !== undefined || item.items) };
    return { ...node, field: id(node.field) };
  };
  return {
    ...config,
    columns: (config.columns ?? []).map((column) => ({ ...column, fieldId: id(column.fieldId) })).filter((column) => column.fieldId),
    ...(config.filter ? { filter: swap(config.filter) } : {}),
    ...(config.sort ? { sort: config.sort.map((item) => ({ ...item, field: id(item.field) })).filter((item) => item.field) } : {}),
    ...(config.groupBy ? { groupBy: id(config.groupBy) ?? null } : {}),
  };
}

// Maps one source record's values onto target field ids; links between copied records are added in a second pass.
export function remapRecord(record, object, { fieldMap, keepEventLinks = true, fileMap = null }) {
  const values = {};
  for (const field of object.fields) {
    const targetId = fieldMap.get(field.sourceId);
    if (!targetId || ["link_record", "link_event", "lookup", "rollup", "formula"].includes(field.type)) continue;
    const value = record.values?.[field.sourceId];
    if (value === undefined || value === null) continue;
    if (field.type === "attachments") {
      if (!fileMap) continue;
      const files = value.map((file) => fileMap.get(file.id)).filter(Boolean);
      if (files.length) values[targetId] = files;
      continue;
    }
    values[targetId] = value;
  }
  const links = [];
  for (const field of object.fields.filter((item) => item.type === "link_event")) {
    const targetId = fieldMap.get(field.sourceId);
    const kept = keepEventLinks && CARRIED_EVENT_TARGETS.has(field.config.target)
      ? (record.links?.[field.sourceId] ?? []).map((link) => ({ kind: link.kind, id: link.id })) : [];
    if (targetId && kept.length) links.push({ fieldId: targetId, targets: kept });
  }
  return { values, links };
}
