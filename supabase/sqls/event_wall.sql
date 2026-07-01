-- ===========================================================================
-- Geiger Events — Event Wall (public listing page)
--
-- Self-contained and idempotent. A single workspace-wide "wall" row controls
-- the public page (/w/<slug>) that lists every event marked
-- events.events.is_listable (see events.sql). The row is a singleton — the app
-- always targets the seeded id below, no lookup needed.
-- ===========================================================================

create extension if not exists pgcrypto;

-- Defined here too (idempotent "create or replace") so this file doesn't
-- depend on events.sql having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.event_wall (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Events',
  tagline text not null default '',
  logo_url text,
  slug text not null default 'events',
  -- Expansion bag: theme (reuses lib/events/theme.js), filters (status/sort),
  -- featured (pinned event ids). Promote to a column if one needs indexing.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists flow_event_wall_slug_idx
  on events.event_wall (slug);

drop trigger if exists event_wall_touch_updated_at on events.event_wall;
create trigger event_wall_touch_updated_at
before update on events.event_wall
for each row execute function events.touch_updated_at();

alter table events.event_wall enable row level security;

drop policy if exists flow_event_wall_demo_all on events.event_wall;
create policy flow_event_wall_demo_all on events.event_wall
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Shallow-merge RPC for the metadata bag — mirrors events.event_merge_meta.
create or replace function events.event_wall_merge_meta(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events
as $$
declare
  v_meta jsonb;
begin
  update events.event_wall
    set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id
    returning metadata into v_meta;
  return v_meta;
end;
$$;

grant execute on function events.event_wall_merge_meta(uuid, jsonb)
  to anon, authenticated;

-- Singleton seed — stable id so the data layer can target it directly.
insert into events.event_wall (id, name, tagline, slug)
values (
  '44444444-4444-4444-8444-000000000001',
  'Our Events',
  'Discover what''s happening.',
  'events'
)
on conflict (id) do nothing;
