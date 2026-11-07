import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { API_KEY_PREFIX } from "./catalog.js";

// Server-only secrets: API keys (stored as a sha256 hash), webhook signing secrets and the signature scheme.

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Unbiased base62 via rejection sampling (bytes >= 248 are dropped so every character is equally likely).
function randomBase62(length) {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function hashApiKey(secret) {
  return createHash("sha256").update(String(secret)).digest("hex");
}

// { secret, prefix, hash }: the secret is shown to the creator once; only the prefix and hash are stored.
export function generateApiKey() {
  const secret = `${API_KEY_PREFIX}${randomBase62(40)}`;
  return { secret, prefix: secret.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(secret) };
}

export function looksLikeApiKey(value) {
  return typeof value === "string" && value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 20;
}

export function generateWebhookSecret() {
  return `whsec_${randomBase62(40)}`;
}

export function signWebhook(secret, timestamp, body) {
  return createHmac("sha256", String(secret)).update(`${timestamp}.${body}`).digest("hex");
}

// The Geiger-Signature header value: t=<unix seconds>,v1=<hex hmac-sha256(secret, "t.body")>.
export function signatureHeader(secret, timestamp, body) {
  return `t=${timestamp},v1=${signWebhook(secret, timestamp, body)}`;
}

// What a receiver does (mirrored in the docs): check the HMAC and that the timestamp is recent.
export function verifyWebhookSignature(header, secret, body, { toleranceSeconds = 300, now = Date.now() } = {}) {
  const parts = Object.fromEntries(
    String(header || "")
      .split(",")
      .map((part) => part.split("="))
      .filter((kv) => kv.length === 2),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, timestamp, body), "hex");
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Constant-time string compare for bearer secrets.
export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  return left.length === right.length && timingSafeEqual(left, right);
}
