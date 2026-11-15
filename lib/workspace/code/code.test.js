import { test } from "node:test";
import assert from "node:assert/strict";
import { codeResult, LIMITS, runCode } from "./sandbox.js";

test("sandbox: code reads its input and returns JSON, sync or async", async () => {
  const input = { record: { title: "Learning to rank", abstract: "one two three" }, event: { name: "ICAML" }, trigger: { kind: "manual" }, steps: { s_1: { n: 2 } } };
  const sync = await runCode("const words = record.abstract.split(/\\s+/).length;\nreturn { set: { abstract_words: words }, output: `${event.name}:${steps.s_1.n}` };", input);
  assert.deepEqual(sync.value, { set: { abstract_words: 3 }, output: "ICAML:2" });
  const later = await runCode("await null; return [trigger.kind, Math.max(1, 2)];", input);
  assert.deepEqual(later.value, ["manual", 2]);
  const nothing = await runCode("const x = 1;", {});
  assert.deepEqual([nothing.ok, nothing.value], [true, null]);
});

test("sandbox: no network, timers, modules or host objects", async () => {
  const { value } = await runCode("return [typeof fetch, typeof setTimeout, typeof require, typeof process, typeof XMLHttpRequest, typeof globalThis.__input === 'object'];", {});
  assert.deepEqual(value, ["undefined", "undefined", "undefined", "undefined", "undefined", true]);
  const imported = await runCode("const m = await import('fs'); return 1;", {});
  assert.equal(imported.ok, false);
});

test("sandbox: limits stop runaway code", async () => {
  const loop = await runCode("while (true) {}", {});
  assert.equal(loop.ok, false);
  assert.match(loop.error, /longer than 1 second/);
  assert.ok(loop.ms < 3000, `stopped promptly (${loop.ms} ms)`);
  const asyncLoop = await runCode("await null; for (;;) {}", {});
  assert.match(asyncLoop.error, /longer than 1 second/);
  const memory = await runCode("const a = []; for (;;) a.push('x'.repeat(1024 * 1024));", {});
  assert.equal(memory.ok, false);
  assert.match(memory.error, /more than 32 MB|longer than/);
  const recursion = await runCode("const f = () => f(); f();", {});
  assert.equal(recursion.ok, false);
  const big = await runCode("return 'x'.repeat(300000);", {});
  assert.match(big.error, /larger than 256 KB/);
  const long = await runCode(`// ${"x".repeat(LIMITS.sourceBytes)}`, {});
  assert.match(long.error, /up to 64 KB/);
  const thrown = await runCode("throw new Error('no abstract');", {});
  assert.match(thrown.error, /no abstract/);
  const syntax = await runCode("return {", {});
  assert.equal(syntax.ok, false);
  const after = await runCode("return 40 + 2;", {});
  assert.equal(after.value, 42, "a fresh runtime after failures");
});

test("sandbox: console.log is captured, capped and harmless", async () => {
  const { logs, value } = await runCode("for (let i = 0; i < 80; i += 1) console.log('line', i, { i }); return 'ok';", {});
  assert.equal(value, "ok");
  assert.equal(logs.length, 50);
  assert.equal(logs[1], "line 1 {\"i\":1}");
});

test("sandbox: results are read as set/status/output", () => {
  assert.deepEqual(codeResult({ set: { score: 4 }, status: "accepted" }), { set: { score: 4 }, status: "accepted", output: null });
  assert.deepEqual(codeResult(7), { set: {}, status: null, output: 7 });
  assert.deepEqual(codeResult({ words: 3 }), { set: {}, status: null, output: { words: 3 } });
  assert.throws(() => codeResult({ set: [1] }), /object of field keys/);
  assert.throws(() => codeResult({ status: 3 }), /status key/);
});

test("bridge: the iframe document is locked down and can't be broken out of", async () => {
  const { buildSrcdoc, CUSTOM_CSP } = await import("./bridge.js");
  const doc = buildSrcdoc({ html: "<p>Hi</p>", css: "p{color:red}</style><script>bad()</script>", js: "alert(1)</script><script>evil()", channel: "c-1", context: { event: { name: "</script><b>" } } });
  assert.ok(doc.includes(`content="${CUSTOM_CSP}"`));
  assert.match(CUSTOM_CSP, /connect-src 'none'/);
  assert.match(CUSTOM_CSP, /default-src 'none'/);
  assert.equal((doc.match(/<\/script>/g) ?? []).length, 2, "only the bridge and the organiser script close");
  assert.equal((doc.match(/<\/style>/g) ?? []).length, 2, "organiser CSS can't close its style element");
  assert.ok(!doc.includes("\"</script><b>\""), "context values can't close the script");
});

test("bridge: messages are checked against the channel and kept in range", async () => {
  const { bridgeReply, bridgeRows, readBridgeMessage } = await import("./bridge.js");
  const ok = (type, payload) => ({ geiger: 1, channel: "c", id: 1, type, payload });
  assert.equal(readBridgeMessage({ ...ok("data", {}), channel: "other" }, "c"), null);
  assert.equal(readBridgeMessage(ok("eval", {}), "c"), null);
  assert.equal(readBridgeMessage({ ...ok("data", {}), id: "1" }, "c"), null);
  assert.deepEqual(readBridgeMessage(ok("resize", { height: 99999 }), "c").payload, { height: 2000, auto: false });
  assert.deepEqual(readBridgeMessage(ok("data", { offset: -3, search: "x".repeat(300), extra: 1 }), "c").payload, { offset: 0, search: "x".repeat(100) });
  assert.equal(readBridgeMessage(ok("open", { id: "not-an-id" }), "c"), null);
  assert.equal(readBridgeMessage(ok("navigate", { slug: "../admin" }), "c"), null);
  assert.deepEqual(bridgeReply("c", 4, null, "nope"), { geiger: 1, channel: "c", id: 4, ok: false, error: "nope" });
  const list = { fields: [{ id: "f1", key: "title", type: "short_text" }, { id: "f2", key: "secret", type: "long_text" }, { id: "f3", key: "authors", type: "link_record" }] };
  const [row] = bridgeRows(list, [{ id: "r", number: 1, title: "T", status: null, values: { f1: "T", f2: "x" }, links: { f3: [{ id: "p", label: "Ana", kind: "record" }] },
    access: { fields: { f1: "read", f2: "hidden", f3: "read" } } }]);
  assert.deepEqual(row, { id: "r", number: 1, title: "T", status: null, values: { title: "T" }, links: { authors: [{ id: "p", label: "Ana" }] } });
});
