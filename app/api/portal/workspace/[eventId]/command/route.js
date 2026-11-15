import { portalRoute, readJson } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";

// One change by a portal person (edit, submit a form, delete, comment), checked against their role rules.
export const POST = portalRoute(async ({ request, viewer }) => {
  const current = await viewer();
  const result = await portalService.command(current, await readJson(request));
  processAfter(current.context);
  return result;
});
