# 09 — Orders

| | |
|---|---|
| **Nav items** | 6 — All Orders, Refunds & Cancellations, Transactions, Billing & Receipts, Disputes & Chargebacks, Order Settings |
| **Registered** | 6/6 |
| **Tier** | **A** for viewing · **B** for acting (refunds don't refund) |
| **Blocked by** | [00 H4 money out](00-cross-cutting.md), [00 H3 fees/tax](00-cross-cutting.md) |
| **Key files** | `orders/all_orders.jsx`, `order_detail_drawer.jsx` (772), `refunds_center.jsx`, `disputes.jsx` (430), `transactions.jsx`, `billing_receipts.jsx`, `lib/supabase/orders.js` + `order_refunds.js` + `order_events.js` + `order_disputes.js` |

---

## 1. What this means in industry

The post-checkout cockpit. Stripe Dashboard, Eventbrite Orders and Shopify Orders
all converge on the same jobs:

- **Find any order fast** — by email, last-4, order id, attendee name, phone.
- **Act on it** — full/partial refund, cancel, resend tickets, edit attendee
  details, transfer, add a note; every action logged with who and why.
- **See the money** — the charge, the fees taken, the net, the payout it landed
  in, and the refunds against it.
- **Defend a chargeback** — assemble and submit evidence to the processor before
  the deadline, and track win/loss.
- **Reconcile** — a settlement report that ties platform orders to bank deposits,
  exportable to accounting.

## 2. What exists today (verified)

Well-built as an operational surface:
- Cross-event order table + a substantial 772-line detail drawer
- A refunds centre, transactions ledger, billing/receipts and disputes screens
- `order_events.js` — an event log per order, which is the right backbone
- Backed by real tables (`event_orders`, `order_refunds`, `order_events`, `order_disputes`)
  and gated by project RLS

The gap is stated in the codebase's own sidebar comment: **"Refunds record-only
for now (Stripe-ready hook in `events.issue_order_refund`)."**

- **A refund writes a row and returns no money.** An organizer can mark an order
  refunded, tell the customer, and be wrong.
- Disputes are **tracked, not defended** — no evidence upload, no submission to Stripe,
  no deadline enforcement.
- Billing & Receipts has no generated document ([08 P1](08-tickets.md)).
- Transactions is a list of charges, not a **settlement** view — there is no payout
  reconciliation because there are no payouts ([00 H4](00-cross-cutting.md)).
- No fee/net columns anywhere, because fees don't exist yet ([00 H3](00-cross-cutting.md)).

## 3. Pending deliverables

### P0 — Make the actions real
- [ ] `stripe.refunds.create` inside `issue_order_refund`'s call path, using the recorded refund row id as the idempotency key; reconcile status from the webhook rather than optimistically
- [ ] Handle partial refunds correctly against line items (needs `order_lines` from [08](08-tickets.md))
- [ ] On refund success: release inventory, invalidate the ticket QR, revoke seat/booth assignment, fire the `refund_issued` email ([00 H2](00-cross-cutting.md))
- [ ] Guard the UI: a refund button that cannot actually refund should be disabled with a reason, not silently record

### P1
- [ ] Dispute evidence: upload files, assemble the standard packet (receipt, check-in record, terms accepted at purchase, communication log), submit via Stripe, track the deadline
- [ ] Settlement/reconciliation report: orders → fees → net → payout, exportable
- [ ] Order-level actions: resend tickets, edit attendee, cancel without refund, add internal note

### P2
- [ ] Fraud signals surfaced on the order (Stripe Radar outcome, mismatched country, velocity)
- [ ] Accounting export formats (Xero/QuickBooks CSV)

## 4. UX & component placement

### All Orders
Frame today: `ScreenHeader → StatsBar → Toolbar(2 filters + search) → DataTable → OrderDetailDrawer`.
The structure is right; the density is not.

| Issue | Change |
|---|---|
| Search is one field, but support staff arrive with *any* identifier | Make search explicitly multi-key with a hint (`Search order #, email, name, last 4…`) and match across all of them. This is the highest-frequency interaction on the screen |
| No bulk actions | [00 H5](00-cross-cutting.md): select → Resend tickets, Export, Refund (with a confirm listing totals). Bulk resend after a mail outage is a real, common need |
| No date-range control, though every stat is time-relative | Add the shared range picker to `ScreenHeader.actions`; make the stats respect it |
| Money columns aren't scannable | Right-align all currency, use tabular numerals, and add `Fees` and `Net` columns once fees exist. Gross-only is misleading to an organizer |
| Refunded/disputed orders look like normal rows | Add a subtle left border accent by state, so exceptions pop without a filter |

### Order detail drawer (772 lines — the app's best drawer)
| Issue | Change |
|---|---|
| Actions are spread through the drawer body | Dock a **persistent action bar at the bottom of the drawer**: `[Resend] [Refund ▾] [⋯]`. Actions on a long scrolling drawer must not scroll away |
| The order event log is buried | Promote to a right-hand or bottom **timeline** that is always visible — "what happened to this order" is the question support is answering |
| No next/prev | Add ↑/↓ through the filtered list |
| Refund opens a dialog with an amount field | Make the refund dialog show the **line items with checkboxes** and compute the amount, rather than asking for a number. Typed refund amounts are how money gets given away by accident |

### Refunds & Cancellations
- This is a **queue**, not a catalog — sort by age, show an SLA chip, and support approve/deny in place with a reason. Consider a board presentation (`Requested → Approved → Processing → Completed / Denied`)

### Disputes & Chargebacks
- Deadline is the dominant fact: show **time remaining as a red countdown** at the row and drawer level
- Evidence assembly should be a **checklist** ("receipt ✓, check-in record ✓, terms ✓, communications ✗"), not a free-form upload — the checklist is what wins disputes

### Transactions / Billing & Receipts
- Transactions should group by **payout batch** once payouts exist; until then, label it clearly as a charge ledger so it isn't mistaken for settlement
- Billing & Receipts: add a preview of the actual receipt document beside the profile settings, reusing the preview pattern from Page Design

## 5. Schema / API work
- [ ] `order_refunds` gains `stripe_refund_id`, `status`, `failure_reason`
- [ ] `order_disputes` gains `due_at`, `evidence jsonb`, `submitted_at`, `outcome`
- [ ] `events.payout_batches` + `order_lines.payout_batch_id` for reconciliation
- [ ] Extend the Stripe webhook (`app/api/stripe/webhook/route.js`) to handle `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `payout.paid`
