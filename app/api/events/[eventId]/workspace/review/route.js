import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { processService } from "@/lib/workspace/process/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// A review setup's results: each submission with its reviews, score and flags.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  return processService.reviewResults(context, { setupId: new URL(request.url).searchParams.get("setup") });
});

// Preview an assignment, apply it (creates the reviews), or record a decision on a submission.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  switch (body.action) {
    case "plan":
      return processService.planReview(await workspaceContext(request, eventId, WORKSPACE_KEYS.configure), body);
    case "apply": {
      const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.create);
      const result = await processService.applyReview(context, body);
      processAfter(context);
      return result;
    }
    case "decide": {
      const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.update, { also: [WORKSPACE_KEYS.configure] });
      const result = await processService.decideSubmission(context, body);
      processAfter(context);
      return result;
    }
    default:
      throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  }
});
