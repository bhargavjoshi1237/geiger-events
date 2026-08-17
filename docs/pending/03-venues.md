# 03 — Venues

| | |
|---|---|
| **Nav items** | 1 (no sub-items; per-venue concerns are editor sections) |
| **Registered** | 1 — `venues/all_venues.jsx` (497) |
| **Tier** | **A — live** |
| **Key files** | `venues/venue_sections.jsx` (751, 8 sections), `seat_map_editor.jsx` (1042), `hall_map_editor.jsx` (681), `lib/supabase/venues.js`, `seat_maps.js`, `hall_maps.js` |

---

## 1. What this means in industry

A venue record in Cvent / Tripleseat / Eventbrite is the **reusable physical
asset**: address and timezone, capacities *per setup style*, rooms and
sub-spaces, seat maps, load-in/AV specs, contacts, contracted rates, blackout
dates and availability, plus accessibility and compliance notes that must appear
on every event held there.

The two things that separate a real venue module from an address book:
**availability** (is this room free on that date, and does booking an event hold
it?) and **capacity as a constraint** (a room that seats 200 theatre-style seats
120 banquet-style, and the platform knows the difference).

## 2. What exists today (verified)

Strong, and better than the sidebar suggests:
- 8-section venue editor: Details, Location (incl. timezone), Capacity & amenities,
  **Seat maps**, **Exhibitor halls**, Contact, Dietary & Accessibility, Media
- A real seat-map editor (1042 lines) on a shared `MapCanvas` with floors/sections/rows,
  and a hall/booth map editor sharing the same primitives
- Guidelines defined here propagate to every event at the venue
- Venue selection fills in event location and renders on the public page

Gaps:
- **No availability or booking model.** Two events can be assigned the same venue on the
  same date with no warning.
- **Capacity is a single number**, not per setup style — so the Setup Styles & Capacity
  screen in [04 Event Design](04-event-design.md) has nothing to compute against.
- No rooms/sub-spaces: a venue is flat, so you cannot book "Hall B" independently.
- No contracted rates or blackout dates, so [05 Sourcing](05-sourcing.md) has nowhere to
  land a negotiated deal.

## 3. Pending deliverables

### P0
- [ ] `events.venue_spaces` — rooms/sub-spaces belonging to a venue, each with its own capacity set and seat/hall map
- [ ] Per-setup-style capacity: `{ theatre, classroom, banquet, reception, boardroom }` on the venue/space, so [04](04-event-design.md) can do real capacity checks
- [ ] Conflict detection: warn when assigning a venue/space already used by an overlapping event

### P1
- [ ] Availability calendar per venue/space, with blackout dates and holds
- [ ] Contracted rate card (day rate, F&B minimum, overtime) so Sourcing can convert a proposal into a booked venue
- [ ] Load-in / AV / power spec fields (surfaced to Speakers and Broadcast)

### P2
- [ ] Photos + 360 media that feed the [04](04-event-design.md) 3D walkthrough
- [ ] Venue-level analytics (events held, attendance, revenue per venue)

## 4. UX & component placement

### All Venues
| Issue | Change |
|---|---|
| Venues are rendered as a table row of text | Venues are visual and spatial — switch to a **gallery presentation** with the cover image, capacity, city, and a count of events held. Keep table as a toggle for bulk work |
| No map view, despite Leaflet already being a dependency and a shared dark map existing (used by Venue Sourcing) | Add a `Map` / `List` toggle in the `Toolbar`'s right slot, reusing the sourcing map — seeing your venues geographically is the reason to have a venue module |
| No "used by N events" signal | Add a column/badge; it is the main thing that makes a venue worth keeping or archiving |

### Venue editor
| Issue | Change |
|---|---|
| Seat maps and Exhibitor halls are buried as sections 4 and 5 in a right-hand nav | These are the highest-value assets here. Move the section nav to the left ([00 U3](00-cross-cutting.md)) and give both a thumbnail preview in the nav item, so the user sees what exists without clicking |
| The seat-map editor opens full-bleed with no persistent exit affordance beyond the back arrow | Add a sticky editor toolbar: `[← Venue] [map name] [floor selector] … [seats: 412] [Save]` — the seat count is the number the user is actually working toward and it should never scroll away |
| Capacity is one input | Replace with a small matrix of setup styles × capacity, with the seat-map-derived count shown as a read-only comparison row |
| Dietary & Accessibility here duplicates the event-level screen with no indication of inheritance | Show the inheritance explicitly: "Applies to all events at this venue — 4 events inherit this. Events may add their own." |

## 5. Schema / API work
- [ ] `events.venue_spaces` (venue_id, name, capacities jsonb, seat_map_id, hall_map_id)
- [ ] `events.venue_bookings` (space_id, event_id, starts_at, ends_at) with an exclusion constraint on overlapping ranges — Postgres `tstzrange` + `EXCLUDE USING gist` is the right tool and prevents double-booking at the database level
- [ ] `events.events.venue_space_id` alongside `venue_id`
