# 17 — Discovery

| | |
|---|---|
| **Nav items** | 1 (no sub-items) |
| **Registered** | 1 — `discovery/organiser_profile.jsx` (467) |
| **Tier** | **B — a profile page, not a discovery system** |
| **Key files** | `discovery/organiser_profile.jsx`, `events/event_wall/wall_detail.jsx`, `lib/supabase/discovery.js` + `event_wall.js`, public route `/w/<slug>` |

---

## 1. What this means in industry

"Discovery" on Eventbrite, Luma, DICE or Meetup is a **two-sided growth engine**,
and the organiser profile is only its smallest part:

- **A public directory** — browsable/searchable events by city, date, category
  and price, with SEO-indexed landing pages per city/category. This is how
  platforms acquire buyers the organizer never had.
- **Follow graph** — attendees follow organizers and get notified of new events;
  organizers see follower growth as an owned audience.
- **Recommendations** — "because you attended X", trending near you, friends
  going.
- **Social proof** — attendance counts, "12 friends going", reviews/ratings.
- **Syndication** — structured data (`Event` schema.org), Google Events,
  Facebook Events, calendar feeds, partner distribution.

## 2. What exists today (verified)

- A project-level **public organiser profile** rendered on the `/w/<slug>` Event Wall
- A follow-for-updates concept on the wall
- `lib/supabase/discovery.js` + `event_wall.js` backing it

Gaps — essentially everything that makes discovery a growth channel:
- **No directory, no search, no browse.** There is no route where a buyer who
  doesn't already have your link can find an event
- **No categories, no location-based browse**, so no SEO surface area
- The follow graph exists as a concept but **has no notification path** ([00 H2](00-cross-cutting.md)) —
  following produces nothing
- No recommendations, no social proof, no ratings
- Syndication: verify that `/e/[id]` emits `schema.org/Event` JSON-LD and a
  calendar feed; if not, that is the highest-ROI item here by a wide margin

## 3. Pending deliverables

### P0 — Make each event findable (SEO first, product second)
- [ ] `schema.org/Event` JSON-LD on `/e/[id]` — name, dates, location, offers, performer. This is what puts an event into Google's event experience and it is a day of work
- [ ] Proper metadata: canonical URL, OG/Twitter cards with the cover image, sitemap including published events
- [ ] `.ics` feed per event and per organiser wall

### P1 — A real directory
- [ ] Public browse route (`/discover`) with search, and filters for date, city, category, price
- [ ] Category taxonomy on the event ([02 Events](02-events.md) schema)
- [ ] SSG/ISR city and category landing pages — this is where organic traffic comes from
- [ ] Follow → notification on new event publish (job + send stack)

### P2
- [ ] Recommendations from attendance history
- [ ] Social proof (attendee count, "friends going" once the portal has a social graph)
- [ ] Post-event ratings/reviews feeding organizer reputation

## 4. UX & component placement

### Organiser Profile (internal screen)
| Issue | Change |
|---|---|
| Settings-style form with no readback | **Split it: form left, live wall preview right** — this screen edits a public page and the user cannot see the consequence. `page_design.jsx` already establishes this pattern in the codebase; reuse it |
| The public URL is buried | Put the `/w/<slug>` URL in the `ScreenHeader` with copy + "Open" buttons — it's the single most-used thing on this screen |
| Follower count isn't shown | Add a `StatsBar`: followers, profile views, events published, total attendance. A profile screen with no audience metrics gives no reason to return |
| No sense of what followers receive | Show a "what followers get" summary, and mark it honestly today: *"Follow notifications aren't sent yet."* |

### Event Wall
| Issue | Change |
|---|---|
| Editing the wall and viewing it are separate mental modes | Same split-preview treatment; add device toggle (desktop/mobile) since most wall traffic will be mobile |
| Ordering of events on the wall isn't controllable | Add explicit ordering (manual pin + auto by date) — organizers will want a featured event at the top |

### If a directory gets built (`/discover`)
- Follow the same **list-left / map-right** pattern already established in [05 Sourcing](05-sourcing.md) so the app has one geographic browse idiom, not two
- Filter chips above the results, never a sidebar of checkboxes — mobile is the primary surface for discovery
- Event cards: image, date block, title, venue, price-from, and a going-count. Cards without a date block scan poorly

## 5. Schema / API work
- [ ] `events.events` gains `category`, `is_listed boolean`, `city`, `geo`
- [ ] `events.follows` (project_id, contact_id, created_at) + a job kind `discovery.notify_followers`
- [ ] Public read policy for listed events (separate from the existing per-event public access)
- [ ] `app/discover/` route with ISR, and `sitemap.js` / `robots.js`
