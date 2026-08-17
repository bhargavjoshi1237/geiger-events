# 21 — Sponsors & Expo

| | |
|---|---|
| **Nav items** | 5 — Sponsors, Sponsorship Packages, Sponsor Rooms, Expo Booths, Floor Plan & Booths |
| **Registered** | 5/5 |
| **Tier** | **A** for booth selling · **B** for everything sponsorship-related |
| **Key files** | `conference/floor_plan.jsx` (730), `venues/hall_map_editor.jsx` (681), `supabase/migrations/*_expo_booths.sql` (hall_maps, hall_booths, booth_holds, booth_assignments, `hold_booths`, `buy_booths`), `conference/modules.jsx` (sponsor, package, booth, sponsor_room), `lib/supabase/expo.js` |

---

## 1. What this means in industry

Sponsorship is **the highest-margin revenue line at most events**, and platforms
that serve it well (Cvent, Swapcard, Map Your Show, ExpoPlatform) treat it as a
sales-and-delivery pipeline, not a directory:

- **Prospectus & packages** — tiers with defined inventory (how many Gold slots
  exist), what each includes, and a public prospectus a prospect can read.
- **Sales pipeline** — prospect → proposal → contract → invoice → paid, with
  renewal from last year's sponsors.
- **Deliverable tracking** — every entitlement in the package (logo on site,
  logo on badge, 2 booth passes, a speaking slot, a mailing) tracked to
  fulfilment with an owner and a deadline. **This is what sponsorship teams
  actually spend their time on.**
- **Booth sales** — an interactive floor map where exhibitors pick and buy a
  stall, with holds and contracts.
- **Lead capture & ROI** — booth scans, leads per sponsor, cost per lead, and an
  end-of-event report the sponsor is sent to justify renewal.

## 2. What exists today (verified)

Genuinely strong on the physical side:
- **Booth selling is real and well-engineered** — `hall_maps` / `hall_booths` with
  percent geometry, **TTL holds (`booth_holds`) with a unique live-assignment index**,
  and a `buy_booths` wrapper mirroring the seating design. Concurrency is handled correctly
- An interactive **Floor Plan & Booths** screen (730 lines)
- Conference booth records were migrated into one booth concept (no duplicate models)

Weak on the commercial side:
- **Sponsors** and **Sponsorship Packages** are `conference_records` — a directory and a
  tier list. No pipeline stage, no contract, no invoice link
- **No deliverable tracking whatsoever** — a package lists what's included as text; nothing
  tracks whether the logo went up or the mailing went out
- **Sponsor Rooms** is a record with a pasted link (see [22 Broadcast](22-broadcast.md))
- **No lead capture** and therefore **no sponsor ROI** — [13 Sponsor ROI](13-analytics.md)
  is `ComingSoon` because there is nothing to report
- No public prospectus or exhibitor-facing portal

## 3. Pending deliverables

### P0 — Deliverables tracking (the missing core)
- [ ] Package **entitlements as structured line items**, not prose: `{ kind, quantity, description }` (logo placements, passes, speaking slots, mailings, booth credits)
- [ ] On sponsor sale, **instantiate the entitlements as tracked deliverables** with an owner, due date and status
- [ ] A fulfilment view (by sponsor and by deadline) — this single feature is the difference between a sponsor directory and a sponsorship product
- [ ] Package **inventory**: how many of each tier exist, how many sold, how many left

### P1
- [ ] Sponsor pipeline stages + a proposal/contract artifact; link to an [09 Order](09-orders.md) or invoice so sponsorship revenue lands in the same reporting as tickets
- [ ] **Lead capture** at booths — reuse the existing `jsqr` scanner ([12 Lead Retrieval](12-checkin.md)) so exhibitors scan attendee badges; store leads per sponsor with qualifiers
- [ ] **Sponsor ROI report** — impressions, booth scans, leads, sessions attended by their leads — generated and emailed post-event. This is the renewal document
- [ ] Exhibitor portal (magic-link, same pattern as [20 Speakers](20-speakers.md)): manage booth details, staff passes, upload logo, view leads

### P2
- [ ] Public sponsorship prospectus page (reuse the `/e/[id]` renderer)
- [ ] Renewal workflow from last year's sponsor list

## 4. UX & component placement

### Sponsors
| Issue | Change |
|---|---|
| A table of sponsor names | Sponsors are logos — **gallery presentation** grouped by tier, with the logo, tier badge, and a deliverables progress ring. Tier grouping is how everyone thinks about a sponsor list |
| Value isn't shown | Columns/cards should carry contract value and deliverable completion. A sponsor list without money and progress is an address book |
| No pipeline view | Add a board presentation by stage for prospects, with a `Sold` column feeding the gallery |

### Sponsorship Packages
| Issue | Change |
|---|---|
| Tiers as table rows | **Pricing-card layout** ordered by value, each showing price, what's included as a checklist, and **`4 of 6 sold`** inventory. This screen is a prospectus; it should look like one |
| Inclusions are free text | Structured entitlement rows with quantity — this is also what P0 needs to instantiate deliverables |

### Floor Plan & Booths (already strong)
| Issue | Change |
|---|---|
| Map and booth list compete | Adopt the same **list-left / map-right** contract used in [05 Sourcing](05-sourcing.md); hovering a booth row highlights the stall and vice versa |
| Sales state isn't legible at a glance | Colour stalls by state (available / held / sold / reserved) with a **legend docked bottom-left** and a live counter (`38 of 60 sold · 4 on hold`). A floor plan's job is to communicate sell-through instantly |
| Holds expire silently | Show a countdown on held stalls — the TTL is real data and it belongs on screen |

### Sponsor Rooms
- See [22](22-broadcast.md) — same "pasted link" issue. At minimum, show whether the link is live and how many attendees have visited it

## 5. Schema / API work
- [ ] `events.sponsorship_packages` gains `entitlements jsonb[]` and `inventory integer`
- [ ] `events.sponsor_deliverables` (sponsor_id, kind, quantity, owner_id, due_at, status, evidence_url)
- [ ] `events.leads` (sponsor_id, contact_id, qualifiers jsonb, captured_at) — shared with [12 Lead Retrieval](12-checkin.md), one table not two
- [ ] Link sponsor records to booth assignments and to orders/invoices by id
