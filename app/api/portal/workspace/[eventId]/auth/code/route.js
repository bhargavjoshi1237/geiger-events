import { portalRoute, readJson } from "@/lib/workspace/portal/http";
import { portalAuth } from "@/lib/workspace/portal/auth";
import { brandColor } from "@/lib/workspace/portal/staff";
import { portalStore } from "@/lib/workspace/portal/store";
import { viewers } from "@/lib/workspace/portal/viewer";

export const runtime = "nodejs";

// Emails a 6-digit sign-in code. The answer is the same whether or not the email is known.
export const POST = portalRoute(async ({ request, params }) => {
  const body = await readJson(request);
  const event = await viewers.eventOf(params.eventId);
  const context = { projectId: event.projectId, eventId: event.id };
  const portal = await portalStore.portal(context);
  if (!portal?.enabled || !portal.publishedVersionId) return { sent: true };
  return portalAuth.requestCode({ context, event, brand: brandColor(event.row) }, body.email);
});
