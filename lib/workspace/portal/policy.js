import { parseFormula, formulaRefs } from "../formula/index.js";
import { compileQuery } from "../records/query.js";
import { liveFields, liveObjects } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { BUILTIN_ROLES, LEVEL_RANK } from "./contracts.js";
import { ALL, and, compileRule, NONE, or, resolveTokens } from "./rules.js";

const MAX_PARTS = 30;

// Fields a role can't see because they are calculated from something it can't see (formulas, lookups, rollups).
export function derivedHidden(definition, objectId, levels, canView) {
  const fields = liveFields(definition, objectId);
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const hidden = new Set(fields.filter((field) => levels[field.id] === "hidden").map((field) => field.id));
  const reasons = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const field of fields) {
      if (hidden.has(field.id)) continue;
      let because = null;
      if (field.type === "formula") {
        let refs = [];
        try { refs = [...formulaRefs(parseFormula(field.config.expression ?? ""))]; } catch { refs = []; }
        const ref = refs.map((key) => byKey.get(key)).find((source) => source && hidden.has(source.id));
        if (ref) because = ref.name;
      } else if (field.type === "lookup" || field.type === "rollup") {
        const link = fields.find((item) => item.id === field.config.linkFieldId);
        const targetObject = link?.config?.targetObjectId;
        if (!link || hidden.has(link.id)) because = link?.name ?? "a removed link";
        else if (!canView(targetObject, field.config.targetFieldId ?? null)) because = definition.objects.find((item) => item.id === targetObject)?.plural ?? "another list";
      }
      if (because) {
        hidden.add(field.id);
        reasons[field.id] = because;
        changed = true;
      }
    }
  }
  return { hidden, reasons };
}

function baseLevels(definition, object, access) {
  const out = {};
  for (const field of liveFields(definition, object.id)) {
    let level = access.fields?.[field.id] ?? "read";
    if (level === "edit" && !getType(field.type).editable) level = "read";
    if (field.id === object.titleFieldId && level === "hidden") level = "read";
    out[field.id] = level;
  }
  return out;
}

// The viewer's roles: Public visitor always, Anyone signed in once matched to the people list, custom roles by rule.
export function matchedRoles(roles, { person, flags = {} }) {
  return roles.filter((role) => {
    if (role.deletedAt) return false;
    if (role.key === BUILTIN_ROLES.public) return true;
    if (role.key === BUILTIN_ROLES.signedIn) return Boolean(person);
    return Boolean(person) && Boolean(role.membership) && flags[role.id] === true;
  });
}

// Compiles what the viewer may do with every list into database conditions, per role (so access can be decided per record).
export function compilePolicy({ definition, roles, tokens }) {
  const objects = {};
  const viewRoles = new Map();
  for (const object of liveObjects(definition)) {
    for (const role of roles) {
      const access = role.access?.[object.id];
      if (access?.view?.mode && access.view.mode !== "none") {
        if (!viewRoles.has(object.id)) viewRoles.set(object.id, []);
        viewRoles.get(object.id).push({ role, access });
      }
    }
  }
  // A role can see a lookup's source only if it can see that list and that field there.
  const rawLevels = new Map();
  for (const [objectId, list] of viewRoles) {
    const object = definition.objects.find((item) => item.id === objectId);
    for (const { role, access } of list) rawLevels.set(`${role.id}:${objectId}`, baseLevels(definition, object, access));
  }
  const canViewFor = (roleId) => (objectId, fieldId) => {
    const levels = rawLevels.get(`${roleId}:${objectId}`);
    if (!levels) return false;
    return fieldId ? (levels[fieldId] ?? "hidden") !== "hidden" : true;
  };

  for (const object of liveObjects(definition)) {
    const policy = { objectId: object.id, view: [], create: [], edit: [], delete: [], comment: [], levels: {}, reasons: {}, queryable: [], visible: [] };
    const rule = (access) => (access.mode === "all" ? ALL : compileRule(definition, object.id, resolveTokens(access.filter, tokens)));
    for (const role of roles) {
      const access = role.access?.[object.id];
      if (!access) continue;
      const viewing = access.view?.mode && access.view.mode !== "none";
      if (viewing) {
        const levels = { ...rawLevels.get(`${role.id}:${object.id}`) };
        const { hidden, reasons } = derivedHidden(definition, object.id, levels, canViewFor(role.id));
        for (const id of hidden) levels[id] = "hidden";
        Object.assign(policy.reasons, reasons);
        policy.levels[role.id] = levels;
        const view = rule(access.view);
        const editable = Object.entries(levels).filter(([, level]) => level === "edit").map(([id]) => id);
        policy.view.push({ roleId: role.id, condition: view });
        if (access.edit?.mode && access.edit.mode !== "none") {
          policy.edit.push({ roleId: role.id, condition: and(view, rule(access.edit)), after: view, fields: editable, status: access.status === true });
        }
        if (access.delete?.mode && access.delete.mode !== "none") policy.delete.push({ roleId: role.id, condition: and(view, rule(access.delete)) });
        if (access.comment) policy.comment.push({ roleId: role.id, condition: view });
        if (access.create?.mode === "all") policy.create.push({ roleId: role.id, after: view, fields: editable, status: false });
      } else if (access.create?.mode === "all") {
        // Add-only access (a feedback form): nothing to see afterwards, so the new record only has to exist.
        const levels = baseLevels(definition, object, access);
        policy.create.push({ roleId: role.id, after: ALL, fields: Object.entries(levels).filter(([, level]) => level === "edit").map(([id]) => id), status: false });
      }
    }
    const sets = Object.values(policy.levels).map((levels) => new Set(Object.entries(levels).filter(([, level]) => level !== "hidden").map(([id]) => id)));
    policy.visible = [...new Set(sets.flatMap((set) => [...set]))];
    policy.queryable = sets.length ? [...sets[0]].filter((id) => sets.every((set) => set.has(id))) : [];
    objects[object.id] = policy;
  }
  return { roleIds: roles.map((role) => role.id), objects };
}

export const canView = (objectPolicy) => Boolean(objectPolicy?.view.length);

// Read-plan additions: rows visible to any role, and per-row flags saying which roles' rules each row matches.
export function readPlan(objectPolicy) {
  if (!objectPolicy?.view.length) return { policy: NONE, policyParts: [], parts: [] };
  const parts = [];
  const add = (kind, item) => { if (parts.length < MAX_PARTS) parts.push({ alias: `p${parts.length}`, kind, roleId: item.roleId, condition: item.condition }); };
  objectPolicy.view.forEach((item) => add("view", item));
  objectPolicy.edit.forEach((item) => add("edit", item));
  objectPolicy.delete.forEach((item) => add("delete", item));
  objectPolicy.comment.forEach((item) => add("comment", item));
  return {
    policy: or(objectPolicy.view.map((item) => item.condition)),
    policyParts: parts.map(({ alias, condition }) => ({ alias, condition })),
    parts,
  };
}

// What the viewer may do with one row, given the flags the database returned for it.
export function rowAccess(objectPolicy, parts, flags = {}) {
  const matched = parts.filter((part) => flags[part.alias] === true);
  const levels = {};
  for (const part of matched.filter((item) => item.kind === "view")) {
    for (const [fieldId, level] of Object.entries(objectPolicy.levels[part.roleId] ?? {})) {
      if ((LEVEL_RANK[level] ?? 0) > (LEVEL_RANK[levels[fieldId]] ?? -1)) levels[fieldId] = level;
    }
  }
  const editRoles = new Set(matched.filter((item) => item.kind === "edit").map((item) => item.roleId));
  const editable = new Set();
  let status = false;
  for (const item of objectPolicy.edit.filter((entry) => editRoles.has(entry.roleId))) {
    item.fields.forEach((id) => { if (levels[id] && levels[id] !== "hidden") editable.add(id); });
    status ||= item.status;
  }
  for (const [fieldId, level] of Object.entries(levels)) if (level === "edit" && !editable.has(fieldId)) levels[fieldId] = "read";
  return {
    levels,
    editable: [...editable],
    status,
    delete: matched.some((item) => item.kind === "delete"),
    comment: matched.some((item) => item.kind === "comment"),
  };
}

// The database guard for one list: every role's rule for each action, and the fields it may write.
// `defaults` are fields a form sets on the viewer's behalf (e.g. “Reviewer = me”), allowed on create only.
export function guardFor(definition, objectPolicy, { defaults = [] } = {}) {
  const { computed } = compileQuery(definition, objectPolicy.objectId, { limit: 1 });
  return {
    objectId: objectPolicy.objectId,
    computed,
    create: objectPolicy.create.map((item) => ({ after: item.after, fields: [...new Set([...item.fields, ...defaults])], status: false })),
    edit: objectPolicy.edit.map((item) => ({ condition: item.condition, after: item.after, fields: item.fields, status: item.status })),
    delete: objectPolicy.delete.map((item) => ({ condition: item.condition })),
    comment: objectPolicy.comment.map((item) => ({ condition: item.condition })),
  };
}

// Staff (team pages) see everything; a stand-in policy keeps one code path.
export function staffObjectPolicy(definition, objectId) {
  const levels = Object.fromEntries(liveFields(definition, objectId).map((field) => [field.id, getType(field.type).editable ? "edit" : "read"]));
  const ids = Object.keys(levels);
  return { objectId, staff: true, view: [{ roleId: "staff", condition: ALL }], create: [], edit: [], delete: [], comment: [], levels: { staff: levels }, reasons: {}, queryable: ids, visible: ids };
}
