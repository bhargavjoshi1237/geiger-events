import { evaluate } from "@geiger/rbac";
import { OperationsError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";

function requireData(result) {
  if (result.error) throw new OperationsError("service_unavailable", 503, "Operations are unavailable.");
  return result.data;
}

async function defaultBoundary() {
  const db = adminClient();
  if (!db) throw new OperationsError("service_unavailable", 503, "Operations are unavailable.");
  const { default: config } = await import("@/geiger-rbac.config");
  return {
    config,
    async loadEvent(eventId) {
      return requireData(await db.from("events").select("id,project_id").eq("id", eventId).maybeSingle());
    },
    async isProjectMember(projectId, userId) {
      const project = requireData(await db.schema("public").from("projects")
        .select("id,created_by,organization_id").eq("id", projectId).maybeSingle());
      if (!project) return false;
      if (project.created_by === userId) return true;
      if (!project.organization_id) return false;
      const membership = requireData(await db.schema("public").from("organization_users")
        .select("user").eq("organization", project.organization_id).eq("user", userId).maybeSingle());
      return Boolean(membership);
    },
    async loadRoles(projectId) {
      return requireData(await db.schema("public").from("roles")
        .select("id,project_id,key,name,permissions")
        .eq("project_id", projectId).is("deleted_at", null));
    },
    async loadGrants(projectId, userId) {
      return requireData(await db.from("role_grants")
        .select("id,project_id,user_id,role_id,scope,status,deleted_at")
        .eq("project_id", projectId).eq("user_id", userId).is("deleted_at", null));
    },
  };
}

export async function authorizeEventAction(principal, eventId, action, boundary = null) {
  if (principal?.kind !== "staff" || !principal.id) {
    throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
  }
  const source = boundary ?? await defaultBoundary();
  const event = await source.loadEvent(eventId);
  if (!event?.project_id || !await source.isProjectMember(event.project_id, principal.id)) {
    throw new OperationsError("not_found", 404, "Event not found.");
  }
  const [roleRows, grantRows] = await Promise.all([
    source.loadRoles(event.project_id), source.loadGrants(event.project_id, principal.id),
  ]);
  const roles = roleRows.map((row) => ({ ...row, projectId: row.project_id ?? row.projectId }));
  const roleIds = new Set(roles.filter((row) => row.projectId === event.project_id).map((row) => row.id));
  const grants = grantRows.filter((row) =>
    (row.project_id ?? row.projectId) === event.project_id &&
    (row.user_id ?? row.userId) === principal.id && roleIds.has(row.role_id ?? row.roleId),
  ).map((row) => ({
    id: row.id, roleId: row.role_id ?? row.roleId, scope: row.scope,
    status: row.status, deletedAt: row.deleted_at ?? row.deletedAt,
  }));
  const decision = evaluate(action, {
    config: source.config, roles, grants, actorId: principal.id,
    resource: { ...event, eventId }, scopeId: eventId,
  });
  if (!decision.allowed) throw new OperationsError("forbidden", 403, "You cannot perform this action.");
  return { projectId: event.project_id, eventId, principal, permission: action };
}
