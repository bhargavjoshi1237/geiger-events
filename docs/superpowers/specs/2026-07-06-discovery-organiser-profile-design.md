# Discovery — Organiser Profile & Followers

**Date:** 2026-07-06
**Status:** Approved, in build

## Goal

Replace the old multi-item **Discovery** sidebar section with a single **Discovery**
destination: the project's **organiser profile** — a public identity that event
buyers can **follow** to hear about new events. First build captures followers; it
does not send update emails yet (a clean follow-up).

## Fit with existing architecture

- The app is **project-scoped**. Each project already has a public page — the
  **Event Wall** at `/w/<slug>` — and public event pages at `/e/<id>`.
- Buyers are **anonymous**; existing anonymous input (RSVP, checkout) is captured
  through `SECURITY DEFINER` RPCs granted to `anon`. "Follow" is one more such RPC.
- The organiser profile is a **one-per-project record**, mirroring the
  `getWall(projectId)` get-or-create singleton.

## Decisions

- **Scope:** profile editor + follower capture. No broadcast emails yet.
- **Public surface:** reuse the Event Wall (`/w/<slug>`); add a profile header +
  Follow button there rather than a second public route.
- **Profile fields:** identity (display name, avatar URL, banner URL), tagline &
  bio, website + social links, public location + contact email. Images are **URL
  fields** like the wall's existing Logo field — no new storage RLS.
- **Followers on the Discovery screen:** view list + stats, export CSV, remove.
  Sync-to-Guests deferred.

## Data model (`supabase/sqls/discovery.sql`)

`events.organiser_profile` — one row per project (unique `project_id`):

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid not null → public.projects | unique |
| display_name | text | falls back to wall name on the public page |
| tagline | text | |
| bio | text | |
| avatar_url | text | URL field |
| banner_url | text | URL field |
| website | text | |
| location | text | public city/region |
| contact_email | text | public |
| links | jsonb `[]` | `[{ label, url }]` social links |
| metadata | jsonb `{}` | expansion bag |
| created_by | uuid → auth.users | |
| created_at / updated_at / deleted_at | timestamptz | soft delete |

`events.organiser_followers` — one row per (project, email):

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid not null → public.projects | |
| email | text not null | unique `(project_id, lower(email))` |
| name | text | optional |
| source | text | default `'wall'` |
| metadata | jsonb `{}` | |
| created_at | timestamptz | |

- Trigger `events.touch_updated_at()` on `organiser_profile`.
- RPC `events.follow_organiser(p_project_id, p_email, p_name)` — `SECURITY
  DEFINER`, inserts a follower `on conflict do nothing`, granted to `anon,
  authenticated`. Returns `boolean` (true when the DB accepted the call).
- `discovery.sql` ships an **open demo RLS policy** (like `venues.sql`); the real
  policies are added in `zz_project_access.sql`:
  - `organiser_profile`: member `for all` (`can_access_project`) **+ public read**
    (anon `select` — the public page renders it).
  - `organiser_followers`: member `for all` only. Anonymous follows go through the
    `SECURITY DEFINER` RPC, so no anon table policy (mirrors `event_orders`).

## Data layer (`lib/supabase/discovery.js`)

- `normalizeProfile(row)` / `toRow(input)` (emit-when-present), `normalizeFollower`.
- `getProfile(projectId)` — get-or-create (authenticated/dashboard).
- `getPublicProfile(projectId)` — select-only, returns `null` if none (public page;
  no create so anon never hits an insert).
- `updateProfile(projectId, patch)` — optimistic save target.
- `listFollowers(projectId)` — newest first.
- `removeFollower(id)` — hard delete (followers aren't soft-deleted).
- `followOrganiser(projectId, email, name)` — calls the RPC; used by the public
  Follow button.
- Pure: `isSupabaseConfigured()` guard, `console.error` + `null/[]/false`, no toasts.

## Screen (`components/internal/screens/discovery/organiser_profile.jsx`)

`OrganiserProfileScreen` — single-item, project-scoped (like `EventWallScreen`):

- `useProject()` → `projectId`; fetch profile + followers on mount; loading state.
- `ScreenHeader` "Discovery" + description; right actions: **Copy public link** /
  **View live** (to `/w/<slug>` — resolve the wall slug via `getWall`).
- `StatsBar`: total followers · new in last 7 days · profile completeness %.
- **Profile** `SectionCard`: `Field`-wrapped inputs (display name, tagline, bio
  textarea, avatar URL, banner URL, website, location, contact email) + a small
  editable social-links list. **Save** persists via `updateProfile` (optimistic,
  toast).
- **Followers** `SectionCard`: `SearchInput`, `DataTable` (email, name, followed
  date, remove action), **Export CSV**, empty state.
- Semantic tokens only; shared kit + shadcn primitives.

## Public follow (`components/internal/screens/discovery/public_follow.jsx`)

- `OrganiserProfileHeader({ profile, wall })` — avatar + display name (fallback
  `wall.name`) + bio + social links + `FollowButton`. Rendered inside
  `WallPublicPageContent` only when a `profile` prop is passed (other callers
  unaffected).
- `FollowButton({ projectId, name })` — Dialog with an email (+ optional name)
  field → `followOrganiser` → success toast; a `localStorage` key
  (`geiger:following:<projectId>`) flips it to "Following ✓".
- `wall_client.jsx` fetches `getPublicProfile(wall.projectId)` after the wall and
  passes it into `WallPublicPageContent`.

## Wiring

- `sidebar_nav.jsx`: single `{ title: "Discovery", icon: Compass }` between
  Workflows and Community.
- `registry.jsx`: `Discovery: OrganiserProfileScreen`.
- `lib/rbac.js`: add `{ key: "view.discovery", label: "Discovery", group:
  "Workspace views" }` (advisory gating, reachable by default).

## Out of scope (future)

- Sending update emails / push to followers when a new event publishes.
- Sync followers into the Guests/Contacts CRM.
- Follower double opt-in / unsubscribe management.
