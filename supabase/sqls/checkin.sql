-- ===========================================================================
-- Geiger Events — check-in module
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the four
-- tables that back the Check-in area:
--   events.checkin_settings   — one row per project: global feature flags +
--                               per-feature config (config jsonb bag).
--   events.checkin_attendance — check-in records (who/when/gate/zone/session/
--                               method/staff). Source of truth for Real-time
--                               Attendance and the Phase-2 scanner routes.
--   events.checkin_staff_roles — staff scanning roles + their access code/PIN
--                               (the Phase-2 route auth backbone).
--   events.checkin_leads      — lead-retrieval captures (exhibitor scans),
--                               exported as CSV.
--
-- Per-EVENT check-in config is NOT here — it lives in events.events.metadata
-- under the `checkin` key (written via event_merge_meta), gated on the global
-- feature being enabled.
--
-- Runs after events.sql (filename order) so events.touch_updated_at() exists.
-- Project-scoping RLS (member policy) is finalized in zz_project_access.sql,
-- alongside the other dashboard entities.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- checkin_settings — one row per project.
-- ---------------------------------------------------------------------------
create table if not exists events.checkin_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Global feature flags + per-feature config. One top-level key per feature
  -- (qrTickets, walletPasses, checkinApp, doorSales, kiosk, session, rfid,
  -- selfCheckin, multiGate, badge, offline), each a { enabled, …settings } bag.
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.checkin_settings add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.checkin_settings add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.checkin_settings add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.checkin_settings add column if not exists deleted_at timestamptz;

-- One settings row per project.
create unique index if not exists events_checkin_settings_project_idx
  on events.checkin_settings (project_id);

drop trigger if exists checkin_settings_touch_updated_at on events.checkin_settings;
create trigger checkin_settings_touch_updated_at
before update on events.checkin_settings
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- checkin_attendance — one row per check-in.
-- ---------------------------------------------------------------------------
create table if not exists events.checkin_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events.events(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  -- The attendee, denormalized so a record survives even if the source row is
  -- edited. One of registration_id / order_id links back when available.
  registration_id uuid,
  order_id uuid,
  attendee_name text not null default '',
  ticket_code text,
  gate text,
  zone text,
  session_id text,
  -- qr | manual | self | kiosk | rfid | door
  method text not null default 'manual',
  checked_in_by text,
  -- in = currently checked in; out = checked out (re-entry tracking).
  status text not null default 'in',
  checked_in_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.checkin_attendance add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.checkin_attendance add column if not exists session_id text;
alter table events.checkin_attendance add column if not exists zone text;
alter table events.checkin_attendance add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.checkin_attendance add column if not exists deleted_at timestamptz;

create index if not exists events_checkin_attendance_event_idx
  on events.checkin_attendance (event_id) where deleted_at is null;
create index if not exists events_checkin_attendance_project_idx
  on events.checkin_attendance (project_id) where deleted_at is null;

drop trigger if exists checkin_attendance_touch_updated_at on events.checkin_attendance;
create trigger checkin_attendance_touch_updated_at
before update on events.checkin_attendance
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- checkin_staff_roles — staff scanning roles + access code/PIN.
-- ---------------------------------------------------------------------------
create table if not exists events.checkin_staff_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled role',
  -- staff = /checkin + /door routes; kiosk = the /kiosk route. Separate code
  -- spaces so a leaked staff code can't unlock a kiosk and vice versa.
  type text not null default 'staff',
  -- { canScan, canSell, canOverride, gates[], zones[] }
  permissions jsonb not null default '{}'::jsonb,
  -- Shared PIN staff enter to open the Phase-2 routes for this role.
  access_code text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.checkin_staff_roles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table events.checkin_staff_roles add column if not exists access_code text;
alter table events.checkin_staff_roles add column if not exists active boolean not null default true;
alter table events.checkin_staff_roles add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.checkin_staff_roles add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.checkin_staff_roles add column if not exists deleted_at timestamptz;
alter table events.checkin_staff_roles add column if not exists type text not null default 'staff';

alter table events.checkin_staff_roles drop constraint if exists checkin_staff_roles_type_check;
alter table events.checkin_staff_roles add constraint checkin_staff_roles_type_check
  check (type in ('staff', 'kiosk'));

create index if not exists events_checkin_staff_roles_project_idx
  on events.checkin_staff_roles (project_id) where deleted_at is null;

drop trigger if exists checkin_staff_roles_touch_updated_at on events.checkin_staff_roles;
create trigger checkin_staff_roles_touch_updated_at
before update on events.checkin_staff_roles
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- checkin_leads — exhibitor/sponsor lead captures.
-- ---------------------------------------------------------------------------
create table if not exists events.checkin_leads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events.events(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  exhibitor text,
  attendee_name text not null default '',
  -- { email, phone, company, title, notes }
  contact jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.checkin_leads add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.checkin_leads add column if not exists contact jsonb not null default '{}'::jsonb;
alter table events.checkin_leads add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.checkin_leads add column if not exists deleted_at timestamptz;

create index if not exists events_checkin_leads_event_idx
  on events.checkin_leads (event_id) where deleted_at is null;
create index if not exists events_checkin_leads_project_idx
  on events.checkin_leads (project_id) where deleted_at is null;

drop trigger if exists checkin_leads_touch_updated_at on events.checkin_leads;
create trigger checkin_leads_touch_updated_at
before update on events.checkin_leads
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- checkin_settings_merge — upsert the project's settings row and shallow-merge
-- a config patch. The screen sends a full feature slice (e.g. { doorSales: {…} })
-- so a top-level shallow merge never clobbers another feature's slice.
-- ---------------------------------------------------------------------------
create or replace function events.checkin_settings_merge(p_project uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_config jsonb;
begin
  insert into events.checkin_settings (project_id, config)
    values (p_project, coalesce(p_patch, '{}'::jsonb))
  on conflict (project_id) do update
    set config = coalesce(events.checkin_settings.config, '{}'::jsonb)
                 || coalesce(p_patch, '{}'::jsonb)
  returning config into v_config;
  return v_config;
end;
$$;

grant execute on function events.checkin_settings_merge(uuid, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Open demo policies (anon key) — replaced with org-scoped member policies
-- in zz_project_access.sql.
-- ---------------------------------------------------------------------------
alter table events.checkin_settings enable row level security;
alter table events.checkin_attendance enable row level security;
alter table events.checkin_staff_roles enable row level security;
alter table events.checkin_leads enable row level security;

drop policy if exists events_checkin_settings_demo_all on events.checkin_settings;
create policy events_checkin_settings_demo_all on events.checkin_settings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_checkin_attendance_demo_all on events.checkin_attendance;
create policy events_checkin_attendance_demo_all on events.checkin_attendance
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_checkin_staff_roles_demo_all on events.checkin_staff_roles;
create policy events_checkin_staff_roles_demo_all on events.checkin_staff_roles
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_checkin_leads_demo_all on events.checkin_leads;
create policy events_checkin_leads_demo_all on events.checkin_leads
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. Rows are project-scoped and created in-app.
