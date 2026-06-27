-- ===========================================================================
-- Geiger Events — event series store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- public.flow_event_series table, links events to a series via a series_id FK
-- on public.flow_events, adds a settings-merge RPC, RLS, and seeds the demo
-- series with the SAME ids the app ships in sample_data.js.
--
-- A series groups related events under one banner. Shared settings (defaults
-- applied to new events, cadence/recurrence, member order, follow page) live in
-- the `settings` jsonb bag and are shallow-merged per editor tab so saving one
-- tab never clobbers another.
--
-- Runs after events.sql (filename order), so public.flow_events already exists
-- when we add its series_id column. Depends on public.flow_touch_updated_at().
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists public.flow_event_series (
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
alter table public.flow_event_series add column if not exists description text;
alter table public.flow_event_series add column if not exists status text not null default 'Draft';
alter table public.flow_event_series add column if not exists cadence text not null default 'Monthly';
alter table public.flow_event_series add column if not exists visibility text not null default 'Public';
alter table public.flow_event_series add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.flow_event_series add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.flow_event_series add column if not exists deleted_at timestamptz;

-- The link: an event belongs to at most one series. ON DELETE SET NULL so
-- deleting a series un-groups its events rather than destroying them.
alter table public.flow_events
  add column if not exists series_id uuid references public.flow_event_series(id) on delete set null;

create index if not exists flow_events_series_idx
  on public.flow_events (series_id) where deleted_at is null;

drop trigger if exists flow_event_series_touch_updated_at on public.flow_event_series;
create trigger flow_event_series_touch_updated_at
before update on public.flow_event_series
for each row execute function public.flow_touch_updated_at();

create index if not exists flow_event_series_status_idx
  on public.flow_event_series (status) where deleted_at is null;
create index if not exists flow_event_series_created_idx
  on public.flow_event_series (created_at desc);

-- Shallow-merge a settings patch into the series. One top-level key per editor
-- tab (defaults, recurrence, eventOrder, followPage) so tabs don't clobber.
create or replace function public.flow_series_merge_settings(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  update public.flow_event_series
    set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id and deleted_at is null
    returning settings into v_settings;
  return v_settings;
end;
$$;

grant execute on function public.flow_series_merge_settings(uuid, jsonb)
  to anon, authenticated;

-- RLS. Open demo policy (anon key) — replace with an org-scoped policy on auth.
alter table public.flow_event_series enable row level security;

drop policy if exists flow_event_series_demo_all on public.flow_event_series;
create policy flow_event_series_demo_all on public.flow_event_series
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Seed — same ids as components/internal/screens/events/sample_data.js. Then
-- attach the matching seed events to their series (ids from events.sql).
insert into public.flow_event_series
  (id, name, description, status, cadence, visibility, settings)
values
  ('22222222-2222-4222-8222-000000000001', 'Founder Sessions', 'A monthly run of founder AMAs and live customer webinars.', 'On sale', 'Monthly', 'Public',
   '{"defaults":{"type":"Online","visibility":"Public","timezone":"Europe/London","organizer":"Ava Mitchell"},"followPage":true}'::jsonb),
  ('22222222-2222-4222-8222-000000000002', 'Hands-on Workshops', 'Practical, limited-seat workshops across design and craft.', 'On sale', 'Monthly', 'Public',
   '{"defaults":{"type":"In-person","visibility":"Public","timezone":"Europe/London"},"followPage":true}'::jsonb),
  ('22222222-2222-4222-8222-000000000003', 'Quarterly Town Hall', 'Company-wide town halls, once a quarter.', 'Scheduled', 'Quarterly', 'Unlisted',
   '{"defaults":{"type":"Hybrid","visibility":"Unlisted","timezone":"Europe/London"},"followPage":false}'::jsonb),
  ('22222222-2222-4222-8222-000000000004', 'Summer Concert Run', 'A themed run of summer gigs at partner venues.', 'Draft', 'Custom', 'Public',
   '{"defaults":{"type":"In-person","visibility":"Public","timezone":"Europe/London"},"followPage":true}'::jsonb)
on conflict (id) do nothing;

update public.flow_events set series_id = '22222222-2222-4222-8222-000000000001'
  where id in (
    'c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03',
    '072941df-6081-42a3-de45-7f8091a2b307'
  ) and series_id is null;

update public.flow_events set series_id = '22222222-2222-4222-8222-000000000002'
  where id in (
    'd4f618ac-3d5e-4f70-ab12-4c5d6e7f8004',
    '183a52e0-7192-43b4-ef56-8091a2b3c408'
  ) and series_id is null;
