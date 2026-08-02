-- Event team (Co-hosts & Admins)
--
-- Owns events.event_team_members — per-event access grants. One row per person
-- with access to a single event, either an existing project member added from
-- the roster (member_id/user_id set, status 'active') or an outsider invited by
-- email (status 'invited' until they accept). Replaces the section's static
-- metadata.team / metadata.pendingInvites blobs.
--
-- Roles are the event-scoped set from components/internal/screens/events/
-- sample_data.js (EVENT_TEAM_ROLES): Owner | Admin | Co-host | Check-in staff |
-- Viewer — deliberately independent of the project role catalog (events.roles).

-- @up
create extension if not exists pgcrypto;
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

-- Shared updated_at trigger fn (declared locally so this file stands alone).
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- name/email/avatar are denormalized display snapshots; member_id/user_id are
-- soft links so an invited-but-unregistered person still holds a row.
create table if not exists events.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid references events.project_members(id) on delete set null,
  user_id uuid,
  role text not null default 'Co-host',
  status text not null default 'active',   -- active | invited
  name text not null default '',
  email text not null default '',
  avatar_url text,
  invited_by uuid,
  invited_at timestamptz,
  joined_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists event_team_members_touch_updated_at on events.event_team_members;
create trigger event_team_members_touch_updated_at
before update on events.event_team_members
for each row execute function events.touch_updated_at();

create index if not exists events_event_team_members_event_idx
  on events.event_team_members (event_id, created_at) where deleted_at is null;
create index if not exists events_event_team_members_project_idx
  on events.event_team_members (project_id) where deleted_at is null;

-- One grant per person / per invited email within an event.
create unique index if not exists events_event_team_members_member_uniq
  on events.event_team_members (event_id, member_id)
  where member_id is not null and deleted_at is null;
create unique index if not exists events_event_team_members_email_uniq
  on events.event_team_members (event_id, lower(email))
  where email <> '' and deleted_at is null;

-- RLS: project members only, resolved through the owning event (the grant's own
-- project_id is a convenience copy and may be null on older rows).
alter table events.event_team_members enable row level security;

drop policy if exists event_team_members_member_all on events.event_team_members;
create policy event_team_members_member_all on events.event_team_members
  for all to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)))
  with check (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)));

-- @down
drop policy if exists event_team_members_member_all on events.event_team_members;
drop table if exists events.event_team_members cascade;
