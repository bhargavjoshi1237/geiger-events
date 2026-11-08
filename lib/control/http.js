import { NextResponse } from "next/server";

import { OperationsError } from "../operations/errors.js";
import { requireId } from "./ids.js";
import { resolveStaffPrincipal } from "../operations/server/staff_identity.js";

export { requireId };

const NO_STORE = { "Cache-Control": "no-store" };

// Control is a native-app API: the team session arrives as a Bearer token, never as the suite cookie.
export function controlToken(request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  return match ? match[1] : null;
}

export async function withControl(request, handler, { resolve = resolveStaffPrincipal } = {}) {
  try {
    const token = controlToken(request);
    if (!token) throw new OperationsError("unauthenticated", 401, "Sign in to Control to continue.");
    const principal = await resolve(request);
    return NextResponse.json(await handler({ principal, token }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof OperationsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
    }
    console.error("[control]", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
}
