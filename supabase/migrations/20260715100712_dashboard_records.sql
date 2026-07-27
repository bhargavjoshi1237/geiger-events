-- ===========================================================================
-- Geiger Events — Community / Settings / Analytics record stores
--
-- Self-contained and idempotent. Three uniform record tables, one per area,
-- each discriminated by `module` (mirrors events.conference_records):
--   events.community_records  — Polls, Surveys, Announcements
--   events.settings_records   — Team & Members, Roles, API & Webhooks, Domains
--   events.analytics_records  — Scheduled Reports
-- Module-specific fields live in the `config` jsonb bag. No media (no storage
-- policies). Project scoping (project_id NOT NULL + org RLS) is applied last in
-- zz_project_access.sql.
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

-- One table per area — identical shape. Kept explicit (not a loop) so the DDL
-- stays plain and idempotent.

-- community_records ---------------------------------------------------------
create table if not exists events.community_records (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  name text not null default 'Untitled',
  status text not null default 'Draft',
  cover_url text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
drop trigger if exists community_records_touch_updated_at on events.community_records;
create trigger community_records_touch_updated_at
before update on events.community_records
for each row execute function events.touch_updated_at();
create index if not exists events_community_records_module_idx
  on events.community_records (module) where deleted_at is null;
create index if not exists events_community_records_created_idx
  on events.community_records (created_at desc);
alter table events.community_records enable row level security;
drop policy if exists events_community_records_demo_all on events.community_records;
create policy events_community_records_demo_all on events.community_records
  for all to anon, authenticated using (true) with check (true);

-- settings_records ----------------------------------------------------------
create table if not exists events.settings_records (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  name text not null default 'Untitled',
  status text not null default 'Draft',
  cover_url text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
drop trigger if exists settings_records_touch_updated_at on events.settings_records;
create trigger settings_records_touch_updated_at
before update on events.settings_records
for each row execute function events.touch_updated_at();
create index if not exists events_settings_records_module_idx
  on events.settings_records (module) where deleted_at is null;
create index if not exists events_settings_records_created_idx
  on events.settings_records (created_at desc);
alter table events.settings_records enable row level security;
drop policy if exists events_settings_records_demo_all on events.settings_records;
create policy events_settings_records_demo_all on events.settings_records
  for all to anon, authenticated using (true) with check (true);

-- analytics_records ---------------------------------------------------------
create table if not exists events.analytics_records (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  name text not null default 'Untitled',
  status text not null default 'Draft',
  cover_url text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
drop trigger if exists analytics_records_touch_updated_at on events.analytics_records;
create trigger analytics_records_touch_updated_at
before update on events.analytics_records
for each row execute function events.touch_updated_at();
create index if not exists events_analytics_records_module_idx
  on events.analytics_records (module) where deleted_at is null;
create index if not exists events_analytics_records_created_idx
  on events.analytics_records (created_at desc);
alter table events.analytics_records enable row level security;
drop policy if exists events_analytics_records_demo_all on events.analytics_records;
create policy events_analytics_records_demo_all on events.analytics_records
  for all to anon, authenticated using (true) with check (true);
