-- Drop the local user_nav_prefs copy
--
-- Sidebar curation is a property of the USER, not of the events domain, so it
-- moved to the suite-shared public.user_nav_prefs — owned and pushed by
-- geiger-dash, keyed by (product, surface, project, user). This drops the
-- events-schema copy added the same day in 20260804070428_user_nav_prefs.sql,
-- which never shipped a release and holds no data worth migrating.
--
-- lib/supabase/nav_prefs.js now reads and writes the public table through a
-- public-schema client.

-- @up
drop table if exists events.user_nav_prefs cascade;

-- @down
-- Recreate the events-schema copy exactly as 20260804070428 left it, so a
-- rollback past this point still lands on a working schema.
create table if not exists events.user_nav_prefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid,
  hidden jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists user_nav_prefs_project_user_idx
  on events.user_nav_prefs (project_id, user_id) nulls not distinct
  where deleted_at is null;

create index if not exists user_nav_prefs_created_at_idx
  on events.user_nav_prefs (created_at desc);

drop trigger if exists user_nav_prefs_touch_updated_at on events.user_nav_prefs;
create trigger user_nav_prefs_touch_updated_at
before update on events.user_nav_prefs
for each row execute function events.touch_updated_at();

alter table events.user_nav_prefs enable row level security;

drop policy if exists user_nav_prefs_demo_all on events.user_nav_prefs;
create policy user_nav_prefs_demo_all on events.user_nav_prefs
  for all
  to anon, authenticated
  using (true)
  with check (true);
