import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { processService } from "@/lib/workspace/process/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stage rules, automations and review setups; with ?record= the automations, approvals and runs for one record.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  const recordId = new URL(request.url).searchParams.get("record");
  if (recordId) return processService.recordContext(context, { recordId });
  return processService.overview(context);
});

const CONFIGURE = new Set(["process.save", "automation.save", "automation.toggle", "automation.delete", "automation.reorder", "automation.hook",
  "review.save", "review.delete", "email.preview", "code.test"]);

// One change to stage rules, automations or review setups, or running an automation now.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const permission = CONFIGURE.has(body.action) ? WORKSPACE_KEYS.configure : body.action === "automation.run" ? WORKSPACE_KEYS.update : null;
  if (!permission) throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  const context = await workspaceContext(request, eventId, permission);
  switch (body.action) {
    case "process.save": return processService.saveProcess(context, body);
    case "automation.save": return processService.saveAutomation(context, body);
    case "automation.toggle": return processService.toggleAutomation(context, body);
    case "automation.delete": return processService.deleteAutomation(context, body);
    case "automation.reorder": return processService.reorderAutomations(context, body);
    case "automation.run": return processService.runNow(context, body);
    case "automation.hook": return processService.hookAddress(context, body);
    case "review.save": return processService.saveReviewSetup(context, body);
    case "review.delete": return processService.deleteReviewSetup(context, body);
    case "email.preview": return processService.previewEmail(context, body);
    case "code.test": return processService.testCode(context, body);
    default: throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  }
});
