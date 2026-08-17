# 02 — Events

| | |
|---|---|
| **Nav items** | 4 — All Events, Templates, Event Series, Event Wall |
| **Registered** | 4/4 |
| **Tier** | **A — live**, and the quality bar for the rest of the app |
| **Key files** | `events/all_events.jsx` (667), `event_sections.js` (579, **50 sections in 12 groups**), `event_public_page.jsx` (3366), `page_design.jsx` (1546), `templates.jsx` (594), `event_series.jsx` (577) |

---

## 1. What this means in industry

The event object is the spine. At scale (Eventbrite, Cvent, Luma, Hopin) it carries:

- **Lifecycle** — draft → review → published → on-sale → live → ended → archived, with
  who-can-see-what at each stage and an unpublish that doesn't orphan sold tickets.
- **Recurrence** — real RRULE series (weekly, "3rd Thursday", exceptions, per-instance
  overrides), where each occurrence has its own inventory but shares a parent page.
- **Timezone correctness** — an event is stored in a venue timezone; every render
  (page, email, calendar, reminder) resolves to the *viewer's* zone. Getting this
  wrong is the classic event-platform bug.
- **Localization** — page and email content per locale.
- **Cloning & templates** — duplicate an event with configurable carry-over
  (keep tickets, drop dates), and org-level templates.
- **Capacity model** — overall capacity distinct from per-ticket-type inventory,
  with holds and comp allocations.

## 2. What exists today (verified)

Genuinely strong — this area is not the problem:
- Real list + CRUD, filters, search, stats, optimistic writes through `lib/supabase/events.js`
- A **50-section per-event editor** across 12 groups (General, Design, Page, Location,
  Tickets, Registration, Check-in, Communication, Sharing, Team, Settings) — this is more
  per-event depth than most competitors expose
- A block-based public page builder (`page_design.jsx`) rendering at `/e/[id]` via a
  3,366-line renderer, plus brand import
- Templates, Event Series, and a public Event Wall at `/w/<slug>`

Gaps found:
- `all_events.jsx:259` — `useState(EVENTS)` still seeds from a **static sample array**
  before the fetch resolves. `MODULE_CONVENTIONS.md` calls this out by name as legacy
  ("that is being removed; **don't copy it**") and it is still here.
- **No RRULE.** `grep rrule` → nothing. `lib/supabase/series.js` models a series as a
  manually-assembled list of events, not a recurrence rule with generated occurrences.
- **Timezone is stored but not normalized.** `timezone` appears in `lib/supabase/events.js`
  and `venues.js`, but there is no single resolve-to-viewer helper; date rendering goes
  through `formatDate` in `events/sample_data.js`.
- Localization exists as an editor section, but there is no locale-keyed content store
  or a locale switch on the public page.

## 3. Pending deliverables

### P0
- [ ] Remove the `useState(EVENTS)` seed in `all_events.jsx`; start `[]` + `loading`, per conventions
- [ ] `lib/time/event_time.js` — one helper that takes an event + a viewer zone and returns display strings; route **every** surface through it (page, editor, emails, calendar file, reminders, check-in)
- [ ] Move `formatDate` out of `events/sample_data.js` — a formatter living in a file named "sample data" is why sample data keeps leaking into screens

### P1
- [ ] RRULE-backed series: store the rule, generate occurrence rows, allow per-occurrence override and exception dates; "edit this / all future / all" semantics
- [ ] Event lifecycle states with an unpublish that keeps sold tickets valid, and an archive
- [ ] Clone-with-options dialog (carry tickets? dates? team? page design?)
- [ ] Overall event capacity as a first-class constraint checked in `buy_ticket`, separate from per-tier inventory

### P2
- [ ] Locale-keyed page/email content + a locale switch on `/e/[id]`
- [ ] Draft/approval routing for teams that require sign-off before publish
- [ ] Version history on page design (pairs with [00 H7 audit log](00-cross-cutting.md))

## 4. UX & component placement

### All Events
Frame today: `ScreenHeader → StatsBar → Toolbar(filters + search) → DataTable`. Correct
and consistent — the issues are density, not structure.

| Issue | Change |
|---|---|
| No bulk actions — you cannot publish, unpublish, tag, or archive several events at once | Adopt `selectable` + `BulkActionBar` from [00 H5](00-cross-cutting.md); actions: Publish, Unpublish, Duplicate, Add to series, Archive |
| No sort — a table of events with no "sort by date/revenue/sell-through" forces the user to eyeball | `sortable` columns; default sort by start date ascending for upcoming, descending for past |
| Past and upcoming events share one flat list | Add a segmented control (`Upcoming · Live · Past · Drafts`) in the `Toolbar`'s left slot, before the filters — this is how organizers actually think about their portfolio |
| The sell-through bar is a cell | Keep, but add the numeric (`412 / 500`) next to it — a bar without a number can't be compared across rows |
| Row click opens the editor at Overview every time | Remember the last section per event in the URL so returning lands where the user left |

### Event editor (50 sections)
This is the app's deepest surface and its navigation is now the bottleneck.

| Issue | Change |
|---|---|
| 12 groups × 50 items in one scrolling nav — finding "Access Codes" means knowing it lives under Tickets | Add a **command-palette jump** (`⌘K`) scoped to sections. One keystroke beats any grouping at this size |
| Every section is always visible even when irrelevant (Seating shows for an unseated event; Exhibitor Floor for a 20-person meetup) | **Progressive disclosure:** show a section when its feature is enabled for the event, and put the disabled ones behind a "Show all sections" toggle at the bottom of the nav. This is the single biggest perceived-complexity win in the product |
| No completion signal | Add a subtle state dot per nav item (configured / default / needs attention), and a publish-readiness checklist on the Overview section |
| Publish controls live inside the Overview section | Promote **Publish / Preview** to the editor header, always visible — it is the terminal action of every visit |

### Templates / Event Series / Event Wall
- Templates is a table of templates; it should be a **gallery** (`presentation: "gallery"` from [00 U1](00-cross-cutting.md)) — templates are chosen visually
- Event Series: add an occurrence timeline strip at the top of the detail so the shape of the series is visible before the table
- Event Wall: add a live preview panel beside the settings, matching how Page Design already previews

## 5. Schema / API work
- [ ] `events.event_series` gains `rrule text`, `timezone text`, `exdates date[]`
- [ ] `events.events` gains `lifecycle text` and `capacity integer` (overall), enforced in `buy_ticket`
- [ ] Index `(project_id, start_at)` for the upcoming/past split
