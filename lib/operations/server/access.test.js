import test from "node:test";
import assert from "node:assert/strict";
import { defineRbacConfig } from "@geiger/rbac";
import { authorizeEventAction } from "./access.js";
import { resolveStaffPrincipal } from "./staff_identity.js";

const eventId = "11111111-1111-4111-8111-111111111111";
const otherEventId = "22222222-2222-4222-8222-222222222222";
const principal = { kind: "staff", id: "33333333-3333-4333-8333-333333333333" };
const config = defineRbacConfig({ product: "events", permissions: [
  { key: "events.operations.view", label: "View operations", scopeBy: "event" },
], systemRoles: [] });
const role = { id: "role-1", project_id: "project-1", key: "manager", name: "Manager", permissions: ["events.operations.view"] };
const grant = { id: "grant-1", project_id: "project-1", user_id: principal.id, role_id: role.id, scope: {}, status: "active" };
const request = (authorization, cookie) => ({ headers: new Headers({
  ...(authorization ? { authorization } : {}), ...(cookie ? { cookie } : {}),
}) });

function boundary({ member = true, grants = [grant], roles = [role], event = { id: eventId, project_id: "project-1" } } = {}) {
  return {
    config,
    loadEvent: async () => event,
    isProjectMember: async () => member,
    loadRoles: async () => roles,
    loadGrants: async () => grants,
  };
}

test("staff identity rejects missing and invalid credentials", async () => {
  await assert.rejects(resolveStaffPrincipal(request(), { createAuthClient: () => {
    throw Error("should not create a client");
  } }), { code: "unauthenticated", status: 401 });
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: Error("invalid") }) } };
  await assert.rejects(resolveStaffPrincipal(request("Bearer bad"), { createAuthClient: () => client }),
    { code: "unauthenticated", status: 401 });
});

test("staff identity verifies bearer token and browser cookie with getUser", async () => {
  const seen = [];
  const client = { auth: { getUser: async (token) => {
    seen.push(token);
    return { data: { user: { id: principal.id } }, error: null };
  } } };
  assert.deepEqual(await resolveStaffPrincipal(request("Bearer valid"), { createAuthClient: () => client }), principal);
  assert.deepEqual(await resolveStaffPrincipal(request(null, "sb-test-auth-token=x"), { createAuthClient: () => client }), principal);
  assert.deepEqual(seen, ["valid", undefined]);
});

test("event authorization hides events outside membership and denies missing permission", async () => {
  await assert.rejects(authorizeEventAction(principal, eventId, "events.operations.view", boundary({ member: false })),
    { code: "not_found", status: 404 });
  await assert.rejects(authorizeEventAction(principal, eventId, "events.operations.view", boundary({ grants: [] })),
    { code: "forbidden", status: 403 });
});

test("event authorization checks event scope and revoked grants", async () => {
  const scoped = { ...grant, scope: { event: [otherEventId] } };
  await assert.rejects(authorizeEventAction(principal, eventId, "events.operations.view", boundary({ grants: [scoped] })),
    { code: "forbidden", status: 403 });
  await assert.rejects(authorizeEventAction(principal, eventId, "events.operations.view", boundary({ grants: [{ ...grant, deletedAt: "2026-09-30" }] })),
    { code: "forbidden", status: 403 });
  const result = await authorizeEventAction(principal, eventId, "events.operations.view", boundary());
  assert.equal(result.projectId, "project-1");
  assert.equal(result.eventId, eventId);
});

test("unknown actions and false principals fail closed", async () => {
  await assert.rejects(authorizeEventAction(principal, eventId, "events.operations.configure", boundary()),
    { code: "forbidden", status: 403 });
  await assert.rejects(authorizeEventAction({ kind: "portal", id: principal.id }, eventId, "events.operations.view", boundary()),
    { code: "unauthenticated", status: 401 });
});
