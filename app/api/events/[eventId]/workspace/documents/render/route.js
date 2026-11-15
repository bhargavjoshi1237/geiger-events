import { readJson, errorResponse } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext } from "@/lib/workspace/server/route";
import { documentService } from "@/lib/workspace/documents/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// The real PDF for a record (or sample values): a saved document needs view, the editor's unsaved copy needs configure.
export async function POST(request, { params }) {
  try {
    const { eventId } = await params;
    const body = await readJson(request);
    const unsaved = body.document && typeof body.document === "object";
    const context = await workspaceContext(request, eventId, unsaved ? WORKSPACE_KEYS.configure : WORKSPACE_KEYS.view);
    const { bytes, warnings, name } = await documentService.preview(context, body);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Document-Warnings": encodeURIComponent(JSON.stringify(warnings.slice(0, 20))),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
