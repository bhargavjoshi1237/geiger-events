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
};
