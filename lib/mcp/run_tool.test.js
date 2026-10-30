import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { OperationsError } from "../operations/errors.js";
import { runTool } from "./run_tool.js";
import { buildMcpHandler } from "./server.js";
import { eventRow, TOOLS } from "./tools.js";
import { verifyMcpToken } from "./auth.js";

const projectA = "11111111-1111-4111-8111-111111111111";
const projectB = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const authInfo = { token: "t", clientId: "client-1", scopes: [], extra: { userId: "user-1" } };

function makeDeps(overrides = {}) {
  const audit = [];
  return {
    audit,
    isRateLimited: async () => false,
    loadConnection: async () => ({ id: "conn-1", projectIds: [projectA], access: "write" }),
    userClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { project_id: projectA } }) }) }) }) }),
    writeAudit: async (entry) => { audit.push(entry); },
    ensureMembership: async () => {},
    authorizeProject: async (_principal, projectId) => ({ projectId }),
    authorizeEvent: async () => ({ projectId: projectA }),
    ...overrides,
  };
}

const tool = (extra) => ({ name: "t", access: "read", scope: "project", permission: "p", input: {}, run: async () => ({ ok: true }), ...extra });

test("a token without a user is refused and nothing runs", async () => {
  let ran = false;
  const deps = makeDeps();
  const result = await runTool(tool({ run: async () => { ran = true; } }), { projectId: projectA }, {}, deps);
  assert.equal(result.isError, true);
  assert.equal(ran, false);
  assert.equal(deps.audit.length, 0);
});

test("a client with no active connection is refused and audited", async () => {
  const deps = makeDeps({ loadConnection: async () => null });
  const result = await runTool(tool(), { projectId: projectA }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /no active connection/);
  assert.equal(deps.audit[0].outcome, "denied");
  assert.equal(deps.audit[0].error_code, "not_connected");
});

test("a read-only connection cannot run a write tool", async () => {
  let ran = false;
  const deps = makeDeps({ loadConnection: async () => ({ id: "c", projectIds: [projectA], access: "read" }) });
  const result = await runTool(tool({ access: "write", run: async () => { ran = true; } }), { projectId: projectA }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.equal(ran, false);
  assert.equal(deps.audit[0].error_code, "read_only");
});

test("a project outside the connection is refused before any role check", async () => {
  let roleChecked = false;
  const deps = makeDeps({ authorizeProject: async () => { roleChecked = true; } });
  const result = await runTool(tool(), { projectId: projectB }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.equal(roleChecked, false);
});

test("an event in a project outside the connection is refused", async () => {
  let ran = false;
  const deps = makeDeps({ authorizeEvent: async () => ({ projectId: projectB }) });
  const result = await runTool(tool({ scope: "event", run: async () => { ran = true; } }), { eventId }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.equal(ran, false);
});

test("a role that lacks the permission is refused after retrying membership once", async () => {
  let ensured = 0;
  const deps = makeDeps({
    ensureMembership: async () => { ensured += 1; },
    authorizeProject: async () => { throw new OperationsError("forbidden", 403, "no"); },
  });
  const result = await runTool(tool(), { projectId: projectA }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /role/);
  assert.equal(ensured, 1);
  assert.equal(deps.audit[0].outcome, "denied");
});

test("a first-time user gets their role issued, then the tool runs", async () => {
  let calls = 0;
  const deps = makeDeps({
    authorizeProject: async (_p, projectId) => {
      calls += 1;
      if (calls === 1) throw new OperationsError("forbidden", 403, "no");
      return { projectId };
    },
  });
  const result = await runTool(tool(), { projectId: projectA }, authInfo, deps);
  assert.equal(result.isError, undefined);
  assert.equal(deps.audit[0].outcome, "ok");
});

test("rate limited calls never reach the tool", async () => {
  let ran = false;
  const deps = makeDeps({ isRateLimited: async () => true });
  const result = await runTool(tool({ run: async () => { ran = true; } }), { projectId: projectA }, authInfo, deps);
  assert.equal(result.isError, true);
  assert.equal(ran, false);
  assert.equal(deps.audit[0].outcome, "rate_limited");
});

test("internal errors don't leak to the model", async () => {
  const deps = makeDeps();
  const original = console.error;
  console.error = () => {};
  const result = await runTool(tool({ run: async () => { throw new Error("secret db detail"); } }), { projectId: projectA }, authInfo, deps);
  console.error = original;
  assert.equal(result.isError, true);
  assert.doesNotMatch(result.content[0].text, /secret/);
  assert.equal(deps.audit[0].outcome, "error");
});

test("the audit log records argument names, not values", async () => {
  const deps = makeDeps();
  await runTool(tool(), { projectId: projectA, summary: "private text" }, authInfo, deps);
  assert.deepEqual(deps.audit[0].metadata, { argument_keys: ["projectId", "summary"] });
  assert.doesNotMatch(JSON.stringify(deps.audit[0]), /private text/);
});

test("a write that can't be audited says so", async () => {
  const original = console.error;
  console.error = () => {};
  const deps = makeDeps({ writeAudit: async () => { throw new Error("down"); } });
  const result = await runTool(tool({ access: "write" }), { projectId: projectA }, authInfo, deps);
  console.error = original;
  assert.match(result.content[0].text, /auditWarning/);
});

test("every tool declares its access level, annotations and a real permission", async () => {
  // The rbac config imports app aliases node can't resolve, so read its source for the catalog instead.
  const source = await readFile(new URL("../../geiger-rbac.config.js", import.meta.url), "utf8");
  const navSections = [...source.matchAll(/^\s+"([A-Z][^"]+)",$/gm)].map((match) => match[1].toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const isCatalogued = (key) => {
    const nav = /^events\.(.+)\.view$/.exec(key);
    return nav ? navSections.includes(nav[1]) : source.includes(`key: "${key}"`);
  };
  for (const definition of TOOLS) {
    assert.ok(["read", "write"].includes(definition.access), definition.name);
    assert.equal(definition.annotations.readOnlyHint, definition.access === "read", definition.name);
    assert.equal(typeof definition.annotations.destructiveHint, "boolean", definition.name);
    if (definition.scope !== "connection") {
      assert.ok(isCatalogued(definition.permission), `${definition.name}: ${definition.permission}`);
    }
  }
  assert.equal(isCatalogued("events.made_up.view"), false);
});

test("no tool can set status, money or ownership through editable fields", () => {
  const row = eventRow({ name: "A", status: "On Sale", sold: 9, revenue: 9, project_id: "x", created_by: "y" });
  assert.deepEqual(row, { name: "A" });
  const update = TOOLS.find((definition) => definition.name === "update_event");
  const parsed = z.object(update.input).parse({ eventId, status: "On Sale", revenue: 9 });
  assert.deepEqual(parsed, { eventId });
});

test("refund, purchase and delete tools are not exposed", () => {
  const names = TOOLS.map((definition) => definition.name).join(",");
  assert.doesNotMatch(names, /refund|buy|purchase|delete|cancel|role|campaign/);
});

test("token checks require issuer, role, subject and client_id", async () => {
  const issuer = "https://x.supabase.co/auth/v1";
  const good = { iss: issuer, role: "authenticated", sub: "u", client_id: "c", exp: 9999999999 };
  const check = (claims, error = null) =>
    verifyMcpToken(null, "tok", { issuer, getClaims: async () => ({ data: claims ? { claims } : null, error }) });

  assert.equal((await check(good)).clientId, "c");
  assert.equal((await check(good)).extra.userId, "u");
  assert.equal(await verifyMcpToken(null, undefined, { issuer, getClaims: async () => assert.fail() }), undefined);
  assert.equal(await check(null, new Error("bad signature")), undefined);
  assert.equal(await check({ ...good, iss: "https://evil/auth/v1" }), undefined);
  assert.equal(await check({ ...good, role: "anon" }), undefined);
  assert.equal(await check({ ...good, client_id: undefined }), undefined, "browser session token");
});

function rpc(method, params = {}, token = "tok") {
  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

const stubVerify = async (_req, token) => (token ? authInfo : undefined);

async function readRpc(response) {
  const text = await response.text();
  const line = text.split("\n").find((value) => value.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text);
}

test("the endpoint answers an unauthenticated call with a 401 pointing at the metadata", async () => {
  const handler = buildMcpHandler({ deps: makeDeps(), verify: stubVerify });
  const response = await handler(rpc("tools/list", {}, null));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /resource_metadata=".*oauth-protected-resource"/);
});

test("the endpoint lists tools with annotations and runs one through the checks", async () => {
  const deps = makeDeps({ loadConnection: async () => ({ id: "c", projectIds: [projectA], access: "read" }) });
  const handler = buildMcpHandler({ deps, verify: stubVerify });

  const listed = await readRpc(await handler(rpc("tools/list")));
  const names = listed.result.tools.map((item) => item.name);
  assert.ok(names.includes("list_events"));
  const publish = listed.result.tools.find((item) => item.name === "publish_event");
  assert.equal(publish.annotations.destructiveHint, true);

  const called = await readRpc(await handler(rpc("tools/call", { name: "publish_event", arguments: { eventId } })));
  assert.equal(called.result.isError, true);
  assert.match(called.result.content[0].text, /read-only/);
  assert.equal(deps.audit[0].tool, "publish_event");
});
