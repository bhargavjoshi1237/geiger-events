import { isObject } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { SEARCHABLE } from "./blocks.js";
import { readPlan } from "./policy.js";
import { ALL, and, compileRule, resolveTokens } from "./rules.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATED = new Set(["calendar", "schedule", "timeline"]);

// The block's own filter, the viewer's role rules and the rows they can see, as plan parts for the database.
function scope(definition, objectPolicy, objectId, filter, tokens) {
  const blockFilter = compileRule(definition, objectId, filter ? resolveTokens(filter, tokens) : null);
  if (objectPolicy.staff) return { policy: blockFilter, policyParts: [], parts: [] };
  const read = readPlan(objectPolicy);
  return { policy: and(read.policy, blockFilter), policyParts: read.policyParts, parts: read.parts };
}

// Viewer-chosen filters on the fields a block exposes; only fields every one of their roles can see.
function exposedFilter(definition, objectId, config, params, queryable) {
  const chosen = isObject(params?.filters) ? params.filters : {};
  const byId = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  const items = [];
  for (const id of config.filters ?? []) {
    const value = chosen[id];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) continue;
    if (id === "status") {
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) items.push({ field: "status", operator: "any_of", value: value.slice(0, 50) });
      continue;
    }
    const field = byId.get(id);
    if (!field || !queryable.has(id)) continue;
    if (field.type === "single_select" && Array.isArray(value)) items.push({ field: id, operator: "any_of", value: value.slice(0, 50) });
    else if (field.type === "multi_select" && Array.isArray(value)) items.push({ field: id, operator: "has_any", value: value.slice(0, 50) });
    else if (field.type === "checkbox" && typeof value === "boolean") items.push({ field: id, operator: value ? "is_true" : "is_false" });
    else if ((field.type === "date" || field.type === "datetime") && isObject(value)) {
      if (DATE.test(value.from ?? "")) items.push({ field: id, operator: "on_or_after", value: value.from });
      if (DATE.test(value.to ?? "")) items.push({ field: id, operator: "on_or_before", value: value.to });
    } else if (["short_text", "email"].includes(field.type) && typeof value === "string") items.push({ field: id, operator: "contains", value: value.slice(0, 100) });
    else if (field.type === "number" && typeof value === "number") items.push({ field: id, operator: "eq", value });
  }
  return items.length ? { op: "and", items } : null;
}

// A page of records for a table, cards, board or calendar block, as the viewer may see it.
export function listPlan(block, { definition, objectPolicy, tokens, params = {} }) {
  const config = block.config;
  const objectId = config.source.objectId;
  const queryable = new Set(objectPolicy.queryable);
  const allowedSort = (item) => isObject(item) && (["number", "title", "status", "created_at", "updated_at"].includes(item.field) || queryable.has(item.field));
  const wantedSort = isObject(params.sort) && allowedSort(params.sort) ? [{ field: params.sort.field, dir: params.sort.dir === "desc" ? "desc" : "asc" }]
    : (config.source.sort ?? []).filter(allowedSort);
  let limit = config.pageSize ?? 50;
  let offset = Number.isInteger(params.offset) && params.offset >= 0 ? Math.min(params.offset, 100_000) : 0;
  let extra = exposedFilter(definition, objectId, config, params, queryable);
  if (block.kind === "board") { limit = 200; offset = 0; }
  if (block.kind === "placement") { limit = 500; offset = 0; }
  let sortOverride = null;
  if (DATED.has(block.kind)) {
    const dateField = block.kind === "calendar" ? config.dateField : config.startField;
    limit = block.kind === "calendar" ? 200 : 500;
    offset = 0;
    if (!queryable.has(dateField)) throw new WorkspaceError("forbidden", 403, "This block isn't available to you.");
    const range = isObject(params.range) && DATE.test(params.range.from ?? "") && DATE.test(params.range.to ?? "") ? params.range : null;
    if (params.first === true) {
      // Only the earliest dated record, to open on "first record".
      limit = 1;
      sortOverride = [{ field: dateField, dir: "asc" }];
      extra = { op: "and", items: [{ field: dateField, operator: "is_not_empty" }] };
    } else if (range) {
      const items = [{ field: dateField, operator: "on_or_before", value: range.to }];
      items.push(config.endField && queryable.has(config.endField)
        ? { op: "or", items: [{ field: dateField, operator: "on_or_after", value: range.from }, { field: config.endField, operator: "on_or_after", value: range.from }] }
        : { field: dateField, operator: "on_or_after", value: range.from });
      extra = { op: "and", items };
    }
  }
  const search = config.search && typeof params.search === "string" ? params.search.slice(0, 100) : undefined;
  const sort = sortOverride ?? (wantedSort.length ? wantedSort : undefined);
  const base = compileQuery(definition, objectId, { sort, search, limit, offset, filter: extra ?? undefined });
  const { policy, policyParts, parts } = scope(definition, objectPolicy, objectId, config.source.filter, tokens);
  const searchFields = objectPolicy.staff ? undefined : liveFields(definition, objectId)
    .filter((field) => SEARCHABLE.has(field.type) && queryable.has(field.id)).map((field) => field.id);
  return { plan: { ...base, policy, policyParts, ...(searchFields ? { searchFields } : {}) }, parts };
}

// One record of a list by number, under the viewer's rules (record pages and "this record" blocks).
export function recordPlan(definition, objectPolicy, objectId, number) {
  const base = compileQuery(definition, objectId, { filter: { op: "and", items: [{ field: "number", operator: "eq", value: number }] }, limit: 1 });
  if (objectPolicy.staff) return { plan: { ...base, policy: ALL, policyParts: [] }, parts: [] };
  const read = readPlan(objectPolicy);
  return { plan: { ...base, policy: read.policy, policyParts: read.policyParts }, parts: read.parts };
}

// Which of these record ids the viewer may open (for link labels).
export function visibleIdsPlan(definition, objectPolicy, objectId, ids) {
  const read = objectPolicy.staff ? { policy: ALL } : readPlan(objectPolicy);
  const base = compileQuery(definition, objectId, { limit: Math.min(200, Math.max(1, ids.length)) });
  return { ...base, policy: and(read.policy, { source: "system", column: "id", cast: "text", operator: "any_of", value: ids.slice(0, 200) }) };
}

function measureOf(definition, objectPolicy, objectId, fn, fieldId, alias) {
  if (fn === "count") return { alias, fn: "count" };
  if (!fieldId || !new Set(objectPolicy.queryable).has(fieldId)) return null;
  const field = liveFields(definition, objectId).find((item) => item.id === fieldId);
  if (!field) return null;
  if (field.type === "rollup") {
    const { computed } = compileQuery(definition, objectId, { limit: 1 });
    const item = computed.find((entry) => entry.fieldId === fieldId);
    return item ? { alias, fn, computed: item.alias } : null;
  }
  return getType(field.type).cast === "numeric" || field.type === "formula" ? { alias, fn, fieldId } : null;
}

// Aggregate plans for a stats tile (one or two queries) or a chart, or null when the viewer can't use that field.
export function statPlans(tile, { definition, objectPolicy, tokens }) {
  const fn = tile.fn === "percent" ? "count" : tile.fn;
  const measure = measureOf(definition, objectPolicy, tile.objectId, fn, tile.fieldId, "m0");
  if (!measure) return null;
  const { computed } = compileQuery(definition, tile.objectId, { limit: 1 });
  const { policy } = scope(definition, objectPolicy, tile.objectId, tile.filter, tokens);
  const plans = [{ objectId: tile.objectId, computed, policy, measures: [measure] }];
  if (tile.fn === "percent") {
    const part = compileRule(definition, tile.objectId, tile.part ? resolveTokens(tile.part, tokens) : null);
    plans.push({ objectId: tile.objectId, computed, policy: and(policy, part), measures: [measure] });
  }
  return plans;
}

export function chartPlan(config, { definition, objectPolicy, tokens }) {
  const measure = measureOf(definition, objectPolicy, config.objectId, config.measure.fn, config.measure.fieldId, "m0");
  if (!measure) return null;
  let groupBy;
  if (config.groupBy.field === "status") groupBy = { source: "system", column: "status" };
  else {
    if (!new Set(objectPolicy.queryable).has(config.groupBy.field)) return null;
    const field = liveFields(definition, config.objectId).find((item) => item.id === config.groupBy.field);
    if (!field) return null;
    const cast = field.type === "multi_select" ? "text[]" : field.type === "checkbox" ? "boolean" : getType(field.type).cast;
    groupBy = { source: "value", fieldId: field.id, cast, ...(config.groupBy.bucket ? { bucket: config.groupBy.bucket } : {}) };
  }
  const { computed } = compileQuery(definition, config.objectId, { limit: 1 });
  const { policy } = scope(definition, objectPolicy, config.objectId, config.filter, tokens);
  return { objectId: config.objectId, computed, policy, measures: [measure], groupBy };
}
