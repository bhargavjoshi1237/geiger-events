# Guests area expansion — Who's Going, Attendee Export, Tags, Notes

Date: 2026-07-06
Status: approved, implementing

## Context

The Guests area (`components/internal/screens/guests`) already ships Contact Book
(CRM hub, with the Blocklist folded in as a "Blocked" filter), Guest List
(derived attendee roster), Segments (saved dynamic filters), and Data Requests
(GDPR queue). Backing store is `supabase/sqls/contacts.sql`
(`events.contacts` / `contact_segments` / `contact_activity` / `data_requests`).

The user asked for Guests sub-items covering block list, segments, tags, notes,
"who's going", and attendee export. Block list and Segments already exist. This
spec covers the four genuinely-missing/under-built pieces, each a new
workspace-level Guests screen wired through the registry + sidebar.

## Scope

Four new screens under `components/internal/screens/guests/`, four new registry
entries, four new sidebar sub-items. No changes to existing Guests screens.

### 1. Who's Going — `whos_going.jsx` → registry `"Who's Going"`

A roster of everyone holding a registration/ticket for an **upcoming** event
(event date ≥ today, event not Cancelled). Distinct from Guest List (which spans
all events, past and future) by its upcoming lens + time windows.

- **Data:** new `lib/supabase/attendees.js` → `listAttendeeRows(projectId)` joins
  `registrations` × `events` × `contacts` into one enriched row per registration
  (carries `eventDate`, `eventVenue`, `eventCity`, `eventStatus`, contact `tags`,
  etc.). The screen filters to upcoming rows.
- **UI:** `MainScreenWrapper` → `ScreenHeader` (Export action) → `StatsBar`
  (Upcoming events / Attendees (distinct email) / Tickets / Going) → `Toolbar`
  (window `FilterDropdown` + event `FilterDropdown` + `SearchInput`) →
  `DataTable` (Guest, Event, Date, Status). Window options: All upcoming / Today /
  Next 7 days / Next 30 days. CSV export via `registrations/csv.js`.

### 2. Attendee Export — `attendee_export.jsx` → registry `"Attendee Export"`

The rich export surface. Same `listAttendeeRows` source.

- **Scope picker:** All attendees · Today's events · Upcoming · Past · Specific
  event · By venue/location · By status · Date range (two date inputs).
- **Field picker:** checkbox list of columns (name, email, phone, event, date,
  time, venue, city, status, party size, dietary, accessibility, tags, company,
  title, location, registered-at) with a sensible default subset.
- **Live preview:** filtered row count + a capped preview table of the selected
  fields. **Export CSV** (filename derived from scope) + **Copy emails**.

### 3. Tags — `tags.jsx` → registry `"Tags"`

Manage the tag vocabulary that lives as `contacts.tags text[]`.

- **New table** `events.contact_tags` (catalog: name, color, description) — colors
  come from here; membership stays in the `text[]`. A generic RPC
  `events.rewrite_contact_tags(project, from[], to)` rewrites tag arrays across
  contacts atomically (rename = 1→1, merge = N→1, delete = →null/removed).
- **Data:** new `lib/supabase/tags.js` → `listTags` (catalog merged with usage
  counts derived from contacts), `createTag`, `updateTag`, `softDeleteTag`,
  `renameTag`, `mergeTags`, `deleteTagEverywhere`.
- **UI:** header (New tag) → `StatsBar` (Tags / Tagged contacts / Most used /
  Unused) → `DataTable` (color-dot + name, count, description, row actions:
  Recolor/Rename, Merge, Delete). Create + edit + merge dialogs, delete confirm.
  Optimistic + toast.

### 4. Notes — `notes.jsx` → registry `"Notes"`

A workspace-wide feed of every contact note (today they are only visible one
contact at a time in the drawer). Notes live in `contacts.metadata.notes`.

- **Data:** add `listAllNotes(projectId)` to `lib/supabase/contacts.js` — flattens
  every contact's `metadata.notes` into `{ body, createdAt, createdBy, contactId,
  contactName, contactEmail }`, newest first.
- **UI:** header → `StatsBar` (Notes / Contacts with notes / Latest) →
  `SearchInput` → card feed. Clicking a note opens the existing `ContactDrawer`
  (loaded from a `listContacts` index) so the note can be edited in place;
  persist via `updateContact`, then re-read the feed.

## Persistence

- `supabase/sqls/contact_tags.sql` — `events.contact_tags` table (project-scoped,
  soft-delete, `unique(project_id, lower(name))`), the `rewrite_contact_tags` RPC,
  and a demo-open RLS policy.
- `supabase/sqls/zz_project_access.sql` — append a member-scoped policy for
  `events.contact_tags` (replacing the demo policy), matching the other Guests
  tables. Run with `npm run db:push`.

No other schema changes. Who's Going, Attendee Export, and Notes are pure reads
over existing tables.

## Conventions

Data layer is pure (guard with `isSupabaseConfigured()`, `console.error`, return
`null`/`false`/`[]`, never throw/toast). Screens fetch on mount (empty + loading,
no static seed), derive with `useMemo`, mutate optimistically + toast, use the
shared kit + semantic tokens only. DB snake_case ↔ UI camelCase at the data-layer
boundary.
