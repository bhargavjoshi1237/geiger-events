# Member Push + OTA Implementation Plan

> **For agentic workers:** this plan is executed task by task, with subagents running the dashboard (Task 5) and mobile (Tasks 6–7) work in parallel. The spec is `docs/superpowers/specs/2026-11-22-member-push-and-ota-design.md`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Members get useful, deep-linked Expo pushes for everything they expect one for, organisers can manage push per project, and the app ships over-the-air updates.

**Architecture:** Triggers on `events.*` tables write rows into a dedicated `events_push` schema, and a JS planner adds reminder rows. pg_cron (through pg_net) calls Next.js routes that render, filter and send the rows through Expo's push API. The dashboard and the app talk to small JSON routes.

**Tech Stack:** Next.js 16 (JS), Supabase Postgres (pg_cron, pg_net), supabase-js, Expo SDK 57 (expo-notifications, expo-updates), node:test, PGlite.

## Global Constraints

- Every push table and function lives in schema `events_push`. Only `service_role` has usage. RLS is on everywhere, with no anon or authenticated policies.
- Triggers never fail the source write: an exception becomes `raise warning`.
- The type and category keys are exactly those in `lib/push/types.js`.
- Android `channelId` = category key. Push `data` always includes `type`, plus `route` when the push opens a screen.
- Dashboard JS follows the repo style: `@geiger/ui`/shadcn, lucide icons, `LogoLoading` for section loaders, single-line comments.
- Mobile follows `mobile/AGENTS.md`: strict TypeScript, theme tokens only, `StyleSheet.create`, shared primitives, icons via `icons.tsx`, the three list states, haptics.
- No git commits. The user commits.

## Interfaces (the contract between tasks)

**Server → mobile**
- `GET /api/portal/push/preferences` → `{ categories: { tickets: bool, reminders: bool, updates: bool, messages: bool, community: bool, meetings: bool } }`.
- `PUT /api/portal/push/preferences` with body `{ categories }` → the same shape.
- `POST /api/portal/logout` with body `{ pushToken? }` also deletes that device. `POST /api/portal/logout-all` deletes all of the member's devices.
- `GET /api/portal/notifications` → existing feed items, each with two extra fields: `kind: string` (a push type, or `announcement` / `meeting` / `board`) and `route: string | null` (an expo-router path).
- Push payload: `{ title, body, data: { type, route, notificationId, ...ids }, channelId: category, sound: "default" }`.

**Server → dashboard** (all take `projectId`; errors come back as `{ error: { code, message } }`)
- `GET /api/settings/push?projectId=` → `{ settings: { types, eventOffsets, membershipDays, quietHours, paused } }`.
- `PUT /api/settings/push` with body `{ projectId, settings }` → `{ settings }` (normalised with `normalizeSettings`).
- `GET /api/settings/push/log?projectId=&status=&type=&cursor=` → `{ items: LogItem[], nextCursor: string | null }`, where `LogItem = { id, type, category, status, skipReason, title, body, memberName, memberEmail, attempts, sendAfter, sentAt, createdAt, lastError, deliveries: [{ platform, status, error, receiptStatus, receiptError, createdAt }] }`.
- `POST /api/settings/push/log` with body `{ projectId, action: "retry", id }` → `{ item }`. With body `{ projectId, action: "test" }` → `{ ok, sent, message }`.
- `GET /api/settings/push/scheduler?projectId=` → `{ configured: bool, globalPaused: bool, paused: bool, jobs: [{ name, schedule, active, lastRunAt, lastStatus, lastMessage }], runs: [{ kind, startedAt, ms, claimed, sent, failed, skipped, planned, error }] }`.

## Tasks

### Task 1: Catalog (done)
- [x] `lib/push/types.js`: categories, types, `normalizeSettings`, `normalizeCategories`, `isTypeEnabled`, `categoryOf`.
- [ ] `lib/push/types.test.js`: normalisation drops unknown types, bounds offsets, falls back to defaults.

### Task 2: Migration `supabase/migrations/20261122100000_events_push.sql` + `scripts/verify-events-push-db.mjs`
- [ ] Schema, tables, indexes and RLS as in the spec. Copy `events.portal_devices` into `events_push.devices`.
- [ ] `enqueue`, `enqueue_emails`, `claim`, `kick`, `scheduler_status` and `member_ids_for_emails`.
- [ ] Trigger functions and triggers for event_orders, refund_requests, order_refunds (deferred), registrations, checkin_attendance, events, portal_thread_messages, community_records (fan-out), chat_messages.
- [ ] Restore chat enrolment in `buy_ticket` with an AFTER INSERT trigger on event_orders (no RPC rewrite), and backfill existing buyers.
- [ ] pg_cron and pg_net jobs, guarded by `pg_available_extensions`.
- [ ] A PGlite verify script that asserts each trigger's rows, dedupe and supersede behaviour.

### Task 3: Server library `lib/push/server/`
- [ ] `expo.js`: `sendMessages(messages)` returns tickets; `getReceipts(ids)`. Uses an injected `fetch`. Tests.
- [ ] `time.js`: `eventStart(event)`, `inQuietHours(now, quietHours, tz)`, `quietHoursEnd(...)`. Tests.
- [ ] `render.js`: `renderBatch(db, rows)` returns, per row, `{ title, body, data, route }` or `{ skip }`. Tests on the pure formatters.
- [ ] `store.js`: devices, prefs and settings reads/writes, plus `enqueue` and `enqueueEmails` wrappers over the RPCs.
- [ ] `dispatch.js`: `runDispatch({ limit, budgetMs })`, which handles fan-outs, claims, renders, filters, sends and checks receipts.
- [ ] `plan.js`: `runPlan()`, which plans event, meeting, membership and live reminders and flips scheduled announcements.

### Task 4: Routes and wiring
- [ ] `app/api/internal/push/{dispatch,plan}/route.js`.
- [ ] `app/api/portal/push/preferences/route.js`. The feed merge goes in `lib/portal/notifications.js`. The logout routes delete devices.
- [ ] `lib/portal/push.js` points at `events_push.devices`. `lib/meetings/notify.js` enqueues instead of sending directly.
- [ ] The Stripe webhook handles `checkout.session.async_payment_failed` and sends `payment_failed`.
- [ ] Delete `app/api/portal/push/announce` and `lib/portal/push_fanout.js`.
- [ ] `app/api/settings/push/{route,log/route,scheduler/route}.js`, guarded with `withProjectManager`.

### Task 5: Dashboard (subagent)
- [ ] Settings → Notifications gets tabs: Email (existing) | Push | Delivery | Scheduler, following the patterns of `api_webhooks/*`.

### Task 6: Mobile push UX and icons (subagent)
- [ ] Android channels; route-based deep links; cold-start taps; token-change re-registration; a preferences screen; the feed with an icon per type; the notification icon PNG and plugin config; a `geiger` icon replacing `bell`/`bell-off`; sending the token on logout.

### Task 7: Mobile OTA (same subagent)
- [ ] `expo-updates` install and config; `useOtaUpdates` and the restart toast; an About row; eas.json development channel; update scripts.

### Task 8: Apply (with user confirmation)
- [ ] Expose `events_push` through PostgREST; `pnpm db:push`; set the `events_push.runtime` row; Vercel env `CRON_SECRET` / `EXPO_ACCESS_TOKEN`; a new EAS dev build (native modules changed).
