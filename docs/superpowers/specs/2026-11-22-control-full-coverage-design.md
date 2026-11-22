# Control: every dashboard screen in the app

Date: 22 November 2026

Status: **Built** (22 Nov 2026, uncommitted). Follows `2026-11-22-control-organiser-app-design.md`, which built the operational core (about 19 of the dashboard's ~151 screens).

## 1. Goal

Everything an organiser can manage on the dashboard can be managed from Control. Visual editors that need a large canvas stay on the dashboard and are linked, never silently missing: the page builder, seat-map and floor-plan editors, the 3D walkthrough, the email template canvas and display-board slides.

## 2. How the dashboard is built, and what that allows

| Family | Screens | Store | How it's defined | Control approach |
| --- | --- | --- | --- | --- |
| Shared records | ~25 (Program, Speakers, Sponsors, Broadcast, Sourcing, Community, Scheduled Reports, Advertising) | `events.<area>_records` (name, status, cover, starts/ends, `config`) | Declarative module configs (`c(key, label, type)`) | **Records engine** from a catalog |
| Ticketing records | ~19 (tiers, types, discounts, bundles, pricing, payments, payouts, invoices, memberships, sequences, templates…) | `events.ticketing_records` and siblings (name, kind, active, `config`) | Bespoke React edit forms | Same engine; descriptors authored from each form |
| Settings | ~21 (check-in features, order and ticket settings, notifications…) | Settings tables merged by key | Bespoke forms over a settings "slice" | **Settings engine** from a catalog |
| Bespoke | ~60 | Their own tables | Hand-built screens | Dedicated Control screens, section by section |

## 3. The catalog

`lib/control/catalog/` is plain JavaScript (no React), so route handlers can import it. Each module descriptor:

```js
{
  id: "conference.speaker",          // unique; the URL segment
  store: "conference",               // → table + row shape
  module: "speaker",                 // the `module` column value
  section: "speakers",               // groups modules like the dashboard sidebar
  title, singular, description, createLabel,
  icon: "mic",                       // a mobile ICONS name
  statuses: [{ value, label, tone }],// record stores; ticketing uses active on/off
  kinds: [{ value, label, config }], // ticketing kinds and their default config
  defaults: { status, config },
  summary: ["track", "room"],        // config keys shown under the name in lists
  fields: [{ key, label, type, scope: "root" | "config", options, placeholder, hint, refModule, min, max }],
  create: ["name", "track"],         // fields asked for when creating
  source: "components/internal/screens/conference/modules/speaker.jsx",
}
```

Field types: `text`, `textarea`, `number`, `email`, `url`, `select`, `tabs`, `switch`, `list`, `ref`, `date`, `time`, `datetime`, `image` (URL), and `readonly`. The dashboard's `audience` and `access` pickers are shown read-only with an "Edit on the dashboard" note.

**Drift guard:** `catalog.test.js` reads each descriptor's `source` file as text and fails if a config field key no longer appears there, so a renamed dashboard field breaks the build rather than the app.

## 4. Server

Every route uses `withControl` → RBAC → `userDb(token)`, as in the core.

| Route | Does |
| --- | --- |
| `GET /projects/[p]/catalog` | Sections and modules this role can open, plus counts |
| `GET·POST /projects/[p]/records/[module]` | List (search, status) and create |
| `GET·PATCH·DELETE /records/[module]/[id]` | Read, update, soft delete |

**Permission:** a module needs its section's view key (`events.program.view`, `events.tickets.view`…) to read **and** write, exactly as the dashboard gates those screens.

**Safe updates:** a PATCH whitelists the descriptor's fields and merges config keys into the stored `config`. Keys only the dashboard edits are never dropped.

## 5. App

- More → **Manage** lists the sections the role can open, in dashboard order.
- Section → its modules → a records list (search, status filter, create sheet) → a record screen (grouped fields, save, delete).
- One field renderer per type in `components/control/fields/`.
- Settings use the same field renderers over a settings descriptor.

## 6. Phases

1. Records engine with the shared-record families (Program, Speakers, Sponsors, Broadcast, Sourcing, Community, Reports, Advertising).
2. Ticketing-record modules (Tickets, Memberships, Campaign sequences and templates).
3. Settings engine (Check-in features, Tickets and Orders settings, Notifications).
4. Bespoke screens by section: Guests (contact book, segments, tags, notes, data requests), Registrations (forms, capacity, dietary), Check-in (staff roles, zones, kiosk), Inventory, Venues, Workflows, Campaigns, Analytics dashboards, Team and roles, Event editor sections.

The cloud build waits until coverage is complete, as asked.

## 7. Verification

- `node --test lib/control/**/*.test.js`, including the drift guard.
- `cd mobile && npx tsc --noEmit`, `npm run lint:mobile`, and `npx expo export --platform android`.
- No migration: every store already exists.

## 8. What was built

| Layer | Count | Where |
| --- | --- | --- |
| Generic record modules | 38 | `lib/control/catalog/{ticketing,conference,community,analytics,advertising}.js` → `control/records/[module]` |
| Project settings pages | 19 | `catalog/{checkin_settings,ticketing_settings}.js` → `control/settings/[setting]` |
| Event editor sections | 45 (object, list and single-value shapes) | `catalog/{event_settings,event_lists}.js` → `control/event/[id]/settings` |
| Hand-built screens | registered in `catalog/screens/*.js` | `control/{guests,money,checkin_ops,inventory,team,ops,community,final,sourcing}/` |

Extra rules that came out of review:
- Payout, payment-method, currency and invoice-profile records need `events.settings.manage`, not just the Tickets view key (`permission` override on the descriptor).
- Team and role writes also need the org owner/admin check the database enforces (`ops_can_administer_roles`), so a refused write is a 403, never a silent success.
- Stock-changing actions claim their row first (optimistic lock), so retries can't double-count the ledger.

## 9. Stays on the dashboard

- **Visual editors:** Event Design (floor plans, object library, seating charts, setup styles, 3D walkthrough, room templates, collaboration, diagram library), the page builder and page design, Display Boards, Expo booths / floor plan & booths, badge templates.
- **Device or provider flows:** offline check-in (a scanner-device feature), Payments (Stripe Connect), Advertising connections (OAuth), sidebar Navigation (web layout only).
- **No real data behind them yet:** the analytics report dashboards (Traffic, Email performance, Engagement, Sponsor ROI, Funnels, Forecasting, Surveys & NPS, Demographics) and Ad Insights render bundled demo data, and Taxes is a placeholder. Control shows real per-event and cross-event figures instead.

