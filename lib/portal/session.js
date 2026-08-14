import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

// Server-only session + password helpers for the members portal. Passwords are
// scrypt-hashed; sessions are opaque tokens whose sha256 is stored server-side.

export const SESSION_COOKIE = "geP_session";
const SCRYPT_KEYLEN = 64;

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// scrypt with a random 16-byte salt, encoded as scrypt$<saltHex>$<hashHex>.
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain, encoded) {
  if (typeof encoded !== "string") return false;
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    String(plain),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

// Opaque token for cookies/links; store only its sha256.
export function randomToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

export function sessionCookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// The raw session token for this request: an Authorization: Bearer header (the
// mobile app, which has no cookie jar) takes precedence over the browser cookie.
export async function sessionTokenFromRequest() {
  const h = await headers();
  const auth = h.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}

// True when the caller is the mobile app, which needs the session token in the
// JSON body because it cannot read the httpOnly cookie.
export async function wantsTokenInBody() {
  const h = await headers();
  return (h.get("x-geiger-client") || "").toLowerCase() === "mobile";
}

// Resolve the current member from the request's bearer token or session cookie.
// Returns null if there is none, it is invalid or expired, or admin is unavailable.
export async function getSessionMember() {
  const raw = await sessionTokenFromRequest();
  if (!raw) return null;
  const sb = adminClient();
  if (!sb) return null;
  const { data: session, error } = await sb
    .from("portal_sessions")
    .select("member_id, expires_at")
    .eq("token_hash", sha256(raw))
    .maybeSingle();
  if (error || !session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const { data: member } = await sb
    .from("portal_members")
    .select("id, email, name, metadata")
    .eq("id", session.member_id)
    .maybeSingle();
  return member
    ? {
        id: member.id,
        email: member.email,
        name: member.name,
        metadata:
          member.metadata && typeof member.metadata === "object"
            ? member.metadata
            : {},
      }
    : null;
}
