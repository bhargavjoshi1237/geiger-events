import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { unregisterDevice } from "@/lib/portal/push";
import { SESSION_COOKIE, getSessionMember, sha256, sessionTokenFromRequest } from "@/lib/portal/session";

// Body { pushToken? }: the signing-out device stops receiving this member's pushes.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const raw = await sessionTokenFromRequest();
  if (raw) {
    const member = body?.pushToken ? await getSessionMember() : null;
    if (member) await unregisterDevice(body.pushToken, member.id);
    const sb = adminClient();
    if (sb) await sb.from("portal_sessions").delete().eq("token_hash", sha256(raw));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
