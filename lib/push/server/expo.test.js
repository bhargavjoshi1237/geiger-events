import test from "node:test";
import assert from "node:assert/strict";

import { getReceipts, isExpoPushToken, sendMessages } from "./expo.js";

const json = (status, body) => async () => ({ status, json: async () => body });

test("isExpoPushToken accepts both Expo token prefixes only", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc-123]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[xyz]"), true);
  assert.equal(isExpoPushToken("fcm:abc"), false);
  assert.equal(isExpoPushToken(null), false);
});

test("sendMessages maps tickets in order and flags DeviceNotRegistered", async () => {
  const msgs = [{ to: "a" }, { to: "b" }];
  const res = await sendMessages(msgs, {
    accessToken: "",
    fetchImpl: json(200, { data: [{ status: "ok", id: "t1" }, { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }] }),
  });
  assert.deepEqual(res[0], { ok: true, ticketId: "t1" });
  assert.equal(res[1].ok, false);
  assert.equal(res[1].error, "DeviceNotRegistered");
  assert.equal(res[1].transient, false);
});

test("sendMessages marks whole-batch 429/5xx and network failures as transient", async () => {
  const rate = await sendMessages([{ to: "a" }], { accessToken: "", fetchImpl: json(429, { errors: [{ code: "TOO_MANY_REQUESTS", message: "slow down" }] }) });
  assert.deepEqual(rate[0], { ok: false, error: "TOO_MANY_REQUESTS", message: "slow down", transient: true });
  const down = await sendMessages([{ to: "a" }], { accessToken: "", fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  assert.equal(down[0].transient, true);
  const auth = await sendMessages([{ to: "a" }], { accessToken: "", fetchImpl: json(401, { errors: [{ code: "UNAUTHORIZED", message: "token" }] }) });
  assert.equal(auth[0].transient, true);
  const bad = await sendMessages([{ to: "a" }], { accessToken: "", fetchImpl: json(400, { errors: [{ code: "VALIDATION_ERROR", message: "bad" }] }) });
  assert.equal(bad[0].transient, false);
});

test("sendMessages batches by 100 and sends the access token", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(init);
    const batch = JSON.parse(init.body);
    return { status: 200, json: async () => ({ data: batch.map((_, i) => ({ status: "ok", id: `t${i}` })) }) };
  };
  const res = await sendMessages(Array.from({ length: 150 }, (_, i) => ({ to: `x${i}` })), { fetchImpl, accessToken: "secret" });
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].body).length, 100);
  assert.equal(calls[0].headers.Authorization, "Bearer secret");
  assert.equal(res.length, 150);
});

test("getReceipts normalises ok and error receipts", async () => {
  const out = await getReceipts(["r1", "r2"], {
    accessToken: "",
    fetchImpl: json(200, { data: { r1: { status: "ok" }, r2: { status: "error", message: "bye", details: { error: "DeviceNotRegistered" } } } }),
  });
  assert.deepEqual(out.r1, { status: "ok" });
  assert.deepEqual(out.r2, { status: "error", error: "DeviceNotRegistered", message: "bye" });
});
