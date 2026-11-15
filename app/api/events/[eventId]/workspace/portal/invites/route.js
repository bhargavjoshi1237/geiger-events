import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { publicBaseUrl } from "@/lib/workspace/portal/http";
import { portalStaff } from "@/lib/workspace/portal/staff";

export const runtime = "nodejs";
export const maxDuration = 60;

// Everyone in the people list with their invite state and last sign-in.
export const GET = workspaceRoute(async (request, { eventId }) => portalStaff.people(await workspaceContext(request, eventId, WORKSPACE_KEYS.configure)));

// Sends invites (to chosen people or everyone with a role) or revokes one.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  if (body.action === "revoke") return portalStaff.revokeInvite(context, { inviteId: body.inviteId });
  if (body.action !== "send") throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  return portalStaff.invite(context, { recordIds: body.recordIds, roleId: body.roleId ?? null, staffId: context.principal.id, baseUrl: publicBaseUrl(request) });
});
