# Bowl Seating & Sellable Expo Booths — Design

Date: 2026-08-05

## Problem

Reserved seating is complete end to end (`20260726194141_seating.sql`), but the
map is a **proscenium**: a stage marker pinned to the top of a flat canvas with
section blocks in front of it. Real ticketing maps are a **bowl** — the field,
court, rink or stage sits in the middle and sections ring it 360°, colour-coded
by price, pan and zoom, click a section to open its seat grid.

Expo booths are worse off: they exist only as `conference_records` of module
`booth`, dragged onto a blank grid by staff. There is no buyer-facing map, no
hold, no purchase path — none of the machinery seats already have.

## Decisions taken

| Question | Answer |
|---|---|
| "3D" seat map | Flat top-down bowl with pan/zoom — what Ticketmaster actually ships. No three.js. |
| Bowl geometry authoring | Ring generator (shape + tiers + per-side) then drag to correct; CSV manifest fills seats. |
| Section colouring | Automatic, bucketed from the mapped ticket price. Legend renders itself. |
| Booth selling | Full parity with seats — public map, TTL holds, Stripe, refund release. |
| Booth placement | Venue-level `hall_maps` template, mirroring `seat_maps`. |
| Existing conference booths | Migrated into the new tables; one booth concept. |
| Booth pricing | Organiser chooses: map to a ticket tier, **or** price directly on the booth. |
| Sequencing | One pass. |

## 1. Bowl geometry — `seat_maps.config`

`config` grows from `{ aspect, stage }` to:

```
{
  aspect,
  field:      { shape, x, y, width, height, rotation, label },
  background: { url, path, opacity }
}
```

`shape` ∈ `stage | pitch | court | rink | ring | runway | none`.

`normalizeSeatMap` reads a legacy `stage` key into `field` with
`shape: "stage"`, so every existing map keeps working with no migration. The
field renders as a shaped element in the centre of the canvas; sections are free
to ring it.

No DDL — `config` is already `jsonb`.

## 2. Rotation-correct seat generation

`lib/seating/generate.js` lays chairs in an axis-aligned box and ignores
`section.rotation`, which is applied only as a CSS transform on the block. That
is invisible today because seats are drawn solely in the normalised drill-down.
In a bowl, side and end sections are rotated 90–270° and their seat coordinates
must rotate with them.

`generateSeats` computes local coordinates as it does now, then rotates each
seat about the section centre by `section.rotation`. Pure; extends the existing
`generate.test.js`.

## 3. Ring generator — `lib/seating/bowl.js` (new, pure)

```
generateBowl({ shape, tiers, perSide, field, aspect }) -> section drafts
```

- shapes: `oval` (stadium), `rect` (arena), `horseshoe` (theatre), `rounds` (banquet)
- names by tier: `101…1NN`, `201…2NN`
- per-position rotation so every section faces the field
- output is ordinary section drafts; the editor persists and lets you drag any
  one to correct it

CSV import (`lib/seating/csv.js`, already built) then fills real rows and seat
labels into those sections.

## 4. Shared canvas — `components/internal/shared/map_canvas.jsx` (new)

One component, four consumers: seat map editor, seat map viewer, hall map
editor, booth picker.

- percent coordinate space with a `{ scale, tx, ty }` viewport
- wheel-zoom at cursor, drag-pan, pinch, double-click zoom, fit-to-view
- optional background image layer with opacity
- children render inside the transformed layer

**Drill-down stays.** Pan/zoom operates at the venue level; clicking a section
still opens its seat grid. That is what keeps a 20,000-seat venue from ever
rendering 20,000 nodes — the existing performance strategy.

## 5. Price colouring — `lib/seating/price_tiers.js` (new, pure)

```
(sections, sectionTiers, tickets) -> { colorBySectionId, legend }
```

Distinct prices sorted descending, bucketed onto a fixed 6-step token scale.
Legend renders under the map. No organiser configuration — it reads the
section→ticket mapping `event_seating.jsx` already collects.

## 6. Expo booths

New migration mirroring the seating one:

| Object | Purpose |
|---|---|
| `events.hall_maps` | venue-level template, same shape as `seat_maps` |
| `events.hall_booths` | stalls: `code`, `kind`, geometry, `size_class`, `price`, `amenities jsonb`, `active` |
| `events.booth_holds` | TTL, unique `(event_id, booth_id)` |
| `events.booth_assignments` | partial unique index on `released_at is null` — the double-book guard |
| RPCs | `public_event_hall_map`, `hold_booths`, `release_booths`, `release_order_booths`, `buy_booths` |

**Migration of existing booths.** `conference_records` with module `booth` are
copied into a per-project "Migrated hall" `hall_map`, carrying `config.x/y`
across and keeping the source record id in `metadata.sourceRecordId`.
`conference/floor_plan.jsx` is rewired to read `hall_booths`.

**Pricing** — `event.metadata.expo`:

```
{ hallMapId, pricing: "tier" | "direct", boothTiers: {}, holdMinutes }
```

- `tier` — booth maps to an event ticket, exactly as sections do
- `direct` — price comes from `hall_booths.price`; a nominated "Exhibitor space"
  tier carries the order line

Both run through `buy_booths` → `buy_ticket`, so orders, Stripe, discounts and
refunds are untouched. Booth inventory is guarded by the unique index, not the
tier counter. A per-booth `price` override also applies in `tier` mode.

## Files

**New:** `lib/seating/bowl.js` (+test), `lib/seating/price_tiers.js` (+test),
`components/internal/shared/map_canvas.jsx`, `lib/supabase/hall_maps.js`,
`lib/supabase/expo.js`, `venues/hall_maps.jsx`, `venues/hall_map_editor.jsx`,
`events/event_expo.jsx`, `events/hall_map_view.jsx`, `events/booth_picker.jsx`,
one migration.

**Modified:** `lib/seating/generate.js`, `lib/supabase/seat_maps.js`,
`venues/seat_map_editor.jsx`, `venues/venue_sections.jsx`,
`events/seat_map_view.jsx`, `events/seat_picker.jsx`, `events/event_seating.jsx`,
`events/event_sections.js`, `events/event_public_page.jsx`,
`conference/floor_plan.jsx`, `lib/supabase/orders.js`,
`app/api/checkout/route.js`, `lib/stripe/fulfill-checkout.js`.

## Risks

- Largest single diff in the app to date; delivered in one pass by request.
  Build order is chosen so each chunk is independently checkable: pure libs →
  canvas → seating screens → booth schema → booth data layer → booth screens →
  checkout → conference rewire.
- The conference booth migration is the only destructive-adjacent step. It
  copies rather than moves, and the source records are left in place.
