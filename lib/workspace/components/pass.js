import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Workspace pass codes: ws1.<event id, first 8 hex>.<record id>.<signature>. The signature is an HMAC with a server
// secret, so a QR can't be forged from a record number.
const PREFIX = "ws1";
const shortEvent = (eventId) => String(eventId).replace(/-/g, "").slice(0, 8).toLowerCase();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function passSecret(env = process.env) {
  const secret = env.WORKSPACE_PASS_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.CRON_SECRET;
  if (!secret) throw new Error("No secret is configured for workspace passes.");
  return createHash("sha256").update(`workspace-pass:${secret}`).digest();
}

const signature = (key, eventId, recordId) => createHmac("sha256", key).update(`${PREFIX}|${eventId.toLowerCase()}|${recordId.toLowerCase()}`).digest("base64url").slice(0, 22);

export function signPass(eventId, recordId, key = passSecret()) {
  return `${PREFIX}.${shortEvent(eventId)}.${recordId.toLowerCase()}.${signature(key, eventId, recordId)}`;
}

export const looksLikePass = (text) => String(text ?? "").trim().startsWith(`${PREFIX}.`);

// The record id a pass stands for on this event, or null (wrong event, bad signature, not a pass).
export function verifyPass(text, eventId, key = passSecret()) {
  const parts = String(text ?? "").trim().split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX || parts[1] !== shortEvent(eventId) || !UUID.test(parts[2])) return null;
  const expected = Buffer.from(signature(key, eventId, parts[2]));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return parts[2].toLowerCase();
}
