import test from "node:test";
import assert from "node:assert/strict";
import { buildAppCatalog, validateCallbackUrl } from "./app_catalog.js";

const url = "https://geiger.studio/events/api/mcp";
const app = (id) => buildAppCatalog(url).find((item) => item.id === id);

test("the Cursor link carries the server as base64 JSON", () => {
  const link = new URL(app("cursor").href);
  assert.equal(link.protocol, "cursor:");
  assert.equal(link.searchParams.get("name"), "geiger-events");
  assert.deepEqual(JSON.parse(atob(link.searchParams.get("config"))), { url });
});

test("the VS Code link carries the server as encoded JSON", () => {
  const { href } = app("vscode");
  assert.ok(href.startsWith("vscode:mcp/install?"));
  assert.deepEqual(JSON.parse(decodeURIComponent(href.split("?")[1])), { name: "geiger-events", type: "http", url });
});

test("terminal commands use the server address", () => {
  assert.equal(app("claude-code").command, `claude mcp add --transport http geiger-events ${url}`);
  assert.equal(app("codex").command, `codex mcp add geiger-events --url ${url}\ncodex mcp login geiger-events`);
});

test("every app has exactly one way to connect", () => {
  for (const item of buildAppCatalog(url)) {
    assert.ok(item.actionLabel, item.id);
    if (item.kind === "command") assert.ok(item.command, item.id);
    else assert.ok(item.href, item.id);
  }
});

test("a custom callback is optional", () => {
  assert.deepEqual(validateCallbackUrl("  "), { ok: true, value: null });
});

test("accepts https and loopback callbacks", () => {
  assert.equal(validateCallbackUrl("https://agent.acme.com/cb").ok, true);
  assert.equal(validateCallbackUrl("http://localhost:8123/cb").ok, true);
  assert.equal(validateCallbackUrl("http://127.0.0.1:8123/cb").ok, true);
});

test("refuses unsafe callbacks", () => {
  for (const bad of [
    "http://agent.acme.com/cb",
    "http://localhost.evil.io/cb",
    "javascript:alert(1)",
    "not a url",
    "https://user:pass@agent.acme.com/cb",
    "https://agent.acme.com/cb#frag",
    `https://a.com/${"x".repeat(500)}`,
  ]) {
    assert.equal(validateCallbackUrl(bad).ok, false, bad);
  }
});
