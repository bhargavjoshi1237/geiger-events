import test from "node:test";
import assert from "node:assert/strict";
import { createOperationsClient } from "./client.js";
import { initialWorkspaceState, workspaceReducer } from "../../components/internal/screens/operations/workspace_state.js";

test("client reads no workspace and preserves server errors", async () => {
  const calls = [];
  const client = createOperationsClient(async (url, init) => {
    calls.push([url, init]);
    return Response.json({ revision: 0, draft: [], modules: [], status: "draft" });
  });
  const result = await client.workspace("event-1");
  assert.equal(result.data.revision, 0);
  assert.match(calls[0][0], /event-1\/operations\/workspace$/);
  process.env.NEXT_PUBLIC_BASE_PATH = "/events";
  await client.workspace("event-1");
  assert.match(calls[1][0], /^\/events\/api\/events\//);
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  const denied = createOperationsClient(async () => Response.json({ error: { code: "forbidden" } }, { status: 403 }));
  assert.equal((await denied.workspace("event-1")).error.code, "forbidden");
});

test("workspace reducer retains draft on conflict and ignores old event responses", () => {
  let state = workspaceReducer(initialWorkspaceState, { type: "scope", eventId: "event-1" });
  state = workspaceReducer(state, { type: "loading", eventId: "event-1" });
  assert.equal(state.loading, true);
  state = workspaceReducer(state, { type: "loaded", eventId: "event-1", data: { revision: 0, draft: [] } });
  state = workspaceReducer(state, { type: "draft", eventId: "event-1", draft: [{ key: "vendor" }] });
  state = workspaceReducer(state, { type: "failed", eventId: "event-1", error: { code: "revision_conflict" } });
  assert.equal(state.draft[0].key, "vendor");
  state = workspaceReducer(state, { type: "scope", eventId: "event-2" });
  state = workspaceReducer(state, { type: "loaded", eventId: "event-1", data: { revision: 9 } });
  assert.equal(state.data, null);
  state = workspaceReducer(state, { type: "loaded", eventId: "event-2", data: { revision: 1, draft: [] } });
  assert.equal(state.data.revision, 1);
  state = workspaceReducer(state, { type: "saved", eventId: "event-2",
    data: { revision: 2, status: "active", publishedVersion: 1, draft: [] } });
  assert.equal(state.data.status, "active");
  assert.equal(state.dirty, false);
});
