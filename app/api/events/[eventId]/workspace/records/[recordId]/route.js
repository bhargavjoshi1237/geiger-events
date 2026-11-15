import { requireUuid, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { workspaceService } from "@/lib/workspace/server/service";

export const runtime = "nodejs";

// One record with resolved links, what links to it, its history and comments.
export const GET = workspaceRoute(async (request, { eventId, recordId }) => {
  const context = await workspaceContext(request, eventId);
  return workspaceService.getRecord(context, requireUuid(recordId, "That record link isn't valid."));
});
