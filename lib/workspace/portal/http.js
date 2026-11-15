import { ApiError } from "../../staff_access/errors.js";
import { errorResponse, readJson } from "../server/http.js";
import { getSessionMember, SESSION_COOKIE, sessionCookieOptions, sessionTokenFromRequest } from "../../portal/session.js";
import { viewers } from "./viewer.js";

const headers = { "Cache-Control": "private, no-store" };

// Requests that change something must come from this site (cookies are SameSite=Lax, this is the second check).
function checkOrigin(request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(request.url).origin]);
  for (const value of [process.env.GEIGER_EVENTS_PUBLIC_URL, process.env.GEIGER_OPERATIONS_PUBLIC_URL]) {
    try { if (value) allowed.add(new URL(value).origin); } catch { /* ignore a malformed setting */ }
  }
  if (!allowed.has(origin)) throw new ApiError("forbidden", 403, "That request came from another site.");
}

function portalError(error) {
  if (error?.code === "42501") {
    return Response.json({ error: { code: "forbidden", message: "You can't change this record." } }, { status: 403, headers });
  }
  return errorResponse(error);
}

// Wraps a portal API handler: origin check, the signed-in portal member (if any), and plain JSON errors.
export function portalRoute(handler) {
  return async (request, ctx) => {
    try {
      checkOrigin(request);
      const params = (await ctx?.params) ?? {};
      const member = await getSessionMember();
      const result = await handler({ request, params, member, viewer: () => viewers.portal(params.eventId, member) });
      if (result instanceof Response) return result;
      return Response.json(result, { headers });
    } catch (error) {
      return portalError(error);
    }
  };
}

export { readJson };

export function withSession(body, session) {
  const response = Response.json(body, { headers });
  const options = sessionCookieOptions(session.maxAge);
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${session.token}; Path=${options.path}; Max-Age=${options.maxAge}; HttpOnly; Secure; SameSite=Lax`);
  return response;
}

export function clearSession(body) {
  const response = Response.json(body, { headers });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return response;
}

export { sessionTokenFromRequest };

// The public address of this app (for links in emails).
export function publicBaseUrl(request) {
  for (const value of [process.env.GEIGER_EVENTS_PUBLIC_URL, process.env.GEIGER_OPERATIONS_PUBLIC_URL]) {
    try {
      if (value) {
        const url = new URL(value);
        if (["http:", "https:"].includes(url.protocol)) return url.href.replace(/\/$/, "");
      }
    } catch { /* fall through */ }
  }
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${new URL(request.url).origin}${/^\/(?!\/)[^?#]*$/.test(basePath) ? basePath.replace(/\/$/, "") : ""}`;
}
