import { UUID } from "../contracts.js";
import { stableId } from "../server/send.js";
import { workspaceStore } from "../server/store.js";
import { portalStore } from "../portal/store.js";
import { brandColor } from "../portal/staff.js";
import { normaliseRecordInput } from "../records/values.js";
import { liveFields } from "../schema/definition.js";
import { sendSuiteEmail } from "../../email/client.js";
import { todayIn, zonedInstant, addDays } from "../../venue_booking/time.js";
import { approvalEmail, automationEmail, dashboardUrl, recordPortalUrl } from "./emails.js";
import { loadRecord, loadRecords, recordMatches, linkedIds, requestHash, allRecords } from "./records.js";
import { loadReviewData, planAssignments, reviewInput } from "./review.js";
import { checkMove, cleanProcess, moveError } from "./stages.js";
import { processStore, systemContext } from "./store.js";
import { escapeHtml, linkedKeys, renderTemplate, templateResolver } from "./template.js";
import { documentService } from "../documents/service.js";
import { documentStore } from "../documents/store.js";
import { recordForHolder } from "../components/tickets.js";
import { codeRecord } from "../code/input.js";
import { codeResult, runCode } from "../code/sandbox.js";
import { FetchRefused, safeFetch } from "../net/safe_fetch.js";
import { signatureHeader } from "../../api_webhooks/crypto.js";
import { CHANGE_TRIGGERS, changeMatches, nextRunAt, targetDate } from "./triggers.js";
import { VALUE_TOKENS, waitMs } from "./steps.js";

export const MAX_DEPTH = 3;
// Outputs of steps that already ran, so a run resumed after a wait still sees them.
const outputsOf = (steps) => Object.fromEntries((Array.isArray(steps) ? steps : []).filter((step) => step.output).map((step) => [step.id, step.output]));
const NUMERIC = new Set(["number", "currency", "percent", "rating", "duration"]);
// The error for the run log, with any per-field problems after the summary line.
const message = (error) => {
  const details = error?.fields && typeof error.fields === "object" ? Object.values(error.fields).filter((item) => typeof item === "string") : [];
  return [String(error?.message ?? error ?? "Something went wrong"), ...details].join(" ").slice(0, 500);
};

// A rendered placeholder value read back as the field's type.
function fromRendered(field, text) {
  const value = text.trim();
  if (!value) return null;
  if (NUMERIC.has(field.type)) {
    const number = Number(value.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(number) ? number : null;
  }
  if (field.type === "date") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed + 12 * 3_600_000).toISOString().slice(0, 10);
  }
  if (field.type === "datetime") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return value;
}

export function createEngine({
  store = processStore, workspace = workspaceStore, portal = portalStore, sendEmail = sendSuiteEmail, now = () => new Date(),
  documents = { store: documentStore, service: documentService },
} = {}) {
  // Per-call caches: one definition, event and stage-rule set per event.
  function session() {
    const cache = new Map();
    return async (projectId, eventId) => {
      const key = `${projectId}:${eventId}`;
      if (!cache.has(key)) {
        cache.set(key, (async () => {
          const context = systemContext(projectId, eventId);
          const [definition, row, processes] = await Promise.all([workspace.definition(context), portal.eventRow(eventId), store.processes(context)]);
          const event = { id: eventId, name: row?.name ?? "the event", timeZone: row?.timezone || "UTC", venueId: row?.venue_id ?? null, brand: brandColor(row) };
          return { context, definition, event, processes };
        })());
      }
      return cache.get(key);
    };
  }

  const objectById = (definition, id) => definition.objects.find((object) => object.id === id && !object.deletedAt) ?? null;

  async function send(env, run, action, payload, key) {
    const commandId = stableId(run.id, key);
    return store.systemCommand(env.context, { kind: "automation", actorId: run.automationId, depth: run.depth + 1 },
      { action, commandId, requestHash: requestHash({ action, ...payload }), ...payload });
  }

  // Turns a step's value list into record values: tokens, placeholders and literals.
  function stepValues(env, objectId, specs, resolve, subject) {
    const byId = new Map(liveFields(env.definition, objectId).map((field) => [field.id, field]));
    const values = {};
    for (const { fieldId, value } of specs ?? []) {
      const field = byId.get(fieldId);
      if (!field) continue;
      if (value === null) values[fieldId] = null;
      else if (value === VALUE_TOKENS.record) values[fieldId] = subject ? [subject.id] : [];
      else if (value === VALUE_TOKENS.today) values[fieldId] = field.type === "date" ? todayIn(env.event.timeZone, now()) : now().toISOString();
      else if (value === VALUE_TOKENS.now) values[fieldId] = now().toISOString();
      else if (typeof value === "string" && value.includes("{{")) values[fieldId] = fromRendered(field, renderTemplate(value, resolve));
      else values[fieldId] = value;
    }
    return values;
  }

  // Updates one record through the stage rules, as the automation.
  async function updateRecord(env, run, record, { values, status }, key) {
    const object = objectById(env.definition, record.objectId);
    const out = normaliseRecordInput(env.definition, record.objectId, { values, ...(status ? { status } : {}) }, record, { timeZone: env.event.timeZone });
    if (status && status !== record.status) {
      const problem = checkMove(cleanProcess(env.definition, object.id, env.processes.get(object.id)), object, {
        from: record.status, to: status, values: { ...record.values, ...out.values }, fields: liveFields(env.definition, object.id),
      });
      if (problem) throw moveError(problem);
    }
    if (!Object.keys(out.values).length && !out.links.length && (!status || status === record.status)) return { unchanged: true };
    return send(env, run, "record.update", {
      recordId: record.id, expectedRevision: record.revision, values: out.values,
      ...(status && status !== record.status ? { status } : {}),
      ...(out.links.length ? { links: out.links } : {}), title: out.title ?? "",
    }, key);
  }

  async function createRecord(env, run, objectId, { values, status }, key) {
    const object = objectById(env.definition, objectId);
    if (!object) throw new Error("That list no longer exists.");
    const out = normaliseRecordInput(env.definition, objectId, { values, ...(status ? { status } : {}) }, null, { timeZone: env.event.timeZone });
    const problem = checkMove(cleanProcess(env.definition, objectId, env.processes.get(objectId)), object, {
      creating: true, to: out.status, values: out.values, fields: liveFields(env.definition, objectId),
    });
    if (problem) throw moveError(problem);
    return send(env, run, "record.create", { objectId, values: out.values, status: out.status, links: out.links, title: out.title ?? "" }, key);
  }

  // Placeholder resolver for the run's record, loading only the linked records its templates look through.
  async function resolverFor(env, ctx, texts) {
    const object = ctx.record ? objectById(env.definition, ctx.record.objectId) : null;
    const linked = {};
    if (ctx.record && object) {
      for (const key of linkedKeys(texts)) {
        const field = liveFields(env.definition, object.id).find((item) => item.key === key && item.type === "link_record");
        if (!field) continue;
        linked[key] = await loadRecords(env.context, env.definition, field.config.targetObjectId, linkedIds(ctx.record, field.id).slice(0, 50), { workspace, venueId: env.event.venueId });
      }
    }
    return templateResolver(env.definition, {
      object, record: ctx.record, linked, event: env.event, timeZone: env.event.timeZone, payload: ctx.payload, now: now(),
      link: ctx.record && object ? recordPortalUrl(env.event.id, object.key, ctx.record.number) : "",
    });
  }

  async function reload(env, ctx) {
    if (ctx.record) ctx.record = await loadRecord(env.context, env.definition, ctx.record.objectId, ctx.record.id, { workspace, venueId: env.event.venueId });
  }

  // Email addresses for a send_email step.
  async function recipients(env, ctx, list, resolve) {
    const out = new Set();
    const members = list.some((item) => item.kind === "team") ? await store.members(env.context) : [];
    for (const item of list) {
      if (item.kind === "address") out.add(item.address);
      else if (item.kind === "field") {
        const value = ctx.record?.values?.[item.fieldId];
        if (typeof value === "string" && value.includes("@")) out.add(value.toLowerCase());
      } else if (item.kind === "linked") {
        const link = liveFields(env.definition, ctx.record.objectId).find((field) => field.id === item.linkFieldId);
        const targets = link ? await loadRecords(env.context, env.definition, link.config.targetObjectId, linkedIds(ctx.record, link.id).slice(0, 50), { workspace }) : [];
        for (const target of targets) {
          const value = target.values?.[item.fieldId];
          if (typeof value === "string" && value.includes("@")) out.add(value.toLowerCase());
        }
      } else if (item.kind === "team") {
        for (const member of members) if (item.userIds.includes(member.user_id) && member.email) out.add(member.email.toLowerCase());
      } else if (item.kind === "payload") {
        const value = resolve(item.path);
        if (typeof value === "string" && value.includes("@")) out.add(value.trim().toLowerCase());
      }
    }
    return [...out].slice(0, 100);
  }

  const EXECUTORS = {
    async update_record(env, run, ctx, step) {
      const resolve = await resolverFor(env, ctx, step.values.map((item) => item.value).filter((value) => typeof value === "string"));
      const result = await updateRecord(env, run, ctx.record, { values: stepValues(env, ctx.record.objectId, step.values, resolve, ctx.record), status: step.status }, step.id);
      await reload(env, ctx);
      return { detail: result?.unchanged ? "Nothing to change" : "Updated" };
    },

    async update_linked(env, run, ctx, step) {
      const link = liveFields(env.definition, ctx.record.objectId).find((field) => field.id === step.linkFieldId);
      if (!link) throw new Error("The link field no longer exists.");
      const targets = await loadRecords(env.context, env.definition, link.config.targetObjectId, linkedIds(ctx.record, link.id).slice(0, 100), { workspace });
      const resolve = await resolverFor(env, ctx, step.values.map((item) => item.value).filter((value) => typeof value === "string"));
      let n = 0;
      for (const target of targets) {
        await updateRecord(env, run, target, { values: stepValues(env, target.objectId, step.values, resolve, ctx.record), status: step.status }, `${step.id}:${target.id}`);
        n += 1;
      }
      return { detail: `Updated ${n} linked record${n === 1 ? "" : "s"}` };
    },

    async create_record(env, run, ctx, step) {
      const resolve = await resolverFor(env, ctx, step.values.map((item) => item.value).filter((value) => typeof value === "string"));
      const result = await createRecord(env, run, step.objectId, { values: stepValues(env, step.objectId, step.values, resolve, ctx.record), status: step.status }, step.id);
      const object = objectById(env.definition, step.objectId);
      return { detail: `Created ${object.numberPrefix}-${result.record.number}`, output: { recordId: result.record.id } };
    },

    async upsert_record(env, run, ctx, step) {
      const resolve = await resolverFor(env, ctx, [step.matchValue, ...step.values.map((item) => item.value).filter((value) => typeof value === "string")]);
      const field = liveFields(env.definition, step.objectId).find((item) => item.id === step.matchFieldId);
      if (!field) throw new Error("The match field no longer exists.");
      const raw = renderTemplate(step.matchValue, resolve).trim();
      const matchValue = fromRendered(field, field.type === "email" ? raw.toLowerCase() : raw);
      if (matchValue === null) return { detail: "Nothing to match on" };
      const found = await allRecords(env.context, env.definition, step.objectId, {
        workspace, max: 1, filter: { op: "and", items: [{ field: field.id, operator: "eq", value: matchValue }] },
      });
      const values = stepValues(env, step.objectId, step.values, resolve, ctx.record);
      if (found[0]) {
        await updateRecord(env, run, found[0], { values, status: step.status }, step.id);
        return { detail: `Updated ${objectById(env.definition, step.objectId).numberPrefix}-${found[0].number}`, output: { recordId: found[0].id } };
      }
      if (!step.create) return { detail: "No match" };
      const result = await createRecord(env, run, step.objectId, { values: { ...values, [field.id]: matchValue }, status: step.status }, step.id);
      return { detail: `Created ${objectById(env.definition, step.objectId).numberPrefix}-${result.record.number}`, output: { recordId: result.record.id } };
    },

    async send_email(env, run, ctx, step) {
      let subject = step.subject;
      let body = step.body;
      if (step.templateId) {
        const template = await documents.store.document(env.context, step.templateId);
        if (!template || template.kind !== "email") throw new Error("The email template no longer exists.");
        if (template.objectId && template.objectId !== (ctx.record?.objectId ?? null)) throw new Error("The email template is written for a different list.");
        subject = template.config.subject;
        body = template.config.body;
      }
      const resolve = await resolverFor(env, ctx, [subject, body]);
      const to = await recipients(env, ctx, step.to, resolve);
      if (!to.length) return { detail: "No one to send to" };
      let bodyHtml = renderTemplate(body, resolve, { html: true });
      if (step.attachDocumentId && ctx.record) {
        const link = await documents.service.emailLink(env.context, { definition: env.definition, event: env.event, documentId: step.attachDocumentId, record: ctx.record, key: `${run.id}-${step.id}` });
        bodyHtml += `<p style="margin:20px 0 0"><a href="${escapeHtml(link.url)}" style="color:{{color}};font-weight:600">Download ${escapeHtml(link.name)}</a></p>`;
      }
      const mail = automationEmail({ event: env.event.name, brand: env.event.brand, subject: renderTemplate(subject, resolve).slice(0, 300) || "Update", bodyHtml });
      let sent = 0;
      const failed = [];
      for (const address of to) {
        const result = await sendEmail({
          template: "events.workspace_automation", to: address, subject: mail.subject, html: mail.html,
          idempotencyKey: `ws-${run.id}-${step.id}-${address}`.slice(0, 200),
        });
        if (result?.ok) sent += 1; else failed.push(`${address}: ${result?.error ?? "failed"}`);
      }
      if (!sent && failed.length) throw new Error(`Couldn't send: ${failed.join("; ")}`);
      return { detail: `Sent to ${sent} ${sent === 1 ? "person" : "people"}${failed.length ? `, ${failed.length} failed` : ""}` };
    },

    async ask_approval(env, run, ctx, step) {
      const resolve = await resolverFor(env, ctx, [step.title, step.message]);
      const title = renderTemplate(step.title, resolve).slice(0, 200) || "Approval";
      const approval = await store.insertApproval({
        project_id: env.context.projectId, event_id: env.context.eventId, record_id: ctx.record.id, automation_id: run.automationId, run_id: run.id,
        title, message: renderTemplate(step.message, resolve).slice(0, 5000), approvers: step.approvers, rule: step.rule,
        outcomes: { approve: step.approve, reject: step.reject },
      });
      const members = await store.members(env.context);
      const mail = approvalEmail({ event: env.event.name, brand: env.event.brand, title, message: approval.message,
        url: dashboardUrl(env.context.projectId, env.context.eventId, "workspace-approvals") });
      for (const member of members.filter((item) => step.approvers.includes(item.user_id) && item.email)) {
        await sendEmail({ template: "events.workspace_approval", to: member.email, subject: mail.subject, html: mail.html, idempotencyKey: `ws-approval-${approval.id}-${member.user_id}` });
      }
      return { detail: `Asked ${step.approvers.length} ${step.approvers.length === 1 ? "person" : "people"}`, output: { approvalId: approval.id } };
    },

    async assign_reviewers(env, run, ctx, step) {
      const setup = await store.reviewSetup(env.context, step.setupId);
      if (!setup) throw new Error("The review setup no longer exists.");
      if (setup.config.submissionsObjectId !== ctx.record.objectId) throw new Error("This review setup is for a different list.");
      const data = await loadReviewData(env.context, env.definition, setup, { submissionIds: [ctx.record.id], workspace, venueId: env.event.venueId });
      if (!data.submissions.length) return { detail: "Not a submission this review covers" };
      const plan = planAssignments(env.definition, setup, data);
      for (const pair of plan.pairs) await createRecord(env, run, setup.config.reviewsObjectId, reviewInput(setup, pair), `${step.id}:${pair.reviewerId}`);
      return { detail: `Assigned ${plan.pairs.length} reviewer${plan.pairs.length === 1 ? "" : "s"}${plan.unfilled.length ? ` (${plan.unfilled[0].reason.toLowerCase()})` : ""}` };
    },

    async generate_document(env, run, ctx, step) {
      const document = await documents.store.document(env.context, step.documentId);
      if (!document || document.kind !== "pdf") throw new Error("The document no longer exists.");
      const result = await documents.service.produce(env.context, {
        definition: env.definition, event: env.event, document, record: ctx.record, fieldId: step.fieldId, replace: step.replace !== false,
        ids: { fileId: stableId(run.id, `${step.id}:file`), certificateId: stableId(run.id, `${step.id}:certificate`) },
        issuer: { kind: "automation", id: run.automationId },
        write: (values) => updateRecord(env, run, ctx.record, { values }, `${step.id}:attach`),
      });
      await reload(env, ctx);
      const warned = result.warnings.length ? ` (${result.warnings[0].replace(/\.$/, "").toLowerCase()})` : "";
      return {
        detail: `Made ${result.file.name}${result.certificate ? `, certificate ${result.certificate.code}` : ""}${warned}`,
        output: { fileId: result.file.id, ...(result.certificate ? { certificateCode: result.certificate.code, certificateUrl: result.certificate.url } : {}) },
      };
    },

    async add_comment(env, run, ctx, step) {
      const resolve = await resolverFor(env, ctx, [step.body]);
      await send(env, run, "comment.add", { recordId: ctx.record.id, body: renderTemplate(step.body, resolve).slice(0, 5000) || "—" }, step.id);
      return { detail: "Note added" };
    },

    // POSTs JSON to an outside address, signed with the workspace's webhook secret; the JSON answer is this step's output.
    async webhook(env, run, ctx, step) {
      const secret = await store.hookSecret(env.context);
      if (!secret) throw new Error("This workspace has no webhook secret yet. Run the openness migration.");
      const id = stableId(run.id, step.id);
      const record = step.includeRecord !== false && ctx.record ? codeRecord(env.definition, ctx.record) : null;
      const keys = step.fields?.length ? new Set(liveFields(env.definition, ctx.record?.objectId ?? "").filter((field) => step.fields.includes(field.id)).map((field) => field.key)) : null;
      const body = JSON.stringify({
        id, type: "workspace.automation", created: Math.floor(now().getTime() / 1000),
        event: { id: env.event.id, name: env.event.name }, automation: { id: run.automationId, run: run.id },
        record: record && keys ? Object.fromEntries(Object.entries(record).filter(([key]) => keys.has(key) || ["id", "number", "title", "status"].includes(key))) : record,
        trigger: ctx.payload ? { payload: ctx.payload } : {}, steps: ctx.outputs ?? {},
      });
      const timestamp = Math.floor(now().getTime() / 1000);
      let response;
      try {
        response = await safeFetch(step.url, {
          method: "POST", maxBytes: 65_536, timeoutMs: 10_000, body,
          headers: {
            "content-type": "application/json", "user-agent": "GeigerEvents-Workspace/1.0", "Geiger-Signature": signatureHeader(secret, timestamp, body),
            "Geiger-Event-Type": "workspace.automation", "Geiger-Delivery-Id": id,
          },
        });
      } catch (error) {
        throw new Error(error instanceof FetchRefused ? error.message : "Couldn't reach the address.");
      }
      if (!response.ok) throw new Error(`The address answered HTTP ${response.status}.`);
      const text = new TextDecoder().decode(response.bytes);
      let answer = null;
      try { answer = response.contentType.includes("json") && text ? JSON.parse(text) : text.slice(0, 2000) || null; } catch { answer = text.slice(0, 2000); }
      return { detail: `Sent · HTTP ${response.status}`, output: { status: response.status, body: answer } };
    },

    async run_code(env, run, ctx, step) {
      const result = await runCode(step.code, codeInput(env, ctx));
      if (!result.ok) throw new Error(result.error);
      const parsed = codeResult(result.value);
      const changes = Object.keys(parsed.set).length || parsed.status;
      if (changes) {
        await updateRecordFromCode(env, run, ctx, parsed, step.id);
        await reload(env, ctx);
      }
      return {
        detail: `Ran in ${result.ms} ms${changes ? ", updated the record" : ""}${result.logs.length ? ` · ${result.logs.length} log line${result.logs.length === 1 ? "" : "s"}` : ""}`,
        output: { result: parsed.output, ...(result.logs.length ? { logs: result.logs } : {}) },
      };
    },

    async wait(env, run, ctx, step, index) {
      const dueAt = new Date(now().getTime() + waitMs(step));
      await store.enqueue({
        project_id: env.context.projectId, event_id: env.context.eventId, kind: "resume", automation_id: run.automationId,
        record_id: ctx.record?.id ?? null, payload: { runId: run.id, next: index + 1 }, depth: run.depth, due_at: dueAt.toISOString(),
      });
      return { waiting: true, detail: `Waiting until ${dueAt.toISOString()}` };
    },
  };

  // What code steps read: the record by field key (plus id, number, title, status), the event, the trigger and earlier outputs.
  function codeInput(env, ctx) {
    return {
      record: ctx.record ? codeRecord(env.definition, ctx.record) : null,
      event: { id: env.event.id, name: env.event.name, timeZone: env.event.timeZone },
      trigger: { ...(ctx.trigger ?? {}), ...(ctx.payload ? { payload: ctx.payload } : {}) },
      steps: ctx.outputs ?? {},
    };
  }

  async function updateRecordFromCode(env, run, ctx, result, key) {
    if (!ctx.record) throw new Error("Code can only change a record when the trigger has one.");
    const byKey = new Map(liveFields(env.definition, ctx.record.objectId).map((field) => [field.key, field]));
    const values = {};
    for (const [fieldKey, value] of Object.entries(result.set ?? {})) {
      const field = byKey.get(fieldKey);
      if (!field) throw new Error(`The code set "${fieldKey}", which isn't a field on this list.`);
      values[field.id] = value;
    }
    await updateRecord(env, run, ctx.record, { values, status: result.status ?? undefined }, `${key}:code`);
  }

  // Runs steps from `start`; a failing step stops the run, a wait parks it.
  async function execute(env, automation, run, ctx, start = 0) {
    const log = Array.isArray(run.steps) ? [...run.steps] : [];
    ctx.outputs = ctx.outputs ?? {};
    for (let index = start; index < automation.steps.length; index += 1) {
      const step = automation.steps[index];
      const at = now().toISOString();
      try {
        const executor = EXECUTORS[step.kind];
        if (!executor) throw new Error("This step isn't available.");
        if (!ctx.record && ["update_record", "update_linked", "ask_approval", "assign_reviewers", "generate_document", "add_comment"].includes(step.kind)) {
          throw new Error("This step needs a record.");
        }
        const result = (await executor(env, run, ctx, step, index)) ?? {};
        if (result.output) ctx.outputs[step.id] = result.output;
        log.push({ id: step.id, kind: step.kind, status: result.waiting ? "waiting" : "done", detail: result.detail ?? "", at, ...(result.output ? { output: result.output } : {}) });
        if (result.waiting) {
          await store.updateRun(run.id, { status: "waiting", steps: log });
          return "waiting";
        }
      } catch (error) {
        log.push({ id: step.id, kind: step.kind, status: "failed", error: message(error), at });
        await store.updateRun(run.id, { status: "failed", steps: log, error: message(error), finished_at: now().toISOString() });
        return "failed";
      }
    }
    await store.updateRun(run.id, { status: "succeeded", steps: log, finished_at: now().toISOString(), error: null });
    return "succeeded";
  }

  // One automation for one record (or none) from one queue item; condition first, then a single run per key.
  async function runFor(env, automation, item, recordId, trigger, { checkCondition = true, payload = null } = {}) {
    const runKey = `${automation.id}:${item.id}:${recordId ?? "-"}`;
    const base = {
      project_id: env.context.projectId, event_id: env.context.eventId, automation_id: automation.id, queue_id: item.id,
      run_key: runKey, record_id: recordId, trigger, depth: item.depth,
    };
    if (item.depth >= MAX_DEPTH) {
      await store.startRun({ ...base, status: "skipped", error: "Stopped a loop: automations changed this record three times in a row.", finished_at: now().toISOString() });
      return "skipped";
    }
    let record = null;
    if (recordId) {
      record = await loadRecord(env.context, env.definition, automation.trigger.objectId, recordId, { workspace, venueId: env.event.venueId });
      if (!record) return "missing";
      if (checkCondition && automation.condition && !(await recordMatches(env.context, env.definition, record.objectId, record.id, automation.condition, { workspace }))) return "condition";
    }
    const { run, created } = await store.startRun({ ...base, status: "running" });
    if (!created && run.status !== "running") return run.status;
    return execute(env, automation, run, { record, payload, trigger });
  }

  async function handleChange(env, item) {
    const change = await store.change(item.change_id);
    if (!change) return;
    const shaped = { action: change.action, objectId: change.object_id, actorKind: change.actor_kind, before: change.before, after: change.after };
    const automations = (await store.automations(env.context, { enabledOnly: true }))
      .filter((automation) => CHANGE_TRIGGERS.has(automation.trigger.kind) && changeMatches(automation.trigger, shaped));
    for (const automation of automations) {
      await runFor(env, automation, item, change.record_id, { kind: automation.trigger.kind, changeId: change.id, actorKind: change.actor_kind });
    }
  }

  async function handleTimed(env, item) {
    const automation = await store.automation(env.context, item.automation_id);
    if (!automation?.enabled || automation.deletedAt) return;
    const trigger = automation.trigger;
    const at = item.payload?.at ?? item.due_at;
    if (!trigger.objectId) {
      await runFor(env, automation, item, null, { kind: trigger.kind, at });
      return;
    }
    let filter = automation.condition ?? null;
    if (trigger.kind === "date") {
      const field = env.definition.fields.find((entry) => entry.id === trigger.fieldId && !entry.deletedAt);
      if (!field) return;
      const day = targetDate(trigger, new Date(at), env.event.timeZone);
      const dayFilter = field.type === "date"
        ? [{ field: field.id, operator: "eq", value: day }]
        : [{ field: field.id, operator: "on_or_after", value: zonedInstant(day, "00:00", env.event.timeZone).toISOString() },
          { field: field.id, operator: "before", value: zonedInstant(addDays(day, 1), "00:00", env.event.timeZone).toISOString() }];
      filter = { op: "and", items: [...dayFilter, ...(filter ? [filter] : [])] };
    }
    const rows = await allRecords(env.context, env.definition, trigger.objectId, { workspace, filter, max: 500, links: false });
    for (const row of rows) await runFor(env, automation, item, row.id, { kind: trigger.kind, at }, { checkCondition: false });
  }

  async function handleManual(env, item) {
    const automation = await store.automation(env.context, item.automation_id);
    if (!automation || automation.deletedAt) return;
    for (const recordId of (item.payload?.recordIds ?? []).slice(0, 500)) {
      await runFor(env, automation, item, recordId, { kind: "manual", by: item.payload?.userId ?? null });
    }
  }

  async function handleResume(env, item) {
    const row = await store.runById(item.payload?.runId);
    if (!row || row.status !== "waiting") return;
    const automation = await store.automation(env.context, row.automation_id);
    const run = { id: row.id, automationId: row.automation_id, depth: row.depth, steps: row.steps, status: row.status };
    if (!automation || automation.deletedAt || !automation.enabled) {
      await store.updateRun(row.id, { status: "skipped", error: "The automation was turned off while waiting.", finished_at: now().toISOString() });
      return;
    }
    const record = row.record_id ? await loadRecord(env.context, env.definition, automation.trigger.objectId, row.record_id, { workspace, venueId: env.event.venueId }) : null;
    if (row.record_id && !record) {
      await store.updateRun(row.id, { status: "skipped", error: "The record was deleted while waiting.", finished_at: now().toISOString() });
      return;
    }
    await store.updateRun(row.id, { status: "running" });
    await execute(env, automation, run, { record, payload: row.trigger?.payload ?? null, trigger: row.trigger ?? null, outputs: outputsOf(row.steps) }, item.payload.next);
  }

  // Incoming webhooks and check-ins: the payload is the input; a record list makes it per-record when payload names one.
  async function handlePayload(env, item) {
    const automations = item.automation_id
      ? [await store.automation(env.context, item.automation_id)].filter((automation) => automation?.enabled && !automation.deletedAt)
      : (await store.automations(env.context, { enabledOnly: true })).filter((automation) => automation.trigger.kind === item.kind);
    for (const automation of automations) {
      let recordId = automation.trigger.objectId && UUID.test(item.payload?.recordId ?? "") ? item.payload.recordId : null;
      if (item.kind === "checkin" && automation.trigger.objectId) {
        recordId = await checkinRecord(env, automation.trigger.objectId, item.payload ?? {});
        if (!recordId) {
          const object = objectById(env.definition, automation.trigger.objectId);
          await store.startRun({
            project_id: env.context.projectId, event_id: env.context.eventId, automation_id: automation.id, queue_id: item.id,
            run_key: `${automation.id}:${item.id}:-`, record_id: null, trigger: { kind: item.kind, payload: item.payload }, depth: item.depth,
            status: "skipped", error: `No ${object?.name?.toLowerCase() ?? "record"} matches ${item.payload?.name || "this ticket holder"}.`, finished_at: now().toISOString(),
          });
          continue;
        }
      }
      await runFor(env, automation, item, recordId, { kind: item.kind, payload: item.payload }, { payload: item.payload });
    }
  }

  // The list's record for a checked-in ticket holder: linked to the registration or order, else the same email.
  async function checkinRecord(env, objectId, payload) {
    const holder = UUID.test(payload.registrationId ?? "") ? { kind: "ticket", id: payload.registrationId, email: payload.email ?? null }
      : UUID.test(payload.orderId ?? "") ? { kind: "order", id: payload.orderId, email: payload.email ?? null }
        : payload.email ? { kind: "ticket", id: "00000000-0000-0000-0000-000000000000", email: payload.email } : null;
    return recordForHolder(env.context, env.definition, objectId, holder, { workspace });
  }

  async function handleItem(open, item) {
    const env = await open(item.project_id, item.event_id);
    switch (item.kind) {
      case "change": return handleChange(env, item);
      case "schedule":
      case "date": return handleTimed(env, item);
      case "manual": return handleManual(env, item);
      case "resume": return handleResume(env, item);
      case "hook":
      case "checkin": return handlePayload(env, item);
      default: return undefined;
    }
  }

  // Queues schedules and date triggers that are due, moving each one's next time on exactly once.
  async function tickSchedules(open, scope) {
    const due = await store.dueAutomations(now(), 50);
    for (const automation of due) {
      if (scope && (automation.projectId !== scope.projectId || automation.eventId !== scope.eventId)) continue;
      const env = await open(automation.projectId, automation.eventId);
      const next = nextRunAt(automation.trigger, now(), env.event.timeZone);
      if (!(await store.advanceSchedule(automation.id, automation.nextRunAt, next))) continue;
      await store.enqueue({
        project_id: automation.projectId, event_id: automation.eventId, kind: automation.trigger.kind, automation_id: automation.id,
        payload: { at: automation.nextRunAt }, due_at: now().toISOString(),
      });
    }
  }

  return {
    // Works through due queue items (all events, or one) until the time budget runs out.
    async process({ projectId = null, eventId = null, budgetMs = 8000 } = {}) {
      const deadline = Date.now() + budgetMs;
      const open = session();
      const scope = projectId && eventId ? { projectId, eventId } : null;
      try { await tickSchedules(open, scope); } catch (error) { console.error("[workspace.automations] schedules", error); }
      let handled = 0;
      while (Date.now() < deadline) {
        const items = await store.claim({ limit: 10, lease: 120, projectId: scope?.projectId ?? null, eventId: scope?.eventId ?? null });
        if (!items.length) break;
        for (const item of items) {
          try {
            await handleItem(open, item);
            await store.finishQueue(item.id, { status: "done", last_error: null });
          } catch (error) {
            console.error("[workspace.automations] item", item.id, error);
            const retry = item.attempts < 3;
            await store.finishQueue(item.id, retry
              ? { status: "pending", last_error: message(error), due_at: new Date(Date.now() + 60_000 * item.attempts * item.attempts).toISOString() }
              : { status: "failed", last_error: message(error) }).catch(() => {});
          }
          handled += 1;
        }
      }
      return { handled };
    },

    // Applies a decided approval's outcome to its record as the approval.
    async applyApproval(projectId, eventId, approval) {
      const open = session();
      const env = await open(projectId, eventId);
      const outcome = approval.status === "approved" ? approval.outcomes?.approve : approval.status === "rejected" ? approval.outcomes?.reject : null;
      if (!outcome || (!outcome.status && !outcome.values?.length)) return { applied: false };
      const raw = await workspace.record(env.context, approval.recordId);
      const record = raw && !raw.deletedAt ? await loadRecord(env.context, env.definition, raw.objectId, raw.id, { workspace }) : null;
      if (!record) return { applied: false, error: "The record no longer exists." };
      const run = { id: approval.id, automationId: approval.id, depth: 0 };
      const resolve = await resolverFor(env, { record }, outcome.values.map((item) => item.value).filter((value) => typeof value === "string"));
      try {
        await updateRecord(env, run, record, { values: stepValues(env, record.objectId, outcome.values, resolve, record), status: outcome.status }, `decision:${approval.status}`);
        return { applied: true };
      } catch (error) {
        return { applied: false, error: message(error) };
      }
    },

    // Runs a code step's code against a record without changing anything.
    async testCode(projectId, eventId, { code, recordId = null, payload = null }) {
      const env = await session()(projectId, eventId);
      const objectId = recordId ? (await workspace.record(env.context, recordId))?.objectId : null;
      const record = objectId ? await loadRecord(env.context, env.definition, objectId, recordId, { workspace, venueId: env.event.venueId }) : null;
      const input = codeInput(env, { record, payload, trigger: { kind: "test" }, outputs: {} });
      const result = await runCode(code, input);
      let parsed = null;
      let problem = null;
      if (result.ok) {
        try { parsed = codeResult(result.value); } catch (error) { problem = error.message; }
      }
      return { ok: result.ok && !problem, error: result.error ?? problem, result: parsed, logs: result.logs, ms: result.ms, input };
    },

    // Test-renders an email step for a record without sending it.
    async previewEmail(projectId, eventId, step, recordId) {
      const env = await session()(projectId, eventId);
      const objectId = recordId ? (await workspace.record(env.context, recordId))?.objectId : null;
      const record = objectId ? await loadRecord(env.context, env.definition, objectId, recordId, { workspace }) : null;
      const template = step.templateId ? await documents.store.document(env.context, step.templateId) : null;
      const subject = template?.kind === "email" ? template.config.subject : step.subject;
      const body = template?.kind === "email" ? template.config.body : step.body;
      const resolve = await resolverFor(env, { record }, [subject, body]);
      return automationEmail({ event: env.event.name, brand: env.event.brand, subject: renderTemplate(subject, resolve) || "Update", bodyHtml: renderTemplate(body, resolve, { html: true }) });
    },
  };
}

export const automationEngine = createEngine();
