# Dietary & Accessibility — Guidelines, Post-Purchase Requests & Ticket-Form Inquiry

**Date:** 2026-07-05
**Area:** Registrations screen + Events editor + Venues editor + public event page
**Status:** Proposed — awaiting user review

---

## 1. Summary

Three related capabilities, all themed around dietary & accessibility:

1. **Guidelines (informational, public).** An organizer-authored set of dietary &
   accessibility guidelines that **clarify attendees' doubts**, shown read-only on the public
   event page. Authored in **two places** and **merged**: on the **venue edit page** (applies
   to every event at that venue) and on the **event edit page** (event-specific additions).

2. **Post-purchase requests.** Once someone has a ticket/registration, the **order-success
   (confirmation) step** offers a **custom free-text query** they can send to the organizer.
   **No anonymous submissions** — the request affordance only appears after a completed
   sign-up. Gated by a project **master switch** on the D&A screen *and* a **per-event**
   opt-in. Submissions land in a **Requests inbox** on the D&A screen.

3. **Ticket-form inquiry.** A reusable set of **radio + multiselect** questions built on the
   D&A screen. Each event opts in via **"Attach Dietary & Accessibility inquiry"** on its
   **Ticket Types** tab; when attached, the questions render in the ticket/registration form
   at checkout and answers are stored **per-person**, surfaced on the D&A screen.

The D&A screen (`dietary_accessibility.jsx`, today a read-only needs report) becomes
**tabbed**: *Needs report* · *Requests* · *Inquiry*.

### Decisions captured from the clarifying round

- **Requests scope:** master switch on D&A screen **AND** per-event opt-in; **post-purchase
  only** (shown on the confirmation step, never anonymously). *(user-selected)*
- **Guidelines:** authored on **venue** + **event** edit pages, **merged** on the public
  page (both shown, venue first). *(user-selected concept; merge + shape are assumed
  defaults below)*
- **Inquiry answers:** stored **per-person** on the registration + an aggregate breakdown.
  *(user-selected)*
- **D&A layout:** **tabbed**. *(user-selected)*

### Assumed defaults (user was away when asked — confirm on review)

- **Guideline shape:** a **categorized list of items** — each `{ id, category:
  'dietary' | 'accessibility', label, detail? }`. Rendered grouped by category.
- **Venue + event merge:** **both shown** (venue guidelines first, then the event's) — the
  event adds to, does not replace, the venue's.
- **Request availability on free RSVPs:** shown on the confirmation step for **any completed
  sign-up** (paid purchase or free RSVP), since both mean the person is registered.

---

## 2. Why this shape (fits existing conventions)

- **Guidelines ride metadata bags — mostly no SQL.**
  - *Venue:* persisted through the existing `mergeVenueMeta(venue.id, { guidelines })` RPC +
    the `...meta` spread in `normalizeVenue` (precedent: the `nearby` bucket). **No venue SQL
    change.**
  - *Event:* persisted via `useEventConfig(event, "guidelines", [])` → `updateEventMeta`
    shallow-merge (exactly like `offerings`/`rsvp`). **No event SQL change.**
- **Public page already has an anon path to the venue.** `getVenue(venueId)` is anon-readable
  (`venues_public_read` RLS in `zz_project_access.sql`), and the page already fetches the
  venue inside `VenueDetailsDialog`. Merging `venue.guidelines` + `event.guidelines` needs
  only a body-level `getVenue` fetch.
- **Requests are post-purchase**, so they attach to a known `registration_id` on the
  confirmation step — a client call to an anon `SECURITY DEFINER` RPC (like public
  registration). **No new API route.**
- **Inquiry answers ride the existing `answers` jsonb path** (`buildRegistration` →
  `registerForEvent` / `/api/checkout` → `verify`, which already forwards `answers`). **No
  checkout API change.**
- The radio/multiselect **builder UX mirrors `offerings.jsx`**; the guideline editors mirror
  the venue/event section patterns; the requests inbox mirrors the existing D&A `DataTable`.

---

## 3. Data model

### 3.1 New — `supabase/sqls/dietary.sql` (idempotent, schema `events`)

Only the **project-level inquiry config** and the **requests inbox** need real tables.
Guidelines live in the venue/event metadata bags (no tables).

**`events.dietary_config`** — one row per project (the D&A screen's settings):

| column | type | notes |
|---|---|---|
| `project_id` | `uuid primary key references public.project(id) on delete cascade` | row key |
| `requests_enabled` | `boolean not null default false` | **master** switch for post-purchase requests |
| `request_prompt` | `text` | helper text above the request textarea |
| `inquiry_title` | `text` | optional intro heading in the ticket form |
| `inquiry_description` | `text` | optional intro copy |
| `questions` | `jsonb not null default '[]'` | `[{ id, label, type:'radio'\|'multiselect', required, options:[{id,label}] }]` |
| `metadata` / `created_at` / `updated_at` | | `updated_at` trigger; upsert on `project_id` |

**`events.dietary_requests`** — one row per submitted custom query:

| column | type | notes |
|---|---|---|
| `id` | `uuid pk` | |
| `project_id` | `uuid references public.project(id) on delete cascade` | scopes the inbox |
| `event_id` | `uuid references events.events(id) on delete cascade` | which event |
| `registration_id` | `uuid references events.registrations(id) on delete set null` | always set (post-purchase) |
| `name` / `email` | `text not null default ''` | pre-filled from the buyer |
| `message` | `text not null default ''` | the query |
| `status` | `text not null default 'Open'` | `Open` \| `Resolved` |
| `metadata` / `created_at` / `updated_at` / `deleted_at` | | soft-delete; lists filter `deleted_at is null` |

Indexes on `(project_id) where deleted_at is null`, `(event_id) where deleted_at is null`,
`(created_at desc)`. RLS: demo `for all to anon, authenticated using (true)`.

**RPCs** (`anon, authenticated`, `SECURITY DEFINER`, `set search_path = events, public`):
- `events.dietary_public_config(p_project_id uuid)` → `(requests_enabled, request_prompt,
  inquiry_title, inquiry_description, questions)`; empty defaults when no row. Lets the anon
  public page read config.
- `events.submit_dietary_request(p_project_id, p_event_id, p_registration_id, p_name,
  p_email, p_message)` → inserts (ignoring blank messages), returns the row.

### 3.2 Metadata bags (no migration)

- **Venue** `metadata.guidelines`: `[{ id, category, label, detail? }]` — via `mergeVenueMeta`.
- **Event** `metadata.guidelines`: same array shape — via `useEventConfig(event,"guidelines",[])`.
- **Event** `metadata.dietaryInquiry`: `{ attach: boolean }` — the Ticket-Types opt-in.
- **Event** `metadata.dietaryRequests`: `{ enabled: boolean }` — the per-event request opt-in.

Three independent event keys so each section's save shallow-merges without clobbering the
others (per the metadata-merge convention).

---

## 4. Data layer — `lib/supabase/dietary.js` (new)

Pure, guarded, snake↔camel; `console.error` + `null/false/[]`, never throws/toasts.

- `normalizeConfig` / `normalizeRequest`; `getDietaryConfig(projectId)` (defaulted view-model
  even with no row); `upsertDietaryConfig(projectId, patch)` (onConflict `project_id`) —
  serves the requests toggle, prompt, and question-set saves.
- `listDietaryRequests(projectId)`, `updateDietaryRequest(id, { status })`,
  `softDeleteDietaryRequest(id)`.
- `getPublicDietaryConfig(projectId)` (RPC) and `submitDietaryRequest(input)` (RPC) for the
  public page.

Constants added to `registrations/constants.js`: `DIETARY_QUESTION_TYPE_OPTIONS`
(radio/multiselect), `DIETARY_REQUEST_STATUS_MAP`, and a small `GUIDELINE_CATEGORY_MAP`
(dietary/accessibility → label + icon/variant). Guideline category options can also be
imported by the venue/event editors.

---

## 5. UI — Dietary & Accessibility screen (tabbed)

`dietary_accessibility.jsx` gains shadcn `Tabs`; also fetches `getDietaryConfig` +
`listDietaryRequests` alongside the current registrations/events load.

- **Needs report** (existing) — plus, when the inquiry has questions, an **inquiry aggregate**
  (counts per option across registrations' `answers`) and per-person inquiry answers.
- **Requests** — `SettingRow` **"Enable Dietary & Accessibility Requests"** (master) +
  `Textarea` request prompt; then the **inbox**: `Toolbar` (search + event filter) →
  `DataTable` (Registrant, Event, Message, Date, Status). Actions: mark resolved/reopen,
  delete (soft), CSV export. Loading/empty/filtered-empty states.
- **Inquiry** — optional title/description + a **radio/multiselect question builder** modelled
  on `offerings.jsx` (label, type, options editor, required, reorder ▲▼, delete, add, Save).
  Note: *"Attach it per event from that event's Ticket Types tab."*

All optimistic + `toast`; semantic tokens; three list states.

---

## 6. UI — event & venue editors

### 6.1 Venue — new `GuidelinesSection` in `venue_sections.jsx`
- Nav entry in `VENUE_NAV`, component in the `SECTIONS` map. Takes `{ venue, patch, commit }`.
- Editor for the guideline **item list** (category select, label, detail, add/remove/reorder).
- Persists via `mergeVenueMeta(venue.id, { guidelines })` (metadata bag — the `nearby`
  precedent), since `commit`/`toRow` only serializes mapped columns.

### 6.2 Event — new `components/internal/screens/events/guidelines.jsx` `GuidelinesSection`
- Registered in `event_sections.js` (`NAV_GROUPS` — **Page** group, near description/questions;
  `SECTIONS` map). Uses `useEventConfig(event, "guidelines", [])`.
- Same guideline item-list editor as the venue (shared child component to avoid duplication).
- Also hosts the **per-event "Enable post-purchase requests"** toggle
  (`useEventConfig(event, "dietaryRequests", { enabled:false })`), with a hint that the
  project master switch on the D&A screen must also be on.

### 6.3 Event — "Attach Dietary & Accessibility inquiry" on `TicketsSection` (`event_builder.jsx`)
- A `SectionCard` beneath the tiers list: `useEventConfig(event, "dietaryInquiry", { attach:false })`
  + `SettingRow`. When on, fetch `getDietaryConfig(projectId)` (via `useProject`) and **list
  the project's inquiry questions read-only** (label + type badge + option chips). If none
  exist yet, an inline hint links to the D&A → Inquiry tab.

---

## 7. Public event page (`event_public_page.jsx`)

`EventPublicPageContent` gains two mount fetches: `getPublicDietaryConfig(event.projectId)` →
`daConfig`, and `getVenue(event.venueId)` → `venue` (when `venueId` set; mirrors the dialog's
existing fetch).

### 7.1 Guidelines block (public, informational)
- Render a **"Dietary & Accessibility"** block in the content column merging
  `venue.guidelines` + `event.guidelines` (venue first), grouped by category. Shown whenever
  any items exist — no toggle. Read-only.

### 7.2 Inquiry questions in the ticket form
- When `event.dietaryInquiry?.attach && daConfig.questions.length`: render radio/multiselect
  questions in the checkout fields grid (after the existing `regQuestions.map`). Answers write
  into the `answers` state under a stable prefix (`dietary:<questionId>`) to avoid key
  collisions; required ones validated in `submitDetails`. Flows through the existing `answers`
  path (free + paid). **No route changes.**

### 7.3 Post-purchase request (order-success only)
- On the confirmation (`done`) step, when the **master** `daConfig.requestsEnabled` **and**
  the per-event `event.dietaryRequests?.enabled` are both on: show a **"Send a dietary /
  accessibility request"** affordance (button → inline `Textarea`, prompt from
  `request_prompt`), pre-filled with the buyer's name/email. Submit →
  `submitDietaryRequest({ projectId, eventId, registrationId, name, email, message })` →
  toast. **Not shown anywhere pre-purchase.**

---

## 8. Files touched

**New**
- `supabase/sqls/dietary.sql`
- `lib/supabase/dietary.js`
- `components/internal/screens/events/guidelines.jsx` (event guidelines section; exports a
  shared `GuidelineListEditor` child reused by the venue section)

**Modified**
- `components/internal/screens/registrations/dietary_accessibility.jsx` — tabs + requests inbox + inquiry builder
- `components/internal/screens/registrations/constants.js` — question-type / request-status / guideline-category maps
- `components/internal/screens/venues/venue_sections.jsx` — venue `GuidelinesSection` (nav + map + component)
- `components/internal/screens/events/event_sections.js` — register the event guidelines section
- `components/internal/screens/events/event_builder.jsx` — "Attach D&A inquiry" on `TicketsSection`
- `components/internal/screens/events/event_public_page.jsx` — venue + config fetch, guidelines block, inquiry questions, post-purchase request

**Unchanged (verified sufficient):** `app/api/checkout/*` (already forwards/files `answers`),
`registrations.js` register path, venues SQL (metadata bag + anon read already present).

---

## 9. Out of scope / non-goals

- No per-event customization of the inquiry question set (one project set; events attach/detach).
- No email notification on a new request (in-app inbox only; could reuse `approval-email` later).
- No change to the existing free-text dietary/accessibility bucketing at checkout — it stays;
  the inquiry is additive structured data, guidelines are organizer-authored and separate.
- Guidelines are display-only publicly (no attendee submission against them).

---

## 10. Build order

1. `dietary.sql` + `npm run db:push`.
2. `lib/supabase/dietary.js` + constants + shared `GuidelineListEditor`.
3. D&A screen: tabs → Requests tab → Inquiry builder.
4. Venue `GuidelinesSection`; event `guidelines.jsx` (+ requests opt-in) + section registry.
5. `TicketsSection` attach switch.
6. Public page: venue+config fetch → guidelines block → inquiry rendering → post-purchase request.
7. `npx eslint` on all changed files; manual sanity of the public flow.
