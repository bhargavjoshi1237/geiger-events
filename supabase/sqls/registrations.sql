-- ===========================================================================
-- Geiger Events — registrations store
--
-- The workspace-level "people-coming" pipeline: one row per person per event
-- (events.registrations) plus reusable form definitions (events.registration_forms),
-- and two RPCs for the waitlist + approval flows. Separate from paid ticket
-- orders (events.event_orders) — these are the RSVP / registration records.
--
-- Self-contained and idempotent: safe to run repeatedly. Seeds demo rows against
-- the same events.events UUIDs shipped in sample_data.js so the screens have real
-- cross-event data to render.
--
-- Apply via the Supabase SQL editor (or `npm run db:push`) for the project in
-- .env.
-- ===========================================================================

create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger function (suite convention). Defined here so
-- this migration doesn't depend on the events migration having run.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reusable registration forms (field sets the per-event "Custom Questions" tab
-- and the public registration flow consume).
-- ---------------------------------------------------------------------------
create table if not exists events.registration_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled form',
  description text,
  status text not null default 'Draft',
  -- Ordered field defs: [{ id, label, type, required, options?, showWhen? }].
  -- showWhen = { fieldId, equals } drives Conditional Questions.
  fields jsonb not null default '[]'::jsonb,
  -- Access + behaviour: { tokenGated, memberOnly, group, autofill, opensAt,
  -- closesAt, confirmation: { title, body, showCalendar, showShare } }.
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.registration_forms add column if not exists description text;
alter table events.registration_forms add column if not exists fields jsonb not null default '[]'::jsonb;
alter table events.registration_forms add column if not exists settings jsonb not null default '{}'::jsonb;
alter table events.registration_forms add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.registration_forms add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.registration_forms add column if not exists deleted_at timestamptz;

drop trigger if exists registration_forms_touch_updated_at on events.registration_forms;
create trigger registration_forms_touch_updated_at
before update on events.registration_forms
for each row execute function events.touch_updated_at();

create index if not exists flow_registration_forms_status_idx
  on events.registration_forms (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Registrations — one row per person per event.
-- ---------------------------------------------------------------------------
create table if not exists events.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events.events(id) on delete cascade,
  form_id uuid references events.registration_forms(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text,
  -- Confirmed · Pending · Waitlisted · Declined · Cancelled · Checked-in
  status text not null default 'Confirmed',
  -- Online · Organizer · Import · API
  source text not null default 'Online',
  -- Total seats incl. the registrant; plus_ones holds named extra guests.
  party_size integer not null default 1,
  plus_ones jsonb not null default '[]'::jsonb,
  dietary text,
  accessibility text,
  -- Answers to a form's custom/conditional questions: { [fieldId]: value }.
  answers jsonb not null default '{}'::jsonb,
  -- Rank in the event's waitlist; null unless status = 'Waitlisted'.
  waitlist_position integer,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill any missing columns on older copies of the table.
alter table events.registrations add column if not exists form_id uuid references events.registration_forms(id) on delete set null;
alter table events.registrations add column if not exists phone text;
alter table events.registrations add column if not exists source text not null default 'Online';
alter table events.registrations add column if not exists party_size integer not null default 1;
alter table events.registrations add column if not exists plus_ones jsonb not null default '[]'::jsonb;
alter table events.registrations add column if not exists dietary text;
alter table events.registrations add column if not exists accessibility text;
alter table events.registrations add column if not exists answers jsonb not null default '{}'::jsonb;
alter table events.registrations add column if not exists waitlist_position integer;
alter table events.registrations add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table events.registrations add column if not exists approved_at timestamptz;
alter table events.registrations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.registrations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.registrations add column if not exists deleted_at timestamptz;

drop trigger if exists registrations_touch_updated_at on events.registrations;
create trigger registrations_touch_updated_at
before update on events.registrations
for each row execute function events.touch_updated_at();

create index if not exists flow_registrations_event_idx
  on events.registrations (event_id) where deleted_at is null;
create index if not exists flow_registrations_status_idx
  on events.registrations (status) where deleted_at is null;
create index if not exists flow_registrations_created_idx
  on events.registrations (created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Promote the next N waitlisted registrations (lowest waitlist_position) for an
-- event to Confirmed, then resequence the remaining waitlist to stay contiguous
-- from 1. Returns the promoted rows. Respects nothing about capacity here — the
-- caller (or auto-promotion rules) decides how many to promote.
create or replace function events.promote_waitlist(
  p_event_id uuid,
  p_count integer default 1
)
returns setof events.registrations
language plpgsql
as $$
declare
  r events.registrations;
begin
  for r in
    select * from events.registrations
    where event_id = p_event_id
      and status = 'Waitlisted'
      and deleted_at is null
    order by waitlist_position asc nulls last, created_at asc
    limit greatest(1, coalesce(p_count, 1))
  loop
    update events.registrations
      set status = 'Confirmed', waitlist_position = null
      where id = r.id
      returning * into r;
    return next r;
  end loop;

  -- Resequence whoever is still waiting so positions stay 1..n with no gaps.
  with ranked as (
    select id, row_number() over (
      order by waitlist_position asc nulls last, created_at asc
    ) as pos
    from events.registrations
    where event_id = p_event_id
      and status = 'Waitlisted'
      and deleted_at is null
  )
  update events.registrations f
    set waitlist_position = ranked.pos
    from ranked
    where f.id = ranked.id
      and f.waitlist_position is distinct from ranked.pos;

  return;
end;
$$;

-- Approve or decline a pending registration, stamping who acted and when.
create or replace function events.approve_registration(
  p_id uuid,
  p_approve boolean,
  p_by uuid default null
)
returns events.registrations
language plpgsql
as $$
declare
  r events.registrations;
begin
  update events.registrations
    set status = case when p_approve then 'Confirmed' else 'Declined' end,
        approved_by = p_by,
        approved_at = now()
    where id = p_id
    returning * into r;
  return r;
end;
$$;

-- Public registration entry point. Computes the right status from the event's
-- capacity + the form's approval/waitlist policy, then inserts. Called by the
-- public /e/<id> page so a sign-up lands in the RSVPs / Approval / Waitlist
-- screens with the correct state. Returns the created row.
create or replace function events.register(
  p_event_id uuid,
  p_form_id uuid default null,
  p_name text default '',
  p_email text default '',
  p_phone text default null,
  p_party_size integer default 1,
  p_plus_ones jsonb default '[]'::jsonb,
  p_dietary text default null,
  p_accessibility text default null,
  p_answers jsonb default '{}'::jsonb,
  p_require_approval boolean default false,
  p_allow_waitlist boolean default true,
  p_source text default 'Online'
)
returns events.registrations
language plpgsql
as $$
declare
  v_cap integer;
  v_taken integer;
  v_party integer := greatest(1, coalesce(p_party_size, 1));
  v_status text;
  v_pos integer;
  r events.registrations;
begin
  select capacity into v_cap from events.events where id = p_event_id;
  select coalesce(sum(party_size), 0) into v_taken
    from events.registrations
    where event_id = p_event_id
      and status in ('Confirmed', 'Checked-in')
      and deleted_at is null;

  if p_require_approval then
    v_status := 'Pending';
  elsif coalesce(v_cap, 0) > 0
        and (v_taken + v_party) > v_cap
        and p_allow_waitlist then
    v_status := 'Waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into v_pos
      from events.registrations
      where event_id = p_event_id
        and status = 'Waitlisted'
        and deleted_at is null;
  else
    v_status := 'Confirmed';
  end if;

  insert into events.registrations
    (event_id, form_id, name, email, phone, status, source, party_size,
     plus_ones, dietary, accessibility, answers, waitlist_position)
  values
    (p_event_id, p_form_id, p_name, p_email, nullif(p_phone, ''), v_status,
     coalesce(p_source, 'Online'), v_party, coalesce(p_plus_ones, '[]'::jsonb),
     nullif(p_dietary, ''), nullif(p_accessibility, ''),
     coalesce(p_answers, '{}'::jsonb), v_pos)
  returning * into r;

  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
-- ---------------------------------------------------------------------------
alter table events.registration_forms enable row level security;
drop policy if exists flow_registration_forms_demo_all on events.registration_forms;
create policy flow_registration_forms_demo_all on events.registration_forms
  for all to anon, authenticated using (true) with check (true);

alter table events.registrations enable row level security;
drop policy if exists flow_registrations_demo_all on events.registrations;
create policy flow_registrations_demo_all on events.registrations
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. Forms and registrations are project-scoped (see
-- zz_project_access.sql) and created in-app / via the public register() RPC.
