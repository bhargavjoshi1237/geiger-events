# One App — Phase 2: Control Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The members app detects when the signed-in attendee is also on an event team. It offers **Control**, unlocks it with a one-time team sign-in (password, or browser for Google/SSO/passkey), and lets the person switch between attendee and Control modes. Control home lists their projects and events with their real role and access, all enforced server-side.

**Architecture:**
- **Detection.** `/api/portal/roles` runs on the attendee session and only hints; it grants nothing. It uses a `service_role`-only SQL function for suite membership by email, plus `ops_identity_links` for crew.
- **Team identity.** It is a separate Supabase Auth session in the app, used for Auth only. It is sent as a Bearer token to new `/api/control/*` routes. Those routes reuse the operations stack: `resolveStaffPrincipal`, verified org membership, and `@geiger/rbac` `evaluate`.
- **Browser sign-in.** It reuses the desktop `/events/desktop/handoff`. An `m_` state prefix makes the return page deep-link to `geigerevents://team-auth`.
- **Mode.** The mode is persisted on the device. The root route picks attendee or Control.

**Tech Stack:** Next.js 16 route handlers (plain JS), Supabase (SQL function, Auth), `@geiger/rbac`, Expo SDK 57 / expo-router / TypeScript strict, `@supabase/supabase-js` (already a mobile dependency), `expo-web-browser`, `expo-secure-store`, `expo-crypto` (new).

**Design:** `docs/superpowers/specs/2026-11-08-one-app-design.md` (§3). The non-negotiable rule is that **a portal session never becomes a team session**.

**Depends on:** Phase 1 (`2026-11-08-one-app-1-app-config.md`), because Task 12 edits the Phase 1 version of `more/index.tsx` and `home/index.tsx`. If Phase 1 has not landed, do Tasks 1–11 first and re-read those two files before Task 12.

## Global Constraints

- Root code is plain JS ESM. Tests use `node:test` + `node:assert/strict`, run as `node --test <file>`. There is no test script; do not add one.
- Migrations are geiger-orm files with `-- @up` / `-- @down`. **Never run `npm run db:push` yourself.** Run `npm run db:status`, then ask the user to run `! cd D:/geiger-work/one-app && npm run db:push`.
- Control routes accept **only** `Authorization: Bearer <Supabase access token>`, never the suite cookie, and always authorise through `lib/operations/server/access.js`. The attendee token is never accepted on `/api/control/*`, and the team token is never sent to `/api/portal/*`.
- The app never queries Supabase tables. `@supabase/supabase-js` is used **only** for `auth.*`.
- Mobile follows `mobile/AGENTS.md`:
  - every colour comes from `@/theme/tokens`;
  - `StyleSheet.create` sits at the bottom of the file;
  - build from `@/components/ui/*` primitives;
  - lucide icons are registered in `components/ui/icons.tsx`;
  - every list has three states (skeleton, empty, content);
  - every touchable has a11y props;
  - imports use the `@/*` alias.
- If `mobile/node_modules` is missing, run `cd mobile && npm ci --include=dev` once before any mobile typecheck.
- Mobile verification is `cd mobile && npx tsc --noEmit` and `npm run lint:mobile` (repo root).
- Comments are concise, single-line, and explain *why*.
- **Commits:** commit each task on branch `feat/one-app` (this worktree, `D:/geiger-work/one-app`), staging only the task's own files by path — never `git add -A` / `git add .`. Never push, never touch `main`; the user decides when to merge.
- Do not screenshot or drive the UI yourself; the user does the device check.

---

### Task 1: `events.suite_access_for_email` migration

**Files:**
- Create: `supabase/migrations/20261109000100_suite_access_lookup.sql`

**Interfaces:**
- Produces: `events.suite_access_for_email(p_email text) → table(organization_id uuid, organization_name text, project_count int, invited boolean)`. It is executable by `service_role` only. Used by Task 2.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261109000100_suite_access_lookup.sql`:

```sql
-- @up
-- Team-access hint for the mobile app: which suite organisations an email belongs to. Service role only; it grants nothing.

create or replace function events.suite_access_for_email(p_email text)
returns table (organization_id uuid, organization_name text, project_count integer, invited boolean)
language sql
stable
security definer
set search_path = public, events, auth
as $$
  with target as (
    select u.id
      from auth.users u
     where lower(u.email) = lower(btrim(p_email))
     limit 1
  ),
  orgs as (
    select distinct ou.organization as id
      from public.organization_users ou
      join target t on ou."user" = t.id
  )
  select o.id,
         coalesce(nullif(btrim(org.name), ''), 'Your organisation'),
         (select count(*)::int from public.projects p where p.organization_id = o.id and p.deleted_at is null),
         false
    from orgs o
    left join public.organizations org on org.id = o.id
  union all
  select null::uuid, 'Your projects', count(*)::int, false
    from public.projects p
    join target t on p.created_by = t.id
   where p.organization_id is null
     and p.deleted_at is null
  having count(*) > 0
  union all
  select null::uuid, 'Team invitation', count(*)::int, true
    from events.project_members pm
   where lower(pm.email) = lower(btrim(p_email))
     and pm.user_id is null
     and pm.status = 'invited'
  having count(*) > 0;
$$;

revoke all on function events.suite_access_for_email(text) from public, anon, authenticated;
grant execute on function events.suite_access_for_email(text) to service_role;

-- @down
drop function if exists events.suite_access_for_email(text);
```

- [ ] **Step 2: Check it is pending**

Run: `npm run db:status`
Expected: `20261109000100_suite_access_lookup.sql` is listed as pending, with no other drift.

- [ ] **Step 3: Hand off the push**

Tell the user: "Migration `20261109000100_suite_access_lookup.sql` is ready. Please run `! npm run db:push`." Continue with the next tasks; only the device check needs the push.

---

### Task 2: Role detection (pure, with a fake db)

**Files:**
- Create: `lib/control/testing/fake_db.js` (test-only helper)
- Create: `lib/control/detect.js`
- Test: `lib/control/detect.test.js`

**Interfaces:**
- Consumes: `events.suite_access_for_email` (Task 1), and the tables `events.ops_identity_links`, `events.ops_people`, `events.events`. Everything goes through a supabase-js-shaped client with the `events` schema.
- Produces: `detectRoles(db, member) → Promise<RolesHint>`, where:
  ```js
  RolesHint = {
    team: { available: boolean, invited: boolean, organizations: { id: string|null, name: string, projectCount: number }[] },
    crew: { eventId: string, eventName: string, eventDate: string|null, roles: string[] }[],
  }
  ```

- [ ] **Step 1: Write the fake db helper**

Create `lib/control/testing/fake_db.js`:

```js
// Test-only stand-in for a supabase-js client: chainable filters over in-memory rows, plus canned rpc results.
export function fakeDb({ tables = {}, rpc = {}, errors = {} } = {}) {
  return {
    async rpc(name, args) {
      if (errors[name]) return { data: null, error: errors[name] };
      return { data: rpc[name] ? rpc[name](args) : [], error: null };
    },
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column, values) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        is(column, value) {
          filters.push((row) => (row[column] ?? null) === value);
          return query;
        },
        then(resolve, reject) {
          const result = errors[table]
            ? { data: null, error: errors[table] }
            : { data: (tables[table] || []).filter((row) => filters.every((f) => f(row))), error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/control/detect.test.js`:

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test lib/control/detect.test.js`
Expected: FAIL with `Cannot find module` … `lib/control/detect.js`.

- [ ] **Step 4: Write the implementation**

Create `lib/control/detect.js`:

```js
// Read-only hint for the members app: is this attendee also on an event team? It grants nothing — Control still needs a team sign-in.

const ROLE_ORDER = ["staff", "evaluator", "presenter", "volunteer", "participant"];

const NO_TEAM = { available: false, invited: false, organizations: [] };

export async function detectRoles(db, member) {
  if (!db || !member?.id || !member?.email) return { team: NO_TEAM, crew: [] };
  const [team, crew] = await Promise.all([teamHint(db, member.email), crewHint(db, member.id)]);
  return { team, crew };
}

async function teamHint(db, email) {
  const { data, error } = await db.rpc("suite_access_for_email", { p_email: email });
  if (error) {
    console.error("[control.detect] team", error.message);
    return NO_TEAM;
  }
  const rows = data || [];
  const organizations = rows
    .filter((row) => !row.invited && row.project_count > 0)
    .map((row) => ({ id: row.organization_id, name: row.organization_name, projectCount: row.project_count }));
  return { available: organizations.length > 0, invited: rows.some((row) => row.invited), organizations };
}

async function crewHint(db, memberId) {
  const links = await db
    .from("ops_identity_links")
    .select("event_id, person_id")
    .eq("kind", "portal")
    .eq("principal_id", memberId);
  if (links.error) {
    console.error("[control.detect] crew", links.error.message);
    return [];
  }
  const rows = links.data || [];
  if (!rows.length) return [];

  const [people, events] = await Promise.all([
    db.from("ops_people").select("id, roles").in("id", rows.map((row) => row.person_id)),
    db
      .from("events")
      .select("id, name, event_date")
      .in("id", [...new Set(rows.map((row) => row.event_id))])
      .is("deleted_at", null),
  ]);
  if (people.error || events.error) {
    console.error("[control.detect] crew", (people.error || events.error).message);
    return [];
  }

  const rolesByPerson = new Map((people.data || []).map((p) => [p.id, p.roles || []]));
  const eventById = new Map((events.data || []).map((e) => [e.id, e]));
  const byEvent = new Map();
  for (const link of rows) {
    const event = eventById.get(link.event_id);
    if (!event) continue;
    const entry = byEvent.get(event.id) || { eventId: event.id, eventName: event.name, eventDate: event.event_date, roles: new Set() };
    for (const role of rolesByPerson.get(link.person_id) || []) entry.roles.add(role);
    byEvent.set(event.id, entry);
  }

  return [...byEvent.values()]
    .map((entry) => ({ ...entry, roles: ROLE_ORDER.filter((role) => entry.roles.has(role)) }))
    .sort((a, b) => String(a.eventDate || "").localeCompare(String(b.eventDate || "")));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test lib/control/detect.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Lint**

Run: `npx eslint lib/control`
Expected: no errors.

---

### Task 3: `GET /api/portal/roles`

**Files:**
- Create: `app/api/portal/roles/route.js`
- Test: `lib/control/roles_route.test.js`

**Interfaces:**
- Consumes: `getSessionMember()`, `adminClient()`, `detectRoles` (Task 2).
- Produces: `GET /api/portal/roles`. Returns `200 RolesHint`, or `401 { error }` without an attendee session.

- [ ] **Step 1: Write the failing test**

Create `lib/control/roles_route.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/control/roles_route.test.js`
Expected: FAIL with `Cannot find module` … `app/api/portal/roles/route.js`.

- [ ] **Step 3: Write the route**

Create `app/api/portal/roles/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { detectRoles } from "@/lib/control/detect";

// Whether this attendee is also on an event team — a hint only; Control itself needs a team sign-in.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json(await detectRoles(adminClient(), member), {
    headers: { "Cache-Control": "no-store" },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/control/roles_route.test.js`
Expected: PASS, 2 tests.

---

### Task 4: Control server core (boundary, profile, event views, HTTP wrapper)

**Files:**
- Modify: `lib/operations/server/access.js` (export the boundary and the evaluation-input helper)
- Create: `lib/control/http.js`
- Create: `lib/control/boundary.js`
- Create: `lib/control/profile.js`
- Create: `lib/control/events.js`
- Test: `lib/control/profile.test.js`
- Test: `lib/control/events.test.js`
- Test: `lib/control/http.test.js`

**Interfaces:**
- Consumes:
  - `resolveStaffPrincipal(request, { createAuthClient })` (`lib/operations/server/staff_identity.js`)
  - `authorizeProjectAction` / `authorizeEventAction` (`lib/operations/server/access.js`)
  - `OperationsError` (`lib/operations/errors.js`)
  - `evaluateAll` (`@geiger/rbac`)
- Produces:
  - **`access.js`**:
    - `operationsBoundary()` (renamed from the private `defaultBoundary`)
    - `evaluationInput(projectId, principalId, roleRows, grantRows) → { roles, grants }`
  - **`http.js`**:
    - `controlToken(request) → string|null`
    - `withControl(request, handler, { resolve }) → Promise<NextResponse>`. The handler receives `{ principal, token }`.
  - **`boundary.js`**:
    - `controlBoundary()` returns the operations boundary plus:
      - `listProjects(userId) → [{ id, name, organizationName }]`
      - `listEvents(projectId) → rows`
      - `loadEventRow(eventId) → row|null`
    - `ensureMembership(accessToken, projectId) → Promise<string|null>`
  - **`profile.js`**:
    - `CONTROL_CAPABILITIES`
    - `capabilityMap(decisions)`
    - `loadControlProfile({ principal, boundary, ensureMembership }) → { projects: ControlProject[] }`
    - `loadControlEvent({ principal, eventId, boundary, now }) → { event, projectId, can }`
  - **`events.js`**:
    - `localDay(now, timeZone) → "YYYY-MM-DD"`
    - `toControlEvent(row, now)`
    - `arrangeEvents(rows, now) → ControlEvent[]`
  - **Shapes:**
    ```js
    ControlProject = { id, name, organizationName, role: { key, name } | null, can: Record<"events"|"checkIn"|"guests"|"orders"|"analytics"|"operations", boolean> }
    ControlEvent = { id, name, status, date, time, venue, city, timezone, capacity, sold, coverUrl, when: "today"|"upcoming"|"unscheduled"|"past" }
    ```

- [ ] **Step 1: Export the operations boundary and the evaluation-input helper**

In `lib/operations/server/access.js`:

Replace `async function defaultBoundary() {` with:

```js
export async function operationsBoundary() {
```

Replace both occurrences of `const source = boundary ?? await defaultBoundary();` with:

```js
  const source = boundary ?? await operationsBoundary();
```

Replace the whole `decideForProject` function with:

```js
async function decideForProject(source, principal, projectId, action, target) {
  const [roleRows, grantRows] = await Promise.all([
    source.loadRoles(projectId), source.loadGrants(projectId, principal.id),
  ]);
  const { roles, grants } = evaluationInput(projectId, principal.id, roleRows, grantRows);
  const decision = evaluate(action, {
    config: source.config, roles, grants, actorId: principal.id, ...target,
  });
  if (!decision.allowed) throw new OperationsError("forbidden", 403, "You cannot perform this action.");
}

// Shapes role/grant rows the way @geiger/rbac expects, dropping grants that point at another project's roles.
export function evaluationInput(projectId, principalId, roleRows, grantRows) {
  const roles = roleRows.map((row) => ({ ...row, projectId: row.project_id ?? row.projectId }));
  const roleIds = new Set(roles.filter((row) => row.projectId === projectId).map((row) => row.id));
  const grants = grantRows.filter((row) =>
    (row.project_id ?? row.projectId) === projectId &&
    (row.user_id ?? row.userId) === principalId && roleIds.has(row.role_id ?? row.roleId),
  ).map((row) => ({
    id: row.id, roleId: row.role_id ?? row.roleId, scope: row.scope,
    status: row.status, deletedAt: row.deleted_at ?? row.deletedAt,
  }));
  return { roles, grants };
}
```

Run: `node --test "lib/operations/**/*.test.js"`
Expected: the same pass count as before this edit, and 0 failures. Run it once before editing to record the baseline.

- [ ] **Step 2: Write the failing tests**

Create `lib/control/events.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { arrangeEvents, localDay } from "./events.js";

const row = (id, event_date, extra = {}) => ({
  id, name: id, status: "Published", event_date, event_time: "19:00", venue: "Hall", city: "London",
  timezone: "Europe/London", capacity: 100, sold: 10, cover_url: null, ...extra,
});

test("localDay uses the event's timezone", () => {
  const now = new Date("2026-11-08T23:30:00Z");
  assert.equal(localDay(now, "Europe/London"), "2026-11-08");
  assert.equal(localDay(now, "Asia/Kolkata"), "2026-11-09");
  assert.equal(localDay(now, "Not/AZone"), "2026-11-08");
});

test("today first, then upcoming soonest-first, then unscheduled, then the latest past events", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const out = arrangeEvents(
    [row("past-old", "2026-10-01"), row("later", "2026-12-01"), row("today", "2026-11-08"), row("soon", "2026-11-09"), row("tbd", null), row("past-new", "2026-11-01")],
    now,
  );
  assert.deepEqual(out.map((e) => e.id), ["today", "soon", "later", "tbd", "past-new", "past-old"]);
  assert.deepEqual(out.map((e) => e.when), ["today", "upcoming", "upcoming", "unscheduled", "past", "past"]);
});

test("an event abroad is 'today' by its own calendar", () => {
  const now = new Date("2026-11-08T23:30:00Z");
  const [event] = arrangeEvents([row("mumbai", "2026-11-09", { timezone: "Asia/Kolkata" })], now);
  assert.equal(event.when, "today");
});

test("only the ten most recent past events are kept, in camelCase", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const past = Array.from({ length: 14 }, (_, i) => row(`p${i}`, `2026-10-${String(i + 1).padStart(2, "0")}`));
  const out = arrangeEvents(past, now);
  assert.equal(out.length, 10);
  assert.equal(out[0].id, "p13");
  assert.deepEqual(Object.keys(out[0]).sort(), ["capacity", "city", "coverUrl", "date", "id", "name", "sold", "status", "time", "timezone", "venue", "when"]);
});
```

Create `lib/control/profile.test.js`:

```js
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

const principal = { kind: "staff", id: "u1" };
const role = (id, key, permissions) => ({ id, project_id: "p1", key, name: key[0].toUpperCase() + key.slice(1), permissions });
const grant = (id, roleId, scope = {}) => ({ id, project_id: "p1", user_id: "u1", role_id: roleId, scope, status: "active", deleted_at: null });

function boundary({ roles, grants, projects = [{ id: "p1", name: "Acme Live", organizationName: "Acme" }], member = true }) {
  return {
    config,
    listProjects: async () => projects,
    loadRoles: async () => roles,
    loadGrants: async () => grants(),
    isProjectMember: async () => member,
    loadEvent: async (eventId) => ({ id: eventId, project_id: "p1" }),
    loadEventRow: async (eventId) => ({
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
    grants: () => [grant("g1", "r1", { event: ["e7"] })],
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
    grants: () => [grant("g1", "r1", { event: ["e7"] })],
  });
  const now = new Date("2026-11-08T12:00:00Z");
  const own = await loadControlEvent({ principal, eventId: "e7", boundary: b, now });
  assert.equal(own.projectId, "p1");
  assert.equal(own.event.when, "today");
  assert.equal(own.can.operations, true);
  const other = await loadControlEvent({ principal, eventId: "e8", boundary: b, now });
  assert.equal(other.can.operations, false);
});

test("an event outside the user's projects is a 404, not a 403", async () => {
  const b = boundary({ roles: [], grants: () => [], member: false });
  await assert.rejects(
    loadControlEvent({ principal, eventId: "e1", boundary: b }),
    (error) => error.status === 404,
  );
});
```

Create `lib/control/http.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});
const { withControl } = await import("./http.js");
const { OperationsError } = await import("../operations/errors.js");

const request = (headers = {}) => new Request("https://geiger.example/api/control/me", { headers });

test("no Bearer token is a 401 before any lookup", async () => {
  let resolved = false;
  const res = await withControl(request({ cookie: "sb=1" }), async () => ({}), {
    resolve: async () => {
      resolved = true;
    },
  });
  assert.equal(res.status, 401);
  assert.equal(resolved, false);
});

test("the handler gets the principal and the raw token", async () => {
  const res = await withControl(
    request({ authorization: "Bearer abc.def" }),
    async ({ principal, token }) => ({ who: principal.id, token }),
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { who: "u1", token: "abc.def" });
});

test("operations errors keep their status and message", async () => {
  const res = await withControl(
    request({ authorization: "Bearer x" }),
    async () => {
      throw new OperationsError("forbidden", 403, "You cannot perform this action.");
    },
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "You cannot perform this action.", code: "forbidden" });
});

test("unexpected errors become a generic 500", async () => {
  const res = await withControl(
    request({ authorization: "Bearer x" }),
    async () => {
      throw new Error("db exploded with secrets");
    },
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "Something went wrong." });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test lib/control/events.test.js lib/control/profile.test.js lib/control/http.test.js`
Expected: FAIL with `Cannot find module` for `events.js`, `profile.js` and `http.js`.

- [ ] **Step 4: Write `lib/control/events.js`**

```js
// Control's event list: the event's own calendar decides "today", so it flips at the venue's midnight, not the server's.

const PAST_LIMIT = 10;

export function localDay(now, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function toControlEvent(row, now) {
  const today = localDay(now, row.timezone);
  const when = !row.event_date
    ? "unscheduled"
    : row.event_date === today
      ? "today"
      : row.event_date > today
        ? "upcoming"
        : "past";
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    date: row.event_date,
    time: row.event_time,
    venue: row.venue,
    city: row.city,
    timezone: row.timezone,
    capacity: row.capacity,
    sold: row.sold,
    coverUrl: row.cover_url,
    when,
  };
}

export function arrangeEvents(rows, now) {
  const events = rows.map((row) => toControlEvent(row, now));
  const pick = (when) => events.filter((e) => e.when === when);
  const soonest = (a, b) => String(a.date).localeCompare(String(b.date));
  return [
    ...pick("today"),
    ...pick("upcoming").sort(soonest),
    ...pick("unscheduled"),
    ...pick("past").sort((a, b) => soonest(b, a)).slice(0, PAST_LIMIT),
  ];
}
```

- [ ] **Step 5: Write `lib/control/profile.js`**

```js
import { evaluateAll } from "@geiger/rbac";

import { authorizeEventAction, evaluationInput } from "../operations/server/access.js";
import { toControlEvent } from "./events.js";

// The Control tools and the permission each needs; the app only offers a tool its key grants.
export const CONTROL_CAPABILITIES = {
  events: "events.events.view",
  checkIn: "events.check_in.view",
  guests: "events.guests.view",
  orders: "events.orders.view",
  analytics: "events.analytics.view",
  operations: "events.operations.view",
};

const KEYS = Object.values(CONTROL_CAPABILITIES);

// Without an event to check, a grant scoped to some events still means "this tool exists for you here".
export function capabilityMap(decisions, { scoped = true } = {}) {
  return Object.fromEntries(
    Object.entries(CONTROL_CAPABILITIES).map(([name, key]) => {
      const decision = decisions[key];
      return [name, decision.allowed || (scoped && decision.code === "missing_scope_target")];
    }),
  );
}

async function grantsFor(project, principal, boundary, ensureMembership) {
  const [roleRows, firstGrants] = await Promise.all([
    boundary.loadRoles(project.id),
    boundary.loadGrants(project.id, principal.id),
  ]);
  let grantRows = firstGrants;
  // The dashboard mints a member's first grant on first visit; do the same so an app-only teammate still gets a role.
  if (!grantRows.some((row) => row.status === "active")) {
    const minted = await ensureMembership(project.id);
    if (minted) grantRows = await boundary.loadGrants(project.id, principal.id);
  }
  return evaluationInput(project.id, principal.id, roleRows, grantRows);
}

function roleOf(roles, grants) {
  const active = grants.find((g) => g.status === "active" && !g.deletedAt);
  const role = active ? roles.find((r) => r.id === active.roleId) : null;
  return role ? { key: role.key, name: role.name } : null;
}

export async function loadControlProfile({ principal, boundary, ensureMembership }) {
  const projects = await boundary.listProjects(principal.id);
  return {
    projects: await Promise.all(
      projects.map(async (project) => {
        const { roles, grants } = await grantsFor(project, principal, boundary, ensureMembership);
        const decisions = evaluateAll(KEYS, { config: boundary.config, roles, grants, actorId: principal.id });
        return {
          id: project.id,
          name: project.name,
          organizationName: project.organizationName,
          role: roleOf(roles, grants),
          can: capabilityMap(decisions),
        };
      }),
    ),
  };
}

export async function loadControlEvent({ principal, eventId, boundary, now = new Date() }) {
  const { projectId } = await authorizeEventAction(principal, eventId, CONTROL_CAPABILITIES.events, boundary);
  const [row, roleRows, grantRows] = await Promise.all([
    boundary.loadEventRow(eventId),
    boundary.loadRoles(projectId),
    boundary.loadGrants(projectId, principal.id),
  ]);
  const { roles, grants } = evaluationInput(projectId, principal.id, roleRows, grantRows);
  const decisions = evaluateAll(KEYS, { config: boundary.config, roles, grants, actorId: principal.id, scopeId: eventId });
  return { event: toControlEvent(row, now), projectId, can: capabilityMap(decisions, { scoped: false }) };
}
```

- [ ] **Step 6: Write `lib/control/http.js`**

```js
import { NextResponse } from "next/server";

import { OperationsError } from "../operations/errors.js";
import { resolveStaffPrincipal } from "../operations/server/staff_identity.js";

const NO_STORE = { "Cache-Control": "no-store" };

// Control is a native-app API: the team session arrives as a Bearer token, never as the suite cookie.
export function controlToken(request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  return match ? match[1] : null;
}

export async function withControl(request, handler, { resolve = resolveStaffPrincipal } = {}) {
  try {
    const token = controlToken(request);
    if (!token) throw new OperationsError("unauthenticated", 401, "Sign in to Control to continue.");
    const principal = await resolve(request);
    return NextResponse.json(await handler({ principal, token }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof OperationsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
    }
    console.error("[control]", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
}
```

- [ ] **Step 7: Write `lib/control/boundary.js`**

```js
import { createClient } from "@supabase/supabase-js";

import { adminClient } from "../supabase/admin.js";
import { OperationsError } from "../operations/errors.js";
import { operationsBoundary } from "../operations/server/access.js";

const EVENT_COLUMNS = "id,name,status,event_date,event_time,venue,city,timezone,capacity,sold,cover_url";

function requireData(result) {
  if (result.error) throw new OperationsError("service_unavailable", 503, "Control is unavailable.");
  return result.data;
}

// Service-role reads for Control, layered on the operations boundary (rbac config, membership, roles, grants).
export async function controlBoundary() {
  const base = await operationsBoundary();
  const db = adminClient();
  if (!db) throw new OperationsError("service_unavailable", 503, "Control is unavailable.");
  return {
    ...base,
    // Same rule as verifiedProjectMembership: org members, or the creator of an org-less project — never any org-less project.
    async listProjects(userId) {
      const links = requireData(await db.schema("public").from("organization_users").select("organization").eq("user", userId));
      const orgIds = [...new Set(links.map((link) => link.organization))];
      const owned = `and(organization_id.is.null,created_by.eq.${userId})`;
      const projects = requireData(
        await db
          .schema("public")
          .from("projects")
          .select("id,name,organization_id,created_at")
          .is("deleted_at", null)
          .or(orgIds.length ? `organization_id.in.(${orgIds.join(",")}),${owned}` : owned)
          .order("created_at", { ascending: true }),
      );
      const orgs = orgIds.length
        ? requireData(await db.schema("public").from("organizations").select("id,name").in("id", orgIds))
        : [];
      const orgName = new Map(orgs.map((org) => [org.id, org.name]));
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        organizationName: p.organization_id ? orgName.get(p.organization_id) || null : null,
      }));
    },
    async listEvents(projectId) {
      return requireData(
        await db
          .from("events")
          .select(EVENT_COLUMNS)
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("event_date", { ascending: true, nullsFirst: false })
          .limit(200),
      );
    },
    async loadEventRow(eventId) {
      return requireData(await db.from("events").select(EVENT_COLUMNS).eq("id", eventId).is("deleted_at", null).maybeSingle());
    },
  };
}

// Runs the RPC as the signed-in user so auth.uid() and the function's own access check apply.
export async function ensureMembership(accessToken, projectId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return null;
  const client = createClient(url, key, {
    db: { schema: "events" },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("rbac_ensure_membership", { p_project_id: projectId });
  if (error) {
    console.error("[control.ensureMembership]", error.message);
    return null;
  }
  return data ?? null;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test lib/control/events.test.js lib/control/profile.test.js lib/control/http.test.js "lib/operations/**/*.test.js"`
Expected: PASS. 4 + 7 + 4 new tests, and the operations baseline unchanged.

- [ ] **Step 9: Lint**

Run: `npx eslint lib/control lib/operations/server/access.js`
Expected: no errors.

---

### Task 5: Control routes and CORS

**Files:**
- Create: `app/api/control/me/route.js`
- Create: `app/api/control/projects/[projectId]/events/route.js`
- Create: `app/api/control/events/[eventId]/route.js`
- Modify: `proxy.js` (matcher and comment)

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `GET /api/control/me` returns `{ projects: ControlProject[] }`.
  - `GET /api/control/projects/:projectId/events` returns `{ events: ControlEvent[] }`. It returns 404 when the user is not in the project, and 403 without `events.events.view`.
  - `GET /api/control/events/:eventId` returns `{ event: ControlEvent, projectId, can }`.
  - All three return 401 without a valid Bearer team token.

- [ ] **Step 1: Write the routes**

Create `app/api/control/me/route.js`:

```js
import { controlBoundary, ensureMembership } from "@/lib/control/boundary";
import { withControl } from "@/lib/control/http";
import { loadControlProfile } from "@/lib/control/profile";

// Every project this team member can operate, with their role and which Control tools it unlocks.
export async function GET(request) {
  return withControl(request, async ({ principal, token }) =>
    loadControlProfile({
      principal,
      boundary: await controlBoundary(),
      ensureMembership: (projectId) => ensureMembership(token, projectId),
    }),
  );
}
```

Create `app/api/control/projects/[projectId]/events/route.js`:

```js
import { controlBoundary } from "@/lib/control/boundary";
import { arrangeEvents } from "@/lib/control/events";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { authorizeProjectAction } from "@/lib/operations/server/access";

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async ({ principal }) => {
    const boundary = await controlBoundary();
    await authorizeProjectAction(principal, projectId, CONTROL_CAPABILITIES.events, boundary);
    return { events: arrangeEvents(await boundary.listEvents(projectId), new Date()) };
  });
}
```

Create `app/api/control/events/[eventId]/route.js`:

```js
import { controlBoundary } from "@/lib/control/boundary";
import { withControl } from "@/lib/control/http";
import { loadControlEvent } from "@/lib/control/profile";

// One event plus what this team member may do at it, with event-scoped grants resolved against it.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async ({ principal }) =>
    loadControlEvent({ principal, eventId, boundary: await controlBoundary() }),
  );
}
```

- [ ] **Step 2: Extend CORS to Control (Expo web preview only; native is unaffected)**

In `proxy.js`, replace:

```js
// The mobile app's web preview calls the portal API cross-origin, so these
// routes answer preflights and send CORS headers. Native apps are unaffected.
```

with:

```js
// The mobile app's web preview calls the portal and Control APIs cross-origin, so these
// routes answer preflights and send CORS headers. Native apps are unaffected.
```

Replace:

```js
  matcher: ["/api/portal/:path*", "/events/api/portal/:path*"],
```

with:

```js
  matcher: [
    "/api/portal/:path*",
    "/events/api/portal/:path*",
    "/api/control/:path*",
    "/events/api/control/:path*",
  ],
```

- [ ] **Step 3: Lint**

Run: `npx eslint app/api/control proxy.js`
Expected: no errors.

- [ ] **Step 4: Smoke-test the 401 path locally**

With `npm run dev` running, run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/control/me`
Expected: `401`.

---

### Task 6: Browser hand-off returns to the mobile app

**Files:**
- Create: `lib/desktop/handoff_link.js`
- Test: `lib/desktop/handoff_link.test.js`
- Modify: `components/desktop/desktop_return.jsx` (use the shared builder)

**Interfaces:**
- Produces:
  - `MOBILE_STATE_PREFIX = "m_"`
  - `MOBILE_RETURN = "geigerevents://team-auth"`
  - `handoffDeepLink({ error, tokenHash, type, state, email }) → string`

- [ ] **Step 1: Write the failing test**

Create `lib/desktop/handoff_link.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { handoffDeepLink } from "./handoff_link.js";

const ok = { error: "", tokenHash: "th", type: "magiclink", email: "a@b.test" };

test("desktop states keep returning to the desktop shell", () => {
  const link = handoffDeepLink({ ...ok, state: "A".repeat(40) });
  assert.ok(link.startsWith("geiger-events://auth?"));
  assert.equal(new URLSearchParams(link.split("?")[1]).get("token_hash"), "th");
});

test("an m_ state returns to the mobile app", () => {
  const link = handoffDeepLink({ ...ok, state: `m_${"b".repeat(40)}` });
  assert.ok(link.startsWith("geigerevents://team-auth?"));
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("state"), `m_${"b".repeat(40)}`);
  assert.equal(params.get("type"), "magiclink");
});

test("errors carry only the error and state", () => {
  const link = handoffDeepLink({ error: "mint_failed", tokenHash: "", type: "", email: "", state: `m_${"c".repeat(40)}` });
  const params = new URLSearchParams(link.split("?")[1]);
  assert.deepEqual([...params.keys()].sort(), ["error", "state"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/desktop/handoff_link.test.js`
Expected: FAIL with `Cannot find module` … `handoff_link.js`.

- [ ] **Step 3: Write the builder**

Create `lib/desktop/handoff_link.js`:

```js
import { DEEP_LINK_SCHEME } from "./config.js";

// The mobile app starts its browser sign-in with an "m_" state, so the same handoff (and dash's next= allowlist) can return to it.
export const MOBILE_STATE_PREFIX = "m_";
export const MOBILE_RETURN = "geigerevents://team-auth";

export function handoffDeepLink(handoff) {
  const query = handoff.error
    ? { error: handoff.error, state: handoff.state }
    : { token_hash: handoff.tokenHash, type: handoff.type, state: handoff.state, email: handoff.email };
  const base = handoff.state.startsWith(MOBILE_STATE_PREFIX) ? MOBILE_RETURN : `${DEEP_LINK_SCHEME}://auth`;
  return `${base}?${new URLSearchParams(query).toString()}`;
}
```

- [ ] **Step 4: Use it on the return page**

In `components/desktop/desktop_return.jsx`:

- Replace `import { DEEP_LINK_SCHEME, suiteUrl } from "@/lib/desktop/config";` with:
  ```jsx
  import { suiteUrl } from "@/lib/desktop/config";
  import { handoffDeepLink } from "@/lib/desktop/handoff_link";
  ```
- Delete the whole `function deepLinkFor(handoff) { … }` (7 lines).
- Replace `const deepLink = handoff ? deepLinkFor(handoff) : "";` with:
  ```jsx
  const deepLink = handoff ? handoffDeepLink(handoff) : "";
  ```

- [ ] **Step 5: Run the test and lint**

Run: `node --test lib/desktop/handoff_link.test.js`
Expected: PASS, 3 tests.

Run: `npx eslint lib/desktop components/desktop/desktop_return.jsx`
Expected: no errors.

---

### Task 7: Mobile team auth (Auth-only Supabase client)

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json` (via `npx expo install expo-crypto`)
- Modify: `mobile/app.json` (`extra.supabaseUrl`, `extra.supabaseAnonKey`, `extra.suiteOrigin`)
- Modify: `mobile/AGENTS.md` (Supabase rule, API contract)
- Create: `mobile/src/lib/secure_chunks.ts`
- Create: `mobile/src/lib/team_auth.ts`

**Interfaces:**
- Produces:
  - `teamAuth: SupabaseAuthClient | null`
  - `teamAuthConfigured: boolean`
  - `SUITE_ORIGIN: string`
  - `type TeamAuthResult = { ok: true } | { ok: false; error: string }`. An empty `error` means "user cancelled; show nothing".
  - `signInWithPassword(email, password)`
  - `signInWithBrowser()`
  - `signOutTeam()`
  - `teamAccessToken() → Promise<string|null>`

- [ ] **Step 1: Add `expo-crypto`**

Run: `cd mobile && npx expo install expo-crypto`
Expected: `package.json` gains `expo-crypto` pinned to the SDK 57 version, and `package-lock.json` updates.

Run: `cd mobile && npm ci --include=dev`
Expected: it completes. EAS runs `npm ci`, so a desynced lockfile fails the cloud build in seconds.

- [ ] **Step 2: Public Supabase settings in `app.json`**

Read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the repo-root `.env`. Both are public and already shipped in the web bundle. Add them to `mobile/app.json` under `expo.extra`, beside `apiBaseUrl`:

```json
      "apiBaseUrl": "https://geigerevents.vercel.app/events",
      "supabaseUrl": "<value of NEXT_PUBLIC_SUPABASE_URL>",
      "supabaseAnonKey": "<value of NEXT_PUBLIC_SUPABASE_ANON_KEY>",
      "suiteOrigin": "https://geiger.studio",
```

Never put `SUPABASE_SERVICE_ROLE_KEY` or any other non-`NEXT_PUBLIC_` value here.

- [ ] **Step 3: Update `mobile/AGENTS.md`**

Replace:

```md
This app is the buyer-facing members app. It is a **client of the Next.js portal
API** in the parent directory (`../app/api/portal/*`) — it never talks to
Supabase directly except for the chat Realtime subscription.
```

with:

```md
This app is the buyer-facing members app, plus **Control** for event teams. It is a
**client of the Next.js API** in the parent directory (`../app/api/portal/*` for
attendees, `../app/api/control/*` for Control). It never queries Supabase directly;
the only Supabase use is **Auth** for the team sign-in (`src/lib/team_auth.ts`).
```

In the `## API contract` list, add this bullet after the 401 bullet:

```md
- Control uses a **separate** team session (Supabase Auth, chunked into SecureStore)
  sent as the Bearer token to `/api/control/*` via `src/lib/control_api.ts`. A 401
  there never signs the attendee out, and the attendee token is never sent to Control.
```

- [ ] **Step 4: Write the chunked SecureStore adapter**

Create `mobile/src/lib/secure_chunks.ts`:

```ts
import * as SecureStore from "expo-secure-store";

// SecureStore warns above ~2 KB and a Supabase session is larger, so values are split across numbered keys.
const CHUNK = 1800;

async function removeItem(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  await SecureStore.deleteItemAsync(`${key}.n`);
}

async function getItem(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  if (!count) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  );
  return parts.some((part) => part === null) ? null : parts.join("");
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
  await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)));
  await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
}

export const secureChunkStorage = { getItem, setItem, removeItem };
```

- [ ] **Step 5: Write the team auth module**

Create `mobile/src/lib/team_auth.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";

import { secureChunkStorage } from "@/lib/secure_chunks";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || text(extra.supabaseUrl);
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || text(extra.supabaseAnonKey);

export const SUITE_ORIGIN = (text(extra.suiteOrigin) || "https://geiger.studio").replace(/\/+$/, "");

// Must match MOBILE_STATE_PREFIX / MOBILE_RETURN in ../../lib/desktop/handoff_link.js.
const STATE_PREFIX = "m_";
const RETURN_URL = "geigerevents://team-auth";

export const teamAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Auth only: team data always comes from /api/control/*, never from Supabase tables.
export const teamAuth = teamAuthConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === "web" ? undefined : secureChunkStorage,
        storageKey: "geiger.team.session",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }).auth
  : null;

// Supabase only refreshes tokens while the app is in the foreground.
if (teamAuth) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void teamAuth.startAutoRefresh();
    else void teamAuth.stopAutoRefresh();
  });
}

export type TeamAuthResult = { ok: true } | { ok: false; error: string };

const NOT_CONFIGURED: TeamAuthResult = { ok: false, error: "Team sign-in isn't set up in this build." };

export async function signInWithPassword(email: string, password: string): Promise<TeamAuthResult> {
  if (!teamAuth) return NOT_CONFIGURED;
  const { error } = await teamAuth.signInWithPassword({ email: email.trim(), password });
  if (!error) return { ok: true };
  return {
    ok: false,
    error:
      error.status === 400
        ? "That email and password don't match a Geiger account."
        : "Couldn't sign in. Check your connection and try again.",
  };
}

// Google, GitHub, SSO and passkeys all run on geiger.studio; the desktop handoff mints a one-time token and deep-links it back here.
export async function signInWithBrowser(): Promise<TeamAuthResult> {
  if (!teamAuth) return NOT_CONFIGURED;
  const state = `${STATE_PREFIX}${Crypto.randomUUID().replace(/-/g, "")}${Crypto.randomUUID().slice(0, 8)}`;
  const url = `${SUITE_ORIGIN}/events/desktop/handoff?state=${encodeURIComponent(state)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  if (result.type !== "success") return { ok: false, error: "" };

  const params = new URL(result.url).searchParams;
  if (params.get("state") !== state) return { ok: false, error: "That sign-in didn't come from this request. Try again." };
  const tokenHash = params.get("token_hash");
  if (params.get("error") || !tokenHash) return { ok: false, error: "The browser sign-in didn't finish. Try again." };

  const { data, error } = await teamAuth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data.session) return { ok: false, error: "That sign-in link expired. Try again." };
  return { ok: true };
}

export async function signOutTeam(): Promise<void> {
  await teamAuth?.signOut({ scope: "local" });
}

export async function teamAccessToken(): Promise<string | null> {
  if (!teamAuth) return null;
  const { data } = await teamAuth.getSession();
  return data.session?.access_token ?? null;
}
```

- [ ] **Step 6: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

If TypeScript rejects `storage: undefined` under `exactOptionalPropertyTypes`, build the options object conditionally instead. Do not add `any`.

---

### Task 8: Control API client and types

**Files:**
- Modify: `mobile/src/lib/api.ts` (`onUnauthorized` option)
- Create: `mobile/src/lib/control_api.ts`
- Modify: `mobile/src/types/portal.ts` (append types)

**Interfaces:**
- Produces:
  - `ApiInit.onUnauthorized?: "signOut" | "ignore"` (default `"signOut"`)
  - `controlApi<T>(path, init?) → Promise<ApiResult<T>>`
  - types `RolesHint`, `ControlCapability`, `ControlProject`, `ControlProfile`, `ControlEvent`, `ControlEventDetail`

- [ ] **Step 1: Let a caller opt out of the attendee sign-out on 401**

In `mobile/src/lib/api.ts`, replace:

```ts
type ApiInit = {
  method?: string;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};
```

with:

```ts
type ApiInit = {
  method?: string;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  // Control calls carry the team token; their 401 must not sign the attendee out.
  onUnauthorized?: "signOut" | "ignore";
};
```

Replace:

```ts
  if (res.status === 401) {
    unauthorizedHandler?.();
```

with:

```ts
  if (res.status === 401) {
    if (init.onUnauthorized !== "ignore") unauthorizedHandler?.();
```

- [ ] **Step 2: Write the Control client**

Create `mobile/src/lib/control_api.ts`:

```ts
import { api, type ApiResult } from "@/lib/api";
import { teamAccessToken } from "@/lib/team_auth";

// Every Control request carries the team session — never the attendee token.
export async function controlApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const token = await teamAccessToken();
  if (!token) return { ok: false, error: "Sign in to Control to continue.", status: 401 };
  return api<T>(path, { ...init, token, onUnauthorized: "ignore" });
}
```

- [ ] **Step 3: Add the types**

Append to `mobile/src/types/portal.ts`:

```ts
export type RolesHint = {
  team: {
    available: boolean;
    invited: boolean;
    organizations: { id: string | null; name: string; projectCount: number }[];
  };
  crew: { eventId: string; eventName: string; eventDate: string | null; roles: string[] }[];
};

export type ControlCapability = "events" | "checkIn" | "guests" | "orders" | "analytics" | "operations";

export type ControlProject = {
  id: string;
  name: string;
  organizationName: string | null;
  role: { key: string; name: string } | null;
  can: Record<ControlCapability, boolean>;
};

export type ControlProfile = { projects: ControlProject[] };

export type ControlEvent = {
  id: string;
  name: string;
  status: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  city: string | null;
  timezone: string;
  capacity: number;
  sold: number;
  coverUrl: string | null;
  when: "today" | "upcoming" | "unscheduled" | "past";
};

export type ControlEventDetail = {
  event: ControlEvent;
  projectId: string;
  can: Record<ControlCapability, boolean>;
};
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

---

### Task 9: Control state provider

**Files:**
- Create: `mobile/src/state/control.tsx`
- Modify: `mobile/src/app/_layout.tsx` (mount the provider; wait for it before hiding the splash)

**Interfaces:**
- Consumes: `team_auth.ts` (Task 7), `controlApi` and types (Task 8), `api` and `useSession`.
- Produces: `ControlProvider`, and `useControl()` returning:
  ```ts
  {
    teamStatus: "loading" | "signedIn" | "signedOut";
    teamEmail: string | null;
    hint: RolesHint | null;
    profile: ControlProfile | null;
    profileError: string | null;
    mode: AppMode;
    modeReady: boolean;
    setMode(next: AppMode): Promise<void>;
    signInWithPassword(email: string, password: string): Promise<TeamAuthResult>;
    signInWithBrowser(): Promise<TeamAuthResult>;
    signOutTeam(): Promise<void>;
    refreshProfile(): Promise<void>;
  }
  ```
  It also exports `type AppMode = "attendee" | "control"`.

- [ ] **Step 1: Write the provider**

Create `mobile/src/state/control.tsx`:

```tsx
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { controlApi } from "@/lib/control_api";
import * as team from "@/lib/team_auth";
import { useSession } from "@/state/session";
import type { ControlProfile, RolesHint } from "@/types/portal";

export type AppMode = "attendee" | "control";
type TeamStatus = "loading" | "signedIn" | "signedOut";

const MODE_KEY = "geiger.app.mode";

type ControlState = {
  teamStatus: TeamStatus;
  teamEmail: string | null;
  hint: RolesHint | null;
  profile: ControlProfile | null;
  profileError: string | null;
  mode: AppMode;
  modeReady: boolean;
  setMode: (next: AppMode) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<team.TeamAuthResult>;
  signInWithBrowser: () => Promise<team.TeamAuthResult>;
  signOutTeam: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const ControlContext = createContext<ControlState | null>(null);

export function ControlProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useSession();
  const [teamStatus, setTeamStatus] = useState<TeamStatus>(team.teamAuth ? "loading" : "signedOut");
  const [teamEmail, setTeamEmail] = useState<string | null>(null);
  const [hintState, setHintState] = useState<{ token: string; hint: RolesHint } | null>(null);
  const [profile, setProfile] = useState<ControlProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [storedMode, setStoredMode] = useState<AppMode | null>(null);

  // Mirror the Supabase Auth session; it persists and refreshes itself.
  useEffect(() => {
    const auth = team.teamAuth;
    if (!auth) return;
    let active = true;
    void auth.getSession().then(({ data }) => {
      if (!active) return;
      setTeamEmail(data.session?.user.email ?? null);
      setTeamStatus(data.session ? "signedIn" : "signedOut");
    });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setTeamEmail(session?.user.email ?? null);
      setTeamStatus(session ? "signedIn" : "signedOut");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void SecureStore.getItemAsync(MODE_KEY)
      .catch(() => null)
      .then((stored) => setStoredMode(stored === "control" ? "control" : "attendee"));
  }, []);

  // Detection rides on the attendee session: it can only suggest Control, never open it.
  useEffect(() => {
    if (status !== "authed" || !token) return;
    let active = true;
    void api<RolesHint>("/api/portal/roles", { token }).then((res) => {
      if (active && res.ok) setHintState({ token, hint: res.data });
    });
    return () => {
      active = false;
    };
  }, [status, token]);

  const refreshProfile = useCallback(async () => {
    const res = await controlApi<ControlProfile>("/api/control/me");
    if (res.ok) {
      setProfile(res.data);
      setProfileError(null);
    } else {
      setProfileError(res.error);
    }
  }, []);

  useEffect(() => {
    if (teamStatus === "signedIn") void refreshProfile();
  }, [teamStatus, refreshProfile]);

  const setMode = useCallback(async (next: AppMode) => {
    setStoredMode(next);
    await SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined);
  }, []);

  const signOutTeam = useCallback(async () => {
    await team.signOutTeam();
    setProfile(null);
    await setMode("attendee");
  }, [setMode]);

  const hint = status === "authed" && hintState && hintState.token === token ? hintState.hint : null;
  const visibleProfile = teamStatus === "signedIn" ? profile : null;

  const value = useMemo<ControlState>(
    () => ({
      teamStatus,
      teamEmail,
      hint,
      profile: visibleProfile,
      profileError: teamStatus === "signedIn" ? profileError : null,
      mode: storedMode ?? "attendee",
      modeReady: storedMode !== null,
      setMode,
      signInWithPassword: team.signInWithPassword,
      signInWithBrowser: team.signInWithBrowser,
      signOutTeam,
      refreshProfile,
    }),
    [teamStatus, teamEmail, hint, visibleProfile, profileError, storedMode, setMode, signOutTeam, refreshProfile],
  );

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControl(): ControlState {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error("useControl must be used within a ControlProvider");
  return ctx;
}
```

- [ ] **Step 2: Mount it and hold the splash until it is ready**

In `mobile/src/app/_layout.tsx`, add `import { ControlProvider, useControl } from "@/state/control";` after the `AppConfigProvider` import (Phase 1).

Replace:

```tsx
          <SessionProvider>
            <AppConfigProvider>
```

with:

```tsx
          <SessionProvider>
            <ControlProvider>
            <AppConfigProvider>
```

Replace:

```tsx
            </AppConfigProvider>
          </SessionProvider>
```

with:

```tsx
            </AppConfigProvider>
            </ControlProvider>
          </SessionProvider>
```

Then re-indent the nested block by two spaces so the JSX tree reads correctly.

In `RootNavigator`, replace:

```tsx
  const { status } = useSession();
  const fontsReady = useAppFonts();
```

with:

```tsx
  const { status } = useSession();
  const { teamStatus, modeReady } = useControl();
  const fontsReady = useAppFonts();
  const sessionsReady = status !== "loading" && teamStatus !== "loading" && modeReady;
```

and replace `<Splash ready={status !== "loading" && fontsReady}` with:

```tsx
<Splash ready={sessionsReady && fontsReady}
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

Run (root): `npm run lint:mobile`
Expected: no new errors. Every state set in these effects happens after an `await`/`.then`; if `react-hooks/set-state-in-effect` still fires, wrap that one effect with the same disable/enable comment pair `src/state/data.tsx` uses.

---

### Task 10: Routing and the team sign-in screen

**Files:**
- Modify: `mobile/src/app/index.tsx`
- Modify: `mobile/src/app/(app)/_layout.tsx` (guest redirect)
- Modify: `mobile/src/app/_layout.tsx` (register `(control)` and `team-sign-in`)
- Modify: `mobile/src/app/(auth)/sign-in.tsx` (team link)
- Create: `mobile/src/app/team-sign-in.tsx`

**Interfaces:**
- Consumes: `useControl()` (Task 9), `useSession()`.
- Produces: the routes `/team-sign-in` and `/(control)`. The latter's screens come in Task 11.

- [ ] **Step 1: The entry route picks the mode**

Replace the whole contents of `mobile/src/app/index.tsx` with:

```tsx
import { Redirect } from "expo-router";
import React from "react";

import { useControl } from "@/state/control";
import { useSession } from "@/state/session";

export default function Index() {
  const { status } = useSession();
  const { teamStatus, mode, modeReady } = useControl();
  if (status === "loading" || teamStatus === "loading" || !modeReady) return null;

  const team = teamStatus === "signedIn";
  // Control when it was the last mode, or when the team account is the only one signed in.
  if (team && (mode === "control" || status !== "authed")) return <Redirect href="/(control)" />;
  if (status === "authed") return <Redirect href="/(app)/home" />;
  return <Redirect href="/(auth)/sign-in" />;
}
```

- [ ] **Step 2: Attendee tabs send a team-only user to Control instead of sign-in**

In `mobile/src/app/(app)/_layout.tsx`, add `import { useControl } from "@/state/control";` after the `useSession` import. Then replace:

```tsx
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;
```

with:

```tsx
  const { status } = useSession();
  const { teamStatus } = useControl();
  const insets = useSafeAreaInsets();
  if (status === "guest") {
    return <Redirect href={teamStatus === "signedIn" ? "/(control)" : "/(auth)/sign-in"} />;
  }
```

- [ ] **Step 3: Register the new routes in the root stack**

In `mobile/src/app/_layout.tsx`, replace:

```tsx
        <Stack.Screen name="(app)" />
        <Stack.Screen name="pass/[id]" options={{ animation: "fade_from_bottom" }} />
```

with:

```tsx
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(control)" />
        <Stack.Screen name="team-sign-in" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="pass/[id]" options={{ animation: "fade_from_bottom" }} />
```

- [ ] **Step 4: Team link on the attendee sign-in**

In `mobile/src/app/(auth)/sign-in.tsx`, replace:

```tsx
          </Animated.View>
        </View>

        <View style={styles.promises}>
```

with:

```tsx
          </Animated.View>

          <View style={styles.teamLink}>
            <TextLink
              label="On an event team? Sign in to Control"
              onPress={() => router.push("/team-sign-in")}
            />
          </View>
        </View>

        <View style={styles.promises}>
```

Then add this entry to its `styles` object, right after the `link` entry:

```tsx
  teamLink: {
    marginTop: spacing.xl,
  },
```

- [ ] **Step 5: Write the team sign-in screen**

It lives at the root, outside `(auth)` and `(app)`, so a signed-in attendee can open it from More.

Create `mobile/src/app/team-sign-in.tsx`:

```tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { teamOrgsLabel } from "@/lib/control_hint";
import type { TeamAuthResult } from "@/lib/team_auth";
import { useControl } from "@/state/control";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";

export default function TeamSignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { member } = useSession();
  const control = useControl();
  const { error } = useToast();
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "browser" | null>(null);

  const orgs = control.hint ? teamOrgsLabel(control.hint) : "";

  const finish = async (result: TeamAuthResult) => {
    if (!result.ok) {
      if (result.error) error(result.error);
      return;
    }
    await control.setMode("control");
    router.replace("/(control)");
  };

  const submitPassword = async () => {
    if (!email.trim() || !password) return error("Enter your Geiger email and password.");
    setBusy("password");
    const result = await control.signInWithPassword(email, password);
    setBusy(null);
    await finish(result);
  };

  const continueInBrowser = async () => {
    setBusy("browser");
    const result = await control.signInWithBrowser();
    setBusy(null);
    await finish(result);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Control" />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.headline}>Run your events{"\n"}from your phone.</Text>
        <Text style={styles.lede}>
          {orgs ? `You're on the team at ${orgs}. ` : ""}
          Sign in with your Geiger account — the one you use for the dashboard.
        </Text>

        <View style={styles.form}>
          <Field label="Email">
            <Input
              leftIcon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <Input
              leftIcon="shield"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={submitPassword}
              returnKeyType="go"
            />
          </Field>
          <Button
            title="Sign in to Control"
            onPress={submitPassword}
            loading={busy === "password"}
            disabled={busy !== null}
            fullWidth
          />
          <Text style={styles.or}>or</Text>
          <Button
            title="Continue with Google, SSO or passkey"
            icon="external-link"
            variant="secondary"
            onPress={continueInBrowser}
            loading={busy === "browser"}
            disabled={busy !== null}
            fullWidth
          />
        </View>

        <Text style={styles.note}>
          Your tickets stay signed in. Control has its own sign-in, and you can switch back any time.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  headline: {
    ...type.hero,
    color: colors.foreground,
  },
  lede: {
    ...type.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  or: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
  },
});
```

- [ ] **Step 6: The organisation label helper**

Create `mobile/src/lib/control_hint.ts`:

```ts
import type { RolesHint } from "@/types/portal";

// "Acme", "Acme and Beta", or "Acme, Beta and 2 more".
export function teamOrgsLabel(hint: RolesHint): string {
  const names = hint.team.organizations.map((org) => org.name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
```

- [ ] **Step 7: Typecheck after Task 11**

Typed routes reject `"/(control)"` until `app/(control)/index.tsx` exists. Tasks 10 and 11 are therefore reviewed together: run `cd mobile && npx tsc --noEmit` at the end of Task 11 and expect exit 0 there. Running it now is expected to report only the `/(control)` route errors.

---

### Task 11: Control screens

**Files:**
- Modify: `mobile/src/components/ui/icons.tsx` (register `chart-column`)
- Create: `mobile/src/app/(control)/_layout.tsx`
- Create: `mobile/src/app/(control)/index.tsx`
- Create: `mobile/src/app/(control)/event/[id].tsx`
- Create: `mobile/src/components/control/ProjectSection.tsx`
- Create: `mobile/src/lib/control_meta.ts`

**Interfaces:**
- Consumes: `useControl()`, `controlApi`, `ControlEvent`, `ControlEventDetail`, `ControlProject`, `SUITE_ORIGIN`.
- Produces:
  - `/(control)` (Control home)
  - `/(control)/event/[id]`
  - `CAPABILITY_META: Record<ControlCapability, { icon: IconName; label: string; detail: string }>`
  - `whenLabel(event: ControlEvent): string`

- [ ] **Step 1: Register the analytics icon**

Run: `ls mobile/node_modules/lucide-react-native/dist/esm/icons/chart-column.js`
Expected: the file exists. If it does not, use the existing `monitor` icon below instead of `chart-column`.

In `mobile/src/components/ui/icons.tsx`:

- Add `import ChartColumn from "lucide-react-native/icons/chart-column";` after the `Calendar` import.
- Add `"chart-column": ChartColumn,` to `ICONS` after `calendar: Calendar,`. Keep the entries alphabetical, as the file does.

- [ ] **Step 2: Shared labels**

Create `mobile/src/lib/control_meta.ts`:

```ts
import type { IconName } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import type { ControlCapability, ControlEvent } from "@/types/portal";

export const CAPABILITY_META: Record<ControlCapability, { icon: IconName; label: string; detail: string }> = {
  events: { icon: "calendar", label: "Events", detail: "See this project's events" },
  checkIn: { icon: "qr-code", label: "Check-in", detail: "Admit guests at the door" },
  guests: { icon: "users", label: "Guests", detail: "Look up attendees" },
  orders: { icon: "shopping-bag", label: "Orders", detail: "View orders and refunds" },
  analytics: { icon: "chart-column", label: "Analytics", detail: "Sales and attendance numbers" },
  operations: { icon: "briefcase", label: "Operations", detail: "Run the event workspace" },
};

export function whenLabel(event: ControlEvent): string {
  if (event.when === "today") return event.time ? `Today · ${event.time}` : "Today";
  if (event.when === "unscheduled") return "No date yet";
  return fmtDate(event.date);
}
```

- [ ] **Step 3: Control stack layout**

Create `mobile/src/app/(control)/_layout.tsx`:

```tsx
import { Redirect, Stack } from "expo-router";
import React from "react";

import { useControl } from "@/state/control";
import { colors } from "@/theme/tokens";

export default function ControlLayout() {
  const { teamStatus } = useControl();
  // Signing out of the team (here or on another device) drops back to whatever the entry route picks.
  if (teamStatus === "signedOut") return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
```

- [ ] **Step 4: Project section (one project's events)**

Create `mobile/src/components/control/ProjectSection.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { controlApi } from "@/lib/control_api";
import { whenLabel } from "@/lib/control_meta";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlProject } from "@/types/portal";

type Props = {
  project: ControlProject;
  onOpenEvent: (event: ControlEvent) => void;
};

export function ProjectSection({ project, onOpenEvent }: Props) {
  const [events, setEvents] = useState<ControlEvent[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await controlApi<{ events: ControlEvent[] }>(`/api/control/projects/${project.id}/events`);
    if (res.ok) {
      setEvents(res.data.events);
      setFailed(null);
    } else {
      setFailed(res.error);
    }
  }, [project.id]);

  useEffect(() => {
    if (project.can.events) void load();
  }, [project.can.events, load]);

  const header = (
    <SectionTitle action={<Pill label={project.role?.name ?? "No role yet"} tone="neutral" variant="outline" />}>
      {project.name}
    </SectionTitle>
  );

  if (!project.role || !project.can.events) {
    return (
      <View style={styles.section}>
        {header}
        <Card tone="subtle">
          <Text style={styles.note}>
            {project.role
              ? "Your role here doesn't include events."
              : "Open this project in the dashboard once to set up your access."}
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {header}
      {failed ? (
        <Card tone="subtle">
          <View style={styles.failed}>
            <Text style={styles.note}>{failed}</Text>
            <Button title="Try again" size="sm" variant="secondary" onPress={() => void load()} />
          </View>
        </Card>
      ) : events === null ? (
        <SkeletonList rows={2} variant="divided" />
      ) : !events.length ? (
        <Card tone="subtle">
          <Text style={styles.note}>No events in this project yet.</Text>
        </Card>
      ) : (
        <View style={styles.group}>
          {events.map((event, i) => (
            <ListRow
              key={event.id}
              leading={<IconTile icon="calendar" size={34} tone={event.when === "today" ? "success" : "neutral"} />}
              title={event.name}
              subtitle={[whenLabel(event), event.venue].filter(Boolean).join(" · ")}
              onPress={() => onOpenEvent(event)}
              divider={i < events.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
  failed: {
    gap: spacing.md,
    alignItems: "flex-start",
  },
});
```

- [ ] **Step 5: Control home**

Create `mobile/src/app/(control)/index.tsx`:

```tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProjectSection } from "@/components/control/ProjectSection";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControl } from "@/state/control";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

export default function ControlHomeScreen() {
  const router = useRouter();
  const { status } = useSession();
  const { profile, profileError, refreshProfile, teamEmail, setMode, signOutTeam } = useControl();
  const [confirmOut, setConfirmOut] = useState(false);

  const toAttendee = async () => {
    await setMode("attendee");
    router.replace("/(app)/home");
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title="Control"
        right={
          status === "authed" ? (
            <Button title="My tickets" size="sm" variant="secondary" icon="credit-card" onPress={() => void toAttendee()} />
          ) : undefined
        }
      />

      {profileError && !profile ? (
        <EmptyState
          icon="circle-alert"
          title="Couldn't load your projects"
          message={profileError}
          actionLabel="Try again"
          onAction={() => void refreshProfile()}
        />
      ) : !profile ? (
        <SkeletonList rows={3} variant="card" />
      ) : !profile.projects.length ? (
        <EmptyState
          icon="briefcase"
          title="No event teams yet"
          message={`${teamEmail ?? "This account"} isn't on any project yet. Ask an organiser to invite you, then check again.`}
          actionLabel="Check again"
          onAction={() => void refreshProfile()}
        />
      ) : (
        profile.projects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            onOpenEvent={(event) => router.push({ pathname: "/(control)/event/[id]", params: { id: event.id } })}
          />
        ))
      )}

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="shield" size={34} />}
          title="Signed in to Control"
          subtitle={teamEmail ?? undefined}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out of Control"
          onPress={() => setConfirmOut(true)}
          chevron={false}
          divider={false}
        />
      </View>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out of Control?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {status === "authed" ? "Your tickets stay signed in." : "You'll need to sign in again to use Control."}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmOut(false)} />
            <Button
              title="Sign out"
              variant="destructive"
              onPress={() => {
                setConfirmOut(false);
                void signOutTeam();
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
```

`ListRow` takes `subtitle?: string`. Passing `undefined` is fine under strict mode; if `exactOptionalPropertyTypes` complains, spread it conditionally.

- [ ] **Step 6: Control event screen**

Create `mobile/src/app/(control)/event/[id].tsx`:

```tsx
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { controlApi } from "@/lib/control_api";
import { CAPABILITY_META, whenLabel } from "@/lib/control_meta";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlCapability, ControlEventDetail } from "@/types/portal";

const ACCESS_ORDER: ControlCapability[] = ["checkIn", "guests", "orders", "analytics", "operations"];

export default function ControlEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ControlEventDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await controlApi<ControlEventDetail>(`/api/control/events/${id}`);
    if (res.ok) {
      setDetail(res.data);
      setFailed(null);
    } else {
      setFailed(res.error);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const access = detail ? ACCESS_ORDER.filter((key) => detail.can[key]) : [];

  return (
    <Screen scroll header={<ScreenHeader title="Event" />}>
      {failed && !detail ? (
        <EmptyState icon="circle-alert" title="Couldn't open this event" message={failed} actionLabel="Try again" onAction={() => void load()} />
      ) : !detail ? (
        <SkeletonList rows={3} variant="card" />
      ) : (
        <View style={styles.stack}>
          <Card>
            <Text style={styles.name}>{detail.event.name}</Text>
            <Text style={styles.meta}>
              {[whenLabel(detail.event), detail.event.venue, detail.event.city].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.stats}>
              <Stat label="Sold" value={String(detail.event.sold)} />
              <Stat label="Capacity" value={detail.event.capacity ? String(detail.event.capacity) : "—"} />
              <Stat label="Status" value={detail.event.status} />
            </View>
          </Card>

          <View>
            <SectionTitle>Your access</SectionTitle>
            {access.length ? (
              <View style={styles.group}>
                {access.map((key, i) => (
                  <ListRow
                    key={key}
                    leading={<IconTile icon={CAPABILITY_META[key].icon} size={34} />}
                    title={CAPABILITY_META[key].label}
                    subtitle={CAPABILITY_META[key].detail}
                    divider={i < access.length - 1}
                  />
                ))}
              </View>
            ) : (
              <Card tone="subtle">
                <Text style={styles.meta}>Your role can see this event but has no tools here yet.</Text>
              </Card>
            )}
          </View>

          <Button
            title="Open in dashboard"
            icon="external-link"
            variant="secondary"
            onPress={() => void Linking.openURL(`${SUITE_ORIGIN}/events/project/${detail.projectId}`)}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
  },
  statValue: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
```

- [ ] **Step 7: Typecheck and lint**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0, including the typed route `"/(control)/event/[id]"`.

Run (root): `npm run lint:mobile`
Expected: no new errors.

---

### Task 12: Detection entry points (More and Home)

**Files:**
- Modify: `mobile/src/app/(app)/more/index.tsx` (the Phase 1 version: Team group)
- Create: `mobile/src/components/TeamCard.tsx`
- Modify: `mobile/src/app/(app)/home/index.tsx` (show the card)

**Interfaces:**
- Consumes: `useControl()`, `teamOrgsLabel`, `SUITE_ORIGIN`, `pluralize`.

- [ ] **Step 1: Team group at the top of More**

In `mobile/src/app/(app)/more/index.tsx`:

Replace `import { Pressable, StyleSheet, Text, View } from "react-native";` with:

```tsx
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
```

Replace `import { firstName } from "@/lib/format";` with:

```tsx
import { teamOrgsLabel } from "@/lib/control_hint";
import { firstName, pluralize } from "@/lib/format";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControl } from "@/state/control";
```

Replace:

```tsx
      <RowGroup rows={library} onGo={(href) => router.push(href)} />
```

with:

```tsx
      <TeamEntry />
      <RowGroup rows={library} onGo={(href) => router.push(href)} />
```

Add this component directly above `function RowGroup`:

```tsx
// Only a hint until the team account signs in; tapping it never unlocks Control on the attendee session alone.
function TeamEntry() {
  const router = useRouter();
  const { teamStatus, hint, profile, setMode } = useControl();

  let row: { title: string; subtitle: string; onPress: () => void } | null = null;
  if (teamStatus === "signedIn") {
    const count = profile?.projects.length ?? 0;
    row = {
      title: "Switch to Control",
      subtitle: count ? `${count} ${pluralize(count, "project", "projects")}` : "Run your events from here",
      onPress: () => {
        void setMode("control").then(() => router.replace("/(control)"));
      },
    };
  } else if (hint?.team.available) {
    row = {
      title: "Sign in to Control",
      subtitle: `You're on the team at ${teamOrgsLabel(hint)}`,
      onPress: () => router.push("/team-sign-in"),
    };
  } else if (hint?.team.invited) {
    row = {
      title: "Team invitation waiting",
      subtitle: "Accept it on geiger.studio, then sign in to Control here",
      onPress: () => void Linking.openURL(SUITE_ORIGIN),
    };
  }
  if (!row) return null;

  return (
    <View style={styles.group}>
      <ListRow
        leading={<IconTile icon="briefcase" size={34} />}
        title={row.title}
        subtitle={row.subtitle}
        onPress={row.onPress}
        divider={false}
      />
    </View>
  );
}
```

- [ ] **Step 2: One-time Home card**

Create `mobile/src/components/TeamCard.tsx`:

```tsx
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { teamOrgsLabel } from "@/lib/control_hint";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";

const DISMISSED_KEY = "geiger.team.hint.dismissed";

// Shown once to an attendee the server recognises as a teammate; "Not now" is remembered on this device.
export function TeamCard() {
  const router = useRouter();
  const { hint, teamStatus } = useControl();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    void SecureStore.getItemAsync(DISMISSED_KEY)
      .catch(() => null)
      .then((value) => setDismissed(value === "1"));
  }, []);

  if (dismissed !== false || teamStatus !== "signedOut" || !hint?.team.available) return null;

  const dismiss = () => {
    setDismissed(true);
    void SecureStore.setItemAsync(DISMISSED_KEY, "1").catch(() => undefined);
  };

  return (
    <Card tone="subtle">
      <Text style={styles.title}>You&apos;re on the team at {teamOrgsLabel(hint)}</Text>
      <Text style={styles.body}>
        Open Control to see your events and your role. Your tickets stay right here.
      </Text>
      <View style={styles.actions}>
        <Button title="Not now" size="sm" variant="ghost" onPress={dismiss} />
        <Button title="Open Control" size="sm" onPress={() => router.push("/team-sign-in")} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
```

In `mobile/src/app/(app)/home/index.tsx`:

- Add `import { TeamCard } from "@/components/TeamCard";` after the `TicketQr` import.
- Replace:
  ```tsx
            {nextTicket ? (
              <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
  ```
  with:
  ```tsx
            <TeamCard />

            {nextTicket ? (
              <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
  ```

- [ ] **Step 3: Typecheck, lint, bundle**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

Run (root): `npm run lint:mobile`
Expected: no new errors.

Run: `cd mobile && npx expo export --platform android --output-dir ../.tmp-expo-export`, then delete `../.tmp-expo-export`.
Expected: "Exported" with no resolution errors. This proves `@supabase/supabase-js`, `expo-crypto` and the new routes bundle under Metro.

---

### Task 13: Hand-off

- [ ] **Step 1: Run every Phase 2 server test together**

Run: `node --test lib/control/detect.test.js lib/control/roles_route.test.js lib/control/events.test.js lib/control/profile.test.js lib/control/http.test.js lib/desktop/handoff_link.test.js "lib/operations/**/*.test.js"`
Expected: PASS, with 0 failures.

- [ ] **Step 2: Report to the user**

Report:

- **Before testing:** run `! npm run db:push` so `events.suite_access_for_email` exists. It needs a web deploy too, because the return page change and the new routes ship with geiger-events. **No geiger-dash change is needed.**
- **Check on a dev client:**
  1. Sign in as an attendee whose email is also a Geiger dashboard account. Home shows "You're on the team at …", and More shows "Sign in to Control".
  2. Sign in with password. Control lists your projects and your role on each, with events sorted today → upcoming → past.
  3. Open an event. "Your access" matches your role in Settings → Roles & Permissions.
  4. Tap "My tickets". You are back on attendee Home, still signed in. More now says "Switch to Control".
  5. Try "Continue with Google, SSO or passkey" with a Google-only account. The browser closes and lands in Control.
  6. Sign out of Control. The attendee stays signed in.
  7. Sign in to Control from the sign-in screen with an account that has no tickets. Control opens directly.
- **Not in this phase:**
  - The Check-in tool itself (Phase 3). Control shows access; tools come next.
  - Crew "Your event work" (Phase 4). The `crew` field is already returned by `/api/portal/roles`.
