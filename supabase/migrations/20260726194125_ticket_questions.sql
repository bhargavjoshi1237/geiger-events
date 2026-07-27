-- ===========================================================================
-- Geiger Events — ticket-based questions
--
-- Self-contained and idempotent: safe to run repeatedly. Adds a normalized,
-- relational question bank asked per attendee when a specific ticket type is
-- purchased (collected BEFORE payment):
--   • events.ticket_questions          — one row per question (the bank)
--   • events.ticket_question_answers   — one row per (question × seat)
-- The ticket → questions pairing is an ORDERED id array on the ticket record's
-- config bag (events.ticketing_records.config.questionIds), so no join table.
--
-- Public buyers reach these through SECURITY DEFINER RPCs (like register /
-- buy_ticket) so they can read only a ticket's own questions and write answers
-- without a project-member session.
--
-- Runs after events.sql (touch_updated_at) and ticketing.sql (ticketing_records).
-- Project scoping RLS is finalized in zz_project_access.sql.
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

-- --- Question bank ---------------------------------------------------------
create table if not exists events.ticket_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  label text not null default 'Untitled question',
  -- text | textarea | number | email | select | checkbox
  type text not null default 'text',
  -- choices for a `select` (array of strings)
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.ticket_questions add column if not exists options jsonb not null default '[]'::jsonb;
alter table events.ticket_questions add column if not exists required boolean not null default false;
alter table events.ticket_questions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.ticket_questions add column if not exists deleted_at timestamptz;

create index if not exists events_ticket_questions_project_idx
  on events.ticket_questions (project_id) where deleted_at is null;

drop trigger if exists ticket_questions_touch_updated_at on events.ticket_questions;
create trigger ticket_questions_touch_updated_at
before update on events.ticket_questions
for each row execute function events.touch_updated_at();

-- --- Answers (one row per question × seat) ---------------------------------
create table if not exists events.ticket_question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references events.ticket_questions(id) on delete set null,
  project_id uuid,
  event_id uuid references events.events(id) on delete cascade,
  -- The ticket TYPE the questions came from (questions are a type rule).
  ticket_type_id uuid references events.ticketing_records(id) on delete set null,
  -- Which event ticket entry (metadata.tickets[].id) the answer was collected
  -- for — multiple tickets can share a type, so this disambiguates.
  ticket_ref uuid,
  seat_index int not null default 0,
  value jsonb,
  -- Set once the registration is filed (immediately for free, on the paid return).
  registration_id uuid references events.registrations(id) on delete set null,
  -- Correlates pre-payment inserts with the eventual order (paid path).
  client_ref uuid,
  created_at timestamptz not null default now()
);

alter table events.ticket_question_answers add column if not exists project_id uuid;
alter table events.ticket_question_answers add column if not exists ticket_ref uuid;
alter table events.ticket_question_answers add column if not exists registration_id uuid references events.registrations(id) on delete set null;
alter table events.ticket_question_answers add column if not exists client_ref uuid;

create index if not exists events_ticket_answers_project_idx on events.ticket_question_answers (project_id);
create index if not exists events_ticket_answers_event_idx on events.ticket_question_answers (event_id);
create index if not exists events_ticket_answers_registration_idx on events.ticket_question_answers (registration_id);
create index if not exists events_ticket_answers_client_ref_idx on events.ticket_question_answers (client_ref);

-- --- RLS (open demo policy; org-scoped later in zz_project_access.sql) ------
alter table events.ticket_questions enable row level security;
drop policy if exists events_ticket_questions_demo_all on events.ticket_questions;
create policy events_ticket_questions_demo_all on events.ticket_questions
  for all to anon, authenticated using (true) with check (true);

alter table events.ticket_question_answers enable row level security;
drop policy if exists events_ticket_answers_demo_all on events.ticket_question_answers;
create policy events_ticket_answers_demo_all on events.ticket_question_answers
  for all to anon, authenticated using (true) with check (true);

-- --- Public RPCs (SECURITY DEFINER) ----------------------------------------

-- Only the questions attached to a ticket, in the ticket's questionIds order.
-- Safe public read: never exposes the rest of the project's bank.
create or replace function events.public_ticket_questions(p_ticket_id uuid)
returns table (
  id uuid,
  label text,
  type text,
  options jsonb,
  required boolean,
  sort_order int
)
language sql
stable
security definer
set search_path = events, public
as $$
  select q.id, q.label, q.type, q.options, q.required, ord.ordinality::int
  from events.ticketing_records t
  cross join lateral jsonb_array_elements_text(
    coalesce(t.config -> 'questionIds', '[]'::jsonb)
  ) with ordinality as ord(qid, ordinality)
  join events.ticket_questions q
    on q.id = ord.qid::uuid and q.deleted_at is null
  where t.id = p_ticket_id and t.deleted_at is null
  order by ord.ordinality;
$$;

-- Insert one answer row per element of p_answers ({questionId, seatIndex, value}).
-- p_ticket_type_id is the applied TYPE (questions are a type rule); each insert is
-- guarded so the questionId must belong to that type's questionIds. p_ticket_ref
-- records which event ticket entry the answer came from. Old 5-arg signature is
-- dropped so callers resolve to this one.
drop function if exists events.save_ticket_answers(uuid, uuid, uuid, uuid, jsonb);

create or replace function events.save_ticket_answers(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_registration_id uuid,
  p_client_ref uuid,
  p_ticket_ref uuid,
  p_answers jsonb
)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  a jsonb;
  n integer := 0;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return 0;
  end if;

  select project_id into v_project
  from events.ticketing_records
  where id = p_ticket_type_id;

  for a in select * from jsonb_array_elements(p_answers)
  loop
    -- Guard: the question must belong to this ticket type.
    if not exists (
      select 1 from events.ticketing_records t
      where t.id = p_ticket_type_id
        and t.config -> 'questionIds' ? (a ->> 'questionId')
    ) then
      continue;
    end if;

    insert into events.ticket_question_answers
      (question_id, project_id, event_id, ticket_type_id, ticket_ref, seat_index,
       value, registration_id, client_ref)
    values (
      (a ->> 'questionId')::uuid,
      v_project,
      p_event_id,
      p_ticket_type_id,
      p_ticket_ref,
      coalesce((a ->> 'seatIndex')::int, 0),
      a -> 'value',
      p_registration_id,
      p_client_ref
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Attach pre-payment answers to the registration filed on the paid return trip.
create or replace function events.link_ticket_answers(
  p_client_ref uuid,
  p_registration_id uuid
)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  n integer;
begin
  if p_client_ref is null or p_registration_id is null then
    return 0;
  end if;
  update events.ticket_question_answers
    set registration_id = p_registration_id
    where client_ref = p_client_ref and registration_id is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Resolve an event's tickets (metadata.tickets entries) against their applied
-- types so the anonymous storefront can see rules that live in the member-only
-- ticketing_records table. Returns a jsonb array: each ticket entry merged with a
-- resolved `rules` object and `questionIds`. Only non-Private, non-deleted events;
-- only ticket_type rows are joined.
create or replace function events.public_event_tickets(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select coalesce(jsonb_agg(
    ord.t || jsonb_build_object(
      'rules', case when ty.id is not null then jsonb_build_object(
        'refund', ty.config -> 'refund',
        'sales', ty.config -> 'sales',
        'visibility', coalesce(ty.config ->> 'visibility', 'public'),
        'onSaleAt', ty.config ->> 'onSaleAt',
        'accessCode', ty.config -> 'accessCode',
        'reservedSeating', ty.config -> 'reservedSeating',
        'minPerOrder', ty.config -> 'minPerOrder',
        'maxPerOrder', ty.config -> 'maxPerOrder'
      ) else '{}'::jsonb end,
      'questionIds', coalesce(ty.config -> 'questionIds', '[]'::jsonb)
    )
    order by ord.ordinality
  ), '[]'::jsonb)
  from events.events e
  cross join lateral jsonb_array_elements(
    coalesce(e.metadata -> 'tickets', '[]'::jsonb)
  ) with ordinality as ord(t, ordinality)
  left join events.ticketing_records ty
    on ty.id = nullif(ord.t ->> 'ticketTypeId', '')::uuid
   and ty.module = 'ticket_type' and ty.deleted_at is null
  where e.id = p_event_id and e.deleted_at is null and e.visibility <> 'Private';
$$;

grant execute on function events.public_ticket_questions(uuid) to anon, authenticated;
grant execute on function events.save_ticket_answers(uuid, uuid, uuid, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function events.link_ticket_answers(uuid, uuid) to anon, authenticated;
grant execute on function events.public_event_tickets(uuid) to anon, authenticated;
