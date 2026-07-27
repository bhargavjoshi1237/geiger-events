-- ===========================================================================
-- Geiger Events — campaigns module
--
-- Self-contained and idempotent: safe to run repeatedly. Backs the entire
-- Campaigns area:
--   events.campaigns          — one row per campaign (channel/type/status/
--                               audience/schedule + content, A/B and metrics
--                               jsonb bags). Powers the hub + every channel lens.
--   events.campaign_assets    — reusable records store discriminated by `module`
--                               ('template' | 'sequence'): Email Template Builder
--                               and Drip Sequences.
--   events.campaign_settings  — one row per project: Deliverability +
--                               Personalization config (config jsonb bag).
--
-- Records & config only: no message is actually dispatched. Status advances
-- draft -> scheduled -> sent; metrics store honest recipients/delivered counts.
--
-- Runs before events.sql in filename order, so cross-schema FKs to events.events
-- are avoided (event_id is a soft uuid link). touch_updated_at() is declared
-- locally so this file never depends on another migration. Project-scoping RLS
-- (member policy) is finalized in zz_project_access.sql.
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

-- ---------------------------------------------------------------------------
-- campaigns — one row per campaign.
-- ---------------------------------------------------------------------------
create table if not exists events.campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled campaign',
  -- email | sms | whatsapp | push
  channel text not null default 'email',
  -- newsletter | invite | reminder | blast | announcement
  type text not null default 'newsletter',
  -- draft | scheduled | sending | sent | paused
  status text not null default 'draft',
  -- Audience: a saved segment (events.segments). Null = all contacts.
  segment_id uuid,
  -- Soft link to an event (no FK: events.events is created in a later file).
  event_id uuid,
  scheduled_at timestamptz,
  sent_at timestamptz,
  -- { subject, previewText, body, pushTitle, templateId, sequenceId }
  content jsonb not null default '{}'::jsonb,
  -- { enabled, variantB{...}, split, metric, winner }
  ab jsonb not null default '{}'::jsonb,
  -- { recipients, delivered, opened, clicked, bounced, unsubscribed } — honest,
  -- default 0; delivered/recipients set from the chosen audience on send.
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.campaigns add column if not exists segment_id uuid;
alter table events.campaigns add column if not exists event_id uuid;
alter table events.campaigns add column if not exists scheduled_at timestamptz;
alter table events.campaigns add column if not exists sent_at timestamptz;
alter table events.campaigns add column if not exists content jsonb not null default '{}'::jsonb;
alter table events.campaigns add column if not exists ab jsonb not null default '{}'::jsonb;
alter table events.campaigns add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table events.campaigns add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.campaigns add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.campaigns add column if not exists deleted_at timestamptz;

create index if not exists events_campaigns_project_idx
  on events.campaigns (project_id) where deleted_at is null;
create index if not exists events_campaigns_channel_idx
  on events.campaigns (project_id, channel) where deleted_at is null;

drop trigger if exists campaigns_touch_updated_at on events.campaigns;
create trigger campaigns_touch_updated_at
before update on events.campaigns
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_assets — reusable records (templates + drip sequences).
-- ---------------------------------------------------------------------------
create table if not exists events.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- template | sequence
  module text not null default 'template',
  kind text,
  name text not null default 'Untitled',
  active boolean not null default true,
  -- Module-specific config bag (template: subject/blocks; sequence: steps[]).
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.campaign_assets add column if not exists kind text;
alter table events.campaign_assets add column if not exists active boolean not null default true;
alter table events.campaign_assets add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.campaign_assets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.campaign_assets add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.campaign_assets add column if not exists deleted_at timestamptz;

create index if not exists events_campaign_assets_project_module_idx
  on events.campaign_assets (project_id, module) where deleted_at is null;

drop trigger if exists campaign_assets_touch_updated_at on events.campaign_assets;
create trigger campaign_assets_touch_updated_at
before update on events.campaign_assets
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_settings — one row per project (Deliverability + Personalization).
-- ---------------------------------------------------------------------------
create table if not exists events.campaign_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- One top-level key per feature: { deliverability{...}, personalization{...} }.
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.campaign_settings add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.campaign_settings add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.campaign_settings add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.campaign_settings add column if not exists deleted_at timestamptz;

create unique index if not exists events_campaign_settings_project_idx
  on events.campaign_settings (project_id);

drop trigger if exists campaign_settings_touch_updated_at on events.campaign_settings;
create trigger campaign_settings_touch_updated_at
before update on events.campaign_settings
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_settings_merge — upsert the project's settings row and shallow-merge
-- a config patch (a full feature slice, e.g. { deliverability: {…} }) so one
-- tab never clobbers another. Mirrors checkin_settings_merge.
-- ---------------------------------------------------------------------------
create or replace function events.campaign_settings_merge(p_project uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_config jsonb;
begin
  insert into events.campaign_settings (project_id, config)
    values (p_project, coalesce(p_patch, '{}'::jsonb))
  on conflict (project_id) do update
    set config = coalesce(events.campaign_settings.config, '{}'::jsonb)
                 || coalesce(p_patch, '{}'::jsonb)
  returning config into v_config;
  return v_config;
end;
$$;

grant execute on function events.campaign_settings_merge(uuid, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Open demo policies (anon key) — replaced with org-scoped member policies
-- in zz_project_access.sql.
-- ---------------------------------------------------------------------------
alter table events.campaigns enable row level security;
alter table events.campaign_assets enable row level security;
alter table events.campaign_settings enable row level security;

drop policy if exists events_campaigns_demo_all on events.campaigns;
create policy events_campaigns_demo_all on events.campaigns
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_campaign_assets_demo_all on events.campaign_assets;
create policy events_campaign_assets_demo_all on events.campaign_assets
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_campaign_settings_demo_all on events.campaign_settings;
create policy events_campaign_settings_demo_all on events.campaign_settings
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. Rows are project-scoped and created in-app.
