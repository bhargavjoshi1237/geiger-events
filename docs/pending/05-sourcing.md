# 05 — Sourcing

| | |
|---|---|
| **Nav items** | 4 — Smart Custom Proposals, Instant Book, Venue Sourcing, Housing & Travel |
| **Registered** | 2/4 — Venue Sourcing, Housing & Travel. **Smart Custom Proposals and Instant Book are `ComingSoon`** |
| **Tier** | **B — discovery works, procurement doesn't** |
| **Key files** | `conference/venue_sourcing.jsx` (437), `conference/housing_travel.jsx` (490), `app/api/venues/search/route.js`, `app/api/housing/search/route.js` |

---

## 1. What this means in industry

This is the **Cvent Supplier Network** lane, and its value is the procurement
loop, not the search box:

1. **Sourcing** — search venues/hotels by capacity, date, rate, region.
2. **RFP** — send one structured request to N venues: dates, room block, meeting
   space, F&B minimum, AV, attrition clause.
3. **Bids** — venues respond with rates and availability *into the platform*.
4. **Comparison** — a side-by-side bid grid: total cost, concessions, terms.
5. **Contract** — negotiate, e-sign, and convert the winner into a booked venue
   with its rate card attached.
6. **Instant Book** — for pre-negotiated inventory, skip 2–5 and book at a
   published rate with real availability.
7. **Housing** — a room block per hotel, an attendee booking link, pickup
   tracking against the block, and cut-off dates.

Steps 2–5 are the product. Search alone is a Google Maps query with extra steps.

## 2. What exists today (verified)

Real and decent:
- **Venue Sourcing** — Discover + Pipeline tabs over OpenStreetMap (free, no API key),
  rendered on the shared dark Leaflet map, with results saved into a pipeline as records
- **Housing & Travel** — the same pattern for stays and airport/rail gateways

Gaps:
- **No RFP object.** There is nothing to send, and no inbound channel for a venue to respond on.
- **No bid comparison**, so the pipeline is a bookmark list.
- **No contract or rate card**, so a "won" venue does not become a [03 Venue](03-venues.md) with terms.
- **No room block model**, so Housing tracks nothing — no inventory, no pickup, no cut-off.
- Instant Book has no availability source to book against.
- The pipeline is a set of `conference_records`; it does not link to `events.venues`, so
  sourcing and the venue module are two disconnected worlds.

## 3. Pending deliverables

### P0 — Close the loop to Venues
- [ ] "Convert to venue" on a pipeline record → creates/links an `events.venues` row with the address, geo, capacity and contact already captured. Without this, sourcing output is thrown away
- [ ] Pipeline stages as a real board: `Shortlist → RFP sent → Bid received → Negotiating → Won / Lost`

### P1 — The RFP loop
- [ ] `events.rfps` (event_id, dates, attendees, space needs, F&B, deadline) and `events.rfp_bids` (rfp_id, venue, rates jsonb, concessions, status)
- [ ] Send an RFP by email to N pipeline venues, each with a **tokenized public response link** — reuse the pattern already proven by `/e/<id>` public routes and portal tokens, so venues need no account
- [ ] Bid comparison grid: venues as columns, line items as rows, totals and deltas highlighted
- [ ] Award → contract terms stored on the venue rate card ([03 P1](03-venues.md))

### P2
- [ ] Room blocks: `events.room_blocks` (hotel, rate, inventory, cut-off), an attendee booking link, and pickup vs. block tracking
- [ ] Instant Book against published rate + availability
- [ ] Travel: flight/rail itinerary collection per attendee, arrival manifest for ground transport

### P0 alternative
- [ ] If the RFP loop is out of scope, **rename the section "Discovery & Pipeline"** and delete the two `ComingSoon` entries. The current names promise enterprise procurement.

## 4. UX & component placement

### Venue Sourcing (Discover tab)
| Issue | Change |
|---|---|
| Map and results compete for the same attention with no persistent link between them | Standard split: **results list left (40%), map right (60%)**, with hover-on-card → pin highlight and click-pin → scroll-to-card. This is the pattern users already know from every booking site, and it is the single biggest usability win here |
| Filters sit in the toolbar above, so changing one loses the map context | Move filters into a compact bar **above the results column only**, keeping the map fixed. Show active filters as removable chips |
| Saving to pipeline gives a toast and nothing else | Show an inline state change on the card ("In pipeline · Shortlist ▾") so the user can advance the stage without leaving Discover |

### Venue Sourcing (Pipeline tab)
| Issue | Change |
|---|---|
| A table of saved venues | This is pipeline data — render it as a **kanban board** by stage (`presentation: "board"` from [00 U1](00-cross-cutting.md)), with drag between stages. A procurement pipeline in a flat table hides exactly the information it exists to show |
| No comparison | Add "Compare selected" (needs [00 H5](00-cross-cutting.md) selection) → opens the bid grid |

### Housing & Travel
- Same split-view treatment for Discover
- Pipeline should show **block inventory as a progress bar** (picked up / blocked) per hotel — that number is the entire job of a housing manager
- Surface cut-off date as a countdown chip; it is a hard deadline with financial consequences

## 5. Schema / API work
- [ ] `events.rfps`, `events.rfp_bids`, `events.room_blocks`
- [ ] Public tokenized bid-response route (`app/rfp/[token]/page.js`), mirroring the portal token pattern
- [ ] Link `conference_records` sourcing rows to `events.venues` via `config.venueId`
