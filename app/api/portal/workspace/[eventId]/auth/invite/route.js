import { ApiError } from "@/lib/staff_access/errors";
import { portalRoute, readJson, withSession } from "@/lib/workspace/portal/http";
import { portalAuth } from "@/lib/workspace/portal/auth";

export const runtime = "nodejs";

// Accepts a personal invite link. POST only, so email link scanners can't use it up.
export const POST = portalRoute(async ({ request, params }) => {
  const body = await readJson(request);
  const accepted = await portalAuth.acceptInvite(body.token);
  if (!accepted || accepted.eventId !== String(params.eventId).toLowerCase()) {
    throw new ApiError("invalid_invite", 400, "This invite link has already been used or has expired.");
  }
  return withSession({ ok: true }, accepted.session);
});
