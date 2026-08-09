-- Honour a pending invitation when its recipient first signs in
--
-- Redefines events.rbac_ensure_membership() (owned by
-- 20260809133335_rbac_team_management.sql, which is already applied and so
-- cannot be edited). Two defects in that first cut:
--
--   1. It always granted the project's default role, so "invite alex@… as
--      Manager" quietly landed them as a Member. The role chosen at invite time
--      is recorded on the events.project_members row and was being ignored.
--   2. It INSERTed a roster row keyed on user_id. An invite row already holds
--      that person's email with a null user_id, and
--      events_project_members_email_uniq is on (project_id, lower(email)) — so
--      the insert hit a unique violation and took the whole bootstrap with it.
--      The invitee could not join at all.
--
-- Both are fixed by claiming the invitation: match the caller's email, adopt its
-- role, and convert the row in place instead of inserting a second one.

-- @up
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

  -- Membership is org membership: the same check every table's RLS makes, so a
  -- grant can never be minted for somebody who could not already reach the
  -- project's rows.
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

  -- An invitation waiting on this email, addressed to nobody yet.
  select * into v_invite
    from events.project_members
   where project_id = p_project_id
     and user_id is null
     and v_email <> ''
     and lower(email) = lower(v_email)
     and deleted_at is null
   limit 1;

  select created_by into v_creator from public.projects where id = p_project_id;

  -- Owner for the project's creator — and for the first person into a project
  -- that has no active grant at all. Some public.projects rows predate
  -- created_by and would otherwise deadlock: reachable by every org member, yet
  -- administrable by none.
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

  -- The role they were invited as wins over the project default: somebody chose
  -- it deliberately in the invite dialog.
  if v_role is null then
    v_role := v_invite.role_id;
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

  if v_invite.id is not null then
    -- Convert the invitation in place. Inserting instead would collide with
    -- events_project_members_email_uniq and abort the join.
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

-- @down
-- Restore the previous body from 20260809133335_rbac_team_management.sql.
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

  select count(*) into v_ever
    from events.role_grants
   where project_id = p_project_id
     and user_id = v_uid;

  if v_ever > 0 then
    return null;
  end if;

  select created_by into v_creator from public.projects where id = p_project_id;

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
    return null;
  end if;

  insert into events.role_grants (project_id, user_id, role_id, status)
  values (p_project_id, v_uid, v_role, 'active')
  on conflict do nothing;

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
