import { OperationsError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";

function db() {
  const client = adminClient();
  if (!client) throw new OperationsError("service_unavailable", 503, "Operations are unavailable.");
  return client;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

export const operationsStore = {
  async readWorkspace(context) {
    const { projectId, eventId } = context;
    const row = checked(await db().from("ops_workspaces")
      .select("revision,status,published_version,draft_json")
      .eq("project_id", projectId).eq("event_id", eventId).maybeSingle());
    if (!row) return { revision: 0, status: "draft", publishedVersion: null, draft: [], modules: [] };
    let modules = [];
    if (row.published_version) {
      const version = checked(await db().from("ops_workspace_versions").select("modules")
        .eq("project_id", projectId).eq("event_id", eventId)
        .eq("version", row.published_version).single());
      modules = version.modules;
    }
    return { revision: row.revision, status: row.status,
      publishedVersion: row.published_version, draft: row.draft_json, modules };
  },
  async countModuleRecords(context, moduleKey) {
    const { count, error } = await db().from("ops_entities").select("id", { count: "exact", head: true })
      .eq("project_id", context.projectId).eq("event_id", context.eventId)
      .eq("module_key", moduleKey);
    if (error) throw error;
    return count ?? 0;
  },
  async saveDraft(context, { expectedRevision, modules }) {
    return checked(await db().rpc("ops_save_workspace_draft", {
      p_project_id: context.projectId, p_event_id: context.eventId,
      p_actor_id: context.principal.id, p_expected_revision: expectedRevision, p_modules: modules,
    }));
  },
  async publish(context, { expectedRevision, modules, commandId, requestHash }) {
    return checked(await db().rpc("ops_publish_workspace", {
      p_project_id: context.projectId, p_event_id: context.eventId,
      p_actor_id: context.principal.id, p_expected_revision: expectedRevision,
      p_modules: modules, p_command_id: commandId, p_request_hash: requestHash,
    }));
  },
  async lookupReceipt(context, commandId) {
    return checked(await db().from("ops_command_receipts")
      .select("request_hash,response").eq("project_id", context.projectId)
      .eq("event_id", context.eventId).eq("actor_id", context.principal.id)
      .eq("command_id", commandId).maybeSingle());
  },
  async getRecord(context, recordId) {
    const entity = checked(await db().from("ops_entities")
      .select("id,module_key,definition_version,title,state,revision,archived_at,created_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId)
      .eq("id", recordId).maybeSingle());
    if (!entity) return null;
    const [data, links] = await Promise.all([
      db().from("ops_custom_records").select("field_values")
        .eq("project_id", context.projectId).eq("event_id", context.eventId)
        .eq("entity_id", recordId).single(),
      db().from("ops_entity_links").select("field_id,target_entity_id")
        .eq("project_id", context.projectId).eq("event_id", context.eventId)
        .eq("source_entity_id", recordId),
    ]);
    return { id: entity.id, moduleKey: entity.module_key, definitionVersion: entity.definition_version,
      title: entity.title, state: entity.state, revision: entity.revision,
      archivedAt: entity.archived_at, createdAt: entity.created_at,
      values: checked(data).field_values,
      references: checked(links).map((item) => ({ fieldId: item.field_id, targetId: item.target_entity_id })) };
  },
  async getReferenceTargets(context, ids) {
    const rows = checked(await db().from("ops_entities")
      .select("id,project_id,event_id,module_key,archived_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).in("id", ids));
    return rows.map((item) => ({ id: item.id, projectId: item.project_id, eventId: item.event_id,
      moduleKey: item.module_key, archivedAt: item.archived_at }));
  },
  async mutate(context, command) {
    return checked(await db().rpc("ops_mutate_record", {
      p_project_id: context.projectId, p_event_id: context.eventId,
      p_actor_id: context.principal.id, p_command: command,
    }));
  },
  async list(context, filter) {
    return checked(await db().rpc("ops_list_records", {
      p_project_id: context.projectId, p_event_id: context.eventId,
      p_module_key: filter.moduleKey, p_state: filter.state,
      p_before_at: filter.cursor?.at ?? null, p_before_id: filter.cursor?.id ?? null,
      p_limit: filter.limit, p_archived: filter.archived,
    }));
  },
};
