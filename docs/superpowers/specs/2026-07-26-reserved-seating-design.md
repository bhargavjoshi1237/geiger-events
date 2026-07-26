# Reserved Seating — Design

Date: 2026-07-26
Status: Approved

## Why

`supabase/articles/features/reserved-seating.sql` and
`event-floor-plans-seating.sql` are published marketing pages promising
pick-your-seat checkout, seats held during payment, and reusable named seat
maps. None of it exists in the app. This closes that gap.

Naming caution: `components/internal/screens/events/event_reserved.jsx` and
`metadata.reserved` already mean *held-back quantity* (block tickets out of
public sale). Seating must never be labelled "Reserved" in the UI — it is
**Seat Maps** / **Seating**.

## The core shift

Today all ticket inventory is a **counter**: `events.buy_ticket` locks the event
row and does arithmetic over `sold`/`capacity`, per-tier `qty`, slot caps and
reserved holds. `events.event_orders` stores `ticket_name + quantity + total`
with no per-attendee row.

Seating makes inventory **identity-based**: a specific chair is yours or it is
not. The guard is a unique index, not arithmetic.

## Architecture

A seat map is a **venue-level template** built once. Per-event seat state is a
separate thin layer. No copying of maps per event.

```
events.venues
  └── events.seat_maps            (one per venue *configuration*)
        └── events.seat_map_sections   (seated blocks + GA zones)
              └── events.seats          (one row per chair, generated)

events.events
  ├── metadata.seating = { seatMapId, mode, sectionTiers, holdMinutes }
  ├── events.seat_holds        (event_id + seat_id, TTL)
  └── events.seat_assignments  (event_id + seat_id, sold/comp/blocked)
```

### Template tables

**`events.seat_maps`** — one configuration of a venue. A venue has many
(end-stage concert, in-the-round, banquet rounds, half-house).

| column | notes |
|---|---|
| `id` | uuid pk |
| `project_id` | → `public.projects(id)`, RLS scope |
| `venue_id` | → `events.venues(id)` on delete cascade |
| `name` | "End-stage concert" |
| `status` | `Draft` \| `Active` \| `Archived` |
| `config jsonb` | canvas aspect ratio, stage marker `{x,y,label}` |
| `created_by` | → `auth.users(id)` |
| `metadata jsonb`, `created_at`, `updated_at`, `deleted_at` | standard |

**`events.seat_map_sections`**

| column | notes |
|---|---|
| `seat_map_id` | → `seat_maps(id)` on delete cascade |
| `name` | "Orchestra" |
| `kind` | `seated` \| `ga` |
| `x`, `y`, `width`, `height` | **percent of canvas** — same convention as `conference/floor_plan.jsx` |
| `rotation` | degrees |
| `layout jsonb` | `{ rows, seatsPerRow, rowLabels: 'alpha'\|'numeric', rowLabelStart, numbering: 'continental'\|'odd-even', curve, rake, aisleAfter: [] }` |
| `capacity` | GA zones only; seated sections derive from `seats` |
| `sort_order` | display order |

**`events.seats`** — one row per physical chair.

| column | notes |
|---|---|
| `section_id` | → `seat_map_sections(id)` on delete cascade |
| `seat_map_id` | denormalised for fast whole-map reads |
| `row_label`, `seat_label` | "F", "12" |
| `x`, `y` | percent of canvas, **computed** |
| `kind` | `standard` \| `wheelchair` \| `companion` \| `obstructed` \| `house` |
| `companion_of` | → `seats(id)`, pairs a companion to a wheelchair space |
| `active` | soft-disable without deleting |

Unique `(section_id, row_label, seat_label)`. Index on `seat_map_id`.

### Coordinates are computed, never imported

`lib/seating/generate.js` is a pure module turning
`rows × seatsPerRow × curve × rake × numbering` into exact `x/y` per seat. This
is why a CSV manifest carrying only section/row/seat still yields a real map —
venue exports essentially never contain coordinates.

Numbering schemes are per-section and must be explicit, because getting them
wrong misprints every ticket:

- `continental` — straight `1..N` left to right.
- `odd-even` — odd numbers house-left, even house-right, counting outward from
  centre (American theatre convention).

Row labels are `alpha` (A, B, … Z, AA) or `numeric`, with a configurable start.

### Per-event tables

**`events.seat_holds`** — `event_id`, `seat_id`, `session_token`, `expires_at`.

Unique on `(event_id, seat_id)`. A hold is taken with:

```sql
insert into events.seat_holds (event_id, seat_id, session_token, expires_at)
values (...)
on conflict (event_id, seat_id) do update
  set session_token = excluded.session_token,
      expires_at    = excluded.expires_at
  where events.seat_holds.expires_at < now()
```

One statement atomically steals a dead hold and fails against a live one.
Expired holds die passively — **no cron sweeper**, matching the idempotent style
of the existing SQL.

**`events.seat_assignments`** — `event_id`, `seat_id`, `order_id →
events.event_orders(id)`, `attendee_name`, `attendee_email`, `ticket_id`,
`price`, `status` (`sold` \| `comp` \| `blocked`), `released_at`.

**Unique index on `(event_id, seat_id) where released_at is null`** — the real
double-book guard, the same shape as the inventory double-collect guard. The
predicate is immutable, so the partial index is valid.

Organiser production holds and house seats live here as `status = 'blocked'`.

### Event wiring — no new event columns

Written through the existing `events.event_merge_meta` RPC:

```js
event.metadata.seating = {
  seatMapId,                       // which venue configuration
  mode: "map-first" | "type-first",
  sectionTiers: { [sectionId]: ticketId },
  holdMinutes: 10,
}
```

`sectionTiers` serves both buyer flows with one mechanism:

- **map-first** — reads section → tier to price a clicked seat.
- **type-first** — reads it backwards to decide which sections are selectable
  for the already-chosen ticket.

### Purchase

`buy_ticket` is **not** redefined — `zzz_ticketing_addons.sql` stays its single
owner. Copying its ~450 lines of tier/slot/discount/bundle logic into a second
file would leave two copies to keep in sync forever.

Instead `events.buy_seats(…, p_seat_ids uuid[], p_seat_token text)` wraps it:

1. validates every seat belongs to the map linked to the event,
2. requires a live hold matching `p_seat_token` for each,
3. delegates money, capacity, tiers, discounts and counters to `buy_ticket`,
4. inserts `seat_assignments` (the unique index is the last line of defence),
5. clears the token's holds.

A plpgsql call shares the caller's transaction, so a seat lost between
validation and insert raises a unique violation that rolls the order back with
it — the same atomicity, without the duplication.

Quantity is derived: `array_length(p_seat_ids, 1)`.

When `p_seat_ids` is empty but a token is given, `buy_seats` resolves the seats
from the live holds itself. That is what the Stripe return trip uses: seat ids
would exceed Stripe's 500-char metadata cap on a large block, so only the
36-char token travels, and the holds are the authoritative record anyway. The
client extends its holds to a 30-minute window before redirecting.

Refund and cancel set `released_at`, returning seats to the pool.

**GA zones keep the counter path.** A `ga` section has no `seats` rows, so a GA
purchase supplies no seat ids and flows through the existing per-tier
arithmetic unchanged. A single event can therefore sell a seated orchestra and a
standing pit in the same order, each using the inventory model that fits it.

### Anon read path

Follows the existing `public_event_discount` / `public_event_access_code`
precedent — `security definer` functions so buyers get availability without
member-only records ever being exposed:

- `events.public_event_seat_map(p_event_id)` → map, sections, seats, and the
  ids of seats currently taken (sold, blocked, or live-held).
- `events.hold_seats(p_event_id, p_seat_ids, p_token, p_minutes)`
- `events.release_seats(p_event_id, p_token)`

## Surfaces

### 1. Venue seat map editor

A tab on `venue_detail.jsx` (venue configurations list → canvas editor).

- Canvas with percent-based drag/resize of section blocks, reusing the
  `conference/floor_plan.jsx` interaction and persistence pattern.
- A tray holds unplaced sections; drag onto the floor to position.
- Section panel: name, kind, rows, seats/row, row labels, numbering, curve,
  rake, aisles, GA capacity.
- Saving layout params regenerates that section's seats. If the map is already
  in use by an event with live assignments, warn before regenerating.
- Seat-level editing: click a seat to change `kind` or deactivate it (aisles,
  removed chairs, wheelchair spaces).
- CSV manifest import: `section,row,seat[,kind]` → creates sections with a
  derived layout and generates positions.
- Stats: total seats, seated vs GA, accessible count.

### 2. Event seating tab

`components/internal/screens/events/event_seating.jsx`, a tab in the event
editor.

- Choose the venue configuration.
- Mode toggle: map-first / type-first.
- Section → ticket tier mapping.
- Hold window (minutes).
- Live map of sold / held / blocked, with box-office actions: block or unblock
  seats, assign a comp, and reseat an existing buyer (which reissues their
  pass).

### 3. Buyer seat picker

Two-level render on the public page, which is also the performance strategy —
seats are never all drawn at once.

- **Bowl view:** section polygons only (~50–200 SVG nodes regardless of venue
  size), coloured by price tier, labelled with "from $X" and available count.
- **Section view:** that section's seats as circles with row labels at each end.
  States: available, held, sold, blocked, selected.
- Wheelchair selection auto-adds its paired companion seat.
- "Best available" button; accessible-seats filter.
- Live hold countdown; seats release when the modal closes.
- Mobile: pan/zoom transform, tap targets ≥ 24px.

In `map-first` mode the picker is the first checkout step and the section sets
the price. In `type-first` mode the existing details step (ticket + quantity)
runs first and the picker becomes a second step constrained to exactly `qty`
seats in sections mapped to that ticket.

Rendering stays SVG at both levels. A single section above ~1200 seats is out of
scope for v1; if one appears, it switches to canvas later.

### 4. Downstream

- Seat printed on the QR pass (`lib/passes/render.js`).
- Seat shown in check-in attendee rows.
- Order drawer lists seats; refund and cancel release them.

## Files

**New**

- `supabase/sqls/zzzzz_seating.sql` — sorts after `zzzz_ticketing_addons.sql`,
  which currently owns the authoritative `buy_ticket`.
- `lib/seating/generate.js` — pure seat generation (rows, numbering, curve).
- `lib/seating/csv.js` — pure manifest parsing.
- `lib/supabase/seat_maps.js` — template CRUD.
- `lib/supabase/seating.js` — per-event availability, holds, assignments.
- `components/internal/screens/venues/seat_maps.jsx` — configurations tab.
- `components/internal/screens/venues/seat_map_editor.jsx` — canvas editor.
- `components/internal/screens/events/event_seating.jsx` — event seating tab.
- `components/internal/screens/events/seat_picker.jsx` — buyer picker.

**Modified**

- `components/internal/screens/venues/venue_detail.jsx` — add tab.
- `components/internal/screens/events/event_detail.jsx`, `event_sections.js` —
  add Seating tab.
- `components/internal/screens/events/event_public_page.jsx` — seat step.
- `lib/supabase/orders.js`, refund path — release seats.
- `lib/passes/render.js` — seat on pass.
- Check-in display — seat column.

## Out of scope

Tiered bowl geometry with sightline pricing, season-ticket inventory,
hold/kill lifecycles, sightline photos, background-image tracing, and SVG
floor-plan import. Section-first drill-down means stadium *scale* works, but
stadium *commerce* does not, and is not attempted.

## Conventions

Per `SUPABASE_CONVENTIONS.md`: `events` schema throughout, `schemaClient()`
access, `normalize*` / `toRow` at the snake↔camel boundary, tri-state returns
(`null` / `[]` / `false`), `console.error` and never throw or toast in the data
layer. Screens own toasts and optimistic state. Shared kit + `@geiger/ui`
primitives, semantic colour tokens only.
