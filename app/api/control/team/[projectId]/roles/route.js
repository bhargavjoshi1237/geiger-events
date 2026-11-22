import rbacConfig from "@/geiger-rbac.config";
import { withControl } from "@/lib/control/http";
import { projectPermissions } from "@/lib/control/scope";
import { TEAM_KEYS, canAdministerRoles, requireAllowed } from "@/lib/control/team/keys";
import { activeGrantsByUser, roleView } from "@/lib/control/team/members";
import { loadGrants, loadRoles } from "@/lib/control/team/roster";

const ALL_KEYS = rbacConfig.permissions.map((p) => p.key);

// GET — every role with how much of the catalog it grants and how many people hold it.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view, TEAM_KEYS.roles]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see roles.");
    const [roles, grants] = await Promise.all([loadRoles(access.db, projectId), loadGrants(access.db, projectId)]);
    const holders = new Map();
    for (const g of activeGrantsByUser(grants).values()) holders.set(g.role_id, (holders.get(g.role_id) || 0) + 1);
    return {
      roles: roles.map((r) => roleView(r, ALL_KEYS, holders.get(r.id) || 0)),
      total: ALL_KEYS.length,
      canManage: (await canAdministerRoles(access.db, projectId)) && access.allowed(TEAM_KEYS.roles),
    };
  });
}
