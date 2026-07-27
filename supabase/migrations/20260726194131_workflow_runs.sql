-- ===========================================================================
-- Geiger Events — workflow runs (execution log)
--
-- Self-contained and idempotent: safe to run repeatedly. Reuses the shared
-- events.touch_updated_at() trigger function and creates events.workflow_runs,
-- its indexes, and an open demo RLS policy.
--
-- A run is the outcome of a single workflow execution: the trigger that fired,
-- when it ran, how long it took, and a per-step log. There is no execution
-- runner yet, so this table is empty until one lands — the Run History screen
-- reads it and renders its empty state.
--
-- Apply via the Supabase SQL editor (or `npm run db:push`).
-- ===========================================================================

create extension if not exists pgcrypto;

create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;
alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
alter default privileges in schema events grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema events grant all on routines to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here so
-- this migration doesn't depend on another having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  -- The workflow that executed. Cascades so a deleted workflow takes its runs.
  workflow_id uuid references events.workflows(id) on delete cascade,
  -- Project scoping (mirrors the workflows table's project filter).
  project_id uuid references public.projects(id) on delete cascade,
  -- Trigger catalog key that fired this run, e.g. 'ticket.purchased'.
  trigger text,
  -- Success | Failed | Running | Skipped
  status text not null default 'Success',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer not null default 0,
  steps_total integer not null default 0,
  steps_completed integer not null default 0,
  -- First error message when status = 'Failed' (null otherwise).
  error text,
  -- Trigger payload / run context (buyer, order, event…).
  context jsonb not null default '{}'::jsonb,
  -- Per-step outcome log: [{ label, kind, type, status, durationMs, error }].
  steps_log jsonb not null default '[]'::jsonb,
  -- Expansion bag for not-yet-promoted config.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.workflow_runs add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.workflow_runs add column if not exists trigger text;
alter table events.workflow_runs add column if not exists status text not null default 'Success';
alter table events.workflow_runs add column if not exists started_at timestamptz not null default now();
alter table events.workflow_runs add column if not exists finished_at timestamptz;
alter table events.workflow_runs add column if not exists duration_ms integer not null default 0;
alter table events.workflow_runs add column if not exists steps_total integer not null default 0;
alter table events.workflow_runs add column if not exists steps_completed integer not null default 0;
alter table events.workflow_runs add column if not exists error text;
alter table events.workflow_runs add column if not exists context jsonb not null default '{}'::jsonb;
alter table events.workflow_runs add column if not exists steps_log jsonb not null default '[]'::jsonb;
alter table events.workflow_runs add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists workflow_runs_touch_updated_at on events.workflow_runs;
create trigger workflow_runs_touch_updated_at
before update on events.workflow_runs
for each row execute function events.touch_updated_at();

create index if not exists workflow_runs_workflow_idx
  on events.workflow_runs (workflow_id);
create index if not exists workflow_runs_project_idx
  on events.workflow_runs (project_id);
create index if not exists workflow_runs_started_idx
  on events.workflow_runs (started_at desc);
create index if not exists workflow_runs_status_idx
  on events.workflow_runs (status);

-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
alter table events.workflow_runs enable row level security;

drop policy if exists workflow_runs_demo_all on events.workflow_runs;
create policy workflow_runs_demo_all on events.workflow_runs
  for all
  to anon, authenticated
  using (true)
  with check (true);
