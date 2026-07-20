# Orders Management module — design spec

**Date:** 2026-07-20
**Area:** `orders` (new workspace area)
**Status:** Approved for planning

## 1. Goal

Add a fully-fledged **Order Management** module to Geiger Events as a new top-level
**Orders** sidebar item with six sub-items. It becomes the *operational cockpit* for
everything that happens to an order after checkout — viewing orders, issuing full and
partial refunds, cancellations, a money ledger, receipts/invoices, and dispute
tracking.

The existing thin **Tickets → Refunds** (refund policy + status-only inbox) and
**Tickets → Orders & Attendees** (reusable order *policies* + read-only orders list)
screens **stay as-is** — they remain the *config/policy* surfaces. The new Orders
module is the *operations* surface. This mirrors the suite's config-vs-operations
split and is non-destructive.

## 2. Scope decisions (locked)

1. **Overlap:** New operational cockpit; leave the Tickets Refunds / Orders &
   Attendees / Transfers / Invoices screens untouched as config.
2. **Sub-items:** Full six-screen module (All Orders, Refunds & Cancellations,
   Transactions, Billing & Receipts, Disputes & Chargebacks, Order Settings).
3. **Refund execution:** Record/status-only with a clearly-marked Stripe-ready hook.
   Issuing a refund records amount + reason, flips derived order status, and writes a
   timeline entry. A real `stripe.refunds.create` call is left as a future server
   route; the SQL/data layer only records.
4. **Persistence:** Add new `order_refunds` + `order_events` (+ `order_disputes`)
   tables and a `refunded_total`/`cancelled_at` on `event_orders`; reuse existing
   tables where they fit. Transactions ledger is derived client-side (no new table).

## 3. Navigation & registry

New top-level sidebar item **Orders** (`ShoppingBag` icon), placed immediately after
**Tickets** in `components/internal/sidebar/sidebar_nav.jsx`.

Registry keys must be globally unique (the registry maps title → component), so the
operational screens use names distinct from the kept Tickets config screens:

| Sub-item (registry key) | Icon | Component | Purpose |
|---|---|---|---|
| **All Orders** | `ShoppingBag` | `AllOrdersScreen` | Cross-event orders table + detail drawer. Top-level `Orders` key also routes here (like `Workflows` → `AllWorkflowsScreen`). |
| **Refunds & Cancellations** | `RotateCcw` | `RefundsCenterScreen` | Order-linked refund/cancel queue; full & partial refunds. Distinct from Tickets → "Refunds" (policy). |
| **Transactions** | `ArrowLeftRight` | `TransactionsScreen` | Money ledger — charges + refunds merged, with fees/net. |
| **Billing & Receipts** | `Receipt` | `BillingReceiptsScreen` | Generate/resend receipts & invoices per order. Distinct from Tickets → "Invoices & Receipts" (invoice profiles). |
| **Disputes & Chargebacks** | `Scale` | `DisputesScreen` | Track disputes: status, amount, evidence-due, linked order. |
| **Order Settings** | `Settings` | `OrderSettingsScreen` | Module-level ops config: order-number format, reason codes, receipt footer, default policy. |

Register all keys in `components/internal/screens/registry.jsx`. Map both `Orders`
and `All Orders` to `AllOrdersScreen`.

## 4. Data model

New file `supabase/sqls/zzz_orders_management.sql` — self-contained, idempotent, and
named `zzz_` so it runs **after** `orders.sql` and `zz_project_access.sql` (which
redefines `buy_ticket`). All objects live in the `events` schema.

### 4.1 `events.event_orders` additions
- `alter table events.event_orders add column if not exists refunded_total numeric(14,2) not null default 0;`
- `alter table events.event_orders add column if not exists cancelled_at timestamptz;`

`buy_ticket()` is **not** modified. Display status is **derived** in the data layer:
`cancelled_at` set → **Cancelled**; open dispute → **Disputed**;
`refunded_total >= total` → **Refunded**; `refunded_total > 0` → **Partially
refunded**; else → **Paid** (the stored `status` default `confirmed` maps to Paid).

### 4.2 `events.order_refunds`
`id uuid pk`, `order_id uuid → events.event_orders(id) on delete cascade`,
`event_id uuid`, `project_id uuid`, `amount numeric(14,2)`, `reason text`,
`reason_code text`, `method text` (original/credit/manual),
`status text default 'Requested'` (Requested/Approved/Denied/Issued),
`notes text`, `created_by uuid`, `metadata jsonb default '{}'`,
`created_at/updated_at timestamptz default now()`, `deleted_at timestamptz`.
Index on `(project_id, created_at desc)` and `(order_id)`. RLS demo-open
(`anon, authenticated using (true)`). `updated_at` via shared
`public.flow_touch_updated_at()` trigger.

### 4.3 `events.order_events` (timeline)
`id uuid pk`, `order_id uuid`, `project_id uuid`, `type text`
(created/refund_requested/refund_issued/cancelled/receipt_sent/note/status_change/disputed),
`summary text`, `amount numeric(14,2)`, `actor text`,
`metadata jsonb default '{}'`, `created_at timestamptz default now()`.
Index on `(order_id, created_at desc)`. RLS demo-open.

### 4.4 `events.order_disputes`
`id uuid pk`, `order_id uuid`, `event_id uuid`, `project_id uuid`,
`amount numeric(14,2)`, `status text default 'Needs response'`
(Needs response/Under review/Won/Lost), `reason text`, `evidence_due_at timestamptz`,
`metadata jsonb default '{}'`, `created_at/updated_at timestamptz`,
`deleted_at timestamptz`. Index on `(project_id, created_at desc)`. RLS demo-open.

### 4.5 RPC `events.issue_order_refund(...)`
`security definer`, `set search_path = events`. Params:
`p_order_id uuid, p_amount numeric, p_reason text, p_reason_code text,
p_method text, p_actor text`. In one transaction it:
1. Locks the order row (`for update`), reads `total`, `refunded_total`, `event_id`,
   `project_id`.
2. Clamps `p_amount` so `refunded_total + amount <= total`.
3. Inserts an `order_refunds` row with `status = 'Issued'`.
4. Bumps `event_orders.refunded_total`; sets `status = 'refunded'` when fully
   refunded (kept for back-compat; UI still derives display status).
5. Reduces `events.events.revenue` by the refunded amount.
6. Inserts an `order_events` row (`type = 'refund_issued'`, `amount`, `summary`).
Returns `(ok, refund_id, refunded_total, order_total)`.
A comment marks the **Stripe-ready hook**: a future server route calls
`stripe.refunds.create` *then* this RPC (or this RPC first, then Stripe, reconciled
by webhook). SQL records only — no external call here.

## 5. Data layer (`lib/supabase/`)

Follow `SUPABASE_CONVENTIONS.md`: guard every call with `isSupabaseConfigured()`,
`try/catch`, `console.error` on failure, return `null/[]/false`, never throw/toast,
`normalize*` (snake→camel, spread `metadata`) and `toRow` (camel→snake, emit key only
when present).

- **Extend `orders.js`:** add `getOrder(id)` and `cancelOrder(id)` (sets
  `cancelled_at`, writes an `order_events` `cancelled` entry). `normalizeOrder` gains
  `refundedTotal`, `cancelledAt`, and a derived `displayStatus`.
- **New `order_refunds.js`:** `listOrderRefunds(projectId)`,
  `listRefundsForOrder(orderId)`, `issueRefund({...})` (calls the RPC),
  `updateRefundStatus(id, status)`, `softDeleteOrderRefund(id)`, `normalizeOrderRefund`.
- **New `order_events.js`:** `listOrderEvents(orderId)`, `addOrderEvent({...})`,
  `normalizeOrderEvent`.
- **New `order_disputes.js`:** `listDisputes(projectId)`, `createDispute`,
  `updateDispute`, `softDeleteDispute`, `normalizeDispute`.

## 6. Screens (`components/internal/screens/orders/`)

Built from the shared kit (`ScreenHeader`, `StatsBar`/`StatGrid`, `Toolbar` +
`SearchInput`, `FilterDropdown`, `DataTable`, `StatusPill`, `EmptyState`,
`SectionCard`, `Field`, `SettingsList`/`SettingRow`) and shadcn primitives. Semantic
color tokens only. Every list has loading, empty, and filtered-empty states.
Mutations are optimistic + persisted + `toast`. Data is fetched from the data layer
on mount (start empty + loading); nothing is seeded from a static array. Uses
`useProject()` for `projectId` like the reference screens.

- **`all_orders.jsx` — `AllOrdersScreen`**
  - StatsBar: gross revenue, net revenue (gross − refunded), orders count,
    refunded total, average order value. `useMemo` over fetched orders.
  - Toolbar: `FilterDropdown`s (status, event, date range) + `SearchInput`
    (name/email/event). `filtered` via a single `useMemo`.
  - `DataTable` columns: order (buyer + email meta line), event, items
    (`ticket ×qty`), total (right-aligned), `StatusPill` (derived status), date, and
    a row-actions `DropdownMenu` (View, Issue refund, Cancel, Resend receipt) wrapped
    in a `stopPropagation` div.
  - Row click opens **`order_detail_drawer.jsx`** — a shadcn `Sheet`/`Dialog`
    showing buyer, line items decomposed from the order + `metadata` bag (ticket,
    add-ons/offerings, purchasables, donation, discount, fees, tax → total), payment
    refs (method, Stripe session/intent ids), the **order timeline**
    (`listOrderEvents`), and actions: **Issue refund** (full/partial dialog with
    amount + reason code + method → `issueRefund`), **Cancel order** (`cancelOrder`),
    **Resend receipt** (writes a `receipt_sent` timeline entry + toast), **Add note**
    (writes a `note` timeline entry).

- **`refunds_center.jsx` — `RefundsCenterScreen`**
  - Cross-event refund queue over `order_refunds` joined to orders. StatsBar
    (pending, issued, refunded total, refund rate). Filters (status), search.
    Row actions: Approve/Deny (`updateRefundStatus`), Issue (opens the same refund
    dialog). Also surfaces buyer-submitted `refund_requests` (existing table) as
    incoming requests to action.

- **`transactions.jsx` — `TransactionsScreen`**
  - Ledger derived client-side by merging orders (charge lines, positive) and
    `order_refunds` (refund lines, negative) into one time-sorted list. Columns:
    date, type (`TRANSACTION_TYPE_MAP` — Charge/Refund), buyer/event, method,
    gross, fee (est.), net. StatsBar (gross charged, refunded, net, fees). Filters
    (type, event), search. Read-only reconciliation view.

- **`billing_receipts.jsx` — `BillingReceiptsScreen`**
  - Per-order documents list (one receipt per paid order; invoice on request).
    Actions: Resend receipt, Generate invoice (writes a `receipt_sent`/`invoice`
    timeline entry + toast; no PDF backend in v1 — clearly a client-side action with
    a hook comment). Uses the Order Settings receipt footer.

- **`disputes.jsx` — `DisputesScreen`**
  - Table over `order_disputes`. StatsBar (open, needs-response, won, lost).
    Create-dispute dialog (link an order, amount, reason, evidence-due). Row actions:
    change status, open linked order. `DISPUTE_STATUS_MAP` colors.

- **`order_settings.jsx` — `OrderSettingsScreen`**
  - Uses the existing settings-screen kit (`tickets/settings_kit.jsx`
    `SettingsScreen`, as `tickets/refunds.jsx` does) with `module="orders"`, so it
    persists through `ticketing_settings`. Config fields: order-number format/prefix,
    default refund reason codes, refund methods enabled, receipt footer text, default
    refund policy summary.

- **`order_detail_drawer.jsx`** — shared drawer used by All Orders (and openable from
  Refunds/Transactions/Disputes via `?order=<id>`).

- **`constants.js`** — `ORDER_STATUS_MAP` (Paid `emerald`, Partially refunded
  `amber`, Refunded `zinc`, Cancelled `red`, Disputed `orange`), `REFUND_STATUS_MAP`
  (Requested/Approved/Denied/Issued), `REFUND_REASON_OPTIONS` (Duplicate, Requested
  by customer, Event cancelled, Fraudulent, Other), `REFUND_METHOD_OPTIONS` (Original
  payment, Store credit, Manual), `TRANSACTION_TYPE_MAP`, `DISPUTE_STATUS_MAP`,
  `currency`, `formatDate`.

## 7. Permissions

Add `view.*` entries to `WORKSPACE_PERMISSIONS` in `lib/rbac.js` for the six titles,
grouped under **Orders**. Advisory gating only (default-allow when no roles are
configured, per `roleHasPermission`). Check the key where the nav renders, consistent
with existing tabs.

## 8. Non-goals (v1)

- No live Stripe refund/dispute API calls (hook left for a future server route).
- No PDF generation backend for invoices/receipts (client action + timeline entry).
- No changes to `buy_ticket()` or the existing Tickets config screens.
- No new auth/RLS model — reuse the existing demo-open policies.

## 9. Build order

1. SQL: `supabase/sqls/zzz_orders_management.sql`; run `npm run db:push`.
2. Data layer: extend `orders.js`; add `order_refunds.js`, `order_events.js`,
   `order_disputes.js`.
3. Constants + shared `order_detail_drawer.jsx`.
4. Screens: All Orders → Refunds & Cancellations → Transactions → Billing & Receipts
   → Disputes → Order Settings.
5. Nav (`sidebar_nav.jsx`) + registry (`registry.jsx`) wiring.
6. Permissions (`lib/rbac.js`).
7. `npx eslint` clean on all changed files.

## 10. Quality bar

Per `crafting.md`: reuse the shared kit before bespoke layout; three list states
everywhere; optimistic mutations with `toast` + reconcile; real `crypto.randomUUID()`
optimistic ids; semantic tokens only; dropdowns/drawers visibly elevated; lint clean.
