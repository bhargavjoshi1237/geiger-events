import { clearSession, portalRoute, sessionTokenFromRequest } from "@/lib/workspace/portal/http";
import { portalAuth } from "@/lib/workspace/portal/auth";

export const runtime = "nodejs";

export const POST = portalRoute(async () => {
  await portalAuth.signOut(await sessionTokenFromRequest());
  return clearSession({ ok: true });
});
