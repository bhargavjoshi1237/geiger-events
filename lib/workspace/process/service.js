import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { normaliseRecordInput } from "../records/values.js";
import { commandSender } from "../server/send.js";
import { workspaceStore } from "../server/store.js";
import { workspaceService } from "../server/service.js";
import { backgroundBaseUrl } from "./emails.js";
import { documentStore } from "../documents/store.js";
import { automationEngine } from "./engine.js";
import { loadRecords } from "./records.js";
import { loadReviewData, planAssignments, reviewInput, reviewResults, validateReviewSetup } from "./review.js";
import { cleanProcess, validateProcess } from "./stages.js";
import { STEP_KINDS, validateSteps } from "./steps.js";
import { processStore } from "./store.js";
import { templateToNames } from "./template.js";
import { nextRunAt, subjectOf, TIMED_TRIGGERS, TRIGGER_KINDS, triggerSummary, validateTrigger } from "./triggers.js";

const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };
const notFound = (message) => new WorkspaceError("not_found", 404, message);
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const sha256 = (value) => createHash("sha256").update(value).digest();
export const hookUrl = (automationId, token) => `${backgroundBaseUrl()}/api/v1/workspace/hooks/${automationId}/${token}`;

// Templates are stored with field keys; the editor shows field names. Walks a step and converts every text that may hold placeholders.
function stepForEditing(definition, subjectId, step) {
  const names = (value) => (typeof value === "string" ? templateToNames(value, definition, subjectId) : value);
  const values = (list) => (list ?? []).map((item) => ({ ...item, value: names(item.value) }));
  return {
    ...step,
    ...(step.values ? { values: values(step.values) } : {}),
    ...(step.subject !== undefined ? { subject: names(step.subject) } : {}),
    ...(step.body !== undefined ? { body: names(step.body) } : {}),
    ...(step.title !== undefined ? { title: names(step.title) } : {}),
    ...(step.message !== undefined ? { message: names(step.message) } : {}),
    ...(step.matchValue !== undefined ? { matchValue: names(step.matchValue) } : {}),
    ...(step.approve ? { approve: { ...step.approve, values: values(step.approve.values) } } : {}),
    ...(step.reject ? { reject: { ...step.reject, values: values(step.reject.values) } } : {}),
  };
}

export function createProcessService({ store = processStore, workspace = workspaceStore, records = workspaceService, engine = automationEngine } = {}) {
  const send = commandSender(workspace);

  async function definitionOf(context) {
    const definition = await workspace.definition(context);
    if (!definition.workspace) throw notFound("Set up the workspace for this event first.");
    return definition;
  }

  async function timeZoneOf(context) {
    return (await workspace.event(context))?.timezone || "UTC";
  }

  function conditionOf(definition, objectId, condition) {
    if (!condition || !isObject(condition) || !Array.isArray(condition.items) || !condition.items.length) return null;
    if (!objectId) bad("Conditions need a trigger with a list.");
    try {
      compileQuery(definition, objectId, { filter: condition, limit: 1 });
    } catch (error) {
      if (error instanceof WorkspaceError) bad(error.message);
      throw error;
    }
    return condition;
  }

  function clientAutomation(definition, automation, lastRun = null) {
    const subjectId = subjectOf(automation.trigger);
    return {
      ...automation,
      steps: automation.steps.map((step) => stepForEditing(definition, subjectId, step)),
      summary: triggerSummary(automation.trigger, definition),
      lastRun: lastRun ? { status: lastRun.status, at: lastRun.started_at } : null,
    };
  }

  async function nameMaps(context, { userIds = [], recordIds = [] } = {}) {
    const [people, labels] = await Promise.all([
      workspace.people(context, [...new Set(userIds.filter(Boolean))]),
      workspace.recordLabels(context, [...new Set(recordIds.filter(Boolean))]),
    ]);
    return {
      people: new Map(people.map((row) => [row.user_id, row.name || row.email])),
      records: new Map(labels.map((row) => [row.id, row])),
    };
  }

  const recordRef = (definition, row) => {
    if (!row) return null;
    const object = definition.objects.find((item) => item.id === row.object_id);
    return { id: row.id, objectId: row.object_id, number: Number(row.number), label: row.title || `${object?.numberPrefix ?? "REC"}-${row.number}`, deleted: Boolean(row.deleted_at) };
  };

  return {
    // Stage rules, automations, review setups and the team (for pickers) in one read.
    async overview(context) {
      const definition = await definitionOf(context);
      const [processes, automations, setups, members, pending] = await Promise.all([
        store.processes(context), store.automations(context), store.reviewSetups(context), store.members(context), store.pendingCount(context),
      ]);
      const lastRuns = new Map((await store.lastRuns(context, automations.map((automation) => automation.id))).map((row) => [row.automation_id, row]));
      return {
        processes: Object.fromEntries([...processes.entries()].map(([objectId, config]) => [objectId, { ...cleanProcess(definition, objectId, config), revision: config.revision }])),
        automations: automations.map((automation) => clientAutomation(definition, automation, lastRuns.get(automation.id))),
        reviewSetups: setups,
        members: members.map((row) => ({ userId: row.user_id, name: row.name || row.email, email: row.email })),
        queue: { pending },
        catalog: { triggers: TRIGGER_KINDS, steps: STEP_KINDS },
      };
    },

    async saveProcess(context, { objectId, config }) {
      const definition = await definitionOf(context);
      if (!UUID.test(objectId ?? "")) bad("Choose a list.");
      const clean = validateProcess(definition, objectId, config ?? {});
      const row = await store.saveProcess(context, objectId, clean, context.principal.id);
      await store.logStructure(context, context.principal.id, "process.save", { objectId, config: clean }).catch(() => {});
      return { process: { ...row.config, revision: Number(row.revision) } };
    },

    async saveAutomation(context, body) {
      const definition = await definitionOf(context);
      const input = isObject(body.automation) ? body.automation : {};
      const name = text(input.name, 120);
      if (!name) bad("Name the automation.");
      const trigger = validateTrigger(definition, input.trigger);
      const subjectId = subjectOf(trigger);
      const [members, setups, documents] = await Promise.all([
        store.members(context), store.reviewSetups(context), documentStore.documents(context).catch(() => null),
      ]);
      const steps = validateSteps(definition, input.steps, {
        subjectId, payload: trigger.kind === "hook" || trigger.kind === "checkin",
        members: new Set(members.map((row) => row.user_id)), reviewSetups: new Set(setups.map((setup) => setup.id)),
        documents: documents ? new Map(documents.map((document) => [document.id, document])) : null,
      });
      const condition = conditionOf(definition, subjectId, input.condition);
      const enabled = input.enabled === true;
      const next = TIMED_TRIGGERS.has(trigger.kind) && enabled ? nextRunAt(trigger, new Date(), await timeZoneOf(context)) : null;
      const patch = {
        name, description: text(input.description, 1000), trigger, condition, steps, enabled,
        next_run_at: next ? next.toISOString() : null, updated_by: context.principal.id,
      };
      let automation;
      if (UUID.test(body.id ?? "")) {
        const current = await store.automation(context, body.id);
        if (!current || current.deletedAt) throw notFound("That automation no longer exists.");
        automation = await store.updateAutomation(context, current.id, { ...patch, revision: current.revision + 1 },
          Number.isInteger(body.expectedRevision) ? body.expectedRevision : current.revision);
      } else {
        const existing = await store.automations(context);
        automation = await store.insertAutomation({
          ...patch, project_id: context.projectId, event_id: context.eventId, created_by: context.principal.id,
          position: existing.reduce((max, item) => Math.max(max, item.position), -1) + 1,
        });
      }
      await store.logStructure(context, context.principal.id, "automation.save", { automationId: automation.id, name }).catch(() => {});
      return { automation: clientAutomation(definition, automation) };
    },

    async toggleAutomation(context, { id, enabled }) {
      const definition = await definitionOf(context);
      const current = UUID.test(id ?? "") ? await store.automation(context, id) : null;
      if (!current || current.deletedAt) throw notFound("That automation no longer exists.");
      const next = enabled && TIMED_TRIGGERS.has(current.trigger.kind) ? nextRunAt(current.trigger, new Date(), await timeZoneOf(context)) : null;
      const automation = await store.updateAutomation(context, current.id, {
        enabled: enabled === true, next_run_at: next ? next.toISOString() : null, revision: current.revision + 1, updated_by: context.principal.id,
      });
      return { automation: clientAutomation(definition, automation) };
    },

    async deleteAutomation(context, { id }) {
      const current = UUID.test(id ?? "") ? await store.automation(context, id) : null;
      if (!current) throw notFound("That automation no longer exists.");
      await store.updateAutomation(context, current.id, { deleted_at: new Date().toISOString(), enabled: false, next_run_at: null });
      await store.logStructure(context, context.principal.id, "automation.delete", { automationId: current.id, name: current.name }).catch(() => {});
      return { deleted: true };
    },

    async reorderAutomations(context, { order }) {
      if (!Array.isArray(order) || order.some((id) => !UUID.test(id ?? ""))) bad("Choose automations to reorder.");
      await Promise.all(order.slice(0, 200).map((id, position) => store.updateAutomation(context, id, { position }).catch(() => null)));
      return { reordered: true };
    },

    // A new incoming-webhook address; only its hash is kept, so the old address stops working.
    async hookAddress(context, { id }) {
      const current = UUID.test(id ?? "") ? await store.automation(context, id) : null;
      if (!current || current.deletedAt) throw notFound("That automation no longer exists.");
      if (current.trigger.kind !== "hook") bad("Only automations started by a webhook have an address.");
      const token = randomBytes(24).toString("base64url");
      await store.updateAutomation(context, current.id, { hook_token_hash: sha256(token).toString("hex") });
      return { url: hookUrl(current.id, token) };
    },

    // Checks an incoming webhook's token and queues the automation; null for anything that shouldn't reveal itself.
    async receiveHook({ automationId, token, payload }) {
      if (!UUID.test(automationId ?? "") || typeof token !== "string" || !token || token.length > 200) return null;
      const row = await store.automationForHook(automationId);
      if (!row?.hook_token_hash || !row.enabled || row.trigger?.kind !== "hook") return null;
      const expected = Buffer.from(row.hook_token_hash, "hex");
      const given = sha256(token);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      const item = await store.enqueue({ project_id: row.project_id, event_id: row.event_id, kind: "hook", automation_id: row.id, payload });
      return { projectId: row.project_id, eventId: row.event_id, queued: item.id };
    },

    // Runs an automation now on chosen records (manual trigger, or any record trigger as a test) and waits for the result.
    async runNow(context, { id, recordIds }) {
      const automation = UUID.test(id ?? "") ? await store.automation(context, id) : null;
      if (!automation || automation.deletedAt) throw notFound("That automation no longer exists.");
      const ids = Array.isArray(recordIds) ? [...new Set(recordIds.filter((item) => UUID.test(item ?? "")))].slice(0, 100) : [];
      if (automation.trigger.objectId && !ids.length) bad("Choose records to run it on.");
      const item = await store.enqueue({
        project_id: context.projectId, event_id: context.eventId,
        kind: automation.trigger.objectId ? "manual" : TIMED_TRIGGERS.has(automation.trigger.kind) ? automation.trigger.kind : "manual",
        automation_id: automation.id, payload: { recordIds: ids, userId: context.principal.id, at: new Date().toISOString() },
      });
      await engine.process({ projectId: context.projectId, eventId: context.eventId, budgetMs: 25_000 });
      const runs = (await store.runs(context, { automationId: automation.id, limit: 100 })).filter((run) => run.queueId === item.id);
      return { runs, queued: item.id };
    },

    async runs(context, { automationId = null, recordId = null, status = null, before = null } = {}) {
      const definition = await definitionOf(context);
      const rows = await store.runs(context, {
        automationId: UUID.test(automationId ?? "") ? automationId : null, recordId: UUID.test(recordId ?? "") ? recordId : null,
        status: ["running", "succeeded", "failed", "skipped", "waiting"].includes(status) ? status : null,
        before: typeof before === "string" && !Number.isNaN(Date.parse(before)) ? before : null, limit: 50,
      });
      const automations = new Map((await store.automations(context)).map((item) => [item.id, item]));
      const { records } = await nameMaps(context, { recordIds: rows.map((row) => row.recordId) });
      return {
        runs: rows.map((run) => ({
          ...run, automation: automations.get(run.automationId)?.name ?? "Deleted automation",
          record: recordRef(definition, records.get(run.recordId)),
        })),
      };
    },

    async retryRun(context, { runId }) {
      const run = UUID.test(runId ?? "") ? await store.run(context, runId) : null;
      if (!run) throw notFound("That run no longer exists.");
      if (!["failed", "skipped"].includes(run.status)) bad("Only failed or skipped runs can be retried.");
      return this.runNow(context, { id: run.automationId, recordIds: run.recordId ? [run.recordId] : [] });
    },

    // Approvals, with the record, approvers' names and whether the signed-in person can decide.
    async approvals(context, { status = null, recordId = null } = {}) {
      const definition = await definitionOf(context);
      const rows = await store.approvals(context, {
        status: ["pending", "approved", "rejected", "cancelled"].includes(status) ? status : null,
        recordId: UUID.test(recordId ?? "") ? recordId : null, limit: 200,
      });
      const maps = await nameMaps(context, {
        userIds: rows.flatMap((row) => [...row.approvers, ...row.decisions.map((item) => item.userId)]),
        recordIds: rows.map((row) => row.recordId),
      });
      const me = context.principal.id;
      return {
        approvals: rows.map((row) => ({
          ...row,
          record: recordRef(definition, maps.records.get(row.recordId)),
          approverNames: row.approvers.map((id) => ({ userId: id, name: maps.people.get(id) ?? "Team member" })),
          decisions: row.decisions.map((item) => ({ ...item, name: maps.people.get(item.userId) ?? "Team member" })),
          canDecide: row.status === "pending" && row.approvers.includes(me) && !row.decisions.some((item) => item.userId === me),
        })),
        mine: rows.filter((row) => row.status === "pending" && row.approvers.includes(me) && !row.decisions.some((item) => item.userId === me)).length,
      };
    },

    async pendingApprovals(context) {
      return { mine: await store.pendingApprovalsFor(context, context.principal.id).catch(() => 0) };
    },

    async decide(context, { id, decision, note }) {
      if (!UUID.test(id ?? "")) bad("Choose an approval.");
      const approval = await store.decideApproval(context, id, context.principal.id, decision, text(note, 2000));
      if (approval.status === "approved" || approval.status === "rejected") {
        const result = await engine.applyApproval(context.projectId, context.eventId, approval);
        if (result.error) await store.updateApproval(approval.id, { applied_error: result.error });
        return { approval: { ...approval, appliedError: result.error ?? null } };
      }
      return { approval };
    },

    async cancelApproval(context, { id }) {
      const approval = UUID.test(id ?? "") ? await store.approval(context, id) : null;
      if (!approval) throw notFound("That approval no longer exists.");
      if (approval.status !== "pending") bad("Only pending approvals can be cancelled.");
      await store.updateApproval(approval.id, { status: "cancelled", decided_at: new Date().toISOString() });
      return { cancelled: true };
    },

    async saveReviewSetup(context, body) {
      const definition = await definitionOf(context);
      const name = text(body.setup?.name, 100) || "Review";
      const config = validateReviewSetup(definition, body.setup?.config ?? {});
      if (UUID.test(body.id ?? "")) {
        const current = await store.reviewSetup(context, body.id);
        if (!current) throw notFound("That review setup no longer exists.");
        return { setup: await store.updateReviewSetup(context, current.id, { name, config, revision: current.revision + 1 }, current.revision) };
      }
      return { setup: await store.insertReviewSetup({ project_id: context.projectId, event_id: context.eventId, name, config, created_by: context.principal.id }) };
    },

    async deleteReviewSetup(context, { id }) {
      const current = UUID.test(id ?? "") ? await store.reviewSetup(context, id) : null;
      if (!current) throw notFound("That review setup no longer exists.");
      await store.updateReviewSetup(context, current.id, { deleted_at: new Date().toISOString() });
      return { deleted: true };
    },

    async reviewResults(context, { setupId }) {
      const definition = await definitionOf(context);
      const setup = UUID.test(setupId ?? "") ? await store.reviewSetup(context, setupId) : null;
      if (!setup) throw notFound("That review setup no longer exists.");
      const config = validateReviewSetup(definition, setup.config);
      const live = { ...setup, config };
      const data = await loadReviewData(context, definition, live, { workspace });
      return { setup: live, results: reviewResults(definition, live, data), reviewers: data.reviewers.length };
    },

    async planReview(context, { setupId, submissionIds = null }) {
      const definition = await definitionOf(context);
      const setup = UUID.test(setupId ?? "") ? await store.reviewSetup(context, setupId) : null;
      if (!setup) throw notFound("That review setup no longer exists.");
      const live = { ...setup, config: validateReviewSetup(definition, setup.config) };
      const ids = Array.isArray(submissionIds) ? submissionIds.filter((id) => UUID.test(id ?? "")) : null;
      const data = await loadReviewData(context, definition, live, { workspace, submissionIds: ids?.length ? ids : null });
      return { plan: planAssignments(definition, live, data) };
    },

    // Re-plans on the server (so nobody can inject pairs) and creates the reviews as the signed-in staff member.
    async applyReview(context, { setupId, submissionIds = null }) {
      const definition = await definitionOf(context);
      const { plan } = await this.planReview(context, { setupId, submissionIds });
      const setup = await store.reviewSetup(context, setupId);
      const live = { ...setup, config: validateReviewSetup(definition, setup.config) };
      const timeZone = await timeZoneOf(context);
      const rows = plan.pairs.map((pair) => {
        const out = normaliseRecordInput(definition, live.config.reviewsObjectId, reviewInput(live, pair), null, { timeZone });
        return { id: randomUUID(), values: out.values, status: out.status, links: out.links, title: out.title ?? "" };
      });
      let created = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const result = await send(context, "records.import", { objectId: live.config.reviewsObjectId, rows: rows.slice(i, i + 200) });
        created += Number(result?.count ?? 0);
      }
      return { created, unfilled: plan.unfilled };
    },

    // Records a decision on a submission (a status move through the stage rules).
    async decideSubmission(context, { recordId, status, force = false }) {
      return records.runCommand(context, { action: "record.update", recordId, status, force });
    },

    async recordContext(context, { recordId }) {
      const definition = await definitionOf(context);
      if (!UUID.test(recordId ?? "")) bad("Choose a record.");
      const raw = await workspace.record(context, recordId);
      if (!raw) throw notFound("That record no longer exists.");
      const [automations, approvals, runs] = await Promise.all([
        store.automations(context, { enabledOnly: true }),
        store.approvals(context, { recordId }),
        store.runs(context, { recordId, limit: 20 }),
      ]);
      const names = new Map((await store.automations(context)).map((item) => [item.id, item.name]));
      return {
        manual: automations.filter((item) => item.trigger.kind === "manual" && item.trigger.objectId === raw.objectId).map((item) => ({ id: item.id, name: item.name })),
        approvals: approvals.map((item) => ({ id: item.id, title: item.title, status: item.status, createdAt: item.createdAt })),
        runs: runs.map((run) => ({ id: run.id, automation: names.get(run.automationId) ?? "Automation", status: run.status, at: run.startedAt, error: run.error })),
        definitionRevision: definition.workspace?.revision ?? null,
      };
    },

    // Tries a code step's code on a record (or none) without changing anything.
    async testCode(context, { code, recordId, payload }) {
      if (typeof code !== "string" || !code.trim()) bad("Write the code to run.");
      const id = UUID.test(recordId ?? "") ? recordId : null;
      return engine.testCode(context.projectId, context.eventId, { code: code.slice(0, 70_000), recordId: id, payload: isObject(payload) ? payload : null });
    },

    async previewEmail(context, { step, recordId }) {
      const definition = await definitionOf(context);
      const raw = UUID.test(recordId ?? "") ? await workspace.record(context, recordId) : null;
      const [clean] = validateSteps(definition, [{ ...step, kind: "send_email", to: [{ kind: "address", address: "preview@example.com" }] }], { subjectId: raw?.objectId ?? null, payload: true });
      return engine.previewEmail(context.projectId, context.eventId, clean, raw?.id ?? null);
    },

    loadRecords: (context, definition, objectId, ids) => loadRecords(context, definition, objectId, ids, { workspace }),
  };
}

export const processService = createProcessService();
