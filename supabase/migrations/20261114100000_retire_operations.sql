-- Retire the event Operations workspace: drop its tables, functions and storage bucket, and move
-- stored events.operations.* permissions to the new events.workspace.* keys.
-- Keeps the suite role-write guards that happen to use the ops_ prefix (ops_can_administer_roles,
-- ops_check_role_grant_project, ops_private_ensure_membership, ops_private_sync_project_team).
-- Forward-only: the dropped data is not recoverable from this migration.
-- @up

do $$
declare
  t record;
  f record;
begin
  for t in select tablename from pg_tables where schemaname = 'events' and tablename like 'ops\_%' loop
    execute format('drop table if exists events.%I cascade', t.tablename);
  end loop;
  for f in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'events' and p.proname like 'ops\_%'
      and p.proname not in ('ops_can_administer_roles', 'ops_check_role_grant_project',
        'ops_private_ensure_membership', 'ops_private_sync_project_team')
  loop
    execute format('drop function if exists %s cascade', f.signature);
  end loop;
end $$;

drop index if exists events.ops_events_event_project_uq;

-- Supabase may forbid deleting storage rows from SQL; if so the empty-or-not bucket is left for the dashboard.
do $$
begin
  if to_regclass('storage.objects') is not null then
    delete from storage.objects where bucket_id = 'operations';
  end if;
  delete from storage.buckets where id = 'operations';
exception when others then
  raise notice 'Operations storage bucket left in place (%). Empty and delete it from the Supabase dashboard.', sqlerrm;
end $$;

-- events.operations.view/configure/record(s)_create/update/archive → events.workspace.*; archive becomes delete.
update public.roles r
set permissions = (
  select coalesce(array_agg(distinct mapped), '{}')
  from (
    select case
      when p = 'events.operations.*' then 'events.workspace.*'
      when p = 'events.operations.view' then 'events.workspace.view'
      when p = 'events.operations.configure' then 'events.workspace.configure'
      when p in ('events.operations.record_create', 'events.operations.records.create') then 'events.workspace.record_create'
      when p in ('events.operations.record_update', 'events.operations.records.update') then 'events.workspace.record_update'
      when p in ('events.operations.record_archive', 'events.operations.records.archive') then 'events.workspace.record_delete'
      when p like 'events.operations.%' then null
      else p
    end as mapped
    from unnest(r.permissions) p
  ) keys
  where mapped is not null
)
where exists (select 1 from unnest(r.permissions) p where p like 'events.operations.%');

-- @down
-- Forward-only.
