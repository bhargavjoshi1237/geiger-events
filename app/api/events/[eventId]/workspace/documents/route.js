import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { documentService } from "@/lib/workspace/documents/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// Email and PDF templates; with ?certificates=1 the issued certificates (&record=, &status=valid|revoked).
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  const query = new URL(request.url).searchParams;
  if (query.get("certificates")) return documentService.certificates(context, { recordId: query.get("record"), status: query.get("status") });
  return documentService.list(context);
});

// Saving or deleting a template, previewing an email template, revoking a certificate.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  switch (body.action) {
    case "document.save": return documentService.save(context, body);
    case "document.delete": return documentService.remove(context, body);
    case "email.preview": return documentService.emailPreview(context, body);
    case "certificate.revoke": return documentService.revoke(context, body);
    default: throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  }
});
