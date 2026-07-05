# Dietary & Accessibility — Requests + Ticket-Form Inquiry

**Date:** 2026-07-05
**Area:** Registrations (`components/internal/screens/registrations`) + Events public page
**Status:** Proposed — awaiting user review

---

## 1. Summary

Two related additions to the existing project-wide **Dietary & Accessibility** screen
(`dietary_accessibility.jsx`, today a read-only report of the free-text
`registrations.dietary` / `.accessibility` columns):

1. **Requests** — a project-level switch *"Enable Dietary & Accessibility Requests"*.
   When on, a **communication-request button** appears (a) on every published event's
   public page and (b) on the order-success / confirmation step. An attendee can type a
   free-text request; it lands back on the D&A screen as a **custom message** in a small
   inbox.

2. **Inquiry** — on the D&A screen, build a reusable **question set** of `radio` and
   `multiselect` questions. Each event opts in via a new **"Attach Dietary & Accessibility
   inquiry"** switch on its **Ticket Types** tab. When attached, those questions render in
   the ticket/registration form at checkout; answers are stored per-person and surfaced on
   the D&A screen.

Both are **project-scoped** (defined once on the workspace-level D&A screen). The inquiry
is gated **per event** by the ticket-tab switch; requests are gated **project-wide** by the
single D&A switch.

### Assumed defaults (user was away for the clarifying round — confirm on review)

- **Requests scope:** project-wide via the single D&A switch (button shows on all published
  event pages + order-success). No per-event opt-in for requests.
- **Request record:** standalone message capturing name + email + message, stored in a new
  `dietary_requests` table and shown on the D&A screen as "custom messages". On
  order-success it pre-fills the buyer's name/email and links the registration.
- **Inquiry answers:** stored per-person on the registration `answers` jsonb and surfaced
  per-person on the D&A screen, plus an aggregate breakdown.
- **D&A layout:** the screen becomes **tabbed** — *Needs report* (current) · *Requests* ·
  *Inquiry*.

---

## 2. Why this shape (fits existing conventions)

- The public event page is **self-contained around the `event` object** but already does
  client-side mount fetches (Stripe verify). Reading a **project-level** config for
  requests/inquiry is therefore done with **one anon `SECURITY DEFINER` RPC** on mount —
  the same pattern as `has_waitlisted_registration`. Keeps a single source of truth for the
  question set (no per-event snapshot to keep in sync).
- Per-event opt-in for the inquiry is a **boolean** in the event metadata bag
  (`metadata.dietaryInquiry.attach`) via `useEventConfig` — exactly how `offerings`,
  `rsvp`, `tickets`, `regSettings` already work. The questions themselves stay on the
  project config.
- The radio/multiselect **builder UX** mirrors `offerings.jsx` (single vs multiple, options
  list, required, reorder) so it reads native to the suite.
- Inquiry answers ride the **existing `answers` jsonb** path
  (`buildRegistration` → `registerForEvent` / `/api/checkout` → `verify` route). The paid
  path already forwards `answers`, so **no checkout API changes are required**.
- Requests are written client-side through an anon RPC (like public registration) — **no
  new API route**.

---

## 3. Data model — `supabase/sqls/dietary.sql` (new, idempotent)

Schema `events` (per SUPABASE_CONVENTIONS). Reuses `events.touch_updated_at()`.

### 3.1 `events.dietary_config` — one row per project

| column | type | notes |
|---|---|---|
| `project_id` | `uuid primary key references public.project(id) on delete cascade` | the row key |
| `requests_enabled` | `boolean not null default false` | master switch for the request button |
| `request_prompt` | `text` | helper text above the textarea (e.g. "Let us know any dietary or accessibility needs.") |
| `inquiry_title` | `text` | optional intro heading shown above the inquiry in the form |
| `inquiry_description` | `text` | optional intro copy |
| `questions` | `jsonb not null default '[]'` | ordered: `[{ id, label, type: 'radio'\|'multiselect', required, options: [{ id, label }] }]` |
| `metadata` | `jsonb not null default '{}'` | expansion bag |
| `created_at` / `updated_at` | `timestamptz default now()` | `updated_at` trigger |

No soft-delete (single config row per project; upsert semantics).

### 3.2 `events.dietary_requests` — one row per submitted message

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `project_id` | `uuid references public.project(id) on delete cascade` | scopes the inbox |
| `event_id` | `uuid references events.events(id) on delete cascade` | which event |
| `registration_id` | `uuid references events.registrations(id) on delete set null` | linked when known (order-success) |
| `name` | `text not null default ''` | |
| `email` | `text not null default ''` | |
| `message` | `text not null default ''` | the request |
| `source` | `text not null default 'event_page'` | `event_page` \| `order_success` |
| `status` | `text not null default 'Open'` | `Open` \| `Resolved` (inbox) |
| `metadata` / `created_at` / `updated_at` / `deleted_at` | | soft-delete; lists filter `deleted_at is null` |

Indexes: `(project_id) where deleted_at is null`, `(event_id) where deleted_at is null`,
`(created_at desc)`. `updated_at` trigger.

### 3.3 RPCs (anon + authenticated, `SECURITY DEFINER`, `set search_path = events, public`)

- `events.dietary_public_config(p_project_id uuid)` → returns
  `(requests_enabled, request_prompt, inquiry_title, inquiry_description, questions)` for the
  project (empty defaults when no row). Lets the anon public page read config despite RLS.
- `events.submit_dietary_request(p_project_id, p_event_id, p_name, p_email, p_message, p_source, p_registration_id default null)`
  → inserts a `dietary_requests` row (ignoring blank messages) and returns it.

### 3.4 RLS

- Both tables: `enable row level security`; demo `for all to anon, authenticated using (true)`
  policy (matches the rest of the suite until auth lands).
- `grant execute` on both RPCs to `anon, authenticated`.

---

## 4. Data layer — `lib/supabase/dietary.js` (new)

Pure, guarded, snake↔camel at the boundary; `console.error` + `null/false/[]` on failure,
never throws/toasts. Uses `createClient()` + `isSupabaseConfigured()` (schema-scoped reads
via the `events`-schema tables as the other files do).

- `normalizeConfig(row)` / `normalizeRequest(row)` — snake → camel, defaults every field,
  `questions` always an array.
- `getDietaryConfig(projectId)` — read the config row (dashboard). Returns a defaulted
  view-model even when no row exists (so the screen renders a clean empty builder).
- `upsertDietaryConfig(projectId, patch)` — upsert (`onConflict: project_id`), returns
  normalized row. Serves the requests-enable toggle, prompt edits, and question-set saves.
- `listDietaryRequests(projectId)` — inbox rows, newest first (`null/[]`).
- `updateDietaryRequest(id, patch)` — status change (`{ status }`).
- `softDeleteDietaryRequest(id)` — sets `deleted_at`.
- `getPublicDietaryConfig(projectId)` — calls `dietary_public_config` RPC (public page).
- `submitDietaryRequest(input)` — calls `submit_dietary_request` RPC (public page).

Constants for the builder go in `registrations/constants.js`:
`DIETARY_QUESTION_TYPE_OPTIONS = [{ value:'radio', label:'Single choice (radio)' },
{ value:'multiselect', label:'Multiple choice (checkboxes)' }]` and a
`DIETARY_REQUEST_STATUS_MAP` for the inbox `StatusPill`.

---

## 5. UI — Dietary & Accessibility screen (tabbed)

`dietary_accessibility.jsx` gains shadcn `Tabs`. Fetches `getDietaryConfig(projectId)` and
`listDietaryRequests(projectId)` alongside the existing registrations/events load.

### Tab 1 — Needs report (unchanged)
Existing stats + dietary breakdown + per-person table. Additionally, when the inquiry has
questions, the report gains a compact **inquiry aggregate** (counts per option across
registrations whose `answers` contain inquiry keys) and the per-person rows show their
inquiry answers.

### Tab 2 — Requests
- `SettingRow` **"Enable Dietary & Accessibility Requests"** → `upsertDietaryConfig({ requestsEnabled })`.
- `Field` + `Textarea` for the **request prompt** (optimistic, save on blur).
- An **inbox**: `Toolbar` (search + event `FilterDropdown`) → `DataTable` of requests
  (Registrant name + email, Event, Message, Source, Date, Status via `StatusPill`).
  Row actions: **Mark resolved / reopen**, **Delete** (soft). **Export** to CSV (reuse
  `csv.js`). Loading / empty / filtered-empty states.

### Tab 3 — Inquiry
- Optional `inquiryTitle` / `inquiryDescription` fields (intro shown in the form).
- **Question builder** modelled on `offerings.jsx`: list of questions, each with label,
  **type** (radio / multiselect), **options** editor, **required** toggle, reorder (▲▼),
  delete. "Add question" + a **Save inquiry** button → `upsertDietaryConfig({ questions, inquiryTitle, inquiryDescription })`.
- Helper note: *"Turn this on per event from its Ticket Types tab → 'Attach Dietary &
  Accessibility inquiry'."*

All optimistic + `toast`; semantic tokens only; three list states.

---

## 6. UI — Ticket Types tab (`TicketsSection`, `event_builder.jsx`)

Add a `SectionCard` beneath the tiers list (before the Save row):

- `useEventConfig(event, "dietaryInquiry", { attach: false })`.
- `SettingRow` **"Attach Dietary & Accessibility inquiry"** — persists `attach` immediately.
- When on, fetch `getDietaryConfig(projectId)` (via `useProject()`) and **list the project's
  inquiry questions read-only** (label + type badge + option chips), so the organizer sees
  exactly what will be asked. If the project has no questions yet, show an inline hint
  linking them to the D&A → Inquiry tab.

---

## 7. Public event page (`event_public_page.jsx`)

`EventPublicPageContent` fetches `getPublicDietaryConfig(event.projectId)` once on mount →
`daConfig` state, passed into `TicketCheckout` and the sidebar.

### 7.1 Inquiry questions in the ticket form
When `event.dietaryInquiry?.attach && daConfig.questions.length`:
- Render the questions inside the fields grid (after the existing `regQuestions.map`,
  ~line 752): **radio** as a option list, **multiselect** as checkboxes.
- Answers write into the existing `answers` state keyed by a stable prefix (e.g.
  `dietary:<questionId>`) so they can't collide with custom-question keys.
- Required questions validated in `submitDetails` (mirror existing required checks).
- They flow through `buildRegistration` → `answers` bag → `registerForEvent` (free/approval)
  and `/api/checkout` → `verify` (paid). **No route changes** — `answers` already forwarded.

### 7.2 Request button
When `daConfig.requestsEnabled`:
- **Sidebar** (after the CTA card): a small card + **"Dietary or accessibility need?"**
  button opening a `Dialog` with name/email (pre-filled if known) + `Textarea`
  (`request_prompt` as helper). Submit → `submitDietaryRequest({ …, source: 'event_page' })`
  → success toast.
- **Order-success (`done` step of the dialog):** the same request affordance inline in the
  confirmed state, `source: 'order_success'`, pre-filled with the buyer's name/email and
  `registration_id` when available.

---

## 8. Files touched

**New**
- `supabase/sqls/dietary.sql`
- `lib/supabase/dietary.js`

**Modified**
- `components/internal/screens/registrations/dietary_accessibility.jsx` — tabs + requests inbox + inquiry builder
- `components/internal/screens/registrations/constants.js` — question-type + request-status maps
- `components/internal/screens/events/event_builder.jsx` — "Attach D&A inquiry" on `TicketsSection`
- `components/internal/screens/events/event_public_page.jsx` — config fetch, inquiry questions, request button (page + order-success)

**Unchanged (verified sufficient):** `app/api/checkout/route.js`, `app/api/checkout/verify/route.js`
(they already forward/file `answers`), `registrations.js` register RPC path.

---

## 9. Out of scope / non-goals

- No per-event customization of the inquiry question set (it's one project set; events only
  attach/detach). Promote to per-event later if needed.
- No email notification on a new request (the inbox is in-app only). Could reuse the
  `approval-email` route pattern later.
- No migration of the existing free-text dietary/accessibility bucketing — it stays as is;
  the inquiry is additive structured data.

---

## 10. Build order

1. `dietary.sql` + `npm run db:push`.
2. `lib/supabase/dietary.js` + constants.
3. D&A screen: tabs shell → Requests tab → Inquiry builder.
4. `TicketsSection` attach switch.
5. Public page: config fetch → inquiry rendering → request button (page + order-success).
6. `npx eslint` on all changed files; manual sanity of the public flow.
