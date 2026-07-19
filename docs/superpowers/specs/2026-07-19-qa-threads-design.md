# Q&A Threads — Design

**Date:** 2026-07-19
**Status:** Approved (brainstorming) — implementing directly (user opted out of the
separate plan/review gate).
**Slice:** Builds on the approved **Event Chat / Channel Foundation**
(`2026-07-18-event-chat-foundation-design.md`). Adds the **Q&A** area: organiser-
curated, topic-based discussion threads per event, one `kind='qa'` channel each.

---

## 1. Purpose

The Community sidebar has a **Q&A** entry (currently unwired → ComingSoon). This
slice makes it a **thread opener**: the organiser creates named discussion threads
for an event (e.g. "Parking & travel", "After-party"), each open to **all** the
event's attendees **or** a **selected/managed subset** of members. Attendees read
and chat in the threads they belong to from a new members-portal **Q&A** section.
Everything rides the existing chat backbone — a thread is just a channel with
`kind='qa'`.

### Success criteria
- Organiser opens a thread for an event (Community → Q&A), choosing name,
  description, posting mode, and audience (all attendees / selected members).
- "All attendees" threads back-fill every existing buyer and auto-enrol future
  buyers; "selected" threads enrol only the chosen members.
- Attendees see their Q&A threads in a dedicated portal **Q&A** section with live
  updates, reactions, and read state; post when the thread is `open`, react-only
  when `announce`.
- Organiser moderates a thread (delete message, mute/remove participant, add
  members to a selected thread, toggle open/announce, archive/delete).
- No new tables; existing chat RLS already covers `kind='qa'` channels.

## 2. Non-goals
Structured Q&A affordances (upvotes, accepted answers, resolved state), member-
created threads, nested replies, attachments. Threads are topic-based group chats.

---

## 3. Decisions (from brainstorming)
1. **Topic-based group threads** (not structured Q&A). Reuse `chat_kit` wholesale.
2. **Organiser-only creation.**
3. **Per-thread audience:** `all` (every event attendee) or `selected` (a managed
   subset), stored in `chat_channels.metadata.audience`.
4. **Separate portal "Q&A" section**, distinct from the event-chat Community
   section.
5. **Per-thread posting mode:** organiser can toggle `open` ↔ `announce`
   (default `open` for Q&A). Reuses the existing channel field.
6. Q&A threads keep the same message features as Event Chat (reactions, replies,
   polls) — consistency, zero extra work.

---

## 4. Data model (no schema change)

Reuses `events.chat_channels / chat_participants / chat_messages`. A Q&A thread =
a channel with `kind='qa'`, `name`=thread title, `topic`=description,
`metadata.audience ∈ {all, selected}`. The `chat_channels_event_uidx` unique index
is scoped to `kind='event'`, so many `qa` channels per event are allowed. Existing
RLS (`chat_*_access` in `zz_project_access.sql`) is kind-agnostic and already
covers these rows — **unchanged**.

### New SQL (`supabase/sqls/z_chat.sql`, idempotent)

- **`events.create_qa_thread(p_event_id, p_name, p_topic, p_posting_mode,
  p_audience, p_emails text[]) → uuid`** — SECURITY DEFINER. Guards
  `can_access_project(project)` (via the caller's `auth.uid()`), inserts the
  `kind='qa'` channel (stamping `created_by=auth.uid()`, `metadata.audience`),
  then enrols participants: all event buyers for `audience='all'`, or the members
  matching `p_emails` for `audience='selected'`. Mirrors `ensure_event_chat`.
- **`events.add_qa_participants(p_channel_id, p_emails text[]) → int`** —
  SECURITY DEFINER. Guards `can_access_project` via the channel's project, resolves
  emails → `portal_members`, inserts participants `on conflict do nothing`. Powers
  "add members" on a selected thread. Returns the number added.
- **Extend `events.add_ticket_buyer_to_chat`** — after enrolling the buyer in the
  event chat, also enrol them into every `kind='qa'` channel of that event whose
  `metadata.audience = 'all'`. So new buyers accrue into open Q&A threads too.
  (`buy_ticket` already calls this helper — no change there.)

---

## 5. Organiser data layer (`lib/supabase/chat.js`)

Add to the existing organiser layer (Supabase-authed, RLS-gated). Reuses
`listProjectChannels(projectId, { kind: 'qa' })`, `listMessages`, `sendMessage`,
`sendPoll`, `toggleReaction`, `votePoll`, `softDeleteMessage`, `listParticipants`,
`setParticipantMuted`, `removeParticipant`, `updateChannel`, `subscribeChannel`.

- `normalizeChannel`: surface `audience` from `metadata` (default `all`).
- `createQaThread({ eventId, name, topic, postingMode, audience, emails })` → RPC
  `create_qa_thread` → `getChannel(id)`.
- `addQaParticipants(channelId, emails)` → RPC `add_qa_participants`.
- `softDeleteChannel(channelId)` → soft-delete a thread (`deleted_at`).
- `listEventBuyers(eventId)` → distinct `{ email, name }` from `event_orders`
  (organiser-readable via RLS) — the source for the audience picker.

## 6. Organiser screen (`components/internal/screens/community/qa_threads.jsx`)

Registered in `registry.jsx` under `"Q&A"`. Modelled on `event_chat.jsx`:
- List of the project's `kind='qa'` threads (search, event filter, mode/status/sort
  filters). Fetches `listEvents(projectId)` to resolve `eventId → name` for display
  and the create dialog.
- **New thread** primary action → dialog: Event (select), Name, Description,
  Posting mode (open/announce), Audience (All attendees / Selected → **audience
  builder**). Optimistic insert + `createQaThread`.

### Audience builder (`components/internal/shared/audience/`)
A **shared, reusable** guest/audience selector used everywhere in Community a
person is selectable. It resolves client-side to a concrete set of emails (the
`create_qa_thread` / `add_qa_participants` RPCs map emails → `portal_members`, so
**no SQL change**). Two pieces:
- **`audience_builder.jsx`** — faceted picker, `{ projectId, eventId?, selected,
  onSelectedChange }`. Facets combine (AND across groups, OR within):
  - **Tag / Status / Segment / Individual** — always (project-wide pool =
    `listGuests`). Segment uses `isSegmentMember` + an attendance `ctx`.
  - **Ticket / Offering-option / Purchasable** — only when an `eventId` is set;
    derived from that event's **actual order selections** (`listOrders`): tickets
    from `ticket_name`, offering options from `metadata.offerings`
    (`"<offering>::<option label>"`), add-ons from `metadata.purchasables`. So
    "ticket + specific offering" is just two facets together, and only
    actually-chosen options appear.
  - Free-text search + "Select all shown" + per-row checkboxes.
- **`audience_field.jsx`** — a form control wrapping the builder with an optional
  **event scope** picker ("All guests" = project-wide; pick an event to unlock the
  ticket/offering/purchasable facets). Stores `{ eventId, emails }`.

**Reuse across Community:**
- **Q&A** "selected members" (create dialog + participants "Add members") use the
  builder directly (event fixed to the thread's event).
- **Polls / Surveys / Announcements** (records kit) use `audience_field` via a new
  `"audience"` field type added to `record_fields.jsx` (`FieldControl` now receives
  the record's `values` for `projectId`); each stores `config.audience =
  { eventId, emails }`, replacing the old hardcoded
  `"All attendees / Speakers / …"` dropdown.

Only buyers can be enrolled/targeted with ticket/offering facets (they carry order
data); project-wide mode targets any guest. Selection is a **snapshot** of matched
emails.
- Drill-in → `ChatThread` (reactions/replies/polls) + a participants/moderation
  dialog (mute/remove; **add members** for selected threads) + a settings menu
  (posting-mode toggle via `updateChannel`, archive, delete via `softDeleteChannel`).

## 7. Members portal

- **`/api/portal/chat/channels`**: accept `?kind=` and pass to
  `listMemberChannels(memberId, { kind })` (filters the member's channels by kind).
  Detail/messages/reactions/vote/read routes are kind-agnostic — unchanged.
- **Extract `components/portal/portal_channels.jsx`** — a generic
  `{ kind, title, description, emptyText }`-driven version of the current
  `portal_community.jsx` logic (channel list + `ChatThread` + realtime/poll
  fallback). `portal_community.jsx` becomes a thin wrapper (`kind='event'`); new
  **`portal_qa.jsx`** wraps `kind='qa'`.
- **`portal_sidebar.jsx`**: add a **Q&A** item (key `qa`, `HelpCircle`) in the
  Community group. **`portal_shell.jsx`**: route `tab==='qa'` → `<PortalQa>`.

## 8. Reused as-is
`chat_kit` (`ChatThread`, `ChannelList`, poll UI), realtime
(`subscribeChannel` / `subscribeMemberChannel` + polling fallback), the
realtime-token route, and all chat RLS.

## 9. Testing
- SQL: `create_qa_thread` enrols all buyers (all) / only listed emails (selected)
  and is guarded by `can_access_project`; `add_ticket_buyer_to_chat` adds new
  buyers to `audience='all'` qa threads; `add_qa_participants` resolves emails.
- Screen: three list states; create-thread optimistic + reconcile; moderation;
  posting-mode toggle; archive/delete.
- Portal: Q&A section lists only `kind='qa'`; post blocked when announce/muted;
  live updates; read clears on open.
- E2E smoke: create an all-audience thread → existing buyer sees it → buyer posts
  → organiser sees it live; create a selected thread → only chosen members see it.

## 10. Build order
1. `z_chat.sql`: `create_qa_thread`, `add_qa_participants`, extend
   `add_ticket_buyer_to_chat`.
2. `lib/supabase/chat.js`: `createQaThread`, `addQaParticipants`,
   `softDeleteChannel`, `listEventBuyers`, `normalizeChannel.audience`.
3. `qa_threads.jsx` + registry wiring.
4. Channels route `?kind=` + `listMemberChannels` kind filter.
5. `portal_channels.jsx` extraction + `portal_community.jsx` wrapper +
   `portal_qa.jsx` + sidebar/shell wiring.
6. Lint clean.
</content>
</invoke>
