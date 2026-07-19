# Event Chat / Channel Foundation — Design

**Date:** 2026-07-18
**Status:** Approved (brainstorming) — ready for implementation plan
**Slice:** 1 of N in the Events "Community" area. This slice builds the reusable
chat/channel backbone. Later slices (own specs): Polls-in-chat, Discussion
Boards, Q&A, Announcements, Surveys, Meeting Scheduler.

---

## 1. Purpose

When an event's tickets open to the public, a group **Event Chat** opens
automatically and every ticket buyer is added to it — and keeps being added as
more people buy. Buyers use it from the **members portal**; the organiser
configures and moderates it from a new **Communication** section in the event
editor. This slice delivers only the backbone (channels + participants +
messages + realtime + the two surfaces); everything else in Community stacks on
it later.

### Success criteria
- Publishing an event creates its chat channel; the organiser picks the posting
  mode at that moment; existing buyers are back-filled.
- Buying a ticket adds the buyer as a participant automatically.
- A buyer sees the event chat in the portal's new **Community** section and can
  read/post (when allowed) with **live** updates, reactions, and read state.
- The organiser reads/posts/moderates from the event editor's **Communication**
  section.
- No geiger-chat database tables are used; only new `events.*` tables.

## 2. Non-goals (explicitly out of this slice)
Polls-in-chat, Discussion Boards, Q&A, Announcements, Surveys, Meeting Scheduler,
sub-threads, file attachments, presence/typing indicators, audio/video calls.
These are separate specs. Direct Messaging (buyer↔organiser) already exists as
the organiser inbox (`lib/supabase/messages.js`, portal `Messages`) and is not
re-touched here.

---

## 3. Decisions locked in brainstorming
1. **First slice = chat/channel foundation.**
2. **Full Supabase Realtime** — members get a short-lived scoped JWT (custom auth
   can't otherwise be RLS-scoped for realtime).
3. **Event chat posting mode is chosen by the organiser at creation** (on
   publish): `open` (group discussion) vs `announce` (organiser posts, members
   react only).
4. **Organiser surface** = new **Communication** section in the event editor.
5. **Members-portal surface** = new **Community** sidebar section (group chats),
   separate from the existing 1:1 **Messages** (organiser DMs).
6. **Include** reactions + read state in this slice.
7. **Use `SUPABASE_JWT_SECRET`** (new server env var) for the member realtime JWT.

---

## 4. Data model (`events` schema; `supabase/sqls/chat.sql`)

Idempotent, self-contained, following existing conventions (schema-qualified,
`flow_touch_updated_at`/local `touch_updated_at`, soft delete, `metadata jsonb`).

### `events.chat_channels`
| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| project_id | uuid not null → public.projects | org-scoped RLS anchor |
| event_id | uuid → events.events | the event this channel is for (unique per event for kind='event') |
| kind | text default 'event' | future: 'board','qa','dm' |
| name | text | e.g. the event name |
| topic | text | optional |
| posting_mode | text default 'announce' | 'open' \| 'announce' |
| status | text default 'active' | 'active' \| 'archived' |
| created_by | uuid → public.users | organiser who created it (nullable for system) |
| metadata | jsonb default '{}' | expansion bag |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz | soft delete |

Unique partial index: one active `kind='event'` channel per event
(`(event_id) where kind='event' and deleted_at is null`).

### `events.chat_participants`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| channel_id | uuid not null → chat_channels (on delete cascade) | |
| member_id | uuid → events.portal_members | set for a buyer |
| user_id | uuid → public.users | set for an organiser |
| role | text default 'member' | 'member' \| 'organiser' \| 'moderator' |
| muted | boolean default false | organiser can mute a participant |
| last_read_at | timestamptz | read-state cursor |
| joined_at | timestamptz default now() | |

- CHECK: exactly one of `member_id`/`user_id` is non-null.
- Unique `(channel_id, member_id)` and `(channel_id, user_id)`.
- Index `(channel_id)`, `(member_id)`.

### `events.chat_messages`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| channel_id | uuid not null → chat_channels (on delete cascade) | |
| author_member_id | uuid → events.portal_members | buyer author |
| author_user_id | uuid → public.users | organiser author |
| sender_kind | text not null default 'member' | 'member' \| 'organiser' \| 'system' |
| author_name | text | **denormalized** display name (avoids reading service-role-only portal_members from the client) |
| body | text default '' | |
| metadata | jsonb default '{}' | `reactions {emoji:[key]}`, `replyTo {id,authorName,body}`, `type` (future) |
| created_at | timestamptz default now() | |
| edited_at | timestamptz | |
| deleted_at | timestamptz | soft delete (tombstone renders as "message removed") |

Index `(channel_id, created_at)`.

All three tables are added to the `supabase_realtime` publication.

---

## 5. RLS & Realtime authorization

Policies live in `supabase/sqls/zz_project_access.sql` (after
`events.can_access_project` is defined). RLS enabled on all three tables.

A channel row / its participants / its messages are visible/writable when **either**:
- **Organiser:** `events.can_access_project(channel.project_id)` (authenticated
  suite user who is an org member) — full read/write (moderation).
- **Member:** the caller's JWT carries a `member_id` claim that matches a
  `chat_participants` row for that channel:
  `exists (select 1 from events.chat_participants p where p.channel_id = <row>.channel_id and p.member_id = (auth.jwt() ->> 'member_id')::uuid)`.

`chat_messages`/`chat_participants` resolve the project/participation through
their `channel_id`. Helper: `events.chat_channel_member(channel uuid)` (SECURITY
DEFINER, stable) returning whether the JWT's `member_id` participates — keeps
policies terse and avoids recursive RLS on `chat_participants`.

**Member realtime JWT.** New route `POST /api/portal/chat/realtime-token`:
- Requires a valid portal session (`getSessionMember`).
- Signs a JWT with `SUPABASE_JWT_SECRET`, claims:
  `{ role: 'authenticated', sub: <member_id>, member_id: <member_id>, exp: now+~55min }`.
- Browser calls `supabase.realtime.setAuth(token)` before `.subscribe()`.
- The token is **read-only in practice**: members never write via the browser
  client (all writes go through service-role server routes), and the member RLS
  policies only grant row visibility scoped to channels they participate in.

**Security review notes to honor in implementation:**
- The member JWT uses role `authenticated`; confirm no `events.*` table has a
  permissive `using(true)` write policy that a member JWT (no `auth.uid()`) could
  exploit. Existing `*_public_read` policies are already anon-readable, so a
  member JWT reading them is no worse than anon.
- `can_access_project` uses `auth.uid()`; a member JWT has no matching user row,
  so it returns false — members get nothing through organiser policies. Good.

---

## 6. Auto-population

- **On publish** (dashboard publish action): call SECURITY DEFINER RPC
  `events.ensure_event_chat(p_event_id uuid, p_posting_mode text)` which
  creates the channel if missing (stamping `project_id`, `name`, chosen
  `posting_mode`, `created_by`) and **back-fills** participants from every
  existing `event_orders` buyer of that event (resolve `portal_members` by
  email; insert `chat_participants` with `on conflict do nothing`). The publish
  UI collects the posting-mode choice.
- **On purchase**: extend `events.buy_ticket` to, after creating the order +
  portal member, `ensure_event_chat` (fallback default `posting_mode='announce'`
  if not yet created) and insert the buyer as a participant
  (`on conflict do nothing`). Buyers therefore accrue automatically.
- A `system` message ("Chat opened") may be posted on creation (nice-to-have).

---

## 7. Data access

### Organiser (dashboard, Supabase-auth, events-schema browser client)
`lib/supabase/chat.js` — pure data layer (guard `isSupabaseConfigured`, return
`null/false/[]`, `console.error`, never throw/toast):
- `normalizeChannel/normalizeParticipant/normalizeMessage` (snake→camel).
- `getEventChannel(eventId)`, `updateChannel(id, patch)` (posting_mode, topic, status).
- `listMessages(channelId, { before?, limit })`, `sendMessage(channelId, body, replyTo?)`
  (sender_kind `organiser`, stamps `author_user_id` + `author_name` from `getUser`).
- `setReaction(messageId, emoji)`, `softDeleteMessage(messageId)`.
- `listParticipants(channelId)`, `setParticipantMuted(id, muted)`,
  `removeParticipant(id)`.
- `subscribeChannel(channelId, handlers)` — realtime `postgres_changes` on
  `chat_messages`/`chat_participants` filtered by `channel_id`; returns an
  unsubscribe fn.

### Member (portal, custom auth → service-role server routes)
Under `app/api/portal/chat/`:
- `GET channels` → the session member's channels (+ unread counts, last message).
- `GET channels/[id]` → channel + message history (verify participant); also
  clears the member's unread by advancing `last_read_at` on open.
- `POST channels/[id]/messages` → post as `member` (403 if `posting_mode='announce'`
  or participant `muted`); stamps `author_member_id` + denormalized `author_name`.
- `POST channels/[id]/reactions` → toggle emoji.
- `POST channels/[id]/read` → advance `last_read_at`.
- `POST realtime-token` → the scoped JWT (section 5).
All via `adminClient()` (service role), strictly scoped to `getSessionMember`.
Reads-of-record and writes go through these routes; the browser Supabase client
is used **only** for the realtime subscription (with the JWT).

---

## 8. UI (reuse geiger-chat, copied & adapted — not imported at runtime)

Port geiger-chat's prop-driven presentational components into a shared
`components/chat/` kit in this repo (same Tailwind semantic tokens + shadcn +
Lucide, so it matches). Fed by two thin data adapters (organiser vs member).
Components to port/adapt: `message-group`, `composer`, `conversation-list`,
`chat-thread`, `user-avatar`, `typing-indicator` (unused this slice), reactions
from `chat-utils`. View-model shapes mirror geiger-chat's `normalizeMessage` /
`normalizeConversation` so the components drop in:
- **Message**: `{ id, authorKey, authorName, sender_kind, text, createdAt,
  reactions, replyTo, deleted }`.
- **Channel**: `{ id, name, topic, postingMode, unread, lastActivity,
  participantCount }`.

### Organiser — event editor **Communication** section
- Register a new section `communication` in
  `components/internal/screens/events/event_sections.js` → `EventCommunicationSection`.
- Tabs/panels: **Settings** (enable/opened state, posting mode toggle, participant
  count, moderation) and **Chat** (the live `chat-thread` where the organiser
  posts as organiser and moderates: delete message, mute/remove participant,
  lock to announce-only).

### Member — portal **Community** section
- New portal sidebar entry **Community** (`components/portal/portal_sidebar.jsx`
  + `portal_shell.jsx` tab wiring) → `PortalCommunity`.
- Left: the member's event channels (`conversation-list`). Right: the
  `chat-thread` — post if `posting_mode='open'` and not muted; reactions; read
  state; live updates via the realtime subscription (token from the route).

---

## 9. Settings & moderation surface (this slice)
- Posting mode: `open` ↔ `announce` (organiser toggle, persisted on channel).
- Archive/reopen channel (`status`).
- Per-message: organiser soft-delete (tombstone).
- Per-participant: mute (can't post) / remove.

---

## 10. Environment
- New: `SUPABASE_JWT_SECRET` (server-only) for signing member realtime JWTs.
  Documented in `.env`. Absent → realtime-token route returns 501 and the member
  chat degrades to a manual-refresh fetch (graceful, no crash).

---

## 11. Testing
- **SQL/RLS**: a member JWT sees only channels they participate in; an organiser
  sees their project's channels; a member JWT cannot read another member's
  channel; `ensure_event_chat` is idempotent; `buy_ticket` adds the participant.
- **Data layer**: normalize/serialize round-trips; tri-state returns.
- **Routes**: posting blocked in `announce` mode / when muted; unread advances on
  open; realtime-token requires a session.
- **UI**: three list states (loading/empty/filtered), optimistic send +
  reconcile, reaction toggle, read badge clears on open.
- **E2E smoke**: publish → channel created with chosen mode; buy a ticket →
  buyer appears; buyer posts → organiser sees it live; organiser replies → buyer
  sees it live.

---

## 12. Risks / open items
- **Member JWT surface**: must audit `events.*` policies for permissive writes a
  member JWT could reach (section 5). Mitigation: member policies are strictly
  channel-participation scoped; organiser policies need `auth.uid()`.
- **Realtime under RLS with custom JWT**: verify `setAuth` + `postgres_changes`
  respects the `member_id` claim in this Supabase project; fall back to
  short-interval polling for the member side if a blocker appears (organiser side
  is unaffected).
- **Back-fill cost**: large existing-buyer sets — `ensure_event_chat` back-fill
  should be a single `insert … select … on conflict do nothing`.
- **posting_mode "at creation"**: honored via the publish flow; a purchase that
  races ahead of publish creates a fallback channel in `announce` until the
  organiser configures it.

---

## 13. Build order (for the implementation plan)
1. `chat.sql` (tables, indexes, realtime publication) + RLS in
   `zz_project_access.sql` + `ensure_event_chat` RPC + `buy_ticket` extension.
2. `SUPABASE_JWT_SECRET` + `/api/portal/chat/realtime-token`.
3. Organiser data layer `lib/supabase/chat.js` (+ realtime subscribe).
4. Member server routes `app/api/portal/chat/*`.
5. Shared `components/chat/` kit ported from geiger-chat.
6. Organiser **Communication** section (settings + live chat + moderation).
7. Portal **Community** section (channel list + chat + realtime).
8. Publish-flow hook to `ensure_event_chat` with posting-mode choice.
9. Tests + `.env` docs.
