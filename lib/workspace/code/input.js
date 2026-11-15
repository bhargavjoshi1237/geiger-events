import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";

// A record as code sees it: each field by its key (links as { id, label }, lookups and rollups calculated), plus
// id, number, title and status unless a field already uses that key.
export function codeRecord(definition, record) {
  const out = {};
  for (const field of liveFields(definition, record.objectId)) {
    const type = getType(field.type);
    if (type?.cast === "link") out[field.key] = (record.links?.[field.id] ?? []).map((link) => ({ id: link.id, label: link.label ?? "", kind: link.kind }));
    else if (field.type === "lookup" || field.type === "rollup") out[field.key] = record.computed?.[field.id] ?? null;
    else out[field.key] = record.values?.[field.id] ?? null;
  }
  for (const [key, value] of [["id", record.id], ["number", record.number], ["title", record.title ?? ""], ["status", record.status ?? null]]) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}
