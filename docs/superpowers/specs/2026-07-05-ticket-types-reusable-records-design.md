# Ticket Types → Reusable Records — Design

**Date:** 2026-07-05
**Status:** Draft (awaiting review)

## Problem

Ticket Types is the only ticketing module still **event-scoped**. Today you pick
an event, then edit its tiers inline (`event.metadata.tickets`:
`{ id, name, price, qty }`) plus inventory rules (`event.metadata.ticketRules`).
Sold counts live per-tier in `event.ticketSold[tierId]`; the public page's
`buildTickets()` and the checkout route read `event.tickets` directly.

Every **other** ticketing module (Discounts, Payments & Methods, Payouts, Dynamic
Pricing, Orders & Attendees, Invoices & Receipts) already uses the **reusable
records** pattern: one `events.ticketing_records` row per record, discriminated by
`module`, managed through the shared `RecordsScreen` + a per-module `EditForm`,
then attached to events by id in `event.metadata.attached[module]` via
`TicketAttachmentsSection`.

We want Ticket Types to work the same way: **create a ticket once, with its own
details and settings, then attach it directly to any event from the event edit
page.** The ticket's edit screen should carry the refund policy and all other
per-ticket settings.

## Goal

Convert Ticket Types into a reusable record (`module: "ticket_type"`) that:

1. Is created and managed on a standalone **Ticket Types** listing screen (a thin
   `RecordsScreen`, like Discounts).
2. Has a rich per-ticket **edit screen** with price, quantity, refund policy, and
   all other settings.
3. Attaches to any event from the event editor's **Ticket Types** tab (a
   price-aware attach panel), stored as ids in `event.metadata.attached.ticket_type`.
4. Is actually sold on the public event page + Stripe checkout, with backward
   compatibility for events still using legacy embedded `event.tickets`.

## Decisions taken (defaults — flip on review)

These four product forks were defaulted because the reviewer was away. Each is
isolated enough to change without reworking the rest.

| # | Fork | Default chosen | Rationale |
|---|------|----------------|-----------|
| 1 | **Inventory source** | Quantity lives **on the ticket record**. Sold counts stay per-event, keyed by record id, so each event sells up to the record's cap independently. | Matches the reusable pattern (event stores only ids) and today's per-event sold tracking. No per-attachment qty map needed. Different caps → separate records. |
| 2 | **Settings scope** | **Full set** — refund policy, sales window, visibility, min/max per order, description, access-code gating, reserved seating. | The request says "refund and **all other settings**." |
| 3 | **Event editor surface** | The existing **"Ticket Types" event tab** becomes a ticket attach panel; the embedded tier editor is retired. Generic "Ticketing" tab untouched. | Keeps a prominent, purpose-built, price-aware surface without duplicating ticket_type into the generic attach chip list. |
| 4 | **Public sale** | **Wired end-to-end**, sequenced as the final separable phase, with legacy `event.tickets` fallback. | "Attach to any event" is only meaningful if the event then sells it. Phasing lets the reviewer defer just this piece. |

## Data model

### `ticket_type` record `config` (in `ticketing_records.config` jsonb)

No SQL/schema change — `ticketing_records` already has `module`, `kind`, `name`,
`active`, `config jsonb`, `project_id`. The ticket's fields live in `config`:

```js
{
  price: 0,                 // face value; 0 = free
  qty: 0,                   // capacity; 0 = unlimited
  description: "",          // buyer-facing blurb
  minPerOrder: 1,
  maxPerOrder: 10,          // 0 = no max

  refund: {
    refundable: false,      // master toggle
    cutoffDays: 7,          // refunds allowed until N days before the event
    feeHandling: "absorb",  // "absorb" (full refund) | "deduct" (keep fees)
  },

  sales: {
    mode: "always",         // "always" | "window"
    startAt: "",            // datetime-local (mode === "window")
    endAt: "",
  },

  visibility: "public",     // "public" | "hidden" | "scheduled"
  onSaleAt: "",             // scheduled on-sale datetime (visibility === "scheduled")

  accessCode: { enabled: false, code: "" },
  reservedSeating: false,
}
```

`kind` is a single value (`"ticket"`) — `RecordsScreen` hides the kind selector
when `kinds.length === 1`. (A future paid/free/donation split can add kinds
without structural change.)

`DEFAULT_TICKET_RULES` / `VISIBILITY_OPTIONS` (currently in
`tickets/constants.js`) fold into the ticket record's config defaults — the
inventory-rules concept moves from `metadata.ticketRules` onto the record.

### Attachment (on the event)

Reuses the existing shape: `event.metadata.attached.ticket_type = [recordId, …]`.
No new event columns. Order of the id array is the display/sale order.

### Sold counts

Unchanged mechanism: `event.ticketSold[<key>]`. The key becomes the **record id**
(a uuid string) instead of the old numeric tier id. Checkout already passes
`ticketId` as `String(id)`, so uuid ids flow through the existing path untouched.

## Components & files

### Data layer — `lib/supabase/ticketing.js`
- No new columns. Add `listRecordsByIds(ids)` — `select * … .in("id", ids)
  .is("deleted_at", null)` → `normalizeRecord[]`; guards + tri-state return like
  the siblings. Powers public-page resolution of attached tickets.
- `module: "ticket_type"` needs no code change — it's just another discriminator.

### Ticket edit form — `components/internal/screens/tickets/ticket_types.jsx` (rewrite)
- Replace the current event-picker screen with a `RecordsScreen` wrapper (mirrors
  `discounts.jsx`): `module="ticket_type"`, `singular="ticket"`, `icon={Ticket}`,
  a single kind with `defaultConfig` = the config shape above, a `summarize()`
  (`"$25 · 200 left · refundable"`), and a `TicketEditForm`.
- `TicketEditForm` (new, in the same file) renders `SectionCard`s:
  - **Pricing & inventory** — price, quantity, min/max per order.
  - **Refund policy** — refundable `SettingRow`; when on, cutoff-days + fee
    handling select.
  - **Sales window** — `Segmented` always/window; start/end datetime when window.
  - **Visibility & access** — visibility select (public/hidden/scheduled) +
    on-sale datetime; access-code gating toggle + code; reserved-seating toggle.
  - Built from the shared kit + `controls.jsx` (`Segmented`, `NumField`), matching
    `DiscountEditForm` density.

### Event editor attach panel — `components/internal/screens/tickets/event_attachments.jsx`
- Add `TicketTypeAttachmentsSection` (or a dedicated new file
  `ticket_type_attachments.jsx`): fetch this project's `ticket_type` records,
  render each as a selectable, price-showing card, toggle membership in
  `event.metadata.attached.ticket_type` via `useEventConfig(event, "attached", …)`.
  Same persistence pattern as `TicketAttachmentsSection`; richer per-item UI
  (name + price + qty/remaining), and a "Create one" link to the Ticket Types tab
  when empty.

### Section wiring — `components/internal/screens/events/event_sections.js`
- Point the `tickets` section key at `TicketTypeAttachmentsSection` instead of
  `TicketsSection`. Update its `desc` ("Attach reusable tickets to this event.").
  `ticketlinks` (generic Ticketing attach) is unchanged.

### Retire the embedded editor — `event_builder.jsx` / `inventory_sections.jsx`
- `TicketsSection`, `TicketCard`, `CreateTicketDialog`, `INITIAL_TICKETS`,
  `Perforation`, `TicketLeft`, and `TicketTypesSection`/`TicketRulesCard` become
  dead once the tab is repointed. Remove them and their now-unused imports.
  `AttachInquiryCard` (Dietary & Accessibility opt-in) must be **preserved** — move
  it onto the new attach panel so that opt-in isn't lost.

### Public sale (phase 4 — deferrable)
- `event_public_page.jsx`: the page already loads a single `event`. Add a
  `useEffect` that, when `event.attached?.ticket_type?.length`, calls
  `listRecordsByIds()` and stores `ticketRecords` in state. `buildTickets()`
  resolves in priority order: **attached active ticket_type records** →
  legacy `event.tickets` → synthesized fallback. Honor per-ticket
  visibility/sales-window/access-code when deciding what's buyable.
- `app/api/checkout/route.js` + `verify/route.js`: already keyed on `ticketId`;
  no change beyond confirming uuid ids validate against the resolved records.

## Backward compatibility & migration

- **No destructive migration.** Existing events keep `metadata.tickets`;
  `buildTickets()` falls back to them when no `ticket_type` records are attached,
  so live event pages don't break.
- No data backfill in this pass. (Optional future script: promote each event's
  embedded tiers into `ticket_type` records + attach them — out of scope here.)
- `metadata.ticketRules` is superseded by per-record config; left in place,
  ignored. No cleanup required.

## Risks / open questions

1. **Public-read RLS.** Attached `ticket_type` records must be readable on the
   unauthenticated `/e/<id>` page. Verify `ticketing_records` has (or add) a
   public-read path mirroring however published events are read today; otherwise
   phase 4's `listRecordsByIds` returns empty for anonymous visitors.
2. **Inventory semantics** (decision #1): the record's `qty` is a per-event cap,
   not a global shared pool. If a truly shared pool is wanted, revisit — it needs
   a global sold counter on the record instead of `event.ticketSold`.
3. **Permission gating.** The Ticket Types sidebar screen keeps its existing
   `view.*` gate; no new permission introduced.

## Build sequence

1. `listRecordsByIds` in `ticketing.js`.
2. `TicketEditForm` + `ticket_types.jsx` `RecordsScreen` rewrite; fold
   `constants.js` ticket-rule defaults into the record config defaults.
3. `TicketTypeAttachmentsSection` + preserve `AttachInquiryCard`.
4. Repoint the `tickets` section key; remove the dead embedded editor + imports.
5. `npx eslint` the changed files clean.
6. **(Gate)** Phase 4 public sale wiring — only after reviewer confirms, and after
   the RLS check in Risk #1.
