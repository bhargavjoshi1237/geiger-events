import { portalRoute, readJson } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// A signed upload slot for a file field the viewer may fill.
export const POST = portalRoute(async ({ request, viewer }) => portalService.signUpload(await viewer(), await readJson(request)));

// A short-lived link to a file the viewer may see (inline=1 opens it in the browser).
export const GET = portalRoute(async ({ request, viewer }) => {
  const url = new URL(request.url);
  return portalService.signFile(await viewer(), {
    recordId: url.searchParams.get("recordId"), fieldId: url.searchParams.get("fieldId"), fileId: url.searchParams.get("fileId"),
    inline: url.searchParams.get("inline") === "1",
  });
});
