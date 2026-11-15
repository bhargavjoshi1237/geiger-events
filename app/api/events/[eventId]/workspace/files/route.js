import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { workspaceService } from "@/lib/workspace/server/service";

export const runtime = "nodejs";

// Starts an upload: { fieldId, name, size, type } → a signed URL the browser uploads to directly.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.update);
  return workspaceService.signUpload(context, body);
});

// A short-lived download link: ?id=<fileId>.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId);
  return workspaceService.signDownload(context, new URL(request.url).searchParams.get("id"));
});
