# 10 — Inventory

| | |
|---|---|
| **Nav items** | 6 — Items, Stock Movements, Event Allocations, Item Issuing, Issuing Staff, Suppliers & Purchase Orders |
| **Registered** | 6/6 |
| **Tier** | **A — live**, and architecturally the best-designed module in the app |
| **Key files** | `inventory/items.jsx` (824), `event_allocations.jsx` (1057), `suppliers_purchase_orders.jsx` (1096), `issuing_desk.jsx` (620), `issuing_staff.jsx` (610), `stock_movements.jsx` (468), `lib/supabase/inventory.js` + `inventory_issuing.js` + `inventory_purchasing.js`, `app/issue/[eventId]` |

---

## 1. What this means in industry

Event merch/stock management sits between a light WMS and a POS (Lightspeed,
Shopify POS, Cin7):

- **Catalog with variants** — size/colour, each with its own SKU and stock.
- **On-hand that cannot drift** — every change is a movement (receive, transfer,
  issue, adjust, return, damage), and on-hand is the sum, never a stored counter.
- **Costing** — unit cost, COGS on issue, margin on sale, stock valuation.
- **Replenishment** — reorder points, lead times, suggested POs, receiving
  against a PO (including partial receipts).
- **Allocation** — commit stock to an event/location and track what came back.
- **Fulfilment at the event** — scan a badge, hand over the item, prevent
  double-collection.
- **Counting** — cycle counts and variance reconciliation.

## 2. What exists today (verified)

This module gets the hard part right:
- **On-hand derived from an append-only movement ledger** — the correct design, and
  the reason this module can't silently drift the way a counter-based one does
- Parent/variant rows as self-referencing records
- Event allocations carrying an **issuance mode** (internal / entitled by ticket, session,
  audience, or every attendee / backing a paid add-on) plus a collection rule
  (once / per day / per window / rolling)
- A **code-gated staff issuing desk** at `/issue/[eventId]` writing a redemption ledger,
  with a DB-level double-collect guard — entitlements are *derived*, never stored
- Suppliers & purchase orders (1096 lines)

Gaps:
- **No costing.** No unit cost, no COGS, no stock valuation — so Inventory contributes
  nothing to [13 Analytics](13-analytics.md) or margin reporting
- **No reorder points or low-stock alerts** — replenishment is entirely manual
- **No barcode/SKU scanning** at receiving or issuing, though the app already ships a
  working camera scanner (`jsqr`) used by [12 Check-in](12-checkin.md)
- No cycle counts / variance reconciliation
- Returns after an event (what came back from an allocation) aren't modelled distinctly

## 3. Pending deliverables

### P0
- [ ] Cost fields on the item and on receipt movements; compute COGS on issue and a stock valuation on the Items screen
- [ ] Reorder point + lead time per item; a low-stock signal on the list and a job-driven alert ([00 H1](00-cross-cutting.md))
- [ ] Reuse the existing `jsqr` scanner for **SKU scanning at the issuing desk and at PO receiving** — the component exists; this is wiring, not building

### P1
- [ ] Partial PO receipts, and a PO status derived from received vs. ordered
- [ ] Post-event allocation returns: reconcile allocated → issued → returned → shrinkage
- [ ] Cycle counts with variance write-off as an explicit movement kind

### P2
- [ ] Multi-location stock (warehouse vs. on-site)
- [ ] Supplier lead-time history and reorder suggestions

## 4. UX & component placement

### Items
| Issue | Change |
|---|---|
| Merch is visual and the list is text | Items with photos should default to a **gallery/table toggle**; the photo is how staff identify stock. Photos already live in `products/inventory/<id>/` |
| Variants are rows in the same flat table as parents | Nest variants under an expandable parent row, or show `Parent · 4 variants` and open variants in the drawer. A flat mix of parents and variants makes on-hand totals ambiguous |
| On-hand is a number | Show **on-hand / allocated / available** as three values, since allocated stock is not sellable stock. One number invites over-allocation |
| Low stock isn't visible | Once reorder points exist, add a red/amber dot on the row and a "Low stock" quick filter as the first chip in the toolbar |

### Stock Movements
- This is an **audit ledger**; make it read like one: reverse-chronological, grouped by day, with the movement kind as a coloured pill and the resulting balance in the last column. A running balance column is what makes a ledger auditable at a glance
- Add "filter to this item" from the item drawer rather than making users search

### Event Allocations
| Issue | Change |
|---|---|
| The screen (1057 lines) carries allocation, issuance mode and collection rule in one form | Split the editor into three clear steps — **What (item + qty) → Who (issuance mode/audience) → How (collection rule)** — with a plain-language summary sentence at the bottom: *"Every VIP attendee may collect 1 tote, once, from Aug 20."* Configuration this conditional needs a readback |
| Progress isn't shown | Add an issued/allocated progress bar per allocation row — the number staff and organizers actually track during the event |

### Item Issuing (the desk)
- The `/issue` route is a **staff tool used standing up, on a phone, under time pressure**. Optimise for that: giant scan target, one-tap confirm, unmistakable success/duplicate/error states (the check-in route's `FEEDBACK` colour pattern is already right — reuse it verbatim)
- Show the queue of recent hand-overs beneath, so a mis-scan can be undone immediately
- Keep the entitlement explanation visible on a failure ("Not entitled — VIP only" vs "Already collected today")

### Issuing Staff
- This is access control; show **who has an active code, last used, and a revoke button** as the primary columns. A staff list without last-used is a security gap

### Suppliers & Purchase Orders
- POs are documents — give the PO editor a **document preview** (line items, totals, terms) beside the form
- Receiving should be its own focused flow: PO → expected lines → enter/scan received quantities → post movements, not a generic record edit

## 5. Schema / API work
- [ ] `inventory_items` gains `unit_cost numeric`, `reorder_point integer`, `lead_time_days integer`, `sku text`
- [ ] Movement kinds extended with `return`, `count_adjust`, `shrinkage`
- [ ] `events.v_inventory_on_hand` view (item_id, on_hand, allocated, available) so no screen re-implements the sum
- [ ] Job kind: `inventory.low_stock_check`
