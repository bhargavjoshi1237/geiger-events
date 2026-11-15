import { evaluateAll } from "@geiger/rbac";
import { ApiError } from "./errors.js";
import { adminClient } from "../supabase/admin.js";

function requireData(result) {
  if (result.error) throw new ApiError("service_unavailable", 503, "This service is unavailable.");
  return result.data;
}

export async function verifiedProjectMembership(project,userId,loadMembership) {
  if (!project || !userId) return false;
  if (!project.organization_id) return project.created_by === userId;
  const membership = await loadMembership(project.organization_id,userId);
  return membership?.user === userId;
}

export async function staffBoundary() {
  const db = adminClient();
  if (!db) throw new ApiError("service_unavailable", 503, "This service is unavailable.");
  const { default: config } = await import("@/geiger-rbac.config");
  return {
    config,
    async loadEvent(eventId) {
      return requireData(await db.from("events").select("id,project_id").eq("id", eventId).maybeSingle());
    },
    async isProjectMember(projectId, userId) {
      const project = requireData(await db.schema("public").from("projects")
        .select("id,created_by,organization_id").eq("id", projectId).maybeSingle());
      return verifiedProjectMembership(project,userId,async(organizationId,memberId) =>
        requireData(await db.schema("public").from("organization_users")
          .select("user").eq("organization", organizationId).eq("user", memberId).maybeSingle()));
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

// Checks the action and also reports, without failing, whether the extra keys are allowed.
async function decideForProject(source, principal, projectId, action, target, also = []) {
  const [roleRows, grantRows] = await Promise.all([
    source.loadRoles(projectId), source.loadGrants(projectId, principal.id),
  ]);
  const { roles, grants } = evaluationInput(projectId, principal.id, roleRows, grantRows);
  const decisions = evaluateAll([action, ...also], {
    config: source.config, roles, grants, actorId: principal.id, ...target,
  });
  if (!decisions[action].allowed) throw new ApiError("forbidden", 403, "You don't have permission to do that.");
  return Object.fromEntries(Object.entries(decisions).map(([key, decision]) => [key, decision.allowed]));
}

// Shapes role/grant rows the way @geiger/rbac expects, dropping grants that point at another project's roles.
export function evaluationInput(projectId, principalId, roleRows, grantRows) {
  const roles = roleRows.map((row) => ({ ...row, projectId: row.project_id ?? row.projectId }));
  const roleIds = new Set(roles.filter((row) => row.projectId === projectId).map((row) => row.id));
  const grants = grantRows.filter((row) =>
    (row.project_id ?? row.projectId) === projectId &&
    (row.user_id ?? row.userId) === principalId && roleIds.has(row.role_id ?? row.roleId),
  ).map((row) => ({
    id: row.id, roleId: row.role_id ?? row.roleId, scope: row.scope,
    status: row.status, deletedAt: row.deleted_at ?? row.deletedAt,
  }));
  return { roles, grants };
}

export async function authorizeEventAction(principal, eventId, action, boundary = null, { also = [] } = {}) {
  if (principal?.kind !== "staff" || !principal.id) {
    throw new ApiError("unauthenticated", 401, "Sign in to continue.");
  }
  const source = boundary ?? await staffBoundary();
  const event = await source.loadEvent(eventId);
  if (!event?.project_id || !await source.isProjectMember(event.project_id, principal.id)) {
    throw new ApiError("not_found", 404, "Event not found.");
  }
  const allowed = await decideForProject(source, principal, event.project_id, action, {
    resource: { ...event, eventId }, scopeId: eventId,
  }, also);
  return { projectId: event.project_id, eventId, principal, permission: action, allowed };
}

// Project-level actions (listing, creating); a grant scoped to specific events doesn't satisfy them.
export async function authorizeProjectAction(principal, projectId, action, boundary = null) {
  if (principal?.kind !== "staff" || !principal.id) {
    throw new ApiError("unauthenticated", 401, "Sign in to continue.");
  }
  const source = boundary ?? await staffBoundary();
  if (!projectId || !await source.isProjectMember(projectId, principal.id)) {
    throw new ApiError("not_found", 404, "Project not found.");
  }
  await decideForProject(source, principal, projectId, action, {});
  return { projectId, principal, permission: action };
}
