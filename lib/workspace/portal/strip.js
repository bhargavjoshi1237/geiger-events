import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";

// Shapes one record for a portal viewer: only the fields this row lets them see, linked records they can't open shown
// as Restricted, and no staff ids. `access` comes from rowAccess(); `visibleTargets` holds linked record ids they may view.
export function shapeRecord(row, { definition, objectId, access, visibleTargets = new Set() }) {
  const values = {};
  const computed = {};
  const links = {};
  for (const field of liveFields(definition, objectId)) {
    const level = access.levels[field.id];
    if (!level || level === "hidden") continue;
    const type = getType(field.type);
    if (type.cast === "link") {
      links[field.id] = (row.links?.[field.id] ?? []).map((link) => {
        if (link.kind !== "record") return { kind: link.kind, id: link.id, label: link.label, ...(link.missing ? { missing: true } : {}) };
        if (link.missing) return { kind: "record", restricted: true, label: "Removed item", missing: true };
        return visibleTargets.has(link.id)
          ? { kind: "record", id: link.id, label: link.label, sub: link.sub, list: link.list, number: link.number }
          : { kind: "record", restricted: true, label: "Restricted" };
      });
    } else if (field.type === "lookup" || field.type === "rollup") {
      if (row.computed && field.id in row.computed) computed[field.id] = row.computed[field.id];
    } else if (row.values && field.id in row.values) {
      values[field.id] = row.values[field.id];
    }
  }
  return {
    id: row.id, objectId, number: Number(row.number), title: row.title, status: row.status, revision: Number(row.revision),
    createdAt: row.createdAt, updatedAt: row.updatedAt, values, computed, links,
    access: { fields: access.levels, editable: access.editable, status: access.status, delete: access.delete, comment: access.comment },
  };
}

// Record ids referenced by link fields the viewer may see, grouped by the list they belong to.
export function linkTargets(definition, objectId, rows, visibleFieldIds) {
  const visible = new Set(visibleFieldIds);
  const byObject = new Map();
  for (const field of liveFields(definition, objectId)) {
    if (field.type !== "link_record" || !visible.has(field.id)) continue;
    const target = field.config.targetObjectId;
    for (const row of rows) {
      for (const link of row.links?.[field.id] ?? []) {
        if (link.kind !== "record" || link.missing) continue;
        if (!byObject.has(target)) byObject.set(target, new Set());
        byObject.get(target).add(link.id);
      }
    }
  }
  return byObject;
}

// The field definitions a viewer needs to render a list (no hidden fields, no internal config).
export function publicFields(definition, objectId, visibleIds) {
  const visible = new Set(visibleIds);
  return liveFields(definition, objectId).filter((field) => visible.has(field.id)).sort((a, b) => a.position - b.position).map((field) => ({
    id: field.id, key: field.key, name: field.name, type: field.type, required: field.required, position: field.position,
    config: publicConfig(field),
  }));
}

function publicConfig(field) {
  const c = field.config ?? {};
  switch (field.type) {
    case "single_select": case "multi_select": return { options: c.options ?? [] };
    case "number": case "currency": case "percent": return { decimals: c.decimals, min: c.min, max: c.max, currency: c.currency };
    case "rating": return { max: c.max };
    case "short_text": return { maxLength: c.maxLength };
    case "long_text": return { maxWords: c.maxWords, maxChars: c.maxChars };
    case "attachments": return { accept: c.accept, maxFiles: c.maxFiles, maxBytes: c.maxBytes };
    case "link_record": return { targetObjectId: c.targetObjectId, multiple: c.multiple };
    case "link_event": return { target: c.target, multiple: c.multiple };
    case "formula": return { result: c.result, decimals: c.decimals };
    case "rollup": return { fn: c.fn, decimals: c.decimals };
    case "date": case "datetime": return { format: c.format };
    default: return {};
  }
}
