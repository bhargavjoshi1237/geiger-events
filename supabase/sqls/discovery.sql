-- ===========================================================================
-- Geiger Events — Discovery (organiser profile + followers)
--
-- The single "Discovery" destination: a project's public organiser profile and
-- the audience that follows it. Self-contained and idempotent — safe to re-run.
--
--   events.organiser_profile   one row per project (public identity)
--   events.organiser_followers one row per (project, email) — the audience
--   events.follow_organiser()  SECURITY DEFINER capture RPC for the public page
--
-- The public /w/<slug> Event Wall renders the profile and a Follow button;
-- anonymous buyers follow through the RPC (granted to anon), mirroring the
-- register()/buy_ticket() public-capture pattern. touch_updated_at() is declared
-- locally so this file never depends on another migration. Project-scoping RLS
-- (member policy + public profile read) is finalized in zz_project_access.sql;
-- an open demo policy here keeps a pre-zz database working.
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
-- organiser_profile — the project's public identity. One row per project.
-- Images are stored as URLs (like the Event Wall logo), so no storage RLS.
-- ---------------------------------------------------------------------------
create table if not exists events.organiser_profile (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  display_name text not null default '',
  tagline text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  banner_url text not null default '',
  website text not null default '',
  location text not null default '',
  contact_email text not null default '',
  -- Ordered social links: [{ label, url }].
  links jsonb not null default '[]'::jsonb,
  -- Expansion bag for not-yet-promoted attributes.
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One profile per project.
create unique index if not exists events_organiser_profile_project_idx
  on events.organiser_profile (project_id) where deleted_at is null;

drop trigger if exists organiser_profile_touch_updated_at on events.organiser_profile;
create trigger organiser_profile_touch_updated_at
before update on events.organiser_profile
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- organiser_followers — the audience. One row per (project, email).
-- Hard-deleted on unfollow (no soft-delete: an unfollow should free the email
-- to re-follow later).
-- ---------------------------------------------------------------------------
create table if not exists events.organiser_followers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  name text not null default '',
  -- Where the follow came from (wall, event page, import…).
  source text not null default 'wall',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- One follow per email per project (case-insensitive).
create unique index if not exists events_organiser_followers_project_email_idx
  on events.organiser_followers (project_id, lower(email));
create index if not exists events_organiser_followers_project_idx
  on events.organiser_followers (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- follow_organiser() — public capture RPC. SECURITY DEFINER so an anonymous
-- visitor can subscribe without a table-level anon policy. Idempotent: a repeat
-- follow with the same email is a no-op (returns true). Returns false only on a
-- bad/empty email.
-- ---------------------------------------------------------------------------
create or replace function events.follow_organiser(
  p_project_id uuid,
  p_email text,
  p_name text default ''
)
returns boolean
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if p_project_id is null or coalesce(trim(p_email), '') = '' then
    return false;
  end if;

  insert into events.organiser_followers (project_id, email, name, source)
  values (p_project_id, lower(trim(p_email)), coalesce(trim(p_name), ''), 'wall')
  on conflict (project_id, lower(email)) do nothing;

  return true;
end;
$$;

grant execute on function events.follow_organiser(uuid, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Open demo policies (anon key) so a pre-zz database works; replaced with
-- org-scoped member policies (+ a public profile read) in zz_project_access.sql.
-- ---------------------------------------------------------------------------
alter table events.organiser_profile enable row level security;
drop policy if exists organiser_profile_demo_all on events.organiser_profile;
create policy organiser_profile_demo_all on events.organiser_profile
  for all to anon, authenticated using (true) with check (true);

alter table events.organiser_followers enable row level security;
drop policy if exists organiser_followers_demo_all on events.organiser_followers;
create policy organiser_followers_demo_all on events.organiser_followers
  for all to anon, authenticated using (true) with check (true);
