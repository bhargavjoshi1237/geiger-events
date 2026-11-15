import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { processService } from "@/lib/workspace/process/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// The run log, newest first: ?automation=&record=&status=&before=.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  const query = new URL(request.url).searchParams;
  return processService.runs(context, {
    automationId: query.get("automation"), recordId: query.get("record"), status: query.get("status"), before: query.get("before"),
  });
});

// Retries a failed or skipped run.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  if (body.action !== "retry") throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  return processService.retryRun(context, body);
});
