import { requireId, withControl } from "@/lib/control/http";
import { actorOf, must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed, requireRoleAdmin, requireWritten } from "@/lib/control/team/keys";
import { isLastOwner, memberView, roleIdOf } from "@/lib/control/team/members";
import { audit, loadRoster, setMemberRole } from "@/lib/control/team/roster";
import { ApiError } from "@/lib/staff_access/errors";

const LAST_OWNER = "This is the workspace's last owner — give someone else the Owner role first.";

async function memberScope(ctx, projectId, memberId) {
  requireId(memberId);
  const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.assign]);
  requireAllowed(access, TEAM_KEYS.assign, "Your role can't change the team.");
  await requireRoleAdmin(access.db, projectId);
  const roster = await loadRoster(access.db, projectId);
  const member = roster.members.find((m) => m.id === memberId);
  if (!member) throw new ApiError("not_found", 404, "That person isn't on this project's team.");
  return { access, roster, member };
}

// PATCH { roleId } — the grant is the write that decides access; the roster row follows it for display.
export async function PATCH(request, { params }) {
  const { projectId, memberId } = await params;
  return withControl(request, async (ctx) => {
    const { roleId } = await readJson(request);
    const { access, roster, member } = await memberScope(ctx, projectId, memberId);
    if (!roster.roleById.has(roleId)) throw new ApiError("invalid_input", 400, "Choose a role.");
    const previous = roleIdOf(member, roster.grantByUser);
    if (previous === roleId) return { member: memberView(member, roleId, roster.roleById) };
    if (isLastOwner(member, roster) && !roster.owners.has(roleId)) throw new ApiError("invalid_state", 409, LAST_OWNER);

    requireWritten(must(await access.db.from("project_members").update({ role_id: roleId }).eq("id", member.id).select("id"), "team.memberRole"));
    if (member.user_id) {
      try {
        await setMemberRole(access.db, { projectId, userId: member.user_id, roleId, grantedBy: ctx.principal.id, grants: roster.grants });
      } catch (error) {
        // Put the roster back so it never shows a role the person doesn't actually hold.
        await access.db.from("project_members").update({ role_id: member.role_id }).eq("id", member.id);
        throw error;
      }
    }
    await audit(access.db, {
      projectId,
      actorUserId: ctx.principal.id,
      actorName: actorOf(ctx.token),
      targetMemberId: member.id,
      targetName: member.name || member.email,
      action: "role_changed",
      detail: { role: roster.roleById.get(roleId)?.name },
    });
    return { member: memberView({ ...member, role_id: roleId }, roleId, roster.roleById) };
  });
}

// DELETE — revoking the grant is what removes access; the roster row goes after it, as on the dashboard.
export async function DELETE(request, { params }) {
  const { projectId, memberId } = await params;
  return withControl(request, async (ctx) => {
    const { access, roster, member } = await memberScope(ctx, projectId, memberId);
    if (isLastOwner(member, roster)) throw new ApiError("invalid_state", 409, LAST_OWNER);
    const grant = member.user_id ? roster.grantByUser.get(member.user_id) : null;
    if (grant) requireWritten(must(await access.db.from("role_grants").update({ deleted_at: new Date().toISOString() }).eq("id", grant.id).select("id"), "team.revoke"));
    requireWritten(must(await access.db.from("project_members").update({ deleted_at: new Date().toISOString() }).eq("id", member.id).select("id"), "team.remove"));
    // Withdrawing an invitation isn't logged on the dashboard either; removing a member is.
    if (member.status !== "invited") {
      await audit(access.db, {
        projectId,
        actorUserId: ctx.principal.id,
        actorName: actorOf(ctx.token),
        targetMemberId: member.id,
        targetName: member.name || member.email,
        action: "removed",
      });
    }
    return { removed: true };
  });
}
