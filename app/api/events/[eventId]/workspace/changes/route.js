import { workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { workspaceService } from "@/lib/workspace/server/service";

export const runtime = "nodejs";

// The change log (?kind=structure|record&before=<iso>) or, with ?trash=1, what's in the trash.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const params = new URL(request.url).searchParams;
  const context = await workspaceContext(request, eventId);
  if (params.get("trash") === "1") return workspaceService.trash(context);
  return { changes: await workspaceService.listChanges(context, { kind: params.get("kind"), before: params.get("before") ?? undefined }) };
});
