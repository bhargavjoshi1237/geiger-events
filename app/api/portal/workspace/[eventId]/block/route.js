import { portalRoute, readJson } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// Data for one block on a page (rows, stats, chart groups, a form's state), as this viewer may see it.
export const POST = portalRoute(async ({ request, viewer }) => {
  const body = await readJson(request);
  return portalService.blockData(await viewer(), { pageId: body.pageId, blockId: body.blockId, params: body.params ?? {}, recordId: body.recordId ?? null });
});
