-- ===========================================================================
-- Geiger Events — memberships members store
--
-- Self-contained and idempotent. Membership *plans* are stored as reusable
-- records in events.ticketing_records (module 'membership') so they attach to
-- events exactly like tickets/coupons — no table here. This file adds only the
-- enrollment roster:
--   * events.membership_members — who holds which membership, and its lifecycle.
--
-- The master enable + join settings live in events.ticketing_settings (module
-- 'membership'). Runs after ticketing_settings.sql; defines touch_updated_at()
-- locally. Member-scoped RLS is finalized in zz_project_access.sql.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.membership_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- The plan this enrollment is for (a ticketing_records row, module 'membership').
  membership_id uuid references events.ticketing_records(id) on delete set null,
  name text not null default '',
  email text not null default '',
  -- Active · Expired · Cancelled
  status text not null default 'Active',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists membership_members_touch_updated_at on events.membership_members;
create trigger membership_members_touch_updated_at
before update on events.membership_members
for each row execute function events.touch_updated_at();

create index if not exists events_membership_members_project_idx
  on events.membership_members (project_id) where deleted_at is null;
create index if not exists events_membership_members_membership_idx
  on events.membership_members (membership_id) where deleted_at is null;
create index if not exists events_membership_members_created_idx
  on events.membership_members (created_at desc);

alter table events.membership_members enable row level security;
drop policy if exists events_membership_members_demo_all on events.membership_members;
create policy events_membership_members_demo_all on events.membership_members
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. All rows are project-scoped and created in-app.
