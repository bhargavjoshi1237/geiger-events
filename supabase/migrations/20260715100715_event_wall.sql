-- ===========================================================================
-- Geiger Events — Event Wall (public listing page)
--
-- Self-contained and idempotent. One wall row PER PROJECT drives that project's
-- public page (/w/<slug>), which lists every event in the project marked
-- events.events.is_listable (see events.sql). lib/supabase/event_wall.js
-- get-or-creates the row on first open and resolves the public route by slug.
--
-- project_id (the scope) + its unique index are defined here so this file yields
-- a table the app can use on its own. zz_project_access.sql layers on the
-- cross-cutting project-access concerns shared by every events.* table — the
-- NOT NULL promotion and the org-membership / public-read RLS policies.
-- ===========================================================================

create extension if not exists pgcrypto;

-- Defined here too (idempotent "create or replace") so this file doesn't
-- depend on events.sql having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.event_wall (
  id uuid primary key default gen_random_uuid(),
  -- The project this wall belongs to (one wall per project). NOT NULL is
  -- promoted in zz_project_access.sql alongside the other events.* tables.
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Our Events',
  tagline text not null default '',
  logo_url text,
  slug text not null default 'events',
  -- Expansion bag: theme (reuses lib/events/theme.js), filters (status/sort),
  -- featured (pinned event ids), layout, footer. Promote to a column if one
  -- needs indexing.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-fill project_id on older (pre-project, singleton-era) copies. Nullable
-- here; zz_project_access.sql clears any orphan rows and promotes it NOT NULL.
alter table events.event_wall add column if not exists project_id uuid references public.projects(id) on delete cascade;

create unique index if not exists flow_event_wall_slug_idx
  on events.event_wall (slug);

-- One wall per project (also created in zz_project_access.sql; idempotent).
create unique index if not exists events_event_wall_project_idx
  on events.event_wall (project_id);

drop trigger if exists event_wall_touch_updated_at on events.event_wall;
create trigger event_wall_touch_updated_at
before update on events.event_wall
for each row execute function events.touch_updated_at();

alter table events.event_wall enable row level security;

drop policy if exists flow_event_wall_demo_all on events.event_wall;
create policy flow_event_wall_demo_all on events.event_wall
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Shallow-merge RPC for the metadata bag — mirrors events.event_merge_meta.
create or replace function events.event_wall_merge_meta(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events
as $$
declare
  v_meta jsonb;
begin
  update events.event_wall
    set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id
    returning metadata into v_meta;
  return v_meta;
end;
$$;

grant execute on function events.event_wall_merge_meta(uuid, jsonb)
  to anon, authenticated;

-- No singleton seed. The wall is now one row per project (see
-- zz_project_access.sql), created on demand by lib/supabase/event_wall.js the
-- first time a project's Event Wall is opened.
