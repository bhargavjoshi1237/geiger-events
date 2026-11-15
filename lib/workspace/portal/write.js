import { createHash, randomUUID } from "node:crypto";
import { isObject, LIMITS, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { normaliseRecordInput } from "../records/values.js";
import { liveFields } from "../schema/definition.js";
import { acceptsType } from "../schema/types/links.js";
import { workspaceStore } from "../server/store.js";
import { TOKENS } from "./contracts.js";
import { canView, guardFor } from "./policy.js";
import { allowedMoves, checkMove, cleanProcess, moveError } from "../process/stages.js";
import { ALL } from "./rules.js";
import { portalStore } from "./store.js";

const forbidden = (message) => new WorkspaceError("forbidden", 403, message);
const bad = (message, fields) => new WorkspaceError("invalid_input", 422, message, fields);
const hash = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");
const isEmpty = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);

export function createPortalWrites({ store = portalStore, workspace = workspaceStore, reads, rebuild }) {
  const processOf = (viewer, objectId) => {
    const config = viewer.processes?.get?.(objectId);
    return config?.enforce ? cleanProcess(viewer.definition, objectId, config) : null;
  };
  const objectOf = (viewer, objectId) => viewer.definition.objects.find((object) => object.id === objectId && !object.deletedAt);

  // A new record's first status: the form's choice, else the first stage new records may start in.
  function startStatus(viewer, objectId, chosen) {
    if (chosen) return chosen;
    const process = processOf(viewer, objectId);
    return process ? allowedMoves(process, objectOf(viewer, objectId), null)[0] ?? null : undefined;
  }

  function guardMove(viewer, objectId, move) {
    const process = processOf(viewer, objectId);
    if (!process) return;
    const problem = checkMove(process, objectOf(viewer, objectId), { ...move, fields: liveFields(viewer.definition, objectId) });
    if (problem) throw moveError(problem);
  }
  function writer(viewer) {
    if (viewer.mode !== "portal") throw forbidden("Previews are read-only.");
    if (!viewer.member?.id) throw new WorkspaceError("sign_in_required", 401, "Sign in to continue.");
  }

  async function send(viewer, guard, action, payload, commandId) {
    const id = UUID.test(commandId ?? "") ? commandId.toLowerCase() : randomUUID();
    return store.portalCommand(viewer.context, {
      memberId: viewer.member.id, personId: viewer.person?.id ?? null, guard,
      command: { action, commandId: id, requestHash: hash({ action, ...payload }), ...payload },
    });
  }

  // Files on a portal write must already be on the record or be ones this person uploaded.
  async function checkFiles(viewer, objectId, values, existing = null) {
    const ids = [];
    for (const field of liveFields(viewer.definition, objectId).filter((item) => item.type === "attachments")) {
      if (!Array.isArray(values[field.id])) continue;
      const before = new Set((existing?.values?.[field.id] ?? []).map((file) => file.id));
      for (const file of values[field.id]) if (isObject(file) && UUID.test(file.id ?? "") && !before.has(file.id)) ids.push(file.id);
    }
    if (!ids.length) return;
    const mine = new Set(await store.filesCreatedBy(viewer.context, viewer.member.id, ids));
    if (ids.some((id) => !mine.has(id))) throw forbidden("Attach files by uploading them here.");
  }

  // Linked records must be ones the viewer can see (or themselves), so links can't point at hidden records.
  async function checkLinks(viewer, objectId, links, allowed = new Set()) {
    for (const link of links) {
      const field = liveFields(viewer.definition, objectId).find((item) => item.id === link.fieldId);
      if (!field) continue;
      if (field.type === "link_event") {
        if (link.targets.length) throw forbidden(`${field.name} can only be set by the organisers.`);
        continue;
      }
      const ids = link.targets.map((target) => target.id).filter((id) => !allowed.has(id));
      if (!ids.length) continue;
      const targetId = field.config.targetObjectId;
      for (const id of ids) {
        if (!(await reads.findRecord(viewer, targetId, { id }))) throw forbidden(`Choose ${field.name} from the records you can see.`);
      }
    }
  }

  // Automatic values a form sets for the viewer, with tokens filled in.
  function defaultsFor(viewer, objectId, defaults, recordId = null) {
    const byId = new Map(liveFields(viewer.definition, objectId).map((field) => [field.id, field]));
    const values = {};
    for (const item of defaults ?? []) {
      const field = byId.get(item.fieldId);
      if (!field) continue;
      const resolve = (value) => {
        if (value === TOKENS.me) return viewer.person?.id ?? null;
        if (value === TOKENS.myEmail) return viewer.member?.email ?? null;
        if (value === TOKENS.today) return viewer.tokens.today;
        if (value === TOKENS.record) return recordId;
        return value;
      };
      if (field.type === "link_record") {
        const ids = (Array.isArray(item.value) ? item.value : [item.value]).map(resolve).filter((id) => UUID.test(id ?? ""));
        values[field.id] = ids.map((id) => ({ kind: "record", id }));
      } else {
        values[field.id] = Array.isArray(item.value) ? item.value.map(resolve) : resolve(item.value);
      }
    }
    return values;
  }

  function formOf(viewer, pageId, blockId) {
    const page = reads.pageById(viewer, pageId);
    const block = (page.body?.blocks ?? []).find((item) => item.id === blockId && item.kind === "form");
    if (!block) throw new WorkspaceError("not_found", 404, "That form no longer exists.");
    return { page, block, config: block.config };
  }

  function checkOpen(config) {
    if (config.opensAt && Date.parse(config.opensAt) > Date.now()) throw forbidden("This form isn't open yet.");
    if (config.closesAt && Date.parse(config.closesAt) <= Date.now()) throw forbidden("Submissions are closed.");
  }

  // Creates the viewer's people-list record from a public form with sign-up, then re-reads who they are.
  async function signUp(viewer, config, input) {
    const settings = viewer.settings;
    if (!config.signup?.enabled || !settings.signupEnabled) throw forbidden("Sign-up isn't open. Ask the organisers for an invite.");
    const peopleId = settings.peopleObjectId;
    if (config.signup.objectId !== peopleId) throw forbidden("Sign-up isn't set up for this form.");
    const allowed = config.signup.personFields.map((item) => item.fieldId);
    const raw = isObject(input) ? input : {};
    if (Object.keys(raw).some((id) => !allowed.includes(id))) throw forbidden("Some of your details can't be set here.");
    const problems = {};
    for (const item of config.signup.personFields) if (item.required && isEmpty(raw[item.fieldId])) problems[item.fieldId] = "Required.";
    if (Object.keys(problems).length) throw bad("Fill in your details.", problems);
    const values = { ...raw, ...defaultsFor(viewer, peopleId, config.signup.personDefaults), [settings.emailFieldId]: viewer.member.email };
    const status = startStatus(viewer, peopleId, null);
    const out = normaliseRecordInput(viewer.definition, peopleId, { values, ...(status !== undefined ? { status } : {}) }, null, { timeZone: viewer.event.timeZone });
    const fields = [...new Set([settings.emailFieldId, ...allowed, ...config.signup.personDefaults.map((item) => item.fieldId)])];
    const guard = { objectId: peopleId, computed: compileQuery(viewer.definition, peopleId, { limit: 1 }).computed,
      create: [{ after: ALL, fields, status: false }] };
    try {
      await send(viewer, guard, "record.create", { objectId: peopleId, values: out.values, status: out.status, links: out.links, title: out.title ?? "" });
    } catch (error) {
      if (error?.code !== "23505") throw error;
    }
    const next = await rebuild(viewer);
    if (!next.person) throw forbidden("We couldn't set up your account for this event. Contact the organisers.");
    return next;
  }

  const actions = {
    async "record.update"(viewer, body) {
      if (!UUID.test(body.recordId ?? "")) throw bad("Choose a record.");
      const raw = await workspace.record(viewer.context, body.recordId.toLowerCase());
      if (!raw || raw.deletedAt) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      const shaped = await reads.findRecord(viewer, raw.objectId, { id: raw.id });
      if (!shaped) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      const values = isObject(body.values) ? body.values : {};
      const editable = new Set(shaped.access.editable);
      const blocked = Object.keys(values).filter((id) => !editable.has(id));
      if (blocked.length) {
        const names = blocked.map((id) => viewer.definition.fields.find((field) => field.id === id)?.name ?? "a field");
        throw forbidden(`You can't change ${names.join(", ")}.`);
      }
      if (body.status !== undefined && !shaped.access.status) throw forbidden("You can't change the status.");
      await checkFiles(viewer, raw.objectId, values, raw);
      const out = normaliseRecordInput(viewer.definition, raw.objectId, { values, ...(body.status !== undefined ? { status: body.status } : {}) }, raw, { timeZone: viewer.event.timeZone });
      if (body.status !== undefined && out.status !== raw.status) {
        const merged = { ...raw.values };
        for (const [id, value] of Object.entries(out.values)) { if (value === null) delete merged[id]; else merged[id] = value; }
        guardMove(viewer, raw.objectId, { from: raw.status, to: out.status, values: merged });
      }
      await checkLinks(viewer, raw.objectId, out.links, new Set(Object.values(shaped.links).flat().map((link) => link.id).filter(Boolean)));
      const objectPolicy = viewer.objectPolicy(raw.objectId);
      await send(viewer, guardFor(viewer.definition, objectPolicy), "record.update", {
        recordId: raw.id, expectedRevision: Number.isInteger(body.expectedRevision) ? body.expectedRevision : raw.revision, values: out.values,
        ...(body.status !== undefined && body.status !== raw.status ? { status: out.status } : {}),
        ...(out.links.length ? { links: out.links } : {}),
        title: out.title ?? "",
      }, body.commandId);
      return { record: await reads.findRecord(viewer, raw.objectId, { id: raw.id }) };
    },

    async "record.create"(viewer, body) {
      let current = viewer;
      const { page, config } = formOf(current, body.pageId, body.blockId);
      if (config.mode !== "create") throw bad("This form edits a record.");
      checkOpen(config);
      if (!current.person && config.signup?.enabled) current = await signUp(current, config, body.person);
      const objectPolicy = current.objectPolicy(config.objectId);
      if (!objectPolicy?.create?.length) throw forbidden(`You can't add ${current.definition.objects.find((object) => object.id === config.objectId)?.plural ?? "records"} here.`);
      const formFields = config.sections.flatMap((section) => section.fields);
      const allowed = new Set(formFields.map((item) => item.fieldId));
      const values = isObject(body.values) ? body.values : {};
      if (Object.keys(values).some((id) => !allowed.has(id))) throw forbidden("Some answers can't be sent with this form.");
      const problems = {};
      for (const item of formFields) if (item.required && isEmpty(values[item.fieldId])) problems[item.fieldId] = "Required.";
      if (Object.keys(problems).length) throw bad("Check the highlighted answers.", problems);
      await checkFiles(current, config.objectId, values);
      let recordId = null;
      if (page.kind === "record") {
        recordId = UUID.test(body.recordId ?? "") ? body.recordId.toLowerCase() : null;
        if (!recordId || !(await reads.findRecord(current, page.objectId, { id: recordId }))) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      }
      const defaults = defaultsFor(current, config.objectId, config.defaults, recordId);
      const status = startStatus(current, config.objectId, config.status);
      const out = normaliseRecordInput(current.definition, config.objectId, { values: { ...values, ...defaults }, ...(status !== undefined ? { status } : {}) }, null,
        { timeZone: current.event.timeZone });
      guardMove(current, config.objectId, { creating: true, to: out.status, values: out.values });
      const defaultIds = new Set(Object.keys(defaults));
      await checkLinks(current, config.objectId, out.links.map((link) => (defaultIds.has(link.fieldId) ? { ...link, targets: [] } : link)));
      const guard = guardFor(current.definition, objectPolicy, { defaults: [...allowed, ...defaultIds] });
      const result = await send(current, guard, "record.create", {
        objectId: config.objectId, values: out.values, status: out.status, links: out.links, title: out.title ?? "",
      }, body.commandId);
      if (config.drafts) await store.deleteDraft(current.context, { memberId: current.member.id, pageId: page.id, blockId: body.blockId }).catch(() => {});
      const record = await reads.findRecord(current, config.objectId, { id: result.record.id });
      const object = current.definition.objects.find((item) => item.id === config.objectId);
      return { record, link: record ? { objectKey: object.key, number: record.number } : null, success: config.success ?? null };
    },

    async "records.delete"(viewer, body) {
      const ids = Array.isArray(body.recordIds) ? [...new Set(body.recordIds.filter((id) => UUID.test(id ?? "")).map((id) => id.toLowerCase()))].slice(0, 100) : [];
      if (!ids.length) throw bad("Choose records.");
      const rows = await workspace.records(viewer.context, ids);
      const objectId = rows[0]?.objectId;
      if (!objectId || rows.length !== ids.length || rows.some((row) => row.objectId !== objectId || row.deletedAt)) throw new WorkspaceError("not_found", 404, "Those records no longer exist.");
      const objectPolicy = viewer.objectPolicy(objectId);
      if (!objectPolicy?.delete?.length) throw forbidden("You can't delete these.");
      return send(viewer, guardFor(viewer.definition, objectPolicy), "records.delete", { recordIds: ids }, body.commandId);
    },

    // Takes attendance from a scanner block: one record per person (and context); a repeat reports when they were marked.
    async "scan.mark"(viewer, body) {
      const page = reads.pageById(viewer, body.pageId);
      const block = (page.body?.blocks ?? []).find((item) => item.id === body.blockId && item.kind === "scanner");
      if (!block) throw new WorkspaceError("not_found", 404, "That scanner no longer exists.");
      const config = block.config;
      const objectPolicy = viewer.objectPolicy(config.objectId);
      if (!objectPolicy?.create?.length) throw forbidden("You can't take attendance here.");
      let recordId = null;
      if (page.kind === "record") {
        recordId = UUID.test(body.recordId ?? "") ? body.recordId.toLowerCase() : null;
        if (!recordId || !(await reads.findRecord(viewer, page.objectId, { id: recordId }))) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      }
      const checked = await reads.scanner.check(viewer, config, { code: body.code ?? null, personId: body.personId ?? null, contextId: body.contextId ?? null, recordId });
      if (checked.already) return { ...checked, marked: false };
      const values = reads.scanner.values(viewer, config, { personId: checked.person.id, contextId: checked.contextId });
      const status = startStatus(viewer, config.objectId, null);
      const out = normaliseRecordInput(viewer.definition, config.objectId, { values, ...(status !== undefined ? { status } : {}) }, null, { timeZone: viewer.event.timeZone });
      guardMove(viewer, config.objectId, { creating: true, to: out.status, values: out.values });
      const result = await send(viewer, guardFor(viewer.definition, objectPolicy, { defaults: Object.keys(values) }), "record.create", {
        objectId: config.objectId, values: out.values, status: out.status, links: out.links, title: out.title ?? "",
      }, body.commandId);
      return { ...checked, marked: true, at: result?.record?.createdAt ?? new Date().toISOString() };
    },

    async "comment.add"(viewer, body) {
      if (!UUID.test(body.recordId ?? "")) throw bad("Choose a record.");
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text || text.length > 5000) throw bad("Comments must be 1–5,000 characters.");
      const raw = await workspace.record(viewer.context, body.recordId.toLowerCase());
      const shaped = raw && !raw.deletedAt ? await reads.findRecord(viewer, raw.objectId, { id: raw.id }) : null;
      if (!shaped) throw new WorkspaceError("not_found", 404, "That record no longer exists.");
      if (!shaped.access.comment) throw forbidden("You can't comment here.");
      await send(viewer, guardFor(viewer.definition, viewer.objectPolicy(raw.objectId)), "comment.add", { recordId: raw.id, body: text }, body.commandId);
      return { comments: await reads.comments(viewer, raw.id) };
    },
  };

  // Whether the viewer may upload into a file field: through a form on a page they can open, or on a record they can edit.
  async function canUploadTo(viewer, { pageId, blockId, recordId, fieldId }) {
    if (pageId && blockId) {
      const { config } = formOf(viewer, pageId, blockId);
      if (config.mode === "create" && config.sections.some((section) => section.fields.some((item) => item.fieldId === fieldId))) return true;
      if (config.mode === "edit" && !recordId) return false;
    }
    if (UUID.test(recordId ?? "")) {
      const raw = await workspace.record(viewer.context, recordId.toLowerCase());
      const shaped = raw && !raw.deletedAt ? await reads.findRecord(viewer, raw.objectId, { id: raw.id }) : null;
      return Boolean(shaped?.access.editable.includes(fieldId));
    }
    return false;
  }

  return {
    async command(viewer, body) {
      writer(viewer);
      if (!isObject(body) || !Object.hasOwn(actions, body.action)) throw bad("Unknown action.");
      return actions[body.action](viewer, body);
    },

    async signUpload(viewer, body) {
      writer(viewer);
      const field = viewer.definition.fields.find((item) => item.id === body?.fieldId && !item.deletedAt && item.type === "attachments");
      if (!field || !(await canUploadTo(viewer, body))) throw forbidden("You can't upload files here.");
      const name = typeof body.name === "string" ? body.name.trim().replace(/[\\/]/g, "_").slice(0, 255) : "";
      const type = typeof body.type === "string" && /^[a-z]+\/[a-z0-9.+-]+$/i.test(body.type) ? body.type.toLowerCase() : "application/octet-stream";
      if (!name) throw bad("Name the file.");
      if (!Number.isInteger(body.size) || body.size < 0) throw bad("The file size isn't valid.");
      if (body.size > (field.config.maxBytes ?? LIMITS.fileBytes)) throw bad(`${name} is too large.`);
      if (!acceptsType(field.config.accept, type)) throw bad(`${name} isn't an allowed file type.`);
      const id = randomUUID();
      const path = `${viewer.context.projectId}/${viewer.context.eventId}/portal/${viewer.member.id}/${field.id}/${id}/${name.replace(/[^\w.-]+/g, "_")}`;
      const row = await workspace.addFile({ id, project_id: viewer.context.projectId, event_id: viewer.context.eventId, field_id: field.id,
        path, name, type, size: body.size, created_by: viewer.member.id });
      const signed = await workspace.signUpload(path);
      return { file: { id: row.id, name: row.name, size: Number(row.size), type: row.type }, path, token: signed.token };
    },

    // A short-lived link to a file on a record the viewer can see (or one they just uploaded).
    async signFile(viewer, { recordId, fieldId, fileId, inline = false }) {
      if (!UUID.test(fileId ?? "")) throw bad("Choose a file.");
      const file = await workspace.file(viewer.context, fileId.toLowerCase());
      if (!file) throw new WorkspaceError("not_found", 404, "That file no longer exists.");
      let allowed = viewer.mode === "portal" && viewer.member?.id && file.created_by === viewer.member.id && !recordId;
      if (!allowed && UUID.test(recordId ?? "")) {
        const raw = await workspace.record(viewer.context, recordId.toLowerCase());
        const shaped = raw && !raw.deletedAt ? await reads.findRecord(viewer, raw.objectId, { id: raw.id }) : null;
        const level = shaped?.access.fields[fieldId];
        allowed = Boolean(level && level !== "hidden" && (shaped.values[fieldId] ?? []).some((item) => item.id === file.id));
      }
      if (!allowed) throw new WorkspaceError("not_found", 404, "That file isn't available.");
      const signed = inline ? await store.signView(file.path) : await workspace.signDownload(file.path, file.name);
      return { url: signed.signedUrl, name: file.name, type: file.type };
    },

    // Records the viewer may link to from a field they can edit (search by title or number).
    async lookup(viewer, { fieldId, q }) {
      const field = viewer.definition.fields.find((item) => item.id === fieldId && !item.deletedAt && item.type === "link_record");
      if (!field) throw bad("Choose a field.");
      const targetId = field.config.targetObjectId;
      const objectPolicy = viewer.objectPolicy(targetId);
      if (!objectPolicy || !canView(objectPolicy)) return { items: [] };
      const block = { kind: "table", config: { source: { objectId: targetId, filter: null, sort: [{ field: "title", dir: "asc" }] }, search: true, filters: [], pageSize: 20 } };
      const data = await reads.blockDataFor(viewer, block, { search: typeof q === "string" ? q.slice(0, 100) : "" });
      return { items: data.rows.map((row) => ({ kind: "record", id: row.id, label: row.title ?? `#${row.number}` })) };
    },

    async saveDraft(viewer, { pageId, blockId, data }) {
      writer(viewer);
      const { config } = formOf(viewer, pageId, blockId);
      if (config.mode !== "create" || !config.drafts) throw bad("This form doesn't keep drafts.");
      if (!isObject(data) || JSON.stringify(data).length > 1_000_000) throw bad("This draft is too large.");
      const allowed = new Set(config.sections.flatMap((section) => section.fields.map((item) => item.fieldId)));
      const values = Object.fromEntries(Object.entries(isObject(data.values) ? data.values : {}).filter(([id]) => allowed.has(id)));
      const personAllowed = new Set((config.signup?.personFields ?? []).map((item) => item.fieldId));
      const person = Object.fromEntries(Object.entries(isObject(data.person) ? data.person : {}).filter(([id]) => personAllowed.has(id)));
      await store.saveDraft(viewer.context, { memberId: viewer.member.id, pageId, blockId, data: { values, person, step: Number.isInteger(data.step) ? data.step : 0 } });
      return { saved: true, at: new Date().toISOString() };
    },

    async clearDraft(viewer, { pageId, blockId }) {
      writer(viewer);
      formOf(viewer, pageId, blockId);
      await store.deleteDraft(viewer.context, { memberId: viewer.member.id, pageId, blockId });
      return { cleared: true };
    },
  };

}
