# Venue Location Parity & Clean Event Attach — Design

**Date:** 2026-07-05
**Area:** Venues + Events (location)
**Status:** Approved (pending spec review)

## Problem

A venue is meant to be the reusable source of truth for *where* an event happens,
so an organizer sets a place up once and reuses it. Today that promise is only
half-kept:

- The **venue's Location section** (`venues/venue_sections.jsx → LocationSection`)
  is plain text fields plus manual latitude/longitude inputs. There's no map, no
  address search, no pin drop, and no way to capture the nearby transport /
  parking / food that the event editor can auto-detect.
- The **event editor** already has the rich tooling — an interactive
  `LocationPicker` (search / pin / coordinates on a live map) and a **Map &
  Directions** section that auto-detects nearby places — but its "Saved venue"
  picker only copies four fields (`venue`, `address`, `city`, `timezone`). It
  drops coordinates, notes, and every detected nearby place on the floor.

So attaching a venue to an event barely saves any work, and the venue can't hold
the location detail worth reusing in the first place.

## Goal

1. **Venue Location parity** — bring the event editor's interactive map picker
   *and* nearby-amenities auto-detect into the venue's Location section, so the
   venue captures the full location setup.
2. **Clean attach + full prefill** — in the event editor, attaching a venue
   cleanly prefills *everything* location (address, city, timezone, map pin,
   parking/transit notes, and detected nearby places) into both the Location and
   Map & Directions sections, overwriting existing event location data. Show the
   link with a Detach affordance.

Chosen options (confirmed with the user): **Full parity**, **prefill everything
location**, **overwrite from venue** on attach.

## Non-goals

- No schema migration. We reuse the venue's existing `latitude`/`longitude`
  columns, its `metadata` bag + `venue_merge_meta` RPC, and the event's existing
  `venue_id` column + `map` metadata config.
- No live re-sync. Attach is a one-time **snapshot/prefill** — later venue edits
  don't retro-update already-attached events (the event keeps its own editable
  copy). This matches the existing "text snapshot" model.
- Date & time stay event-only. A venue has no schedule; only the *place* fields
  cross over.
- No moving/renaming the shared map components (out of scope — see "Shared
  primitives").

## Shared primitives (reuse, don't duplicate)

The map tooling already lives in the events area and is generic apart from
naming. The venue Location section imports it **in place** rather than forking:

- `events/location_picker.jsx` → `LocationPicker`, `LocationModeTabs`
- `events/event_map.jsx` → `EventMap`, `NearbyList`, `nearbyGroups`, `hasNearby`,
  `flattenPlaces`, `GETTING_THERE_GROUPS`, `AROUND_VENUE_GROUPS`, `WeatherCard`
- `lib/map/geo` → `resolveEventLocation`

Cross-area imports already exist in both directions (`venues/all_venues.jsx`
imports `newId` from events; `events/location_time.jsx` imports `listVenues` from
venues), so this is consistent with the codebase. These components are treated as
shared map primitives that happen to live under `events/`.

## Data model

No new columns. Two representations meet at the attach boundary:

| Concept | Venue store | Event store |
|---|---|---|
| Coordinates | `latitude` / `longitude` columns → `{lat,lng}` in the section | `map.coords = {lat,lng}` (metadata via `useEventConfig`) |
| Parking notes | `parking_notes` column (`venue.parkingNotes`) | `map.parking` |
| Transit notes | `transit_notes` column (`venue.transitNotes`) | `map.transport` |
| Nearby places | `metadata.nearby = { nearbyParking, nearbyTransit, nearbyBike, nearbyTaxi, nearbyCharging, nearbyHotels, nearbyFood }` | `map.nearby*` (same keys, flat on the `map` config) |

The venue's `nearby` metadata object uses the **same bucket keys** the event's
`map` config uses, so `flattenPlaces` / `nearbyGroups` / `hasNearby` work on it
directly (coords passed separately to `EventMap`).

## Part 1 — Venue Location section (full parity)

Rewrite `LocationSection` in `components/internal/screens/venues/venue_sections.jsx`.
It receives `{ venue, patch, commit }` (already passed to every section). Local
state holds the picker mode and the working `nearby` buckets (seeded from
`venue.nearby`).

**Coords adapter.** `coords = (venue.latitude != null && venue.longitude != null)
? { lat: Number(venue.latitude), lng: Number(venue.longitude) } : null`. The
picker's `onChange({ address?, coords? })`:
- `address` → `patch({ address })`
- `coords` → `patch({ latitude: c.lat, longitude: c.lng })` (persisted on the
  venue's top "Save changes" / any `commit`, consistent with the other columns).

**Layout (top to bottom):**
1. Section header with `LocationModeTabs` pinned right (mirrors the event
   section). For a `Virtual` venue, show a dashed "no physical location" note
   instead of the picker (mirrors the event's Remote case).
2. `LocationPicker` (search / pin / coordinates + live map).
3. **Address card** — street `address`, `city`, `region`, `postcode`, `country`,
   `timezone` (existing columns, via `patch`).
4. **Map & directions card** —
   - `EventMap` centered on `coords`, plotting `flattenPlaces(nearbyConfig)`.
   - A **"Nearby amenities"** button → `resolveEventLocation(address)`; on
     success set the buckets, `commit({ latitude, longitude })` (so the detected
     pin sticks immediately) and `mergeVenueMeta(venue.id, { nearby })` to
     persist the buckets without a manual Save. Reflect into local state + form
     (`patch({ nearby })`) so the UI updates and the list stays in sync.
   - `NearbyList` for getting-there + around-venue groups when present; a dashed
     "Run Nearby amenities…" hint otherwise.
   - `parkingNotes` / `transitNotes` textareas (existing columns, via `patch`).

**Persistence rules (per conventions):**
- Columns (`address`, `city`, `region`, `postcode`, `country`, `timezone`,
  `latitude`, `longitude`, `parkingNotes`, `transitNotes`) persist through the
  venue's whole-form path (`updateVenue`) — the existing model. `commit` is used
  for the immediate coord write on auto-detect.
- The `nearby` buckets persist **only** through `mergeVenueMeta` (the shallow
  merge RPC), never through `updateVenue` — so saving the Location section never
  clobbers other metadata sections. `toRow` ignores `nearby`, so the whole-form
  save leaves it untouched; on reload `normalizeVenue` spreads `metadata.nearby`
  back onto the view model.

No change to `lib/supabase/venues.js` is required: `latitude`/`longitude` are
already mapped, and `mergeVenueMeta` already exists.

## Part 2 — Clean attach + full prefill (event editor)

Rework the venue-attach UX in
`components/internal/screens/events/location_time.jsx → LocationTimeSection`.

**Attached-venue card.** Replace the small inline `<Select>` buried in "Venue
details" with a clear card at the top of the Venue details block:
- **Not linked:** a `Select` ("Attach a saved venue") + hint that picking one
  fills in the location, or free-type the venue name below (typing a name detaches
  → `venueId: null`, keeping today's behavior).
- **Linked:** a chip showing the venue name · city, with **Detach**
  (`patch({ venueId: null })`, keeps the snapshot) and **Change** (reopens the
  select). A short line notes fields were prefilled from the venue and can be
  edited per-event.

**`pickVenue(id)` — prefill everything (overwrite).** Reads the full normalized
venue from the already-loaded `venues` list (it includes `latitude`/`longitude`
and the spread `nearby` metadata):

- Event columns via `patch` + `commit` (so they persist):
  - `venue` ← `v.name`
  - `venueId` ← `v.id`
  - `address` ← `venueFullAddress(v)` (composed; falls back to `v.address`)
  - `city` ← `v.city`
  - `timezone` ← `v.timezone`
- `map` config via `setMapCfg` + `saveMapCfg` (persists the metadata config):
  - `coords` ← `{ lat: v.latitude, lng: v.longitude }` when both present, else
    cleared
  - `parking` ← `v.parkingNotes`
  - `transport` ← `v.transitNotes`
  - `nearbyParking … nearbyFood` ← the matching keys from `v.nearby`

Because coords + notes + nearby all live on the event's `map` config, one attach
seeds both the Location and the Map & Directions sections. Overwrite is
unconditional (the user explicitly picked the venue).

**Helper.** Add `venueFullAddress(v)` to `venues/constants.js`:
`[address, city, region, postcode, country].filter(Boolean).join(", ")`. Reused
by the event attach for a geocoder-friendly, human-readable address.

## Files touched

| File | Change |
|---|---|
| `components/internal/screens/venues/venue_sections.jsx` | Rewrite `LocationSection` to the rich picker + map + nearby-detect; import shared map primitives; persist coords via columns and `nearby` via `mergeVenueMeta`. |
| `components/internal/screens/venues/constants.js` | Add `venueFullAddress(v)` helper. |
| `components/internal/screens/events/location_time.jsx` | Attached-venue card (attach / detach / change); expand `pickVenue` to prefill coords + notes + nearby into the `map` config alongside the columns. |

No SQL, data-layer, registry, or permissions changes.

## Edge cases

- **No coords on the venue** → attach clears `map.coords`; the event's map falls
  back to geocoding the prefilled address (existing behavior).
- **Venue with no nearby data** → buckets prefill empty; the event's "Nearby
  amenities" button still works per-event.
- **Detach** keeps the event's prefilled snapshot (address/coords/notes/nearby)
  and just clears the link — nothing is wiped.
- **Virtual venue** → Location section shows the no-physical-location note; attach
  still carries name/timezone.
- **Local-only (no DB)** → `mergeVenueMeta` returns `null`; the section treats
  that as a successful local update (matches the existing convention).

## Testing / verification

- Lint changed files (`npx eslint`).
- Manual: create a venue, set location via search + pin + coordinates, run Nearby
  amenities, reload → data persists. Create an event, attach the venue → Location
  and Map & Directions both populate (address, pin, notes, nearby). Detach →
  snapshot stays. Type a manual venue name → link clears.
