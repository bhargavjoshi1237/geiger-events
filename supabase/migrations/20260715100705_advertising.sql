-- ===========================================================================
-- Geiger Events — advertising records store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.advertising_records table, its indexes, an updated_at trigger, and RLS.
--
-- One uniform store shared by the Advertising area, discriminated by `module`:
--   connection | campaign | budget
-- It is the layman-friendly wrapper over the ad platforms (Google AdSense,
-- Facebook Marketplace, Google Ads, Meta Ads). A `connection` row holds the
-- per-platform account fields a live OAuth sync would later populate, so
-- swapping in real Google/Meta APIs means filling these rows — no schema change.
-- Module-specific fields live in the `config` jsonb bag; only name/status are
-- promoted columns. Mirrors events.conference_records.
--
-- Project scoping (project_id NOT NULL, org-scoped RLS) is applied last in
-- zz_project_access.sql, alongside the other dashboard entities.
-- Depends on events.touch_updated_at() (defined in events.sql).
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

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

create table if not exists events.advertising_records (
  id uuid primary key default gen_random_uuid(),
  -- Discriminator: connection | campaign | budget.
  module text not null,
  name text not null default 'Untitled',
  status text not null default 'Draft',
  -- Every module-specific field (platform, objective, spend, amount, …).
  config jsonb not null default '{}'::jsonb,
  -- Expansion bag for not-yet-promoted attributes.
  metadata jsonb not null default '{}'::jsonb,
  -- Scoped to the owning project (promoted to NOT NULL in zz_project_access.sql).
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.advertising_records add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.advertising_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.advertising_records add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.advertising_records add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.advertising_records add column if not exists deleted_at timestamptz;

drop trigger if exists advertising_records_touch_updated_at on events.advertising_records;
create trigger advertising_records_touch_updated_at
before update on events.advertising_records
for each row execute function events.touch_updated_at();

create index if not exists events_advertising_records_module_idx
  on events.advertising_records (module) where deleted_at is null;
create index if not exists events_advertising_records_created_idx
  on events.advertising_records (created_at desc);

-- RLS. Open demo policy (anon key) — replaced with an org-scoped member policy
-- in zz_project_access.sql.
alter table events.advertising_records enable row level security;

drop policy if exists events_advertising_records_demo_all on events.advertising_records;
create policy events_advertising_records_demo_all on events.advertising_records
  for all
  to anon, authenticated
  using (true)
  with check (true);
