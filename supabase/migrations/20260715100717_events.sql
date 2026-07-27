-- ===========================================================================
-- Geiger Events — events store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the shared
-- updated_at trigger function, the events.events table, its indexes, RLS,
-- and seeds the eight demo events with the SAME UUIDs the app ships in
-- sample_data.js so existing /e/<uuid> links resolve to real rows.
--
-- Apply via the Supabase SQL editor (or psql) for the project in .env.
-- ===========================================================================

create extension if not exists pgcrypto;

-- This app's objects live in the dedicated `events` schema. The `events` schema
-- must also be present in PostgREST's exposed-schemas list (managed at the
-- Supabase project level — already configured for this project).
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;
alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
alter default privileges in schema events grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema events grant all on routines to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here
-- so this migration doesn't depend on the core migration having run.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.events (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled event',
  status text not null default 'Draft',
  type text not null default 'In-person',
  event_date date,
  event_time text,
  venue text,
  address text,
  city text,
  timezone text not null default 'Europe/London',
  capacity integer not null default 0,
  sold integer not null default 0,
  revenue numeric(14, 2) not null default 0,
  visibility text not null default 'Public',
  organizer text,
  summary text,
  -- Direct public URLs of uploaded images (Supabase Storage, bucket "products",
  -- folder events/<id>/). cover_url is the hero; gallery is an ordered list.
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,
  -- The owner. Only this user may upload/replace this event's images.
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag: store not-yet-promoted attributes (page design, ticket
  -- tiers, custom questions…) here without a migration. Promote to a real
  -- column once a field needs indexing, constraints, or its own RLS.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.events add column if not exists address text;
alter table events.events add column if not exists timezone text not null default 'Europe/London';
alter table events.events add column if not exists summary text;
alter table events.events add column if not exists cover_url text;
alter table events.events add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table events.events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.events add column if not exists deleted_at timestamptz;
-- Whether this event appears on the public Event Wall (see event_wall.sql).
-- A real column (not metadata) since the wall's public page filters on it.
alter table events.events add column if not exists is_listable boolean not null default false;

drop trigger if exists events_touch_updated_at on events.events;
create trigger events_touch_updated_at
before update on events.events
for each row execute function events.touch_updated_at();

create index if not exists flow_events_status_idx
  on events.events (status) where deleted_at is null;
create index if not exists flow_events_created_idx
  on events.events (created_at desc);
create index if not exists flow_events_listable_idx
  on events.events (event_date) where is_listable and deleted_at is null;

-- RLS. The events dashboard currently runs unauthenticated (anon key), so the
-- demo policy below grants open access. When auth lands, replace this with an
-- organization-scoped policy (see public.flow_is_org_member in the core
-- migration) and drop the open policy.
alter table events.events enable row level security;

drop policy if exists flow_events_demo_all on events.events;
create policy flow_events_demo_all on events.events
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- No demo seed. Rows are project-scoped (see zz_project_access.sql) and created
-- in-app against a real public.projects row; there is nothing to seed without a
-- project. The client still ships sample_data.js for an instant first paint.
