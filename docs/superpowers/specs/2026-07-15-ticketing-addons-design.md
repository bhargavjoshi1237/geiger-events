# Ticketing Add-ons — Bundles, Early-bird, Donations, Group, Access-codes, Reserved

Date: 2026-07-15
Area: events (Tickets global screens + event editor + buyer checkout + orders + portal)

## Goal

Take six ticketing features from "toggle-only" to fully working end-to-end. Each
already has a **project-global enable screen** (Tickets sidebar) and a **per-event
on/off switch** (the editor's Ticket Rules tab, `metadata.ticketRules`). This spec
adds the two missing halves: **per-event configuration** (its own editor tab) and
**authoritative checkout behaviour** (buyer UI + `buy_ticket` RPC + Stripe mirror +
order metadata + portal display).

Reference pattern throughout: the just-shipped **slots / purchasables / discounts**
feature — editor tab → `metadata` bag via `useEventConfig` → buyer checkout →
`buy_ticket` RPC (authoritative price/inventory) → order metadata → portal.

Decisions (confirmed): full end-to-end depth; each feature gets a **dedicated
editor tab** revealed by its Ticket Rules toggle; all six built together.

## A. Shared architecture — navigation & gating

- **Switchboard stays** = `event_ticket_rules.jsx` (Ticket Rules tab). Add
  `bundles` to its `RULES`. Toggling a rule on reveals that feature's dedicated
  editor tab and deep-links to it via the section's `onNavigate` prop.
- **Conditional nav** = each feature nav item in `event_sections.js` gets
  `showIf: (event) => !!event.ticketRules?.<key>`. `event_detail.jsx` filters
  `group.items` by `showIf(form)` (and hides a group whose items all filter out).
  The `activeItem` lookup still scans all items so a deep-link resolves.
- **Pure helper libs** (mirror `lib/events/slots.js`): `earlybird.js`,
  `donation.js`, `access_codes.js`, `group.js`, `bundles.js`, `reserved.js` — each
  owns its `metadata.*` shape, `normalize*`, an `*Enabled(event)` guard, and the
  pricing/availability math shared by client preview, Stripe route, and the RPC.
- **`lib/supabase/access_codes.js`** — `validateEventAccessCode(eventId, code)` via
  a new `public_event_access_code` RPC (mirrors `validateEventDiscount`).

## B. Per-event metadata shapes

```js
metadata.earlybird = { mode:"percent"|"flat", percent:15, amount:0,
                       startAt:"", endAt:"", note:"" }          // reduces ticket price in-window
metadata.donation  = { cause:"", suggestedAmounts:[5,10,25], allowCustom:true,
                       minAmount:1, prompt:"", required:false }
metadata.accessCodes = [ { id, code, label, ticketIds:[eventTicketId,…] } ]  // gated tickets hidden until unlocked
metadata.reserved  = { [eventTicketId]: { qty:10, note:"" } }   // held block, excluded from public availability
metadata.groupPurchase = { minSeats:5, maxSeats:20, discountPercent:10,
                       requireApproval:false, eligibleTickets:"all"|[ids] }
metadata.bundles   = [ { id, name, description, enabled:true,
                       items:[{ ticketId, qty }], pricingMode:"fixed"|"sum", price } ]
```

New per-order metadata keys: `earlybird`, `donation`, `group` (+ `groupId`),
`bundle`. Existing keys (`offerings`, `purchasables`, `slot`, `discount`) unchanged.

## C. Editor tabs (new files under `components/internal/screens/events/`)

Each is a `*Section({ event, headerItem, onNavigate })` built from the shared kit,
persisting via `useEventConfig`. Registered in `event_sections.js` (`SECTIONS` +
`NAV_GROUPS` with `showIf`).

- **`event_earlybird.jsx`** — window (start/end datetime), discount mode
  (percent/flat) + value, note. Live "X% off until <date>" preview.
- **`event_donation.jsx`** — cause, suggested amounts, allow-custom, minimum,
  prompt, required. Inherits global defaults as placeholders.
- **`event_access_codes.jsx`** — CRUD list of code entries; each code has a label
  and a multiselect of which of the event's tickets it unlocks. Marks those
  tickets hidden on the public page.
- **`event_reserved.jsx`** — per-ticket held quantity + note. Shows
  capacity/sold/reserved/available.
- **`event_group.jsx`** — min/max seats, group discount %, require approval,
  eligible tickets.
- **`event_bundles.jsx`** — author bundles from the event's own tickets (pick
  ticket + qty rows), pricing mode + price, enable toggle. Optional "import" of a
  global `bundle` record as a starting point.

## D. Buyer checkout (`event_public_page.jsx` + `ticket_addons_step.jsx`)

- **Early-bird** — displayed ticket price shows the in-window reduction with an
  "Early bird" badge + struck original. The **original** tier price is still what's
  sent to `buyTicket`/`/api/checkout`; the reduction is re-derived server-side
  (server clock is authoritative), exactly like a discount code.
- **Donations** — a donation block in the details step (suggested chips + custom
  input when allowed); folds into the order total once (not × qty) as its own
  Stripe line item.
- **Access codes** — a key-icon "Have an access code?" button by the ticket list.
  Entering a code calls `validateEventAccessCode`; matched ticket ids un-hide and
  become purchasable. `buy_ticket` re-validates that a gated ticket carries a valid
  code.
- **Reserved** — availability shown/enforced as `capacity − sold − reserved`.
- **Group** — when the feature is on and qty ≥ minSeats, checkout switches to
  group mode: a name+email row per seat, group discount applied. Passed as
  `attendees[]`.
- **Bundles** — attached/enabled bundles render as purchasable items alongside
  tickets; picking one checks out that bundle (single line, bundle price).

## E. Server-side (authoritative)

- **`buy_ticket` RPC** (`supabase/sqls/zz_project_access.sql`) — new params
  `p_donation numeric`, `p_bundle_id text`, `p_attendees jsonb`. Under the existing
  `FOR UPDATE` lock:
  - **Early-bird**: re-derive per-unit reduction from `metadata.earlybird` +
    `ticketRules.earlybird` + `now()`; apply before discount; record
    `metadata.earlybird`.
  - **Donation**: add `p_donation` once to the total; record `metadata.donation`.
  - **Reserved**: subtract `metadata.reserved` from effective event cap and
    per-tier qty in the oversell guards.
  - **Group**: when `p_attendees` is a non-empty array, insert **one order row per
    attendee** sharing a generated `groupId` (stripe_session_id on the primary row
    only, to stay idempotent and avoid any unique-index clash), split the total,
    auto-create a `portal_members` account per attendee, apply the group discount.
  - **Bundle**: when `p_bundle_id` set, price from the bundle, enforce + bump
    inventory for **each** included ticket id, record `metadata.bundle`.
  - **Access code**: when a bought ticket is gated (appears in
    `metadata.accessCodes`), require a matching `p_discount_code`-style access code
    (reuse a passed code param) — reject otherwise.
- **`public_event_access_code` RPC** (new `supabase/sqls/ticketing_addons.sql`) —
  returns `{ ok, ticket_ids[] }` for a valid attached code (mirrors
  `public_event_discount`).
- **`/api/checkout` + `verify`** — mirror the early-bird ticket-line reduction and
  the donation line item; carry `donation`, `attendees`, `bundleId`, `accessCode`
  through session metadata (attendees via the `clientRef` side-channel if the
  500-char cap is hit).
- **`lib/supabase/orders.js`** — extend `buyTicket` args + `normalizeOrder` for
  `donation`, `group`, `bundle`, `earlybird`.

## F. Portal (`lib/portal/reads.js`, `components/portal/portal_tickets.jsx`)

Each group attendee's own order row is already email-keyed, so `listMemberOrders`
surfaces each friend's ticket automatically. Extend `mapOrder`/`ticketsFromOrders`
and the ticket dialog to render donation, bundle contents, group context, and
early-bird savings alongside the existing offerings/purchasables/slot/discount.

## G. Files

**New:** 6 editor tabs, 6 `lib/events/*` helpers, `lib/supabase/access_codes.js`,
`supabase/sqls/ticketing_addons.sql`.
**Touched:** `event_sections.js`, `event_detail.jsx`, `event_ticket_rules.jsx`,
`event_public_page.jsx`, `ticket_addons_step.jsx`, `lib/supabase/orders.js`,
`zz_project_access.sql`, `app/api/checkout/route.js`, `app/api/checkout/verify/route.js`,
`lib/portal/reads.js`, `components/portal/portal_tickets.jsx`.

## Decisions / notes

- Bundles reference the **event's own tickets** (not global ticket-type records) so
  checkout inventory maps exactly; the global Bundles screen is a template to import.
- Group = one Stripe payment, **N order rows** (one per attendee) — reuses the
  email-keyed portal so each attendee sees their own ticket from the start.
- Reserved is intentionally lightweight (held allocation, no seat map).
- Early-bird & group discount are server-re-derived (never trust a client price),
  mirroring the discount-code pattern.
