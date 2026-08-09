# Live Rooms & Measured Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Broadcast & On-demand screens from back-office registries into a live attendee surface with measured, non-fabricated metrics.

**Architecture:** Rooms stay rows in `events.conference_records` (the discriminated table the shared records kit renders generically). We promote `starts_at`/`ends_at` to real indexed columns, add one `events.room_presence` table for heartbeats, bind chat to rooms through the existing `events.chat_channels`, and put all room logic behind a new `lib/live/` module consumed by both the organiser screens and the members portal.

**Tech Stack:** Next.js 16 (App Router), Supabase (`events` schema), `@geiger/orm` migrations, `@geiger/ui` + shadcn primitives, Lucide icons, `node:test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-08-10-live-rooms-measured-engagement-design.md`

## Global Constraints

- Product schema is `events`. Every DB object is schema-qualified. Ledger is `events.geiger_migrations`.
- Migrations are scaffolded with `npm run db:new -- <name>`, never hand-named; each has `-- @up` and `-- @down`; never edit an applied migration.
- `member_id` is a plain `uuid` with **no** foreign key — portal members are not `auth.users`, and there is no `public.users` table in this database.
- Data-layer functions are pure: validate, `console.error("[<area>.<fn>]", …)`, return `null` / `[]` / `false`. Never throw, never `toast` — the screen owns UX.
- UI uses `@geiger/ui` and the shared kit (`components/internal/shared/screen_kit`, `.../records/*`). Never patch a local `components/ui/*` fork.
- Semantic colour tokens only (`bg-surface-subtle`, `text-text-secondary`, `border-border`, `text-emerald-400`…). Never hardcode hex.
- Comments are concise single-line, matching surrounding density.
- **Fail closed on access, fail open on metrics.**
- Tests are `node:test`, run as `node --test <file>`. There is no test runner script; do not add one.
- `npx eslint <changed files>` must be clean before each commit.
- Do **not** run `npm run build` unless a significant UI change needs visual verification.
- Do **not** push to `main`. Commit locally only.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/live/state.js` | Pure room-state resolution from times + manual override |
| `lib/live/state.test.js` | Unit tests for the above |
| `lib/live/access.js` | Shared entitlement resolver for rooms and library items |
| `lib/live/access.test.js` | Unit tests for the above |
| `lib/live/presence.js` | Heartbeat upsert + presence rollups (server-only) |
| `lib/portal/live.js` | Server-only resolver: which rooms this member may open |
| `app/api/portal/live/route.js` | GET entitled room list |
| `app/api/portal/live/[id]/route.js` | GET one room the member may open |
| `app/api/portal/live/heartbeat/route.js` | POST presence heartbeat |
| `components/portal/portal_live.jsx` | Portal Live tab: room list + room view |
| `components/internal/screens/conference/live_control.jsx` | Organiser Go Live / End + concurrency |
| `components/internal/screens/conference/breakout_assign.jsx` | Breakout roster + assignment engine |
| `supabase/migrations/<version>_room_times.sql` | Migration A |
| `supabase/migrations/<version>_room_presence.sql` | Migration B |

**Modified**

| File | Change |
|---|---|
| `lib/supabase/records.js` | `normalizeRecord`/`toRow` carry `startsAt`/`endsAt` |
| `lib/portal/watch.js` | Delegate grant logic to `lib/live/access.js` |
| `components/internal/shared/records/record_fields.jsx` | New `datetime` and `ref` field controls |
| `components/internal/shared/records/builders.jsx` | `dateTimeField()` / `refField()` factories |
| `components/internal/screens/conference/modules.jsx` | access on rooms, datetime + ref fields, typed metrics removed |
| `components/portal/portal_sidebar.jsx` | `Live` nav item |

---

### Task 1: Room state resolution (`lib/live/state.js`)

Pure, no I/O — the foundation every other task reads. Built first and test-driven.

**Files:**
- Create: `lib/live/state.js`
- Test: `lib/live/state.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveRoomState(record, now) → { state, startsAt, endsAt, secondsUntilStart }` where `state` is one of `"Scheduled" | "Opening soon" | "Live" | "Ended" | "Manual"`. `OPENING_SOON_MS = 15 * 60 * 1000`. Later tasks call this with a normalized record (`{ status, startsAt, endsAt, config }`).

- [ ] **Step 1: Write the failing test**

Create `lib/live/state.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveRoomState, OPENING_SOON_MS } from "./state.js";

const at = (iso) => new Date(iso).getTime();
const room = (over = {}) => ({ status: "Scheduled", startsAt: null, endsAt: null, config: {}, ...over });

test("a room with no schedule is manual — the organiser drives it", () => {
  const r = resolveRoomState(room(), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Manual");
  assert.equal(r.secondsUntilStart, null);
});

test("a manual override always wins over the schedule", () => {
  const r = resolveRoomState(
    room({ startsAt: "2026-08-10T12:00:00Z", config: { manualState: "Live" } }),
    at("2026-08-10T09:00:00Z"),
  );
  assert.equal(r.state, "Live");
});

test("before the window it is Scheduled, with a countdown", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Scheduled");
  assert.equal(r.secondsUntilStart, 7200);
});

test("inside the opening-soon window it flips to Opening soon", () => {
  const start = at("2026-08-10T12:00:00Z");
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), start - OPENING_SOON_MS + 1000);
  assert.equal(r.state, "Opening soon");
});

test("exactly at the start time the room is Live", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-08-10T12:00:00Z"));
  assert.equal(r.state, "Live");
});

test("exactly at the end time the room is Ended", () => {
  const r = resolveRoomState(
    room({ startsAt: "2026-08-10T12:00:00Z", endsAt: "2026-08-10T13:00:00Z" }),
    at("2026-08-10T13:00:00Z"),
  );
  assert.equal(r.state, "Ended");
});

test("a start with no end stays Live indefinitely", () => {
  const r = resolveRoomState(room({ startsAt: "2026-08-10T12:00:00Z" }), at("2026-09-01T00:00:00Z"));
  assert.equal(r.state, "Live");
});

test("an unparseable date is treated as no schedule, not as epoch zero", () => {
  const r = resolveRoomState(room({ startsAt: "Day 1 · 09:00" }), at("2026-08-10T10:00:00Z"));
  assert.equal(r.state, "Manual");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/live/state.test.js`
Expected: FAIL — `Cannot find module './state.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/live/state.js`:

```js
// Pure room-state resolution. A room's state comes from its schedule unless the
// organiser has forced one; no I/O so the portal, the organiser screens and the
// tests all agree on the same answer.

// How long before startsAt a room advertises itself as about to open.
export const OPENING_SOON_MS = 15 * 60 * 1000;

// Forced states an organiser can pin via config.manualState.
const MANUAL_STATES = new Set(["Live", "Ended", "Scheduled"]);

// Parse to epoch ms, or null. Legacy rows hold display text ("Day 1 · 09:00")
// which is relative to an event day and deliberately yields null.
function instant(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function resolveRoomState(record, now = Date.now()) {
  const startsAt = instant(record?.startsAt);
  const endsAt = instant(record?.endsAt);
  const forced = record?.config?.manualState;
  const secondsUntilStart =
    startsAt && startsAt > now ? Math.round((startsAt - now) / 1000) : null;

  if (MANUAL_STATES.has(forced)) {
    return { state: forced, startsAt, endsAt, secondsUntilStart };
  }
  // No parseable schedule: the organiser drives this room by hand.
  if (!startsAt) return { state: "Manual", startsAt, endsAt, secondsUntilStart: null };

  if (endsAt && now >= endsAt) return { state: "Ended", startsAt, endsAt, secondsUntilStart: null };
  if (now >= startsAt) return { state: "Live", startsAt, endsAt, secondsUntilStart: null };
  if (startsAt - now <= OPENING_SOON_MS) {
    return { state: "Opening soon", startsAt, endsAt, secondsUntilStart };
  }
  return { state: "Scheduled", startsAt, endsAt, secondsUntilStart };
}

// True when attendees should be able to open the room at all.
export function isOpenToAttendees(state) {
  return state === "Live" || state === "Opening soon";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/live/state.test.js`
Expected: PASS — `pass 8`, `fail 0`.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint lib/live/state.js lib/live/state.test.js
git add lib/live/state.js lib/live/state.test.js
git commit -m "feat(live): pure room-state resolution with manual override"
```

---

### Task 2: Shared access resolver (`lib/live/access.js`)

Lifts the grant logic currently inline in `lib/portal/watch.js` so rooms and library items share one rule system.

**Files:**
- Create: `lib/live/access.js`, `lib/live/access.test.js`
- Modify: `lib/portal/watch.js` (delegate to the new module)

**Interfaces:**
- Consumes: `normalizeAccess` from `components/internal/shared/records/access_control`; `grantsItem`, `entitlementExpiry`, `earliestExpiry`, `latestExpiry`, `normalizeEntitlement` from `lib/memberships/entitlements`.
- Produces: `resolveItemGrant({ access, eventIds, projectId, grants, planIdsByProject, planExpiry, planName, events }) → { granted: boolean, expiresAt: string|null, via: string }`.

- [ ] **Step 1: Write the failing test**

Create `lib/live/access.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveItemGrant } from "./access.js";

const base = {
  access: { free: false, membership: { enabled: false, planIds: [] } },
  eventIds: ["e1"],
  projectId: "p1",
  grants: [],
  planIdsByProject: {},
  planExpiry: {},
  planName: {},
  events: { e1: { id: "e1", name: "Summit", seriesId: null } },
};

test("free content is granted with no membership at all", () => {
  const r = resolveItemGrant({ ...base, access: { free: true } });
  assert.equal(r.granted, true);
  assert.equal(r.expiresAt, null);
});

test("restricted content with no matching plan is denied", () => {
  const r = resolveItemGrant(base);
  assert.equal(r.granted, false);
});

test("a content-side grant names the member's plan directly", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a"] } },
    planIdsByProject: { p1: new Set(["plan-a"]) },
    planExpiry: { "plan-a": "2027-01-01T00:00:00Z" },
    planName: { "plan-a": "Pro" },
  });
  assert.equal(r.granted, true);
  assert.equal(r.via, "Pro");
  assert.equal(r.expiresAt, "2027-01-01T00:00:00Z");
});

test("two overlapping grants keep the most generous expiry", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a", "plan-b"] } },
    planIdsByProject: { p1: new Set(["plan-a", "plan-b"]) },
    planExpiry: { "plan-a": "2026-09-01T00:00:00Z", "plan-b": "2027-01-01T00:00:00Z" },
    planName: { "plan-a": "Basic", "plan-b": "Pro" },
  });
  assert.equal(r.granted, true);
  assert.equal(r.expiresAt, "2027-01-01T00:00:00Z");
});

test("a grant from another project does not leak across projects", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a"] } },
    planIdsByProject: { "other-project": new Set(["plan-a"]) },
    planExpiry: { "plan-a": "2027-01-01T00:00:00Z" },
  });
  assert.equal(r.granted, false);
});

test("malformed access input denies rather than throwing", () => {
  const r = resolveItemGrant({ ...base, access: null });
  assert.equal(r.granted, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/live/access.test.js`
Expected: FAIL — `Cannot find module './access.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/live/access.js`:

```js
// One entitlement resolver shared by live rooms and the on-demand library. Two
// independent paths grant access and are unioned, most generous window winning:
//   plan-side     the member's plan attaches content (entitlements.vod)
//   content-side  the item itself names the plan (config.access.membership)
// Pure: no I/O, so both the portal resolver and the tests use it directly.

import { normalizeAccess } from "@/components/internal/shared/records/access_control";
import { grantsItem, latestExpiry } from "@/lib/memberships/entitlements";

const DENIED = { granted: false, expiresAt: null, via: "" };

export function resolveItemGrant({
  access,
  eventIds = [],
  projectId,
  grants = [],
  planIdsByProject = {},
  planExpiry = {},
  planName = {},
  events = {},
}) {
  const rules = normalizeAccess(access);
  // Free content needs no membership and never expires.
  if (rules.free) return { granted: true, expiresAt: null, via: "Free" };

  let granted = false;
  let expiresAt = null;
  let via = "";

  // Plan-side: does any of the member's entitlements cover this item?
  for (const g of grants) {
    if (g.projectId !== projectId) continue;
    if (!grantsItem(g.entitlement, eventIds, events)) continue;
    expiresAt = granted ? latestExpiry(expiresAt, g.expiresAt) : g.expiresAt;
    granted = true;
    via = g.planName;
  }

  // Content-side: the item names a plan the member holds in this project.
  if (rules.membership.enabled) {
    const held = [...(planIdsByProject[projectId] || [])].filter((id) =>
      rules.membership.planIds.includes(id),
    );
    for (const id of held) {
      expiresAt = granted ? latestExpiry(expiresAt, planExpiry[id]) : planExpiry[id];
      granted = true;
      via = via || planName[id] || "Membership";
    }
  }

  if (!granted) return DENIED;
  return { granted: true, expiresAt: expiresAt || null, via };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/live/access.test.js`
Expected: PASS — `pass 6`, `fail 0`.

> If the import of `@/components/...` fails under bare `node --test` (path alias unresolved), move `normalizeAccess` usage to a locally-defined normaliser inside `lib/live/access.js` that mirrors `access_control.jsx` exactly, and note the duplication in a comment. Do **not** change the test.

- [ ] **Step 5: Refactor `lib/portal/watch.js` to delegate**

In `lib/portal/watch.js`, replace the inline grant block (the `// Plan-side:` and `// Content-side:` loops inside the `for (const item of items || [])` body, currently lines ~135–157) with a single call:

```js
    const grant = resolveItemGrant({
      access: config.access,
      eventIds,
      projectId: item.project_id,
      grants,
      planIdsByProject,
      planExpiry,
      planName,
      events,
    });
    if (!grant.granted) continue;
    if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;
```

Add the import at the top: `import { resolveItemGrant } from "@/lib/live/access";`
Then replace the later uses of `via` / `expiresAt` in the pushed object with `grant.via` / `grant.expiresAt`.

**Behaviour note:** items with `access.free === true` were previously skipped unless a membership matched; they are now granted. That is the intended correction — free library items should be watchable.

- [ ] **Step 6: Verify the portal watchlist still resolves**

Run: `npx eslint lib/portal/watch.js lib/live/access.js`
Then start the app (`npm run dev`), sign into the members portal, open **Watch**, and confirm the previously-visible items are still listed.
Expected: the same items as before, plus any that were marked free.

- [ ] **Step 7: Commit**

```bash
git add lib/live/access.js lib/live/access.test.js lib/portal/watch.js
git commit -m "refactor(live): share one entitlement resolver between rooms and library"
```

---

### Task 3: Migration A — promoted time columns

**Files:**
- Create: `supabase/migrations/<version>_room_times.sql` (scaffolded, never hand-named)
- Modify: `lib/supabase/records.js`

**Interfaces:**
- Produces: `events.conference_records.starts_at` / `.ends_at` (`timestamptz`, nullable); `normalizeRecord` gains `startsAt` / `endsAt`; `toRow` emits `starts_at` / `ends_at` when the camelCase key is present.

- [ ] **Step 1: Check migration state, then scaffold**

```bash
npm run db:status
npm run db:new -- room_times --template raw
```
Expected: a new file `supabase/migrations/<14-digit>_room_times.sql`. Note the exact filename for the steps below.

- [ ] **Step 2: Write the migration**

Replace the scaffolded file's body with:

```sql
-- Room scheduling times
--
-- Promotes start/end instants out of the config jsonb bag onto
-- events.conference_records so rooms can be scheduled, sorted and counted down.
-- Nullable on purpose: legacy rows hold display text ("Day 1 · 09:00") that is
-- relative to an event day and cannot be parsed to an instant. A null starts_at
-- means "no schedule; the organiser drives state manually".

-- @up
alter table events.conference_records
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

create index if not exists conference_records_starts_at_idx
  on events.conference_records (project_id, module, starts_at);

-- @down
drop index if exists events.conference_records_starts_at_idx;
alter table events.conference_records
  drop column if exists ends_at,
  drop column if exists starts_at;
```

- [ ] **Step 3: Dry-run, apply, verify**

```bash
npm run db:push -- --dry-run
npm run db:push
npm run db:status
```
Expected: the dry run lists only `<version>_room_times.sql`; after push, `db:status` shows it `applied` and nothing pending or drifted.

- [ ] **Step 4: Carry the columns through the data layer**

In `lib/supabase/records.js`, add to `normalizeRecord`'s returned object, after `coverUrl`:

```js
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
```

And in `toRow`, after the `coverUrl` line:

```js
  // Empty string clears the schedule rather than writing an invalid timestamp.
  if ("startsAt" in input) row.starts_at = input.startsAt || null;
  if ("endsAt" in input) row.ends_at = input.endsAt || null;
```

- [ ] **Step 5: Verify the round-trip**

Run `npm run dev`, open **Conference → Livestream Rooms**, create a room, and in the browser console confirm a saved record returns `startsAt: null` rather than `undefined`.
Run: `npx eslint lib/supabase/records.js`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations lib/supabase/records.js
git commit -m "feat(live): promote starts_at/ends_at onto conference_records"
```

---

### Task 4: Migration B — presence table

**Files:**
- Create: `supabase/migrations/<version>_room_presence.sql`

**Interfaces:**
- Produces: `events.room_presence` with unique `(room_id, session_key)`, and `events.room_presence_touch(p_room_id, p_member_id, p_session_key, p_seconds)` returning the upserted row's id.

- [ ] **Step 1: Scaffold**

```bash
npm run db:new -- room_presence --template table --table room_presence
```
Note the exact generated filename.

- [ ] **Step 2: Write the migration**

Replace the scaffolded body with:

```sql
-- Room presence
--
-- Owns events.room_presence and events.room_presence_touch(). One row per
-- (room, browser tab); the watch page heartbeats every 30s. Every live metric —
-- concurrency, unique viewers, watch time, attendance — rolls up from this one
-- write path so no number is ever hand-typed.

-- @up
create extension if not exists pgcrypto;
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists events.room_presence (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  room_id         uuid not null
                    references events.conference_records(id) on delete cascade,
  -- Plain uuid, no FK: portal members are not auth.users.
  member_id       uuid,
  session_key     text not null,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  seconds_watched integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create unique index if not exists room_presence_room_session_idx
  on events.room_presence (room_id, session_key);
create index if not exists room_presence_room_seen_idx
  on events.room_presence (room_id, last_seen_at);
create index if not exists room_presence_member_idx
  on events.room_presence (member_id);

drop trigger if exists room_presence_touch_updated_at on events.room_presence;
create trigger room_presence_touch_updated_at
before update on events.room_presence
for each row execute function events.touch_updated_at();

-- Idempotent heartbeat: first call creates the row, later calls advance
-- last_seen_at and accumulate watch time for that tab.
create or replace function events.room_presence_touch(
  p_room_id uuid,
  p_member_id uuid,
  p_session_key text,
  p_seconds integer default 0
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into events.room_presence (room_id, member_id, session_key, seconds_watched, project_id)
  select p_room_id, p_member_id, p_session_key, greatest(coalesce(p_seconds, 0), 0), r.project_id
    from events.conference_records r where r.id = p_room_id
  on conflict (room_id, session_key) do update
    set last_seen_at    = now(),
        seconds_watched = events.room_presence.seconds_watched
                          + greatest(coalesce(p_seconds, 0), 0),
        member_id       = coalesce(events.room_presence.member_id, excluded.member_id)
  returning id into v_id;
  return v_id;
end;
$$;

alter table events.room_presence enable row level security;
drop policy if exists room_presence_demo_all on events.room_presence;
create policy room_presence_demo_all on events.room_presence for all to anon, authenticated
  using (true) with check (true);

-- @down
drop function if exists events.room_presence_touch(uuid, uuid, text, integer);
drop policy if exists room_presence_demo_all on events.room_presence;
drop table if exists events.room_presence cascade;
```

- [ ] **Step 3: Dry-run, apply, verify**

```bash
npm run db:push -- --dry-run
npm run db:push
npm run db:status
```
Expected: applied, nothing pending or drifted.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(live): add room_presence table and heartbeat function"
```

---

### Task 5: Presence data layer (`lib/live/presence.js`)

**Files:**
- Create: `lib/live/presence.js`

**Interfaces:**
- Consumes: `adminClient` from `lib/supabase/admin`.
- Produces:
  - `touchPresence({ roomId, memberId, sessionKey, seconds }) → boolean`
  - `roomPresenceStats(roomId) → { liveNow, uniqueViewers, secondsWatched }`
  - `presenceStatsByRoom(roomIds) → Record<roomId, { liveNow, uniqueViewers, secondsWatched }>`
  - `LIVE_WINDOW_SECONDS = 90`

- [ ] **Step 1: Write the implementation**

Create `lib/live/presence.js`:

```js
import { adminClient } from "@/lib/supabase/admin";

// Server-only presence writes and rollups over events.room_presence. Pure data
// access: returns false / zeroed stats on failure and never throws, because a
// metric must never break playback (fail open on metrics).

// A tab counts as live if it heartbeat within this window (heartbeat is 30s).
export const LIVE_WINDOW_SECONDS = 90;

const EMPTY = { liveNow: 0, uniqueViewers: 0, secondsWatched: 0 };

export async function touchPresence({ roomId, memberId, sessionKey, seconds = 0 }) {
  if (!roomId || !sessionKey) return false;
  const sb = adminClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("room_presence_touch", {
      p_room_id: roomId,
      p_member_id: memberId || null,
      p_session_key: sessionKey,
      p_seconds: Math.max(0, Math.round(Number(seconds) || 0)),
    });
    if (error) {
      console.error("[live.presence.touch]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[live.presence.touch]", e);
    return false;
  }
}

// Rollups for many rooms in one read — the module list needs every room's stats.
export async function presenceStatsByRoom(roomIds) {
  const ids = (roomIds || []).filter(Boolean);
  if (!ids.length) return {};
  const sb = adminClient();
  if (!sb) return {};
  try {
    const { data, error } = await sb
      .from("room_presence")
      .select("room_id, member_id, session_key, last_seen_at, seconds_watched")
      .in("room_id", ids)
      .is("deleted_at", null);
    if (error) {
      console.error("[live.presence.stats]", error.message);
      return {};
    }
    const cutoff = Date.now() - LIVE_WINDOW_SECONDS * 1000;
    const out = {};
    const seen = {};
    for (const row of data || []) {
      const bucket = (out[row.room_id] ||= { ...EMPTY });
      const viewers = (seen[row.room_id] ||= new Set());
      if (new Date(row.last_seen_at).getTime() >= cutoff) bucket.liveNow += 1;
      // Anonymous tabs count as their own viewer via session_key.
      viewers.add(row.member_id || `s:${row.session_key}`);
      bucket.secondsWatched += Number(row.seconds_watched) || 0;
    }
    for (const id of Object.keys(out)) out[id].uniqueViewers = seen[id].size;
    return out;
  } catch (e) {
    console.error("[live.presence.stats]", e);
    return {};
  }
}

export async function roomPresenceStats(roomId) {
  if (!roomId) return { ...EMPTY };
  const byRoom = await presenceStatsByRoom([roomId]);
  return byRoom[roomId] || { ...EMPTY };
}
```

- [ ] **Step 2: Verify the RPC is reachable**

With `npm run dev` running, in a Node REPL or a scratch route, call `touchPresence` with a real room id and confirm a row appears:
```bash
node -e "console.log('verify via the app once Task 7 wires the route')"
```
Defer live verification to Task 7, which exercises this through the heartbeat endpoint.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint lib/live/presence.js
git add lib/live/presence.js
git commit -m "feat(live): presence writes and rollups over room_presence"
```

---

### Task 6: `datetime` and `ref` field controls

**Files:**
- Modify: `components/internal/shared/records/record_fields.jsx` (the `FieldControl` switch, currently lines 239–344)
- Modify: `components/internal/shared/records/builders.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: field specs `dateTimeField(key, label, extra)` → `{ key, label, type: "datetime", scope: "root" }` and `refField(key, label, module, extra)` → `{ key, label, type: "ref", scope: "config", refModule: module }`. `FieldControl` renders both.

- [ ] **Step 1: Add the `datetime` control**

In `record_fields.jsx`, add a case to the `FieldControl` switch immediately before `case "select":`:

```jsx
    case "datetime":
      // Stored as an ISO instant; the input speaks local time.
      return (
        <Input
          type="datetime-local"
          value={value ? toLocalInput(value) : ""}
          onChange={(e) =>
            onValue(e.target.value ? new Date(e.target.value).toISOString() : "")
          }
        />
      );
```

And add this helper above `FieldControl`:

```jsx
// ISO instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in the
// viewer's timezone. Returns "" for anything unparseable (legacy display text).
function toLocalInput(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
```

- [ ] **Step 2: Add the `ref` control**

Add a case immediately after the `datetime` case:

```jsx
    case "ref":
      return (
        <RecordRefField
          field={field}
          value={value}
          onValue={onValue}
          projectId={values?.projectId}
        />
      );
```

Add the component above `FieldControl`, and `import { conferenceApi } from "@/lib/supabase/conference";` plus `useEffect`/`useState` to the file's existing React import:

```jsx
// A typeahead over sibling records of one module — turns the free-text
// session/speaker fields into real references. Stores the referenced id and
// keeps the last-known label so a deleted target still reads sensibly.
function RecordRefField({ field, value, onValue, projectId }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    conferenceApi.list(projectId, field.refModule).then((rows) => {
      if (!alive) return;
      setOptions(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, field.refModule]);

  if (loading) {
    return <div className="h-9 animate-pulse rounded-md bg-surface-card" />;
  }
  if (!options.length) {
    return (
      <p className="py-2 text-xs text-text-tertiary">
        No {field.refModule} records yet — create one first.
      </p>
    );
  }
  return (
    <Select value={value ?? ""} onValueChange={onValue}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={field.placeholder || "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name || "Untitled"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Add the builder factories**

In `builders.jsx`, after the `c` export:

```js
// A promoted timestamp column (starts_at / ends_at), not a config key.
export const dateTimeField = (key, label, extra = {}) => ({
  key,
  label,
  type: "datetime",
  scope: "root",
  ...extra,
});
// A reference to a sibling record of `module`, stored in config as an id.
export const refField = (key, label, module, extra = {}) => ({
  key,
  label,
  type: "ref",
  scope: "config",
  refModule: module,
  ...extra,
});
```

- [ ] **Step 4: Verify both controls render**

Temporarily add `dateTimeField("startsAt", "Starts at")` to the `room` module's `details` nav section in `modules.jsx`, run `npm run dev`, open a Livestream Room's detail, set a time, reload, and confirm it persists.
Expected: the value survives the reload and appears as an ISO string in the record.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint components/internal/shared/records/record_fields.jsx components/internal/shared/records/builders.jsx
git add components/internal/shared/records/
git commit -m "feat(records): datetime and record-reference field controls"
```

---

### Task 7: Heartbeat endpoint

**Files:**
- Create: `app/api/portal/live/heartbeat/route.js`

**Interfaces:**
- Consumes: `getSessionMember` from `lib/portal/session`; `touchPresence` from `lib/live/presence`.
- Produces: `POST /api/portal/live/heartbeat` with body `{ roomId, sessionKey, seconds }` → `{ ok: true }`.

- [ ] **Step 1: Write the route**

```js
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { touchPresence } from "@/lib/live/presence";

// POST -> { ok }. One presence heartbeat for a room, every 30s from the player.
// Fails open: a rejected write returns ok:false but never an error status, so a
// metric problem can never interrupt someone's viewing.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { roomId, sessionKey, seconds } = body;
  if (!roomId || !sessionKey) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ok = await touchPresence({
    roomId,
    memberId: member.id,
    sessionKey,
    seconds,
  });
  return NextResponse.json({ ok });
}
```

- [ ] **Step 2: Verify end to end**

With `npm run dev` running and signed into the portal, from the browser console:
```js
await fetch("/api/portal/live/heartbeat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ roomId: "<a real room id>", sessionKey: "test-1", seconds: 30 }),
}).then((r) => r.json());
```
Expected: `{ ok: true }`, and a row in `events.room_presence` with `seconds_watched = 30`. Repeat the call; `seconds_watched` becomes 60 and `last_seen_at` advances — the row does not duplicate.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint app/api/portal/live/heartbeat/route.js
git add app/api/portal/live/heartbeat/route.js
git commit -m "feat(live): presence heartbeat endpoint"
```

---

### Task 8: Portal room resolver + list/detail routes

**Files:**
- Create: `lib/portal/live.js`, `app/api/portal/live/route.js`, `app/api/portal/live/[id]/route.js`

**Interfaces:**
- Consumes: `resolveItemGrant` (Task 2), `resolveRoomState`/`isOpenToAttendees` (Task 1), `presenceStatsByRoom` (Task 5).
- Produces: `listMemberRooms(email) → Room[]` and `getMemberRoom(email, roomId) → Room|null`, where `Room = { id, kind, name, state, startsAt, endsAt, secondsUntilStart, joinUrl, watchUrl, description, eventName, planName, expiresAt, liveNow }`.

- [ ] **Step 1: Write the resolver**

Create `lib/portal/live.js`, modelled directly on `lib/portal/watch.js` — read that file first and mirror its membership-loading block verbatim, changing only the module filter and the per-item mapping:

```js
import { adminClient } from "@/lib/supabase/admin";
import { resolveItemGrant } from "@/lib/live/access";
import { resolveRoomState, isOpenToAttendees } from "@/lib/live/state";
import { presenceStatsByRoom } from "@/lib/live/presence";

// Server-only resolver for the portal's Live tab: which rooms a member may open
// right now. Mirrors lib/portal/watch.js — same membership loading and grant
// union — but over the room modules and with schedule-driven state applied.
// Fails closed: any read error yields [], never an unfiltered list.

const ROOM_MODULES = ["room", "webinar", "breakout"];

const asObject = (v) => (v && typeof v === "object" ? v : {});

function itemEventIds(config) {
  const c = asObject(config);
  if (Array.isArray(c.eventIds)) return c.eventIds.filter(Boolean);
  return c.eventId ? [c.eventId] : [];
}

export async function listMemberRooms(email) {
  const sb = adminClient();
  if (!sb || !email) return [];

  // Reuse the exact membership/grant preparation from lib/portal/watch.js.
  const prepared = await loadMemberGrants(sb, email);
  if (!prepared) return [];
  const { grants, planIdsByProject, planExpiry, planName, events, projectIds } = prepared;
  if (!projectIds.length) return [];

  const { data: items, error } = await sb
    .from("conference_records")
    .select("id, module, name, status, cover_url, config, project_id, starts_at, ends_at")
    .in("project_id", projectIds)
    .in("module", ROOM_MODULES)
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.live.list]", error.message);
    return [];
  }

  const granted = [];
  for (const item of items || []) {
    const config = asObject(item.config);
    const grant = resolveItemGrant({
      access: config.access,
      eventIds: itemEventIds(config),
      projectId: item.project_id,
      grants,
      planIdsByProject,
      planExpiry,
      planName,
      events,
    });
    if (!grant.granted) continue;
    if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;

    const state = resolveRoomState(
      { startsAt: item.starts_at, endsAt: item.ends_at, config },
      Date.now(),
    );
    // Ended rooms drop off the Live tab; their replay lives under Watch.
    if (state.state === "Ended") continue;

    granted.push({
      id: item.id,
      kind: item.module,
      name: item.name || "Untitled room",
      state: state.state,
      openNow: isOpenToAttendees(state.state) || state.state === "Manual",
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      secondsUntilStart: state.secondsUntilStart,
      joinUrl: config.joinUrl || "",
      watchUrl: config.watchUrl || "",
      description: config.description || "",
      eventName: (itemEventIds(config).map((id) => events[id]?.name).filter(Boolean))[0] || "",
      planName: grant.via,
      expiresAt: grant.expiresAt,
      liveNow: 0,
    });
  }

  const stats = await presenceStatsByRoom(granted.map((r) => r.id));
  for (const room of granted) room.liveNow = stats[room.id]?.liveNow || 0;

  // Soonest first; manual rooms (no schedule) after scheduled ones.
  granted.sort((a, b) => {
    if (!a.startsAt && !b.startsAt) return a.name.localeCompare(b.name);
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return new Date(a.startsAt) - new Date(b.startsAt);
  });
  return granted;
}

export async function getMemberRoom(email, roomId) {
  if (!roomId) return null;
  const rooms = await listMemberRooms(email);
  return rooms.find((r) => r.id === roomId) || null;
}
```

- [ ] **Step 2: Extract `loadMemberGrants` so both resolvers share it**

`listMemberRooms` above calls `loadMemberGrants(sb, email)`, which does not exist yet. Move the membership-loading block from `lib/portal/watch.js` (the section that builds `grants`, `planIdsByProject`, `planExpiry`, `planName`, `events` and `projectIds` — currently steps 1 and 2 of `listMemberWatchlist`) into a new exported function in `lib/portal/grants.js`:

```js
import {
  entitlementExpiry,
  earliestExpiry,
  latestExpiry,
  normalizeEntitlement,
} from "@/lib/memberships/entitlements";

// Shared membership loading for the portal's Watch and Live resolvers. Returns
// null when the member has no active memberships at all.
export async function loadMemberGrants(sb, email) { /* moved verbatim from watch.js */ }
```

Then import it in both `lib/portal/watch.js` and `lib/portal/live.js`. Keep the moved code byte-identical apart from the `return` shape — this is a move, not a rewrite.

- [ ] **Step 3: Write the two routes**

`app/api/portal/live/route.js`:

```js
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberRooms } from "@/lib/portal/live";

// GET -> { rooms }. The live rooms this member's entitlements unlock.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const rooms = await listMemberRooms(member.email);
  return NextResponse.json({ rooms });
}
```

`app/api/portal/live/[id]/route.js`:

```js
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberRoom } from "@/lib/portal/live";

// GET -> { room }. One room, only if this member is entitled to it.
export async function GET(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const room = await getMemberRoom(member.email, id);
  if (!room) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}
```

> Next.js 16: `params` is a Promise and must be awaited. Confirm against `node_modules/next/dist/docs/` before relying on this.

- [ ] **Step 4: Verify entitlement filtering both ways**

With a room whose `access.membership.planIds` names a plan the test member holds, `GET /api/portal/live` returns it. Change the room's `access` to name a plan they do **not** hold; the same call must no longer return it, and `GET /api/portal/live/<id>` must return 404.
Expected: both behaviours confirmed — this is the fail-closed check.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint lib/portal/live.js lib/portal/grants.js lib/portal/watch.js app/api/portal/live
git add lib/portal/ app/api/portal/live/
git commit -m "feat(live): portal room resolver and API routes"
```

---

### Task 9: Portal Live tab

**Files:**
- Create: `components/portal/portal_live.jsx`
- Modify: `components/portal/portal_sidebar.jsx`, and the portal shell's screen switch in `components/portal/portal_shell.jsx`

**Interfaces:**
- Consumes: `GET /api/portal/live`, `POST /api/portal/live/heartbeat`, `toEmbed` from `lib/video-embed`.
- Produces: `PortalLive` default + named export, keyed `live` in the portal shell.

- [ ] **Step 1: Read the two files you are mirroring**

Read `components/portal/portal_watch.jsx` in full and `components/portal/portal_sidebar.jsx` lines 30–70. Match their layout, loading/empty states and `portal_kit` usage exactly — this screen must not look bespoke.

- [ ] **Step 2: Add the nav item**

In `portal_sidebar.jsx`, in the `Content` group (currently `items: [{ key: "watch", label: "Watch", icon: PlayCircle }]`), add before Watch:

```js
      { key: "live", label: "Live", icon: Radio },
```
and add `Radio` to the file's existing `lucide-react` import.

- [ ] **Step 3: Build the screen**

Create `components/portal/portal_live.jsx` with:

- `useState([])` + `loading`, fetching `/api/portal/live` on mount; `setRooms(data.rooms ?? [])`.
- Three states: loading skeleton, empty (`EmptyState` — "No live rooms right now"), and the list.
- Each row: room name, `eventName` meta line, a state pill (`Live` → `text-emerald-400`, `Opening soon` → amber, `Scheduled` → muted), a countdown derived from `secondsUntilStart`, and `liveNow` when non-zero.
- Selecting a room renders the room view: the player via `toEmbed(room.watchUrl || room.joinUrl)` in an `aspect-video` frame, with the existing chat/Q&A components in a right-hand rail.
- The heartbeat: a `useEffect` that, while a room is open, mints `sessionKey` once with `crypto.randomUUID()` and posts every 30s:

```jsx
useEffect(() => {
  if (!openRoom?.id) return;
  const sessionKey = crypto.randomUUID();
  let cancelled = false;
  const beat = (seconds) => {
    if (cancelled) return;
    // Fail open: a rejected heartbeat must never interrupt playback.
    fetch("/api/portal/live/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: openRoom.id, sessionKey, seconds }),
    }).catch(() => {});
  };
  beat(0);
  const timer = setInterval(() => beat(30), 30000);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}, [openRoom?.id]);
```

- [ ] **Step 4: Wire it into the shell**

In `portal_shell.jsx`, add `live` to the screen switch alongside `watch`, importing `PortalLive`.

- [ ] **Step 5: Verify as a real member**

Sign into the portal as a member entitled to a room whose `starts_at` is in the past. Open **Live**.
Expected: the room appears as `Live`, the embedded player renders, chat is usable, and `events.room_presence` gains a row that advances every 30s. Sign in as a member **without** the entitlement: the room is absent.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint components/portal/portal_live.jsx components/portal/portal_sidebar.jsx components/portal/portal_shell.jsx
git add components/portal/
git commit -m "feat(portal): Live tab with player, engagement rail and heartbeat"
```

---

### Task 10: Organiser room modules — access, schedule, derived metrics

**Files:**
- Modify: `components/internal/screens/conference/modules.jsx` (room ~962, webinar ~1053, breakout ~1153, simulive ~1442, recording ~774)

**Interfaces:**
- Consumes: `dateTimeField`, `refField` (Task 6); `DEFAULT_ACCESS`, `accessSummary` (already imported in this file).
- Produces: no new exports; the module configs change shape.

- [ ] **Step 1: Add access to the three room modules**

For `room`, `webinar` and `breakout`: add `access: DEFAULT_ACCESS` to `defaults.config`, add `c("access", "Access", "access", { hint: "Choose how attendees unlock this room." })` to the create fields, add an `access` nav section mirroring simulive's (lines 1515–1525), and add `textCol("access", "Access", (r) => accessSummary(r.config.access))` to `columns`.

- [ ] **Step 2: Replace the free-text time fields**

In `room`, replace `c("scheduledFor", "Scheduled for", "text", …)` with:
```js
            dateTimeField("startsAt", "Starts at"),
            dateTimeField("endsAt", "Ends at"),
```
Do the same in `webinar` (its `scheduledFor`) and `simulive` (its `premiereAt`). Update each module's `columns` entry from `textCol("scheduledFor", …)` to render `startsAt` via a short local formatter. Keep the old config key in `defaults` for one release so existing rows still display their label.

- [ ] **Step 3: Turn the text references into real ones**

In `recording` and `simulive`, replace `c("session", "Session")` with `refField("sessionId", "Session", "session")` and `c("speaker", "Speaker")` with `refField("speakerId", "Speaker", "speaker")`. In `breakout`, replace `c("parentSession", "Parent session", …)` with `refField("parentSessionId", "Parent session", "session")`. Leave the old text keys in `defaults.config` and render them as a muted "unlinked: <text>" hint when the id is absent.

- [ ] **Step 4: Delete the fabricated metrics**

Remove these field specs entirely:
- `room`: none (it has no typed metric)
- `webinar`: `c("attended", "Attended", "number", …)` — **keep** `registered`, relabelled `"Registered (manual)"` with hint `"Entered by hand until registration ships."`
- `breakout`: `c("joined", "Joined", "number", …)`
- `recording` and `simulive`: `c("views", "Views", "number", …)`

Replace each module's corresponding `stats` entry and column to read from the presence rollup passed into the screen (Task 12 supplies it). Until then, render `—`.

- [ ] **Step 5: Verify nothing regressed**

Run `npm run dev`, open each of the five screens, create a record, edit it, and delete it.
Expected: all three list states render, the access column shows a summary, the datetime pickers persist, and the reference dropdowns list sibling records.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint components/internal/screens/conference/modules.jsx
git add components/internal/screens/conference/modules.jsx
git commit -m "feat(conference): gate rooms, schedule them, drop fabricated metrics"
```

---

### Task 11: Organiser live control

**Files:**
- Create: `components/internal/screens/conference/live_control.jsx`
- Modify: `components/internal/screens/conference/modules.jsx` (add a `live` nav section to `room` and `webinar`)

**Interfaces:**
- Consumes: `resolveRoomState` (Task 1); `conferenceApi.update`; a new `GET /api/live/stats?roomId=` route returning `{ liveNow, uniqueViewers, secondsWatched }`.
- Produces: `LiveControl({ record, commit })`.

- [ ] **Step 1: Add the stats route**

Create `app/api/live/stats/route.js`:

```js
import { NextResponse } from "next/server";
import { roomPresenceStats } from "@/lib/live/presence";

// GET ?roomId= -> presence rollup for the organiser's room detail.
export async function GET(request) {
  const roomId = new URL(request.url).searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  return NextResponse.json(await roomPresenceStats(roomId));
}
```

- [ ] **Step 2: Build the control**

Create `live_control.jsx` rendering a `SectionCard` with:
- The resolved state as a `StatusPill`, plus the schedule in words.
- **Go live** / **End** / **Clear override** buttons writing `config.manualState` through `commit({ config: { ...record.config, manualState: "Live" } })`.
- A live readout polling `/api/live/stats?roomId=<id>` every 15s: concurrency, unique viewers, total watch time (formatted `h m`).
- `toast.success` on override change; `toast.error` and revert if `commit` returns falsy.

- [ ] **Step 3: Wire it in**

Add to `room` and `webinar` detail nav:
```js
        {
          key: "live",
          label: "Live",
          icon: Radio,
          desc: "Go live, end the room, and watch who's in it.",
          render: ({ record, commit }) => <LiveControl record={record} commit={commit} />,
        },
```

- [ ] **Step 4: Verify**

Open a room with no schedule. Press **Go live**; confirm the portal Live tab shows it as `Live` on refresh. Open the room as a member; confirm concurrency reaches 1 within 30s. Press **End**; confirm it leaves the member's Live tab.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint components/internal/screens/conference/live_control.jsx app/api/live/stats/route.js components/internal/screens/conference/modules.jsx
git add components/internal/screens/conference/live_control.jsx app/api/live/stats/ components/internal/screens/conference/modules.jsx
git commit -m "feat(conference): organiser go-live control with live presence readout"
```

---

### Task 12: Breakout assignment engine

**Files:**
- Create: `components/internal/screens/conference/breakout_assign.jsx`, `lib/live/assign.js`, `lib/live/assign.test.js`
- Modify: `components/internal/screens/conference/modules.jsx` (breakout detail nav)

**Interfaces:**
- Consumes: nothing new.
- Produces: `assignAttendees(attendees, rooms, { mode }) → Record<roomId, attendeeId[]>` where `mode` is `"balanced"` or `"sequential"`; respects each room's `capacity` and never assigns one attendee twice.

- [ ] **Step 1: Write the failing test**

Create `lib/live/assign.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

import { assignAttendees } from "./assign.js";

const rooms = [
  { id: "r1", capacity: 2 },
  { id: "r2", capacity: 2 },
];
const people = ["a", "b", "c", "d"];

test("balanced mode spreads attendees evenly", () => {
  const out = assignAttendees(people, rooms, { mode: "balanced" });
  assert.equal(out.r1.length, 2);
  assert.equal(out.r2.length, 2);
});

test("nobody is assigned to two rooms", () => {
  const out = assignAttendees(people, rooms, { mode: "balanced" });
  const all = [...out.r1, ...out.r2];
  assert.equal(new Set(all).size, all.length);
});

test("capacity is never exceeded and the overflow is reported", () => {
  const out = assignAttendees([...people, "e"], rooms, { mode: "balanced" });
  assert.equal(out.r1.length + out.r2.length, 4);
  assert.deepEqual(out.__unassigned, ["e"]);
});

test("zero rooms leaves everyone unassigned rather than throwing", () => {
  const out = assignAttendees(people, [], { mode: "balanced" });
  assert.deepEqual(out.__unassigned, people);
});

test("sequential mode fills each room before starting the next", () => {
  const out = assignAttendees(people, rooms, { mode: "sequential" });
  assert.deepEqual(out.r1, ["a", "b"]);
  assert.deepEqual(out.r2, ["c", "d"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/live/assign.test.js`
Expected: FAIL — `Cannot find module './assign.js'`.

- [ ] **Step 3: Implement**

Create `lib/live/assign.js`:

```js
// Pure breakout assignment — the engine behind the autoAssign switch. Returns a
// map of roomId -> attendee ids, plus __unassigned for anyone who did not fit.

export function assignAttendees(attendees, rooms, { mode = "balanced" } = {}) {
  const out = { __unassigned: [] };
  const open = (rooms || []).map((r) => ({
    id: r.id,
    capacity: Math.max(0, Number(r.capacity) || 0),
  }));
  for (const r of open) out[r.id] = [];

  const queue = [...new Set(attendees || [])];
  if (!open.length) {
    out.__unassigned = queue;
    return out;
  }

  if (mode === "sequential") {
    let i = 0;
    for (const person of queue) {
      while (i < open.length && out[open[i].id].length >= open[i].capacity) i += 1;
      if (i >= open.length) out.__unassigned.push(person);
      else out[open[i].id].push(person);
    }
    return out;
  }

  // Balanced: always place into the emptiest room that still has room.
  for (const person of queue) {
    const target = open
      .filter((r) => out[r.id].length < r.capacity)
      .sort((a, b) => out[a.id].length - out[b.id].length)[0];
    if (!target) out.__unassigned.push(person);
    else out[target.id].push(person);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/live/assign.test.js`
Expected: PASS — `pass 5`, `fail 0`.

- [ ] **Step 5: Build the roster UI**

Create `breakout_assign.jsx`: a `SectionCard` listing sibling breakout rooms in the same `parentSessionId`, a mode selector (`balanced` / `sequential`), an **Assign** button calling `assignAttendees` over the parent session's entitled members (from `GET /api/portal/live` equivalent on the organiser side — reuse `presenceStatsByRoom` for who is present), writing the result to each room's `config.assigned` array via `conferenceApi.update`. Show unassigned attendees in a muted footer with a count.

- [ ] **Step 6: Wire into the breakout detail nav and verify**

Add the section to the `breakout` module's detail nav. Create three breakout rooms with capacity 2 and assign 5 attendees.
Expected: 4 placed, 1 listed as unassigned, and no attendee appearing twice.

- [ ] **Step 7: Lint and commit**

```bash
npx eslint lib/live/assign.js lib/live/assign.test.js components/internal/screens/conference/breakout_assign.jsx components/internal/screens/conference/modules.jsx
git add lib/live/ components/internal/screens/conference/
git commit -m "feat(conference): breakout assignment engine and roster"
```

---

### Task 13: Derived metrics on the module StatsBars

Closes the loop opened in Task 10 Step 4.

**Files:**
- Modify: `components/internal/screens/conference/modules.jsx`, and the records screen that renders module stats (`components/internal/shared/records/records_kit.jsx`)

**Interfaces:**
- Consumes: `presenceStatsByRoom` via a new `GET /api/live/stats/bulk?roomIds=a,b,c`.
- Produces: module `stats(records, extra)` gains a second `extra` argument carrying `{ presence }`.

- [ ] **Step 1: Add the bulk stats route**

Create `app/api/live/stats/bulk/route.js`:

```js
import { NextResponse } from "next/server";
import { presenceStatsByRoom } from "@/lib/live/presence";

// GET ?roomIds=a,b,c -> { [roomId]: { liveNow, uniqueViewers, secondsWatched } }
export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("roomIds") || "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({});
  return NextResponse.json(await presenceStatsByRoom(ids));
}
```

- [ ] **Step 2: Thread presence into the records screen**

In `records_kit.jsx`, after the records fetch resolves, if the module declares `usesPresence: true`, fetch the bulk stats for the loaded ids into `presence` state and pass it as the second argument to `module.stats(records, { presence })` and into column renderers via the row's `_presence`.

- [ ] **Step 3: Use it in the module stats**

Set `usesPresence: true` on `room`, `webinar` and `breakout`, and rewrite their `stats` to read real numbers, e.g. for `room`:

```js
    stats: (records, { presence = {} } = {}) => [
      { label: "Rooms", value: String(records.length), footer: "On-site & digital" },
      { label: "Live now", value: String(count(records, (r) => r.status === "Live")), footer: "Streaming" },
      {
        label: "Watching",
        value: String(records.reduce((s, r) => s + (presence[r.id]?.liveNow || 0), 0)),
        footer: "Attendees in rooms",
      },
      {
        label: "Unique viewers",
        value: String(records.reduce((s, r) => s + (presence[r.id]?.uniqueViewers || 0), 0)),
        footer: "All time",
      },
    ],
```

Do the equivalent for `webinar` (show rate = attended from presence ÷ manual `registered`) and `breakout` (participants from presence, fill % against summed capacity).

- [ ] **Step 4: Verify with real presence**

Open a room as a member in one browser and the organiser screen in another.
Expected: **Watching** goes to 1 within 30s and back to 0 within 90s of closing the member tab.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint app/api/live/stats/bulk/route.js components/internal/shared/records/records_kit.jsx components/internal/screens/conference/modules.jsx
git add app/api/live/ components/internal/shared/records/records_kit.jsx components/internal/screens/conference/modules.jsx
git commit -m "feat(conference): StatsBars read measured presence instead of typed numbers"
```

---

### Task 14: Breakout timer and broadcast-to-all-rooms

Completes spec §2.5. Depends on Task 12's roster existing.

**Files:**
- Modify: `components/internal/screens/conference/breakout_assign.jsx`
- Create: `lib/live/timer.js`, `lib/live/timer.test.js`
- Modify: `components/portal/portal_live.jsx` (render the countdown and broadcasts)

**Interfaces:**
- Consumes: `conferenceApi.update`; the room's chat channel from Task 9.
- Produces: `breakoutTimer(record, now) → { running, secondsRemaining, endsAt }`, driven by `config.timerEndsAt` (ISO) on the **parent session** record so every child room shares one clock.

- [ ] **Step 1: Write the failing test**

Create `lib/live/timer.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

import { breakoutTimer } from "./timer.js";

const at = (iso) => new Date(iso).getTime();

test("no timer set means not running", () => {
  const t = breakoutTimer({ config: {} }, at("2026-08-10T10:00:00Z"));
  assert.equal(t.running, false);
  assert.equal(t.secondsRemaining, 0);
});

test("a future end time counts down", () => {
  const t = breakoutTimer(
    { config: { timerEndsAt: "2026-08-10T10:05:00Z" } },
    at("2026-08-10T10:00:00Z"),
  );
  assert.equal(t.running, true);
  assert.equal(t.secondsRemaining, 300);
});

test("a past end time is finished, never negative", () => {
  const t = breakoutTimer(
    { config: { timerEndsAt: "2026-08-10T10:00:00Z" } },
    at("2026-08-10T10:05:00Z"),
  );
  assert.equal(t.running, false);
  assert.equal(t.secondsRemaining, 0);
});

test("unparseable timer text is treated as no timer", () => {
  const t = breakoutTimer({ config: { timerEndsAt: "25 minutes" } }, at("2026-08-10T10:00:00Z"));
  assert.equal(t.running, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/live/timer.test.js`
Expected: FAIL — `Cannot find module './timer.js'`.

- [ ] **Step 3: Implement**

Create `lib/live/timer.js`:

```js
// Pure breakout countdown. One clock lives on the parent session so every child
// room agrees on when the round ends.

export function breakoutTimer(record, now = Date.now()) {
  const raw = record?.config?.timerEndsAt;
  const endsAt = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(endsAt)) return { running: false, secondsRemaining: 0, endsAt: null };
  const remaining = Math.max(0, Math.round((endsAt - now) / 1000));
  return { running: remaining > 0, secondsRemaining: remaining, endsAt: new Date(endsAt).toISOString() };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/live/timer.test.js`
Expected: PASS — `pass 4`, `fail 0`.

- [ ] **Step 5: Add the organiser controls**

In `breakout_assign.jsx` add a timer row: a duration select (5 / 10 / 15 / 25 min) and **Start round** / **Stop** buttons writing `config.timerEndsAt` on the parent session record via `conferenceApi.update`. Alongside it add a **Broadcast** input that posts one system message into every child room's chat channel, reusing the existing chat send path — one call per room, `toast.success` with the room count, `toast.error` and no partial claim if any send fails.

- [ ] **Step 6: Render it for attendees**

In `portal_live.jsx`, when the open room is a breakout, poll its parent session every 5s and render `breakoutTimer(...).secondsRemaining` as an `mm:ss` countdown above the player, plus incoming broadcast messages in the chat rail.

- [ ] **Step 7: Verify**

Start a 5-minute round with two breakout rooms open in two browsers.
Expected: both countdowns agree within a second, a broadcast appears in both rooms, and the countdown stops at `00:00` without going negative.

- [ ] **Step 8: Lint and commit**

```bash
npx eslint lib/live/timer.js lib/live/timer.test.js components/internal/screens/conference/breakout_assign.jsx components/portal/portal_live.jsx
git add lib/live/ components/internal/screens/conference/breakout_assign.jsx components/portal/portal_live.jsx
git commit -m "feat(conference): breakout round timer and broadcast to all rooms"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Real `starts_at`/`ends_at` + auto state with manual override | 1, 3, 6, 10, 11 |
| Portal Live tab with player + chat/Q&A/polls | 9 |
| `access` extended to room/webinar/breakout | 2, 8, 10 |
| Presence heartbeats → concurrency, unique viewers, watch time, attendance | 4, 5, 7, 13 |
| Typed `views`/`joined`/`attended` deleted; `registered` kept as manual | 10, 13 |
| Breakout orchestration + working `autoAssign` | 12 |
| Breakout timer + broadcast-to-all-rooms | 14 |
| Record graph: session/speaker/parentSession as references | 6, 10 |
| `lib/portal/watch.js` refactored onto the shared resolver | 2 |
| Fail closed on access, fail open on metrics | 2, 5, 7, 8, 9 |
| `node:test` unit tests for pure logic | 1, 2, 12, 14 |

Every spec requirement now maps to a task.

**Sequencing constraints**

- Task 10 Step 4 leaves metrics rendering `—` until Task 13. Those two must land together for the screens to be coherent — do not ship 10 without 13.
- Task 14 depends on Task 12's roster existing.
- Task 8 Step 2 moves shared code out of `lib/portal/watch.js`; re-verify the portal Watch tab after it, since that file is load-bearing for an already-shipped feature.

**Out of scope, unchanged by this plan:** the media plane, real ASR captions, the webinar registration machine, the mobile event app, AI clipping. Recordings keep the `public` boolean and `/r/<id>` is untouched.
