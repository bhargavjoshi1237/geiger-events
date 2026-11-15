import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { portalStaff } from "@/lib/workspace/portal/staff";

export const runtime = "nodejs";

// The portal draft (settings, roles, pages), its versions, what changed since publishing and any warnings.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view, { also: [WORKSPACE_KEYS.configure] });
  return { ...(await portalStaff.state(context)), can: { configure: context.allowed[WORKSPACE_KEYS.configure] } };
});

// One builder action: portal settings, roles, pages, publish or restore a version.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  return portalStaff.command(context, body);
});
