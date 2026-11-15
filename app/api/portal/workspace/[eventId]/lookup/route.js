import { portalRoute } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// Records the viewer may pick for a link field.
export const GET = portalRoute(async ({ request, viewer }) => {
  const url = new URL(request.url);
  return portalService.lookup(await viewer(), { fieldId: url.searchParams.get("fieldId"), q: url.searchParams.get("q") ?? "" });
});
