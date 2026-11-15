import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { processService } from "@/lib/workspace/process/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// Approvals (?status=&record=), or just how many wait on the signed-in person (?count=1).
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  const query = new URL(request.url).searchParams;
  if (query.get("count")) return processService.pendingApprovals(context);
  return processService.approvals(context, { status: query.get("status"), recordId: query.get("record") });
});

// An approver's decision (the database checks they're an approver), or cancelling a pending approval.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  if (body.action === "decide") {
    const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
    const result = await processService.decide(context, body);
    processAfter(context);
    return result;
  }
  if (body.action === "cancel") return processService.cancelApproval(await workspaceContext(request, eventId, WORKSPACE_KEYS.configure), body);
  throw new WorkspaceError("invalid_input", 400, "Unknown action.");
});
