import { WorkspaceError } from "../errors.js";
import { formulaRefs, parseFormula } from "../formula/index.js";
import { liveFields, liveObjects } from "./definition.js";
import { convertValue, getType } from "./types/index.js";

const UNCONVERTIBLE = new Set(["link_record", "link_event", "attachments", "formula", "lookup", "rollup"]);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What a field change does to existing values; `conversions` lists only values that change.
export function analyseFieldChange(field, patch, values) {
  const nextType = patch.type ?? field.type;
  const target = getType(nextType);
  if (nextType !== field.type && (UNCONVERTIBLE.has(field.type) || UNCONVERTIBLE.has(nextType))) {
    throw new WorkspaceError("invalid_field", 422, "This field can't change to that type. Add a new field instead.");
  }
  const nextConfig = target.validateConfig(patch.config ?? (nextType === field.type ? field.config : {}));
  const result = { converts: 0, clears: 0, examples: [], conversions: [], destructive: false };
  if (!target.stored || UNCONVERTIBLE.has(nextType)) return result;
  for (const { recordId, value } of values) {
    if (value === null || value === undefined) continue;
    const converted = convertValue(field.type, field.config, nextType, nextConfig, value);
    if (!converted.ok || converted.value === null) {
      result.clears++;
      result.conversions.push({ recordId, value: null });
      if (result.examples.length < 5) result.examples.push({ recordId, from: getType(field.type).toText(value, field.config) });
    } else if (!sameJson(converted.value, value)) {
      result.converts++;
      result.conversions.push({ recordId, value: converted.value });
    }
  }
  result.destructive = result.clears > 0;
  return result;
}

function dependants(definition, field) {
  const reasons = [];
  for (const other of definition.fields) {
    if (other.deletedAt || other.id === field.id) continue;
    if (other.type === "formula" && other.objectId === field.objectId &&
      formulaRefs(parseFormula(other.config.expression)).has(field.key)) reasons.push(`the formula ${other.name}`);
    if ((other.type === "lookup" || other.type === "rollup") &&
      (other.config.linkFieldId === field.id || other.config.targetFieldId === field.id)) reasons.push(`the ${other.type} ${other.name}`);
  }
  return reasons;
}

export function analyseFieldDelete(field, definition) {
  const object = definition.objects.find((item) => item.id === field.objectId);
  if (object?.titleFieldId === field.id) return { blocked: "This is the list's title field. Choose another title field first." };
  const reasons = dependants(definition, field);
  return { blocked: reasons.length ? `Used by ${reasons.join(", ")}. Change ${reasons.length > 1 ? "those" : "that"} first.` : null };
}

export function analyseObjectDelete(object, definition) {
  const links = [];
  for (const other of liveObjects(definition)) {
    if (other.id === object.id) continue;
    for (const field of liveFields(definition, other.id)) {
      if (field.type === "link_record" && field.config.targetObjectId === object.id) links.push(`${other.plural} (${field.name})`);
    }
  }
  return { blocked: links.length ? `${links.join(", ")} link to this list. Delete or change ${links.length > 1 ? "those fields" : "that field"} first.` : null };
}
