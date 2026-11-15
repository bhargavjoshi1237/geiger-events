import { COLORS, isObject, KEY, LIMITS } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { formulaRefs, parseFormula, renameRefs } from "../formula/index.js";
import { getType } from "./types/index.js";

const badObject = (message) => { throw new WorkspaceError("invalid_object", 422, message); };
const badField = (message) => { throw new WorkspaceError("invalid_field", 422, message); };
const UNIQUE_TYPES = new Set(["short_text", "email", "phone", "url", "number"]);
const NUMERIC_TYPES = new Set(["number", "currency", "percent", "rating", "duration"]);
const ICON = /^[a-z0-9-]{1,40}$/;

export const liveObjects = (definition) => definition.objects.filter((object) => !object.deletedAt);
export const liveFields = (definition, objectId) =>
  definition.fields.filter((field) => field.objectId === objectId && !field.deletedAt);

export function slugify(text) {
  const slug = String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
  return /^[a-z]/.test(slug) ? slug : `f_${slug || "field"}`.slice(0, 50);
}

function uniqueKey(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
}

function label(value, max, fail, what) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) fail(`${what} must be 1–${max} characters.`);
  return value.trim();
}

export function validateObjectInput(input, { definition, objectId = null }) {
  if (!isObject(input)) badObject("Describe the list.");
  const existing = objectId ? definition.objects.find((object) => object.id === objectId) : null;
  const name = label(input.name ?? existing?.name, 100, badObject, "The name");
  const plural = input.plural === undefined && existing ? existing.plural : label(input.plural ?? `${name}s`.replace(/ss$/, "s"), 100, badObject, "The plural name");
  const taken = new Set(definition.objects.filter((object) => object.id !== objectId).map((object) => object.key));
  const key = existing?.key ?? uniqueKey(slugify(name), taken);
  if (!KEY.test(key)) badObject("The list name needs at least one letter.");
  const icon = input.icon ?? existing?.icon ?? "database";
  if (typeof icon !== "string" || !ICON.test(icon)) badObject("Choose an icon.");
  const prefix = input.numberPrefix ?? existing?.numberPrefix ?? (name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "REC");
  if (typeof prefix !== "string" || !/^[A-Z0-9]{1,6}$/.test(prefix)) badObject("Record numbers start with 1–6 capital letters or digits.");
  const statusInput = input.statuses ?? existing?.statuses ?? [];
  if (!Array.isArray(statusInput) || statusInput.length > LIMITS.statuses) badObject(`Add up to ${LIMITS.statuses} statuses.`);
  const keys = new Set();
  const labels = new Set();
  const statuses = statusInput.map((status) => {
    if (!isObject(status)) badObject("Each status needs a name.");
    const text = label(status.label, 60, badObject, "Status names");
    const folded = text.toLowerCase();
    const statusKey = status.key && KEY.test(status.key) ? status.key : uniqueKey(slugify(text), keys);
    if (labels.has(folded) || keys.has(statusKey)) badObject(`The status "${text}" appears twice.`);
    labels.add(folded);
    keys.add(statusKey);
    return { key: statusKey, label: text, color: COLORS.includes(status.color) ? status.color : "gray" };
  });
  let titleFieldId = input.titleFieldId === undefined ? existing?.titleFieldId ?? null : input.titleFieldId;
  if (titleFieldId !== null) {
    const field = definition.fields.find((item) => item.id === titleFieldId && item.objectId === objectId && !item.deletedAt);
    if (!field || (!getType(field.type)?.titleable && field.type !== "formula")) badObject("Choose a text, email or formula field as the title.");
  }
  if (!objectId) titleFieldId = null;
  return { key, name, plural, icon, numberPrefix: prefix, statuses, titleFieldId };
}

// Formulas are written with {Field name} and stored with {field_key} so renames don't break them.
export function formulaForEditing(expression, fields) {
  const byKey = new Map(fields.map((field) => [field.key, field.name]));
  return renameRefs(expression, (ref) => byKey.get(ref) ?? ref);
}

function formulaKeys(expression, fields, selfKey) {
  const byName = new Map(fields.map((field) => [field.name.toLowerCase(), field]));
  const byKey = new Map(fields.map((field) => [field.key, field]));
  let stored;
  try {
    stored = renameRefs(expression, (ref) => {
      const field = byName.get(ref.toLowerCase()) ?? byKey.get(ref);
      if (!field) badField(`The formula refers to {${ref}}, which isn't a field on this list.`);
      if (field.key === selfKey) badField("A formula can't refer to itself.");
      if (!getType(field.type).stored || ["attachments"].includes(field.type)) badField(`{${field.name}} can't be used in a formula.`);
      return field.key;
    });
    parseFormula(stored);
  } catch (error) {
    if (error instanceof WorkspaceError && error.code === "invalid_formula") badField(error.message);
    throw error;
  }
  return stored;
}

function assertNoFormulaCycle(fields, selfKey, expression) {
  const formulas = new Map(fields.filter((field) => field.type === "formula" && field.key !== selfKey)
    .map((field) => [field.key, field.config.expression]));
  formulas.set(selfKey, expression);
  const visiting = new Set();
  const visit = (key) => {
    if (visiting.has(key)) badField("This formula depends on itself through another formula.");
    const source = formulas.get(key);
    if (!source) return;
    visiting.add(key);
    for (const ref of formulaRefs(parseFormula(source))) visit(ref);
    visiting.delete(key);
  };
  visit(selfKey);
}

export function validateFieldInput(input, { definition, objectId, fieldId = null }) {
  if (!isObject(input)) badField("Describe the field.");
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) badField("That list no longer exists.");
  const existing = fieldId ? definition.fields.find((field) => field.id === fieldId) : null;
  const siblings = definition.fields.filter((field) => field.objectId === objectId && field.id !== fieldId);
  const live = siblings.filter((field) => !field.deletedAt);
  if (!existing && live.length >= LIMITS.fields) badField(`A list can have up to ${LIMITS.fields} fields.`);
  const name = label(input.name ?? existing?.name, 100, badField, "Field names");
  if (live.some((field) => field.name.toLowerCase() === name.toLowerCase())) badField(`This list already has a field called "${name}".`);
  const key = existing?.key ?? uniqueKey(slugify(name), new Set(siblings.map((field) => field.key)));
  const typeName = input.type ?? existing?.type;
  const type = getType(typeName);
  if (!type) badField("Choose a field type.");
  let config = type.validateConfig(input.config ?? (existing?.type === typeName ? existing.config : {}));
  const required = input.required ?? existing?.required ?? false;
  const isUnique = input.isUnique ?? existing?.isUnique ?? false;
  if (typeof required !== "boolean" || typeof isUnique !== "boolean") badField("Choose on or off.");
  if (required && !type.editable) badField("Calculated fields can't be required.");
  if (isUnique && !UNIQUE_TYPES.has(typeName)) badField("Only text, email, phone, URL and number fields can be unique.");

  const objectFields = (id) => liveFields(definition, id);
  if (typeName === "link_record" && !liveObjects(definition).some((item) => item.id === config.targetObjectId)) {
    badField("Choose a list to link to.");
  }
  if (typeName === "lookup" || typeName === "rollup") {
    const link = live.find((field) => field.id === config.linkFieldId);
    if (!link || link.type !== "link_record") badField("Choose a link field on this list.");
    if (config.targetFieldId) {
      const target = objectFields(link.config.targetObjectId).find((field) => field.id === config.targetFieldId);
      if (!target || ["link_record", "link_event", "lookup", "rollup", "attachments"].includes(target.type)) badField("Choose a field from the linked list to show.");
      if (typeName === "rollup" && !NUMERIC_TYPES.has(target.type) && !(target.type === "formula" && target.config.result === "number")) {
        badField("Sum, average, minimum and maximum need a number field.");
      }
    }
  }
  if (typeName === "formula") {
    const expression = formulaKeys(config.expression, live, key);
    assertNoFormulaCycle(live, key, expression);
    config = { ...config, expression };
  }
  return { key, name, type: typeName, config, required, isUnique };
}
