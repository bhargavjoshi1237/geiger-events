# 08 — Tickets

| | |
|---|---|
| **Nav items** | 20 — the largest section in the app |
| **Registered** | 20/20 (no `ComingSoon`) |
| **Tier** | **A** for the sales path · **B** for 8 of the 20 sub-items |
| **Blocked by** | [00 H1 jobs](00-cross-cutting.md), [00 H3 fees/tax](00-cross-cutting.md), [00 H4 refunds/payouts](00-cross-cutting.md) |
| **Key files** | `app/api/checkout/route.js`, `lib/stripe/fulfill-checkout.js`, `events.buy_ticket` (in `*_ticketing_addons.sql`), `tickets/records_kit.jsx` (652), `tickets/event_tickets.jsx` (672) |

---

## 1. What this means in industry

Ticketing (Eventbrite, DICE, Ticketmaster, Universe) is judged on five things,
and **four of the five are pricing correctness**:

- **Inventory integrity** — no overselling under concurrency; holds, comps, and
  released inventory all accounted for.
- **Price assembly** — face value ± promo ± early-bird ± dynamic, **plus fees**
  (service, payment, facility — absorbed or passed on), **plus tax** by
  jurisdiction, in the buyer's **currency**.
- **Money out** — organizer payouts on a schedule, with balances, statements and
  tax forms; refunds that actually return money.
- **Ownership & anti-fraud** — name-locked tickets, ID checks, transfer rules,
  a capped resale marketplace, per-buyer limits, bot mitigation.
- **Payment flexibility** — plans/installments with dunning, multiple methods,
  invoicing for B2B buyers.

## 2. What exists today — per sub-item

The sales path is real. `app/api/checkout/route.js` creates real Stripe sessions,
**re-validates discounts server-side**, recomputes early-bird and group discounts
so Stripe and `buy_ticket` agree, carries seat/booth hold tokens, and fulfils
idempotently. That is genuinely well-built and is the pattern the rest should copy.

| Sub-item | Tier | Evidence |
|---|---|---|
| Ticket Types | **A** | real records, attached per event, inventory enforced |
| Ticket Tiers | **A** | `ticketId` travels to `buy_ticket`, per-tier inventory enforced |
| Discounts & Codes | **A** | `validateEventDiscount` server-side, re-derived on fulfilment |
| Bundles | **A** | `bundleId` honoured in checkout + fulfilment |
| Early-bird Sales | **A** | `earlybirdReduction()`, re-derived from server clock |
| Donations | **A** | real line item |
| Group Purchasing | **A** | `groupDiscountAmount()`, per-attendee rows on fulfilment |
| Access-code Tickets | **A** | `lib/events/access_codes.js`, checked at fulfilment |
| Reserved Seating | **A** | TTL holds, `buy_seats`, unique live-assignment index |
| Orders & Attendees | **A** | real cross-event list |
| **Anti-scalping & Resale** | **B** | config keys (`nameLockRequired`, `transferPolicy`, `maxResalePrice`, `maxPerBuyer`) appear **only** in their own editor — nothing reads them |
| **Dynamic Pricing** | **B** | `grep dynamicPricing` → **zero** references outside the screen. Completely inert |
| **Payment Plans** | **B** | checkout is `mode: "payment"` only; "installment" appears only as a *planned* email type |
| **Transfers** | **B** | appears only in `lib/email/catalog.js` as a planned email. No transfer flow exists |
| **Multi-currency** | **B** | checkout takes a single `paymentsCfg.currency`; there is no per-buyer currency or FX |
| **Payouts** | **B** | a form (method/schedule/account/fees). No Stripe Connect, no balance, no transfer |
| **Refunds** | **B** | policy config here; the ops path in [09 Orders](09-orders.md) records a row but **issues no Stripe refund** |
| **Taxes** | **C** | 28 lines. An `EmptyState` saying "not set up yet" |
| Payments & Methods | B | method config; only Stripe card is actually wired |
| Invoices & Receipts | B | invoice *profiles* exist in schema; no document is generated |

**Eight Tier-B rule screens is the core of the "gimmick" problem.** Each one lets
an organizer make a promise (no scalping, prices rise near the date, pay in
three) that the system will not keep.

## 3. Pending deliverables

### P0 — Price correctness (nothing else in this section matters more)
- [ ] **Fees** ([00 H3](00-cross-cutting.md)): service/payment/facility, fixed or percent, absorb vs. pass-to-buyer. Compute in one server-side module, re-derive in `buy_ticket`
- [ ] **Tax**: rates by jurisdiction, inclusive/exclusive, per line item, on the receipt
- [ ] Show the full breakdown on the public checkout **before** payment — subtotal, discount, fees, tax, total. A total that changes at Stripe is the fastest way to lose a sale
- [ ] **Enforce the rules already being collected**: `maxPerBuyer`, name lock, transfer policy, and per-event purchase limits inside `buy_ticket`. Cheap, and converts several screens from fiction to fact in one migration

### P0 — Money out
- [ ] Stripe **refunds** actually issued ([09](09-orders.md) owns the UI; the API call belongs to the same server module)
- [ ] Stripe **Connect** for organizer payouts: onboarding, balance, payout history, destination charges or transfers on sale
- [ ] Replace the typed-in "Account ending 4242" field with the Connect account state

### P1
- [ ] **Payment plans**: schedule rows + a job that charges installment N with retry/dunning and access revocation on final failure
- [ ] **Transfers**: a real ticket-ownership change (holder record, transfer request, accept link, audit entry), gated by the transfer policy the Anti-scalping screen already collects
- [ ] **Dynamic pricing**: a rule engine (time-based, sell-through-based) evaluated by the job runner, writing an effective price the checkout reads. Show a price history so organizers trust it
- [ ] **Multi-currency**: presentment currency per buyer with a stored FX rate on the order; settlement currency per payout account
- [ ] **Invoices & Receipts**: generate an actual PDF/HTML document per order, numbered sequentially per project, retrievable from the portal

### P2
- [ ] Capped resale marketplace (needs transfers + name lock first)
- [ ] Bot mitigation on high-demand on-sales (queue, rate limit, Vercel BotID is available on the platform)
- [ ] Comp/hold allocations distinct from public inventory

## 4. UX & component placement

### The section itself
| Issue | Change |
|---|---|
| **20 flat sidebar entries** — the longest list in the app, and users cannot tell which are pricing, which are rules, and which are money-out | Group into four sub-headings: **Inventory** (Types, Tiers, Bundles, Reserved Seating), **Pricing** (Discounts, Early-bird, Dynamic, Group, Donations, Multi-currency, Taxes), **Rules** (Access codes, Anti-scalping, Transfers, Refunds), **Money** (Payments, Payment Plans, Payouts, Invoices, Orders). Twenty peers is not a menu, it's a wall |
| Every screen looks identical ([00 U1](00-cross-cutting.md)) | At minimum, give the **Money** group a distinct layout (balance/summary card at top rather than a stats bar of counts) |

### Records screens (all 20 share `records_kit.jsx`)
| Issue | Change |
|---|---|
| A rule record gives no indication of where it applies | Add an **"Attached to N events"** column and, in the editor, a panel listing them with links. A reusable record whose usage is invisible cannot be safely edited or deleted |
| No indication that a rule is inert | Until enforcement lands, show an honest badge on the Tier-B screens: `Not yet enforced`. This is the single cheapest credibility fix in the repo — it converts a lie into a roadmap |
| `[Delete]` sits beside `[Save Changes]` in the editor header | Move Delete to an overflow menu ([00 U2](00-cross-cutting.md)); require typed confirmation when the record is attached to a live event |
| Editors ask for config with no worked example | Add a **live example calculation** panel to the pricing editors: "A $50 ticket × 2 with this rule = $85.40 (fees $5.40, tax $0)". Pricing config without a worked example is guesswork |

### Ticket Types / Tiers
- Show **inventory as a bar with numbers** (`412 / 500 sold · 20 held · 68 left`) on the row — the number an organizer checks most often
- Add a per-tier sales sparkline in the drawer; pacing is more useful than a total

### Orders & Attendees
- This duplicates [09 All Orders](09-orders.md). Decide one home: keep the ticket-centric *attendee* view here and route order operations to the Orders section, or merge. Two similar tables in two sections is a navigation tax

### Payouts
- Replace the record list with a **balance-first layout**: available balance, next payout date and amount at the top, payout history table beneath, account settings in a drawer. Nobody opens Payouts to edit a schedule; they open it to ask "when do I get paid"

## 5. Schema / API work
- [ ] `events.fee_schedules`, `events.tax_rates`, both referenced from the event and applied in `buy_ticket`
- [ ] `events.order_lines` with `kind (ticket|addon|fee|tax|donation|discount)` so a receipt can be reconstructed exactly
- [ ] `events.payment_plans` + `events.installments`
- [ ] `events.ticket_holders` (ticket_id, contact_id, name_locked, transferred_from) to make transfers and name-lock real
- [ ] `events.price_rules` + `events.price_history` for dynamic pricing
- [ ] Extend `buy_ticket` for limits/fees/tax — one function stays the single enforcement point, which is the design that already works here
