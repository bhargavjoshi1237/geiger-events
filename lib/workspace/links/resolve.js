import { EVENT_TARGETS } from "../contracts.js";

const recordLabel = (row, objects) => {
  const object = objects.get(row.object_id);
  const number = `${object?.numberPrefix ?? "REC"}-${row.number}`;
  return { label: row.title || number, sub: row.title && row.title !== number ? number : "", deleted: Boolean(row.deleted_at), list: object?.key, number: Number(row.number) };
};

// Adds `links: { fieldId: [{ kind, id, label, sub, missing }] }` to each record, resolving labels in one query per kind.
export async function attachLinks(store, context, definition, records, { venueId = null } = {}) {
  if (!records.length) return records;
  const rows = await store.links(context, records.map((record) => record.id));
  const byKind = new Map();
  for (const row of rows) {
    if (!byKind.has(row.target_kind)) byKind.set(row.target_kind, new Set());
    byKind.get(row.target_kind).add(row.target_id);
  }
  const labels = await resolveLabels(store, context, definition, byKind, venueId);
  const grouped = new Map(records.map((record) => [record.id, {}]));
  for (const row of rows) {
    const links = grouped.get(row.source_record_id);
    if (!links) continue;
    const label = labels.get(`${row.target_kind}:${row.target_id}`);
    (links[row.field_id] ??= []).push({ kind: row.target_kind, id: row.target_id, ...(label ?? { label: "Removed item", sub: "", missing: true }) });
  }
  return records.map((record) => ({ ...record, links: grouped.get(record.id) }));
}

export async function resolveLabels(store, context, definition, byKind, venueId) {
  const objects = new Map(definition.objects.map((object) => [object.id, object]));
  const labels = new Map();
  await Promise.all([...byKind.entries()].map(async ([kind, ids]) => {
    const list = [...ids];
    if (kind === "record") {
      for (const row of await store.recordLabels(context, list)) labels.set(`record:${row.id}`, recordLabel(row, objects));
    } else if (EVENT_TARGETS.includes(kind)) {
      for (const row of await store.eventData(context, kind, { ids: list, venueId })) labels.set(`${kind}:${row.id}`, { label: row.label, sub: row.sub });
    }
  }));
  return labels;
}

export async function searchRecordTargets(store, context, definition, objectId, q) {
  const objects = new Map(definition.objects.map((object) => [object.id, object]));
  return (await store.searchRecords(context, objectId, q)).map((row) => ({ kind: "record", id: row.id, ...recordLabel(row, objects) }));
}
