import { randomUUID } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { sanitiseHtml } from "../schema/types/rich_text.js";
import { checkWebhookUrl } from "../../api_webhooks/url.js";
import { templateToKeys } from "./template.js";

const bad = (message) => { throw new WorkspaceError("invalid_automation", 422, message); };
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
export const MAX_STEPS = 20;

// What an automation can do. `record` steps need a record from the trigger.
export const STEP_KINDS = Object.freeze({
  update_record: { label: "Update the record", icon: "pencil", record: true },
  update_linked: { label: "Update linked records", icon: "link-2", record: true },
  create_record: { label: "Create a record", icon: "circle-plus", record: false },
  upsert_record: { label: "Find and update, or create", icon: "search-check", record: false },
  send_email: { label: "Send an email", icon: "mail", record: false },
  ask_approval: { label: "Ask for approval", icon: "badge-check", record: true },
  assign_reviewers: { label: "Assign reviewers", icon: "users", record: true },
  generate_document: { label: "Make a document", icon: "file-text", record: true },
  add_comment: { label: "Add a note", icon: "message-square", record: true },
  webhook: { label: "Send to a webhook", icon: "webhook", record: false },
  run_code: { label: "Run code", icon: "code", record: false },
  wait: { label: "Wait", icon: "hourglass", record: false },
});

// Field types a {{placeholder}} value can fill (the rendered text is then read as that type).
const TEMPLATABLE = new Set(["short_text", "long_text", "email", "phone", "url", "number", "currency", "percent", "rating", "date", "datetime", "duration"]);
export const VALUE_TOKENS = Object.freeze({ record: "@record", today: "@today", now: "@now" });

export const stepId = () => `s_${randomUUID().replace(/-/g, "").slice(0, 10)}`;

// One value a step writes: null (clear), a token, a template or a literal checked against the field type.
function stepValue(definition, field, value, ctx) {
  if (value === null) return null;
  const type = getType(field.type);
  if (value === VALUE_TOKENS.record) {
    if (field.type !== "link_record" || field.config.targetObjectId !== ctx.subjectId) bad(`${field.name} can't link to the triggering record.`);
    return value;
  }
  if (value === VALUE_TOKENS.today) {
    if (field.type !== "date" && field.type !== "datetime") bad(`${field.name} isn't a date.`);
    return value;
  }
  if (value === VALUE_TOKENS.now) {
    if (field.type !== "datetime") bad(`${field.name} isn't a date and time.`);
    return value;
  }
  if (typeof value === "string" && value.includes("{{")) {
    if (!TEMPLATABLE.has(field.type)) bad(`${field.name} can't be filled from placeholders.`);
    return templateToKeys(value.slice(0, 10_000), definition, ctx.subjectId, { payload: ctx.payload });
  }
  try {
    type.normalise(value, field.config);
  } catch (error) {
    if (error instanceof WorkspaceError) bad(`${field.name}: ${error.message}`);
    throw error;
  }
  return value;
}

function stepValues(definition, objectId, list, ctx) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > 50) bad("Set up to 50 values in one step.");
  const byId = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!isObject(item) || !byId.has(item.fieldId) || seen.has(item.fieldId)) continue;
    const field = byId.get(item.fieldId);
    if (!getType(field.type).editable) continue;
    seen.add(field.id);
    out.push({ fieldId: field.id, value: stepValue(definition, field, item.value ?? null, ctx) });
  }
  return out;
}

function statusOf(object, value) {
  if (value === undefined || value === null || value === "") return null;
  if (!object.statuses?.some((status) => status.key === value)) bad(`Choose one of the ${object.name.toLowerCase()} statuses.`);
  return value;
}

function objectOf(definition, objectId, what = "Choose a list.") {
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) bad(what);
  return object;
}

function linkField(definition, objectId, fieldId, what) {
  const field = liveFields(definition, objectId).find((item) => item.id === fieldId && item.type === "link_record");
  if (!field) bad(what);
  return field;
}

function recipients(definition, subjectId, list, ctx) {
  if (!Array.isArray(list) || !list.length) bad("Choose who gets the email.");
  const fields = subjectId ? liveFields(definition, subjectId) : [];
  const out = [];
  for (const item of list.slice(0, 20)) {
    if (!isObject(item)) continue;
    if (item.kind === "field") {
      const field = fields.find((entry) => entry.id === item.fieldId && entry.type === "email");
      if (!field) bad("Choose an email field.");
      out.push({ kind: "field", fieldId: field.id });
    } else if (item.kind === "linked") {
      const link = fields.find((entry) => entry.id === item.linkFieldId && entry.type === "link_record");
      const field = link && liveFields(definition, link.config.targetObjectId).find((entry) => entry.id === item.fieldId && entry.type === "email");
      if (!field) bad("Choose a linked email field.");
      out.push({ kind: "linked", linkFieldId: link.id, fieldId: field.id });
    } else if (item.kind === "team") {
      const ids = Array.isArray(item.userIds) ? [...new Set(item.userIds)].filter((id) => UUID.test(id ?? "")).slice(0, 50) : [];
      if (!ids.length) bad("Choose team members.");
      if (ctx.members && ids.some((id) => !ctx.members.has(id))) bad("Some chosen people aren't on the team.");
      out.push({ kind: "team", userIds: ids });
    } else if (item.kind === "address") {
      const address = text(item.address, 320).toLowerCase();
      if (!EMAIL.test(address)) bad(`${item.address || "That"} isn't an email address.`);
      out.push({ kind: "address", address });
    } else if (item.kind === "payload" && ctx.payload) {
      const path = text(item.path, 160);
      if (!/^payload(\.[\w-]+)+$/.test(path)) bad("Choose where the email address is in the webhook body, like payload.email.");
      out.push({ kind: "payload", path });
    }
  }
  if (!out.length) bad("Choose who gets the email.");
  if (!ctx.subjectId && out.some((item) => item.kind === "field" || item.kind === "linked")) bad("Email fields need a trigger with a record.");
  return out;
}

// A chosen email template or PDF document must exist, be the right kind and suit the trigger's list (skipped when unknown).
function documentFor(ctx, id, kind) {
  if (!ctx.documents) return;
  const document = ctx.documents.get(id);
  if (!document || document.kind !== kind) bad(kind === "email" ? "Choose an email template." : "Choose a PDF document.");
  if (document.objectId && document.objectId !== ctx.subjectId) bad(`“${document.name}” is written for a different list.`);
}

const VALIDATORS = {
  update_record(step, definition, ctx) {
    const object = objectOf(definition, ctx.subjectId);
    const values = stepValues(definition, object.id, step.values, ctx);
    const status = statusOf(object, step.status);
    if (!values.length && !status) bad("Choose what to change.");
    return { values, status };
  },
  update_linked(step, definition, ctx) {
    const link = linkField(definition, ctx.subjectId, step.linkFieldId, "Choose a link field.");
    const target = objectOf(definition, link.config.targetObjectId);
    const values = stepValues(definition, target.id, step.values, ctx);
    const status = statusOf(target, step.status);
    if (!values.length && !status) bad("Choose what to change on the linked records.");
    return { linkFieldId: link.id, values, status };
  },
  create_record(step, definition, ctx) {
    const object = objectOf(definition, step.objectId, "Choose the list to add to.");
    const values = stepValues(definition, object.id, step.values, { ...ctx, subjectId: ctx.subjectId });
    return { objectId: object.id, values, status: statusOf(object, step.status) };
  },
  upsert_record(step, definition, ctx) {
    const object = objectOf(definition, step.objectId, "Choose the list to search.");
    const match = liveFields(definition, object.id).find((field) => field.id === step.matchFieldId && ["short_text", "email", "phone", "url", "number"].includes(field.type));
    if (!match) bad("Choose the field to match on (text, email, phone, URL or number).");
    const matchValue = typeof step.matchValue === "string" && step.matchValue.includes("{{")
      ? templateToKeys(step.matchValue.slice(0, 1000), definition, ctx.subjectId, { payload: ctx.payload }) : text(step.matchValue, 1000);
    if (!matchValue) bad("Choose the value to look for.");
    return {
      objectId: object.id, matchFieldId: match.id, matchValue,
      values: stepValues(definition, object.id, step.values, ctx), status: statusOf(object, step.status),
      create: step.create !== false,
    };
  },
  send_email(step, definition, ctx) {
    const documentId = UUID.test(step.templateId ?? "") ? step.templateId : null;
    if (documentId) documentFor(ctx, documentId, "email");
    if (UUID.test(step.attachDocumentId ?? "")) documentFor(ctx, step.attachDocumentId, "pdf");
    const subject = templateToKeys(text(step.subject, 300), definition, ctx.subjectId, { payload: ctx.payload });
    const body = templateToKeys(sanitiseHtml(typeof step.body === "string" ? step.body : "").slice(0, 50_000), definition, ctx.subjectId, { payload: ctx.payload });
    if (!documentId && (!subject || !body)) bad("Write a subject and a message, or choose an email template.");
    const replyTo = text(step.replyTo, 320).toLowerCase();
    if (replyTo && !EMAIL.test(replyTo)) bad("The reply-to address isn't valid.");
    return {
      to: recipients(definition, ctx.subjectId, step.to, ctx), subject, body, templateId: documentId,
      ...(replyTo ? { replyTo } : {}),
      attachDocumentId: UUID.test(step.attachDocumentId ?? "") ? step.attachDocumentId : null,
    };
  },
  ask_approval(step, definition, ctx) {
    const object = objectOf(definition, ctx.subjectId);
    const approvers = Array.isArray(step.approvers) ? [...new Set(step.approvers)].filter((id) => UUID.test(id ?? "")).slice(0, 50) : [];
    if (!approvers.length) bad("Choose who approves.");
    if (ctx.members && approvers.some((id) => !ctx.members.has(id))) bad("Some approvers aren't on the team.");
    const outcome = (input) => ({
      status: statusOf(object, input?.status),
      values: stepValues(definition, object.id, input?.values, ctx),
    });
    return {
      title: templateToKeys(text(step.title, 200) || "Approve {{record.title}}", definition, ctx.subjectId),
      message: templateToKeys(text(step.message, 5000), definition, ctx.subjectId),
      approvers, rule: oneOf(step.rule, ["any", "all"], "any"),
      approve: outcome(step.approve), reject: outcome(step.reject),
    };
  },
  assign_reviewers(step, definition, ctx) {
    if (!UUID.test(step.setupId ?? "")) bad("Choose a review setup.");
    if (ctx.reviewSetups && !ctx.reviewSetups.has(step.setupId)) bad("That review setup no longer exists.");
    return { setupId: step.setupId };
  },
  generate_document(step, definition, ctx) {
    if (!UUID.test(step.documentId ?? "")) bad("Choose a document.");
    documentFor(ctx, step.documentId, "pdf");
    const field = liveFields(definition, ctx.subjectId).find((item) => item.id === step.fieldId && item.type === "attachments");
    if (!field) bad("Choose the file field to put the document in.");
    return { documentId: step.documentId, fieldId: field.id, replace: step.replace !== false };
  },
  add_comment(step, definition, ctx) {
    const body = templateToKeys(text(step.body, 5000), definition, ctx.subjectId);
    if (!body) bad("Write the note.");
    return { body };
  },
  webhook(step, definition, ctx) {
    const checked = checkWebhookUrl(text(step.url, 2000));
    if (!checked.ok) bad(checked.error.replace("Webhook URLs", "Addresses"));
    const url = checked.value;
    const fields = Array.isArray(step.fields) ? [...new Set(step.fields)].filter((id) => ctx.subjectId && liveFields(definition, ctx.subjectId).some((field) => field.id === id)).slice(0, 150) : [];
    return { url, fields, includeRecord: step.includeRecord !== false };
  },
  run_code(step) {
    const code = typeof step.code === "string" ? step.code : "";
    if (!code.trim()) bad("Write the code to run.");
    if (code.length > 65_536) bad("Code can be up to 64 KB.");
    return { code };
  },
  wait(step) {
    const amount = Number.isInteger(step.amount) ? Math.max(1, Math.min(365, step.amount)) : 1;
    return { amount, unit: oneOf(step.unit, ["minutes", "hours", "days"], "days") };
  },
};

// Cleans an automation's steps for its trigger's list (subjectId may be null).
export function validateSteps(definition, steps, { subjectId = null, payload = false, members = null, reviewSetups = null, documents = null } = {}) {
  if (!Array.isArray(steps) || !steps.length) bad("Add at least one step.");
  if (steps.length > MAX_STEPS) bad(`An automation can have up to ${MAX_STEPS} steps.`);
  const ctx = { subjectId, payload, members, reviewSetups, documents };
  return steps.map((step) => {
    if (!isObject(step) || !Object.hasOwn(STEP_KINDS, step.kind)) bad("Choose what each step does.");
    if (STEP_KINDS[step.kind].record && !subjectId) bad(`"${STEP_KINDS[step.kind].label}" needs a trigger with a record.`);
    const id = /^s_[a-z0-9]{4,24}$/.test(step.id ?? "") ? step.id : stepId();
    return { id, kind: step.kind, ...VALIDATORS[step.kind](step, definition, ctx) };
  });
}

// Wait steps in milliseconds.
export function waitMs(step) {
  const unit = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[step.unit] ?? 86_400_000;
  return step.amount * unit;
}
