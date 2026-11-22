import rbacConfig from "@/geiger-rbac.config";
import { requireId, withControl } from "@/lib/control/http";
import { actorOf, must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, canAdministerRoles, requireAllowed, requireRoleAdmin } from "@/lib/control/team/keys";
import { grantedKeys, roleView, togglePermission } from "@/lib/control/team/members";
import { ROLE_COLUMNS, audit } from "@/lib/control/team/roster";
import { ApiError } from "@/lib/staff_access/errors";

const ALL_KEYS = rbacConfig.permissions.map((p) => p.key);

// The permission matrix, one group per catalog group in first-seen order (as the dashboard's PERMISSION_GROUPS).
function matrix(role) {
  const granted = new Set(grantedKeys(role, ALL_KEYS));
  const groups = [];
  const byGroup = new Map();
  for (const p of rbacConfig.permissions) {
    const name = p.group || "Other";
    if (!byGroup.has(name)) {
      byGroup.set(name, []);
      groups.push(name);
    }
    byGroup.get(name).push({ key: p.key, label: p.label || p.key, granted: granted.has(p.key) });
  }
  return groups.map((group) => ({ group, permissions: byGroup.get(group) }));
}

async function loadRole(db, projectId, roleId) {
  requireId(roleId);
  const role = must(
    await db.schema("public").from("roles").select(ROLE_COLUMNS).eq("id", roleId).eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
    "team.role",
  );
  if (!role) throw new ApiError("not_found", 404, "That role doesn't exist.");
  return role;
}

export async function GET(request, { params }) {
  const { projectId, roleId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view, TEAM_KEYS.roles]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see roles.");
    const [role, admin] = await Promise.all([loadRole(access.db, projectId, roleId), canAdministerRoles(access.db, projectId)]);
    return { role: roleView(role, ALL_KEYS), groups: matrix(role), canManage: admin && access.allowed(TEAM_KEYS.roles) };
  });
}

// PATCH { key, on } — one permission on or off; Owner is never edited, as on the dashboard.
export async function PATCH(request, { params }) {
  const { projectId, roleId } = await params;
  return withControl(request, async (ctx) => {
    const { key, on } = await readJson(request);
    if (typeof key !== "string" || typeof on !== "boolean") throw new ApiError("invalid_input", 400, "Say which permission and whether it's on.");
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.roles]);
    requireAllowed(access, TEAM_KEYS.roles, "Your role can't edit roles.");
    await requireRoleAdmin(access.db, projectId);
    const role = await loadRole(access.db, projectId, roleId);
    const permissions = togglePermission(role, key, on, ALL_KEYS);
    const saved = must(
      await access.db.schema("public").from("roles").update({ permissions }).eq("id", role.id).select(ROLE_COLUMNS).single(),
      "team.roleUpdate",
    );
    await audit(access.db, { projectId, actorUserId: ctx.principal.id, actorName: actorOf(ctx.token), targetName: role.name, action: "role_updated", detail: { key, on } });
    return { role: roleView(saved, ALL_KEYS), groups: matrix(saved), canManage: true };
  });
}
