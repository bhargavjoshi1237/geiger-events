# 00 — Platform / Cross-cutting

> Gaps that are not owned by any one sidebar section but block many of them.
> Every other file in this folder links back here.

| | |
|---|---|
| **Tier** | — (infrastructure) |
| **Blocks** | Tickets, Orders, Campaigns, Analytics, Workflows, Memberships, Registrations, Check-in, Program |

---

## 1. The seven platform holes

### H1 — There is no job runner (blocks 8 sections)

There is **no `vercel.json`, no cron config, no queue, no scheduler** anywhere in
the repo. Structurally, this makes every time-based feature impossible:

| Feature | Section | Needs |
|---|---|---|
| Automated reminders | Campaigns | scheduled send |
| Drip sequences | Campaigns | delayed steps |
| Send scheduling | Campaigns | future-dated send |
| Scheduled Reports | Analytics | recurring generate + deliver |
| Waitlist auto-promotion | Registrations | capacity-freed trigger |
| Payment plan installments | Tickets | recurring charge |
| Early-bird expiry / dynamic pricing | Tickets | time-based reprice |
| Membership renewal + dunning | Memberships | recurring charge + retry |
| Workflow delay/wait steps | Workflows | timers |

**Deliverable**
- [ ] `events.jobs` table: `id, kind, run_at, payload jsonb, status, attempts, last_error, locked_at, project_id`
- [ ] `SELECT … FOR UPDATE SKIP LOCKED` claim function so two runners can't double-execute
- [ ] `app/api/cron/tick/route.js` — claims due jobs, dispatches by `kind`, records outcome
- [ ] `vercel.ts` cron entry (per Vercel guidance, `vercel.ts` over `vercel.json`), every minute
- [ ] Retry with exponential backoff; dead-letter after N attempts
- [ ] A `Jobs` view (dev-only, or fold into Settings → Usage) so failures are visible

### H2 — There is no send stack (blocks Campaigns, Registrations, Orders, Memberships)

`package.json` contains **no email, SMS, or push provider** (no Resend, SendGrid,
Postmark, SES, Twilio). `lib/email/catalog.js` declares **61 transactional email
types; 3 are marked `live`** — the rest say "planned, no send site." Delivery is
delegated to geiger-dash.

**Deliverable**
- [ ] Decide: keep delegating to geiger-dash, or own the stack here. Document the choice at the top of `lib/email/catalog.js`
- [ ] Wire the remaining ~58 catalog entries to real send sites (order confirmation, refund issued, waitlist promoted, reminder, membership renewal…)
- [ ] A `send_log` table so Deliverability and Email Performance have data to read
- [ ] Bounce/complaint webhook → suppression list (feeds Guests → Contact Book "Blocked")
- [ ] SMS and push adapters, or **remove those channels from the Campaigns UI** — today they are selectable and do nothing

### H3 — There is no fee or tax model (blocks Tickets, Orders, Analytics)

`grep` for `serviceFee`, `bookingFee`, `taxRate`, `tax_rate` returns **nothing**.
`app/api/checkout/route.js` builds line items from ticket price + add-ons +
donation only. Taxes is a 28-line empty state.

**Deliverable**
- [ ] Fee schedule model (service fee, payment fee, facility fee), each fixed/percent, absorb-vs-pass-to-buyer
- [ ] Tax rates by jurisdiction, inclusive vs exclusive, applied per line item
- [ ] Both computed **server-side in one place** and re-derived in `events.buy_ticket` so Stripe and the order row agree (mirror how discounts already work — that pattern is correct)
- [ ] Fee/tax breakdown rendered on the public checkout, the order drawer, and the receipt

### H4 — Money can be taken but not returned (blocks Orders, Memberships)

`events.issue_order_refund` records a refund row. **No Stripe refund is created.**
Payouts is a form with no Stripe Connect behind it.

**Deliverable**
- [ ] `stripe.refunds.create` in the refund path, with the recorded row as the idempotency anchor
- [ ] Stripe Connect accounts for organizers; destination charges or transfers on sale
- [ ] Balance / next-payout / payout history reading from Stripe, not from a typed-in field

### H5 — `DataTable` has no bulk actions (degrades every list screen)

`components/internal/shared/screen_kit.jsx:440` — `DataTable` supports
`columns, data, getRowKey, onRowClick, empty` and nothing else. **No row
selection, no sorting, no pagination, no sticky header, no column visibility.**
Every list in the app (100+) inherits those gaps.

In Eventbrite, Mailchimp, or Cvent, "select 40 attendees → resend tickets" is the
single most-used interaction on a list. Here it is impossible anywhere.

**Deliverable**
- [ ] `selectable` prop → leading checkbox column, header select-all (respecting the current filter), `selectedKeys` state lifted to the screen
- [ ] `<BulkActionBar>` in the shared kit — appears docked above the table when a selection exists, shows "n selected", hosts per-screen actions, and a Clear
- [ ] `sortable` per column, with the sort state in the URL so a shared link reproduces the view
- [ ] Pagination or windowing past ~200 rows (Contact Book and Orders will hit this first)
- [ ] `stickyHeader` — long tables lose their headers today

### H6 — No webhooks, no public API (blocks Settings, integrations)

`grep webhook_endpoint` → nothing. Settings → API & Webhooks is `ComingSoon`.
Any B2B buyer expects to subscribe to `order.created` / `attendee.checked_in`.

**Deliverable**
- [ ] `events.webhook_endpoints` + `webhook_deliveries` (with retry + signature secret)
- [ ] Emit from the same server-side points that already exist: fulfillment, refund, check-in admit
- [ ] Signed payloads (HMAC), delivery log UI, replay button
- [ ] API keys with scopes (reuse `@geiger/rbac` permission keys)

### H7 — No audit log (blocks Settings, compliance)

`grep audit_log` → nothing. There is no record of who changed a price, deleted an
event, refunded an order, or altered a role. This is table stakes for any
multi-user workspace and is required for the Data Requests screen to be truthful.

**Deliverable**
- [ ] `events.audit_log`: `actor_id, action, entity_type, entity_id, before jsonb, after jsonb, project_id, created_at`
- [ ] Write from the data layer's `update*`/`softDelete*` helpers so coverage is automatic, not per-screen
- [ ] Surface as a filterable feed in Settings, and as an "Activity" tab on entity drawers

---

## 2. Cross-cutting UX & component placement

These apply to **every** screen and are cheaper to fix once in the shared kit
than 100 times in screens.

### U1 — Forty screens are visually identical

`components/internal/shared/records/records_kit.jsx:567` renders the exact same
frame for every module: `ScreenHeader → StatsBar → Toolbar(FilterDropdown… +
SearchInput) → DataTable`. Speakers, Sponsors, Livestream Rooms, Payouts,
Anti-scalping and Ad Budgets are pixel-siblings. The user cannot tell from the
layout what kind of thing they are looking at, which is a large part of why the
app reads as a shell.

**Fix — give the kit three list presentations, chosen per module:**
- `table` (default) — operational lists: orders, attendees, contacts
- `gallery` — things with a face or an image: speakers, sponsors, templates, boards
- `board` — things with a pipeline: CFP submissions, sourcing pipeline, disputes

One `mod.presentation` key; the module definitions already carry enough metadata.

### U2 — The record editor puts Delete beside Save

`records_kit.jsx:267-281` — the header's right cluster is `[Delete] [Save Changes]`,
adjacent, both full buttons. A destructive irreversible action should never be the
nearest neighbour of the primary action.

**Fix**
- Move Delete into an overflow `DropdownMenu` (`⋯`) left of Save, styled `text-red-400 focus:bg-red-500/10`, matching the row-action pattern the list already uses
- Or add a `Danger zone` panel at the bottom of the last editor section
- Require a typed confirmation for records that have dependents (a ticket type with sold tickets, a venue with events)

### U3 — The editor's section nav is on the right

`records_kit.jsx:287` uses `lg:grid-cols-[1fr_260px]` with the `<aside>` at
`order-2`. Every comparable editor in the suite (and in Cvent, Stripe, Notion)
puts section nav on the **left**, where the eye lands first and where the sidebar
already trains the user to look.

**Fix** — swap to `lg:grid-cols-[240px_1fr]`, nav first, content second; keep the
mobile order (content first) as-is.

### U4 — The save model is ambiguous

The editor exposes both `patch` (staged) and `commit` (immediate) to fields, and
also shows a `Save Changes` button. Some controls persist instantly, some don't,
and nothing tells the user which is which.

**Fix**
- Pick one model per surface and say so: settings screens auto-save with a subtle "Saved" affordance; record editors stage and require Save
- Add a dirty indicator next to the title (`• Unsaved changes`) and disable Save when clean
- Add an unsaved-changes guard on back/navigate

### U5 — Toolbar filter overload

`guests/contact_book.jsx:577` puts **four** `FilterDropdown`s plus a search field
in one `Toolbar`; `settings/team_members.jsx:918` does the same. On a laptop this
wraps into two rows and pushes the table below the fold.

**Fix**
- Beyond two filters, collapse into a single `Filters` button that opens a popover, with a chip row beneath showing active filters and an "×" per chip and a "Clear all"
- Keep search always visible, right-aligned
- Persist the filter state in the URL (`useWorkspaceUrl()` already owns the query string) so filtered views are shareable — today they are not

### U6 — Stats bars are decoration

`StatsBar` renders animated `RollingNumber`s, but the numbers are not clickable
and carry no timeframe. A KPI a user cannot act on or scope is an ornament.

**Fix**
- Make each stat a filter shortcut (clicking "Pending 12" applies `status=Pending`)
- Add one shared date-range control to `ScreenHeader.actions` on any screen whose stats are time-relative, and put the comparison in `delta`/`trend` (the props already exist and are mostly unused)

### U7 — Empty states don't distinguish "no data" from "no results"

Several screens pass the same `EmptyState` for both cases.

**Fix** — three distinct states everywhere: **loading** (skeleton rows, not a
spinner), **empty** (icon + "create the first one" primary action), and
**filtered-empty** ("No results for these filters" + "Clear filters"). This is
already in `crafting.md` as the bar; enforce it in review.

### U8 — Drawers vs. full-page editors are inconsistent

Orders, Inventory, Contacts and Registrations open a **drawer**; Tickets,
Conference and Campaigns records open a **full-page editor**. Both patterns are
fine, but the choice currently tracks who wrote the screen rather than the task.

**Fix — one rule, documented in `crafting.md`:** drawer for *inspect and act on
one record without losing your place in the list*; full page for *author a record
with many sections*. Then move Campaign editing into a drawer-with-expand, and
keep Conference rich modules full-page.
