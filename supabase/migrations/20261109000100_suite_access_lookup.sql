-- @up
-- Team-access hint for the mobile app: which suite organisations an email belongs to. Service role only; it grants nothing.

create or replace function events.suite_access_for_email(p_email text)
returns table (organization_id uuid, organization_name text, project_count integer, invited boolean)
language sql
stable
security definer
set search_path = public, events, auth
as $$
  with target as (
    select u.id
      from auth.users u
     where lower(u.email) = lower(btrim(p_email))
     order by u.created_at
     limit 1
  ),
  orgs as (
    select distinct ou.organization as id
      from public.organization_users ou
      join target t on ou."user" = t.id
  )
  select o.id,
         coalesce(nullif(btrim(org.name), ''), 'Your organisation'),
         (select count(*)::int from public.projects p where p.organization_id = o.id and p.deleted_at is null),
         false
    from orgs o
    left join public.organizations org on org.id = o.id
  union all
  select null::uuid, 'Your projects', count(*)::int, false
    from public.projects p
    join target t on p.created_by = t.id
   where p.organization_id is null
     and p.deleted_at is null
  having count(*) > 0
  union all
  select null::uuid, 'Team invitation', count(*)::int, true
    from events.project_members pm
   where lower(pm.email) = lower(btrim(p_email))
     and pm.user_id is null
     and pm.status = 'invited'
     and pm.deleted_at is null
  having count(*) > 0;
$$;

revoke all on function events.suite_access_for_email(text) from public, anon, authenticated;
grant execute on function events.suite_access_for_email(text) to service_role;

-- @down
drop function if exists events.suite_access_for_email(text);
