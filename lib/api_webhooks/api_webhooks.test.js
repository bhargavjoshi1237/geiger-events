import test from "node:test";
import assert from "node:assert/strict";

import { MAX_ATTEMPTS, normalizeEventTypes, normalizeScopes, retryDelaySeconds, webhookEnvelope } from "./catalog.js";
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  looksLikeApiKey,
  signatureHeader,
  verifyWebhookSignature,
} from "./crypto.js";
import { checkWebhookUrl } from "./url.js";

test("api keys carry a display prefix and verify by hash", () => {
  const key = generateApiKey();
  assert.match(key.secret, /^gev_live_[0-9A-Za-z]{40}$/);
  assert.equal(key.prefix, key.secret.slice(0, 15));
  assert.equal(key.hash, hashApiKey(key.secret));
  assert.ok(looksLikeApiKey(key.secret));
  assert.notEqual(generateApiKey().secret, key.secret);
  assert.match(generateWebhookSecret(), /^whsec_[0-9A-Za-z]{40}$/);
});

test("signatures verify, and reject tampering and stale timestamps", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "1", type: "order.created" });
  const now = Date.UTC(2026, 10, 8, 12);
  const t = Math.floor(now / 1000);
  const header = signatureHeader(secret, t, body);
  assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
  assert.ok(verifyWebhookSignature(header, secret, body, { now }));
  assert.equal(verifyWebhookSignature(header, secret, `${body} `, { now }), false);
  assert.equal(verifyWebhookSignature(header, "whsec_other", body, { now }), false);
  assert.equal(verifyWebhookSignature(header, secret, body, { now: now + 10 * 60 * 1000 }), false);
});

test("retry schedule backs off then gives up", () => {
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(2), 300);
  assert.equal(retryDelaySeconds(MAX_ATTEMPTS - 1), 43200);
  assert.equal(retryDelaySeconds(MAX_ATTEMPTS), null);
  assert.equal(retryDelaySeconds(0), null);
});

test("webhook URLs must be public https", () => {
  assert.equal(checkWebhookUrl("https://hooks.example.com/geiger").ok, true);
  assert.equal(checkWebhookUrl("http://hooks.example.com").ok, false);
  assert.equal(checkWebhookUrl("https://localhost:3000/x").ok, false);
  assert.equal(checkWebhookUrl("https://10.0.0.5/x").ok, false);
  assert.equal(checkWebhookUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(checkWebhookUrl("https://[::1]/x").ok, false);
  assert.equal(checkWebhookUrl("https://user:pw@example.com").ok, false);
  assert.equal(checkWebhookUrl("not a url").ok, false);
});

test("event types and scopes are normalised to the catalog", () => {
  assert.deepEqual(normalizeEventTypes(["order.paid", "nope", "order.created"]), ["order.created", "order.paid"]);
  assert.deepEqual(normalizeEventTypes(["order.paid", "*"]), ["*"]);
  assert.deepEqual(normalizeScopes(["write:checkins", "read:events", "admin"]), ["read:events", "write:checkins"]);
  const env = webhookEnvelope({ id: "e", type: "t", occurredAt: "2026-11-08T12:00:00Z", projectId: "p", data: { a: 1 } });
  assert.deepEqual(env, { id: "e", type: "t", created: 1794139200, project_id: "p", data: { a: 1 } });
});
