import { portalRoute, readJson, withSession } from "@/lib/workspace/portal/http";
import { portalAuth } from "@/lib/workspace/portal/auth";
import { viewers } from "@/lib/workspace/portal/viewer";

export const runtime = "nodejs";

// Checks a sign-in code and starts the shared portal session.
export const POST = portalRoute(async ({ request, params }) => {
  const body = await readJson(request);
  const event = await viewers.eventOf(params.eventId);
  const { session } = await portalAuth.verifyCode({ context: { projectId: event.projectId, eventId: event.id } }, body.email, body.code);
  return withSession({ ok: true }, session);
});
