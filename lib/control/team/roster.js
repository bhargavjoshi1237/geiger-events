import { must } from "../scope.js";
import { activeGrantsByUser, ownerRoleIds } from "./members.js";

// The rows the Team screen reads, all through the signed-in user's client so RLS applies as on the dashboard.

export const ROLE_COLUMNS = "id,project_id,key,name,description,color,permissions,is_system,sort";

export async function loadRoles(db, projectId) {
  return must(
    await db
      .schema("public")
      .from("roles")
      .select(ROLE_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
    "team.roles",
  );
}

export async function loadGrants(db, projectId) {
  return must(await db.from("role_grants").select("*").eq("project_id", projectId).is("deleted_at", null), "team.grants");
}

// Projects real org members into the roster first, as the dashboard does on every load; a failure only means a stale list.
export async function loadRoster(db, projectId) {
  const roles = await loadRoles(db, projectId);
  const defaultRole = roles.find((r) => r.key === "member") || roles[roles.length - 1] || null;
  const synced = await db.rpc("sync_project_team", { p_project_id: projectId, p_default_role: defaultRole?.id ?? null });
  if (synced.error) console.error("[control.team.sync]", synced.error.message);
  const [members, grants] = await Promise.all([
    db
      .from("project_members")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .then((res) => must(res, "team.members")),
    loadGrants(db, projectId),
  ]);
  return {
    roles,
    members,
    grants,
    grantByUser: activeGrantsByUser(grants),
    owners: ownerRoleIds(roles),
    roleById: new Map(roles.map((r) => [r.id, r])),
  };
}

// The Team screen's audit feed; a failed write never blocks the change it records.
export async function audit(db, entry) {
  const { error } = await db.from("member_activity").insert({
    project_id: entry.projectId,
    actor_user_id: entry.actorUserId ?? null,
    actor_name: entry.actorName ?? "",
    target_member_id: entry.targetMemberId ?? null,
    target_name: entry.targetName ?? "",
    action: entry.action,
    detail: entry.detail ?? {},
  });
  if (error) console.error("[control.team.audit]", error.message);
}

// Revoke every other role this user holds, then grant (or revive) this one, keeping their event scope — setMemberRole's rule.
export async function setMemberRole(db, { projectId, userId, roleId, grantedBy, grants }) {
  const mine = grants.filter((g) => g.user_id === userId);
  const scope = mine.find((g) => g.scope && typeof g.scope === "object")?.scope ?? {};
  for (const g of mine.filter((g) => g.role_id !== roleId)) {
    must(await db.from("role_grants").update({ deleted_at: new Date().toISOString() }).eq("id", g.id), "team.revokeGrant");
  }
  const existing = must(
    await db.from("role_grants").select("id").eq("project_id", projectId).eq("user_id", userId).eq("role_id", roleId).limit(1).maybeSingle(),
    "team.findGrant",
  );
  const payload = { project_id: projectId, user_id: userId, role_id: roleId, scope, status: "active", granted_by: grantedBy, deleted_at: null };
  const query = existing?.id ? db.from("role_grants").update(payload).eq("id", existing.id) : db.from("role_grants").insert(payload);
  return must(await query.select("*").single(), "team.grant");
}
