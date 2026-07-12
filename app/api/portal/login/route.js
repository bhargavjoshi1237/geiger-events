import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE,
  verifyPassword,
  randomToken,
  sessionCookieOptions,
} from "@/lib/portal/session";

const SESSION_DAYS = 30;

// { email, password } -> verifies, creates a session, sets cookie.
export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: member } = await sb
    .from("portal_members")
    .select("id, password_hash")
    .eq("email", clean)
    .maybeSingle();
  if (
    !member ||
    !member.password_hash ||
    !verifyPassword(password, member.password_hash)
  ) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const { token, tokenHash } = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await sb
    .from("portal_sessions")
    .insert({ member_id: member.id, token_hash: tokenHash, expires_at: expires });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 86400));
  return res;
}
