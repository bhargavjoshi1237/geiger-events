# @geiger/rbac — Suite Authorization Package

**Date:** 2026-08-05
**Status:** Package built and **adopted by geiger-events** (steps 1–5 of 6)
**Repo:** https://github.com/bhargavjoshi1237/geiger-rbac — pinned by SHA like
`@geiger/ui` and `@geiger/orm`

---

## Why

Six suite apps (flow, docs, chat, comms, campaign, property) carry a
**byte-identical 67-line `lib/rbac.js`**, all still exporting the dead
localStorage-era `ROLE_STORAGE_KEY = "flow.workspace.roles"`. Events is the only
one that evolved past it — DB-backed roles, addon permission merging, a
five-role seed — and even there the loop was never closed:

- `components/internal/sidebar/sidebar.jsx:62` defaults `roleId = "workspace_owner"`, `roles = []`
- `components/EventsPlayground.jsx:52` renders `<AppSidebar>` without either prop
- `lib/rbac.js:134` returns `true` when `roles` is empty

So every permission check in the app currently returns `true`. The Roles &
Permissions matrix is a well-built editor over data nothing reads, and RLS on
those tables is still `using (true)`.

## What was decided

| Question | Decision |
|---|---|
| Granularity | Full ABAC: `resource.action` keys, developer-authored conditions, customer-authored scopes |
| Enforcement | All three — UI gating, server checks, **and** compiled Postgres RLS |
| Who authors conditions | Developers, in versioned config. Customers get scope only |
| Package edge | Pure core: engine + format + SQL compiler. No React, no Supabase, no UI |
| Storage | `public.roles` (shared definitions) + `<schema>.role_grants` (per-product assignment) |
| Precedence | Union, no explicit deny, Owner = a role holding `["*"]` |

### Grounding

The shape is the **embedded policy library** pattern — Casbin, CASL, Oso, Cedar.
A standalone service (OpenFGA/SpiceDB) centralises policy across many teams at
the cost of a network hop and a deployment; for one org shipping twelve Next.js
apps against one Postgres, embedded is correct.

Three corrections applied to the original idea:

1. **Decisions, not booleans.** `{allowed, code, reason, via}` — a boolean throws
   away the answer to "why can't I?", which is the question every permission
   system eventually has to answer.
2. **`resource.action`, not `view.thing`.** The existing catalog is nav-shaped
   and can only ever gate a sidebar.
3. **The engine must reach Postgres.** App-layer checks are UX; RLS is the
   security boundary. If the package defines the format it must also emit the
   predicate, or the two drift.

---

## Architecture

```
geiger-rbac.config.js        (app, versioned)   the trusted half: keys + conditions
        |
        v
   @geiger/rbac
   ├── keys.js        <product>.<resource>.<action>, trailing wildcards
   ├── condition.js   the closed grammar (10 ops + and/or/not), JS + SQL
   ├── scope.js       customer-owned narrowing; absence = no restriction
   ├── config.js      catalog definition, validation, merge
   ├── resolve.js     grants x roles x catalog -> Map<key, GrantEntry[]>
   ├── evaluate.js    the Decision
   ├── sql.js         toSqlPolicy / toSqlPredicate
   ├── schema.js      the storage DDL + rbac_allows()
   └── literal.js     identifier validation, literal encoding
        |
        +--> evaluate()      UI gating
        +--> evaluate()      server actions
        +--> toSqlPolicy()   RLS
```

### The key insight: RLS cannot be compiled per user

A policy is DDL written once, for every user who will ever be subject to it. So
the compiler does not emit "jack may refund orders a1 and c3". It emits a
predicate that asks the grant tables at query time:

```sql
using ( events.rbac_allows('events.order.refund', project_id, 'event', event_id)
        and status = 'pending' )
```

The first half is `security definer` (a user must be authorizable by grant rows
they cannot select) and `stable` (cacheable within a statement). The second half
is the permission's condition, compiled by the same grammar the browser runs.

### Null semantics

JS and SQL disagree about null by default, and a permission that says yes in the
UI and no in the database is worse than either answer. So: `ne` compiles to
`is distinct from`, `nin` explicitly admits nulls, and ordered comparisons refuse
null rather than coercing (`null >= 0` is `true` in JS, `null` in SQL).

### Safety

Identifiers are **validated against `/^[a-z][a-z0-9_]*$/` and rejected**, never
escaped around. Literals go through a narrow encoder — strings, finite numbers,
booleans, null; Dates and objects are refused because each has more than one
plausible SQL rendering. An RLS predicate has no bind parameters, so this is the
only defence, and a failed migration is recoverable where a permissive policy is
not.

---

## Storage

```
public.roles            shared. project_id, key, name, color,
                        permissions text[] (may span products), is_system, sort
<schema>.role_grants    per-product. project_id, user_id, role_id,
                        scope jsonb, status
public.rbac_key_matches(text[], text)   wildcard matching, mirroring keys.js
<schema>.rbac_allows(...)               grants + scope, in SQL
```

`downSql()` drops only the product's own objects. Rolling Events back must not
delete Flow's role definitions; dropping the shared tables is a separate,
deliberate migration.

---

## Status

Built and tested at `C:\Pro\geiger-rbac`: 10 source modules, 66 tests
(`node --test`, zero dependencies), all passing. Covers every operator in both
JS and SQL, null-semantics agreement, wildcard parity, scope logic, all eight
decision codes, and injection attempts against the compiler.

**Known gap:** the JS and SQL wildcard matchers are asserted against the same
specification, not a live Postgres. End-to-end verification of `rbac_allows` is
an integration test the adopting app owns.

---

## Adoption in geiger-events — what shipped

**Done (steps 1–5):**

1. `geiger-rbac.config.js` — 33 permissions: 23 nav sections + 1 addon
   (`events.affiliates.view`) as `events.<section>.view`, plus 9 real
   operations. Five system-role templates; Owner holds `"*"`.
2. `supabase/migrations/20260804211527_adopt_rbac.sql` — storage + backfill,
   **applied** (batch 5). Result: 7 projects, all with an Owner role; 6 active
   grants across 6 projects / 4 users.
3. `lib/supabase/rbac.js` — roles from `public.roles` (public-scoped client),
   grants from `events.role_grants` (the default `events` client).
   `lib/supabase/roles.js` deleted; both settings screens repointed.
4. `context/rbac-context.js` — resolves once per (project, user), exposes
   `can()` / `decide()`. **This closes the loop the sidebar left open.**
5. `AppSidebar` no longer takes `roleId`/`roles` props (nothing ever passed
   them). `useVisibleNav` reads real grants; ordering preserved — addons merged
   before the gate, personal visibility last.

**Not done (step 6), deliberately:** no product table's `using (true)` demo
policy was replaced. That is the step where a missing grant becomes a blank
screen rather than a hidden button, and it wants a human watching. Each table
gets its own migration built with `toSqlPolicy()`.

### The transition contract

`RbacProvider` sets `available = false` when the user holds no grants in the
project, and `can()` then returns **true** — exactly the old
`roleHasPermission()` behaviour, so adoption cannot lock anyone out of a screen
they could reach yesterday. Enforcement in the UI begins the moment a user has
at least one grant. Flip `FALLBACK_ALLOW` to `false` in
`context/rbac-context.js` once every member holds one.

### Notes from the backfill

- Two `events.roles` rows shared the key `owner` on one project (the old
  `ensureSystemRoles` only skipped seeding when a project had *no* roles), which
  the new `roles_project_key_uniq` rightly refused. The backfill now dedupes on
  (project, key), keeping the earliest, and **remaps** any member pointing at a
  dropped duplicate to the survivor so nobody loses access.
- One project (`My Project`) has no owner grant: its `created_by` is null and it
  has zero members. There is no user to grant to — correct outcome, not a gap.
- `public.rbac_key_matches` was checked against live Postgres and agrees with
  `keys.js` exactly, including that `events.order.*` does **not** match
  `events.orders.refund`.
