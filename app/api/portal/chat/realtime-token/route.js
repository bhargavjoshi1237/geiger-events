import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";

// Mints a short-lived Supabase-signed JWT for the signed-in portal member so the
// browser can open an RLS-scoped Realtime subscription (members use custom cookie
// auth, not Supabase Auth). The token carries a `member_id` claim that the chat
// RLS policies match (events.chat_channel_member). It is read-only in practice:
// members never write through the browser client — all writes go through the
// service-role portal routes.

const base64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = base64url(crypto.createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export async function POST() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Not configured → the client degrades to a manual-refresh fetch.
    return NextResponse.json({ error: "Realtime not configured." }, { status: 501 });
  }
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      role: "authenticated",
      sub: member.id,
      member_id: member.id,
      iat: now,
      exp: now + 55 * 60, // ~55 min; the client re-fetches before expiry
    },
    secret,
  );

  return NextResponse.json({ token, expiresIn: 55 * 60 });
}
