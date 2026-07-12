# Geiger Events Members Portal — Slice 3: Buy Membership

**Date:** 2026-07-13
**Status:** Implemented
**Builds on:** the attendee-experience upgrade + Slices 1–2.

## Why
The portal could show memberships a buyer already held but gave no way to get one.
This adds self-serve **buy membership** from the portal — the first money-movement
slice — reusing the event checkout's Stripe pattern.

## Model (grounding)
- **Plans** are `events.ticketing_records` (module `membership`), project-scoped,
  `active`, with `config = { price, billingPeriod (one-time|monthly|yearly),
  discountPercent, benefits[], description }`.
- A project opts into self-serve joining via `events.ticketing_settings`
  (module `membership`) `config.enabled && config.publicJoin`.
- **Enrollments** are `events.membership_members` rows (project_id, membership_id,
  name, email, status, started_at, expires_at, metadata).
- Payments reuse `lib/stripe/server.js` (`getStripe`, `isStripeConfigured`) and the
  event checkout's **one-time `mode: "payment"` + verify-on-return** shape.

## Decisions (defaults taken)
- **Which plans a member can buy:** active plans in the projects the member is
  connected to (has an order or an existing membership) **and** whose project has
  `publicJoin` on. No cross-org leakage.
- **Payment model:** a **one-time payment for the term** (not a Stripe
  subscription). `expires_at` is derived from `billingPeriod` (monthly → +1mo,
  yearly → +1yr, one-time → lifetime/null). Auto-renew (the organizer's
  `autoRenew` setting) and recurring billing stay out of scope (a later slice).
- **Free plans** (price 0) enroll immediately, no Stripe.
- **Currency:** `usd` (plans carry no currency of their own).
- **Idempotency:** the enrollment stores `metadata.stripeSessionId`; verify dedupes
  on it so a refreshed return page never enrolls twice. Checkout also rejects a
  plan the member already holds actively.

## Surface
### Data layer — `lib/portal/memberships.js` (server, service-role)
`listMemberProjectIds`, `listBuyableMembershipPlans` (badges plans the member
already holds), `getPlanForPurchase` (authoritative price/project + `buyable`),
`hasActiveMembership`, `enrollMembership` (idempotent), `computeExpiry`.

### Routes — `app/api/portal/membership/*` (session-guarded)
- `GET /plans` → `{ plans, paymentsEnabled }`.
- `POST /checkout { planId, returnUrl }` → free ⇒ `{ enrolled }`; paid ⇒
  `{ url }` (Stripe). Price/project resolved server-side; client value untrusted.
- `POST /verify { sessionId }` → confirms the Stripe session belongs to this
  member + is a membership + is paid, then enrolls (idempotent).

### UI — `components/portal/*`
- Memberships tab: "Your memberships" + a **Join a membership** grid of plan cards
  (price/period, benefits, member discount) with a Buy button; held plans badge
  "Current plan"; paid plans disable with a note when payments are unavailable.
- Shell: `buyMembership()` → POST checkout → redirect to Stripe (paid) or refresh
  (free). On return, `?membership_session=` is verified + toasted + URL cleaned and
  the Memberships tab is shown; `?membership_canceled=1` toasts and cleans up.
- Home: a "Become a member" CTA when plans are available and the member holds none.

## Security
- Plan price and project are always resolved server-side from the record; the
  client only sends a `planId`.
- `verify` enforces the Stripe session's `metadata.email` matches the signed-in
  member and `kind === "membership"` before enrolling.
- `publicJoin` is required on the plan's project for both listing and checkout.

## Out of scope
- Stripe subscriptions / auto-renew, upgrade/renew/cancel (Slice 4), refunds/
  transfers (Slice 5). No new SQL — all tables already exist.

## Success criteria
- A member in a `publicJoin` project sees its active plans and can join.
- A free plan enrolls instantly; a paid plan round-trips through Stripe and enrolls
  on return without double-enrolling on refresh.
- A plan the member already holds shows "Current plan" and can't be re-bought.
- `npx eslint` clean; `next build` passes with the three new routes.
