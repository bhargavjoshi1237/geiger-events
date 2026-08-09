-- Make RBAC the real gate for the Team & Roles screens
--
-- The adopt_rbac migration created the storage (public.roles,
-- events.role_grants) and backfilled it, but left two holes that kept the two
-- Settings screens from actually operating it:
--
--   1. events.sync_project_team() read `public.users` and
--      `public.organization_users(user_id, organization_id)`. Neither exists in
--      this database — the shared table has columns "user" and "organization",
--      and identity lives in auth.users. The function is exception-guarded, so
--      it silently returned 0 forever and the roster stayed empty no matter how
--      many people were in the org.
--   2. Nothing granted a role to somebody joining a project. With the UI about
--      to enforce for real, a member with no grant row gets an empty sidebar.
--
-- Owns (transferring ownership of the first from 20260726194123_team.sql, which
-- can no longer be edited):
--   events.sync_project_team(uuid, uuid)      org -> roster + default grant
--   events.rbac_ensure_membership(uuid, uuid) the caller's own roster row + grant
--   events.role_grants write policy           who may assign roles
--
-- ROLE AUTHORITY MOVES TO GRANTS. events.project_members stays the display and
-- invitation overlay (email, name, avatar, status, groups); which role someone
-- holds is events.role_grants and nothing else. project_members.role_id is left
-- in place and still stamped for invited-but-unregistered rows, which have no
-- user_id to grant to.
--
-- public.roles keeps its open write policy on purpose: it is shared suite-wide,
-- so tightening it is a suite-level decision, not this product's to make. Role
-- editing is gated in the UI on events.role.manage.

-- @up
create schema if not exists events;

-- ---------------------------------------------------------------------------
-- Roster identity. auth.users is the only account table in this database; a
-- SECURITY DEFINER wrapper is how a member reads a teammate's email without
-- being granted the auth schema.
--
-- The org link is public.organization_users("user", "organization") — quoted
-- because both are reserved-ish words and neither matches the *_id naming the
-- previous version assumed.
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
  v_creator uuid;
  v_member_role uuid;
  v_owner_role uuid;
  v_count integer := 0;
begin
  if p_project_id is null then
    return 0;
  end if;

  select organization_id, created_by
    into v_org, v_creator
    from public.projects
   where id = p_project_id;

  -- The role every synced member is granted. Prefer the caller's choice, then
  -- the project's own "member" role; a project whose roles have not been seeded
  -- yet gets a roster row but no grant, and picks the grant up on the next pass.
  select coalesce(
           p_default_role,
           (select r.id from public.roles r
             where r.project_id = p_project_id
               and r.key = 'member'
               and r.deleted_at is null
             limit 1)
         )
    into v_member_role;

  select r.id into v_owner_role
    from public.roles r
   where r.project_id = p_project_id
     and r.key = 'owner'
     and r.deleted_at is null
   limit 1;

  -- Roster rows for every org member missing one.
  if v_org is not null then
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select
      p_project_id,
      u.id,
      v_member_role,
      'active',
      coalesce(u.email, ''),
      coalesce(
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(u.email, ''), '@', 1)
      ),
      nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
      now()
    from public.organization_users ou
    join auth.users u on u.id = ou."user"
    where ou."organization" = v_org
      and not exists (
        select 1 from events.project_members m
        where m.project_id = p_project_id
          and m.user_id = u.id
          and m.deleted_at is null
      );

    get diagnostics v_count = row_count;
  end if;

  -- The project's creator is always on the roster, even when the project has no
  -- organization (the unowned rows in public.projects).
  if v_creator is not null then
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select
      p_project_id, u.id, coalesce(v_owner_role, v_member_role), 'active',
      coalesce(u.email, ''),
      coalesce(
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(u.email, ''), '@', 1)
      ),
      nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
      now()
    from auth.users u
    where u.id = v_creator
      and not exists (
        select 1 from events.project_members m
        where m.project_id = p_project_id
          and m.user_id = v_creator
          and m.deleted_at is null
      );
  end if;

  -- A grant for every roster member who has never held one. `not exists` looks
  -- at soft-deleted rows too, so revoking somebody's access sticks instead of
  -- being handed back by the next sync.
  insert into events.role_grants (project_id, user_id, role_id, status)
  select
    p_project_id,
    m.user_id,
    case when m.user_id = v_creator then coalesce(v_owner_role, v_member_role)
         else v_member_role end,
    'active'
  from events.project_members m
  where m.project_id = p_project_id
    and m.user_id is not null
    and m.deleted_at is null
    and case when m.user_id = v_creator then coalesce(v_owner_role, v_member_role)
             else v_member_role end is not null
    and not exists (
      select 1 from events.role_grants g
      where g.project_id = p_project_id
        and g.user_id = m.user_id
    );

  return v_count;
exception
  when others then
    -- A shared-schema shape change must not take the screen down with it.
    return 0;
end;
$$;

grant execute on function events.sync_project_team(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own membership. sync_project_team() covers everyone at once but
-- depends on the org link resolving; this one only needs auth.uid() and the
-- project's access check, so somebody who can reach the workspace always ends
-- up with a role rather than an empty sidebar.
--
-- Returns the role id they hold afterwards, or null when they should not have
-- one (no access, or every grant they ever held was revoked).
-- ---------------------------------------------------------------------------
create or replace function events.rbac_ensure_membership(
  p_project_id uuid,
  p_default_role uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, events, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_role uuid;
  v_existing uuid;
  v_ever integer;
begin
  if p_project_id is null or v_uid is null then
    return null;
  end if;

  -- Membership is org membership: this is the same check every table's RLS
  -- makes, so a grant can never be minted for somebody who could not already
  -- reach the project's rows.
  if not events.can_access_project(p_project_id) then
    return null;
  end if;

  select role_id into v_existing
    from events.role_grants
   where project_id = p_project_id
     and user_id = v_uid
     and deleted_at is null
     and status = 'active'
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- A revoked grant is a decision, not a gap. Never hand one back.
  select count(*) into v_ever
    from events.role_grants
   where project_id = p_project_id
     and user_id = v_uid;

  if v_ever > 0 then
    return null;
  end if;

  select created_by into v_creator from public.projects where id = p_project_id;

  -- Owner for the project's creator — and for the first person into a project
  -- that has no active grant at all. Some public.projects rows predate
  -- created_by and would otherwise deadlock: reachable by every org member, yet
  -- administrable by none. Claiming an ownerless workspace you can already read
  -- is strictly better than nobody being able to assign a role in it.
  select count(*) into v_ever
    from events.role_grants
   where project_id = p_project_id
     and deleted_at is null
     and status = 'active';

  if v_creator = v_uid or v_ever = 0 then
    select r.id into v_role from public.roles r
     where r.project_id = p_project_id and r.key = 'owner' and r.deleted_at is null
     limit 1;
  end if;

  if v_role is null then
    select coalesce(
             p_default_role,
             (select r.id from public.roles r
               where r.project_id = p_project_id
                 and r.key = 'member'
                 and r.deleted_at is null
               limit 1)
           )
      into v_role;
  end if;

  if v_role is null then
    return null;   -- roles not seeded yet; the next pass picks it up
  end if;

  insert into events.role_grants (project_id, user_id, role_id, status)
  values (p_project_id, v_uid, v_role, 'active')
  on conflict do nothing;

  -- Keep the roster in step so the new member is visible to the Team screen
  -- even when the org read is unavailable.
  insert into events.project_members (
    project_id, user_id, role_id, status, email, name, avatar_url, joined_at
  )
  select
    p_project_id, u.id, v_role, 'active',
    coalesce(u.email, ''),
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
    now()
  from auth.users u
  where u.id = v_uid
    and not exists (
      select 1 from events.project_members m
      where m.project_id = p_project_id
        and m.user_id = v_uid
        and m.deleted_at is null
    );

  return v_role;
end;
$$;

grant execute on function events.rbac_ensure_membership(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who may assign roles.
--
-- The demo policy let any authenticated user rewrite anyone's grants, which
-- makes the UI gate decorative. Writes now require events.team.assign in the
-- project being written to — Owner holds it through "*". Reads stay open to
-- members so the Team screen can render the roster.
--
-- The two functions above are SECURITY DEFINER and so are unaffected: joining a
-- project must work before you hold any permission at all.
-- ---------------------------------------------------------------------------
drop policy if exists role_grants_write on events.role_grants;
drop policy if exists role_grants_assign on events.role_grants;
create policy role_grants_assign on events.role_grants
  for all to authenticated
  using (events.rbac_allows('events.team.assign', project_id))
  with check (events.rbac_allows('events.team.assign', project_id));

-- ---------------------------------------------------------------------------
-- Backfill: every project that already has roles gets its members synced and
-- granted, so enforcement does not land on an empty grants table.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in select id from public.projects where deleted_at is null loop
    perform events.sync_project_team(p.id, null);
  end loop;
end;
$$;

-- @down
drop policy if exists role_grants_assign on events.role_grants;
create policy role_grants_write on events.role_grants
  for all to authenticated using (true) with check (true);

drop function if exists events.rbac_ensure_membership(uuid, uuid);

-- Restore the previous (broken) definition from 20260726194123_team.sql so the
-- rollback is a true mirror rather than a silent improvement.
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
    return 0;
end;
$$;
