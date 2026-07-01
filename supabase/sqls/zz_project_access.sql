-- ===========================================================================
-- Geiger Events — project-based access (org-scoped RLS)
--
-- Ports the geiger-flow model to this app: every dashboard-managed row is
-- scoped to a shared `public.projects` row, and access is granted to members of
-- that project's owning organization (public.organization_users), exactly like
-- flow.issues. Membership is org-level — a project inherits its members from
-- its org — so there is no per-project member table.
--
--   scope chain: events.<row> -> project_id -> public.projects
--                -> organization_id -> public.organization_users -> auth.uid()
--
-- Runs LAST (zz_ filename) so every events.* table already exists. Self-
-- contained and idempotent: safe to re-run. Because we switch to NOT NULL
-- project_id on the six dashboard entities, this file first WIPES the demo rows
-- seeded by the earlier migrations (there is nothing to back-fill them to). New
-- rows are created against a real project chosen in the app.
--
-- Public surface: /e/<id>, /w/<slug> and anonymous ticket checkout stay open.
-- Anyone (anon or signed-in) may read a non-Private, non-deleted event and a
-- Published form; the public ticket/RSVP RPCs are SECURITY DEFINER so they keep
-- working. Everything else requires org membership.
--
-- Apply via the Supabase SQL editor (or `npm run db:push`).
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Wipe demo rows. The six dashboard entities move to NOT NULL project_id;
--    the seeded demo rows have no project to map to, so they are removed.
--    CASCADE clears the child rows (orders, registrations, notes) too.
-- ---------------------------------------------------------------------------
truncate table
  events.events,
  events.event_series,
  events.event_templates,
  events.registration_forms,
  events.workflows,
  events.event_wall,
  events.venues,
  events.event_orders,
  events.registrations,
  events.event_notes
restart identity cascade;

-- ---------------------------------------------------------------------------
-- 1. project_id columns + indexes.
--    Six dashboard entities: NOT NULL (a row always belongs to a project).
--    Two child tables (orders, registrations): nullable, denormalized from the
--    parent event so the dashboard can filter by the active project uniformly;
--    the RPCs below stamp it. event_notes stays parent-scoped (no column).
-- ---------------------------------------------------------------------------
alter table events.events              add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.event_series        add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.event_templates     add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.registration_forms  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.workflows           add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.event_wall          add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.venues              add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.event_orders        add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table events.registrations       add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Tables are empty (truncated above), so promoting to NOT NULL is safe.
alter table events.events             alter column project_id set not null;
alter table events.event_series       alter column project_id set not null;
alter table events.event_templates    alter column project_id set not null;
alter table events.registration_forms alter column project_id set not null;
alter table events.workflows          alter column project_id set not null;
alter table events.event_wall         alter column project_id set not null;
alter table events.venues             alter column project_id set not null;

-- One Event Wall per project (the public listing page for that project).
create unique index if not exists events_event_wall_project_idx
  on events.event_wall (project_id);

create index if not exists events_events_project_idx             on events.events (project_id) where deleted_at is null;
create index if not exists events_event_series_project_idx       on events.event_series (project_id) where deleted_at is null;
create index if not exists events_event_templates_project_idx    on events.event_templates (project_id) where deleted_at is null;
create index if not exists events_registration_forms_project_idx on events.registration_forms (project_id) where deleted_at is null;
create index if not exists events_workflows_project_idx          on events.workflows (project_id) where deleted_at is null;
create index if not exists events_venues_project_idx             on events.venues (project_id) where deleted_at is null;
create index if not exists events_event_orders_project_idx       on events.event_orders (project_id);
create index if not exists events_registrations_project_idx      on events.registrations (project_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Access helper. SECURITY DEFINER so it can read the shared public tables
--    regardless of their own RLS. Mirrors flow.can_access_project but reuses
--    the canonical public.is_org_member() (the same check public.projects'
--    own RLS uses), and treats a project with no organization as open
--    (transitional, matching the unowned demo project rows in public.projects).
-- ---------------------------------------------------------------------------
create or replace function events.can_access_project(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, events, auth
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target
      and (
        p.organization_id is null
        or public.is_org_member(p.organization_id)
        or p.created_by = auth.uid()
      )
  );
$$;

grant execute on function events.can_access_project(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS policies. Drop the open demo policies; add a member policy (org
--    membership) plus, where the app has a public surface, a scoped anon read.
--    Multiple permissive policies are OR-ed, so a member also sees public rows.
-- ---------------------------------------------------------------------------

-- events -------------------------------------------------------------------
drop policy if exists flow_events_demo_all on events.events;
drop policy if exists events_member_all on events.events;
drop policy if exists events_public_read on events.events;

create policy events_member_all on events.events
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Public event pages (/e/<id>) + the wall: anyone may read a non-Private,
-- non-deleted event. "Published-only" maps to this app's visibility model
-- (Public / Unlisted are shareable; Private is members-only).
create policy events_public_read on events.events
  for select to anon, authenticated
  using (deleted_at is null and visibility <> 'Private');

-- event_series -------------------------------------------------------------
drop policy if exists flow_event_series_demo_all on events.event_series;
drop policy if exists event_series_member_all on events.event_series;
create policy event_series_member_all on events.event_series
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- event_templates ----------------------------------------------------------
drop policy if exists flow_event_templates_demo_all on events.event_templates;
drop policy if exists event_templates_member_all on events.event_templates;
create policy event_templates_member_all on events.event_templates
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- registration_forms -------------------------------------------------------
drop policy if exists flow_registration_forms_demo_all on events.registration_forms;
drop policy if exists registration_forms_member_all on events.registration_forms;
drop policy if exists registration_forms_public_read on events.registration_forms;

create policy registration_forms_member_all on events.registration_forms
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- The public /e/<id> registration flow renders a Published form.
create policy registration_forms_public_read on events.registration_forms
  for select to anon, authenticated
  using (deleted_at is null and status = 'Published');

-- workflows ----------------------------------------------------------------
drop policy if exists workflows_demo_all on events.workflows;
drop policy if exists workflows_member_all on events.workflows;
create policy workflows_member_all on events.workflows
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- venues -------------------------------------------------------------------
drop policy if exists events_venues_demo_all on events.venues;
drop policy if exists venues_member_all on events.venues;
drop policy if exists venues_public_read on events.venues;

create policy venues_member_all on events.venues
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Public event pages (/e/<id>) load a linked venue's detail (map, capacity,
-- amenities, contact). Anyone may read a non-deleted venue.
create policy venues_public_read on events.venues
  for select to anon, authenticated
  using (deleted_at is null);

-- event_wall ---------------------------------------------------------------
drop policy if exists flow_event_wall_demo_all on events.event_wall;
drop policy if exists event_wall_member_all on events.event_wall;
drop policy if exists event_wall_public_read on events.event_wall;

create policy event_wall_member_all on events.event_wall
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- The wall is a public branding page resolved by slug (/w/<slug>).
create policy event_wall_public_read on events.event_wall
  for select to anon, authenticated
  using (true);

-- event_orders (child) -----------------------------------------------------
drop policy if exists flow_event_orders_demo_all on events.event_orders;
drop policy if exists event_orders_member_all on events.event_orders;
-- Members read/manage orders for their projects. Anonymous purchases go
-- through events.buy_ticket() (SECURITY DEFINER), so no anon policy is needed.
create policy event_orders_member_all on events.event_orders
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- registrations (child) ----------------------------------------------------
drop policy if exists flow_registrations_demo_all on events.registrations;
drop policy if exists registrations_member_all on events.registrations;
-- Members read/manage registrations for their projects. Public RSVP goes
-- through events.register() (SECURITY DEFINER), so no anon policy is needed.
create policy registrations_member_all on events.registrations
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- event_notes (child, parent-scoped — no project_id column) -----------------
drop policy if exists flow_event_notes_demo_all on events.event_notes;
drop policy if exists event_notes_demo_all on events.event_notes;
drop policy if exists event_notes_member_all on events.event_notes;
create policy event_notes_member_all on events.event_notes
  for all to authenticated
  using (
    exists (
      select 1 from events.events e
      where e.id = events.event_notes.event_id
        and events.can_access_project(e.project_id)
    )
  )
  with check (
    exists (
      select 1 from events.events e
      where e.id = events.event_notes.event_id
        and events.can_access_project(e.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Stamp project_id inside the public-facing RPCs so anonymous RSVP/checkout
--    rows land in the right project. Both are SECURITY DEFINER and derive the
--    project from the parent event.
-- ---------------------------------------------------------------------------

-- register(): unchanged behaviour, now also stamps registrations.project_id.
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
security definer
set search_path = events, public
as $$
declare
  v_cap integer;
  v_taken integer;
  v_party integer := greatest(1, coalesce(p_party_size, 1));
  v_status text;
  v_pos integer;
  v_project uuid;
  r events.registrations;
begin
  select capacity, project_id into v_cap, v_project
    from events.events where id = p_event_id;
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
    (event_id, project_id, form_id, name, email, phone, status, source, party_size,
     plus_ones, dietary, accessibility, answers, waitlist_position)
  values
    (p_event_id, v_project, p_form_id, p_name, p_email, nullif(p_phone, ''), v_status,
     coalesce(p_source, 'Online'), v_party, coalesce(p_plus_ones, '[]'::jsonb),
     nullif(p_dietary, ''), nullif(p_accessibility, ''),
     coalesce(p_answers, '{}'::jsonb), v_pos)
  returning * into r;

  return r;
end;
$$;

-- buy_ticket(): unchanged behaviour, now also stamps event_orders.project_id.
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text);

create or replace function events.buy_ticket(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_ticket text,
  p_price numeric,
  p_qty integer,
  p_addons numeric default 0,
  p_meta jsonb default '{}'::jsonb,
  p_stripe_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_sold integer;
  v_cap integer;
  v_total numeric;
  v_order uuid;
  v_project uuid;
  v_qty integer := greatest(1, coalesce(p_qty, 1));
begin
  if p_stripe_session_id is not null then
    select o.id into v_order
      from events.event_orders o
      where o.stripe_session_id = p_stripe_session_id;

    if found then
      select e.sold, e.capacity into v_sold, v_cap
        from events.events e where e.id = p_event_id;
      return query select true, v_order, v_sold, v_cap, greatest(0, v_cap - v_sold), false;
      return;
    end if;
  end if;

  select e.sold, e.capacity, e.project_id
    into v_sold, v_cap, v_project
    from events.events e
    where e.id = p_event_id and e.deleted_at is null
    for update;

  if not found then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  if v_cap > 0 and v_sold + v_qty > v_cap then
    return query select false, null::uuid, v_sold, v_cap, greatest(0, v_cap - v_sold), false;
    return;
  end if;

  v_total := (coalesce(p_price, 0) + coalesce(p_addons, 0)) * v_qty;

  insert into events.event_orders
    (event_id, project_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata, stripe_session_id, stripe_payment_intent_id)
  values
    (p_event_id, v_project, coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_ticket, 'General Admission'), coalesce(p_price, 0), v_qty, v_total, coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id)
  returning id into v_order;

  update events.events as e
    set sold = e.sold + v_qty,
        revenue = e.revenue + v_total
    where e.id = p_event_id
    returning e.sold, e.capacity into v_sold, v_cap;

  return query select true, v_order, v_sold, v_cap, greatest(0, v_cap - v_sold), true;
end;
$$;

grant execute on function events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text)
  to anon, authenticated;
grant execute on function events.register(uuid, uuid, text, text, text, integer, jsonb, text, text, jsonb, boolean, boolean, text)
  to anon, authenticated;
