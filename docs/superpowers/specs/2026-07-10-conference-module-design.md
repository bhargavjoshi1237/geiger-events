# Conference Module — Design Spec

**Date:** 2026-07-10
**Area:** Conference (workspace sidebar section)
**Status:** Approved — direct implementation

## Goal

Build the eight "simple management" sub-items of the **Conference** sidebar
section as list + edit screens that match the Events / Venues reference pattern
(list → row → sectioned/single-panel editor), persisting through a real
Supabase data layer. Currently all Conference titles fall back to
`ComingSoonScreen`.

The eight modules:

| Module (sidebar title) | Depth | Status set |
|---|---|---|
| Speakers | Rich (sectioned) | Confirmed · Invited · Tentative · Declined |
| Sponsors | Rich (sectioned) | Confirmed · Prospect · Declined |
| Sponsorship Packages | Light (single-panel) | Available · Sold out · Draft |
| Expo Booths | Light | Available · Reserved · Occupied |
| Venue Sourcing | Light | Shortlisted · Contacted · Quoted · Booked · Rejected |
| Housing & Travel | Light | Available · Booked · Full |
| Call for Papers | Rich (sectioned) | Submitted · Under review · Accepted · Waitlisted · Rejected |
| CEU & Certificates | Light | Active · Draft · Archived |

## Architecture — one shared store, config-driven screens

Two existing precedents are reused rather than hand-building eight of everything:

1. **`events.ticketing_records`** — one shared table discriminated by a `module`
   column backs many record-manager screens. Conference mirrors this with
   **`events.conference_records`**.
2. **Area "kit" files** (`campaigns_kit.jsx`, `checkin_kit.jsx`) + thin screen
   exports (`campaigns/lenses.jsx`). Conference mirrors this: one shared list +
   detail scaffold, driven by a per-module config object, with eight thin screen
   exports wired into the registry.

### Data model

`events.conference_records`:

| Column | Notes |
|---|---|
| `id uuid pk` | |
| `project_id uuid not null` | org-scoped (added in `zz_project_access.sql`) |
| `module text not null` | discriminator: `speaker` `sponsor` `package` `booth` `venue_lead` `housing` `paper` `certificate` |
| `name text` | the record's display name |
| `status text` | per-module status vocabulary |
| `cover_url text` | headshot (speaker) / logo (sponsor); null otherwise |
| `config jsonb` | every module-specific field |
| `metadata jsonb` | expansion bag |
| `created_by uuid` | owner (storage RLS) |
| `created_at/updated_at/deleted_at` | soft delete |

RLS: open demo policy in `conference.sql`, replaced by an org-member policy in
`zz_project_access.sql` (same as venues). Storage: `products` bucket,
`conference/<id>/` prefix, owner-only writes.

### Files

**New**
- `supabase/sqls/conference.sql` — table, indexes, `updated_at` trigger, demo
  RLS, storage owner policies for the `conference/` prefix.
- `lib/supabase/conference.js` — pure data layer mirroring `ticketing.js`:
  `normalizeRecord`, `toRow`, `listRecords(projectId, module)`, `getRecord`,
  `createRecord`, `updateRecord`, `softDeleteRecord`.
- `components/internal/screens/conference/constants.js` — per-module status/tier
  `*_MAP`s, filter options, `currency`/`pct` formatters.
- `components/internal/screens/conference/record_fields.jsx` — declarative field
  renderer (`text/textarea/number/select/email/list/switch`), `ChipsInput`,
  `CoverImageCard`, `LightPanels` (renders field specs into `SectionCard`s).
- `components/internal/screens/conference/modules.jsx` — the eight module config
  objects (columns, stats, filters, create fields, and detail shape — rich nav
  sections and light panels both expressed declaratively as field specs, so no
  separate per-module section files are needed; the media section points at
  `CoverImageCard`).
- `components/internal/screens/conference/conference_kit.jsx` —
  `ConferenceRecordsScreen({ module })` (list) + `RecordDetail` (adaptive:
  sectioned nav for rich, `LightPanels` for light) + create/delete dialogs.
- `components/internal/screens/conference/screens.jsx` — eight thin exports.

**Edited**
- `supabase/sqls/zz_project_access.sql` — add `project_id` (NOT NULL) + index +
  org-member RLS for `conference_records`.
- `lib/supabase/storage.js` — add `conferenceMediaPrefix` + `uploadConferenceImage`.
- `lib/hooks/use-workspace-url.js` — add one generic `?record=<id>` param
  (`recordId`, `openRecord`, `closeRecord`) shared by all record screens.
- `components/internal/screens/registry.jsx` — import + map the eight titles.

### UI conventions

- Primitives from **`@geiger/ui`** (Button, Input, Textarea, Select, Dialog,
  DropdownMenu, Switch, `cn`); composites from the shared
  `screen_kit` (`ScreenHeader`, `StatsBar`, `Toolbar`, `SearchInput`,
  `DataTable`, `SectionCard`, `Field`, `EmptyState`, `StatusPill`). Status and
  tier badges render through `StatusPill` + a `*_MAP`. Semantic color tokens
  only.
- Every list has loading / empty / filtered-empty states; mutations are
  optimistic then persisted, with a `toast.error` + reconcile on failure. New
  rows mint `crypto.randomUUID()` up front. The open record lives in the URL.

### Scope guardrails (YAGNI)

- Records are self-contained. Speaker↔session and Certificate↔session links are
  stored as free-text / id lists in `config`, not enforced cross-table joins.
- No public-facing pages, no analytics dashboards, no cross-module rollups in
  this pass. Media (cover image) only for Speakers and Sponsors.
