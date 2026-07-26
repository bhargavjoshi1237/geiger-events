# Inventory — Design

Date: 2026-07-25
Status: approved, implementing

## Purpose

A workspace-level inventory module for **physical stock and merch** — t-shirts,
swag, badges, lanyards, print, food & beverage, staff supplies. Items live in a
project-wide catalog and are allocated to individual events. Stock is tracked by
an append-only movement ledger so on-hand can never drift from history.

This is distinct from the *ticket* inventory that already exists (per-tier
`qty`/`sold`/`reserved` inside ticketing) and from `purchasables[].stock` (a
per-event soft cap on an add-on).

## Scope decisions

| Question | Decision |
|---|---|
| Domain | Physical stock & merch |
| Scope | Project-wide catalog + per-event allocation |
| Sales link | Item can be **internal**, **ticket-entitled**, or **add-on-backed**; demand is computed read-only in v1 |
| Screens | 4 — Items, Stock Movements, Event Allocations, Suppliers & Purchase Orders |
| Storage | Dedicated tables + signed movement ledger |
| Variants | Parent item + variant rows (self-referencing `parent_id`) |

**Out of scope for v1:** point-of-sale, auto-decrement at checkout, multi-warehouse
locations, stock-count audits, barcode scanning.

## Data model — `supabase/sqls/inventory.sql` (schema `events`)

Self-contained and idempotent, run by `npm run db:push`.

### `events.inventory_items`

```
id uuid pk
project_id   uuid -> public.projects(id) on delete cascade
parent_id    uuid -> events.inventory_items(id) on delete cascade  -- null = top level
sku text, name text, variant_label text, category text, description text
image_url text
unit_cost numeric(14,2), unit_price numeric(14,2), currency text default 'USD'
reorder_point integer default 0
on_hand numeric(14,2) default 0        -- trigger-maintained from the ledger
active boolean default true
config jsonb, created_by uuid -> auth.users, created_at/updated_at/deleted_at
```

**Only leaf rows hold stock.** A parent that has children is a group; its
on-hand, value and low-stock state are summed from its variants in the UI. An
item with no children is its own leaf. One table — no duplicated CRUD surface.

`created_by` references `auth.users(id)` (this database has **no `public.users`**
table — see the ticketing tables, which do the same).

### `events.inventory_movements`

The signed ledger — the sole source of truth for on-hand.

```
id uuid pk, project_id uuid, item_id uuid -> inventory_items on delete cascade
event_id uuid -> events.events on delete set null      -- nullable
allocation_id uuid -> inventory_allocations on delete set null
kind text  -- receive | adjust | issue | return | waste | transfer
qty numeric(14,2)   -- signed: + into stock, - out of stock
reason text, note text, reference text
created_by uuid -> auth.users, created_at timestamptz
```

An `after insert or delete` trigger (`events.inventory_apply_movement()`) applies
`qty` to `inventory_items.on_hand`. Movements are append-only in the UI —
corrections are made with a counter-movement, never an edit. Receiving stock only
ever happens through a `receive` movement.

### `events.inventory_allocations`

An item committed to an event.

```
id uuid pk, project_id uuid, item_id uuid -> inventory_items on delete cascade
event_id uuid -> events.events on delete cascade
planned_qty numeric default 0, issued_qty numeric default 0
status text     -- Planned | Reserved | Issued | Closed
issuance text   -- internal | ticket | addon
ticket_ids jsonb default '[]'   -- ids from event.metadata.tickets
qty_per_attendee numeric default 1
purchasable_id text             -- id from event.metadata.purchasables
notes text, config jsonb, timestamps, deleted_at
```

### `events.inventory_suppliers`

```
id, project_id, name, contact_name, email, phone, website,
lead_time_days integer, notes, config jsonb, timestamps, deleted_at
```

### `events.inventory_purchase_orders`

```
id, project_id, supplier_id -> inventory_suppliers on delete set null
code text, status text  -- Draft | Ordered | Partial | Received | Cancelled
expected_at date, ordered_at date, received_at date
currency text, total numeric(14,2)
lines jsonb  -- [{ itemId, name, qty, unitCost, receivedQty }]
notes, config jsonb, timestamps, deleted_at
```

Receiving a PO writes one `receive` movement per line and advances the PO status
to `Partial` or `Received`.

### Product photos

`image_url` holds a **direct public URL** into the shared `products` bucket under
`inventory/<item-id>/` — the same contract events (`events/<id>/`) and venues
(`venues/<id>/`) use. A variant is its own item row, so it gets its own folder;
a variant with no photo of its own **falls back to its parent's** in the UI
(`resolveItemImage`), because a "Large" tee looks like the tee.

Uploads go through `uploadInventoryImage()` in `lib/supabase/storage.js`
(compressed under ~500 KB). Storage RLS for the `inventory/` prefix lives at the
end of `inventory.sql` rather than `storage.sql`, because the policies reference
`events.inventory_items` and `db:push` runs files in filename order.

Photos appear as a square thumbnail wherever an item is named — the Items table,
Stock Movements, Event Allocations, the PO line builder and receive dialog — and
as a 3:2 hero in the item drawer. An item with no photo falls back to a
**category-shaped placeholder** (shirt for merch, printer for print, and so on),
so a catalog with no uploads still reads at a glance. Suppliers deliberately
carry no logo: the images here are about identifying *stock*.

### Derived, never stored

- `allocated` = Σ (`planned_qty` − `issued_qty`) over every allocation except
  `Closed` — a partly-issued allocation still reserves its remainder
- `available` = `on_hand` − `allocated`
- `lowStock` = `on_hand` ≤ `reorder_point` (and `reorder_point` > 0)
- `stockValue` = `on_hand` × `unit_cost`

RLS is enabled on every table with the project-scoped policy the other `events`
tables use.

## Issuance — the three modes

Set **per allocation**, because ticket ids and purchasable ids are per-event.

- **Internal** — management-only stock (signage, staff shirts). Demand is
  whatever you plan; no buyer link.
- **Ticket-based** — the item is entitled to every buyer of the selected tickets.
  `projectedDemand = Σ(quantity on paid orders whose ticket matches a linked
  ticket) × qty_per_attendee`, read from `events.event_orders`.
- **Add-on-backed** — the allocation points at a `purchasables[].id`;
  `projectedDemand` = units of that add-on across paid orders, read from
  `order.metadata.offerings` / `order.metadata.purchasables`.

v1 computes demand **read-only**: the Event Allocations screen reports a shortfall
when demand exceeds planned. Stock leaves only via an explicit **Issue** action,
which writes an `issue` movement and bumps `issued_qty`. The live Stripe /
`buy_ticket` path is deliberately untouched.

## Data layer

- `lib/supabase/inventory.js` — items (`listItems`, `createItem`, `updateItem`,
  `softDeleteItem`), movements (`listMovements`, `recordMovement`), allocations
  (`listAllocations`, `createAllocation`, `updateAllocation`,
  `softDeleteAllocation`, `issueAllocation`).
- `lib/supabase/inventory_purchasing.js` — suppliers + purchase orders, plus
  `receivePurchaseOrder()` which writes the `receive` movements.

Both follow the house contract: `isSupabaseConfigured()` guard, `normalize*` /
`toRow` at the snake↔camel boundary, return `null` / `[]` / `false`,
`console.error` on failure, never throw, never toast.

## Screens — new **Inventory** sidebar section, after Orders

1. **Items** — `StatsBar` (Items, Stock value, Needs attention, Allocated) →
   filters (category / stock status) + search → `DataTable` with expandable
   variant groups → row opens a **detail drawer** with Overview / Stock /
   Events / Variants tabs. Create dialog for items and variants.
   Issuance is deliberately *not* a filter here — it is a property of an
   allocation, not of the item.
2. **Stock Movements** — the ledger, filtered by item / kind, with a
   "Record movement" dialog (receive, adjust, issue, return, waste, transfer).
3. **Event Allocations** — planned vs issued vs projected demand, shortfall in
   `text-red-400`. Rows sort by event so one event's commitments read together,
   with an event filter alongside issuance and status. Allocate, issue, return,
   status-change and remove actions.
4. **Suppliers & Purchase Orders** — tabbed; suppliers list plus a PO builder
   drawer with a **Receive** action that writes movements into stock.

All four use the shared kit (`ScreenHeader`, `StatsBar`, `Toolbar`,
`SearchInput`, `FilterDropdown`, `DataTable`, `StatusPill`, `EmptyState`),
semantic colour tokens only, three list states, optimistic mutations with
`toast`, lookups and formatters in `components/internal/screens/inventory/constants.js`,
and are registered in `registry.jsx` under the exact sidebar titles.

## Permissions

Section-level, matching how `view.orders` gates the Orders area: add
`view.inventory` to `WORKSPACE_PERMISSIONS` in `lib/rbac.js`.

## Files

| File | Change |
|---|---|
| `supabase/sqls/inventory.sql` | new — five tables, trigger, indexes, RLS |
| `lib/supabase/inventory.js` | new — items, movements, allocations |
| `lib/supabase/inventory_purchasing.js` | new — suppliers, purchase orders |
| `components/internal/screens/inventory/constants.js` | new — maps, filters, formatters, category icons |
| `components/internal/screens/inventory/item_image.jsx` | new — thumbnail, drawer hero, create-dialog picker |
| `lib/supabase/storage.js` | edit — `inventoryMediaPrefix` + `uploadInventoryImage` |
| `components/internal/screens/inventory/items.jsx` | new — catalog cockpit |
| `components/internal/screens/inventory/item_detail_drawer.jsx` | new — tabbed drawer |
| `components/internal/screens/inventory/stock_movements.jsx` | new — ledger |
| `components/internal/screens/inventory/event_allocations.jsx` | new — per-event planning |
| `components/internal/screens/inventory/suppliers_purchase_orders.jsx` | new — suppliers + POs |
| `components/internal/screens/registry.jsx` | edit — register 4 titles + `Inventory` |
| `components/internal/sidebar/sidebar_nav.jsx` | edit — new section |
| `lib/rbac.js` | edit — `view.inventory` |

## Post-implementation

`npm run db:push` is required — the module renders its empty states until the
tables exist.
