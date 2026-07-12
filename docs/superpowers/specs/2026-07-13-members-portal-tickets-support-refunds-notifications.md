# Members Portal — Ticket details, Organiser messaging, Refunds, Notifications, Real logo

**Date:** 2026-07-13
**Status:** Implemented
**Builds on:** the attendee-experience upgrade + Slice 3 (buy membership).

## Ask
On top of the portal: full ticket details; message/open a thread with the
organiser; real logo in the top bar; request refunds; receive event notifications.

## What shipped

### 1. Real logo
Replaced the placeholder "G" tile in the portal top bar (and the auth screen) with
the suite's actual mark — `next/image` on `${basePath}/logo1.svg` + the
`.geiger-logo` class (theme-safe, the exact pattern topbar/sidebar/`/e/[id]` use).

### 2. Full ticket details
The ticket dialog now shows everything: QR + order code, ticket × qty, attendee,
when/where/timezone, **organiser**, a purchase breakdown (order code, purchased
date, **add-ons** from the order metadata `offerings`, total paid), plus refund
status when one exists. `reads.js` enriched: `buyer_email`, `organizer`,
`metadata.offerings`, `stripe_payment_intent_id` (→ `paid`), unit price, total,
createdAt all carried through orders → tickets.

### 3. Message the organiser (support threads)
New tables `events.portal_threads` + `events.portal_thread_messages`
(`supabase/sqls/portal_support.sql`; RLS-on/no-policy → service-role-only, same
posture as `portal_members`). A **Messages** tab lists the member's threads and
opens a chat view (member bubbles vs organiser bubbles) with a reply box; "New
message" composes a thread. A **Message organiser** button in the ticket and
order dialogs opens the composer prefilled with that order's context (subject +
`orderId`, which attaches event/project so the organiser sees the context).
- Data layer `lib/portal/support.js`: `listMemberThreads`, `getMemberThread`
  (marks read), `createThread` (first message; resolves event/project from the
  order, ownership-checked), `postMessage` (ownership-checked, bumps recency).
- Routes: `GET/POST /api/portal/threads`, `GET /api/portal/threads/[id]`,
  `POST /api/portal/threads/[id]/messages`. All session-guarded, scoped to the
  member id. Unread organiser replies badge the Messages nav item.
- Organiser **reply** UI is a future admin slice; the schema already supports
  `sender = 'organiser'`.

### 4. Request refunds
Reuses `events.refund_requests` (the organiser's existing Refunds inbox). Since
that table has no insert helper and its RLS is org-member-scoped, filing goes
through a service-role route. A **Request refund** panel in the ticket/order
dialog (paid + still-confirmed orders only) takes an optional reason and files the
request; the current status then shows as a pill everywhere the order/ticket
appears.
- `lib/portal/refunds.js`: `fileRefund` (ownership-checked, honours the project's
  `refund` policy `enabled` flag, blocks duplicates while one is open) +
  `listMemberRefunds` (latest status per order). `POST /api/portal/refund`.
- `/api/portal/data` folds each order's latest refund status onto the order/ticket.

### 5. Event notifications
A **Notifications** tab surfaces the organiser's own **announcements**
(`events.community_records`, module `announcement`, status `Sent`) for the
projects the member is connected to — attendees now actually receive the updates
organisers publish (nothing read these before). Unread is tracked by a single
`notificationsSeenAt` timestamp on the member's metadata; opening the tab marks
the feed read and the Notifications nav badge clears.
- `lib/portal/notifications.js`: `listMemberNotifications(email, seenAt)`.
- `GET /api/portal/notifications` (feed) + `POST` (mark seen).

## Nav
Sidebar / mobile tab bar grew to seven: Home · Tickets · Orders · Memberships ·
**Messages** · **Notifications** · Account. Messages/Notifications carry primary
(brand-coloured) unread badges.

## Security
- All new reads/writes run server-side via the service role, scoped to the
  session member (email or member id); a member can only touch their own threads,
  refunds, and feed.
- Refund honours the per-project refund policy and blocks duplicate open requests.
- Support message bodies capped (4k) and ownership-checked before every write.

## Migration
`npm run db:push` applied `portal_support.sql` (two new `events.*` tables). No
other schema changes — refunds/announcements reuse existing tables.

## Out of scope / follow-ups
- Organiser-side reply UI for support threads and a dedicated announcement→member
  fan-out (today the feed derives from Sent announcements).
- Real-time message updates (currently fetch-on-open) and rate-limiting.

## Success criteria
- Ticket dialog shows full details incl. add-ons, total, organiser, refund status.
- A member can open a thread with the organiser and exchange messages; unread
  organiser replies badge the nav.
- A paid order can request a refund; the status shows through and the organiser's
  Refunds inbox receives it.
- Announcements from the member's events appear under Notifications with unread
  tracking. Top bar shows the real logo. `npx eslint` clean; `next build` passes.
