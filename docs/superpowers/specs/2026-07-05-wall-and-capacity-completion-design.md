# Event Wall polish + Capacity limits completion — Design

Date: 2026-07-05
Status: Approved, in implementation

## Context

Two features were reported as possibly-incomplete: the **Event Wall** ("wall
list") and **capacity limits**. Investigation found:

- **Event Wall** is already built end-to-end (UI + `lib/supabase/event_wall.js`
  DAL + `events.event_wall` table with RLS + live `/w/<slug>` route). Real
  defects: the base `event_wall.sql` migration is stale/self-contradictory
  (`project_id` only defined in `zz_project_access.sql`), and the public route is
  client-only with no SSR/SEO.
- **Capacity** has a genuinely enforced core (event-level `capacity`/`sold`
  columns gated by the `buy_ticket` + `register` RPCs), but four controls are
  built in the UI and saved yet never enforced (per-tier `qty`, RSVP-specific
  cap, overbook `capacityBuffer`, `showRemaining`), plus one correctness bug
  (the `register` RPC oversells when full and waitlist is disabled).

Decisions (from the user): wire the useful dead controls + trim the duplicate;
fix the oversell bug; polish Event Wall UI and fix its SQL/SEO.

## Feature A — Capacity

### A1. Per-tier ticket inventory (enforce)
Ticket tiers live in `metadata.tickets` as `{ id, name, price, qty }`. Add a
tracked `soldQty` per tier in the same bag. Extend the `buy_ticket` RPC
(`supabase/sqls/orders.sql`) to accept a **tier id**: lock the event row, read
the tier from `metadata->'tickets'`, reject when `tierSold + qty > tier.qty`
(tier.qty of 0 = unlimited), and on success `jsonb_set` the tier's `soldQty`
alongside the existing `sold`/`revenue` bump — atomic under the row lock.
Checkout (`event_public_page.jsx`) passes the selected tier id; the stepper
`maxQty` becomes `min(event remaining, tier remaining)`. `orders.js` passes the
tier id through and surfaces a per-tier sold-out.

### A2. Overbook buffer (enforce)
`capacityBuffer` (event metadata) becomes real. `buy_ticket` and `register`
compute `effectiveCap = capacity + buffer`. Public page `remaining`/`soldOut`
use the effective cap so the buffer admits extra sales.

### A3. RSVP "Max attendees" → real capacity column (kill the duplicate)
The RSVP "Limit capacity / Maximum attendees" control stops writing dead
`metadata.rsvp.capacity`/`limitCapacity` and writes the real `events.capacity`
column via `updateEvent`. "Limit capacity" off ⇒ `capacity = 0` (unlimited).
One cap, one source of truth. Keep `waitlist` / `maxGuests` / `requireApproval`.

### A4. "Show remaining" (honor it)
Public page reads `regSettings.showRemaining`; when false, hide the "N remaining"
text + capacity stat. Default true.

### A5. Oversell bug (fix)
`register` RPC: when the cap (incl. buffer) is hit and waitlist is disabled,
`raise EVENT_FULL` instead of falling through to `'Confirmed'`. `registerForEvent`
surfaces `{ ok:false, full:true }`.

To avoid regressing the guest list, `register` gained a `p_enforce_capacity`
flag (default true). The parity registration filed right after a successful
`buy_ticket` (free or paid) passes `enforceCapacity:false` — `buy_ticket` is the
capacity authority for ticketed flows, so re-gating there would wrongly drop an
already-ticketed attendee. Only direct/RSVP-only callers use the gate.

### A6. Reconciliation (flag, minimal fix)
Paid `sold` and free-RSVP registration seats are counted separately; a paid
buyer increments both. Not re-architected here. Minimal fix: `CapacityLimitsScreen`
fill math uses `max(sold, regSeats)` so the monitor doesn't under-report. Full
unification is a documented follow-up.

### A7. UI polish
`CapacityLimitsScreen` fully onto geiger `screen_kit`; tidy `AdjustDialog`;
semantic tokens only; loading/empty/filtered-empty states intact.

## Feature B — Event Wall

### B1. Consolidate `event_wall.sql`
Move the `project_id` column (NOT NULL, FK cascade to `public.project`) + the
unique `(project_id)` index into the **base** `event_wall.sql`; rewrite the stale
"singleton / seeded id, no lookup" header to describe the one-wall-per-project
model. `zz_project_access.sql` stays idempotent (its `add column if not exists`
becomes a no-op).

### B2. SSR + SEO on `/w/[slug]`
Convert the client-only route to a server component with `generateMetadata`
(title/description/OG from the wall), fetching the wall server-side and passing
initial data to a client child for interactivity. Read the Next 16 docs in
`node_modules/next/dist/docs/` first (per AGENTS.md — server data-fetch is
version-sensitive here).

### B3. UI polish
Consistency pass on the wall editor shell/sections against the kit (the bespoke
shell intentionally mirrors the event editor — alignment, not a rewrite).

## Build order

B1 (SQL) → A5 + A2 + A3 (RPC + enforcement core) → A1 (per-tier) →
A4 / A6 / A7 (UI wiring + polish) → B3 (wall polish) → B2 (SSR/SEO).

## Out of scope
- Full unification of paid-sold vs RSVP-seat counting (A6 documents it).
- Any auth/RLS changes beyond what already exists.
- New tickets table (per-tier inventory stays in the metadata bag).
