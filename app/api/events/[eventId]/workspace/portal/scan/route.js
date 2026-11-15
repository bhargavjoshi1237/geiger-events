import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { portalStaff } from "@/lib/workspace/portal/staff";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";

// Attendance from a scanner block on a team page, as the signed-in staff member.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.create);
  const result = await portalStaff.scan(context, body);
  processAfter(context);
  return result;
});
