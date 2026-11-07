-- @up
-- Venue spaces — the bookable/diagrammable rooms inside a venue (ballroom, breakout A, terrace).
-- Shared by Event Design (floor plans are drawn against a space) and Sourcing → Instant Book (spaces are booked).
-- Dimensions are stored in metres; `unit` is only the organiser's display preference.

create schema if not exists events;

create table if not exists events.venue_spaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  venue_id uuid not null references events.venues(id) on delete cascade,
  name text not null default 'Untitled space',
  kind text not null default 'room'
    check (kind in ('room', 'hall', 'ballroom', 'outdoor', 'suite', 'other')),
  floor text not null default '',
  width_m numeric(8, 2),
  length_m numeric(8, 2),
  height_m numeric(8, 2),
  unit text not null default 'm' check (unit in ('m', 'ft')),
  -- Max occupancy per setup style, e.g. {"theatre": 300, "banquet": 180}.
  capacities jsonb not null default '{}'::jsonb,
  description text not null default '',
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists venue_spaces_venue_idx
  on events.venue_spaces (venue_id, sort_order)
  where deleted_at is null;
create index if not exists venue_spaces_project_idx
  on events.venue_spaces (project_id)
  where deleted_at is null;

drop trigger if exists venue_spaces_touch on events.venue_spaces;
create trigger venue_spaces_touch
  before update on events.venue_spaces
  for each row execute function events.touch_updated_at();

alter table events.venue_spaces enable row level security;

drop policy if exists venue_spaces_member_all on events.venue_spaces;
create policy venue_spaces_member_all on events.venue_spaces
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.venue_spaces to authenticated;

-- @down
drop table if exists events.venue_spaces;
