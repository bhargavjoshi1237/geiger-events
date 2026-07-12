import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember, SESSION_COOKIE } from "@/lib/portal/session";

// POST -> revokes every session for the signed-in member (all devices) and clears
// this device's cookie.
export async function POST() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (sb) {
    await sb.from("portal_sessions").delete().eq("member_id", member.id);
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
