import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE,
  hashPassword,
  randomToken,
  sha256,
  sessionCookieOptions,
} from "@/lib/portal/session";

const SESSION_DAYS = 30;

// { token, password } -> sets password, creates a session, sets cookie.
export async function POST(request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || !password || String(password).length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: setup } = await sb
    .from("portal_password_setups")
    .select("id, member_id, expires_at, used_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (
    !setup ||
    setup.used_at ||
    new Date(setup.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "This link is invalid or expired." },
      { status: 400 },
    );
  }

  await sb
    .from("portal_members")
    .update({
      password_hash: hashPassword(password),
      password_set_at: new Date().toISOString(),
    })
    .eq("id", setup.member_id);
  await sb
    .from("portal_password_setups")
    .update({ used_at: new Date().toISOString() })
    .eq("id", setup.id);

  const { token: sessionToken, tokenHash } = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await sb
    .from("portal_sessions")
    .insert({ member_id: setup.member_id, token_hash: tokenHash, expires_at: expires });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    sessionToken,
    sessionCookieOptions(SESSION_DAYS * 86400),
  );
  return res;
}
