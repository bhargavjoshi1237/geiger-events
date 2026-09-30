import {
  CAPABILITIES, FIELD_TYPES, isObject, OPERATIONS_LIMITS,
  RECORD_VIEWS, RESERVED_KEYS, STABLE_KEY,
} from "../contracts.js";
import { OperationsError } from "../errors.js";

const fail = (code, message) => { throw new OperationsError(code, 422, message); };
const keyOk = (value) => typeof value === "string" && STABLE_KEY.test(value) && !RESERVED_KEYS.has(value);
const labelOk = (value) => typeof value === "string" && value.trim().length > 0 &&
  value.trim().length <= OPERATIONS_LIMITS.title;
const onlyKeys = (input, keys) => Object.keys(input).every((key) => keys.includes(key));

function validateField(field, fieldIds) {
  if (!isObject(field) || !onlyKeys(field,
    ["id", "label", "type", "required", "options", "min", "max", "targetModuleKeys", "showWhen"]) ||
    !keyOk(field.id) || !labelOk(field.label) || !FIELD_TYPES.includes(field.type)) {
    fail("invalid_definition", "Invalid field definition.");
  }
  if (fieldIds.has(field.id)) fail("duplicate_field", `Duplicate field ID: ${field.id}.`);
  fieldIds.add(field.id);
  if (field.required !== undefined && typeof field.required !== "boolean") {
    fail("invalid_definition", "Field required must be a boolean.");
  }
  if (field.type === "select") {
    if (!Array.isArray(field.options) || !field.options.length ||
      field.options.length > OPERATIONS_LIMITS.options ||
      field.options.some((option) => !labelOk(option)) ||
      new Set(field.options).size !== field.options.length) {
      fail("invalid_definition", "Select options must be unique short labels.");
    }
  } else if (field.options !== undefined) fail("invalid_definition", "Options need a select field.");
  if (field.type === "number") {
    for (const bound of ["min", "max"]) {
      if (field[bound] !== undefined && (typeof field[bound] !== "number" || !Number.isFinite(field[bound]))) {
        fail("invalid_definition", "Numeric bounds must be finite.");
      }
    }
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      fail("invalid_definition", "Minimum exceeds maximum.");
    }
  } else if (field.min !== undefined || field.max !== undefined) {
    fail("invalid_definition", "Bounds need a number field.");
  }
  if (field.type === "reference") {
    if (!Array.isArray(field.targetModuleKeys) || !field.targetModuleKeys.length ||
      field.targetModuleKeys.some((key) => !keyOk(key)) ||
      new Set(field.targetModuleKeys).size !== field.targetModuleKeys.length) {
      fail("invalid_definition", "References need allowed target modules.");
    }
  } else if (field.targetModuleKeys !== undefined) {
    fail("invalid_definition", "Target modules need a reference field.");
  }
  if (field.showWhen && (!isObject(field.showWhen) ||
    !onlyKeys(field.showWhen, ["fieldId", "equals"]) ||
    !keyOk(field.showWhen.fieldId) || field.showWhen.fieldId === field.id ||
    !["string", "number", "boolean"].includes(typeof field.showWhen.equals))) {
    fail("invalid_definition", "Invalid visibility condition.");
  }
}

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

export function validateDefinition(input, implemented = new Set(["records", "forms"])) {
  if (!isObject(input) || !onlyKeys(input,
    ["key", "version", "label", "capabilities", "fields", "states", "transitions", "views", "sourceKind", "titleFieldId", "requires", "enabled"]) ||
    !keyOk(input.key) || !labelOk(input.label) ||
    !Number.isSafeInteger(input.version) || input.version < 1 ||
    !Array.isArray(input.capabilities) || !input.capabilities.includes("records") ||
    new Set(input.capabilities).size !== input.capabilities.length ||
    !Array.isArray(input.fields) || input.fields.length > OPERATIONS_LIMITS.fields ||
    !Array.isArray(input.states) || !input.states.length ||
    !Array.isArray(input.transitions) || !Array.isArray(input.views) || !input.views.length) {
    fail("invalid_definition", "Invalid module definition.");
  }
  if (input.capabilities.some((key) => !CAPABILITIES.includes(key) || !implemented.has(key))) {
    fail("unknown_capability", "A module requests an unavailable capability.");
  }
  const fieldIds = new Set();
  input.fields.forEach((field) => validateField(field, fieldIds));
  if (input.sourceKind !== undefined && !["native", "custom"].includes(input.sourceKind)) {
    fail("invalid_definition", "Unknown module source.");
  }
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    fail("invalid_definition", "Module enabled must be a boolean.");
  }
  if (input.requires !== undefined && (!Array.isArray(input.requires) ||
    input.requires.some((dependency) => !isObject(dependency) ||
      !onlyKeys(dependency, ["providerKey", "capability"]) ||
      !keyOk(dependency.providerKey) || typeof dependency.capability !== "string"))) {
    fail("invalid_definition", "Invalid module dependencies.");
  }
  if (input.titleFieldId !== undefined && !fieldIds.has(input.titleFieldId)) {
    fail("invalid_definition", "Title field does not exist.");
  }
  const states = new Set();
  for (const state of input.states) {
    if (!isObject(state) || !onlyKeys(state, ["key", "label"]) ||
      !keyOk(state.key) || !labelOk(state.label) || states.has(state.key)) {
      fail("invalid_definition", "Invalid or duplicate state.");
    }
    states.add(state.key);
  }
  const transitions = new Set();
  for (const transition of input.transitions) {
    if (!isObject(transition) || !onlyKeys(transition, ["from", "to"]) ||
      !states.has(transition.from) || !states.has(transition.to) ||
      transition.from === transition.to) fail("invalid_transition", "Invalid state transition.");
    const key = `${transition.from}:${transition.to}`;
    if (transitions.has(key)) fail("invalid_transition", "Duplicate state transition.");
    transitions.add(key);
  }
  if (input.views.some((view) => !RECORD_VIEWS.includes(view)) ||
    new Set(input.views).size !== input.views.length) {
    fail("invalid_definition", "Unsupported module view.");
  }
  const byId = new Map(input.fields.map((field) => [field.id, field]));
  for (const field of input.fields) {
    if (field.showWhen && (!byId.has(field.showWhen.fieldId) ||
      byId.get(field.showWhen.fieldId).type === "reference")) {
      fail("invalid_definition", "Visibility condition references an unknown field.");
    }
    const seen = new Set([field.id]);
    let next = field.showWhen?.fieldId;
    while (next) {
      if (seen.has(next)) fail("invalid_definition", "Visibility conditions must not cycle.");
      seen.add(next);
      next = byId.get(next)?.showWhen?.fieldId;
    }
  }
  return freezeDeep(structuredClone(input));
}
