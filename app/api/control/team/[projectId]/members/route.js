import { withControl } from "@/lib/control/http";
import { actorOf, must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, canAdministerRoles, requireAllowed, requireRoleAdmin } from "@/lib/control/team/keys";
import { DEFAULT_SEAT_LIMIT, isOwnerRole, memberView, parseInviteEmails, roleIdOf } from "@/lib/control/team/members";
import { audit, loadRoster } from "@/lib/control/team/roster";
import { ApiError } from "@/lib/staff_access/errors";

const KEYS = [TEAM_KEYS.view, TEAM_KEYS.invite, TEAM_KEYS.assign];

// GET — the roster with each person's role, the roles they can be given, seats, and what this viewer may change.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, KEYS);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see the team.");
    const [roster, admin] = await Promise.all([loadRoster(access.db, projectId), canAdministerRoles(access.db, projectId)]);
    const members = roster.members.map((m) => memberView(m, roleIdOf(m, roster.grantByUser), roster.roleById));
    return {
      members,
      roles: roster.roles.map((r) => ({ id: r.id, name: r.name, isOwner: isOwnerRole(r) })),
      seats: { used: roster.members.filter((m) => m.status !== "suspended").length, limit: DEFAULT_SEAT_LIMIT },
      can: { invite: admin && access.allowed(TEAM_KEYS.invite), assign: admin && access.allowed(TEAM_KEYS.assign) },
      me: ctx.principal.id,
    };
  });
}

// POST { emails, roleId } — invitations land on the roster as "invited", the same rows the dashboard writes.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.invite]);
    requireAllowed(access, TEAM_KEYS.invite, "Your role can't invite people.");
    await requireRoleAdmin(access.db, projectId);
    const roster = await loadRoster(access.db, projectId);
    if (!roster.roleById.has(body.roleId)) throw new ApiError("invalid_input", 400, "Choose a role for them.");
    const emails = parseInviteEmails(body.emails, {
      seatsUsed: roster.members.filter((m) => m.status !== "suspended").length,
      existing: roster.members.map((m) => m.email),
    });
    const actor = actorOf(ctx.token);
    const now = new Date().toISOString();
    const created = must(
      await access.db
        .from("project_members")
        .insert(emails.map((email) => ({ project_id: projectId, role_id: body.roleId, status: "invited", email, invited_by: ctx.principal.id, invited_at: now })))
        .select("*"),
      "team.invite",
    );
    await Promise.all(
      created.map((m) =>
        audit(access.db, { projectId, actorUserId: ctx.principal.id, actorName: actor, targetMemberId: m.id, targetName: m.email, action: "invited", detail: { email: m.email } }),
      ),
    );
    return { invited: created.map((m) => memberView(m, m.role_id, roster.roleById)) };
  });
}
