import { isObject, LIMITS } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { evaluateFormula, formulaRefs, parseFormula } from "../formula/index.js";
import { liveFields } from "../schema/definition.js";
import { FORMULA_RESULTS } from "../schema/types/computed.js";
import { getType } from "../schema/types/index.js";

const isEmpty = (value) => value === null || value === undefined || (Array.isArray(value) && !value.length);
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Formulas see what people see: option labels instead of ids, plain text instead of markup.
function formulaInput(field, value) {
  if (value === null || value === undefined) return null;
  if (field.type === "single_select" || field.type === "multi_select" || field.type === "rich_text") {
    return getType(field.type).toText(value, field.config) || null;
  }
  return value;
}

function coerce(result, kind) {
  if (result === null || result === undefined) return null;
  if (kind === "number") return typeof result === "number" && Number.isFinite(result) ? result : null;
  if (kind === "boolean") return typeof result === "boolean" ? result : null;
  if (kind === "date") return typeof result === "string" && /^\d{4}-\d{2}-\d{2}/.test(result) ? result.slice(0, 10) : null;
  const text = typeof result === "boolean" ? (result ? "true" : "false") : String(result);
  return text.slice(0, LIMITS.shortText) || null;
}

// Formula fields in dependency order, so a formula that uses another formula sees its fresh value.
function formulaOrder(fields) {
  const formulas = fields.filter((field) => field.type === "formula");
  const byKey = new Map(formulas.map((field) => [field.key, { field, refs: formulaRefs(parseFormula(field.config.expression)) }]));
  const ordered = [];
  const done = new Set();
  const visit = (key) => {
    if (done.has(key) || !byKey.has(key)) return;
    done.add(key);
    for (const ref of byKey.get(key).refs) visit(ref);
    ordered.push(byKey.get(key));
  };
  for (const key of byKey.keys()) visit(key);
  return ordered;
}

export function computeFormulaValues(fields, values, { timeZone = "UTC", now = new Date() } = {}) {
  const byKey = {};
  for (const field of fields) if (getType(field.type).stored) byKey[field.key] = formulaInput(field, values[field.id]);
  const out = {};
  for (const { field } of formulaOrder(fields)) {
    let ast;
    try { ast = parseFormula(field.config.expression); } catch { ast = null; }
    const value = ast ? coerce(evaluateFormula(ast, byKey, { timeZone, now }), FORMULA_RESULTS[field.config.result] ? field.config.result : "text") : null;
    out[field.id] = value;
    byKey[field.key] = value;
  }
  return out;
}

export function titleFor(object, fields, values) {
  if (!object.titleFieldId) return null;
  const field = fields.find((item) => item.id === object.titleFieldId);
  const value = field ? values[field.id] : null;
  if (value === null || value === undefined || value === "") return null;
  return getType(field.type).toText(value, field.config).slice(0, LIMITS.title) || null;
}

// Validates a create (existing = null) or a partial update, returning only the values that change.
export function normaliseRecordInput(definition, objectId, input, existing = null, options = {}) {
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) throw new WorkspaceError("not_found", 404, "That list no longer exists.");
  if (!isObject(input) || (input.values !== undefined && !isObject(input.values))) {
    throw new WorkspaceError("invalid_values", 422, "Send the record's values.");
  }
  const fields = liveFields(definition, objectId);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const values = input.values ?? {};
  const problems = {};
  const patch = {};
  const links = [];

  for (const [fieldId, raw] of Object.entries(values)) {
    const field = byId.get(fieldId);
    if (!field) throw new WorkspaceError("unknown_field", 422, "A value was sent for a field that isn't on this list.", { [fieldId]: "This field no longer exists." });
    const type = getType(field.type);
    if (!type.editable) throw new WorkspaceError("read_only", 422, `${field.name} is calculated and can't be edited.`, { [fieldId]: "Calculated." });
    try {
      const value = type.normalise(raw, field.config);
      if (type.cast === "link") links.push({ fieldId, targets: value });
      else patch[fieldId] = value;
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      problems[fieldId] = error.message;
    }
  }

  const merged = { ...(existing?.values ?? {}) };
  for (const [fieldId, value] of Object.entries(patch)) {
    if (value === null) delete merged[fieldId];
    else merged[fieldId] = value;
  }
  for (const field of fields.filter((item) => item.required)) {
    const touched = field.id in values;
    if (!existing || touched) {
      const empty = getType(field.type).cast === "link"
        ? !links.find((link) => link.fieldId === field.id)?.targets.length
        : isEmpty(merged[field.id]);
      if (empty && !problems[field.id]) problems[field.id] = "Required.";
    }
  }

  let status = existing ? existing.status ?? null : object.statuses?.[0]?.key ?? null;
  if (input.status !== undefined) {
    if (input.status !== null && !object.statuses?.some((item) => item.key === input.status)) {
      throw new WorkspaceError("invalid_values", 422, "Choose one of this list's statuses.", { status: "Unknown status." });
    }
    status = input.status;
  }
  if (Object.keys(problems).length) throw new WorkspaceError("invalid_values", 422, "Check the highlighted fields.", problems);

  const formulas = computeFormulaValues(fields, merged, options);
  for (const [fieldId, value] of Object.entries(formulas)) {
    if (value === null) delete merged[fieldId];
    else merged[fieldId] = value;
  }
  if (JSON.stringify(merged).length > LIMITS.valuesBytes) throw new WorkspaceError("too_large", 413, "This record holds too much data.");

  const changed = {};
  const before = existing?.values ?? {};
  for (const fieldId of new Set([...Object.keys(patch), ...Object.keys(formulas)])) {
    const next = merged[fieldId] ?? null;
    if (!existing ? next !== null : !sameJson(before[fieldId], next)) changed[fieldId] = next;
  }
  return { values: changed, links, status, title: titleFor(object, fields, merged) };
}
