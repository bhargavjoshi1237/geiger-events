import { COLORS, isObject, KEY } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields, slugify } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { ACCESS_MODES, BUILTIN_ROLES, FIELD_LEVELS, PORTAL_LIMITS } from "./contracts.js";
import { compileRule, DRY_TOKENS, resolveTokens } from "./rules.js";

const bad = (message, fields) => { throw new WorkspaceError("invalid_role", 422, message, fields); };

function text(value, max, message) {
  const out = typeof value === "string" ? value.trim() : "";
  if (!out || out.length > max) bad(message);
  return out;
}

function checkRule(definition, objectId, filter, label) {
  if (filter === null || filter === undefined) return null;
  try {
    compileRule(definition, objectId, resolveTokens(filter, DRY_TOKENS));
  } catch (error) {
    if (error instanceof WorkspaceError) bad(`${label}: ${error.message}`);
    throw error;
  }
  return filter;
}

function rule(definition, objectId, input, { label, modes = ACCESS_MODES }) {
  if (input === undefined || input === null) return { mode: "none" };
  if (!isObject(input) || !modes.includes(input.mode)) bad(`${label}: choose who this applies to.`);
  if (input.mode !== "where") return { mode: input.mode };
  const filter = checkRule(definition, objectId, input.filter ?? null, label);
  if (!filter) bad(`${label}: add at least one condition.`);
  return { mode: "where", filter };
}

// What one role may do with one list: each action's rule, comments, status changes and each field's visibility.
export function validateAccess(definition, objectId, input) {
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) bad("A role refers to a list that no longer exists.");
  if (!isObject(input)) bad(`Choose what this role can do with ${object.plural}.`);
  const fields = liveFields(definition, objectId);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const levels = {};
  if (input.fields !== undefined) {
    if (!isObject(input.fields)) bad("Choose who sees each field.");
    for (const [fieldId, level] of Object.entries(input.fields)) {
      const field = byId.get(fieldId);
      if (!field) continue;
      if (!FIELD_LEVELS.includes(level)) bad(`Choose hidden, read-only or editable for ${field.name}.`);
      if (fieldId === object.titleFieldId && level === "hidden") bad(`${field.name} names each record, so it can't be hidden.`);
      levels[fieldId] = level === "edit" && !getType(field.type).editable ? "read" : level;
    }
  }
  const out = {
    view: rule(definition, objectId, input.view, { label: `Seeing ${object.plural}` }),
    create: rule(definition, objectId, input.create, { label: `Adding ${object.plural}`, modes: ["none", "all"] }),
    edit: rule(definition, objectId, input.edit, { label: `Editing ${object.plural}` }),
    delete: rule(definition, objectId, input.delete, { label: `Deleting ${object.plural}` }),
    comment: input.comment === true,
    status: input.status === true,
    fields: levels,
  };
  if (out.view.mode === "none") {
    out.edit = { mode: "none" };
    out.delete = { mode: "none" };
    out.comment = false;
    out.status = false;
  }
  return out;
}

// Validates a role from the builder. Built-in roles keep their key and never get a membership rule.
export function validateRoleInput(input, { definition, portal, roles, roleId = null }) {
  if (!isObject(input)) bad("Describe the role.");
  const existing = roleId ? roles.find((role) => role.id === roleId && !role.deletedAt) : null;
  if (roleId && !existing) throw new WorkspaceError("not_found", 404, "That role no longer exists.");
  const live = roles.filter((role) => !role.deletedAt);
  if (!existing && live.length >= PORTAL_LIMITS.roles + 2) bad(`A portal can have up to ${PORTAL_LIMITS.roles} roles.`);
  const name = text(input.name ?? existing?.name, 60, "Name the role (up to 60 characters).");
  if (live.some((role) => role.id !== roleId && role.name.toLowerCase() === name.toLowerCase())) bad(`There's already a role called “${name}”.`);
  const icon = input.icon === undefined ? existing?.icon ?? "user" : text(input.icon, 60, "Choose an icon.");
  const color = input.color ?? existing?.color ?? "gray";
  if (!COLORS.includes(color)) bad("Choose one of the colours.");

  let key = existing?.key;
  if (!existing) {
    const taken = new Set(roles.map((role) => role.key));
    const base = (slugify(name).replace(/-/g, "_").replace(/^[^a-z]+/, "") || "role").slice(0, 50);
    key = base;
    for (let n = 2; taken.has(key) || Object.values(BUILTIN_ROLES).includes(key); n++) key = `${base}_${n}`;
    if (!KEY.test(key)) bad("Choose a different name.");
  }

  let membership = existing?.membership ?? null;
  if (existing?.builtin) membership = null;
  else if (input.membership !== undefined) {
    if (!portal?.peopleObjectId) bad("Choose the people list first.");
    membership = checkRule(definition, portal.peopleObjectId, input.membership, "Who has this role");
  }

  let access = existing?.access ?? {};
  if (input.access !== undefined) {
    if (!isObject(input.access)) bad("Choose what this role can do.");
    access = {};
    for (const [objectId, value] of Object.entries(input.access)) {
      if (!definition.objects.some((object) => object.id === objectId && !object.deletedAt)) continue;
      access[objectId] = validateAccess(definition, objectId, value);
    }
  }
  return { key, name, icon, color, membership, access };
}
