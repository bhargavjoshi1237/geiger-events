# Ticket vs Ticket Type — model refactor

Date: 2026-07-09
Status: Approved (build directly)

## Problem

Today a **ticket type** (`events.ticketing_records`, `module='ticket_type'`) is
attached directly to an event (`metadata.attached.ticket_type = [ids]`). But a
ticket type is a *template of rules* — it isn't itself purchasable, and the
attach panel never surfaced on the public page (the storefront still reads a
retired `metadata.tickets` and falls back to synthesized demo tickets).

We want the real domain model:

- **Ticket Type** = a reusable, project-scoped *rule set* (refund policy, sales
  window, visibility, access code, reserved seating, questions). **Not
  purchasable.**
- **Ticket** = a purchasable item **created for a specific event**, optionally
  with a type **applied** to provide its rules. **This** is what lists on the
  public page and is bought.

## Decisions (from brainstorming)

- **Storage:** reuse `event.metadata.tickets` — a ticket is an entry in that
  array. Reuses the existing `buy_ticket` per-ticket inventory
  (`metadata.tickets[].qty` + `metadata.ticketSold`) and the public event read.
  No new table.
- **Apply = live reference:** a ticket stores only `ticketTypeId`; the type's
  rules resolve live at read/checkout. Editing a type updates every ticket using
  it. (A ticket does not copy or override rules.)
- **Type is optional:** a ticket can be plain (name/price/qty) with no type.
- **Field split:** the **ticket** owns identity — `name`, `price`, `qty`,
  `description`. The **type** owns rules — `refund`, `sales`, `visibility`,
  `onSaleAt`, `accessCode`, `reservedSeating`, `minPerOrder`, `maxPerOrder`,
  `questionIds`.

## Data shapes

### Ticket entry (`event.metadata.tickets[]`)

```
{ id: uuid, name, price: number, qty: number, description, ticketTypeId: uuid|null }
```

`id` doubles as the per-tier inventory key that `buy_ticket` already uses
(`metadata.tickets[].qty`, `metadata.ticketSold[id]`).

### Ticket Type record (`events.ticketing_records.config`, `module='ticket_type'`)

Rules only (drops `price`/`qty`/`description`):

```
{ refund, sales, visibility, onSaleAt, accessCode, reservedSeating,
  minPerOrder, maxPerOrder, questionIds: [uuid] }
```

## SQL

### `events.public_event_tickets(p_event_id uuid)` — new `SECURITY DEFINER` RPC

Resolves an event's ticket entries against their (member-only) types so the
anonymous storefront can see the rules. Returns a `jsonb` array; each element is
the ticket entry merged with a resolved `rules` object and `questionIds`. Only
for non-Private, non-deleted events; only joins `module='ticket_type'`,
non-deleted types.

```sql
create or replace function events.public_event_tickets(p_event_id uuid)
returns jsonb language sql stable security definer
set search_path = events, public as $$
  select coalesce(jsonb_agg(
    t || jsonb_build_object(
      'rules', case when ty.id is not null then jsonb_build_object(
        'refund', ty.config->'refund', 'sales', ty.config->'sales',
        'visibility', coalesce(ty.config->>'visibility','public'),
        'onSaleAt', ty.config->>'onSaleAt',
        'accessCode', ty.config->'accessCode',
        'reservedSeating', ty.config->'reservedSeating',
        'minPerOrder', ty.config->'minPerOrder',
        'maxPerOrder', ty.config->'maxPerOrder'
      ) else '{}'::jsonb end,
      'questionIds', coalesce(ty.config->'questionIds','[]'::jsonb)
    ) order by ord.ordinality
  ), '[]'::jsonb)
  from events.events e
  cross join lateral jsonb_array_elements(
    coalesce(e.metadata->'tickets','[]'::jsonb)) with ordinality as ord(t, ordinality)
  left join events.ticketing_records ty
    on ty.id = nullif(ord.t->>'ticketTypeId','')::uuid
   and ty.module = 'ticket_type' and ty.deleted_at is null
  where e.id = p_event_id and e.deleted_at is null and e.visibility <> 'Private';
$$;
grant execute on function events.public_event_tickets(uuid) to anon, authenticated;
```

### `events.ticket_question_answers` — add `ticket_ref`

A ticket references its type for questions; multiple event tickets can share a
type. Add `ticket_ref uuid` (the `metadata.tickets[].id`) so answers record which
ticket entry they came from. `save_ticket_answers` gains a `p_ticket_ref uuid`
argument (kept before `p_answers`; the old signature is dropped so callers
resolve to the new one). `p_ticket_type_id` now carries the resolved
`ticketTypeId` — the guard (`config.questionIds ? questionId`) and `project_id`
derivation already work against a type record unchanged.

## Data layer

- `lib/supabase/ticketing.js`: add `listEventTicketsResolved(eventId)` → calls
  `public_event_tickets`; **remove** the unused `listRecordsByIds`.
- `lib/supabase/ticket_questions.js`: `saveTicketAnswers` gains `ticketRef`;
  `getPublicTicketQuestions` unchanged (now called with the type id).

## UI

### Ticket Type editor (`tickets/ticket_types.jsx`, `TicketEditForm`)

Rules only. Remove the Pricing & inventory (price/qty) and the description field.
Keep: refund policy, sales window, visibility & access (incl. access code,
reserved seating), order limits (min/max per order), and the Questions editor.
Update `summarize` (rules summary, e.g. "Refundable · Public · 2 questions") and
the screen description ("Reusable rule sets you apply to an event's tickets").
`defaultTicketConfig` drops `price`/`qty`/`description`.

### Event Tickets tab (`tickets/event_tickets.jsx`, new `EventTicketsSection`)

Per-event ticket manager, persisted to `metadata.tickets` via
`useEventConfig(event, "tickets", [])`:

- List the event's tickets (name, price, qty, applied-type badge + a resolved
  rules summary from the project's fetched `ticket_type` records).
- Create/edit inline or via dialog: `name`, `price`, `qty`, `description`, and an
  optional **Apply type** `Select` (project's `ticket_type` records, "None"
  first). Mint `id` with `crypto.randomUUID()`.
- Delete + reorder.
- Carries over the existing **Dietary & Accessibility inquiry** attach card
  (moved from the retired attach panel).

`event_sections.js`: repoint `tickets: EventTicketsSection`.

### Public page (`events/event_public_page.jsx`)

- Fetch `listEventTicketsResolved(event.id)` on mount; feed `buildTickets`.
- `buildTickets(event, resolved)`: map resolved rows to
  `{ id, name, price, qty, ticketTypeId, rules }`; **filter out** `visibility:
  'hidden'`; compute a buyable flag from `sales`/`onSaleAt` (scheduled/window not
  yet open → shown but disabled). Fallback (no tickets / not configured): a single
  "Registration"/"General Admission" entry. **Remove** the synthesized Early
  Bird / GA / VIP demo set.
- Questions: fetch on selection via `getPublicTicketQuestions(ticket.ticketTypeId)`
  (was `ticket.id`); save with `ticketTypeId` + `ticketRef: ticket.id`.

## Cleanup (old logic)

- Delete `tickets/ticket_type_attachments.jsx` (its `AttachInquiryCard` moves into
  `event_tickets.jsx`).
- Drop `metadata.attached.ticket_type` reads/writes (the `attached` bag stays for
  the other modules via `TicketAttachmentsSection`).
- Remove unused `listRecordsByIds` from `ticketing.js`.
- Simplify `buildTickets` (no synthesized demo tickets).

## Non-goals (YAGNI)

Access-code **unlock** flow on the storefront, refund enforcement at checkout,
per-ticket rule overrides, and migrating any pre-existing
`attached.ticket_type` data (there are no real attached tickets in use). The
type's rules are stored and resolved; only visibility + sales-window gating are
enforced on the storefront in this pass.

## Migration

`public_event_tickets` + the `ticket_ref` column/param go into the existing
`supabase/sqls/ticket_questions.sql` (idempotent), applied with `npm run db:push`.
Additive only.
