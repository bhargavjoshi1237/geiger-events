-- Guard the suite role definitions/grants used by private operations authorization.
-- Restrictive write policies cooperate with pre-existing permissive policies.
-- Reads stay governed by the existing suite read policies; server seeding remains available.
-- No automatic rollback: removing these guards reintroduces privilege escalation.
-- @up
create or replace function events.ops_can_administer_roles(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_project_id is not null and exists (
    select 1 from public.projects p where p.id=p_project_id and (
      (p.organization_id is null and p.created_by=(select auth.uid())) or exists (
        select 1 from public.organization_users ou
        where ou."organization"=p.organization_id and ou."user"=(select auth.uid())
          and lower(ou.role::text) in ('owner','admin')
      )
    )
  );
$$;
revoke all on function events.ops_can_administer_roles(uuid) from public,anon;
grant execute on function events.ops_can_administer_roles(uuid) to authenticated,service_role;

drop policy if exists ops_roles_insert_guard on public.roles;
create policy ops_roles_insert_guard on public.roles as restrictive for insert to authenticated
  with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_roles_update_guard on public.roles;
create policy ops_roles_update_guard on public.roles as restrictive for update to authenticated
  using (events.ops_can_administer_roles(project_id)) with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_roles_delete_guard on public.roles;
create policy ops_roles_delete_guard on public.roles as restrictive for delete to authenticated
  using (events.ops_can_administer_roles(project_id));

drop policy if exists ops_grants_insert_guard on events.role_grants;
create policy ops_grants_insert_guard on events.role_grants as restrictive for insert to authenticated
  with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_grants_update_guard on events.role_grants;
create policy ops_grants_update_guard on events.role_grants as restrictive for update to authenticated
  using (events.ops_can_administer_roles(project_id)) with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_grants_delete_guard on events.role_grants;
create policy ops_grants_delete_guard on events.role_grants as restrictive for delete to authenticated
  using (events.ops_can_administer_roles(project_id));

-- Explicit onboarding invitations must be created by role administrators.
drop policy if exists ops_roster_insert_guard on events.project_members;
create policy ops_roster_insert_guard on events.project_members as restrictive for insert to authenticated
  with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_roster_update_guard on events.project_members;
create policy ops_roster_update_guard on events.project_members as restrictive for update to authenticated
  using (events.ops_can_administer_roles(project_id)) with check (events.ops_can_administer_roles(project_id));
drop policy if exists ops_roster_delete_guard on events.project_members;
create policy ops_roster_delete_guard on events.project_members as restrictive for delete to authenticated
  using (events.ops_can_administer_roles(project_id));

-- Existing shared FK only checks the role UUID. Enforce the project boundary too,
-- including server writes; suite-wide null-project role templates remain valid.
create or replace function events.ops_check_role_grant_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is null or not exists (
    select 1 from public.roles r where r.id=new.role_id
      and (r.project_id=new.project_id or r.project_id is null)
  ) then
    raise exception 'Role grant project mismatch' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function events.ops_check_role_grant_project() from public,anon,authenticated;
drop trigger if exists ops_role_grant_project_guard on events.role_grants;
create trigger ops_role_grant_project_guard before insert or update of project_id,role_id on events.role_grants
  for each row execute function events.ops_check_role_grant_project();

-- These existing SECURITY DEFINER onboarding helpers can bypass table policies.
-- Preserve their implementation privately and constrain their public entrypoints:
-- self onboarding must use the canonical role, while team synchronization is admin-only.
do $guard$
begin
  if to_regprocedure('events.rbac_ensure_membership(uuid,uuid)') is not null then
    if to_regprocedure('events.ops_private_ensure_membership(uuid,uuid)') is null then
      alter function events.rbac_ensure_membership(uuid,uuid) rename to ops_private_ensure_membership;
    end if;
    revoke all on function events.ops_private_ensure_membership(uuid,uuid) from public,anon,authenticated;
    grant execute on function events.ops_private_ensure_membership(uuid,uuid) to service_role;
    execute $definition$
create or replace function events.rbac_ensure_membership(
  p_project_id uuid,
  p_default_role uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
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

  -- Serialize onboarding for this project; only canonical membership or a real
  -- admin-created invitation can establish a role. Never promote the first joiner.
  perform 1 from public.projects where id=p_project_id for update;
  if not found or not events.can_access_project(p_project_id) then
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
     and status = 'invited'
     and deleted_at is null
     and exists (select 1 from public.roles r where r.id=role_id
       and (r.project_id=p_project_id or r.project_id is null) and r.deleted_at is null)
   limit 1;

  -- What their suite role entitles them to.
  v_role := events.rbac_role_for_member(p_project_id, v_uid);

  -- Ignore caller-selected defaults and preserve explicit revocation.
  if v_role is null then v_role := v_invite.role_id; end if;

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
$body$;
    $definition$;
    revoke all on function events.rbac_ensure_membership(uuid,uuid) from public,anon;
    grant execute on function events.rbac_ensure_membership(uuid,uuid) to authenticated,service_role;
  end if;
  if to_regprocedure('events.sync_project_team(uuid,uuid)') is not null then
    if to_regprocedure('events.ops_private_sync_project_team(uuid,uuid)') is null then
      alter function events.sync_project_team(uuid,uuid) rename to ops_private_sync_project_team;
    end if;
    revoke all on function events.ops_private_sync_project_team(uuid,uuid) from public,anon,authenticated;
    grant execute on function events.ops_private_sync_project_team(uuid,uuid) to service_role;
    execute $definition$
      create or replace function events.sync_project_team(p_project_id uuid,p_default_role uuid default null)
      returns integer language plpgsql security definer set search_path = '' as $body$
      begin
        if current_setting('role',true) <> 'service_role' and not events.ops_can_administer_roles(p_project_id) then
          raise exception 'Project role administration required' using errcode='42501';
        end if;
        return events.ops_private_sync_project_team(p_project_id,null);
      end;
      $body$;
    $definition$;
    revoke all on function events.sync_project_team(uuid,uuid) from public,anon;
    grant execute on function events.sync_project_team(uuid,uuid) to authenticated,service_role;
  end if;
end;
$guard$;
