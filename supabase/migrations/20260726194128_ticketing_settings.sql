-- ===========================================================================
-- Geiger Events — ticketing settings + transactional logs
--
-- Self-contained and idempotent. Adds three project-scoped stores that back the
-- rest of the Tickets area:
--   * events.ticketing_settings — one row per (project, module): the project-
--     global config for a Tickets feature (Early-bird, Donations, Access-code,
--     Reserved Seating, Refunds, Payment Plans, Transfers, Group Purchasing,
--     Memberships). Module-specific settings live in the `config` jsonb bag so a
--     new feature needs no migration. Mirrors dietary_config's one-row-per-scope
--     shape, but keyed by (project, module) so one table serves every feature.
--   * events.refund_requests  — the inbox of buyer refund requests.
--   * events.group_purchases  — group/bulk purchases logged across events.
--
-- Runs after ticketing.sql (filename order); defines events.touch_updated_at()
-- locally so it doesn't depend on another migration. Member-scoped RLS is
-- finalized in zz_project_access.sql alongside the other dashboard entities.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger fn (defined locally; suite convention).
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-(project, module) config store.
-- ---------------------------------------------------------------------------
create table if not exists events.ticketing_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Which Tickets feature this row configures:
  --   earlybird | donation | access_code | reserved_seating | refund |
  --   payment_plan | transfer | group_purchase | membership
  module text not null,
  -- Feature-specific settings bag; promote a key to a column once it needs
  -- indexing/constraints.
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One config row per feature per project.
  constraint ticketing_settings_project_module_key unique (project_id, module)
);

alter table events.ticketing_settings add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.ticketing_settings add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists ticketing_settings_touch_updated_at on events.ticketing_settings;
create trigger ticketing_settings_touch_updated_at
before update on events.ticketing_settings
for each row execute function events.touch_updated_at();

alter table events.ticketing_settings enable row level security;
drop policy if exists events_ticketing_settings_demo_all on events.ticketing_settings;
create policy events_ticketing_settings_demo_all on events.ticketing_settings
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Refund requests inbox.
-- ---------------------------------------------------------------------------
create table if not exists events.refund_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  order_id uuid references events.event_orders(id) on delete set null,
  buyer_name text not null default '',
  buyer_email text not null default '',
  reason text not null default '',
  amount numeric not null default 0,
  -- Requested · Approved · Denied · Refunded
  status text not null default 'Requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists refund_requests_touch_updated_at on events.refund_requests;
create trigger refund_requests_touch_updated_at
before update on events.refund_requests
for each row execute function events.touch_updated_at();

create index if not exists events_refund_requests_project_idx
  on events.refund_requests (project_id) where deleted_at is null;
create index if not exists events_refund_requests_created_idx
  on events.refund_requests (created_at desc);

alter table events.refund_requests enable row level security;
drop policy if exists events_refund_requests_demo_all on events.refund_requests;
create policy events_refund_requests_demo_all on events.refund_requests
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Group purchases log.
-- ---------------------------------------------------------------------------
create table if not exists events.group_purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  organizer_name text not null default '',
  organizer_email text not null default '',
  seats integer not null default 0,
  total numeric not null default 0,
  code text,
  -- Pending · Confirmed · Cancelled
  status text not null default 'Pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists group_purchases_touch_updated_at on events.group_purchases;
create trigger group_purchases_touch_updated_at
before update on events.group_purchases
for each row execute function events.touch_updated_at();

create index if not exists events_group_purchases_project_idx
  on events.group_purchases (project_id) where deleted_at is null;
create index if not exists events_group_purchases_created_idx
  on events.group_purchases (created_at desc);

alter table events.group_purchases enable row level security;
drop policy if exists events_group_purchases_demo_all on events.group_purchases;
create policy events_group_purchases_demo_all on events.group_purchases
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. All rows are project-scoped and created in-app.
