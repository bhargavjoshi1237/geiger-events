# Guests Module — Design Spec

Date: 2026-07-05
Status: Approved scope, pending spec review

> **Amendment (2026-07-05) — sidebar compressed 13 → 4.** The 13 sidebar
> sub-items were over-listed: 6 were folded redirect banners and 3 more were
> actions/filtered views, not destinations. The sidebar now shows only the four
> real destinations — **Contact Book · Guest List · Segments · Data Requests**.
> Everything else relocated (features unchanged):
> - **Guest Import** → Contact Book *Actions ▸ Import CSV* (opens the wizard as a
>   sub-view; contacts refetch on return).
> - **Dedupe & Merge** → Contact Book *Actions ▸ Find duplicates* (sub-view).
> - **Blocklist** → a "Blocked" filter on Contact Book, plus *Actions ▸ Block an
>   email* (the raw-email block flow) and the existing row Block/Unblock action.
> - **Guest Profiles / Tags & Notes / Communication History / Consent Tracking**
>   → already the Contact profile drawer + its tabs and Contact Book filters.
> - **Who's Going / Attendee Export** → Guest List's event filter + Export button.
>
> `guests/folded_redirect.jsx` and `guests/blocklist.jsx` were removed; the
> registry now maps only the four titles. Sections below describe the original
> 13-entry plan for context.
Reference build: the **Registrations** area
(`components/internal/screens/registrations`, `lib/supabase/registrations.js`,
`supabase/sqls/registrations.sql`) and the **Events** area. Same rhythm:
kit-crafted screens, data-layer-first, project-scoped, optimistic CRUD.

> Note on conventions: this app's tables/RPCs live in the dedicated **`events`**
> Postgres schema (not `public.flow_*`) and are **project-scoped** with live
> org-membership RLS via `events.can_access_project()`. The convention docs
> (`SUPABASE_CONVENTIONS.md`, `MODULE_CONVENTIONS.md`) still describe the old
> `public.flow_*` demo pattern — follow the events-schema reality in the code.

---

## 1. Goal & scope

Build the **Guests** workspace area — the workspace's contact/CRM layer. Where
**Registrations** owns per-event sign-up *records*, Guests owns the **people**:
a deduplicated contact book, the roster of who is actually attending across
events, saved audience segments, GDPR tooling, and per-contact history.

**Confirmed decisions (requirements round):**

1. **Data model — one new core table `events.contacts`** (the contact book
   master record) plus three small companion tables (`contact_segments`,
   `contact_activity`, `data_requests`). Guest List is **derived** — contacts
   joined with existing `registrations`/`event_orders`; no separate guest table.
2. **Scope — whole section in one pass.** All **13** sidebar sub-items become
   reachable and real: **7 substantive screens** + **6 folded/tab surfaces**.
   Nothing stays `ComingSoonScreen`.
3. **Contact Book vs Guest List** — Contact Book = *every* person (CRM master,
   incl. imported/manual). Guest List = only people with ≥1 registration/order
   (actually attending), with a per-event filter.
4. **Contact status — CRM lifecycle:** `Lead → Active → VIP`, plus `Archived`.
   An **Attending** badge is *derived* from registrations, not a status.
   `blocked` and `consent` are tracked as their own flags, not statuses.
5. **Segments = dynamic saved filters** (rules over contact fields/tags/consent/
   attendance), recomputed live from a `contact_segments` table.
6. **Communication History = dedicated `events.contact_activity` table** (channel,
   subject, direction, timestamp), surfaced as a profile-drawer tab. Auto-
   population wires in when a comms engine lands; manual "Log interaction" now.
7. **Gating — none required for now** (reachable by default, like Events). A
   `view.guests` permission is added to the catalog but not enforced this pass.

### The 7 substantive screens (registry entries)

| Sidebar title | Screen | Purpose |
|---|---|---|
| **Guest List** | `GuestListScreen` | Attendees across the project — derived from registrations/orders, per-event filter, export |
| **Contact Book** | `ContactBookScreen` | CRM master list of all people; the core `contacts` table; row → profile drawer |
| **Segments** | `SegmentsScreen` | Saved dynamic audience filters; live member counts |
| **Guest Import** | `GuestImportScreen` | CSV importer → column map → preview → bulk-create contacts |
| **Dedupe & Merge** | `DedupeMergeScreen` | Duplicate-detection tool; merge groups into a survivor |
| **Blocklist** | `BlocklistScreen` | Blocked people/emails who can't register |
| **Data Requests** | `DataRequestsScreen` | GDPR export/erasure/rectification request queue |

### How the other 6 sub-items resolve (folded / tabs)

| Sub-item | Where it lives |
|---|---|
| **Guest Profiles** | The **Contact profile drawer** (opens from a Contact Book / Guest List row) — banner → Contact Book |
| **Tags & Notes** | Profile drawer **Tags & Notes** tab (+ tag filter on Contact Book) — banner → Contact Book |
| **Communication History** | Profile drawer **Activity** tab (reads `contact_activity`) — banner → Contact Book |
| **Consent Tracking** | Consent column + filter on Contact Book (+ profile **Consent** tab) — banner → Contact Book |
| **Who's Going** | Per-event public attendee lens — banner → Guest List (filter by event) |
| **Attendee Export** | Export action on Guest List — banner → Guest List |

All 13 sidebar titles get registered in `registry.jsx`. The 6 folded titles map
to thin redirect screens in `guests/folded_redirect.jsx` (same helper pattern as
`registrations/folded_redirect.jsx`): host screen + a one-line context banner.

> Default taken: folded items reuse the registrations redirect-banner pattern
> rather than bespoke pages — every sidebar entry is real, no near-empty
> duplicate CRUD surfaces.

---

## 2. Data model (`supabase/sqls/contacts.sql`)

One idempotent, self-contained file for the area, in the **`events`** schema,
project-scoped, RLS via `events.can_access_project(project_id)`, `updated_at`
via the shared `events.touch_updated_at` trigger, soft delete via `deleted_at`.

### 2.1 `events.contacts` (new core table)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()`; honors caller-supplied id |
| `project_id` | uuid | → `public.projects(id)`; scopes every read |
| `name` | text | required |
| `email` | text | lower-cased key for dedupe/guest-join |
| `phone` | text | |
| `company` | text | |
| `title` | text | job title / role |
| `location` | text | free-form city/region |
| `status` | text | `Lead` \| `Active` \| `VIP` \| `Archived` (default `Active`) |
| `tags` | text[] | default `'{}'` |
| `consent_email` | bool | marketing email opt-in (default `false`) |
| `consent_sms` | bool | SMS opt-in (default `false`) |
| `consent_updated_at` | timestamptz | last consent change |
| `blocked` | bool | default `false` — backs Blocklist |
| `blocked_reason` | text | |
| `blocked_at` | timestamptz | |
| `avatar_url` | text | optional |
| `metadata` | jsonb | expansion bag (`notes[]`, source, custom fields) default `'{}'` |
| `created_by` | uuid | → `public.users(id)` |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | standard |

- **Notes** live in `metadata.notes[]` as `{ id, body, createdAt, createdBy }`
  (freeform, append-only; surfaced in the Tags & Notes tab).
- Unique-ish key for dedupe/guest-join is normalized `lower(email)` **within a
  project** — not a hard DB constraint (dupes are expected and handled by the
  Dedupe tool), but an index `on contacts(project_id, lower(email))`.

### 2.2 `events.contact_segments` (new)

Saved **dynamic** filters. `id`, `project_id`, `name`, `description`,
`rules jsonb` (an array of `{ field, op, value }` clauses, AND-combined),
`color` (a tag-style token for the pill), standard timestamps + soft delete +
`created_by`. Membership is **computed client-side** by applying `rules` to the
fetched contacts — no membership table.

Supported rule fields (v1): `status`, `tag` (contains), `consentEmail`,
`consentSms`, `blocked`, `attending` (has ≥1 registration), `event` (attending a
specific event), `location` (contains), `company` (contains).

### 2.3 `events.contact_activity` (new)

Per-contact interaction log. `id`, `project_id`, `contact_id` → `contacts(id)`,
`channel` (`Email`\|`SMS`\|`Call`\|`Note`\|`System`), `direction`
(`Outbound`\|`Inbound`\|`Internal`), `subject`, `body`, `occurred_at`,
`created_by`, standard timestamps. Read newest-first per contact for the
**Activity** tab; `logContactActivity()` inserts a manual entry.

### 2.4 `events.data_requests` (new)

GDPR request queue. `id`, `project_id`, `contact_id` (nullable — may reference a
raw email), `email`, `type` (`Export`\|`Erasure`\|`Rectification`), `status`
(`New`\|`In Progress`\|`Completed`\|`Rejected`, default `New`), `note`,
`due_at` (default now()+30d), `resolved_at`, `created_by`, standard timestamps +
soft delete.

### 2.5 `events.merge_contacts` RPC

`merge_contacts(p_survivor uuid, p_losers uuid[])` — SECURITY INVOKER (RLS still
applies): union `tags`, OR the consent/blocked flags, concat `metadata.notes[]`,
repoint `contact_activity.contact_id` and `data_requests.contact_id` to the
survivor, then soft-delete the losers. Returns the normalized survivor row.
Atomic so a partial merge can't strand activity/requests.

---

## 3. Data layer (`lib/supabase/`)

Three files, mirroring the registrations pattern (guarded `createClient()` —
which is already schema-scoped to `events` — `normalize*`/`toRow`, pure, return
`null`/`false`/`[]`, `console.error` on failure, never throw/toast).

### 3.1 `contacts.js`
- `normalizeContact(row)` / `toRow(input)` (partial-emit, `tags` array coercion,
  `""`-date → `null`, consent booleans, `metadata` spread last).
- `listContacts(projectId)`, `getContact(id)`, `createContact(input)`,
  `updateContact(id, patch)`, `softDeleteContact(id)`.
- `listGuests(projectId)` — **derived roster.** Fetch this project's
  `registrations` (and optionally `event_orders`), group by normalized email,
  compute `{ name, email, phone, eventsCount, eventIds, lastSeenAt, statuses }`,
  then LEFT-merge the matching `contacts` row (status/tags/consent/contactId).
  Returns view models the Guest List renders directly. Per-event filtering is a
  client-side `useMemo` over `eventIds`.
- `mergeContacts(survivorId, loserIds)` → `merge_contacts` RPC.
- Activity: `listContactActivity(contactId)`, `logContactActivity(input)`.
- Notes helper: notes are edited via `updateContact(id, { notes })` folding into
  `metadata.notes`.

### 3.2 `segments.js`
- `normalizeSegment`/`toRow`, `listSegments/createSegment/updateSegment/
  softDeleteSegment`. `applySegment(rules, contacts, guestIndex)` — pure helper
  (co-located) that computes membership for the live count.

### 3.3 `data_requests.js`
- `normalizeDataRequest`/`toRow`, `listDataRequests/createDataRequest/
  updateDataRequest/softDeleteDataRequest`. Status changes are single-field
  updates (`{ status }`, `{ status, resolvedAt }`).

Blocklist has **no** table/data-file of its own: it's `contacts` filtered on
`blocked = true`. `BlocklistScreen` uses `contacts.js` (`updateContact(id,
{ blocked, blockedReason })`); "Add to blocklist" for a not-yet-contact email
creates a minimal blocked contact.

---

## 4. Constants (`components/internal/screens/guests/constants.js`)

Config only (no row data):
- `CONTACT_STATUS_MAP` — `Lead`/`Active`/`VIP`/`Archived` → `{ label, variant,
  dotClass }` (semantic tokens: Lead amber, Active emerald, VIP violet, Archived
  muted).
- `STATUS_FILTER_OPTIONS`, `CONSENT_FILTER_OPTIONS`, `TAG` helpers.
- `DATA_REQUEST_TYPE_MAP`, `DATA_REQUEST_STATUS_MAP`.
- `ACTIVITY_CHANNEL_MAP` (icon + tint per channel).
- `SEGMENT_RULE_FIELDS` — the rule-builder field catalog (`{ value, label,
  ops[], input }`).
- `formatDate`, `initials()` formatters.

---

## 5. Screens (UI craft)

All built from the shared kit (`ScreenHeader`, `StatsBar`, `Toolbar` +
`SearchInput` + `FilterDropdown`, `DataTable`, `StatusPill`, `EmptyState`,
`Dialog`, `Field`), semantic color tokens only, three list states (loading /
empty / filtered-empty), optimistic + `toast` mutations, `crypto.randomUUID()`
ids. Each screen loads via `useProject().projectId` + fetch-on-mount.

### 5.1 Contact Book (`contact_book.jsx`) — core
- **Stats:** Total contacts · Active · VIP · Email-consented (%).
- **Toolbar:** filters (status, consent, tag) + search (name/email/company).
- **Table:** avatar+name / email / company / tags (pills) / status
  (`StatusPill`) / attending badge / row-actions menu (Open, Edit, Add to
  segment, Block, Delete).
- **Create dialog:** name*, email*, phone, company, status (default Active),
  tags. **Row click → Contact profile drawer** (§5.8).

### 5.2 Guest List (`guest_list.jsx`) — derived
- **Stats:** Total guests · Going (confirmed) · Repeat guests (>1 event) ·
  Events covered.
- **Toolbar:** event filter (all events in project), status filter, search;
  **Export** button (CSV via reused `registrations/csv.js`) — this is where
  **Attendee Export** and **Who's Going** fold.
- **Table:** name / email / events attending (count + tooltip) / latest status /
  linked-contact chip (opens drawer if a `contacts` row exists, else "Add to
  contacts").

### 5.3 Segments (`segments.jsx`)
- **Stats:** Segments · Largest segment · Total reachable (union) · Avg size.
- **Cards/table** of segments with live member count (computed via
  `applySegment`). **Create/Edit dialog** = a small **rule builder** (add
  clause rows: field → op → value), name, color. Row action "View members"
  opens Contact Book pre-filtered by the segment.

### 5.4 Guest Import (`guest_import.jsx`)
- `SecondaryScreenWrapper` wizard: **Upload CSV → Map columns → Preview →
  Import.** Parse with `registrations/csv.js`; map to contact fields; validate
  (email format, required name); dedupe-warn against existing contacts by email;
  bulk `createContact` optimistically with a progress toast. Summary of
  created/skipped.

### 5.5 Dedupe & Merge (`dedupe_merge.jsx`)
- Detect duplicate groups client-side: exact normalized email, then fuzzy
  name+phone. **Stats:** Potential duplicates · Groups · Contacts affected.
- Each group card lists members; pick a **survivor**, preview the merged result,
  confirm → `mergeContacts` (optimistic remove of losers). Empty state = "No
  duplicates found 🎉".

### 5.6 Blocklist (`blocklist.jsx`)
- Table of `blocked` contacts: name/email / reason / blocked date / Unblock.
- **Add to blocklist** dialog: email* + reason → blocks existing contact or
  creates a minimal blocked one. **Stats:** Blocked total · Added this month.

### 5.7 Data Requests (`data_requests.jsx`)
- Table: requester (contact chip / email) / type (`DATA_REQUEST_TYPE_MAP`) /
  status (`StatusPill`) / due date (overdue in `text-red-400`) / actions
  (advance status, resolve, delete). **Stats:** Open · Overdue (>due) ·
  Completed. **New request** dialog: email/contact*, type, note.

### 5.8 Contact profile drawer (`contact_drawer.jsx`)
Opened from Contact Book / Guest List rows (mirrors
`registrations/registration_drawer.jsx`). Header = avatar, name, status,
quick-edit. **Tabs:**
- **Overview** — editable fields (name/email/phone/company/title/location/status).
- **Tags & Notes** — tag editor + append-only notes list (`metadata.notes`).
- **Activity** — `contact_activity` timeline + "Log interaction" (channel,
  subject, note). *(This is where **Communication History** lives.)*
- **Consent** — email/SMS opt-in toggles, `consent_updated_at` stamp.
- **Events** — derived list of events this person is registered for (from
  `registrations` by email).

---

## 6. Folded redirects (`guests/folded_redirect.jsx`)

Reuse the registrations `folded()` helper (banner + host). Titles → hosts:
`Guest Profiles`/`Tags & Notes`/`Communication History`/`Consent Tracking` →
`ContactBookScreen`; `Who's Going`/`Attendee Export` → `GuestListScreen`. Each
with a one-line banner pointing to where the feature actually lives.

---

## 7. Registry & nav

- Register all 13 titles in `registry.jsx` (7 screens + 6 folded).
- Sidebar entries already exist in `sidebar_nav.jsx` — no nav changes needed.
- Per-entity concerns (profile, tags, notes, activity, consent) are **drawer
  tabs**, not registry entries.

---

## 8. RBAC

Add `view.guests` (and optionally per-screen `view.*`) to
`WORKSPACE_PERMISSIONS` in `lib/rbac.js` for future gating; **not enforced** this
pass (screens reachable by default, consistent with Events/Registrations).

---

## 9. Build order

1. `supabase/sqls/contacts.sql` (4 tables + `merge_contacts` RPC + RLS +
   triggers + indexes); `npm run db:push`.
2. Data layer: `contacts.js`, `segments.js`, `data_requests.js`.
3. `guests/constants.js`.
4. Screens: Contact Book + drawer → Guest List → Segments → Import → Dedupe &
   Merge → Blocklist → Data Requests.
5. `guests/folded_redirect.jsx`; register all 13 in `registry.jsx`.
6. RBAC catalog entry.
7. `npx eslint` clean on all changed files.

---

## 10. Non-goals (YAGNI this pass)

- Actual email/SMS **sending** (Activity auto-population, campaigns) — the
  `contact_activity` table is ready, but no comms engine is built now.
- Automatic contact upsert from registrations (chosen model is derive-on-read,
  not trigger-sync). "Add to contacts" from Guest List is the manual bridge.
- Static/hand-picked segments (segments are dynamic-rule only in v1).
- Enforced permission gating.
- Import from anything but CSV.
