-- @up
-- ===========================================================================
-- Geiger Events — saved page layouts
--
-- A layout is a reusable arrangement of an event page: the builder's section →
-- row → column → block tree, plus the theme snapshot it was designed against.
-- Saving one in the page builder makes it available to every event in the
-- project, which is the whole point — design work done once should not be
-- trapped on the event it was done for.
--
-- Mirrors events.event_templates: project-scoped, soft-deleted, org-membership
-- RLS via events.can_access_project(). `uses` counts how many times the layout
-- has been applied to a page.
--
-- Self-contained and idempotent: safe to re-run via `npm run db:push`.
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

create table if not exists events.page_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Untitled layout',
  description text,
  category text not null default 'Saved',
  -- The page_tree document: { version, sections: [...] }.
  tree jsonb not null default '{}'::jsonb,
  -- The theme the layout was designed against. Applied over the event's own
  -- theme when the layout is used, so the arrangement arrives looking right.
  theme jsonb not null default '{}'::jsonb,
  uses integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate an older copy of the table by back-filling anything missing.
alter table events.page_layouts add column if not exists description text;
alter table events.page_layouts add column if not exists category text not null default 'Saved';
alter table events.page_layouts add column if not exists theme jsonb not null default '{}'::jsonb;
alter table events.page_layouts add column if not exists uses integer not null default 0;
alter table events.page_layouts add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.page_layouts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.page_layouts add column if not exists deleted_at timestamptz;

drop trigger if exists page_layouts_touch_updated_at on events.page_layouts;
create trigger page_layouts_touch_updated_at
before update on events.page_layouts
for each row execute function events.touch_updated_at();

create index if not exists events_page_layouts_project_idx
  on events.page_layouts (project_id) where deleted_at is null;
create index if not exists events_page_layouts_updated_idx
  on events.page_layouts (updated_at desc);

-- RLS: the same org-membership check every other project-scoped events table
-- uses. Layouts are an authoring surface only — no public read.
alter table events.page_layouts enable row level security;

drop policy if exists page_layouts_member_all on events.page_layouts;
create policy page_layouts_member_all on events.page_layouts
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));
