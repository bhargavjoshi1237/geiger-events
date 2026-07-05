# Tickets — Phase A: Reusable Record Modules

**Date:** 2026-07-06
**Status:** Approved, implementing

## Context

The Tickets area needs a batch of new sidebar surfaces. The full request spans
~15 surfaces plus a net-new Memberships sub-module, so it was decomposed into
four phases by the pattern each reuses. **This spec covers Phase A only.**

Phase A is the four features that map cleanly onto the existing reusable-records
pattern (`RecordsScreen` + the shared `events.ticketing_records` table,
discriminated by a `module` value). Reference builds: `tickets/ticket_types.jsx`,
`tickets/payouts.jsx`, `tickets/discounts.jsx`, `tickets/records_kit.jsx`,
`lib/supabase/ticketing.js`.

## Key decision — no new persistence

All four modules store their config in the existing `ticketing_records` table
under a new `module` string. This means **no SQL migration and no new data-layer
file** — `listRecords` / `createRecord` / `updateRecord` / `softDeleteRecord`
already accept an arbitrary `module`. Each feature supplies only: a screen file
(kinds + edit form + summary), default configs in `tickets/constants.js`, a
`registry.jsx` entry, and a `sidebar_nav.jsx` sub-item.

## The four modules

### 1. Ticket Tiers — `module: "tier"`
Reusable named levels (General, VIP, Platinum). Later, an event chooses tiered
vs. individual tickets and assigns ticket types to tiers (event-side wiring is a
Phase-B follow-on, out of scope here).
- Config: `{ rank: 1, color: "slate", description: "" }`
- Summary: `"Rank 1 · VIP access"`

### 2. Bundles — `module: "bundle"`
Multiple ticket types sold together.
- Config: `{ items: [{ ticketTypeId, qty }], pricingMode: "fixed" | "sum", price: 0, description: "" }`
- Edit form fetches existing `ticket_type` records to pick line items.
- Summary: `"3 items · $120"`

### 3. Multi-currency — `module: "currency"`
One record per accepted currency, surfaced at the Stripe payment stage.
- Config: `{ code: "USD", symbol: "$", rate: 1, stripeAccount: "" }`
- Summary: `"USD · $ · rate 1.00"`

### 4. Anti-scalping & Resale — `module: "resale_rule"`
A reusable rule an event opts into (event enable is a Phase-B follow-on).
- Config: `{ nameLockRequired: false, transferPolicy: "off" | "organizer-approval" | "open", maxResalePrice: "none" | "face", identityCheck: false, maxPerBuyer: 0 }`
- Summary: `"Name-locked · organizer-approval transfers"`

## Wiring (per module)

1. `tickets/constants.js` — a `default*Config` factory + any option lists.
2. `tickets/<name>.jsx` — `"use client"`, a `*Screen` that renders `RecordsScreen`
   with `module`, `kinds`, `summarize`, `EditForm`. Built from the shared kit
   (`Field`, `SectionCard`, `SettingsList`/`SettingRow`, `Segmented`, `NumField`)
   and shadcn primitives only. Semantic color tokens only.
3. `registry.jsx` — import + map under the exact sidebar title.
4. `sidebar_nav.jsx` — add the sub-item (with icon) to the Tickets group; add the
   `Coins` icon import for Multi-currency.

## Out of scope (Phase A)

- Event-editor attach/enable surfaces for Tiers and Anti-scalping (Phase B).
- Add-ons (explicitly dropped by the user).
- Discounts overlap reconciliation (only affects Phases B/C).

## Verification

`npx eslint` clean on all changed files; each new title resolves to its screen
(not `ComingSoonScreen`); create/edit/list/delete work through the existing data
layer.

---

# Phases B / C / D (implemented in the same pass)

The user approved building the remaining phases in one pass. Architecture chosen
to minimize new persistence:

- **One settings store** `events.ticketing_settings` (row per `project_id` +
  `module`, config in a jsonb bag) powers every project-global screen. Data layer
  `lib/supabase/ticketing_settings.js` (`getSetting`/`upsertSetting`). A reusable
  `tickets/settings_kit.jsx` (`SettingsScreen`) renders each as a thin form.
- **Two transactional logs** (dietary_requests precedent): `events.refund_requests`
  and `events.group_purchases` (`lib/supabase/refunds.js`,
  `lib/supabase/group_purchases.js`).
- **Memberships**: plans reuse `ticketing_records` (module `membership`) so they
  attach to events for free; only `events.membership_members` is new
  (`lib/supabase/memberships.js`).
- New SQL: `ticketing_settings.sql`, `ticketing_memberships.sql` (named so it
  sorts **after** `ticketing.sql` — it FKs `ticketing_records`). Member-scoped RLS
  for all four tables appended to `zz_project_access.sql`.

**Phase B (global config + event override):** Early-bird Sales, Donations,
Access-code Tickets, Reserved Seating (+ events list), Refunds (+ requests inbox),
Payment Plans, Transfers.

**Phase C:** Group Purchasing (settings + cross-event list), Taxes (empty
placeholder, per request).

**Phase D — Memberships (own sidebar section):** Membership Plans (records),
Members (roster + add/status), Membership Settings (master enable).

**Event-editor integration:** a new **Ticket Rules** section
(`tickets/event_ticket_rules.jsx`) toggles the settings-based features per event
(stored in `event.metadata.ticketRules`); the record-based modules (tier, bundle,
resale_rule, currency, membership) were added to `ATTACH_MODULES` so they attach
from the event editor's Ticketing section.

## Follow-up (not in scope)

- Running `npm run db:push` to apply the three SQL files (shared DB; the user runs
  it).
- Dynamically hiding the Memberships sidebar section until enabled (currently the
  section is always present; content is gated by the enable flag).
- Wiring the settings/attachments into the public checkout + Stripe flow (these
  screens configure; the storefront consumption is a later phase).
