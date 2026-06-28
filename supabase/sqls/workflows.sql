-- ===========================================================================
-- Geiger Events — workflows (automation engine)
--
-- Self-contained and idempotent: safe to run repeatedly. Reuses the shared
-- events.touch_updated_at() trigger function, creates the events.workflows
-- table, its indexes, and an open demo RLS policy.
--
-- A workflow is an automation: a trigger (an event action such as
-- "ticket.purchased") feeding an ordered chain of condition/action steps.
-- `steps` is the canonical logic; `graph` stores the drag-drop canvas layout
-- (node positions + connectors) over those same steps.
--
-- Apply via the Supabase SQL editor (or `npm run db:push`).
-- ===========================================================================

create extension if not exists pgcrypto;

-- This app's objects live in the dedicated `events` schema (already exposed in
-- PostgREST for this project).
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;
alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
alter default privileges in schema events grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema events grant all on routines to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here
-- so this migration doesn't depend on events.sql having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled workflow',
  description text,
  -- Draft | Active | Paused
  status text not null default 'Draft',
  -- Trigger catalog key, e.g. 'ticket.purchased' (see workflows/constants.js).
  trigger text,
  -- 'workspace' (listens across all events) or 'event' (scoped to one event).
  scope text not null default 'workspace',
  -- The event this workflow is scoped to when scope = 'event' (null otherwise).
  event_id uuid references events.events(id) on delete cascade,
  -- Canonical ordered/branched logic. Array of step objects:
  --   { id, kind: 'trigger'|'condition'|'action', type, config, position,
  --     next: [...], branches: { yes: [...], no: [...] } }
  steps jsonb not null default '[]'::jsonb,
  -- Canvas layout for the drag-drop view: { nodes, edges, viewport } in
  -- @xyflow/react shape. A presentation layer over `steps`.
  graph jsonb not null default '{}'::jsonb,
  -- Last view the user used in the builder: 'list' | 'canvas'.
  view_mode text not null default 'list',
  -- Display-only run metrics (no execution runner yet).
  run_count integer not null default 0,
  last_run_at timestamptz,
  -- The owner.
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag for not-yet-promoted config.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.workflows add column if not exists description text;
alter table events.workflows add column if not exists trigger text;
alter table events.workflows add column if not exists scope text not null default 'workspace';
alter table events.workflows add column if not exists event_id uuid references events.events(id) on delete cascade;
alter table events.workflows add column if not exists steps jsonb not null default '[]'::jsonb;
alter table events.workflows add column if not exists graph jsonb not null default '{}'::jsonb;
alter table events.workflows add column if not exists view_mode text not null default 'list';
alter table events.workflows add column if not exists run_count integer not null default 0;
alter table events.workflows add column if not exists last_run_at timestamptz;
alter table events.workflows add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.workflows add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.workflows add column if not exists deleted_at timestamptz;

drop trigger if exists workflows_touch_updated_at on events.workflows;
create trigger workflows_touch_updated_at
before update on events.workflows
for each row execute function events.touch_updated_at();

create index if not exists workflows_status_idx
  on events.workflows (status) where deleted_at is null;
create index if not exists workflows_created_idx
  on events.workflows (created_at desc);
create index if not exists workflows_event_idx
  on events.workflows (event_id) where deleted_at is null;

-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
alter table events.workflows enable row level security;

drop policy if exists workflows_demo_all on events.workflows;
create policy workflows_demo_all on events.workflows
  for all
  to anon, authenticated
  using (true)
  with check (true);
