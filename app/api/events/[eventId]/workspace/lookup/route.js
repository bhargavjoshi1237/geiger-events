import { EVENT_TARGETS } from "@/lib/workspace/contracts";
import { WorkspaceError } from "@/lib/workspace/errors";
import { workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { workspaceService } from "@/lib/workspace/server/service";

export const runtime = "nodejs";

// Search for something to link: ?kind=record&objectId=…&q=… or ?kind=contact|order|ticket|team_member|venue_space&q=…
export const GET = workspaceRoute(async (request, { eventId }) => {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  if (kind !== "record" && !EVENT_TARGETS.includes(kind)) throw new WorkspaceError("invalid_input", 400, "Choose what to search for.");
  const context = await workspaceContext(request, eventId);
  return { items: await workspaceService.lookup(context, { kind, objectId: params.get("objectId"), q: params.get("q") ?? "" }) };
});
