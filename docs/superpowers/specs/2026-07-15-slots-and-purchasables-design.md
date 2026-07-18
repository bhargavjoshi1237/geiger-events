# Bookable Slots + Conditional Purchasables — Design Spec

Date: 2026-07-15
Area: events (buyer checkout + event editor + orders)

## Goal

Add, to the ticket-buying experience:

1. **Bookable time slots** — organiser enables "slot booking", defines dated
   sessions (start/end, capacity, time-of-day band, price delta, rich settings);
   buyer picks one during checkout.
2. **Conditional additional purchasables (add-ons)** — a **new** entity separate
   from the existing Offerings, shown to the buyer in a new **animated slide-in
   step** *after* ticket details, and gated by fully-configurable conditions
   (band / specific slots / ticket / quantity / cutoff / membership / dependency).
   Example: an "evening" slot reveals a $10 dinner add-on; a "noon" slot does not.

Follows MODULE/SUPABASE conventions: config lives in the event `metadata` bag via
`useEventConfig`/`updateEventMeta`; screens read through the data layer; UI is
built from the shared kit + shadcn primitives.

## A. Data model (event `metadata` bag)

### `metadata.slotBooking`
```js
{ enabled:false, required:true, mode:"single", label:"Choose your time" }
```

### `metadata.slots` (array)
```js
{
  id, label, description,
  start, end,                 // ISO datetimes
  band:"evening",             // morning|afternoon|evening|night; auto from start, overridable
  capacity:50,
  priceDelta:0,               // +/- to ticket price when this slot chosen
  allowedTickets:"all",       // "all" | [ticketId]
  location:"",                // room / sub-venue
  bookingCutoffHours:null,    // stop selling N hrs before start
  minPerOrder:1, maxPerOrder:null,
  waitlist:false,
  color:"",
  enabled:true,
}
```
Sold counts: `metadata.slotsSold = { [slotId]: n }`, incremented atomically in the
buy RPC under the existing event-row `FOR UPDATE` lock (no new table).

### `metadata.purchasables` (array)
```js
{
  id, name, description, image,
  price, priceType:"flat"|"perAttendee",
  pickType:"toggle"|"quantity",
  required:false,
  stock:null,                 // optional inventory cap
  maxPerOrder:null,
  enabled:true,
  showIf:{
    match:"all"|"any",
    bands:[],                 // e.g. ["evening"]
    slotIds:[],
    tickets:"all",            // "all" | [ticketId]
    minQty:null, maxQty:null,
    membersOnly:false,
    cutoffHours:null,         // hide if < N hrs before selected slot start
    requiresPurchasableId:null,
    excludesPurchasableId:null,
  },
}
```

## B. Organiser — two new editor tabs (Tickets group in `event_sections.js`)

- **Slots** (`slots.jsx` → `SlotsSection`): master "Allow slot booking" switch
  (+ required, label), slot list, add/edit `Dialog` with every slot field. Band
  auto-suggested from start. Shows capacity vs sold. Persist via `useEventConfig`.
- **Purchasables** (`purchasables.jsx` → `PurchasablesSection`): list + editor
  `Dialog` including a **Conditions** builder (band/slot/ticket multiselect, qty
  min/max, cutoff, members-only, requires/excludes, ALL/ANY). Legacy **Offerings**
  tab untouched.

## C. Buyer — checkout dialog (`event_public_page.jsx`)

- `step` becomes a horizontal slide track (`flex` + `translateX`, pure CSS).
  `[ Details (+ slot picker) ] → [ Purchasables ] → Done/Error`.
- Details step gets a **slot picker** at top when `slotBooking.enabled` (radio:
  label, time, band, remaining, +price; respects allowedTickets, cutoff, capacity,
  waitlist).
- **`TicketAddonsStep`** (`ticket_addons_step.jsx`): renders only purchasables
  whose `showIf` passes for the selected slot/ticket/qty; toggle or quantity
  controls, live subtotal; slides in after "Continue".
- Total folds ticket + slot delta + purchasables into existing buy/Stripe path.
- Legacy inline Offerings block hidden when the event has purchasables.

## D. Persistence & downstream

- `lib/supabase/purchasables.js`: shared **condition evaluator** (`isPurchasableVisible`),
  slot helpers (band from time, remaining), light read helpers. Pure, no toast.
- `orders.js` `buyTicket`: add `slotId`, `slot`, `purchasables`, extra amount;
  RPC `buy_ticket` gains `p_slot_id`, enforces slot capacity + bumps `slotsSold`,
  stores `metadata.slot` + `metadata.purchasables`, folds price into total.
  Idempotent `create or replace` in `supabase/sqls/` (authoritative RPC in
  `zz_project_access.sql`).
- `/api/checkout` (Stripe): include slot/purchasables amount + metadata.
- `portal_tickets.jsx`: display booked slot + purchasables alongside existing
  add-ons.

## E. Files

New: `slots.jsx`, `purchasables.jsx`, `ticket_addons_step.jsx`,
`lib/supabase/purchasables.js`, band/constants.
Touched: `event_sections.js`, `event_public_page.jsx`, `lib/supabase/orders.js`,
`supabase/sqls/*`, `portal_tickets.jsx`, `/api/checkout`.

## Decisions

- Slot capacity: atomic JSON counter in RPC (no new table).
- Overlap: keep legacy Offerings; hide its buyer block when purchasables exist.
