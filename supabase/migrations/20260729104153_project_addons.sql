-- Project addons
--
-- Owns events.project_addons — the per-project enablement + placement + config
-- record for an installed addon. The addon CATALOG itself is code (addons/*/
-- manifest.js, statically indexed by addons/index.js); this table only stores
-- what a project has turned on, where it sits in the sidebar, and its settings.
--
-- One row per (project, addon). A missing row means "not enabled" — an addon is
-- opt-in per project, so a fresh project starts with none of them.

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

create table if not exists events.project_addons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Stable manifest id (addons/<addon_id>/manifest.js). Text, not an FK: the
  -- catalog lives in code, so an id with no manifest is simply ignored on read.
  addon_id text not null,
  enabled boolean not null default false,
  -- Sidebar placement override: index into the merged top-level nav. NULL keeps
  -- the manifest's own placement (nav.insertAfter, else before Settings).
  position integer,
  -- Per-addon settings the manifest's settings panel writes (attribution
  -- window, defaults, thresholds…). Shape is owned by the addon.
  config jsonb not null default '{}'::jsonb,
  -- Expansion bag: keep not-yet-promoted config here, promote to a real column
  -- once it needs indexing, constraints or its own RLS.
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill older copies of the table (idempotent re-run on a partial apply).
alter table events.project_addons
  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.project_addons add column if not exists addon_id text;
alter table events.project_addons add column if not exists enabled boolean not null default false;
alter table events.project_addons add column if not exists position integer;
alter table events.project_addons add column if not exists config jsonb not null default '{}'::jsonb;

-- The whole read pattern is "every addon row for this project".
create index if not exists project_addons_project_idx
  on events.project_addons (project_id)
  where deleted_at is null;

-- One row per (project, addon) — the upsert conflict target. Deliberately NOT a
-- partial index: `on conflict (cols)` can only infer a partial index when the
-- statement repeats its predicate, which PostgREST cannot emit. Turning an addon
-- off sets enabled=false rather than soft-deleting, so a total constraint is
-- also the honest shape here.
create unique index if not exists project_addons_project_addon_idx
  on events.project_addons (project_id, addon_id);

drop trigger if exists project_addons_touch_updated_at on events.project_addons;
create trigger project_addons_touch_updated_at
before update on events.project_addons
for each row execute function events.touch_updated_at();

-- RLS: org-membership scoped, matching every other project-owned table (see
-- 20260726194134_project_access.sql). No anon policy — addon enablement is a
-- workspace concern; public surfaces read their addon's own tables instead.
alter table events.project_addons enable row level security;

drop policy if exists project_addons_demo_all on events.project_addons;
drop policy if exists project_addons_member_all on events.project_addons;
create policy project_addons_member_all on events.project_addons
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- @down
drop policy if exists project_addons_member_all on events.project_addons;
drop table if exists events.project_addons cascade;
