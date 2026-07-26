# Reserved Seating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add section/row/seat reserved seating — venue-level seat map templates, a canvas editor, buyer seat selection with TTL holds, and seat-aware passes, check-in, and refunds.

**Architecture:** A seat map is a venue-level template (`seat_maps` → `seat_map_sections` → `seats`) built once and reused by many events. Per-event state is two thin tables: `seat_holds` (TTL, self-expiring) and `seat_assignments` (unique partial index = the double-book guard). Seat coordinates are computed by a pure module from row/seat/curve parameters, never imported. GA zones keep the existing counter-based inventory.

**Tech Stack:** Next.js 16 App Router, Supabase (`events` schema, `schemaClient()`), `@geiger/ui` + shared `screen_kit`, Tailwind semantic tokens, `node --test` for pure modules.

## Global Constraints

- All tables live in the `events` Postgres schema. Never `public` except FKs to `public.projects`.
- Data layer is pure: validate, `console.error("[seating.<x>]", …)`, return `null` / `[]` / `false`. Never throw, never `toast`.
- Screens own all toasts and optimistic state.
- snake_case in the DB, camelCase in the UI, mapped by `normalize*` / `toRow`. `toRow` emits a column only when its key is present in the input.
- Semantic colour tokens only — `bg-surface-subtle|card|hover|active`, `text-text-secondary|tertiary`, `border-border`. Never hardcode hex.
- Import UI primitives from `@geiger/ui`; never patch `components/ui/*` locally.
- The word "Reserved" is already taken by held-back quantity (`event_reserved.jsx`). This feature is called **Seating** / **Seat Maps** in all UI copy.
- SQL files are self-contained and idempotent: `create … if not exists`, `alter table … add column if not exists`, `drop … if exists` before re-creating functions, triggers, and policies.
- `npx eslint <changed files>` must be clean before a task is done.
- **Do not `git commit` or push.** Commits are held for explicit instruction from the user.

---

### Task 1: SQL schema and RPCs

**Files:**
- Create: `supabase/sqls/zzzzz_seating.sql`

Filename sorts after `zzzz_ticketing_addons.sql`, which owns the authoritative `events.buy_ticket`. This file leaves that function alone and adds `events.buy_seats` alongside it.

**Interfaces:**
- Produces tables: `events.seat_maps`, `events.seat_map_sections`, `events.seats`, `events.seat_holds`, `events.seat_assignments`
- Produces RPCs: `events.public_event_seat_map(uuid)`, `events.hold_seats(uuid, uuid[], text, integer)`, `events.release_seats(uuid, text)`, `events.buy_seats(… , p_seat_ids uuid[], p_seat_token text)`, `events.release_order_seats(uuid)`

- [ ] **Step 1: Template tables**

```sql
create extension if not exists pgcrypto;
create schema if not exists events;

create table if not exists events.seat_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  venue_id uuid references events.venues(id) on delete cascade,
  name text not null default 'Untitled configuration',
  status text not null default 'Draft',
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists events.seat_map_sections (
  id uuid primary key default gen_random_uuid(),
  seat_map_id uuid not null references events.seat_maps(id) on delete cascade,
  name text not null default 'Section',
  kind text not null default 'seated',        -- seated | ga
  x numeric(6,2) not null default 10,
  y numeric(6,2) not null default 10,
  width numeric(6,2) not null default 30,
  height numeric(6,2) not null default 20,
  rotation numeric(6,2) not null default 0,
  layout jsonb not null default '{}'::jsonb,
  capacity integer not null default 0,        -- ga only
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events.seats (
  id uuid primary key default gen_random_uuid(),
  seat_map_id uuid not null references events.seat_maps(id) on delete cascade,
  section_id uuid not null references events.seat_map_sections(id) on delete cascade,
  row_label text not null default '',
  seat_label text not null default '',
  x numeric(6,2) not null default 0,
  y numeric(6,2) not null default 0,
  kind text not null default 'standard',      -- standard|wheelchair|companion|obstructed|house
  companion_of uuid references events.seats(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists events_seats_unique_label_idx
  on events.seats (section_id, row_label, seat_label);
create index if not exists events_seats_map_idx on events.seats (seat_map_id);
create index if not exists events_seat_sections_map_idx on events.seat_map_sections (seat_map_id);
create index if not exists events_seat_maps_venue_idx on events.seat_maps (venue_id) where deleted_at is null;
```

- [ ] **Step 2: Per-event tables with the double-book guards**

```sql
create table if not exists events.seat_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  seat_id uuid not null references events.seats(id) on delete cascade,
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists events_seat_holds_unique_idx
  on events.seat_holds (event_id, seat_id);
create index if not exists events_seat_holds_token_idx on events.seat_holds (event_id, session_token);

create table if not exists events.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  seat_id uuid not null references events.seats(id) on delete cascade,
  order_id uuid references events.event_orders(id) on delete set null,
  attendee_name text not null default '',
  attendee_email text not null default '',
  ticket_id text,
  price numeric(14,2) not null default 0,
  status text not null default 'sold',        -- sold | comp | blocked
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

-- THE double-book guard. Predicate is immutable, so the partial index is valid.
create unique index if not exists events_seat_assignments_live_idx
  on events.seat_assignments (event_id, seat_id) where released_at is null;
create index if not exists events_seat_assignments_order_idx on events.seat_assignments (order_id);
```

- [ ] **Step 3: `updated_at` triggers and RLS**

Reuse `events.touch_updated_at()` (defined in `events.sql`) for `seat_maps` and `seat_map_sections`. Enable RLS on all five tables. Template tables get the project-member policy used by the other dashboard entities in `zz_project_access.sql`; `seats` and `seat_map_sections` are readable by `anon` (the storefront must draw the map) but writable only by members. `seat_holds` and `seat_assignments` are exercised only through `security definer` RPCs, so their policies stay closed to direct `anon` writes.

- [ ] **Step 4: `events.hold_seats` — the atomic hold**

```sql
drop function if exists events.hold_seats(uuid, uuid[], text, integer);
create or replace function events.hold_seats(
  p_event_id uuid, p_seat_ids uuid[], p_token text, p_minutes integer default 10
) returns table (ok boolean, held uuid[], rejected uuid[], expires_at timestamptz)
language plpgsql security definer set search_path = events, public as $$
```

Behaviour contract:
- `v_expires := now() + (greatest(1, coalesce(p_minutes,10)) || ' minutes')::interval`
- Release this token's existing holds for the event first, so re-selecting is idempotent.
- For each seat id, attempt the steal-expired upsert:
  `insert … on conflict (event_id, seat_id) do update set session_token = excluded.session_token, expires_at = excluded.expires_at where events.seat_holds.expires_at < now()`
- A seat with a live `seat_assignments` row (`released_at is null`) is rejected without attempting the hold.
- Collect successful ids into `held`, failures into `rejected`. `ok` is `array_length(rejected,1) is null`.

- [ ] **Step 5: `events.release_seats` and `events.release_order_seats`**

```sql
drop function if exists events.release_seats(uuid, text);
create or replace function events.release_seats(p_event_id uuid, p_token text)
returns integer language plpgsql security definer set search_path = events, public as $$
-- deletes this token's holds for the event, returns the row count
$$;

drop function if exists events.release_order_seats(uuid);
create or replace function events.release_order_seats(p_order_id uuid)
returns integer language plpgsql security definer set search_path = events, public as $$
-- sets released_at = now() on live assignments for the order, returns the row count
$$;
```

- [ ] **Step 6: `events.public_event_seat_map` — the anon read**

```sql
drop function if exists events.public_event_seat_map(uuid);
create or replace function events.public_event_seat_map(p_event_id uuid)
returns table (
  map jsonb,        -- { id, name, config }
  sections jsonb,   -- [{ id, name, kind, x, y, width, height, rotation, layout, capacity, sortOrder }]
  seats jsonb,      -- [{ id, sectionId, rowLabel, seatLabel, x, y, kind, companionOf }]
  taken jsonb       -- [seat_id, …] sold/comp/blocked OR live-held
)
language plpgsql security definer set search_path = events, public as $$
```

Reads `metadata->'seating'->>'seatMapId'` off the event. Returns empty jsonb arrays when the event has no seat map. `taken` unions live `seat_assignments` with `seat_holds where expires_at > now()`. Only `active` seats are returned.

- [ ] **Step 7: `events.buy_seats` — the seated purchase wrapper**

Do **not** redefine `buy_ticket`; `zzz_ticketing_addons.sql` stays its single owner. Copying its ~450-line body here would leave two versions to keep in sync. Add a wrapper instead:

```sql
create or replace function events.buy_seats(
  p_event_id uuid, p_name text, p_email text, p_ticket text, p_price numeric,
  p_addons numeric default 0, p_meta jsonb default '{}'::jsonb, /* …the rest of
  buy_ticket's args minus p_qty… */
  p_seat_ids uuid[] default '{}', p_seat_token text default null
) returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
```

Behaviour:

- When `p_seat_ids` is empty but `p_seat_token` is set, resolve the seats from live holds for that token. This is the Stripe return trip: seat ids would exceed Stripe's 500-char metadata cap on a big block, so only the token travels.
- `v_qty := array_length(v_seats, 1)`; zero seats returns `ok = false`.
- Verify every seat belongs to the event's configured map and is `active`.
- Verify every seat has a live hold matching `p_seat_token`.
- Call `events.buy_ticket(...)` with `v_qty` — money, capacity, tiers, discounts and counters all run unchanged.
- On success and `created`, insert one `seat_assignments` row per seat, then delete the token's holds.

Atomicity comes free: a plpgsql call shares the caller's transaction, so a unique violation on a seat rolls the order back too.

- [ ] **Step 8: Run the migration**

Run: `npm run db:push`
Expected: `zzzzz_seating.sql` applies with no error; re-running is clean (idempotent).

- [ ] **Step 9: Verify the guard holds**

Insert two live `seat_assignments` rows for the same `(event_id, seat_id)` via SQL and confirm the second fails on `events_seat_assignments_live_idx`. Then set `released_at` on the first and confirm the insert now succeeds.

---

### Task 2: Pure seat generator

**Files:**
- Create: `lib/seating/generate.js`
- Test: `lib/seating/generate.test.js`

This is the highest-risk pure logic in the feature — a numbering bug misprints every ticket.

**Interfaces:**
- Produces: `rowLabels(count, scheme, start)` → `string[]`; `seatLabels(count, numbering)` → `string[]`; `generateSeats(section)` → `Array<{ rowLabel, seatLabel, x, y, kind }>`; `sectionSeatCount(section)` → `number`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowLabels, seatLabels, generateSeats } from "./generate.js";

test("alpha row labels roll over past Z", () => {
  assert.deepEqual(rowLabels(3, "alpha", "A"), ["A", "B", "C"]);
  assert.equal(rowLabels(27, "alpha", "A")[26], "AA");
});

test("alpha row labels honour a start letter", () => {
  assert.deepEqual(rowLabels(2, "alpha", "C"), ["C", "D"]);
});

test("numeric row labels count from the start", () => {
  assert.deepEqual(rowLabels(3, "numeric", "1"), ["1", "2", "3"]);
});

test("continental numbering runs straight across", () => {
  assert.deepEqual(seatLabels(4, "continental"), ["1", "2", "3", "4"]);
});

test("odd-even numbering counts outward from centre", () => {
  // house-left gets odds descending to centre, house-right evens ascending
  assert.deepEqual(seatLabels(6, "odd-even"), ["5", "3", "1", "2", "4", "6"]);
});

test("odd-even handles an odd seat count", () => {
  assert.deepEqual(seatLabels(5, "odd-even"), ["5", "3", "1", "2", "4"]);
});

test("generateSeats produces rows x seatsPerRow seats", () => {
  const seats = generateSeats({
    x: 0, y: 0, width: 100, height: 50,
    layout: { rows: 3, seatsPerRow: 4, rowLabels: "alpha", numbering: "continental" },
  });
  assert.equal(seats.length, 12);
  assert.equal(seats[0].rowLabel, "A");
  assert.equal(seats[0].seatLabel, "1");
});

test("generateSeats keeps every seat inside the section box", () => {
  const seats = generateSeats({
    x: 10, y: 20, width: 40, height: 30,
    layout: { rows: 5, seatsPerRow: 10, rowLabels: "alpha", numbering: "continental", curve: 20 },
  });
  for (const s of seats) {
    assert.ok(s.x >= 10 && s.x <= 50, `x ${s.x} out of box`);
    assert.ok(s.y >= 20 && s.y <= 50, `y ${s.y} out of box`);
  }
});

test("aisleAfter skips label positions without leaving a gap in numbering", () => {
  const seats = generateSeats({
    x: 0, y: 0, width: 100, height: 50,
    layout: { rows: 1, seatsPerRow: 6, rowLabels: "alpha", numbering: "continental", aisleAfter: [3] },
  });
  assert.equal(seats.length, 6);
  const gap = seats[3].x - seats[2].x;
  const normal = seats[1].x - seats[0].x;
  assert.ok(gap > normal, "expected a wider gap at the aisle");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/seating/generate.test.js`
Expected: FAIL — cannot find module `./generate.js`

- [ ] **Step 3: Implement `lib/seating/generate.js`**

Pure, no imports, no DB. `rowLabels` builds Excel-style labels for `alpha`. `seatLabels` for `odd-even` puts descending odds then ascending evens. `generateSeats` lays rows down the section's height and seats across its width, applying `curve` (degrees of arc, bowing rows toward the stage) and `rake`, clamping every coordinate inside `[x, x+width] × [y, y+height]`. `aisleAfter` widens the gap at the listed seat indexes without renumbering. Coordinates are percent-of-canvas with 2 decimals.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/seating/generate.test.js`
Expected: PASS, 9/9

- [ ] **Step 5: Lint**

Run: `npx eslint lib/seating/generate.js lib/seating/generate.test.js`
Expected: clean

---

### Task 3: Pure CSV manifest parser

**Files:**
- Create: `lib/seating/csv.js`
- Test: `lib/seating/csv.test.js`

**Interfaces:**
- Consumes: `generateSeats` from Task 2 (for positions)
- Produces: `parseManifest(text)` → `{ sections: Array<{ name, kind, layout, seats: Array<{ rowLabel, seatLabel, kind }> }>, errors: string[] }`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./csv.js";

test("parses section,row,seat into grouped sections", () => {
  const { sections, errors } = parseManifest(
    "section,row,seat\nOrchestra,A,1\nOrchestra,A,2\nBalcony,A,1\n",
  );
  assert.equal(errors.length, 0);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].name, "Orchestra");
  assert.equal(sections[0].seats.length, 2);
});

test("derives rows and seatsPerRow into the section layout", () => {
  const { sections } = parseManifest(
    "section,row,seat\nOrch,A,1\nOrch,A,2\nOrch,B,1\nOrch,B,2\n",
  );
  assert.equal(sections[0].layout.rows, 2);
  assert.equal(sections[0].layout.seatsPerRow, 2);
});

test("reads an optional kind column", () => {
  const { sections } = parseManifest(
    "section,row,seat,kind\nOrch,A,1,wheelchair\n",
  );
  assert.equal(sections[0].seats[0].kind, "wheelchair");
});

test("tolerates header case, spacing, and quoted values", () => {
  const { sections, errors } = parseManifest(
    ' Section , Row , Seat \n"Grand Circle",A,1\n',
  );
  assert.equal(errors.length, 0);
  assert.equal(sections[0].name, "Grand Circle");
});

test("reports a missing required header instead of throwing", () => {
  const { sections, errors } = parseManifest("section,row\nOrch,A\n");
  assert.equal(sections.length, 0);
  assert.match(errors[0], /seat/i);
});

test("reports duplicate seats rather than silently dropping them", () => {
  const { errors } = parseManifest("section,row,seat\nOrch,A,1\nOrch,A,1\n");
  assert.match(errors[0], /duplicate/i);
});

test("ignores blank lines and an unknown kind falls back to standard", () => {
  const { sections, errors } = parseManifest(
    "section,row,seat,kind\nOrch,A,1,sofa\n\n\n",
  );
  assert.equal(errors.length, 0);
  assert.equal(sections[0].seats[0].kind, "standard");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/seating/csv.test.js`
Expected: FAIL — cannot find module `./csv.js`

- [ ] **Step 3: Implement `lib/seating/csv.js`**

A minimal RFC-4180-ish splitter (handles quoted fields containing commas), header normalisation to lowercase/trimmed, required columns `section`/`row`/`seat`, optional `kind` validated against the seat-kind set with an unknown value falling back to `standard`. Sections keep first-seen order; rows keep first-seen order. `layout.rows` is the distinct row count and `layout.seatsPerRow` is the max seats in any row.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/seating/csv.test.js`
Expected: PASS, 7/7

- [ ] **Step 5: Lint**

Run: `npx eslint lib/seating/csv.js lib/seating/csv.test.js`
Expected: clean

---

### Task 4: Seat map template data layer

**Files:**
- Create: `lib/supabase/seat_maps.js`

**Interfaces:**
- Consumes: `schemaClient` / `isSupabaseConfigured` (follow the import style already used by `lib/supabase/venues.js`), `generateSeats` from Task 2
- Produces: `listSeatMaps(venueId)`, `getSeatMap(id)`, `createSeatMap(input)`, `updateSeatMap(id, patch)`, `softDeleteSeatMap(id)`, `listSections(seatMapId)`, `createSection(input)`, `updateSection(id, patch)`, `deleteSection(id)`, `regenerateSectionSeats(section)`, `listSeats(seatMapId)`, `updateSeat(id, patch)`, `importManifest(seatMapId, parsed)`

- [ ] **Step 1: Read the reference**

Read `lib/supabase/venues.js` end to end and match its module shape exactly — header comment naming the tables owned, `normalize*`, `toRow`, guard on every call, tri-state returns.

- [ ] **Step 2: Implement the module**

`normalizeSeatMap`, `normalizeSection`, `normalizeSeat` map snake → camel and default every field. `toSeatMapRow`, `toSectionRow`, `toSeatRow` emit a column only when its key is present.

`regenerateSectionSeats(section)` deletes the section's existing seats, calls `generateSeats(section)`, and bulk-inserts the result in one statement — never a per-seat round trip. Returns the new seat count, or `false` on failure.

`importManifest(seatMapId, parsed)` creates one section per parsed section with a laid-out default position (stacked vertically, evenly spaced), generates coordinates for its seats via `generateSeats`, and bulk-inserts. Returns `{ sections, seats }` counts or `null`.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/supabase/seat_maps.js`
Expected: clean

---

### Task 5: Per-event seating data layer

**Files:**
- Create: `lib/supabase/seating.js`

**Interfaces:**
- Produces: `getEventSeating(eventId)` → `{ map, sections, seats, taken }`; `holdSeats(eventId, seatIds, token, minutes)` → `{ ok, held, rejected, expiresAt }`; `releaseSeats(eventId, token)` → `boolean`; `listAssignments(eventId)`; `blockSeats(eventId, seatIds, note)`; `unblockSeats(eventId, seatIds)`; `assignComp(eventId, seatId, attendee)`; `reseat(assignmentId, nextSeatId)`; `releaseOrderSeats(orderId)`; `seatToken()`

- [ ] **Step 1: Implement the module**

`getEventSeating` calls the `public_event_seat_map` RPC so the same path serves the dashboard and the anon storefront. `seatToken()` returns a `crypto.randomUUID()` persisted in `sessionStorage` under `geiger.seatToken` so a Stripe redirect returns to the same token and its holds.

`reseat(assignmentId, nextSeatId)` releases the old assignment and inserts a new one in that order, relying on the unique index to reject a taken target seat; returns `false` and leaves the original intact if the insert fails.

- [ ] **Step 2: Lint**

Run: `npx eslint lib/supabase/seating.js`
Expected: clean

---

### Task 6: Venue seat map editor

**Files:**
- Create: `components/internal/screens/venues/seat_maps.jsx`
- Create: `components/internal/screens/venues/seat_map_editor.jsx`
- Modify: `components/internal/screens/venues/venue_detail.jsx`

**Interfaces:**
- Consumes: everything from Task 4, `parseManifest` from Task 3

- [ ] **Step 1: Read the canvas reference**

Read `components/internal/screens/conference/floor_plan.jsx` in full. Reuse its percent-coordinate drag model, its unplaced-items tray, and its optimistic persistence — do not invent a second interaction pattern.

- [ ] **Step 2: Build `seat_maps.jsx`**

Configuration list for the venue: loading / empty / data states, create dialog (name + status), row actions (rename, duplicate, delete). Selecting one renders the editor.

- [ ] **Step 3: Build `seat_map_editor.jsx`**

Canvas with a stage marker, drag/resize section blocks, tray of unplaced sections, and a right-hand section panel: name, kind (`seated` | `ga`), rows, seats per row, row-label scheme and start, numbering scheme, curve, rake, aisles, GA capacity. Changing any layout field re-runs `generateSeats` for a live preview and persists via `regenerateSectionSeats` on commit. Clicking an individual seat cycles its `kind` or deactivates it. A "Import CSV" action feeds `parseManifest` and surfaces its `errors` array in the dialog rather than a toast, so a 40-row error list is readable. Stats bar: total seats, seated vs GA, accessible count.

- [ ] **Step 4: Wire the tab into `venue_detail.jsx`**

Add a "Seat Maps" tab following the file's existing tab pattern.

- [ ] **Step 5: Lint**

Run: `npx eslint components/internal/screens/venues/`
Expected: clean

---

### Task 7: Event seating tab

**Files:**
- Create: `components/internal/screens/events/event_seating.jsx`
- Modify: `components/internal/screens/events/event_sections.js`
- Modify: `components/internal/screens/events/event_detail.jsx`

- [ ] **Step 1: Build the tab**

Select the venue configuration; toggle mode (`map-first` | `type-first`); map each seated section and GA zone to a ticket tier; set the hold window in minutes. All of it persists to `event.metadata.seating` through the existing `event_merge_meta` RPC. Below the config, a live map shows sold / held / blocked with box-office actions: block and unblock seats, assign a comp, and reseat a buyer.

- [ ] **Step 2: Register the tab**

Add "Seating" to the event editor's section list in `event_sections.js` and render it from `event_detail.jsx`, matching how the existing tabs are wired. Per `MODULE_CONVENTIONS.md` this is a tab, **not** a registry entry.

- [ ] **Step 3: Lint**

Run: `npx eslint components/internal/screens/events/event_seating.jsx components/internal/screens/events/event_sections.js components/internal/screens/events/event_detail.jsx`
Expected: clean

---

### Task 8: Buyer seat picker

**Files:**
- Create: `components/internal/screens/events/seat_picker.jsx`

**Interfaces:**
- Consumes: `getEventSeating`, `holdSeats`, `releaseSeats`, `seatToken` from Task 5
- Produces: `<SeatPicker event={} mode={} ticketId={} requiredQty={} onChange={(seats) => void} accent={} />`

- [ ] **Step 1: Build the two-level view**

Bowl view draws section polygons only — ~50–200 SVG nodes regardless of venue size — coloured by mapped tier, labelled with name, "from $X", and available count. Clicking a section transitions to the section view, which draws that section's seats as circles with row labels at both ends. Seat states: available, held, sold, blocked, selected. A back control returns to the bowl.

- [ ] **Step 2: Selection rules**

Selecting a `wheelchair` seat auto-selects its `companion_of` partner. In `type-first` mode selection is capped at `requiredQty` and Continue stays disabled below it; in `map-first` mode quantity derives from the selection. A "Best available" button picks the highest-tier contiguous block matching the required quantity. An accessible-only filter dims non-accessible seats.

- [ ] **Step 3: Holds and the countdown**

Selecting calls `holdSeats`; rejected ids flip to `sold` in local state with a toast telling the buyer that seat just went. A countdown renders from `expiresAt`; on expiry the selection clears and the map refetches. Closing the picker calls `releaseSeats`.

- [ ] **Step 4: Mobile and a11y**

Pan/zoom transform on the section view, tap targets ≥ 24px, `aria-label` on every seat button (`"Row F seat 12, available, $89"`), keyboard arrow navigation within a row.

- [ ] **Step 5: Lint**

Run: `npx eslint components/internal/screens/events/seat_picker.jsx`
Expected: clean

---

### Task 9: Public page checkout integration

**Files:**
- Modify: `components/internal/screens/events/event_public_page.jsx`

- [ ] **Step 1: Add the seat step to the slide track**

The checkout modal currently slides `details → addons → done|error`. Add `seats`:
- `map-first` — `seats → details → addons`. The picker is first; the chosen section determines ticket and price, and the quantity stepper is replaced by the selection summary.
- `type-first` — `details → seats → addons`. Ticket and quantity are chosen first; the picker is constrained to exactly `qty` seats in sections mapped to that ticket.

An event with no `metadata.seating.seatMapId` keeps today's exact flow — no seat step, no behaviour change.

- [ ] **Step 2: Pass seats through the purchase**

Send `p_seat_ids` and `p_seat_token` to `buy_ticket` alongside the existing args. On the free/no-payment branch the flow is unchanged apart from the seat ids. On the Stripe branch, holds must outlive the redirect: extend the hold to the checkout session's lifetime before redirecting, and re-verify on return.

- [ ] **Step 3: Show seats on the done step**

List the purchased seats as "Orchestra · Row F · Seats 11–14" in the confirmation.

- [ ] **Step 4: Lint**

Run: `npx eslint components/internal/screens/events/event_public_page.jsx`
Expected: clean

---

### Task 10: Downstream — passes, check-in, orders, refunds

**Files:**
- Modify: `lib/passes/render.js`
- Modify: `components/internal/screens/checkin/constants.js` and the attendee row renderer
- Modify: `components/internal/screens/orders/order_detail_drawer.jsx`
- Modify: `lib/supabase/order_refunds.js`

- [ ] **Step 1: Seat on the pass**

Render "Section · Row · Seat" on the QR pass when the ticket has an assignment. Passes without a seat render exactly as they do today.

- [ ] **Step 2: Seat at check-in**

Show the seat in the check-in attendee row and make it searchable, so door staff can look up "F12".

- [ ] **Step 3: Seats in the order drawer**

List the order's seats in `order_detail_drawer.jsx`.

- [ ] **Step 4: Release seats on refund and cancel**

Call `releaseOrderSeats(orderId)` from the refund and cancel paths so a refunded seat returns to the pool. This is mandatory — without it seats leak permanently.

- [ ] **Step 5: Lint**

Run: `npx eslint lib/passes/render.js lib/supabase/order_refunds.js components/internal/screens/orders/order_detail_drawer.jsx components/internal/screens/checkin/`
Expected: clean

---

## Verification

- `node --test lib/seating/` — generator and parser green.
- `npm run db:push` — applies clean, and clean again on a re-run.
- `npx eslint` clean across all changed files.
- Manual: build a map on a venue, attach it to an event, buy seats in both modes, confirm a second browser cannot take a held seat, refund the order, confirm the seat returns.
