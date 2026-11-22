# Member push notifications + OTA updates — design

Date: 2026-11-22 · Status: approved in conversation ("looks good, implement fully")

## Goal

Members of the Geiger Events mobile app get a push for everything they would reasonably expect one for: ticket and order changes, registration decisions, event changes, reminders, organiser messages, community replies, meetings and live rooms. Each push opens the right screen. Organisers can manage push per project. The app also gets EAS over-the-air updates. Delivery goes through **Expo's push service**, which uses the FCM V1 key stored in EAS for Android and APNs for iOS.

## Decisions

- **Capture in the database.** Most organiser actions write to Supabase straight from the browser (anon key), so `AFTER` triggers on `events.*` tables enqueue notifications. API routes alone would miss them.
- **A dedicated schema, `events_push`.** It holds every push table and function. Triggers on `events.*` call `events_push.enqueue(...)`. PostgREST must expose `events_push` (Dashboard → API → Exposed schemas). Only `service_role` gets usage; anon and authenticated get none.
- **Scheduler: Supabase pg_cron + pg_net.** Vercel Hobby only allows daily crons. Two jobs:
  - `events-push-dispatch` runs every 30 s and calls `events_push.kick()`. That function POSTs `{base_url}/api/internal/push/dispatch` only when queued rows are due, a fan-out is pending, or receipts are due.
  - `events-push-plan` runs every 5 min and POSTs `{base_url}/api/internal/push/plan`.
  - Both send `Authorization: Bearer <secret>`. The base URL and secret live in `events_push.runtime`, a single row with RLS on and no policies.
- **Rendered at send time.** Triggers and planners only store `type` + `ref` (ids). The JS catalog (`lib/push/catalog.js`) loads the data and renders title, body and deep link when the row is claimed. The rendered copy is saved on the row, so the in-app history shows exactly what was sent.
- **Rows are the history.** `events_push.notifications` has one row per member per notification. A row exists even when the member has no device, so the in-app feed is complete.
- **Management**, modelled on API & Webhooks: per-type switches, reminder timings, quiet hours, a delivery log with retry, a test send, and a scheduler panel with a per-project pause. The settings routes use `withProjectManager` (`events.settings.manage`).
- **OTA:** `expo-updates` with the fingerprint runtime policy. The app checks on launch and on return to the foreground (at most every 15 min), downloads silently and shows an "Update ready · Restart" toast. If ignored, the update applies on the next cold start.
- **Brand icons:** Android's status-bar icon is a white Geiger mark, with a neutral accent `#9A9A9A`. In the app, the Geiger mark replaces every bell, and notification cards get an icon per type.

## Schema `events_push`

| Table | Columns (beyond id / created_at / updated_at) |
|---|---|
| `runtime` | `id boolean pk default true check (id)`, `base_url text`, `secret text`, `paused boolean default false` |
| `notifications` | `member_id uuid not null`, `project_id uuid`, `event_id uuid`, `type text`, `category text`, `ref jsonb`, `dedupe_key text unique`, `send_after timestamptz`, `expires_at timestamptz`, `status text` (queued·sending·sent·failed·skipped), `skip_reason text`, `attempts int`, `lease_until timestamptz`, `title text`, `body text`, `data jsonb`, `sent_at timestamptz`, `last_error text` |
| `deliveries` | `notification_id`, `device_id`, `push_token`, `ticket_id text`, `status text` (ok·error), `error text`, `receipt_status text` (pending·ok·error), `receipt_error text`, `receipt_checked_at` |
| `devices` | Moved from `events.portal_devices` (rows copied; the old table is kept read-only for one release). Unique `push_token`. |
| `member_preferences` | `member_id pk`, `categories jsonb` (category → bool; a missing key means on) |
| `project_settings` | `project_id pk`, `types jsonb` (type → bool), `event_offsets int[] default {1440,60}` (minutes), `membership_days int[] default {7,1}`, `quiet_hours jsonb default {"enabled":false,"start":"22:00","end":"08:00"}`, `paused boolean default false` |
| `fanouts` | `project_id`, `event_id`, `type`, `ref jsonb`, `audience jsonb`, `dedupe_key unique`, `status` (pending·done·failed), `send_after`, `error` |
| `dispatch_runs` | `kind` (dispatch·plan), `started_at`, `ms`, `claimed`, `sent`, `failed`, `skipped`, `planned`, `error` |

**Functions** (security definer, `search_path = ''`):
- `enqueue(p_project, p_event, p_type, p_members uuid[], p_ref jsonb, p_dedupe text, p_send_after, p_expires_at, p_supersede boolean)` inserts one row per member, using `on conflict (dedupe_key) do nothing`. The dedupe key is `p_dedupe || ':' || member`. `p_supersede` skips (`skip_reason = 'superseded'`) any still-queued row of the same type, member and event.
- `enqueue_emails(... p_emails text[] ...)` does the same after resolving members by `lower(email)`.
- `claim(p_limit, p_lease_seconds)`, `kick()`, `scheduler_status()`.

Triggers never fail the source write: each one catches its own exceptions and raises a warning, the same pattern `api_webhooks.sql` uses.

## Catalog

The category is both the member's switch and the Android channel id. All notifications are on by default.

| Type | Category | Source | Opens |
|---|---|---|---|
| order_confirmed | tickets | `event_orders`: inserted as, or moved into, confirmed/paid and not cancelled | `/tickets/{orderId}` |
| ticket_gifted | tickets | the same, when `metadata.group.organizer` is a different email | `/tickets/{orderId}` |
| order_cancelled | tickets | `event_orders` moves to cancelled | `/orders/{orderId}` |
| refund_update | tickets | `refund_requests` moves to Approved, Denied or Refunded; `order_refunds` reaches Issued. Dedupe is per order per 10 min | `/orders/{orderId}` |
| payment_failed | tickets | Stripe `checkout.session.async_payment_failed` (server) | `/orders` |
| registration_update | tickets | `registrations`: inserted (Confirmed, Pending, Waitlisted) or status changed (Confirmed, Declined, Waitlisted). Skipped when the member got an order for the same event within 15 min | `/home` |
| checked_in | tickets | `checkin_attendance` inserted with status `in`. Once per attendee per day | `/tickets/{orderId}` |
| event_starting | reminders | planner, at each `event_offsets` minutes before start; expires at start | 1h or less: `/pass/{orderId}`, otherwise `/tickets/{orderId}` |
| meeting_soon | reminders | planner, 10 min before a scheduled meeting | `/notifications` |
| live_starting | reminders | planner, when a live room's `startsAt` arrives, for entitled members | `/live/{roomId}` |
| membership_expiring | reminders | planner, `membership_days` before `expires_at` | `/memberships` |
| membership_expired | reminders | planner, once `expires_at` has passed while still Active | `/memberships` |
| event_changed | updates | `events` update to date, time, timezone, venue, address or city on a non-Draft event. Sent after 3 min and supersedes earlier queued changes | `/events/{eventId}` |
| event_cancelled | updates | `events` soft-deleted (or status Cancelled) with a future date and holders | `/orders` |
| thread_reply | messages | `portal_thread_messages` inserted with sender organiser. Sent after 20 s and supersedes earlier queued replies | `/messages/{threadId}` |
| announcement | messages | `community_records` (module announcement) moves to Sent → fan-out row → JS resolves `config.audience` with `resolveAudienceEmails`. Falls back to all buyers and members of the project. The planner flips Scheduled→Sent once `config.scheduledFor` has passed | `/notifications` |
| chat_reply | community | `chat_messages` with `metadata.replyTo` → the author of the replied-to message (not yourself) | `/community/{channelId}` |
| chat_organiser_post | community | `chat_messages` from an organiser in an announce-mode event channel → unmuted member participants | `/community/{channelId}` |
| qa_answer | community | `chat_messages` from an organiser in a `qa` channel → its member participants | `/qa/{channelId}` |
| meeting_request, meeting_declined, meeting_confirmed, meeting_cancelled, meeting_rescheduled | meetings | `lib/meetings/notify.js`, now enqueued instead of sent directly | `/notifications` |

Community pushes are throttled by dedupe key to one per channel per member every 5 min. Quiet hours (when enabled) hold the `announcement`, `chat_*` and `qa_answer` types until the window ends, in the event's timezone (Europe/London when there's no event).

Restore chat enrolment: `buy_ticket` must call `events.add_ticket_buyer_to_chat` again, and existing buyers get backfilled.

## Delivery

The dispatcher works in this order:
1. Process pending fan-outs.
2. Claim due rows under a lease. Expired rows become `skipped/expired`.
3. Render each row by type.
4. Apply skips, in order: project paused, organiser type switch off, render skip.
5. Apply the member's category preference. A row skipped here is still kept as history with `skip_reason = 'muted'`.
6. Hold rows that fall in quiet hours by pushing `send_after` back.
7. Send to Expo in batches of 100, with `Authorization: Bearer $EXPO_ACCESS_TOKEN` when that variable is set. Each message has `channelId` = category, `priority` high, `sound` default, and `data = {type, route, id…}`.
8. Store the tickets.
9. A ticket error of `DeviceNotRegistered` retires the device. A 429 or 5xx response retries with backoff (`2^attempts` min, at most 5 attempts).
10. Check receipts for tickets older than 15 min (up to 1000 per call) and retire devices on `DeviceNotRegistered`.

Server-side senders (meetings, Stripe) call the enqueue RPC and then wake the dispatcher with `after()`.

## Routes

- `POST /api/internal/push/dispatch` and `POST /api/internal/push/plan` require `Bearer` = `CRON_SECRET`, or the runtime secret.
- Portal:
  - `GET` / `PUT /api/portal/push/preferences` → `{categories: {tickets, reminders, updates, messages, community, meetings}}`.
  - Logout deletes this device's token. Logout-all deletes all of the member's devices.
  - The `/api/portal/notifications` feed adds the sent and muted push rows (excluding announcement and meeting types, which already come from their own sources). Every item carries `kind` and `route`.
- Settings, all under `withProjectManager`:
  - `GET` / `PUT /api/settings/push` → `{types, eventOffsets, membershipDays, quietHours, paused}`.
  - `GET /api/settings/push/log?status&type&cursor` → rows plus deliveries.
  - `POST /api/settings/push/log` `{action: "retry", id}` | `{action: "test"}`. The test send goes to the signed-in organiser's own portal member account (matched by email).
  - `GET /api/settings/push/scheduler` → cron jobs, the last runs and the 20 most recent `dispatch_runs`.
- Retired: `app/api/portal/push/announce` and `lib/portal/push_fanout.js`.

## Mobile

- **Push:**
  - Android channels, one per category.
  - Deep links come from `data.route`, with the old `type` mapping as a fallback.
  - Taps that launch the app from cold go through `getLastNotificationResponseAsync`.
  - `addPushTokenListener` re-registers the device when its token changes.
- **Screens:**
  - Account → Notifications: category switches, system permission state, and an "Open settings" action when permission is denied.
  - The Notifications feed shows an icon per type and opens `route` on tap.
- **Icons:**
  - `assets/images/notification-icon.png`: 96×96, white mark on a transparent background, generated from `logo.svg`. The plugin config is `icon` plus `color: #9A9A9A`.
  - A `geiger` icon in `icons.tsx` replaces `bell` and `bell-off` everywhere.
- **OTA:**
  - `expo-updates` with `runtimeVersion.policy = fingerprint`, `updates.url = https://u.expo.dev/79fe52bd-cac4-4dc9-956c-c5bed0896f14` and `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`. The development profile gets channel `development`.
  - The `useOtaUpdates` hook handles checking and the toast.
  - Account → About shows the version, channel and update id.
  - New scripts: `update:preview` and `update:production`.

## Testing

- `node:test` unit tests for the catalog rendering, quiet hours, start-time maths, reminder planning, and Expo response and receipt handling. `fetch` is mocked.
- A PGlite verify script for the migration: the triggers enqueue the right rows, dedupe and supersede behave, and RLS holds. It skips pg_cron and pg_net when those extensions are missing.
- `expo lint` and `tsc` for mobile.

## Out of scope

Ticket transfers, per-session agenda reminders, push for discussion boards, and iOS time-sensitive interruptions.
