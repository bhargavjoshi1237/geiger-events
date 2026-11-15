import { portalRoute, readJson } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// Autosaves a half-finished form for the signed-in person.
export const PUT = portalRoute(async ({ request, viewer }) => {
  const body = await readJson(request);
  return portalService.saveDraft(await viewer(), { pageId: body.pageId, blockId: body.blockId, data: body.data });
});

export const DELETE = portalRoute(async ({ request, viewer }) => {
  const url = new URL(request.url);
  return portalService.clearDraft(await viewer(), { pageId: url.searchParams.get("pageId"), blockId: url.searchParams.get("blockId") });
});
