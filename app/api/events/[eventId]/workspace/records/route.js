import { readJson } from "@/lib/workspace/server/http";
import { workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { workspaceService } from "@/lib/workspace/server/service";

export const runtime = "nodejs";

// A page of records for one list: { objectId, spec: { filter, sort, search, limit, offset, deleted } }.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId);
  return workspaceService.queryRecords(context, body);
});
