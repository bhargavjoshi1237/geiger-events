import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, sha256, sessionTokenFromRequest } from "@/lib/portal/session";

export async function POST() {
  const raw = await sessionTokenFromRequest();
  if (raw) {
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
