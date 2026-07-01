-- ===========================================================================
-- Geiger Events — event series store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.event_series table, links events to a series via a series_id FK
-- on events.events, adds a settings-merge RPC, RLS, and seeds the demo
-- series with the SAME ids the app ships in sample_data.js.
--
-- A series groups related events under one banner. Shared settings (defaults
-- applied to new events, cadence/recurrence, member order, follow page) live in
-- the `settings` jsonb bag and are shallow-merged per editor tab so saving one
-- tab never clobbers another.
--
-- Runs after events.sql (filename order), so events.events already exists
-- when we add its series_id column. Depends on events.touch_updated_at().
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled series',
  description text,
  status text not null default 'Draft',
  cadence text not null default 'Monthly',
  visibility text not null default 'Public',
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag: { defaults:{…shared event defaults}, recurrence:{…},
  -- eventOrder:[ids], followPage:bool }. Merged a tab at a time via the RPC
  -- below; promote a key to a column once it needs indexing or constraints.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.event_series add column if not exists description text;
alter table events.event_series add column if not exists status text not null default 'Draft';
alter table events.event_series add column if not exists cadence text not null default 'Monthly';
alter table events.event_series add column if not exists visibility text not null default 'Public';
alter table events.event_series add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.event_series add column if not exists settings jsonb not null default '{}'::jsonb;
alter table events.event_series add column if not exists deleted_at timestamptz;

-- The link: an event belongs to at most one series. ON DELETE SET NULL so
-- deleting a series un-groups its events rather than destroying them.
alter table events.events
  add column if not exists series_id uuid references events.event_series(id) on delete set null;

create index if not exists flow_events_series_idx
  on events.events (series_id) where deleted_at is null;

drop trigger if exists event_series_touch_updated_at on events.event_series;
create trigger event_series_touch_updated_at
before update on events.event_series
for each row execute function events.touch_updated_at();

create index if not exists flow_event_series_status_idx
  on events.event_series (status) where deleted_at is null;
create index if not exists flow_event_series_created_idx
  on events.event_series (created_at desc);

-- Shallow-merge a settings patch into the series. One top-level key per editor
-- tab (defaults, recurrence, eventOrder, followPage) so tabs don't clobber.
create or replace function events.series_merge_settings(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events
as $$
declare
  v_settings jsonb;
begin
  update events.event_series
    set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id and deleted_at is null
    returning settings into v_settings;
  return v_settings;
end;
$$;

grant execute on function events.series_merge_settings(uuid, jsonb)
  to anon, authenticated;

-- RLS. Open demo policy (anon key) — replace with an org-scoped policy on auth.
alter table events.event_series enable row level security;

drop policy if exists flow_event_series_demo_all on events.event_series;
create policy flow_event_series_demo_all on events.event_series
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- No demo seed. Series are project-scoped (see zz_project_access.sql) and
-- created in-app against a real project.
