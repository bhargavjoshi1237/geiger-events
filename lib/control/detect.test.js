import test from "node:test";
import assert from "node:assert/strict";

import { detectRoles } from "./detect.js";
import { fakeDb } from "./testing/fake_db.js";

const member = { id: "m1", email: "sam@example.test" };

test("no db or no member means no hint", async () => {
  const empty = { team: { available: false, invited: false, organizations: [] }, crew: [] };
  assert.deepEqual(await detectRoles(null, member), empty);
  assert.deepEqual(await detectRoles(fakeDb(), null), empty);
});

test("organisations with projects make team access available; empty ones and invites do not", async () => {
  let asked = null;
  const db = fakeDb({
    rpc: {
      suite_access_for_email: (args) => {
        asked = args;
        return [
          { organization_id: "o1", organization_name: "Acme", project_count: 2, invited: false },
          { organization_id: "o2", organization_name: "Empty Org", project_count: 0, invited: false },
          { organization_id: null, organization_name: "Team invitation", project_count: 1, invited: true },
        ];
      },
    },
  });
  const hint = await detectRoles(db, member);
  assert.deepEqual(asked, { p_email: "sam@example.test" });
  assert.equal(hint.team.available, true);
  assert.equal(hint.team.invited, true);
  assert.deepEqual(hint.team.organizations, [{ id: "o1", name: "Acme", projectCount: 2 }]);
});

test("a pending invitation alone is not team access", async () => {
  const db = fakeDb({
    rpc: { suite_access_for_email: () => [{ organization_id: null, organization_name: "Team invitation", project_count: 1, invited: true }] },
  });
  const hint = await detectRoles(db, member);
  assert.equal(hint.team.available, false);
  assert.equal(hint.team.invited, true);
});

test("a failed suite lookup still reports crew assignments", async () => {
  const db = fakeDb({
    errors: { suite_access_for_email: { message: "boom" } },
    tables: {
      ops_identity_links: [{ kind: "portal", principal_id: "m1", event_id: "e1", person_id: "p1" }],
      ops_people: [{ id: "p1", roles: ["staff"] }],
      events: [{ id: "e1", name: "DevCon", event_date: "2026-12-01", deleted_at: null }],
    },
  });
  const hint = await detectRoles(db, member);
  assert.equal(hint.team.available, false);
  assert.deepEqual(hint.crew, [{ eventId: "e1", eventName: "DevCon", eventDate: "2026-12-01", roles: ["staff"] }]);
});

test("crew roles merge per event, skip deleted events and other principals, and sort by date", async () => {
  const db = fakeDb({
    tables: {
      ops_identity_links: [
        { kind: "portal", principal_id: "m1", event_id: "e2", person_id: "p2" },
        { kind: "portal", principal_id: "m1", event_id: "e1", person_id: "p1" },
        { kind: "portal", principal_id: "m1", event_id: "e1", person_id: "p3" },
        { kind: "portal", principal_id: "m1", event_id: "e3", person_id: "p4" },
        { kind: "portal", principal_id: "someone-else", event_id: "e1", person_id: "p9" },
        { kind: "staff", principal_id: "m1", event_id: "e1", person_id: "p8" },
      ],
      ops_people: [
        { id: "p1", roles: ["presenter"] },
        { id: "p2", roles: ["volunteer"] },
        { id: "p3", roles: ["evaluator", "presenter"] },
        { id: "p4", roles: ["staff"] },
        { id: "p8", roles: ["staff"] },
        { id: "p9", roles: ["staff"] },
      ],
      events: [
        { id: "e1", name: "Summit", event_date: "2026-11-20", deleted_at: null },
        { id: "e2", name: "Meetup", event_date: "2026-11-10", deleted_at: null },
        { id: "e3", name: "Gone", event_date: "2026-11-01", deleted_at: "2026-10-01T00:00:00Z" },
      ],
    },
  });
  const hint = await detectRoles(db, member);
  assert.deepEqual(hint.crew, [
    { eventId: "e2", eventName: "Meetup", eventDate: "2026-11-10", roles: ["volunteer"] },
    { eventId: "e1", eventName: "Summit", eventDate: "2026-11-20", roles: ["evaluator", "presenter"] },
  ]);
});
