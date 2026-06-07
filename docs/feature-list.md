# Geiger Events — Feature List

Source: distilled from `docs/competitive-feature-matrix.md` (research date 2026-06-06).

Positioning: *"A modern event platform for communities and small organizers: beautiful pages, fast ticketing, social momentum, and reliable check-in without enterprise pricing."*

Lane: modern self-serve events for creators, communities, local businesses, workshops, nightlife, meetups, and small conferences — strong enough for paid events and day-of check-in, lighter and cheaper than enterprise suites.

Each feature is tagged with a rough effort estimate (S / M / L) to help sequencing. Phases are ordered for implementation.

---

## Phase 1 — MVP (Must Have)

The table-stakes set. Without these the product feels unfinished.

| # | Feature | Notes | Effort |
| --- | --- | --- | --- |
| 1.1 | Event creation + visual page builder | Cover media, rich description, location/date/time, custom URL | L |
| 1.2 | Public/private event visibility | Toggle + unlisted link access | S |
| 1.3 | RSVP and registration | Core attendee flow | M |
| 1.4 | Ticket types (free + paid) | Tiered pricing comes later; start with simple types | M |
| 1.5 | Guest list management | View, search, manage registrants | M |
| 1.6 | Custom registration questions | Per-event custom fields | M |
| 1.7 | Email confirmations + reminders | Transactional + scheduled | M |
| 1.8 | QR code tickets | Generated per registration | S |
| 1.9 | Mobile-friendly check-in | Scan QR, mark attendance | M |
| 1.10 | Basic organizer dashboard | RSVPs, paid tickets, revenue, checked-in count | M |

**Payments dependency:** 1.4 requires a payments integration (Stripe Connect or similar) for payouts, taxes, and refunds. Scope this as part of Phase 1 if launching paid events.

---

## Phase 2 — Modern Baseline (Should Have Soon)

Expected by serious organizers; creates social momentum and reduces no-shows.

| # | Feature | Notes | Effort |
| --- | --- | --- | --- |
| 2.1 | SMS / text blasts | Reminders + announcements | M |
| 2.2 | Approval gates + waitlist | Manual approval, capacity overflow queue | M |
| 2.3 | Coupons + early-bird ticket tiers | Timed sales, discount codes | M |
| 2.4 | Co-host / team roles | Builds on existing RBAC (`lib/rbac.js`) | M |
| 2.5 | Event cloning + recurring events | Duplicate, recurrence rules | M |
| 2.6 | Attendee export | CSV download | S |
| 2.7 | Organizer profile pages | Public organizer identity | M |
| 2.8 | "Who's going" with privacy controls | Visible attendee list, opt-in | M |
| 2.9 | Apple / Google Wallet passes | Pass generation for tickets | M |

---

## Phase 3 — Differentiators (Geiger's Edge)

Strong candidates to make Geiger Events stand out for small organizers.

| # | Feature | Notes | Effort |
| --- | --- | --- | --- |
| 3.1 | Social discovery feed by city/category | Marketplace-lite browse + search | L |
| 3.2 | Follow organizers + notify followers | Follow graph, notifications | M |
| 3.3 | Friend / mutual attendance signals | Social proof on event pages | M |
| 3.4 | Event chat / lightweight activity feed | Per-event conversation | M |
| 3.5 | Shared post-event photo album | Attendee uploads | M |
| 3.6 | Newsletter / calendar for recurring organizers | Subscribe to an organizer's cadence | M |
| 3.7 | Transparent pricing calculator at setup | Show organizer + buyer fees clearly | S |
| 3.8 | Low-fee positioning vs Eventbrite | Pricing/marketing, not a build | — |

---

## Phase 4 — Conference / Virtual Module (Defer; separate product surface)

Treat as a paid conference module or later product line — building video hosting into the core MVP expands scope significantly.

- Hosted main stage + session rooms
- Speaker backstage with host/producer controls
- Moderator controls (mic/camera, screen share, chat, Q&A, polls)
- Breakout rooms + attendee networking tables
- Sponsor/exhibitor booths with lead capture
- Session access control by ticket type / registration status
- Recording, replay library, post-event content access
- Virtual lobby (agenda, live-now state, announcements, sponsor placement)
- Engagement analytics (attendance, watch time, chat/Q&A, booth visits, replay views)

---

## Defer Unless Strategy Changes

Badge printing · sponsor/exhibitor portals · multi-track agendas · full virtual hosting · media room/producer controls · venue sourcing · hotel/travel management · full CRM integrations · SSO + enterprise compliance · reserved seating · RFID/NFC/smart badges.

---

## Suggested Build Order

1. **Foundation:** data model for events, tickets, registrations, organizers (extend existing Supabase setup).
2. **Phase 1 MVP** — get a usable free-event flow end-to-end first (1.1 → 1.3 → 1.5 → 1.7 → 1.8 → 1.9 → 1.10), then layer paid tickets (1.4 + payments).
3. **Phase 2** in order of organizer demand (waitlist/approvals and coupons tend to be requested earliest).
4. **Phase 3 differentiators** once core flows are stable — discovery feed (3.1) is the headline differentiator but depends on having events + organizer profiles in place.
5. **Phase 4** only if pursuing the conference lane.

## Pricing Model To Test (from matrix)

| Plan | Target | Concept |
| --- | --- | --- |
| Free | Casual hosts, free community events | $0 for free events |
| Starter ticketing | Small paid events | Low % + small fixed fee, shown to organizer + buyer |
| Organizer Pro | Recurring organizers | Monthly plan, reduced/zero platform fee, adds SMS/newsletter/branding |
| Venue/Team | Multi-event teams | Higher monthly plan: roles, exports, API/webhooks, priority support |
