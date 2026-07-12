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
-- 0. (Removed — was DATA-DESTROYING on every re-run.)
--    This migration originally `TRUNCATE`d every table here so the demo rows
--    (which had no project) couldn't block the NOT NULL promotion below. But
--    `db:push` re-runs every non-`create table` statement, so that truncate
--    wiped ALL real data on every push. It is gone. Section 1 now deletes ONLY
--    unscoped rows (project_id is null) immediately before the NOT NULL step —
--    idempotent, and a no-op once every row is project-scoped.
-- ---------------------------------------------------------------------------

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
alter table events.conference_records  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.community_records   add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.settings_records    add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.analytics_records   add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.event_orders        add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table events.registrations       add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Remove only the unscoped rows (no project to back-fill them to) so the NOT
-- NULL promotion below succeeds. On an already-migrated DB every row is scoped,
-- so these delete nothing — re-running `db:push` no longer wipes data. Only the
-- seven tables promoted to NOT NULL are touched; event_orders / registrations
-- keep a NULLABLE project_id (stamped by the RPCs) and must NOT be deleted by
-- it — deleting a demo event cascades to its orders/registrations anyway.
-- Delete events first so its FKs to series/venues are released before those go.
delete from events.events             where project_id is null;
delete from events.event_series       where project_id is null;
delete from events.event_templates    where project_id is null;
delete from events.registration_forms where project_id is null;
delete from events.workflows          where project_id is null;
delete from events.event_wall         where project_id is null;
delete from events.venues             where project_id is null;
delete from events.conference_records where project_id is null;
delete from events.community_records  where project_id is null;
delete from events.settings_records   where project_id is null;
delete from events.analytics_records  where project_id is null;

alter table events.events             alter column project_id set not null;
alter table events.event_series       alter column project_id set not null;
alter table events.event_templates    alter column project_id set not null;
alter table events.registration_forms alter column project_id set not null;
alter table events.workflows          alter column project_id set not null;
alter table events.event_wall         alter column project_id set not null;
alter table events.venues             alter column project_id set not null;
alter table events.conference_records alter column project_id set not null;
alter table events.community_records  alter column project_id set not null;
alter table events.settings_records   alter column project_id set not null;
alter table events.analytics_records  alter column project_id set not null;

-- One Event Wall per project (the public listing page for that project).
create unique index if not exists events_event_wall_project_idx
  on events.event_wall (project_id);

create index if not exists events_events_project_idx             on events.events (project_id) where deleted_at is null;
create index if not exists events_event_series_project_idx       on events.event_series (project_id) where deleted_at is null;
create index if not exists events_event_templates_project_idx    on events.event_templates (project_id) where deleted_at is null;
create index if not exists events_registration_forms_project_idx on events.registration_forms (project_id) where deleted_at is null;
create index if not exists events_workflows_project_idx          on events.workflows (project_id) where deleted_at is null;
create index if not exists events_venues_project_idx             on events.venues (project_id) where deleted_at is null;
create index if not exists events_conference_records_project_idx on events.conference_records (project_id) where deleted_at is null;
create index if not exists events_community_records_project_idx  on events.community_records (project_id) where deleted_at is null;
create index if not exists events_settings_records_project_idx   on events.settings_records (project_id) where deleted_at is null;
create index if not exists events_analytics_records_project_idx  on events.analytics_records (project_id) where deleted_at is null;
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

-- conference_records (Conference area) --------------------------------------
-- Reusable speaker/sponsor/booth/paper/… records, scoped to the owning project.
-- Member-only: no public surface (managed in the dashboard).
drop policy if exists events_conference_records_demo_all on events.conference_records;
drop policy if exists conference_records_member_all on events.conference_records;
create policy conference_records_member_all on events.conference_records
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- community_records / settings_records / analytics_records ------------------
-- Config-driven record areas (Community, Settings, Analytics). Member-only.
drop policy if exists events_community_records_demo_all on events.community_records;
drop policy if exists community_records_member_all on events.community_records;
create policy community_records_member_all on events.community_records
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_settings_records_demo_all on events.settings_records;
drop policy if exists settings_records_member_all on events.settings_records;
create policy settings_records_member_all on events.settings_records
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_analytics_records_demo_all on events.analytics_records;
drop policy if exists analytics_records_member_all on events.analytics_records;
create policy analytics_records_member_all on events.analytics_records
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

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

-- dietary_config / dietary_requests ----------------------------------------
drop policy if exists events_dietary_config_demo_all on events.dietary_config;
drop policy if exists dietary_config_member_all on events.dietary_config;
create policy dietary_config_member_all on events.dietary_config
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_dietary_requests_demo_all on events.dietary_requests;
drop policy if exists dietary_requests_member_all on events.dietary_requests;
-- Members read/manage requests for their projects. Public submission goes
-- through events.submit_dietary_request() (SECURITY DEFINER), so no anon policy.
create policy dietary_requests_member_all on events.dietary_requests
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Guests area: contacts / contact_segments / contact_activity / data_requests --
-- All member-scoped; the Guests area has no public surface. merge_contacts() is
-- SECURITY INVOKER, so these policies scope it too.
drop policy if exists events_contacts_demo_all on events.contacts;
drop policy if exists contacts_member_all on events.contacts;
create policy contacts_member_all on events.contacts
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_contact_segments_demo_all on events.contact_segments;
drop policy if exists contact_segments_member_all on events.contact_segments;
create policy contact_segments_member_all on events.contact_segments
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_contact_activity_demo_all on events.contact_activity;
drop policy if exists contact_activity_member_all on events.contact_activity;
create policy contact_activity_member_all on events.contact_activity
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_data_requests_demo_all on events.data_requests;
drop policy if exists data_requests_member_all on events.data_requests;
create policy data_requests_member_all on events.data_requests
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- contact_tags (Guests > Tags catalog) -------------------------------------
-- Member-scoped; no public surface. rewrite_contact_tags() is SECURITY
-- INVOKER, so the contacts policy scopes its array rewrites too.
drop policy if exists events_contact_tags_demo_all on events.contact_tags;
drop policy if exists contact_tags_member_all on events.contact_tags;
create policy contact_tags_member_all on events.contact_tags
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- ticketing_records (Tickets global modules) --------------------------------
-- Reusable coupons / rules / methods / policies, scoped to the owning project.
-- Member-only: no public surface (attachment applies them, read via the event).
drop policy if exists events_ticketing_records_demo_all on events.ticketing_records;
drop policy if exists ticketing_records_member_all on events.ticketing_records;
create policy ticketing_records_member_all on events.ticketing_records
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- ticketing_settings / refund_requests / group_purchases / membership_members --
-- Project-global Tickets config + transactional logs + membership roster.
-- Member-only: no public surface (applied via the event / managed in-app).
drop policy if exists events_ticketing_settings_demo_all on events.ticketing_settings;
drop policy if exists ticketing_settings_member_all on events.ticketing_settings;
create policy ticketing_settings_member_all on events.ticketing_settings
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_refund_requests_demo_all on events.refund_requests;
drop policy if exists refund_requests_member_all on events.refund_requests;
create policy refund_requests_member_all on events.refund_requests
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_group_purchases_demo_all on events.group_purchases;
drop policy if exists group_purchases_member_all on events.group_purchases;
create policy group_purchases_member_all on events.group_purchases
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_membership_members_demo_all on events.membership_members;
drop policy if exists membership_members_member_all on events.membership_members;
create policy membership_members_member_all on events.membership_members
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Discovery: organiser_profile / organiser_followers -----------------------
-- The profile is the project's public identity — member-managed, publicly
-- readable (the /w/<slug> wall renders it). Followers are private (member-only);
-- anonymous follows go through events.follow_organiser() (SECURITY DEFINER), so
-- no anon table policy is needed — mirrors event_orders.
drop policy if exists organiser_profile_demo_all on events.organiser_profile;
drop policy if exists organiser_profile_member_all on events.organiser_profile;
drop policy if exists organiser_profile_public_read on events.organiser_profile;

create policy organiser_profile_member_all on events.organiser_profile
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

create policy organiser_profile_public_read on events.organiser_profile
  for select to anon, authenticated
  using (deleted_at is null);

drop policy if exists organiser_followers_demo_all on events.organiser_followers;
drop policy if exists organiser_followers_member_all on events.organiser_followers;
create policy organiser_followers_member_all on events.organiser_followers
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- check-in module (settings / attendance / staff roles / leads) ---------------
-- All project-scoped, member-only in Phase 1 (the Phase-2 staff routes get their
-- own access-code path). checkin_settings / checkin_staff_roles are configured
-- in the dashboard; checkin_attendance / checkin_leads are written by staff
-- surfaces for a project's events.
drop policy if exists events_checkin_settings_demo_all on events.checkin_settings;
drop policy if exists checkin_settings_member_all on events.checkin_settings;
create policy checkin_settings_member_all on events.checkin_settings
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_checkin_attendance_demo_all on events.checkin_attendance;
drop policy if exists checkin_attendance_member_all on events.checkin_attendance;
create policy checkin_attendance_member_all on events.checkin_attendance
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_checkin_staff_roles_demo_all on events.checkin_staff_roles;
drop policy if exists checkin_staff_roles_member_all on events.checkin_staff_roles;
create policy checkin_staff_roles_member_all on events.checkin_staff_roles
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_checkin_leads_demo_all on events.checkin_leads;
drop policy if exists checkin_leads_member_all on events.checkin_leads;
create policy checkin_leads_member_all on events.checkin_leads
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- 4. Stamp project_id inside the public-facing RPCs so anonymous RSVP/checkout
--    rows land in the right project. Both are SECURITY DEFINER and derive the
--    project from the parent event.
-- ---------------------------------------------------------------------------

-- register(): stamps registrations.project_id, honours the overbook buffer
-- (metadata.capacityBuffer) in the cap, and — the fix — REFUSES to confirm when
-- the event is full and waitlist is disabled (it used to silently fall through
-- to 'Confirmed', i.e. oversell). A full-with-no-waitlist call raises EVENT_FULL
-- so the caller can surface it instead of quietly overbooking.
--
-- p_enforce_capacity lets the parity registration filed right after a successful
-- buy_ticket skip this gate: buy_ticket is the capacity authority for ticketed
-- flows, so re-gating here would wrongly drop an already-paid attendee from the
-- guest list. RSVP-only / direct callers keep the default (true).
-- Signature changed (extra trailing arg) so the old 13-arg overload is dropped.
drop function if exists events.register(uuid, uuid, text, text, text, integer, jsonb, text, text, jsonb, boolean, boolean, text);

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
  p_source text default 'Online',
  p_enforce_capacity boolean default true
)
returns events.registrations
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_cap integer;
  v_meta jsonb;
  v_buffer integer;
  v_effcap integer;
  v_taken integer;
  v_party integer := greatest(1, coalesce(p_party_size, 1));
  v_status text;
  v_pos integer;
  v_project uuid;
  r events.registrations;
begin
  select capacity, project_id, metadata into v_cap, v_project, v_meta
    from events.events where id = p_event_id;
  -- Effective cap = base capacity + overbook buffer (0 base = unlimited).
  v_buffer := greatest(0, coalesce((v_meta->>'capacityBuffer')::integer, 0));
  v_effcap := case when coalesce(v_cap, 0) > 0 then v_cap + v_buffer else 0 end;
  select coalesce(sum(party_size), 0) into v_taken
    from events.registrations
    where event_id = p_event_id
      and status in ('Confirmed', 'Checked-in')
      and deleted_at is null;

  if p_require_approval then
    v_status := 'Pending';
  elsif p_enforce_capacity and v_effcap > 0 and (v_taken + v_party) > v_effcap then
    if p_allow_waitlist then
      v_status := 'Waitlisted';
      select coalesce(max(waitlist_position), 0) + 1 into v_pos
        from events.registrations
        where event_id = p_event_id
          and status = 'Waitlisted'
          and deleted_at is null;
    else
      -- Full, no waitlist, no approval: reject rather than overbook.
      raise exception 'EVENT_FULL' using errcode = 'check_violation';
    end if;
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

-- buy_ticket(): stamps event_orders.project_id, honours the overbook buffer
-- (metadata.capacityBuffer) in the event-level cap, AND — when a tier id is
-- given — enforces that tier's own inventory (metadata.tickets[].qty). Per-tier
-- sold counts live in a SEPARATE metadata.ticketSold map keyed by tier id, so
-- the tickets editor (which round-trips metadata.tickets) never clobbers the
-- system counter. A tier qty of 0 = unlimited, mirroring capacity 0 = unlimited.
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
  p_stripe_payment_intent_id text default null,
  p_tier_id text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_sold integer;
  v_cap integer;
  v_meta jsonb;
  v_buffer integer;
  v_effcap integer;
  v_tier jsonb;
  v_tier_qty integer;
  v_tier_sold integer;
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

  select e.sold, e.capacity, e.project_id, e.metadata
    into v_sold, v_cap, v_project, v_meta
    from events.events e
    where e.id = p_event_id and e.deleted_at is null
    for update;

  if not found then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Effective event cap = base capacity + overbook buffer (0 base = unlimited).
  v_buffer := greatest(0, coalesce((v_meta->>'capacityBuffer')::integer, 0));
  v_effcap := case when coalesce(v_cap, 0) > 0 then v_cap + v_buffer else 0 end;

  if v_effcap > 0 and v_sold + v_qty > v_effcap then
    return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold), false;
    return;
  end if;

  -- Per-tier inventory: reject when this tier's qty would be exceeded.
  if p_tier_id is not null then
    select t.val into v_tier
      from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) as t(val)
      where t.val->>'id' = p_tier_id
      limit 1;
    if v_tier is not null then
      v_tier_qty := coalesce((v_tier->>'qty')::integer, 0);
      v_tier_sold := coalesce((v_meta->'ticketSold'->>p_tier_id)::integer, 0);
      if v_tier_qty > 0 and v_tier_sold + v_qty > v_tier_qty then
        return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold), false;
        return;
      end if;
    end if;
  end if;

  v_total := (coalesce(p_price, 0) + coalesce(p_addons, 0)) * v_qty;

  insert into events.event_orders
    (event_id, project_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata, stripe_session_id, stripe_payment_intent_id)
  values
    (p_event_id, v_project, coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_ticket, 'General Admission'), coalesce(p_price, 0), v_qty, v_total, coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id)
  returning id into v_order;

  -- Auto-create a passwordless members-portal account for the buyer (both free
  -- and paid paths funnel here). Skips empty emails; never overwrites a set name.
  if coalesce(p_email, '') <> '' then
    insert into events.portal_members (email, name)
    values (lower(p_email), coalesce(p_name, ''))
    on conflict (lower(email)) do update
      set name = case when events.portal_members.name = ''
                      then excluded.name else events.portal_members.name end;
  end if;

  update events.events as e
    set sold = e.sold + v_qty,
        revenue = e.revenue + v_total,
        -- Bump the per-tier sold counter under the same row lock (no-op when no
        -- tier was passed) so per-tier inventory stays consistent with sold.
        metadata = case
          when p_tier_id is not null then jsonb_set(
            coalesce(e.metadata, '{}'::jsonb),
            array['ticketSold', p_tier_id],
            to_jsonb(coalesce((e.metadata->'ticketSold'->>p_tier_id)::integer, 0) + v_qty),
            true)
          else e.metadata
        end
    where e.id = p_event_id
    returning e.sold, e.capacity into v_sold, v_cap;

  return query select true, v_order, v_sold, v_cap, greatest(0, v_effcap - v_sold), true;
end;
$$;

grant execute on function events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text)
  to anon, authenticated;
grant execute on function events.register(uuid, uuid, text, text, text, integer, jsonb, text, text, jsonb, boolean, boolean, text, boolean)
  to anon, authenticated;
