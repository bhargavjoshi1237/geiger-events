-- ===========================================================================
-- Geiger Events — Team & Members + Roles & Permissions
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the four
-- events tables that back the two Settings screens, their indexes, updated_at
-- triggers, an org-member sync RPC, and open demo RLS.
--
--   events.roles            — role definitions (system + custom) per project
--   events.project_members  — per-project assignment overlay (role/status/groups)
--   events.member_groups    — sub-teams within a project
--   events.member_activity  — append-only audit feed
--
-- Members are READ from the real org (public.organization_users ⋈ public.users)
-- and projected into events.project_members by events.sync_project_team(); the
-- overlay carries the app-specific role/status/group assignment. The screen's
-- source of truth is the overlay, so the module works even when the org read is
-- unavailable (the sync is exception-guarded).
--
-- Project scoping (project_id column exists here; the member-scoped RLS swap is
-- applied last in zz_project_access.sql, alongside the other dashboard entities).
-- Depends on events.touch_updated_at() (declared locally so this file stands
-- alone).
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
-- roles — the role catalog. `permissions` holds dot-namespaced keys from
-- lib/rbac.js (WORKSPACE_PERMISSIONS). System roles are seeded by the app
-- (ensureSystemRoles) with is_system=true; the UI locks their toggles.
-- ---------------------------------------------------------------------------
create table if not exists events.roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled role',
  description text not null default '',
  -- Semantic color token key (see settings/constants.js ROLE_COLORS).
  color text not null default 'slate',
  -- Permission keys this role grants (WORKSPACE_PERMISSIONS[].key).
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  sort integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.roles add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.roles add column if not exists permissions text[] not null default '{}';
alter table events.roles add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.roles add column if not exists deleted_at timestamptz;

drop trigger if exists roles_touch_updated_at on events.roles;
create trigger roles_touch_updated_at
before update on events.roles
for each row execute function events.touch_updated_at();

create index if not exists events_roles_project_idx
  on events.roles (project_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- project_members — the assignment overlay. One row per person with access to
-- the project. user_id is a soft reference (no FK) so an invited-but-not-yet
-- registered person can hold a row keyed by email alone. name/email/avatar are
-- denormalized snapshots for display.
-- ---------------------------------------------------------------------------
create table if not exists events.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid,
  role_id uuid references events.roles(id) on delete set null,
  status text not null default 'active',   -- active | invited | suspended
  email text not null default '',
  name text not null default '',
  avatar_url text,
  -- Groups this member belongs to (events.member_groups ids).
  group_ids uuid[] not null default '{}',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  last_active_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.project_members add column if not exists group_ids uuid[] not null default '{}';
alter table events.project_members add column if not exists avatar_url text;
alter table events.project_members add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.project_members add column if not exists deleted_at timestamptz;

drop trigger if exists project_members_touch_updated_at on events.project_members;
create trigger project_members_touch_updated_at
before update on events.project_members
for each row execute function events.touch_updated_at();

create index if not exists events_project_members_project_idx
  on events.project_members (project_id) where deleted_at is null;
create index if not exists events_project_members_groups_idx
  on events.project_members using gin (group_ids);
-- One overlay row per user / per invited email within a project.
create unique index if not exists events_project_members_user_uniq
  on events.project_members (project_id, user_id) where user_id is not null and deleted_at is null;
create unique index if not exists events_project_members_email_uniq
  on events.project_members (project_id, lower(email)) where email <> '' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- member_groups — sub-teams. Membership is stored as an array on the member
-- (project_members.group_ids), so no join table is needed.
-- ---------------------------------------------------------------------------
create table if not exists events.member_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled group',
  description text not null default '',
  color text not null default 'slate',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.member_groups add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.member_groups add column if not exists deleted_at timestamptz;

drop trigger if exists member_groups_touch_updated_at on events.member_groups;
create trigger member_groups_touch_updated_at
before update on events.member_groups
for each row execute function events.touch_updated_at();

create index if not exists events_member_groups_project_idx
  on events.member_groups (project_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- member_activity — append-only audit feed (no updated_at / soft delete).
-- action: invited | role_changed | status_changed | removed | group_changed |
--         role_created | role_updated | role_deleted | group_created
-- ---------------------------------------------------------------------------
create table if not exists events.member_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid,
  actor_name text not null default '',
  target_member_id uuid,
  target_name text not null default '',
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_member_activity_project_idx
  on events.member_activity (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Org-member sync. SECURITY DEFINER so it can read the shared public tables
-- regardless of their RLS. Exception-guarded: a shared-schema mismatch (missing
-- table/column) degrades to a no-op rather than raising — the overlay simply
-- isn't enriched and the screen shows whoever has been added/invited.
--
-- For each member of the project's owning organization that lacks an overlay
-- row, insert one with the default role and status 'active'.
-- ---------------------------------------------------------------------------
create or replace function events.sync_project_team(
  p_project_id uuid,
  p_default_role uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, events, auth
as $$
declare
  v_org uuid;
  v_count integer := 0;
begin
  if p_project_id is null then
    return 0;
  end if;

  select organization_id into v_org from public.projects where id = p_project_id;
  if v_org is null then
    return 0;
  end if;

  insert into events.project_members (project_id, user_id, role_id, status, email, name, joined_at)
  select
    p_project_id,
    u.id,
    p_default_role,
    'active',
    coalesce(u.email, ''),
    coalesce(u.name, split_part(coalesce(u.email, ''), '@', 1)),
    now()
  from public.organization_users ou
  join public.users u on u.id = ou.user_id
  where ou.organization_id = v_org
    and not exists (
      select 1 from events.project_members m
      where m.project_id = p_project_id
        and m.user_id = u.id
        and m.deleted_at is null
    );

  get diagnostics v_count = row_count;
  return v_count;
exception
  when others then
    -- Shared-schema shape differs (or table absent) — skip enrichment silently.
    return 0;
end;
$$;

grant execute on function events.sync_project_team(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Open demo policies (anon key) — replaced with org-scoped member policies
-- in zz_project_access.sql.
-- ---------------------------------------------------------------------------
alter table events.roles enable row level security;
alter table events.project_members enable row level security;
alter table events.member_groups enable row level security;
alter table events.member_activity enable row level security;

drop policy if exists events_roles_demo_all on events.roles;
create policy events_roles_demo_all on events.roles
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_project_members_demo_all on events.project_members;
create policy events_project_members_demo_all on events.project_members
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_member_groups_demo_all on events.member_groups;
create policy events_member_groups_demo_all on events.member_groups
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_member_activity_demo_all on events.member_activity;
create policy events_member_activity_demo_all on events.member_activity
  for all to anon, authenticated using (true) with check (true);
