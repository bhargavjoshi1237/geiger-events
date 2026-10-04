import test from "node:test";
import assert from "node:assert/strict";
import { processOperationsNotices, buildOperationsEmail, authorizeWorker } from "./worker.js";

test("provider acceptance is recorded with the original lease and is never called delivered", async () => {
  const changes = [];
  const store = {
    async claimNotices(limit, lease) { assert.equal(limit, 1); if (!changes.length) assert.equal(lease, "lease-1"); return changes.length ? [] : [{ id: "notice-1", kind: "placement" }]; },
    async finishNotice(...input) { changes.push(input); },
  };
  const result = await processOperationsNotices({ store, send: async () => ({ ok: true, providerId: "provider-7" }), limit: 10, leaseId: "lease-1" });
  assert.deepEqual(changes, [["notice-1", "lease-1", "accepted", "provider-7", null]]);
  assert.deepEqual(result, { processed: 1, accepted: 1, failed: 0, uncertain: 0 });
});

test("ambiguous provider outcomes are uncertain, rejected sends fail, and no notice is retried in a loop", async () => {
  const states = [];
  let sends = 0;
  const pending = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const store = { async claimNotices() { return pending.splice(0,1); },
    async finishNotice(id, lease, status) { states.push([id, status]); } };
  const result = await processOperationsNotices({ store, send: async ({ id }) => {
    sends += 1;
    if (id === "a") throw new Error("socket closed");
    if (id === "b") return { ok: false, error: "not_configured" };
    return { ok: false, uncertain: true, error: "request_failed" };
  } });
  assert.equal(sends, 3);
  assert.deepEqual(states, [["a", "uncertain"], ["b", "failed"], ["c", "uncertain"]]);
  assert.equal(result.uncertain, 2);
});

test("outbox worker requires a configured exact secret and validates a bounded batch", async () => {
  assert.equal(authorizeWorker("Bearer secret", "secret"), true);
  assert.equal(authorizeWorker("Bearer secret-extra", "secret"), false);
  assert.equal(authorizeWorker("", undefined), false);
  assert.equal(authorizeWorker("Bearer undefined", undefined), false);
  await assert.rejects(processOperationsNotices({ limit: 101 }), { code: "invalid_input" });
});

test("placement email links use trusted deployment origin and distinguish the release version", () => {
  const email = buildOperationsEmail({ id: "n1", kind: "placement", eventId: "e1", email: "presenter@example.com",
    payload: { version: 4, title: "Research talk", room: "Hall A" } }, { origin: "https://events.example.com/events" });
  assert.equal(email.to, "presenter@example.com");
  assert.equal(email.data.operationsUrl, "https://events.example.com/events/operations/e1");
  assert.equal(email.data.version, 4);
  assert.equal(email.idempotencyKey, "geiger-operations-n1");
  assert.throws(() => buildOperationsEmail({ kind: "custom-script", email: "x@y.com" }, { origin: "https://example.com" }), { code: "invalid_input" });
});

test("slow batch sends claim a fresh lease immediately before each send", async () => {
  let clock = 0; let claims = 0;
  const expires = new Map(); const leases = new Set();
  const store = {
    async claimNotices(limit, lease) {
      assert.equal(limit, 1, "never age queued notices in a claimed batch");
      if(claims === 25) return [];
      const notice = {id: String(++claims)};
      expires.set(notice.id,clock+300_000); leases.add(lease); return [notice];
    },
    async finishNotice(id, lease, status) {
      assert.ok(clock < expires.get(id), "finish before the five-minute lease expires");
      assert.equal(status,"accepted");
    },
  };
  const result = await processOperationsNotices({store,limit:25,send:async notice=>{
    assert.ok(clock < expires.get(notice.id)); clock+=15_000; return {ok:true};
  }});
  assert.equal(result.accepted,25); assert.equal(clock,375_000); assert.equal(leases.size,25);
});
