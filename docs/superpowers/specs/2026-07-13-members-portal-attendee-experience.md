# Geiger Events Members Portal — Attendee Experience Upgrade

**Date:** 2026-07-13
**Status:** Implemented
**Builds on:** Slices 1+2 (`2026-07-12-customer-portal-auth-readonly-design.md`) — custom
email+password auth + read-only Memberships/Orders/Tickets tabs.

## Why

The `/login` members portal worked but was a bare three-tab read-only lookup: no
home, no per-ticket detail, no QR to get through the door, no way for a buyer to
manage their own account. This upgrade turns it into a real **attendee app** that
answers the jobs a buyer actually has — without needing the payment rails that
Slices 3–5 (buy/upgrade/refund) depend on.

## Brainstorm — the attendee's jobs-to-be-done

An industry-event attendee who bought tickets. What they come to the portal for:

1. **"Get me in the door."** The single most-used feature of every event app
   (Eventbrite, Luma, Ticketmaster): a scannable ticket. → **QR ticket** encoding
   the order id, generated server-side, ownership-checked. Forward-compatible with
   the existing `jsQR` door scanner (`components/checkin_routes/qr_scanner.jsx`).
2. **"When and where is it?"** Date, time, venue, countdown, and one-tap
   **Add to calendar (.ics)** + **Get directions** (maps link).
3. **"What am I going to next?"** A **Home** dashboard leading with the next
   upcoming event and a live countdown, plus at-a-glance stats.
4. **"Show me my ticket / receipt."** Ticket detail + an itemised **order receipt**.
5. **"Manage my account."** Edit name, **change password**, **sign out of all
   devices**, sign out. None of this existed.
6. **"Find a past order."** Search + status filter on Orders; Upcoming/Past split
   on Tickets.
7. **"My memberships."** Benefits, status, since/renews dates, renewal countdown.

## Scope (this build)

A five-section portal app, all read + self-service account management. No money
movement (buy/refund/transfer stay in future slices).

| Section | What it does |
|---|---|
| **Home** | Greeting, next-event hero + live countdown, stat tiles (upcoming / tickets / memberships / spent), recent orders. |
| **Tickets** | Upcoming/Past split, rich cards; **ticket detail dialog** = QR + event date/time/venue + Add to calendar + Directions + order code. |
| **Orders** | Search + status filter; **order detail dialog** = itemised receipt. |
| **Memberships** | Status, benefits, since/renews, renewal countdown. |
| **Account** | Edit profile (name), change password, sign out everywhere, sign out. |

## Design

### Data layer (`lib/portal/reads.js`)
- `listMemberOrders(email)` enriched to also return `buyerName`, `eventTime`,
  `venue`, `address`, `city`, `timezone`, `unitPrice`, `orderCode` (short id),
  and event `coverUrl`.
- `listMemberMemberships(email)` returns plan `description`/`benefits` from the
  plan `config` bag where present.
- `getMemberOrder(email, orderId)` — single order scoped to the member (QR
  ownership check).
- `ticketsFromOrders(orders)` carries the full enriched event fields through.

### Utilities
- `lib/portal/calendar.js` (pure) — `buildEventICS(order)` → RFC-5545 VEVENT
  string; parses `event_time` when possible, else all-day. `directionsUrl(order)`
  → Google Maps search link. Importable by client components.

### Server routes (`app/api/portal/*`) — all session-guarded, service-role
- `GET /api/portal/ticket/[id]/qr` — verifies the order belongs to the session
  member, returns an `image/svg+xml` QR (encodes the order id) via `qrcode`.
- `POST /api/portal/profile { name, phone }` — updates `portal_members.name` and
  `metadata.phone`.
- `POST /api/portal/change-password { currentPassword, newPassword }` — verifies
  current scrypt hash, sets new (min 8), keeps the session.
- `POST /api/portal/logout-all` — deletes all `portal_sessions` for the member and
  clears the cookie.
- `GET /api/portal/me` + `getSessionMember()` extended to return `metadata` too.

### UI (`components/portal/*`)
- `portal_shell.jsx` — app frame: left sidebar (desktop) / top tab bar (mobile),
  header with avatar initials + name + sign out; owns the `/api/portal/data`
  fetch and member state; routes to the five section components.
- `portal_home.jsx`, `portal_tickets.jsx`, `portal_orders.jsx`,
  `portal_memberships.jsx`, `portal_account.jsx`.
- `portal_kit.jsx` — shared client atoms: formatters (`money`, `fmtDate`,
  `fmtDateTime`), `initials`, `useCountdown`, `TicketQr`, `CalendarButton`,
  `DirectionsButton`, `SectionTitle`, `Card`.
- `auth_flow.jsx` — visual polish (kept logic).
- `portal_lists.jsx` removed (folded into the section components).

Semantic tokens only; shadcn primitives + shared kit (`EmptyState`, `StatusPill`,
`Field`, `SectionCard`); lucide icons; sonner toasts; loading/empty states
throughout; optimistic account edits reconciled on failure.

### Dependencies
- Added `qrcode@^1.5.4` for server-side QR SVG generation.

## Security
- QR route checks order ownership by the session member's email before rendering.
- Change-password re-verifies the current password server-side.
- Passwords stay scrypt-hashed; sessions opaque + hashed at rest; all
  RLS-protected reads stay server-side via the service role. No secret reaches the
  browser.

## Out of scope
- Buying / upgrading / renewing / cancelling memberships (Slices 3–4).
- Order cancel / refund / transfer (Slice 5).
- Rate-limiting and shared-table RLS hardening (still flagged follow-ups).
- Apple/Google Wallet passes, push notifications.

## Success criteria
- Signed in, a member lands on Home with their next event + countdown and correct
  stats.
- Opening a ticket shows a scannable QR (encoding the order id), and Add to
  calendar / Directions work.
- Orders are searchable/filterable and open an itemised receipt.
- Account: name edit persists, password change works (rejects a wrong current
  password), sign-out-everywhere ends the session. `npx eslint` clean.
