import { portalRoute } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// One page by address, or one record page by list and number.
export const GET = portalRoute(async ({ request, viewer }) => {
  const url = new URL(request.url);
  const current = await viewer();
  if (url.searchParams.has("list")) {
    return portalService.recordPage(current, url.searchParams.get("list") ?? "", Number(url.searchParams.get("number")));
  }
  return portalService.page(current, url.searchParams.get("slug") ?? "");
});
