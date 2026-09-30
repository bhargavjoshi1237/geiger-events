import { isObject, OPERATIONS_LIMITS, RESERVED_KEYS } from "../contracts.js";
import { OperationsError } from "../errors.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function visible(field, values) {
  if (!field.showWhen) return true;
  const actual = values[field.showWhen.fieldId];
  return actual === field.showWhen.equals;
}

export function validateRecordValues(definition, values) {
  if (!isObject(values)) throw new OperationsError("invalid_values", 422, "Record values must be an object.");
  const fields = new Map((definition?.fields || []).filter((field) => field.type !== "reference")
    .map((field) => [field.id, field]));
  for (const key of Object.keys(values)) {
    if (RESERVED_KEYS.has(key) || !fields.has(key)) {
      throw new OperationsError("unknown_field", 422, `Unknown record field: ${key}.`, { [key]: "Unknown field." });
    }
  }
  const output = {};
  const problems = {};
  for (const field of fields.values()) {
    const value = values[field.id];
    if (value === undefined || value === null || value === "") {
      if (field.required && visible(field, values)) problems[field.id] = "Required.";
      if (value === null && !field.required) output[field.id] = null;
      continue;
    }
    let ok = false;
    let normalized = value;
    if (["text", "textarea", "email", "select", "date"].includes(field.type)) {
      ok = typeof value === "string";
      if (ok) {
        normalized = value.trim();
        const max = field.type === "textarea" ? OPERATIONS_LIMITS.textarea : OPERATIONS_LIMITS.title;
        ok = normalized.length > 0 && normalized.length <= max;
        if (field.type === "email") ok &&= EMAIL.test(normalized);
        if (field.type === "select") ok &&= field.options?.includes(normalized);
        if (field.type === "date") ok &&= validDate(normalized);
      }
    } else if (field.type === "number") {
      ok = typeof value === "number" && Number.isFinite(value) &&
        (field.min === undefined || value >= field.min) &&
        (field.max === undefined || value <= field.max);
    } else if (field.type === "boolean") {
      ok = typeof value === "boolean" && (!field.required || value === true);
    }
    if (ok) output[field.id] = normalized;
    else problems[field.id] = "Invalid value.";
  }
  if (Object.keys(problems).length) {
    throw new OperationsError("invalid_values", 422, "Check the highlighted fields.", problems);
  }
  return output;
}

export function validateReferenceTargets(definition, references, targets, scope) {
  if (!Array.isArray(references) || !Array.isArray(targets) || !isObject(scope)) {
    throw new OperationsError("invalid_reference", 422, "Invalid references.");
  }
  const fields = new Map((definition?.fields || []).filter((field) => field.type === "reference")
    .map((field) => [field.id, field]));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const seen = new Set();
  const output = [];
  for (const ref of references) {
    const field = fields.get(ref?.fieldId);
    const target = targetById.get(ref?.targetId);
    if (!field || !target || seen.has(ref.fieldId) ||
      target.projectId !== scope.projectId || target.eventId !== scope.eventId ||
      target.archivedAt || !field.targetModuleKeys?.includes(target.moduleKey)) {
      throw new OperationsError("invalid_reference", 422, "A reference points outside this module or event.");
    }
    seen.add(ref.fieldId);
    output.push({ fieldId: ref.fieldId, targetId: ref.targetId });
  }
  for (const field of fields.values()) {
    if (field.required && !seen.has(field.id)) {
      throw new OperationsError("invalid_reference", 422, `${field.label || field.id} is required.`);
    }
  }
  return output;
}
