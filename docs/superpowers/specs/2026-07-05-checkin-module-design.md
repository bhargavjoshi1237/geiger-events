# Check-in Module — Design (Phase 1)

Status: approved. Date: 2026-07-05.

Builds the **Check-in** workspace area (16 sidebar sub-items) following
`MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md`, and `crafting.md`. Reference
builds: the Registrations and Tickets areas. Split into two phases; this spec
covers **Phase 1** (all workspace screens + data layer + per-event editor
toggles). Phase 2 (the three staff app routes) is scoped at the end and built
as its own spec.

## Goals

- Every Check-in sidebar entry is a real, functional workspace screen — no
  ComingSoon for the 16 listed items.
- A single data foundation the whole area (and the Phase-2 routes) reads/writes.
- Per-event enable/disable of each globally-enabled feature, inside the event
  editor, gated on the global setting.

## Architecture

New area folder `components/internal/screens/checkin/`, registered in
`registry.jsx` under the exact sidebar titles. All screens are `"use client"`,
`*Screen` exports, built from the shared kit, reading the data layer (no static
seed), optimistic mutations + toasts.

### Data layer & SQL (`events` schema)

`supabase/sqls/checkin.sql` (idempotent, `events.touch_updated_at()` trigger,
demo-open RLS) + member-scoped RLS finalized in `zz_project_access.sql`. Data
access in `lib/supabase/checkin.js` (schema-scoped client, `normalize`/`toRow`,
`isSupabaseConfigured` guard, returns `null`/`[]`/`false`).

Four tables:

| Table | Purpose | Key columns |
|---|---|---|
| `events.checkin_settings` | **One row per project** — global feature flags + per-feature config | `id, project_id (unique, FK public.projects), config jsonb, metadata jsonb, timestamps, deleted_at` |
| `events.checkin_attendance` | Check-in records — source of truth for who's in / Real-time Attendance | `id, event_id, project_id, registration_id, order_id, attendee_name, ticket_code, gate, zone, session_id, method, checked_in_by, checked_in_at, status, metadata` |
| `events.checkin_staff_roles` | Staff scanning roles + access code/PIN (Phase-2 route auth) | `id, project_id, name, permissions jsonb, access_code, active, metadata, timestamps, deleted_at` |
| `events.checkin_leads` | Lead-retrieval captures (exhibitor scans) for export | `id, event_id, project_id, exhibitor, attendee_name, contact jsonb, captured_at, metadata` |

`config` (checkin_settings) holds a slice per feature, each shaped
`{ enabled, …settings }` where relevant: `qrTickets, walletPasses, checkinApp,
doorSales, kiosk, session, rfid, selfCheckin, multiGate, badge, offline`.
A `checkin_settings_merge(p_project, p_patch)` RPC upserts the project row and
shallow-merges `config`, so one feature screen never clobbers another.

Per-event config lives in the event `metadata.checkin` bag (written with the
existing `event_merge_meta` RPC via `updateEventMeta`):
`{ qrOnTicket, walletPass, doorSales, kiosk, session, selfCheckin, multiGate,
rfid, gates[], zones[], sessions[] }`. Each per-event toggle only shows/enables
when the matching global feature is on.

### Shared scaffold

`components/internal/screens/checkin/checkin_kit.jsx` exports
`CheckinSettingsScreen` — a reusable settings surface (loads the project's
`checkin_settings`, renders `ScreenHeader` + optional global-enable `SettingRow`
+ a `renderConfig(config, patch)` body, saves optimistically). The nine
settings screens supply only their config form.

### Workspace screens (registry titles)

Settings-style (`CheckinSettingsScreen` + config form):
- **QR Tickets** — QR appearance & encoded-data settings (no global enable; it's
  config for the per-event "include QR on ticket" toggle).
- **Wallet Passes** — enable + Apple/Google pass design.
- **Check-in App** — enable + allowed methods, re-entry policy; shows the staff
  route link + access-code note (wired live in Phase 2).
- **Door Sales** — enable + sellable ticket types, payment methods, auto-check-in.
- **Kiosk Mode** — enable + kiosk/tablet mode, allowed actions, idle screen.
- **Session Check-in** — enable (per-event sessions defined in the editor).
- **RFID / NFC** — enable + medium + CSV download (attendee→ID map) & upload with
  checksum verification.
- **Self Check-in** — enable + require-QR / confirmation-screen options.
- **Multi-gate & Zones** — enable + define reusable gates & zones lists.

List/report:
- **Badge Printing** — lists upcoming events → badge designer (premade templates
  + field/layout editor) → export (PDF/PNG/ZIP). Designer scoped to badge
  layout, not a full canvas editor.
- **Real-time Attendance** — events with live checked-in counts (total + per
  gate/session) from `checkin_attendance`, auto-refreshing.
- **Lead Retrieval** — events → captured leads → CSV export (`downloadCsv`).
- **Name-search Lookup** — search an event's attendees by name → view
  ticket/status → manual check-in (writes `checkin_attendance`).

Rules: **Staff Scanning Roles** — records-style screen: create role, set
permissions + gates/zones, generate access code.

Under development: **Offline Check-in** — a themed "under development" screen (an
on-brand variant of ComingSoon, explicitly labelled under development).

*Not in the requested list — left on the existing ComingSoon fallback: "Capacity
Control", "Smart Badges".*

### Per-event editor (`event_sections.js` + `event_detail.jsx`)

A new **"Check-in"** nav group with sections, each gated on the global feature:
- **Check-in options** (QR on ticket, wallet pass, self check-in, allowed methods)
- **Gates & Zones** (pick from the global lists)
- **Sessions** (define this event's sessions)
- **Door Sales & Kiosk** (per-event enable of each)

Sections read `getCheckinSettings(projectId)` to know which features are globally
on, and persist to `metadata.checkin` via `updateEventMeta`.

## Error handling & states

Data layer pure (validate, `console.error`, return `null`/`false`/`[]`). Every
list has loading / empty / filtered-empty states. Mutations optimistic + toast +
reconcile on failure. Semantic color tokens only.

## Phase 2 (deferred — separate spec)

Three staff-facing routes under `app/`, gated by per-event **access code / PIN**
generated from Staff Scanning Roles / Check-in App:
- **Check-in App scanner** — real in-browser camera QR scanning **and** manual
  ticket-ID / name entry, both persisting to `checkin_attendance`.
- **Kiosk Mode** — full-screen kiosk + tablet self-service (check-in / register /
  buy).
- **Door Sales POS** — walk-in ticket sales via the existing orders/checkout
  layer, recorded as paid-at-door (cash/card/comp), auto-checking the buyer in.

## Files

- `supabase/sqls/checkin.sql`, edits to `supabase/sqls/zz_project_access.sql`
- `lib/supabase/checkin.js`
- `components/internal/screens/checkin/` — `constants.js`, `checkin_kit.jsx`,
  and one file per screen
- `components/internal/screens/registry.jsx` (register titles)
- `components/internal/screens/events/event_sections.js` + `event_detail.jsx`
  (Check-in group + sections)
