import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const root = new URL("../../", import.meta.url);
const mocks = {
  "@/lib/portal/session": "export const getSessionMember=async()=>globalThis.__appConfigFixture.member;",
  "@/lib/portal/memberships": "export const listMemberProjectIds=async()=>globalThis.__appConfigFixture.projectIds;",
  "@/lib/supabase/admin": "export const adminClient=()=>globalThis.__appConfigFixture.db;",
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
const { GET } = await import("../../app/api/portal/app-config/route.js");

function fakeDb(rows, error = null) {
  return {
    from(table) {
      assert.equal(table, "app_configs");
      return {
        select() {
          return this;
        },
        in: async (column, ids) => {
          assert.equal(column, "project_id");
          return { data: error ? null : rows.filter((r) => ids.includes(r.project_id)), error };
        },
      };
    },
  };
}

function fixture(t, value) {
  globalThis.__appConfigFixture = value;
  t.after(() => delete globalThis.__appConfigFixture);
}

test("401 without a portal session", async (t) => {
  fixture(t, { member: null, projectIds: [], db: fakeDb([]) });
  const res = await GET();
  assert.equal(res.status, 401);
});

test("a member with no projects gets everything on", async (t) => {
  fixture(t, { member: { id: "m1", email: "a@b.test" }, projectIds: [], db: fakeDb([]) });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, true);
  assert.deepEqual(body.home.shortcuts, ["community", "watch", "memberships"]);
  assert.equal("whiteLabel" in body, false);
});

test("a single project's config is served as-is", async (t) => {
  fixture(t, {
    member: { id: "m1", email: "a@b.test" },
    projectIds: ["p1"],
    db: fakeDb([{ project_id: "p1", config: { sections: { networking: false }, home: { welcome: "Hi", shortcuts: ["qa"] } } }]),
  });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, false);
  assert.equal(body.home.welcome, "Hi");
  assert.deepEqual(body.home.shortcuts, ["qa"]);
});

test("a second project without a row turns sections back on", async (t) => {
  fixture(t, {
    member: { id: "m1", email: "a@b.test" },
    projectIds: ["p1", "p2"],
    db: fakeDb([{ project_id: "p1", config: { sections: { networking: false }, home: { welcome: "Hi" } } }]),
  });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, true);
  assert.equal(body.home.welcome, "");
});

test("a failed read falls back to the defaults instead of hiding sections", async (t) => {
  fixture(t, { member: { id: "m1", email: "a@b.test" }, projectIds: ["p1"], db: fakeDb([], { message: "boom" }) });
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).sections.watch, true);
});
