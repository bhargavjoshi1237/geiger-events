import { WorkspaceError } from "../errors.js";
import { validateDocument } from "../documents/model.js";
import { compileQuery } from "../records/query.js";
import { liveFields, validateFieldInput, validateObjectInput } from "../schema/definition.js";
import { validateRoleInput } from "../portal/roles.js";
import { validatePageInput } from "../portal/pages.js";
import { validateReviewSetup } from "../process/review.js";
import { validateProcess } from "../process/stages.js";
import { validateSteps } from "../process/steps.js";
import { subjectOf, validateTrigger } from "../process/triggers.js";
import { resolveRefs } from "./refs.js";

// Templates and snapshots install in one order, each part through the normal checks:
// lists and fields → stage rules → review setups → documents → automations (always off) → portal settings, roles, pages.
// `extras` = { processes, reviewSetups, documents, automations, portal: { patch, roles, pages } }.

const describe = (error) => (error instanceof WorkspaceError ? error.message : "Something went wrong.");

// A template's lists as a copy snapshot (the format the copy service already knows how to create).
export function templateSnapshot(template) {
  return {
    version: 1, attachments: false,
    objects: template.lists.map((list) => ({
      ...list, sourceId: `tpl:${list.key}`, mode: "structure", viewId: null,
      fields: list.fields.map((field) => ({ ...field, sourceId: `tpl:${list.key}.${field.key}` })),
    })),
  };
}

// What a template contains, for the setup gallery.
export function templateSummary(template) {
  const extras = template.extras ?? {};
  return {
    key: template.key, name: template.name, description: template.description, icon: template.icon ?? "layout-template",
    lists: template.lists.map((list) => list.plural),
    stageRules: (extras.processes ?? []).length, automations: (extras.automations ?? []).map((item) => item.name),
    reviewSetups: (extras.reviewSetups ?? []).map((item) => item.name), documents: (extras.documents ?? []).map((item) => item.name),
    portalPages: (extras.portal?.pages ?? []).map((page) => page.title), roles: (extras.portal?.roles ?? []).map((role) => role.name),
  };
}

// Installs the extras through the services (deps: process, documents, portal, processStore, documentStore, portalStore).
export async function installExtras(context, extras, maps, deps) {
  const notes = [];
  const counts = { stageRules: 0, reviewSetups: 0, documents: 0, automations: 0, roles: 0, pages: 0 };
  const resolve = (value, what) => {
    const { value: out, missing } = resolveRefs(value, maps);
    if (missing.length) { notes.push(`${what} was skipped: it refers to ${missing.join(", ")}, which isn't here.`); return null; }
    return out;
  };
  const attempt = async (what, work) => {
    try { await work(); return true; } catch (error) {
      if (!(error instanceof WorkspaceError)) console.error("[workspace.templates]", what, error);
      notes.push(`${what}: ${describe(error)}`);
      return false;
    }
  };

  for (const item of extras.processes ?? []) {
    const value = resolve(item, "Stage rules");
    if (value && await attempt("Stage rules", () => deps.process.saveProcess(context, { objectId: value.list, config: value.config }))) counts.stageRules += 1;
  }

  const setups = new Map((await deps.processStore.reviewSetups(context).catch(() => [])).map((setup) => [setup.name.toLowerCase(), setup]));
  for (const item of extras.reviewSetups ?? []) {
    const config = resolve(item.config, `Review “${item.name}”`);
    if (!config) continue;
    await attempt(`Review “${item.name}”`, async () => {
      const { setup } = await deps.process.saveReviewSetup(context, { id: setups.get(item.name.toLowerCase())?.id, setup: { name: item.name, config } });
      maps.review.set(item.name, setup.id);
      counts.reviewSetups += 1;
    });
  }

  const documents = new Map((await deps.documentStore.documents(context).catch(() => [])).map((doc) => [`${doc.kind}:${doc.name.toLowerCase()}`, doc]));
  for (const item of extras.documents ?? []) {
    const value = resolve(item, `Document “${item.name}”`);
    if (!value) continue;
    await attempt(`Document “${item.name}”`, async () => {
      const existing = documents.get(`${item.kind}:${item.name.toLowerCase()}`);
      const { document } = await deps.documents.save(context, { id: existing?.id, document: value });
      maps.doc.set(item.name, document.id);
      counts.documents += 1;
    });
  }

  const automations = new Map((await deps.processStore.automations(context).catch(() => [])).map((automation) => [automation.name.toLowerCase(), automation]));
  for (const item of extras.automations ?? []) {
    const value = resolve(item, `Automation “${item.name}”`);
    if (!value) continue;
    await attempt(`Automation “${item.name}”`, async () => {
      await deps.process.saveAutomation(context, { id: automations.get(item.name.toLowerCase())?.id, automation: { ...value, enabled: false } });
      counts.automations += 1;
    });
  }

  const portal = extras.portal;
  if (portal) {
    const patch = portal.patch ? resolve(portal.patch, "Portal settings") : null;
    const ready = patch ? await attempt("Portal settings", () => deps.portal.command(context, { action: "portal.update", patch })) : Boolean(await deps.portalStore.portal(context).catch(() => null));
    if (ready) {
      const roles = new Map((await deps.portalStore.roles(context)).filter((role) => !role.deletedAt).map((role) => [role.name.toLowerCase(), role]));
      for (const item of portal.roles ?? []) {
        const { ref, builtin, ...input } = item;
        const existing = roles.get(item.name.toLowerCase());
        // Built-in roles (Public visitor, Anyone signed in) only take their access; they're never created as copies.
        if (builtin && !existing?.builtin) continue;
        const value = resolve(input, `Role “${item.name}”`);
        if (!value) continue;
        await attempt(`Role “${item.name}”`, async () => {
          const result = await deps.portal.command(context, { action: "role.save", role: { ...value, ...(existing ? { id: existing.id } : {}) } });
          maps.role.set(ref, result.role?.id ?? existing?.id);
          counts.roles += 1;
        });
      }
      const pages = await deps.portalStore.pages(context);
      for (const item of portal.pages ?? []) {
        const value = resolve(item, `Page “${item.title}”`);
        if (!value) continue;
        await attempt(`Page “${item.title}”`, async () => {
          const existing = pages.find((page) => !page.deletedAt && (value.kind === "record" ? page.kind === "record" && page.objectId === value.objectId : page.kind === "page" && page.slug === value.slug));
          await deps.portal.command(context, { action: "page.save", page: { ...value, ...(existing ? { id: existing.id } : {}) } });
          counts.pages += 1;
        });
      }
    }
  }
  return { counts, notes };
}

// Maps for resolving references, from the copy service's key → id maps.
export function installMaps({ objectIds, fieldIds }, me) {
  return {
    list: new Map(objectIds),
    field: new Map([...fieldIds].map(([key, id]) => [key.replace(":", "."), id])),
    role: new Map(), doc: new Map(), review: new Map(), me,
  };
}

// Builds the template in memory and runs every part through the same validators, without a database.
// Returns the problems found (an empty list means it installs as data only).
export function dryRun(template, { me = "00000000-0000-4000-8000-0000000000ff" } = {}) {
  const problems = [];
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, "0")}`;
  const definition = { objects: [], fields: [], views: [] };
  const maps = { list: new Map(), field: new Map(), role: new Map(), doc: new Map(), review: new Map(), me };
  const check = (what, work) => {
    try { return work(); } catch (error) { problems.push(`${what}: ${error.message}`); return null; }
  };

  template.lists.forEach((list, position) => {
    const objectId = id();
    const object = check(`List ${list.key}`, () => validateObjectInput({ name: list.name, plural: list.plural, icon: list.icon, numberPrefix: list.numberPrefix, statuses: list.statuses }, { definition }));
    if (!object) return;
    if (object.statuses.some((status, i) => status.key !== list.statuses[i].key)) problems.push(`List ${list.key}: a status key isn't valid.`);
    definition.objects.push({ ...object, key: list.key, id: objectId, position, deletedAt: null, titleFieldId: null });
    maps.list.set(list.key, objectId);
  });
  const order = { link_record: 1, formula: 2, lookup: 3, rollup: 3 };
  for (const list of template.lists) {
    const objectId = maps.list.get(list.key);
    if (!objectId) continue;
    for (const field of [...list.fields].sort((a, b) => (order[a.type] ?? 0) - (order[b.type] ?? 0))) {
      const config = { ...field.config };
      if (field.type === "link_record") { config.targetObjectId = maps.list.get(config.targetObjectKey); delete config.targetObjectKey; }
      if (field.type === "lookup" || field.type === "rollup") {
        const link = list.fields.find((item) => item.key === config.linkFieldKey);
        config.linkFieldId = maps.field.get(`${list.key}.${config.linkFieldKey}`);
        if (config.targetFieldKey) config.targetFieldId = maps.field.get(`${link?.config.targetObjectKey}.${config.targetFieldKey}`);
        delete config.linkFieldKey;
        delete config.targetFieldKey;
      }
      const input = check(`Field ${list.key}.${field.key}`, () => validateFieldInput({ name: field.name, type: field.type, config, required: field.required, isUnique: field.isUnique }, { definition, objectId }));
      if (!input) continue;
      if (!/^[a-z][a-z0-9_]{0,62}$/.test(field.key)) problems.push(`Field ${list.key}.${field.key}: the key isn't valid.`);
      const fieldId = id();
      definition.fields.push({ ...input, key: field.key, id: fieldId, objectId, position: definition.fields.length, deletedAt: null, revision: 1 });
      maps.field.set(`${list.key}.${field.key}`, fieldId);
    }
    const object = definition.objects.find((item) => item.id === objectId);
    object.titleFieldId = maps.field.get(`${list.key}.${list.titleFieldKey}`) ?? null;
    if (list.titleFieldKey && !object.titleFieldId) problems.push(`List ${list.key}: the title field ${list.titleFieldKey} doesn't exist.`);
  }

  const resolve = (value, what) => {
    const { value: out, missing } = resolveRefs(value, maps);
    if (missing.length) { problems.push(`${what}: unknown ${missing.join(", ")}`); return null; }
    return out;
  };
  const extras = template.extras ?? {};
  for (const item of extras.processes ?? []) {
    const value = resolve(item, "Stage rules");
    if (value) check(`Stage rules for ${item.list}`, () => {
      const clean = validateProcess(definition, value.list, value.config);
      if (clean.moves.length !== value.config.moves.length) throw new Error("some moves refer to statuses that don't exist");
      if (Object.values(clean.requires).flat().length !== Object.values(value.config.requires ?? {}).flat().length) throw new Error("some required fields can't be required");
    });
  }
  for (const item of extras.reviewSetups ?? []) {
    const config = resolve(item.config, `Review ${item.name}`);
    if (config && check(`Review ${item.name}`, () => validateReviewSetup(definition, config))) maps.review.set(item.name, id());
  }
  const documents = new Map();
  for (const item of extras.documents ?? []) {
    const value = resolve(item, `Document ${item.name}`);
    const clean = value && check(`Document ${item.name}`, () => validateDocument(definition, value));
    if (clean) { const docId = id(); maps.doc.set(item.name, docId); documents.set(docId, { ...clean, id: docId }); }
  }
  for (const item of extras.automations ?? []) {
    const value = resolve(item, `Automation ${item.name}`);
    if (!value) continue;
    check(`Automation ${item.name}`, () => {
      const trigger = validateTrigger(definition, value.trigger);
      const subjectId = subjectOf(trigger);
      validateSteps(definition, value.steps, {
        subjectId, payload: trigger.kind === "hook" || trigger.kind === "checkin", members: new Set([me]), reviewSetups: new Set(maps.review.values()), documents,
      });
      if (value.condition) compileQuery(definition, subjectId, { filter: value.condition, limit: 1 });
    });
  }
  const portal = extras.portal;
  if (portal) {
    const patch = portal.patch ? resolve(portal.patch, "Portal settings") : null;
    const people = patch ? liveFields(definition, patch.peopleObjectId).find((field) => field.id === patch.emailFieldId) : null;
    if (patch && (!people || people.type !== "email" || !people.isUnique)) problems.push("Portal settings: the people list needs a unique email field.");
    const roles = [];
    for (const item of portal.roles ?? []) {
      const { ref, builtin: _builtin, ...input } = item;
      const value = resolve(input, `Role ${item.name}`);
      const role = value && check(`Role ${item.name}`, () => validateRoleInput(value, { definition, portal: { peopleObjectId: patch?.peopleObjectId }, roles }));
      if (role) { const roleId = id(); roles.push({ ...role, id: roleId, deletedAt: null }); maps.role.set(ref, roleId); }
    }
    const pages = [];
    for (const item of portal.pages ?? []) {
      const value = resolve(item, `Page ${item.title}`);
      const page = value && check(`Page ${item.title}`, () => validatePageInput(value, { definition, roles, pages }));
      if (page) pages.push({ ...page, id: id(), deletedAt: null });
    }
  }
  return problems;
}
