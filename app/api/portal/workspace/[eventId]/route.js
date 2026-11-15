import { portalRoute } from "@/lib/workspace/portal/http";
import { portalService } from "@/lib/workspace/portal/service";

export const runtime = "nodejs";

// Who is looking at this event's portal: their roles and the pages they can open.
export const GET = portalRoute(async ({ viewer }) => portalService.session(await viewer()));
