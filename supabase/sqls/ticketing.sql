-- ===========================================================================
-- Geiger Events — ticketing records store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.ticketing_records table — one uniform, project-scoped store shared by
-- every global Tickets module (Discounts & Codes, Payments & Methods, Payouts,
-- Dynamic Pricing, Order Policies, Invoices & Receipts). Rows are discriminated
-- by `module`; module-specific settings live in the `config` jsonb bag so a new
-- module needs no migration.
--
-- These are REUSABLE records: created and managed here, then attached to an
-- event from the event editor (the event stores attached ids in its own
-- metadata bag — see event_merge_meta), so one coupon/policy/method can apply
-- to many events.
--
-- Runs after events.sql (filename order) so events.touch_updated_at() exists.
-- Project scoping RLS (member policy) is finalized in zz_project_access.sql,
-- alongside the other dashboard entities.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.ticketing_records (
  id uuid primary key default gen_random_uuid(),
  -- The owning project. Access is scoped to project members (org membership)
  -- via RLS — finalized in zz_project_access.sql.
  project_id uuid references public.projects(id) on delete cascade,
  -- Which module this row belongs to:
  --   discount | payment_method | payout | pricing_rule | order_policy | invoice_profile
  module text not null,
  -- Optional subtype within a module (e.g. discount: coupon|group|earlybird|
  -- affiliate; payment_method: stripe|paypal|bank; pricing_rule: demand|resale).
  kind text,
  name text not null default 'Untitled',
  active boolean not null default true,
  -- Module-specific settings. Kept in a bag so modules evolve without a
  -- migration; promote a key to a column once it needs indexing/constraints.
  config jsonb not null default '{}'::jsonb,
  -- The owner (creator).
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill missing columns on older copies of the table.
alter table events.ticketing_records add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.ticketing_records add column if not exists kind text;
alter table events.ticketing_records add column if not exists active boolean not null default true;
alter table events.ticketing_records add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.ticketing_records add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.ticketing_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.ticketing_records add column if not exists deleted_at timestamptz;

create index if not exists events_ticketing_records_project_module_idx
  on events.ticketing_records (project_id, module) where deleted_at is null;
create index if not exists events_ticketing_records_created_idx
  on events.ticketing_records (created_at desc);

drop trigger if exists ticketing_records_touch_updated_at on events.ticketing_records;
create trigger ticketing_records_touch_updated_at
before update on events.ticketing_records
for each row execute function events.touch_updated_at();

-- RLS. Open demo policy (anon key) — replaced with an org-scoped member policy
-- in zz_project_access.sql.
alter table events.ticketing_records enable row level security;

drop policy if exists events_ticketing_records_demo_all on events.ticketing_records;
create policy events_ticketing_records_demo_all on events.ticketing_records
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- No demo seed. Records are project-scoped and created in-app.
