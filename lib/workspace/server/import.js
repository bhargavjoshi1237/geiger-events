import { isObject, LIMITS, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { normaliseRecordInput } from "../records/values.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { commandSender } from "./send.js";
import { workspaceStore } from "./store.js";

const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };

// Imports one batch of CSV rows. Text is parsed per field type; link columns match a record title or an email/name.
export async function importRows(context, body, store = workspaceStore) {
  if (!isObject(body) || !UUID.test(body.objectId ?? "")) bad("Choose a list to import into.");
  if (!Array.isArray(body.rows) || body.rows.length > LIMITS.importRows) bad(`Import up to ${LIMITS.importRows} rows at a time.`);
  if (!Array.isArray(body.mapping) || !body.mapping.length) bad("Match at least one column to a field.");
  const definition = await store.definition(context);
  const object = definition.objects.find((item) => item.id === body.objectId && !item.deletedAt);
  if (!object) throw new WorkspaceError("not_found", 404, "That list no longer exists.");
  const fields = new Map(liveFields(definition, object.id).map((field) => [field.id, field]));
  const mapping = body.mapping.filter((entry) => isObject(entry) && Number.isInteger(entry.column) && entry.column >= 0 &&
    (entry.fieldId === "status" || (fields.has(entry.fieldId) && getType(fields.get(entry.fieldId).type).editable)));
  const event = await store.event(context);
  const timeZone = event?.timezone || "UTC";
  const offset = Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;

  // One lookup per distinct link text, shared across the batch.
  const linkCache = new Map();
  async function resolveLink(field, text) {
    const key = `${field.id}:${text.toLowerCase()}`;
    if (linkCache.has(key)) return linkCache.get(key);
    let match = null;
    if (field.type === "link_record") {
      const rows = await store.searchRecords(context, field.config.targetObjectId, text);
      match = rows.find((row) => (row.title ?? "").toLowerCase() === text.toLowerCase()) ?? null;
    } else {
      const rows = await store.eventData(context, field.config.target, { q: text, venueId: event?.venue_id });
      match = rows.find((row) => [row.label, row.sub].some((value) => (value ?? "").toLowerCase().split(" · ").includes(text.toLowerCase()))) ?? null;
    }
    linkCache.set(key, match?.id ?? null);
    return match?.id ?? null;
  }

  const rows = [];
  const errors = [];
  for (const [index, cells] of body.rows.entries()) {
    const line = offset + index + 2;
    if (!Array.isArray(cells)) { errors.push({ row: line, message: "This row couldn't be read." }); continue; }
    const values = {};
    let status;
    let problem = null;
    for (const { column, fieldId } of mapping) {
      const text = String(cells[column] ?? "").trim();
      if (fieldId === "status") {
        const match = object.statuses.find((item) => item.label.toLowerCase() === text.toLowerCase() || item.key === text);
        if (text && !match) problem ??= `"${text}" isn't one of the statuses.`;
        status = match?.key ?? null;
        continue;
      }
      const field = fields.get(fieldId);
      if (!text) continue;
      if (field.type === "link_record" || field.type === "link_event") {
        const parts = field.config.multiple ? text.split(/\s*[;,]\s*/).filter(Boolean) : [text];
        const ids = [];
        for (const part of parts) {
          const id = await resolveLink(field, part);
          if (!id) problem ??= `No match for "${part}" in ${field.name}.`;
          else ids.push(id);
        }
        values[field.id] = ids;
        continue;
      }
      const value = getType(field.type).fromText(text, field.config);
      if (value === undefined) problem ??= `"${text}" isn't a valid ${field.name}.`;
      else values[field.id] = value;
    }
    if (problem) { errors.push({ row: line, message: problem }); continue; }
    try {
      const out = normaliseRecordInput(definition, object.id, { values, ...(status !== undefined ? { status } : {}) }, null, { timeZone });
      rows.push({ values: out.values, status: out.status, links: out.links, title: out.title ?? "" });
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      const firstField = error.fields && Object.keys(error.fields)[0];
      const name = firstField ? fields.get(firstField)?.name : null;
      errors.push({ row: line, message: name ? `${name}: ${error.fields[firstField]}` : error.message });
    }
  }
  let created = 0;
  if (rows.length) {
    const result = await commandSender(store)(context, "records.import", { objectId: object.id, rows }, body.commandId);
    created = result.count;
  }
  return { created, errors };
}
