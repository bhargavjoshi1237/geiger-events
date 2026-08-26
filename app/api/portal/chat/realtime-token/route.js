import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";

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
    },
    secret,
  );

  return NextResponse.json({ token, expiresIn: 55 * 60 });
}
