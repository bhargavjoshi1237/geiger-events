import { WorkspaceError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";

// System contexts read the workspace without a staff member; this id never matches a personal saved view.
export const SYSTEM_ID = "00000000-0000-4000-8000-000000000000";
export const systemContext = (projectId, eventId) => ({ projectId, eventId, principal: { kind: "system", id: SYSTEM_ID } });

function db() {
  const client = adminClient();
  if (!client) throw new WorkspaceError("service_unavailable", 503, "Workspace is unavailable.");
  return client;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

const scope = (query, context) => query.eq("project_id", context.projectId).eq("event_id", context.eventId);

export const automationRow = (row) => row && ({
  id: row.id, projectId: row.project_id, eventId: row.event_id, name: row.name, description: row.description, enabled: row.enabled,
  trigger: row.trigger, condition: row.condition, steps: row.steps, hasHook: Boolean(row.hook_token_hash), nextRunAt: row.next_run_at,
  position: row.position, revision: Number(row.revision), createdBy: row.created_by, updatedBy: row.updated_by,
  createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at,
});

export const runRow = (row) => row && ({
  id: row.id, automationId: row.automation_id, queueId: row.queue_id, recordId: row.record_id, status: row.status,
  trigger: row.trigger, steps: row.steps, error: row.error, depth: row.depth, startedAt: row.started_at, finishedAt: row.finished_at,
});

export const approvalRow = (row) => row && ({
  id: row.id, recordId: row.record_id, automationId: row.automation_id, runId: row.run_id, title: row.title, message: row.message,
  approvers: row.approvers, rule: row.rule, decisions: row.decisions, outcomes: row.outcomes, status: row.status,
  appliedError: row.applied_error, createdAt: row.created_at, decidedAt: row.decided_at,
});

export const setupRow = (row) => row && ({
  id: row.id, name: row.name, config: row.config, revision: Number(row.revision), createdAt: row.created_at, updatedAt: row.updated_at,
});

export const processStore = {
  async processes(context) {
    const rows = checked(await scope(db().from("workspace_processes").select("object_id,config,revision"), context));
    return new Map(rows.map((row) => [row.object_id, { ...row.config, revision: Number(row.revision) }]));
  },
  async process(context, objectId) {
    const row = checked(await scope(db().from("workspace_processes").select("config,revision"), context).eq("object_id", objectId).maybeSingle());
    return row ? { ...row.config, revision: Number(row.revision) } : null;
  },
  async saveProcess(context, objectId, config, actorId) {
    const current = checked(await scope(db().from("workspace_processes").select("revision"), context).eq("object_id", objectId).maybeSingle());
    const row = { project_id: context.projectId, event_id: context.eventId, object_id: objectId, config, updated_by: actorId,
      updated_at: new Date().toISOString(), revision: current ? Number(current.revision) + 1 : 1 };
    return checked(await db().from("workspace_processes").upsert(row, { onConflict: "object_id" }).select("config,revision").single());
  },

  async automations(context, { enabledOnly = false } = {}) {
    let query = scope(db().from("workspace_automations").select("*"), context).is("deleted_at", null);
    if (enabledOnly) query = query.eq("enabled", true);
    return checked(await query.order("position").order("created_at")).map(automationRow);
  },
  async automation(context, id) {
    return automationRow(checked(await scope(db().from("workspace_automations").select("*"), context).eq("id", id).maybeSingle()));
  },
  async automationForHook(id) {
    return checked(await db().from("workspace_automations").select("*").eq("id", id).is("deleted_at", null).maybeSingle());
  },
  async insertAutomation(row) {
    return automationRow(checked(await db().from("workspace_automations").insert(row).select("*").single()));
  },
  // Optimistic update: refuses when someone saved in between.
  async updateAutomation(context, id, patch, expectedRevision = null) {
    let query = scope(db().from("workspace_automations").update({ ...patch, updated_at: new Date().toISOString() }), context).eq("id", id);
    if (expectedRevision !== null) query = query.eq("revision", expectedRevision);
    const rows = checked(await query.select("*"));
    if (!rows.length) throw new WorkspaceError("revision_conflict", 409, "Someone else changed this automation. Reload and try again.");
    return automationRow(rows[0]);
  },
  async dueAutomations(now, limit = 50) {
    return checked(await db().from("workspace_automations").select("*").eq("enabled", true).is("deleted_at", null)
      .lte("next_run_at", now.toISOString()).order("next_run_at").limit(limit)).map(automationRow);
  },
  // Moves a schedule on only if nobody else already did, so one due time queues one run.
  async advanceSchedule(id, from, to) {
    const rows = checked(await db().from("workspace_automations").update({ next_run_at: to ? to.toISOString() : null })
      .eq("id", id).eq("next_run_at", from).select("id"));
    return rows.length > 0;
  },

  async enqueue(row) {
    return checked(await db().from("workspace_queue").insert(row).select("*").single());
  },
  async claim({ limit = 20, lease = 120, projectId = null, eventId = null } = {}) {
    return checked(await db().rpc("workspace_queue_claim", { p_limit: limit, p_lease_seconds: lease, p_project: projectId, p_event: eventId })) ?? [];
  },
  async finishQueue(id, patch) {
    checked(await db().from("workspace_queue").update({ ...patch, locked_until: null, updated_at: new Date().toISOString() }).eq("id", id));
  },
  async pendingCount(context) {
    const { count, error } = await scope(db().from("workspace_queue").select("id", { count: "exact", head: true }), context).in("status", ["pending", "running"]);
    if (error) throw error;
    return count ?? 0;
  },
  async change(id) {
    return checked(await db().from("workspace_changes").select("*").eq("id", id).maybeSingle());
  },

  // Inserts a run unless one with the same key exists; returns { run, created }.
  async startRun(row) {
    const inserted = await db().from("workspace_runs").insert(row).select("*").maybeSingle();
    if (!inserted.error) return { run: runRow(inserted.data), created: true };
    if (inserted.error.code !== "23505") throw inserted.error;
    return { run: runRow(checked(await db().from("workspace_runs").select("*").eq("run_key", row.run_key).single())), created: false };
  },
  async run(context, id) {
    return runRow(checked(await scope(db().from("workspace_runs").select("*"), context).eq("id", id).maybeSingle()));
  },
  async runById(id) {
    return checked(await db().from("workspace_runs").select("*").eq("id", id).maybeSingle());
  },
  async updateRun(id, patch) {
    checked(await db().from("workspace_runs").update(patch).eq("id", id));
  },
  async runs(context, { automationId, recordId, status, before, limit = 50 } = {}) {
    let query = scope(db().from("workspace_runs").select("*"), context);
    if (automationId) query = query.eq("automation_id", automationId);
    if (recordId) query = query.eq("record_id", recordId);
    if (status) query = query.eq("status", status);
    if (before) query = query.lt("started_at", before);
    return checked(await query.order("started_at", { ascending: false }).limit(limit)).map(runRow);
  },
  async lastRuns(context, automationIds) {
    if (!automationIds.length) return [];
    const rows = await Promise.all(automationIds.map(async (id) => checked(await scope(db().from("workspace_runs").select("automation_id,status,started_at"), context)
      .eq("automation_id", id).order("started_at", { ascending: false }).limit(1))[0]));
    return rows.filter(Boolean);
  },

  async systemCommand(context, { kind = "automation", actorId, depth = 0 }, command) {
    return checked(await db().rpc("workspace_system_command", {
      p_project: context.projectId, p_event: context.eventId, p_kind: kind, p_actor: actorId, p_depth: depth, p_command: command,
    }));
  },

  async approvals(context, { status, recordId, limit = 100 } = {}) {
    let query = scope(db().from("workspace_approvals").select("*"), context);
    if (status) query = query.eq("status", status);
    if (recordId) query = query.eq("record_id", recordId);
    return checked(await query.order("created_at", { ascending: false }).limit(limit)).map(approvalRow);
  },
  async approval(context, id) {
    return approvalRow(checked(await scope(db().from("workspace_approvals").select("*"), context).eq("id", id).maybeSingle()));
  },
  async insertApproval(row) {
    return approvalRow(checked(await db().from("workspace_approvals").insert(row).select("*").single()));
  },
  async decideApproval(context, id, userId, decision, note) {
    return approvalRow(checked(await db().rpc("workspace_approval_decide", {
      p_project: context.projectId, p_event: context.eventId, p_approval: id, p_user: userId, p_decision: decision, p_note: note ?? "",
    })));
  },
  async updateApproval(id, patch) {
    checked(await db().from("workspace_approvals").update(patch).eq("id", id));
  },
  async pendingApprovalsFor(context, userId) {
    const { count, error } = await scope(db().from("workspace_approvals").select("id", { count: "exact", head: true }), context)
      .eq("status", "pending").contains("approvers", [userId]);
    if (error) throw error;
    return count ?? 0;
  },

  async reviewSetups(context) {
    return checked(await scope(db().from("workspace_review_setups").select("*"), context).is("deleted_at", null).order("created_at")).map(setupRow);
  },
  async reviewSetup(context, id) {
    return setupRow(checked(await scope(db().from("workspace_review_setups").select("*"), context).eq("id", id).is("deleted_at", null).maybeSingle()));
  },
  async insertReviewSetup(row) {
    return setupRow(checked(await db().from("workspace_review_setups").insert(row).select("*").single()));
  },
  async updateReviewSetup(context, id, patch, expectedRevision = null) {
    let query = scope(db().from("workspace_review_setups").update({ ...patch, updated_at: new Date().toISOString() }), context).eq("id", id);
    if (expectedRevision !== null) query = query.eq("revision", expectedRevision);
    const rows = checked(await query.select("*"));
    if (!rows.length) throw new WorkspaceError("revision_conflict", 409, "Someone else changed this review setup. Reload and try again.");
    return setupRow(rows[0]);
  },

  async members(context) {
    return checked(await db().from("project_members").select("user_id,name,email").eq("project_id", context.projectId)
      .is("deleted_at", null).not("user_id", "is", null).order("name"));
  },
  async logStructure(context, actorId, action, after, before = null) {
    checked(await db().from("workspace_changes").insert({
      project_id: context.projectId, event_id: context.eventId, actor_id: actorId, kind: "structure", action, before, after,
    }));
  },
  async automationNames(ids) {
    if (!ids.length) return new Map();
    const rows = checked(await db().from("workspace_automations").select("id,name").in("id", ids));
    const approvals = checked(await db().from("workspace_approvals").select("id,title").in("id", ids));
    const keys = await db().from("api_keys").select("id,name").in("id", ids);
    return new Map([
      ...rows.map((row) => [row.id, `Automation · ${row.name}`]), ...approvals.map((row) => [row.id, `Approval · ${row.title}`]),
      ...(keys.data ?? []).map((row) => [row.id, `API · ${row.name || "key"}`]),
    ]);
  },
  // The secret outgoing webhook steps are signed with (added by the openness migration).
  async hookSecret(context) {
    const { data, error } = await db().from("workspace_workspaces").select("hook_secret").eq("project_id", context.projectId).eq("event_id", context.eventId).maybeSingle();
    return error ? null : data?.hook_secret ?? null;
  },
  async housekeeping() {
    return checked(await db().rpc("workspace_process_housekeeping"));
  },
};
