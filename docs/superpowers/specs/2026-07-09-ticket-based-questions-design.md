# Ticket-based Questions (collected before payment) — Design

Date: 2026-07-09
Status: Approved (build directly, no separate plan-approval gate)

## Problem

Custom fields today are **event-scoped**: the event's "Custom Questions" and its
attached Registration Form ask one shared question set regardless of which ticket
the buyer picks, and answers land in the registration's label-keyed `answers` bag.
There is no way to ask questions **for a specific ticket type** (e.g. "T-shirt
size" only for VIP), and no per-attendee capture.

We want: an organizer defines questions **on a ticket type**, with a response
type; when a buyer purchases that ticket the questions are asked **before paying**,
**once per seat**, and the answers are **saved** in a normalized, relational shape.

## Decisions (from brainstorming)

- **Authoring:** on the ticket type, **additive** — a ticket's questions show in
  addition to the event's existing custom questions.
- **Cardinality:** **once per attendee/seat** — buying N of a ticket asks the
  question set N times.
- **Ticket kinds:** **both free and paid** — collected before `buy_ticket` (free)
  and before the Stripe handoff (paid).
- **Persistence (explicit user requirement):** **normalized/relational**, not a
  JSON blob. Questions live in their **own table** and are referenced by `id`.
  A ticket references its questions as an **ordered array of question ids**. Each
  answer row references the question by `id`. No answer is ever stored under a
  text key.

## Data model (schema: `events`)

### `events.ticket_questions` — the question bank

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `project_id` | uuid → `public.projects(id)` on delete cascade | workspace scope |
| `label` | text | question text |
| `type` | text | `text \| textarea \| number \| email \| select \| checkbox` |
| `options` | jsonb default `[]` | choices for `select` (array of strings) |
| `required` | boolean default false | |
| `created_by` | uuid → `auth.users(id)` on delete set null | |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | soft delete |

### Ticket → questions pairing (no new table)

Stored on the existing ticket-type record (`events.ticketing_records`,
`module='ticket_type'`) as an **ordered id array** in its `config` bag:
`config.questionIds = [uuid, …]`. The event already references the ticket via
`event.metadata.attached.ticket_type[]`, so the chain is
**event → attached ids → ticket → `questionIds` → question rows**.

### `events.ticket_question_answers` — normalized answers (one row per question × seat)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `question_id` | uuid → `events.ticket_questions(id)` on delete set null | the referenced question |
| `project_id` | uuid | denormalized for organizer scoping / future RLS |
| `event_id` | uuid → `events.events(id)` on delete cascade | |
| `ticket_type_id` | uuid → `events.ticketing_records(id)` on delete set null | |
| `seat_index` | int default 0 | 0..qty-1 (per attendee) |
| `value` | jsonb | string \| number \| bool \| array |
| `registration_id` | uuid → `events.registrations(id)` on delete set null | linked after the registration is filed |
| `client_ref` | uuid | correlates pre-payment inserts to the eventual order |
| `created_at` | timestamptz | |

Indexes: `(project_id)`, `(event_id)`, `(registration_id)`, `(client_ref)`.

### RPCs (`SECURITY DEFINER`, granted to `anon, authenticated`)

Public buyers can't read the whole bank or write under the (eventual) org-scoped
RLS, so the public paths go through definer RPCs (mirrors `register`/`buy_ticket`):

- `events.public_ticket_questions(p_ticket_id uuid)` → returns only the questions
  attached to that ticket (`id, label, type, options, required, position`), ordered
  by the `questionIds` array position. Safe public read.
- `events.save_ticket_answers(p_event_id, p_ticket_type_id, p_registration_id,
  p_client_ref, p_answers jsonb)` → inserts one row per element of `p_answers`
  (`{ questionId, seatIndex, value }`). Guards each insert: the `questionId` must
  be present in that ticket's `config.questionIds`. Stamps `project_id` from the
  ticket. Returns the inserted count.
- `events.link_ticket_answers(p_client_ref, p_registration_id)` → sets
  `registration_id` on rows matching `client_ref` (used on the paid return trip).

RLS: enable on both tables with the open demo policy (`for all to anon,
authenticated using (true)`), consistent with `ticketing.sql`; org-scoping is
finalized later in `zz_project_access.sql`.

## Data layer — `lib/supabase/ticket_questions.js`

Pure, guarded, snake↔camel at the boundary (mirrors `ticketing.js`/`registrations.js`):

- Organizer (direct table, RLS-governed): `listQuestions(projectId)`,
  `getQuestionsByIds(ids)` (order not guaranteed — caller reorders),
  `createQuestion(input)` (honors caller `id`), `updateQuestion(id, patch)`,
  `softDeleteQuestion(id)`.
- Public (RPCs): `getPublicTicketQuestions(ticketId)`,
  `saveTicketAnswers({ eventId, ticketTypeId, registrationId?, clientRef?, answers })`,
  `linkTicketAnswers(clientRef, registrationId)`.
- Organizer read (for a future answers view): `listTicketAnswersByEvent(eventId)`.

## Authoring UI

New `TicketQuestionsEditor` (`tickets/ticket_questions_editor.jsx`) rendered as a
`SectionCard` inside `TicketEditForm` (`tickets/ticket_types.jsx`). Reuses the
`registration_forms` field-row pattern (label + type + options + required +
reorder arrows + remove). Behaviour:

- On mount, resolve `config.questionIds` → `getQuestionsByIds` → ordered local list.
- Add: mint a uuid, append to local list + `config.questionIds` (via functional
  `setConfig`), persist the row with `createQuestion` (immediate/optimistic,
  matching the records-kit pattern).
- Edit: update local state; persist the row on control change / input blur via
  `updateQuestion`.
- Remove: drop from `config.questionIds` + `softDeleteQuestion`.
- Reorder: reorder `config.questionIds` and local list.

`config.questionIds` persists with the ticket's normal **Save** button (rows are
already persisted). Trade-off: adding a question then leaving without Save leaves a
harmless unlinked (soft-deletable) question row; acceptable for v1.

`QUESTION_TYPE_OPTIONS` added to `tickets/constants.js`.

## Collection UI (public page, before paying)

In `event_public_page.jsx`'s checkout dialog (`step === "details"`):

- New state: `ticketQuestions` (fetched for the selected ticket), `ticketAnswers`
  (keyed `` `${seatIndex}:${questionId}` ``).
- Effect: when the dialog is open and `ticket?.id` changes, fetch via
  `getPublicTicketQuestions(ticket.id)` and reset `ticketAnswers`.
- Render, after the event custom-questions / inquiry block: for
  `seat` in `0..qty-1`, a bordered group ("Attendee N of qty" when qty > 1)
  repeating the question set. Types render as: `text/number/email` → `Input`,
  `textarea` → `Textarea`, `select` → shadcn `Select`, `checkbox` → `Checkbox`.
- Validation in `submitDetails`: every required ticket question must be answered
  for every seat (toast names the question and the attendee).

## Persistence flow (survives Stripe)

- **Free / approval:** after `buy_ticket` succeeds and the registration is filed,
  `saveTicketAnswers({ …, registrationId })` with the per-seat answer array.
  (`doRegister` returns its result so the caller can read `registration.id`.)
- **Paid:** before the Stripe redirect, mint `clientRef = crypto.randomUUID()`,
  `saveTicketAnswers({ …, clientRef })` (answers written up front), and pass only
  the small `clientRef` in the checkout body → Stripe metadata. This sidesteps the
  existing 500-char metadata cap entirely (answers never ride in metadata). On
  `verify`, after the registration is filed, `linkTicketAnswers(clientRef,
  registrationId)` stamps the rows.
- Preview (`!live`) and unconfigured DB: skip saving (no writes).

### Touched files

- `app/api/checkout/route.js` — accept `clientRef`, add to Stripe metadata.
- `app/api/checkout/verify/route.js` — capture the filed registration, call
  `linkTicketAnswers(meta.clientRef, registrationId)`.

## Non-goals (YAGNI)

Per-seat name/email capture, cross-ticket question reuse UI, conditional
"show when" logic, editing answers after purchase, and an organizer-facing answers
screen (data layer read is provided; the screen is a follow-up). The schema allows
all of these later.

## Migration / rollout

New SQL file `supabase/sqls/ticket_questions.sql` (self-contained, idempotent),
applied with `npm run db:push`. No changes to existing tables — additive only.
