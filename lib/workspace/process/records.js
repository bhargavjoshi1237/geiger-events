import { createHash } from "node:crypto";
import { attachLinks } from "../links/resolve.js";
import { labelLookups } from "../records/lookups.js";
import { compileQuery } from "../records/query.js";
import { workspaceStore } from "../server/store.js";

const PAGE = 200;
const byIds = (ids) => ({ source: "system", column: "id", cast: "text", operator: "any_of", value: ids });

export const requestHash = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

// Records with values, calculated lookups/rollups and labelled links, in the order of `ids`.
export async function loadRecords(context, definition, objectId, ids, { workspace = workspaceStore, venueId = null } = {}) {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = [];
  for (let i = 0; i < unique.length; i += PAGE) {
    const chunk = unique.slice(i, i + PAGE);
    const plan = { ...compileQuery(definition, objectId, { limit: chunk.length }), policy: byIds(chunk) };
    const page = await workspace.query(context, plan);
    const rows = labelLookups(definition, objectId, page.rows.map((row) => ({ ...row, number: Number(row.number), revision: Number(row.revision) })));
    out.push(...await attachLinks(workspace, context, definition, rows, { venueId }));
  }
  const order = new Map(unique.map((id, index) => [id, index]));
  return out.sort((a, b) => order.get(a.id) - order.get(b.id));
}

export async function loadRecord(context, definition, objectId, id, options) {
  return (await loadRecords(context, definition, objectId, [id], options))[0] ?? null;
}

// Pages of records matching a filter (with links), up to `max` records.
export async function* recordPages(context, definition, objectId, { filter = null, sort, max = 2000, links = true, workspace = workspaceStore, venueId = null } = {}) {
  for (let offset = 0; offset < max; offset += PAGE) {
    const plan = compileQuery(definition, objectId, { filter: filter ?? undefined, sort, limit: Math.min(PAGE, max - offset), offset });
    const page = await workspace.query(context, plan);
    const rows = labelLookups(definition, objectId, page.rows.map((row) => ({ ...row, number: Number(row.number), revision: Number(row.revision) })));
    if (rows.length) yield links ? await attachLinks(workspace, context, definition, rows, { venueId }) : rows;
    if (rows.length < plan.limit) return;
  }
}

export async function allRecords(context, definition, objectId, options = {}) {
  const out = [];
  for await (const page of recordPages(context, definition, objectId, options)) out.push(...page);
  return out;
}

// Whether one record matches a filter (a missing filter always matches).
export async function recordMatches(context, definition, objectId, recordId, filter, { workspace = workspaceStore } = {}) {
  if (!filter) return true;
  const plan = { ...compileQuery(definition, objectId, { filter, limit: 1 }), policy: { source: "system", column: "id", cast: "text", operator: "eq", value: recordId } };
  return (await workspace.query(context, plan)).rows.length > 0;
}

export const linkedIds = (record, fieldId) => (record?.links?.[fieldId] ?? []).filter((link) => link.kind === "record").map((link) => link.id);
