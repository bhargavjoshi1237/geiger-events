<div align="center">

# Geiger Events

**A modern event platform for communities and small organisers.**

Beautiful pages, fast ticketing, social momentum, and reliable check-in — without enterprise pricing.

Part of the [Geiger](#the-geiger-suite) suite.

</div>

---

## Overview

Geiger Events is an all-in-one platform for creating events, selling tickets, managing guests, and running the door on the day. It is built for creators, communities, local businesses, workshops, meetups, and small conferences — organisers who need serious ticketing power without the cost and complexity of an enterprise suite.

The product has two sides: an **organiser workspace** for building and running events, and an **attendee experience** made up of public event pages and a personal members portal.

## Highlights

| Area | What it does |
| --- | --- |
| **Events** | Create and manage events, templates, and recurring series, each with its own editor and a public event wall. |
| **Ticketing** | Reusable ticket types, tiers, bundles, discounts, early-bird and dynamic pricing, donations, group buying, memberships, and secure Stripe checkout. |
| **Registrations** | RSVPs, custom forms, waitlists, approval gates, capacity limits, and dietary/accessibility collection. |
| **Guests (CRM)** | A unified contact database with import, dedupe, segments, tags, notes, and export. |
| **Check-in** | QR tickets, wallet passes, a check-in app, door sales, offline mode, kiosk mode, badge printing, and multi-gate scanning. |
| **Campaigns** | Email, SMS, and WhatsApp outreach with templates, drip sequences, segmentation, and scheduling. |
| **Advertising** | A simple control panel over Google Ads, Meta Ads, and related platforms. |
| **Workflows** | A no-code automation engine with a visual builder and run history. |
| **Conference** | Agenda builder, speakers, sponsors, expo booths, call for papers, and recordings. |
| **Members portal** | Attendees manage tickets, orders, memberships, and refunds, show a QR pass, and message organisers directly. |

For the full, non-technical tour see [`docs/product-overview.md`](docs/product-overview.md).

## Tech stack

- **Framework** — Next.js 16 (App Router, SSR/SSG) and React 19
- **Styling** — Tailwind CSS v4 and shadcn/ui, with the shared [`@geiger/ui`](https://github.com/bhargavjoshi1237/geiger-ui) component library
- **Icons** — Lucide
- **Backend** — Supabase (Postgres, Auth, Storage)
- **Payments** — Stripe
- **Other** — Recharts (charts), React Flow (workflow canvas), Leaflet (maps), qrcode / jsQR (tickets)

## Getting started

### Prerequisites

- Node.js 20 or later
- A Supabase project and a Stripe account

### Installation

```bash
npm install
```

### Environment

Create a `.env` file in the project root:

```bash
# Runtime (browser) — Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRING_URI=your-direct-postgres-connection-string   # migrations only
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-signing-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

Register the production endpoint
`https://geiger-events.vercel.app/events/api/stripe/webhook` in Stripe for
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.
The return page uses the same idempotent fulfillment path, but the webhook
guarantees an order is recorded even if the buyer never returns after payment.

In Stripe Dashboard, open **Developers → Workbench → Webhooks**, then:

1. Choose **Create new destination** and **Events on your account**.
2. Select `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`.
3. Choose **Webhook** and enter the production endpoint above.
4. Create the destination, reveal its `whsec_…` signing secret, and add it to
   Vercel as `GEIGER_STRIPE_WEBHOOK_SECRET` for the Production environment.
5. Redeploy, complete a Stripe Checkout payment, and confirm its delivery shows
   HTTP `200` in the destination's **Event deliveries** tab.

Stripe sandbox and live-mode destinations have different signing secrets. Use
the live destination's secret in Production; use a separate sandbox destination
and secret for local/preview testing.

### Database

Migrations live in `supabase/sqls/` and run in filename order:

```bash
npm run db:push
```

### Develop

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project structure

```
app/                     Next.js App Router routes
  e/                     Public event pages
  w/                     Public organiser walls
  login/                 Members portal auth
  project/               Organiser workspace
components/
  internal/screens/      Organiser workspace screens (by area)
  internal/shared/       Shared screen kit (headers, tables, stats, dialogs)
  portal/                Attendee-facing members portal
  ui/                    shadcn primitives
lib/
  supabase/              Data-access layer (one module per area)
  portal/                Portal domain logic
  rbac.js                Permissions catalog
supabase/sqls/           Idempotent SQL schema and policies
docs/                    Product and reference documentation
supabase/migrations/     Timestamped @up/@down migrations (npm run db:push)
```

## Conventions

This codebase follows a consistent set of patterns. Read these before contributing:

- [`AGENTS.md`](AGENTS.md) — working notes for this Next.js version
- [`MODULE_CONVENTIONS.md`](MODULE_CONVENTIONS.md) — how to build a workspace screen
- [`SUPABASE_CONVENTIONS.md`](SUPABASE_CONVENTIONS.md) — the data-layer playbook
- [`crafting.md`](crafting.md) — UI craft and quality bar

## Documentation

- [`docs/product-overview.md`](docs/product-overview.md) — full product tour
- [`docs/product-intro.md`](docs/product-intro.md) — short and long intros
- [`docs/product-pitch.md`](docs/product-pitch.md) — positioning and pitch
- [`docs/product-keywords.md`](docs/product-keywords.md) — keywords and tags
- [`docs/competitive-feature-matrix.md`](docs/competitive-feature-matrix.md) — competitive research

## The Geiger suite

Geiger Events is one application in the broader Geiger suite, alongside Geiger Flow and Geiger Notes. The suite shares a common design language and the [`@geiger/ui`](https://github.com/bhargavjoshi1237/geiger-ui) component library, so every product feels native to the whole.

## License

Private and unpublished. All rights reserved.
