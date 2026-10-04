import test from "node:test";
import assert from "node:assert/strict";
import { handleOperationsRequest, readOperationsJson } from "./commands.js";
import { OperationsError } from "../errors.js";

test("bounded JSON reader checks type, object shape and byte count", async () => {
  await assert.rejects(readOperationsJson(new Request("https://x", { method: "POST", body: "{}" })),
    { status: 415 });
  await assert.rejects(readOperationsJson(new Request("https://x", { method: "POST",
    headers: { "content-type": "application/json" }, body: "[]" })), { status: 400 });
  await assert.rejects(readOperationsJson(new Request("https://x", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(263000) }) })),
  { status: 413 });
});

test("response boundary hides SQL details, maps revisions and disables cache", async () => {
  const forbidden = await handleOperationsRequest(async () => { throw new OperationsError("forbidden", 403, "Denied"); });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("cache-control"), "private, no-store");
  const stale = await handleOperationsRequest(async () => { throw { code: "40001", message: "private SQL" }; });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "revision_conflict");
  const unexpected = await handleOperationsRequest(async () => { throw new Error("private SQL"); }, { log: () => {} });
  assert.equal(unexpected.status, 500);
  assert.equal(JSON.stringify(await unexpected.json()).includes("private SQL"), false);
});

test("workflow conflicts and concurrent grant revocation return actionable private errors", async () => {
  for (const [sqlstate, status, code] of [["P7002", 409, "schedule_conflict"], ["42501", 403, "forbidden"]]) {
    const result = await handleOperationsRequest(async () => { throw { code: sqlstate, message: "private SQL identities" }; }, { log: () => {} });
    assert.equal(result.status, status);
    const payload = await result.json();
    assert.equal(payload.error.code, code);
    assert.equal(JSON.stringify(payload).includes("private SQL"), false);
  }
});
