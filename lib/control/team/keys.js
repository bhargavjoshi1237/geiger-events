import { ApiError } from "../../staff_access/errors.js";

// The permission each Settings/Discovery action needs in Control — the same keys the dashboard gates them with.
export const TEAM_KEYS = {
  view: "events.settings.view",
  invite: "events.team.invite",
  assign: "events.team.assign",
  roles: "events.role.manage",
  manage: "events.settings.manage",
  discovery: "events.discovery.view",
  events: "events.events.view",
  edit: "events.event.edit",
};

export function requireAllowed(access, key, message = "You don't have permission to do that.") {
  if (!access.allowed(key)) throw new ApiError("forbidden", 403, message);
}

const ADMIN_ONLY = "Only an owner or admin of the organisation can change team access and roles.";

// Database rules let only org owners/admins write roles, grants and the roster, whatever the RBAC role says; ask the same question first.
export async function canAdministerRoles(db, projectId) {
  const { data, error } = await db.rpc("ops_can_administer_roles", { p_project_id: projectId });
  if (error) {
    console.error("[control.team.administer]", error.message);
    return false;
  }
  return data === true;
}

export async function requireRoleAdmin(db, projectId) {
  if (!(await canAdministerRoles(db, projectId))) throw new ApiError("forbidden", 403, ADMIN_ONLY);
}

// A write the database rules dropped comes back with no rows; that is a refusal, not a success.
export function requireWritten(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new ApiError("forbidden", 403, ADMIN_ONLY);
  return rows;
}
