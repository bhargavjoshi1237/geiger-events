import test from "node:test";
import assert from "node:assert/strict";
import { defineRbacConfig } from "@geiger/rbac";

import { loadControlEvent, loadControlProfile } from "./profile.js";

const config = defineRbacConfig({
  product: "events",
  permissions: [
    { key: "events.events.view", label: "Events" },
    { key: "events.check_in.view", label: "Check-in" },
    { key: "events.guests.view", label: "Guests" },
    { key: "events.orders.view", label: "Orders" },
    { key: "events.analytics.view", label: "Analytics" },
    { key: "events.operations.view", label: "Operations", scopeBy: "event" },
  ],
});

const E7 = "00000000-0000-4000-8000-000000000007";
const E8 = "00000000-0000-4000-8000-000000000008";
const E1 = "00000000-0000-4000-8000-000000000001";
const principal = { kind: "staff", id: "u1" };
const role = (id, key, permissions) => ({ id, project_id: "p1", key, name: key[0].toUpperCase() + key.slice(1), permissions });
const grant = (id, roleId, scope = {}) => ({ id, project_id: "p1", user_id: "u1", role_id: roleId, scope, status: "active", deleted_at: null });

function boundary({ roles, grants, projects = [{ id: "p1", name: "Acme Live", organizationName: "Acme" }], member = true, row = undefined }) {
  return {
    config,
    listProjects: async () => projects,
    loadRoles: async () => roles,
    loadGrants: async () => grants(),
    isProjectMember: async () => member,
    loadEvent: async (eventId) => ({ id: eventId, project_id: "p1" }),
    loadEventRow: async (eventId) => row === null ? null : ({
      id: eventId, name: "Finals", status: "Published", event_date: "2026-11-08", event_time: "19:00",
      venue: "Arena", city: "Leeds", timezone: "Europe/London", capacity: 500, sold: 320, cover_url: null,
    }),
  };
}

test("a role's permissions become the project's capabilities", async () => {
  const b = boundary({
    roles: [role("r1", "door", ["events.events.view", "events.check_in.view", "events.guests.view"])],
    grants: () => [grant("g1", "r1")],
  });
  const { projects } = await loadControlProfile({ principal, boundary: b, ensureMembership: async () => null });
  assert.deepEqual(projects, [{
    id: "p1", name: "Acme Live", organizationName: "Acme",
    role: { key: "door", name: "Door" },
    can: { events: true, checkIn: true, guests: true, orders: false, analytics: false, operations: false },
  }]);
});

test("the owner wildcard grants every tool", async () => {
  const b = boundary({ roles: [role("r1", "owner", ["*"])], grants: () => [grant("g1", "r1")] });
  const { projects } = await loadControlProfile({ principal, boundary: b, ensureMembership: async () => null });
  assert.ok(Object.values(projects[0].can).every(Boolean));
});

test("an event-scoped grant counts as access at project level", async () => {
  const b = boundary({
    roles: [role("r1", "chair", ["events.events.view", "events.operations.view"])],
    grants: () => [grant("g1", "r1", { event: [E7] })],
  });
  const { projects } = await loadControlProfile({ principal, boundary: b, ensureMembership: async () => null });
  assert.equal(projects[0].can.operations, true);
});

test("a member with no grant gets one minted, as the dashboard does", async () => {
  let minted = false;
  const b = boundary({
    roles: [role("r1", "member", ["events.events.view", "events.check_in.view"])],
    grants: () => (minted ? [grant("g1", "r1")] : []),
  });
  const { projects } = await loadControlProfile({
    principal,
    boundary: b,
    ensureMembership: async (projectId) => {
      assert.equal(projectId, "p1");
      minted = true;
      return "r1";
    },
  });
  assert.equal(projects[0].role.key, "member");
  assert.equal(projects[0].can.checkIn, true);
});

test("when no grant can be minted the project shows with no role and no tools", async () => {
  const b = boundary({ roles: [], grants: () => [] });
  const { projects } = await loadControlProfile({ principal, boundary: b, ensureMembership: async () => null });
  assert.equal(projects[0].role, null);
  assert.ok(Object.values(projects[0].can).every((v) => v === false));
});

test("event view resolves scoped grants against that exact event", async () => {
  const b = boundary({
    roles: [role("r1", "chair", ["events.events.view", "events.operations.view"])],
    grants: () => [grant("g1", "r1", { event: [E7] })],
  });
  const now = new Date("2026-11-08T12:00:00Z");
  const own = await loadControlEvent({ principal, eventId: E7, boundary: b, now });
  assert.equal(own.projectId, "p1");
  assert.equal(own.event.when, "today");
  assert.equal(own.can.operations, true);
  const other = await loadControlEvent({ principal, eventId: E8, boundary: b, now });
  assert.equal(other.can.operations, false);
});

test("an event outside the user's projects is a 404, not a 403", async () => {
  const b = boundary({ roles: [], grants: () => [], member: false });
  await assert.rejects(
    loadControlEvent({ principal, eventId: E1, boundary: b }),
    (error) => error.status === 404,
  );
});

test("a soft-deleted event is a 404", async () => {
  const b = boundary({ roles: [role("r1", "owner", ["*"])], grants: () => [grant("g1", "r1")], row: null });
  await assert.rejects(
    loadControlEvent({ principal, eventId: E7, boundary: b }),
    (error) => error.status === 404,
  );
});

test("a malformed event id is a 404 before any lookup", async () => {
  const b = boundary({ roles: [], grants: () => [] });
  let looked = false;
  b.loadEvent = async () => { looked = true; return null; };
  await assert.rejects(
    loadControlEvent({ principal, eventId: "not-a-uuid", boundary: b }),
    (error) => error.status === 404,
  );
  assert.equal(looked, false);
});

test("a non-staff principal is rejected", async () => {
  const b = boundary({ roles: [], grants: () => [] });
  await assert.rejects(
    loadControlProfile({ principal: { kind: "portal", id: "m1" }, boundary: b, ensureMembership: async () => null }),
    (error) => error.status === 401,
  );
});
