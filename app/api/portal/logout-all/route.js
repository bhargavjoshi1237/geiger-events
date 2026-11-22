import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { unregisterMemberDevices } from "@/lib/portal/push";
import { getSessionMember, SESSION_COOKIE } from "@/lib/portal/session";

// Signs out everywhere, so every registered device stops receiving pushes too.
export async function POST() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (sb) {
    await sb.from("portal_sessions").delete().eq("member_id", member.id);
  }
  await unregisterMemberDevices(member.id);
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
