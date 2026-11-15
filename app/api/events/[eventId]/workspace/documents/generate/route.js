import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { documentService } from "@/lib/workspace/documents/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generates a PDF for up to 50 records into a file field (issuing certificates when the document is one).
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.update);
  const result = await documentService.generate(context, body);
  processAfter(context);
  return result;
});
