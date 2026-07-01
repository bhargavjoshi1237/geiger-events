-- ===========================================================================
-- Geiger Events — event templates store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.event_templates table, its indexes, RLS, and seeds the six demo
-- templates with the SAME ids the app ships in sample_data.js so the screen
-- resolves to real rows once the DB is live.
--
-- A template is a reusable starting point: its `blueprint` (stored in the
-- metadata bag) holds the event defaults applied when you "Use" it to spin up a
-- new draft event. `uses` tracks how many events were created from it.
--
-- Depends on events.touch_updated_at() (events.sql). Apply via the Supabase
-- SQL editor (or `npm run db:push`).
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled template',
  description text,
  category text not null default 'Community',
  -- Lucide icon name (string) — the screen maps it to a component. Kept as data
  -- so the table carries no JSX coupling.
  icon text not null default 'Sparkles',
  uses integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag. `blueprint` lives here: the event defaults (type, capacity,
  -- visibility, timezone, summary, …) applied when the template is used.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.event_templates add column if not exists description text;
alter table events.event_templates add column if not exists category text not null default 'Community';
alter table events.event_templates add column if not exists icon text not null default 'Sparkles';
alter table events.event_templates add column if not exists uses integer not null default 0;
alter table events.event_templates add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.event_templates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.event_templates add column if not exists deleted_at timestamptz;

drop trigger if exists event_templates_touch_updated_at on events.event_templates;
create trigger event_templates_touch_updated_at
before update on events.event_templates
for each row execute function events.touch_updated_at();

create index if not exists flow_event_templates_category_idx
  on events.event_templates (category) where deleted_at is null;
create index if not exists flow_event_templates_created_idx
  on events.event_templates (created_at desc);

-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
alter table events.event_templates enable row level security;

drop policy if exists flow_event_templates_demo_all on events.event_templates;
create policy flow_event_templates_demo_all on events.event_templates
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- No demo seed. Templates are project-scoped (see zz_project_access.sql) and
-- created in-app against a real project.
