# Live Rooms & Measured Engagement — Design

**Date:** 2026-08-10
**Area:** Conference → Broadcast & On-demand
**Status:** Approved, ready for implementation planning

---

## 1. Why

The seven Broadcast & On-demand screens (Livestream Rooms, Webinar Rooms,
Breakout Rooms, Simulive & On-demand, Recordings & Replay, Captions &
Transcription, Mobile Event App) are today a **system of record**: an organiser
types metadata about a broadcast that happens on someone else's platform. The
market equivalents (Cvent Attendee Hub, RingCentral Events, ON24, Goldcast,
Hubilo, Swapcard) are a **runtime** — the platform is the room.

Three concrete consequences in the current build:

- **Livestream, Webinar and Breakout Rooms produce nothing an attendee can
  open.** `components/portal/portal_watch.jsx` has no notion of a live room, and
  `lib/portal/watch.js` resolves only `["recording", "simulive"]`.
- **Every metric is hand-typed.** `registered`, `attended`, `views`, `joined`
  are `number` inputs in `modules.jsx`, so every StatsBar computes honestly over
  invented numbers.
- **Nothing can be scheduled.** All time fields are free text
  (`scheduledFor: "e.g. Day 1 · 09:00"`), so no countdown, sort, reminder or
  premiere can ever fire.

This slice closes those three, without taking on a paid media provider.

## 2. Scope

### In scope

1. Real `starts_at` / `ends_at` on room-ish records, a datetime control
   replacing the free-text fields, and automatic room state with a manual
   organiser override.
2. A **Live** tab in the members portal where an entitled member opens a room:
   embedded stream plus chat, Q&A and polls alongside.
3. The `access` model — today only on Simulive — extended to livestream,
   webinar and breakout records, resolved through one shared resolver.
4. Presence heartbeats producing live concurrency, unique viewers, watch time
   and attendance. The typed `views`, `joined` and `attended` fields are
   **deleted** from the room and library module configs and replaced by derived
   readouts.

   **Exception:** webinar `registered` has no source in this slice — the
   registration machine is out of scope, and presence measures attendance, not
   sign-ups. It therefore stays an explicit organiser input, labelled in the UI
   as manually entered, and the derived show-rate stat is computed against it
   with that caveat. `accuracy` on caption jobs is likewise untouched, since
   captions are out of scope.
5. Breakout **orchestration**: real roster, a working assignment engine behind
   the currently-inert `autoAssign` switch, pre-assignment, a timer, and
   broadcast-to-all-rooms. Video remains an external join link.
6. Record graph: `session`, `speaker` and `parentSession` become references to
   sibling `conference_records` rather than free text.

### Out of scope (each its own later slice)

- The media plane (Mux / Cloudflare Stream / LiveKit) — real ingest keys,
  stream health, hosted playback.
- Real ASR captions. `captions.jsx` stays simulated (`PROCESS_MS = 4500`).
- The webinar registration machine (form builder, registrant list, unique join
  links, reminder sequence).
- The mobile event app, pending the native-vs-PWA decision.
- AI clipping, chapters, transcript-seek.

### Accepted debt

Recordings keep their `public` boolean and `/r/<id>` keeps working untouched, so
after this slice the library has **two gating models side by side**: rooms and
simulive on `access`, recordings on `public`. This was a deliberate choice to
avoid widening the blast radius onto the public replay page and its RLS policy.
Retire it in a later slice.

## 3. Architecture

Rooms stay rows in `events.conference_records` — the discriminated table the
whole shared records kit is built on (`module` discriminator, promoted
`name`/`status`/`cover_url`, everything else in `config` jsonb).

Rejected alternative: promoting rooms into dedicated `events.rooms` /
`events.room_messages` tables. Cleaner data model, but it forks the records kit
that generically drives the list, filters, stats and detail rendering for all
seven screens, and delivers nothing visible in this slice. Revisit when the
media plane lands.

Rejected alternative: no new tables, presence counters in `config` jsonb.
Concurrent heartbeats into one jsonb row contend and lose writes — metrics that
are quietly wrong are worse than metrics that are honestly manual.

The growth in `config` is contained by a new `lib/live/` module, the only place
that knows the shape.

## 4. Data model

### Migration A — promoted time columns

```sql
alter table events.conference_records
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

create index if not exists conference_records_starts_at_idx
  on events.conference_records (project_id, module, starts_at);
```

Backfill leaves `starts_at` null wherever the existing text cannot be parsed to
an instant — `"Day 1 · 09:00"` is relative to an event day, not a date. **A null
`starts_at` means "no schedule; the organiser drives state manually"** and is a
first-class path, not a fallback: it is the state every existing row lands in.

The old text fields are retained as display labels for one release, then dropped
by a later migration.

### Migration B — presence

```sql
events.room_presence (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  room_id         uuid not null
                    references events.conference_records(id) on delete cascade,
  -- Plain uuid, no FK: portal members are not auth.users and the buyer identity
  -- table is not referenced from this schema elsewhere.
  member_id       uuid,
  session_key     text not null,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  seconds_watched integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
)
```

Unique on `(room_id, session_key)`. The watch page upserts a heartbeat every
30 s. Derived metrics, all from this one write path:

- **Live concurrency** — rows with `last_seen_at > now() - interval '90 seconds'`
- **Unique viewers** — distinct `member_id`
- **Watch time** — `sum(seconds_watched)`
- **Attendance** — distinct `member_id` over the room's window

RLS enabled with the suite's current demo-open policy, matching every other
table in this schema.

### Chat binding

One `events.chat_channels` row per room, discovered via `metadata.roomId`. No
new messaging tables: polls (`lib/chat/poll.js`), reactions, replies, Realtime
and the scoped-JWT auth path (`lib/portal/chat_realtime.js`) all carry over
unchanged.

### Record graph

`config.sessionId`, `config.speakerId` and `config.parentSessionId` are added
beside the existing text values. A one-time backfill matches on exact name;
unmatched rows keep their text and surface an "unlinked" hint in the detail
panel rather than silently losing data.

## 5. Components

### New shared module `lib/live/`

| File | Purpose | Depends on |
|---|---|---|
| `state.js` | Pure. `(record, now) → "Scheduled" \| "Opening soon" \| "Live" \| "Ended"`, honouring a manual override at `config.manualState`. No I/O. | none |
| `access.js` | Generalises the grant logic currently inline in `lib/portal/watch.js` so rooms and library items share one resolver | `lib/memberships/entitlements.js` |
| `presence.js` | Heartbeat upsert and concurrency / watch-time rollups | `lib/supabase/admin` |

`lib/portal/watch.js` is refactored to call `access.js` instead of keeping its
own copy of the grant logic. This is the one targeted cleanup the work justifies.

### Organiser side

- `components/internal/shared/records/record_fields.jsx` — two new cases in the
  field-type switch: `datetime` (writes ISO to the promoted column) and `ref`
  (typeahead over sibling `conference_records` of a named module).
- `components/internal/shared/records/builders.jsx` — `dateTimeField()` and
  `refField(module)` factories, keeping `modules.jsx` declarative.
- `components/internal/screens/conference/modules.jsx` — `access` added to
  room / webinar / breakout; `scheduledFor` and `premiereAt` become `datetime`;
  `session` / `speaker` / `parentSession` become `ref`; the typed `registered`,
  `attended`, `views` and `joined` fields are deleted and replaced by read-only
  derived readouts.
- New `components/internal/screens/conference/live_control.jsx` — Go Live / End
  panel plus live concurrency on room detail.
- New `components/internal/screens/conference/breakout_assign.jsx` — roster and
  the assignment engine.

### Portal side

- `components/portal/portal_sidebar.jsx` — a `Live` item in the Content group
  beside Watch.
- New `components/portal/portal_live.jsx` — the entitled room list (sorted by
  `starts_at`, countdown per room) and the room view: player via the existing
  `lib/video-embed.js`, engagement rail alongside. The rail **reuses** the
  existing chat components and `portal_qa.jsx` bound to the room's channel; no
  new messaging UI.
- New `app/api/portal/live/route.js`, `app/api/portal/live/[id]/route.js`,
  `app/api/portal/live/heartbeat/route.js`.
- New `lib/portal/live.js` — server-only resolver mirroring `lib/portal/watch.js`.

## 6. Data flow — member opens a room

1. `GET /api/portal/live` → `lib/portal/live.js` resolves the member's
   memberships and tickets → access-filtered rooms, each stamped with state from
   `lib/live/state.js`.
2. Opening a room starts a 30 s heartbeat carrying a per-tab `session_key`,
   upserted into `events.room_presence`.
3. Chat, Q&A and polls subscribe over the existing scoped-JWT Realtime path,
   falling back to polling when `SUPABASE_JWT_SECRET` is absent — the behaviour
   `chat_realtime.js` already implements.
4. The organiser's room detail and every affected StatsBar read presence
   rollups instead of `config` numbers.

## 7. Error handling

The governing rule: **fail closed on access, fail open on metrics.**

- Access resolution error → return `[]`. A member never sees a room we could not
  prove they are entitled to.
- Heartbeat failure → retried with backoff, then abandoned silently. Playback
  never blocks on a metric write.
- Realtime token failure → poll, as today.
- `starts_at` null → manual mode; no countdown, organiser drives state.
- Data-layer functions stay pure per `SUPABASE_CONVENTIONS.md`: validate,
  `console.error`, return `null` / `[]` / `false`. The screen owns toasts and
  optimistic state.

## 8. Testing

Matching the repo's existing precedent (`lib/seating/*.test.js`, `node:test`,
no runner script, no component-test framework):

- `lib/live/state.test.js` — boundary times, manual-override precedence, the
  null-schedule path.
- `lib/live/access.test.js` — grant union across plan-side and content-side,
  expiry windows, deny-on-error.
- Rollup SQL and UI verified manually against a seeded project.
- `npx eslint` clean on every touched file.

## 9. Success criteria

- A member with the right entitlement opens a live room from the portal and can
  watch, chat, ask a question and vote in a poll.
- A member without the entitlement never sees the room.
- Room state changes on its own at `starts_at` / `ends_at`, and an organiser can
  override it at any time.
- Every number on the seven screens' StatsBars is derived from a real
  measurement or an explicit organiser input — none is a typed-in fiction.
- `autoAssign` on a breakout actually assigns people.
- Existing rows with unparseable time text continue to work in manual mode.
