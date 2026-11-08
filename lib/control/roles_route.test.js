import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

import { fakeDb } from "./testing/fake_db.js";

const root = new URL("../../", import.meta.url);
const mocks = {
  "@/lib/portal/session": "export const getSessionMember=async()=>globalThis.__rolesFixture.member;",
  "@/lib/supabase/admin": "export const adminClient=()=>globalThis.__rolesFixture.db;",
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(mocks, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) return next(new URL(`${specifier.slice(2)}.js`, root).href, context);
    return next(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});
const { GET } = await import("../../app/api/portal/roles/route.js");

test("401 without an attendee session", async (t) => {
  globalThis.__rolesFixture = { member: null, db: fakeDb() };
  t.after(() => delete globalThis.__rolesFixture);
  assert.equal((await GET()).status, 401);
});

test("returns the hint for the signed-in member's email", async (t) => {
  globalThis.__rolesFixture = {
    member: { id: "m1", email: "sam@example.test" },
    db: fakeDb({
      rpc: {
        suite_access_for_email: ({ p_email }) =>
          p_email === "sam@example.test"
            ? [{ organization_id: "o1", organization_name: "Acme", project_count: 1, invited: false }]
            : [],
      },
    }),
  };
  t.after(() => delete globalThis.__rolesFixture);
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.team.available, true);
  assert.deepEqual(body.crew, []);
});
