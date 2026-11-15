import { CAST_OPERATORS, isObject, LIMITS, SYSTEM_COLUMNS, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { FORMULA_RESULTS } from "../schema/types/computed.js";
import { getType } from "../schema/types/index.js";

const bad = (message) => { throw new WorkspaceError("invalid_filter", 400, message); };
const NO_VALUE = new Set(["is_empty", "is_not_empty", "is_true", "is_false"]);
const LIST_VALUE = new Set(["any_of", "none_of", "has_any", "has_all", "has_none"]);
const SYSTEM_OPERATORS = {
  number: CAST_OPERATORS.numeric.filter((op) => !op.startsWith("is_")),
  title: ["eq", "neq", "contains", "not_contains", "starts_with", "is_empty", "is_not_empty"],
  status: ["eq", "neq", "any_of", "none_of", "is_empty", "is_not_empty"],
  created_at: CAST_OPERATORS.timestamptz,
  updated_at: CAST_OPERATORS.timestamptz,
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function castOf(field) {
  if (field.type === "formula") return FORMULA_RESULTS[field.config.result] ?? "text";
  return getType(field.type).cast;
}

function checkValue(operator, cast, value) {
  if (NO_VALUE.has(operator)) return undefined;
  if (LIST_VALUE.has(operator)) {
    if (!Array.isArray(value) || !value.length || value.length > 100 || value.some((item) => typeof item !== "string" || item.length > 200)) {
      bad("Choose at least one value.");
    }
    if (cast === "link" && value.some((item) => !UUID.test(item))) bad("Choose items to match.");
    return [...new Set(value)];
  }
  if (cast === "numeric") {
    if (typeof value !== "number" || !Number.isFinite(value)) bad("Enter a number to compare with.");
    return value;
  }
  if (cast === "date" || cast === "timestamptz") {
    if (typeof value !== "string" || !(DATE.test(value) || !Number.isNaN(Date.parse(value)))) bad("Choose a date to compare with.");
    return value;
  }
  if (typeof value !== "string" || value.length > 200) bad("Enter text to compare with.");
  return value;
}

// Turns an organiser's view (filters, sort, search) into a whitelisted plan the database can assemble safely.
export function compileQuery(definition, objectId, spec = {}) {
  if (!isObject(spec)) bad("Invalid view.");
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) throw new WorkspaceError("not_found", 404, "That list no longer exists.");
  const fields = liveFields(definition, objectId);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const computed = fields.filter((field) => field.type === "lookup" || field.type === "rollup").map((field, index) => ({
    alias: `c${index}`, fieldId: field.id, kind: field.type, fn: field.config.fn ?? null,
    linkFieldId: field.config.linkFieldId, targetFieldId: field.config.targetFieldId ?? null, cast: getType(field.type).cast,
  }));
  const aliasFor = new Map(computed.map((item) => [item.fieldId, item.alias]));

  function column(ref, { forSort = false } = {}) {
    if (Object.hasOwn(SYSTEM_COLUMNS, ref)) return [{ source: "system", column: ref, cast: SYSTEM_COLUMNS[ref] }, SYSTEM_OPERATORS[ref]];
    const field = byId.get(ref);
    if (!field) bad("A filter uses a field that no longer exists.");
    const type = getType(field.type);
    if (aliasFor.has(field.id)) return [{ source: "computed", alias: aliasFor.get(field.id), cast: type.cast }, type.operators];
    if (type.cast === "link") {
      if (forSort) bad("Link fields can't be sorted.");
      return [{ source: "link", fieldId: field.id, cast: "link" }, type.operators];
    }
    if (forSort && ["text[]", "file"].includes(type.cast)) bad("That field can't be sorted.");
    return [{ source: "value", fieldId: field.id, cast: castOf(field) }, type.operators];
  }

  function group(node, depth) {
    if (!isObject(node) || !["and", "or"].includes(node.op) || !Array.isArray(node.items)) bad("Invalid filter.");
    if (depth > LIMITS.filterDepth) bad("Filters can be nested three levels deep.");
    if (node.items.length > LIMITS.filterItems) bad("Use fewer filter conditions.");
    return { op: node.op, items: node.items.map((item) => (isObject(item) && "op" in item ? group(item, depth + 1) : condition(item))) };
  }

  function condition(item) {
    if (!isObject(item) || typeof item.field !== "string" || typeof item.operator !== "string") bad("Invalid filter condition.");
    const [target, operators] = column(item.field);
    if (!operators.includes(item.operator) || !CAST_OPERATORS[target.cast]?.includes(item.operator)) bad("That filter doesn't apply to this field.");
    const value = checkValue(item.operator, target.cast, item.value);
    return value === undefined ? { ...target, operator: item.operator } : { ...target, operator: item.operator, value };
  }

  const sortInput = spec.sort ?? [{ field: "number", dir: "asc" }];
  if (!Array.isArray(sortInput) || sortInput.length > 3) bad("Sort by up to three fields.");
  const sort = sortInput.map((item) => {
    if (!isObject(item) || !["asc", "desc"].includes(item.dir ?? "asc")) bad("Invalid sort.");
    // Manual (board) order only runs one way; it isn't a filterable column.
    if (item.field === "rank") return { source: "system", column: "rank", cast: "numeric", dir: "asc" };
    const [target] = column(item.field, { forSort: true });
    return { ...target, dir: item.dir ?? "asc" };
  });

  let search = null;
  if (spec.search !== undefined && spec.search !== null && spec.search !== "") {
    if (typeof spec.search !== "string" || spec.search.length > 100) bad("Search for something shorter.");
    const terms = spec.search.toLowerCase().split(/\s+/).map((term) => term.replace(/[^\p{L}\p{N}]+/gu, "")).filter(Boolean).slice(0, 8);
    search = terms.length ? terms : null;
  }
  const limit = spec.limit ?? 50;
  const offset = spec.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.pageSize) bad("Invalid page size.");
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) bad("Invalid page.");
  if (spec.deleted !== undefined && typeof spec.deleted !== "boolean") bad("Invalid view.");

  return {
    objectId,
    filter: spec.filter ? group(spec.filter, 1) : null,
    sort, search, limit, offset,
    deleted: spec.deleted ?? false,
    computed,
  };
}
