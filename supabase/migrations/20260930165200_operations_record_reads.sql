-- Operations record reads
--
-- Add `-- @no-transaction` above @up only if this migration needs to run
-- outside a transaction (e.g. create index concurrently).

-- @up
create or replace function events.ops_list_records(
  p_project_id uuid, p_event_id uuid, p_module_key text,
  p_state text, p_before_at timestamptz, p_before_id uuid,
  p_limit integer, p_archived boolean default false
) returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'projectId', e.project_id, 'eventId', e.event_id,
    'moduleKey', e.module_key, 'definitionVersion', e.definition_version,
    'title', e.title, 'state', e.state, 'revision', e.revision,
    'archivedAt', e.archived_at, 'createdAt', e.created_at,
    'values', r.field_values,
    'references', coalesce((select jsonb_agg(jsonb_build_object(
      'fieldId', l.field_id, 'targetId', l.target_entity_id) order by l.field_id)
      from events.ops_entity_links l where l.project_id=e.project_id
        and l.event_id=e.event_id and l.source_entity_id=e.id), '[]'::jsonb)
  )
  from events.ops_entities e
  join events.ops_custom_records r on r.project_id=e.project_id
    and r.event_id=e.event_id and r.entity_id=e.id
  join events.ops_module_instances instance on instance.project_id=e.project_id
    and instance.event_id=e.event_id and instance.module_key=e.module_key
  where e.project_id=p_project_id and e.event_id=p_event_id
    and e.module_key=p_module_key and
      (case when p_archived then e.archived_at is not null or not instance.enabled
        else e.archived_at is null and instance.enabled end)
    and (p_state is null or e.state=p_state)
    and (p_before_at is null or (e.created_at,e.id) < (p_before_at,p_before_id))
  order by e.created_at desc,e.id desc limit least(greatest(p_limit,1),51);
$$;
revoke all on function events.ops_list_records(uuid,uuid,text,text,timestamptz,uuid,integer,boolean)
  from public, anon, authenticated;
grant execute on function events.ops_list_records(uuid,uuid,text,text,timestamptz,uuid,integer,boolean)
  to service_role;

-- @down

drop function if exists events.ops_list_records(uuid,uuid,text,text,timestamptz,uuid,integer,boolean);

