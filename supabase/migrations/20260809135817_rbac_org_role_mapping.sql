-- Derive a joiner's events role from their SUITE role, not from who typed the
-- project name first
--
-- 20260809133335 treated public.projects.created_by as "the project owner". In
-- this suite that is just whoever created the row — ownership is held at the
-- organization (public.organization_users.role). The org's Owner was therefore
-- being bootstrapped as a plain Member of their own workspace, which hid every
-- section their role does not carry, Settings included.
--
-- Owns:
--   events.rbac_role_for_member(uuid, uuid)   suite org role -> events role id
--   events.rbac_ensure_membership(uuid, uuid) (redefined to use it)
--   events.sync_project_team(uuid, uuid)      (redefined to use it)
--
-- The mapping is deliberately conservative and lands on the four seeded roles:
--
--   Owner                     -> owner    (holds "*")
--   ADMIN / Admin             -> admin
--   Manager                   -> manager
--   everything else           -> member
--
-- The enum carries both legacy shouty labels (ADMIN, USER) and title-case ones
-- (Manager, User, Leader, Technical Officer, Financial Officer), so the match is
-- lower-cased rather than enumerated.
--
-- REPAIR. Existing grants are corrected in place, but ONLY where granted_by is
-- null — that is the signature of a bootstrap-assigned grant. Anything an
-- administrator set deliberately through the Team screen carries their user id
-- and is left exactly as they set it, including a deliberate demotion.

-- @up
-- The events role a person should hold in a project, from their suite org role.
-- Returns null when they are not a member of the project's org and did not
-- create the project.
create or replace function events.rbac_role_for_member(
  p_project_id uuid,
  p_user uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, events, auth
as $$
declare
  v_org uuid;
  v_creator uuid;
  v_org_role text;
  v_key text;
  v_role uuid;
begin
  if p_project_id is null or p_user is null then
    return null;
  end if;

  select organization_id, created_by
    into v_org, v_creator
    from public.projects
   where id = p_project_id;

  if v_org is not null then
    select lower(ou.role::text) into v_org_role
      from public.organization_users ou
     where ou."organization" = v_org
       and ou."user" = p_user
     limit 1;
  end if;

  v_key := case
    when v_org_role = 'owner' then 'owner'
    when v_org_role in ('admin') then 'admin'
    when v_org_role in ('manager') then 'manager'
    when v_org_role is not null then 'member'
    else null
  end;

  -- Creating the project still earns Owner: an unowned project (no org) has no
  -- suite role to read, and its creator is the only sensible administrator.
  if v_key is null and v_creator = p_user then
    v_key := 'owner';
  end if;

  if v_key is null then
    return null;
  end if;

  select r.id into v_role
    from public.roles r
   where r.project_id = p_project_id
     and r.key = v_key
     and r.deleted_at is null
   limit 1;

  -- The mapped role may not be seeded yet (the app seeds from the catalog on
  -- first load). Fall back to member, then to nothing.
  if v_role is null and v_key <> 'member' then
    select r.id into v_role
      from public.roles r
     where r.project_id = p_project_id
       and r.key = 'member'
       and r.deleted_at is null
     limit 1;
  end if;

  return v_role;
end;
$$;

grant execute on function events.rbac_role_for_member(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own membership, now suite-role aware.
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
  v_email text;
  v_name text;
  v_avatar text;
  v_role uuid;
  v_existing uuid;
  v_ever integer;
  v_invite events.project_members%rowtype;
begin
  if p_project_id is null or v_uid is null then
    return null;
  end if;

  if not events.can_access_project(p_project_id) then
    return null;
  end if;

  select
    coalesce(u.email, ''),
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')
    into v_email, v_name, v_avatar
    from auth.users u
   where u.id = v_uid;

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

  select * into v_invite
    from events.project_members
   where project_id = p_project_id
     and user_id is null
     and v_email <> ''
     and lower(email) = lower(v_email)
     and deleted_at is null
   limit 1;

  -- What their suite role entitles them to.
  v_role := events.rbac_role_for_member(p_project_id, v_uid);

  -- Then an explicit invitation, then the caller's default. An invite only wins
  -- when it grants MORE than the suite mapping would (it is an explicit act),
  -- but it must never quietly demote an org Owner.
  if v_role is null then
    v_role := coalesce(v_invite.role_id, p_default_role);
  end if;

  -- First person into a project nobody administers claims it, so an ownerless
  -- workspace can never deadlock.
  if v_role is null or not exists (
    select 1 from events.role_grants
     where project_id = p_project_id and deleted_at is null and status = 'active'
  ) then
    select r.id into v_existing
      from public.roles r
     where r.project_id = p_project_id and r.key = 'owner' and r.deleted_at is null
     limit 1;
    v_role := coalesce(v_existing, v_role);
  end if;

  if v_role is null then
    select r.id into v_role
      from public.roles r
     where r.project_id = p_project_id and r.key = 'member' and r.deleted_at is null
     limit 1;
  end if;

  if v_role is null then
    return null;   -- roles not seeded yet; the next pass picks it up
  end if;

  insert into events.role_grants (project_id, user_id, role_id, status)
  values (p_project_id, v_uid, v_role, 'active')
  on conflict do nothing;

  if v_invite.id is not null then
    update events.project_members
       set user_id = v_uid,
           role_id = v_role,
           status = 'active',
           name = case when name = '' then v_name else name end,
           avatar_url = coalesce(avatar_url, v_avatar),
           joined_at = coalesce(joined_at, now())
     where id = v_invite.id;
  else
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select p_project_id, v_uid, v_role, 'active', v_email, v_name, v_avatar, now()
    where not exists (
      select 1 from events.project_members m
      where m.project_id = p_project_id
        and m.user_id = v_uid
        and m.deleted_at is null
    );
  end if;

  return v_role;
end;
$$;

grant execute on function events.rbac_ensure_membership(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bulk sync, now suite-role aware.
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
  v_count integer := 0;
begin
  if p_project_id is null then
    return 0;
  end if;

  select organization_id, created_by
    into v_org, v_creator
    from public.projects
   where id = p_project_id;

  if v_org is not null then
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select
      p_project_id,
      u.id,
      coalesce(events.rbac_role_for_member(p_project_id, u.id), p_default_role),
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

  if v_creator is not null then
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select
      p_project_id, u.id,
      coalesce(events.rbac_role_for_member(p_project_id, u.id), p_default_role),
      'active',
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

  insert into events.role_grants (project_id, user_id, role_id, status)
  select
    p_project_id,
    m.user_id,
    coalesce(events.rbac_role_for_member(p_project_id, m.user_id), p_default_role),
    'active'
  from events.project_members m
  where m.project_id = p_project_id
    and m.user_id is not null
    and m.deleted_at is null
    and coalesce(events.rbac_role_for_member(p_project_id, m.user_id), p_default_role) is not null
    and not exists (
      select 1 from events.role_grants g
      where g.project_id = p_project_id
        and g.user_id = m.user_id
    );

  return v_count;
exception
  when others then
    return 0;
end;
$$;

grant execute on function events.sync_project_team(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- events.project_members.role_id still pointed at the PRE-RBAC events.roles
-- table. adopt_rbac copied those rows into public.roles keeping their ids, so
-- the constraint kept passing for anything that predated the move — but every
-- role created since (the catalog-seeded Admin/Manager/Member/Viewer, and any
-- custom role) exists only in public.roles. Assigning one from the Team screen
-- was already failing with a foreign key violation; 6 such roles exist today.
--
-- The grant is the authority and is correctly keyed to public.roles. The roster
-- column is display only, so the constraint goes rather than being repointed —
-- a cross-schema FK to a suite-shared table is exactly what this codebase avoids
-- elsewhere (created_by is a plain uuid for the same reason).
-- ---------------------------------------------------------------------------
alter table events.project_members
  drop constraint if exists project_members_role_id_fkey;

-- ---------------------------------------------------------------------------
-- Repair grants the old, creator-based bootstrap got wrong.
--
-- granted_by is null only on bootstrap-assigned rows; anything an administrator
-- set through the Team screen carries their id and is left untouched.
-- ---------------------------------------------------------------------------
update events.role_grants g
   set role_id = events.rbac_role_for_member(g.project_id, g.user_id)
 where g.deleted_at is null
   and g.granted_by is null
   and events.rbac_role_for_member(g.project_id, g.user_id) is not null
   and events.rbac_role_for_member(g.project_id, g.user_id) <> g.role_id;

-- Keep the roster's display role in step with the grant that authorizes.
update events.project_members m
   set role_id = g.role_id
  from events.role_grants g
 where g.project_id = m.project_id
   and g.user_id = m.user_id
   and g.deleted_at is null
   and m.deleted_at is null
   and m.role_id is distinct from g.role_id;

-- Sync every project again so anyone the old joins missed gets a roster row.
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
-- Restores the creator-based bodies from 20260809134349 / 20260809133335.
--
-- events.rbac_role_for_member is deliberately LEFT INSTALLED. Dropping it would
-- be the tidier mirror, but plpgsql bodies are not dependency-tracked, so the
-- drop would succeed and any caller reintroduced later would fail at runtime
-- instead of at migration time. An unused function is the cheaper mistake.
--
-- The grant repair above is a data correction and is not reversed: the previous
-- role_ids were wrong, and no copy of them is kept.
--
-- The dropped FK comes back NOT VALID: rows now legitimately reference
-- public.roles ids that events.roles never had, so a validating re-add would
-- fail outright.
alter table events.project_members
  drop constraint if exists project_members_role_id_fkey;
alter table events.project_members
  add constraint project_members_role_id_fkey
  foreign key (role_id) references events.roles(id) on delete set null not valid;
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
  v_email text;
  v_name text;
  v_avatar text;
  v_creator uuid;
  v_role uuid;
  v_existing uuid;
  v_ever integer;
  v_invite events.project_members%rowtype;
begin
  if p_project_id is null or v_uid is null then
    return null;
  end if;

  if not events.can_access_project(p_project_id) then
    return null;
  end if;

  select
    coalesce(u.email, ''),
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')
    into v_email, v_name, v_avatar
    from auth.users u
   where u.id = v_uid;

  select role_id into v_existing
    from events.role_grants
   where project_id = p_project_id and user_id = v_uid
     and deleted_at is null and status = 'active'
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select count(*) into v_ever
    from events.role_grants
   where project_id = p_project_id and user_id = v_uid;

  if v_ever > 0 then
    return null;
  end if;

  select * into v_invite
    from events.project_members
   where project_id = p_project_id
     and user_id is null
     and v_email <> ''
     and lower(email) = lower(v_email)
     and deleted_at is null
   limit 1;

  select created_by into v_creator from public.projects where id = p_project_id;

  select count(*) into v_ever
    from events.role_grants
   where project_id = p_project_id and deleted_at is null and status = 'active';

  if v_creator = v_uid or v_ever = 0 then
    select r.id into v_role from public.roles r
     where r.project_id = p_project_id and r.key = 'owner' and r.deleted_at is null
     limit 1;
  end if;

  if v_role is null then
    v_role := v_invite.role_id;
  end if;

  if v_role is null then
    select coalesce(
             p_default_role,
             (select r.id from public.roles r
               where r.project_id = p_project_id
                 and r.key = 'member' and r.deleted_at is null
               limit 1)
           )
      into v_role;
  end if;

  if v_role is null then
    return null;
  end if;

  insert into events.role_grants (project_id, user_id, role_id, status)
  values (p_project_id, v_uid, v_role, 'active')
  on conflict do nothing;

  if v_invite.id is not null then
    update events.project_members
       set user_id = v_uid,
           role_id = v_role,
           status = 'active',
           name = case when name = '' then v_name else name end,
           avatar_url = coalesce(avatar_url, v_avatar),
           joined_at = coalesce(joined_at, now())
     where id = v_invite.id;
  else
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select p_project_id, v_uid, v_role, 'active', v_email, v_name, v_avatar, now()
    where not exists (
      select 1 from events.project_members m
      where m.project_id = p_project_id
        and m.user_id = v_uid
        and m.deleted_at is null
    );
  end if;

  return v_role;
end;
$$;

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

  select organization_id, created_by into v_org, v_creator
    from public.projects where id = p_project_id;

  select coalesce(
           p_default_role,
           (select r.id from public.roles r
             where r.project_id = p_project_id
               and r.key = 'member' and r.deleted_at is null
             limit 1)
         )
    into v_member_role;

  select r.id into v_owner_role from public.roles r
   where r.project_id = p_project_id and r.key = 'owner' and r.deleted_at is null
   limit 1;

  if v_org is not null then
    insert into events.project_members (
      project_id, user_id, role_id, status, email, name, avatar_url, joined_at
    )
    select
      p_project_id, u.id, v_member_role, 'active',
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
          and m.user_id = u.id and m.deleted_at is null
      );

    get diagnostics v_count = row_count;
  end if;

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
          and m.user_id = v_creator and m.deleted_at is null
      );
  end if;

  insert into events.role_grants (project_id, user_id, role_id, status)
  select
    p_project_id, m.user_id,
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
      where g.project_id = p_project_id and g.user_id = m.user_id
    );

  return v_count;
exception
  when others then
    return 0;
end;
$$;
