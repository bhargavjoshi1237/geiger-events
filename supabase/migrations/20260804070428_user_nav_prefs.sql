-- User nav prefs
--
-- Owns events.user_nav_prefs — one row per (project, user) holding the sidebar
-- entries that user has hidden in Settings → Navigation. Sidebar curation is a
-- personal preference, so it is keyed by user rather than shared per project
-- like events.project_addons.
--
-- `hidden` is a jsonb array of exact sidebar titles ("Expo Booths"). The rules
-- about which titles may be hidden live in geiger-ui.config.js and are enforced
-- by @geiger/ui; the database only records the choice.
--
-- Self-contained: creates the schema, the shared updated_at trigger function,
-- the table, its indexes and RLS.

-- @up
create extension if not exists pgcrypto;

create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here
-- so this migration never depends on another having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.user_nav_prefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Plain uuid, no FK: there is no public.users table in this database. Null is
  -- the unauthenticated visitor, who gets one shared row per project.
  user_id uuid,
  -- Exact sidebar titles this user has hidden, e.g. ["Expo Booths", "Taxes"].
  hidden jsonb not null default '[]'::jsonb,
  -- Expansion bag: keep not-yet-promoted config here, promote to a real column
  -- once it needs indexing, constraints or its own RLS.
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill an older copy of this table that predates the promoted columns.
alter table events.user_nav_prefs
  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.user_nav_prefs add column if not exists user_id uuid;
alter table events.user_nav_prefs
  add column if not exists hidden jsonb not null default '[]'::jsonb;

-- The upsert target. `nulls not distinct` keeps the unauthenticated visitor on a
-- single row per project instead of accumulating one per write.
create unique index if not exists user_nav_prefs_project_user_idx
  on events.user_nav_prefs (project_id, user_id) nulls not distinct
  where deleted_at is null;

create index if not exists user_nav_prefs_created_at_idx
  on events.user_nav_prefs (created_at desc);

drop trigger if exists user_nav_prefs_touch_updated_at on events.user_nav_prefs;
create trigger user_nav_prefs_touch_updated_at
before update on events.user_nav_prefs
for each row execute function events.touch_updated_at();

-- Demo-open RLS, matching every other table in this schema. Tightening it to a
-- "your own row only" policy is a new migration.
alter table events.user_nav_prefs enable row level security;

drop policy if exists user_nav_prefs_demo_all on events.user_nav_prefs;
create policy user_nav_prefs_demo_all on events.user_nav_prefs
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- @down
drop table if exists events.user_nav_prefs cascade;
