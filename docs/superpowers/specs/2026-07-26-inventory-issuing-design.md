# Inventory Issuing — Design

Date: 2026-07-26
Status: approved, ready to implement

## Problem

Inventory items are project-wide catalog rows. `events.inventory_allocations`
already commits an item to an event and carries an issuance mode
(`internal | ticket | addon`), and `lib/inventory/demand.js` projects demand from
ticket and add-on sales. But stock only leaves in bulk via `issueAllocation()` —
there is no record of **which buyer received what**, no staff-facing hand-out
surface, no staff codes for issuers, and only three ways to decide who is
entitled.

This design adds per-buyer entitlement, a redemption ledger, an anonymous
staff-facing issuing route, two organiser screens, add-on selling backed by real
stock, and a buyer-facing view of what they can collect.

## Core principle

**Entitlements are derived, never stored.** This mirrors the module's existing
philosophy: `inventory_items.on_hand` is derived from an append-only movement
ledger. Here, who-is-entitled-to-what is computed on demand from the allocation's
rules evaluated against the buyer's order/registration. The only new stored
artifact is the **redemption ledger** — the record of what was actually handed
over.

Consequence: editing an allocation's rule instantly changes every buyer's
entitlement. No materialised rows, no backfill when someone buys later, no stale
state. The cost is rule evaluation per scan, which is cheap because it is
per-subject, not per-list.

## 1. Schema — `supabase/sqls/zzzz_inventory_issuing.sql`

Self-contained and idempotent, per `SUPABASE_CONVENTIONS.md`. Runs after
`inventory.sql`, `orders.sql`, `checkin.sql` and `zz_project_access.sql` by
filename order.

### 1.1 New table: `events.inventory_redemptions`

| Column | Notes |
|---|---|
| `id uuid pk` | |
| `project_id uuid`, `event_id uuid not null`, `allocation_id uuid not null` | |
| `item_id uuid not null` | the **variant actually handed over**, not the allocation's parent item |
| `subject_kind text` | `order` \| `registration` \| `walkup` |
| `order_id uuid`, `registration_id uuid` | nullable; both null for walk-ups |
| `subject_key text not null default ''` | order/registration id as text, or `lower(email)`; `''` for walk-ups |
| `attendee_name`, `attendee_email text` | denormalised for the ledger view |
| `period_key text not null default ''` | `''` \| `YYYY-MM-DD` \| window id |
| `qty numeric not null default 1` | |
| `movement_id uuid` | the stock movement this wrote |
| `status text not null default 'issued'` | `issued` \| `returned` \| `voided` |
| `override boolean`, `override_reason text` | |
| `issued_by text`, `role_id uuid` | staff role name + id |
| `method text default 'scan'` | `scan` \| `search` \| `manual` \| `walkup` |
| `created_at timestamptz` | |

Double-collection is prevented **in the database**, not in UI logic:

```sql
create unique index inventory_redemptions_subject_uidx
  on events.inventory_redemptions (allocation_id, subject_key, period_key)
  where status = 'issued' and subject_key <> '' and override = false;
```

Override rows are deliberately excluded from the index — an override is a
recorded, intentional second issue.

Rolling intervals and total caps have no stable key, so they are enforced by
count/time checks inside the redeem RPC rather than by index.

### 1.2 Extended: `events.inventory_allocations`

Added via `alter table ... add column if not exists`:

- `period_mode text not null default 'none'` — `none | day | window | rolling`
- `period_config jsonb not null default '{}'` —
  `{ windows: [{ id, label, startAt, endAt }], intervalHours, totalCap }`
- `session_ids jsonb not null default '[]'`
- `audience jsonb not null default '{}'` — audience spec, same shape as
  `lib/audience/resolve.js`

The `issuance` check constraint expands to
`internal | ticket | addon | session | all | audience`.

Sale configuration (publishing the item as an event add-on) lives in the existing
`config` bag as `config.sale = { published, price, cap, description }` — it needs
no indexing or constraints, so it does not warrant promotion to a column.

### 1.3 Extended: `events.checkin_staff_roles`

The `type` check constraint gains `'issue'` as a third code space, alongside
`staff` and `kiosk`. An issuing code cannot open `/door` or `/kiosk`, and vice
versa — the existing `checkin_validate_code(p_event, p_code, p_type)` already
enforces this separation.

Issue-role permissions (in the existing `permissions` jsonb):
`{ canIssue, canReturn, canOverride, allocationIds[] }`.

## 2. Resolution RPCs

Staff devices are anonymous, so this follows `checkin_routes.sql` exactly:
`SECURITY DEFINER` functions, each gated on a valid per-event access code, granted
to `anon, authenticated`.

| Function | Purpose |
|---|---|
| `issue_actor(event, code)` | Who is calling and what may they do. Two paths, one answer: an `issue` access code (anonymous staff device), or a signed-in organiser of the event's project (so the workspace can undo/issue by hand without minting a code). The member path also requires `auth.uid()`, because `can_access_project()` treats an org-less project as open and would otherwise let anon skip the code. |
| `issue_lookup(event, code, query)` | Search orders **and** registrations by name, email, ticket code or order ref. Ticket code is the existing convention: first 8 hex of the id, upper-cased; a scanned full order uuid also matches. |
| `issue_allocations(event, code)` | Open allocations with their variants, for walk-up issuing where there is no subject. |
| `issue_entitlements(event, code, subject_kind, subject_id)` | Evaluate every open allocation against the subject. Returns allocation, item, entitled qty, active period + label, redeemed qty, remaining, block reason, and available variants with per-variant on-hand. |
| `issue_redeem(event, code, allocation, subject…, item, qty, period_key, override, reason, staff, method)` | **Re-derives entitlement server-side** — never trusts the client. Enforces period/cap/uniqueness, then writes the negative movement and the redemption row in one transaction. Returns `{ ok, already, redemptionId, movementId, remaining }`. |
| `issue_undo(event, code, redemption)` | Marks the row `returned` and writes a compensating positive movement. Requires `canReturn`. |
| `issue_stats(event, code)` | Header counts: issued today, unique collectors, per-allocation collected vs entitled. |
| `issue_entitlements_for_order(order)` | The buyer's own view for the members portal. Takes no code — the portal authenticates buyers with its own cookie session, so ownership is checked in the API route and this function is granted **only to `service_role`**, with `EXECUTE` revoked from `PUBLIC`. |

A role's `permissions.allocationIds` scope is enforced inside `issue_redeem`, not
merely displayed, and filters `issue_entitlements` / `issue_allocations` — the
client chooses the allocation, so an unenforced scope would be decoration.

### 2.1 Entitlement rules

| Mode | Qualifies when |
|---|---|
| `internal` | Never offered against a subject — walk-up issue only. |
| `ticket` | The order's tier id is in `allocation.ticket_ids`. Tier id is read from `order.metadata->>'tierId'`, falling back to matching `ticket_name` against the event's `metadata.tickets` for orders that predate it. |
| `addon` | `order.metadata->'purchasables'` contains the allocation's `purchasable_id`. Entitled = entry quantity × (`perAttendee` ? order quantity : 1) × `qty_per_attendee`. |
| `session` | The subject's recorded session picks intersect `allocation.session_ids`. **See §6 — this depends on session picks being captured.** |
| `all` | Any live order or registration for the event. |
| `audience` | The audience spec matches, evaluated over the primitives an order carries: ticket ids, purchasable ids, and the spec's include/exclude email lists. **Fails closed** — a spec filtering on tags or a segment (which live in the contacts/segments tables and can't be read here) entitles nobody rather than silently entitling everyone who passes the remaining facets. The allocate dialog warns when a spec uses them. |

### 2.2 Periods

| Mode | `period_key` | Enforcement |
|---|---|---|
| `none` | `''` | unique index (one per subject, ever) |
| `day` | `YYYY-MM-DD` | unique index; must fall within the event's start/end dates |
| `window` | the window id | unique index; blocked when `now()` is outside every window |
| `rolling` | `''` | blocked when a redemption exists within `intervalHours` |

`period_config.totalCap`, when set, caps lifetime redemptions in every mode.

## 3. Staff portal — `app/issue/[eventId]/page.js`

Reuses `AccessGate` (`codeType="issue"`, `require="canIssue"`) and `QrScanner`
from `components/checkin_routes/`.

Flow: scan or search → subject card (name, ticket, order) → entitlement list with
item photos, entitled/remaining and the active period → **variant picker showing
live per-size on-hand** → confirm → success screen with a 30-second undo.

- An already-collected entitlement shows *when* and *by whom* and refuses. A role
  with `canOverride` can force a second issue, recorded as an override with a
  reason.
- Walk-up mode issues against an allocation with no attendee attached.
- A recent-redemptions list per device supports quick undo.

## 4. Organiser screens

Two new screens under Inventory, registered in `registry.jsx` against exact
`sidebar_nav.jsx` titles:

- **Item Issuing** (`issuing_desk.jsx`) — stats bar (issued today, collected vs
  entitled, unique collectors, overrides), live redemption feed as a `DataTable`,
  filters by event/allocation/staff/status, manual issue and undo.
- **Issuing Staff** (`issuing_staff.jsx`) — create/revoke issue-type roles, set
  permissions and allocation scope, and share the `/issue/<event>?code=` link and
  QR. Mirrors `staff_scanning_roles.jsx`.

`event_allocations.jsx` is extended with the new issuance bases, a period editor,
and a **Sell as add-on** panel.

Both screens follow the shared kit and the three list states per `crafting.md`.

## 5. Selling an item as an add-on

Publishing from an allocation writes a record into the event's
`metadata.purchasables` (via the existing shallow-merge meta RPC):
`{ id, name, price, priceType, description, stock, inventoryItemId, allocationId }`.

The event page's existing purchasable UI sells it; `buy_ticket` stores the choice
on the order; the allocation (`issuance='addon'`, matching `purchasable_id`) makes
the buyer entitled.

**Stock timing:** a sale *reserves* — on-hand is unchanged, available-to-promise
drops. The negative movement is written only when staff hand the item over. So
on-hand always matches what is physically on the shelf.

`reserved = purchasables sold − redemptions issued`, derived, not stored.
`availableToPromise = on_hand − reserved`.

## 6. Known dependency: session picks

Nothing currently records which sessions an attendee will attend. Sessions exist
as `events.conference_records` with `module='session'`; `agenda_pin` is a reserved
module name that nothing writes yet.

The `session` issuance mode therefore reads the subject's picks from one
documented location — `order.metadata.sessions` / `registration.metadata.sessions`
(an array of session ids) — and matches them against `allocation.session_ids`. The
mode is fully built and will start returning entitlements the moment session picks
are captured there. Until then it resolves to no entitlement rather than failing.
This is stated rather than silently assumed.

## 7. Supporting change

`buyTicket()` in `lib/supabase/orders.js` will write `tierId` onto the order
metadata. Today only the ticket *name* is stored, so ticket-based matching would
break when a tier is renamed. One line; old orders keep working via the name
fallback described in §2.1.

## 8. JS layer

| File | Role |
|---|---|
| `lib/supabase/inventory_issuing.js` | Data layer: RPC wrappers + redemption reads for the workspace. Pure — returns `null`/`false`/`[]`, never throws, never toasts. |
| `lib/inventory/entitlements.js` | Pure helpers: period keys and labels, availability/reservation math. No React, no DB — mirrors `demand.js`. |
| `lib/supabase/issuing.js` | Anon-route wrappers for the `/issue` portal, mirroring `lib/supabase/checkin.js`. |

## 9. Build order

1. SQL migration (§1, §2)
2. Data layer + pure helpers (§8) + the `tierId` change (§7)
3. Staff portal route (§3)
4. Issuing staff & codes screen (§4)
5. Issuing desk screen (§4)
6. Allocations screen extensions (§1.2, §5)
7. Buyer portal entitlements (§5 buyer view)

Each slice is independently reviewable. `npx eslint` clean per slice;
`npm run db:push` after slice 1.

## Out of scope

- Offline/queued redemption on a disconnected device
- Printed vouchers or barcode stock labels
- Transfers of entitlement between buyers
