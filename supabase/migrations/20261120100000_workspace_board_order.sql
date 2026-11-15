-- Manual order for board views: a record's place in its column. Unset ranks fall back to the record number, so lists
-- keep their creation order until someone drags a card; workspace_query learns the 'rank' sort.

alter table events.workspace_records add column if not exists rank double precision;

create index if not exists workspace_records_rank_idx
  on events.workspace_records (object_id, (coalesce(rank, number::double precision))) where deleted_at is null;

create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_where text;
  v_computed jsonb := '{}'::jsonb;
  v_select text := '';
  v_order text[] := '{}';
  v_link events.workspace_fields;
  v_target events.workspace_fields;
  v_fn text;
  v_expr text;
  item jsonb;
  v_terms text[];
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  if not exists (select 1 from events.workspace_objects where id = v_object and project_id = p_project and event_id = p_event) then
    perform events.workspace__fail('Unknown object');
  end if;
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'computed', '[]'::jsonb)) loop
    if (item->>'alias') !~ '^c[0-9]{1,3}$' or not exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid
      and object_id = v_object and type = item->>'kind' and deleted_at is null and type in ('lookup', 'rollup')) then
      perform events.workspace__fail('Invalid filter');
    end if;
    select * into v_link from events.workspace_fields where id = (item->>'linkFieldId')::uuid and object_id = v_object
      and type = 'link_record' and deleted_at is null;
    if not found then perform events.workspace__fail('Invalid filter'); end if;
    v_target := null;
    if item->>'targetFieldId' is not null then
      select * into v_target from events.workspace_fields where id = (item->>'targetFieldId')::uuid
        and object_id = (v_link.config->>'targetObjectId')::uuid and deleted_at is null;
      if not found then perform events.workspace__fail('Invalid filter'); end if;
    end if;
    v_fn := coalesce(item->>'fn', 'count');
    if item->>'kind' = 'lookup' then
      if v_target.id is null then perform events.workspace__fail('Invalid filter'); end if;
      v_expr := format('(select string_agg(t.data->>%L, '', '' order by l.position) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')', v_target.id, v_link.id);
    elsif v_fn = 'count' then
      v_expr := format('(select count(*) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')::numeric', v_link.id);
    elsif v_fn in ('sum', 'avg', 'min', 'max') and v_target.id is not null then
      v_expr := format('(select %s(case when jsonb_typeof(t.data->%L) = ''number'' then (t.data->>%L)::numeric end) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')',
        v_fn, v_target.id, v_target.id, v_link.id);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    v_computed := v_computed || jsonb_build_object(item->>'alias', v_expr);
    v_select := v_select || format(', %L, %s', item->>'fieldId', v_expr);
  end loop;

  v_where := format('r.project_id = %L and r.event_id = %L and r.object_id = %L and r.deleted_at is %s null',
    p_project, p_event, v_object, case when coalesce((p_plan->>'deleted')::boolean, false) then 'not' else '' end);
  if p_plan->'filter' is not null and p_plan->'filter' <> 'null'::jsonb then
    v_where := v_where || ' and ' || events.workspace__condition_sql(v_object, p_plan->'filter', v_computed, 1);
  end if;
  if jsonb_typeof(p_plan->'search') = 'array' and jsonb_array_length(p_plan->'search') > 0 then
    select array_agg(value) into v_terms from jsonb_array_elements_text(p_plan->'search') where value ~ '^[[:alnum:]]{1,50}$';
    if v_terms is not null then
      v_where := v_where || format(' and (r.search @@ to_tsquery(''simple'', %L)%s)',
        array_to_string(array(select t || ':*' from unnest(v_terms) t), ' & '),
        case when cardinality(v_terms) = 1 and v_terms[1] ~ '^[0-9]{1,15}$' then format(' or r.number = %s', v_terms[1]) else '' end);
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'sort', '[]'::jsonb)) loop
    v_expr := case item->>'source'
      when 'system' then case item->>'column' when 'number' then 'r.number' when 'title' then 'lower(r.title)' when 'status' then 'r.status'
        when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at'
        when 'rank' then 'coalesce(r.rank, r.number::double precision)' end
      when 'computed' then v_computed->>(item->>'alias')
      when 'value' then case when exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = v_object and deleted_at is null
        and type not in ('link_record', 'link_event', 'lookup', 'rollup', 'multi_select', 'attachments'))
        then events.workspace__value_sql(item->>'fieldId', case when item->>'cast' in ('text', 'numeric', 'boolean', 'date', 'timestamptz') then item->>'cast' end) end
    end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
    v_order := v_order || format('%s %s nulls last', v_expr, case when item->>'dir' = 'desc' then 'desc' else 'asc' end);
  end loop;
  v_order := v_order || 'r.number asc'::text;

  execute format('select count(*) from events.workspace_records r where %s', v_where) into v_total;
  execute format(
    'select coalesce(jsonb_agg(q.j order by q.ord), ''[]''::jsonb) from (
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'') as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

revoke all on function events.workspace_query(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_query(uuid, uuid, jsonb) to service_role;

-- @down
create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_where text;
  v_computed jsonb := '{}'::jsonb;
  v_select text := '';
  v_order text[] := '{}';
  v_link events.workspace_fields;
  v_target events.workspace_fields;
  v_fn text;
  v_expr text;
  item jsonb;
  v_terms text[];
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  if not exists (select 1 from events.workspace_objects where id = v_object and project_id = p_project and event_id = p_event) then
    perform events.workspace__fail('Unknown object');
  end if;
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'computed', '[]'::jsonb)) loop
    if (item->>'alias') !~ '^c[0-9]{1,3}$' or not exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid
      and object_id = v_object and type = item->>'kind' and deleted_at is null and type in ('lookup', 'rollup')) then
      perform events.workspace__fail('Invalid filter');
    end if;
    select * into v_link from events.workspace_fields where id = (item->>'linkFieldId')::uuid and object_id = v_object
      and type = 'link_record' and deleted_at is null;
    if not found then perform events.workspace__fail('Invalid filter'); end if;
    v_target := null;
    if item->>'targetFieldId' is not null then
      select * into v_target from events.workspace_fields where id = (item->>'targetFieldId')::uuid
        and object_id = (v_link.config->>'targetObjectId')::uuid and deleted_at is null;
      if not found then perform events.workspace__fail('Invalid filter'); end if;
    end if;
    v_fn := coalesce(item->>'fn', 'count');
    if item->>'kind' = 'lookup' then
      if v_target.id is null then perform events.workspace__fail('Invalid filter'); end if;
      v_expr := format('(select string_agg(t.data->>%L, '', '' order by l.position) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')', v_target.id, v_link.id);
    elsif v_fn = 'count' then
      v_expr := format('(select count(*) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')::numeric', v_link.id);
    elsif v_fn in ('sum', 'avg', 'min', 'max') and v_target.id is not null then
      v_expr := format('(select %s(case when jsonb_typeof(t.data->%L) = ''number'' then (t.data->>%L)::numeric end) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')',
        v_fn, v_target.id, v_target.id, v_link.id);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    v_computed := v_computed || jsonb_build_object(item->>'alias', v_expr);
    v_select := v_select || format(', %L, %s', item->>'fieldId', v_expr);
  end loop;

  v_where := format('r.project_id = %L and r.event_id = %L and r.object_id = %L and r.deleted_at is %s null',
    p_project, p_event, v_object, case when coalesce((p_plan->>'deleted')::boolean, false) then 'not' else '' end);
  if p_plan->'filter' is not null and p_plan->'filter' <> 'null'::jsonb then
    v_where := v_where || ' and ' || events.workspace__condition_sql(v_object, p_plan->'filter', v_computed, 1);
  end if;
  if jsonb_typeof(p_plan->'search') = 'array' and jsonb_array_length(p_plan->'search') > 0 then
    select array_agg(value) into v_terms from jsonb_array_elements_text(p_plan->'search') where value ~ '^[[:alnum:]]{1,50}$';
    if v_terms is not null then
      v_where := v_where || format(' and (r.search @@ to_tsquery(''simple'', %L)%s)',
        array_to_string(array(select t || ':*' from unnest(v_terms) t), ' & '),
        case when cardinality(v_terms) = 1 and v_terms[1] ~ '^[0-9]{1,15}$' then format(' or r.number = %s', v_terms[1]) else '' end);
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'sort', '[]'::jsonb)) loop
    v_expr := case item->>'source'
      when 'system' then case item->>'column' when 'number' then 'r.number' when 'title' then 'lower(r.title)' when 'status' then 'r.status'
        when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end
      when 'computed' then v_computed->>(item->>'alias')
      when 'value' then case when exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = v_object and deleted_at is null
        and type not in ('link_record', 'link_event', 'lookup', 'rollup', 'multi_select', 'attachments'))
        then events.workspace__value_sql(item->>'fieldId', case when item->>'cast' in ('text', 'numeric', 'boolean', 'date', 'timestamptz') then item->>'cast' end) end
    end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
    v_order := v_order || format('%s %s nulls last', v_expr, case when item->>'dir' = 'desc' then 'desc' else 'asc' end);
  end loop;
  v_order := v_order || 'r.number asc'::text;

  execute format('select count(*) from events.workspace_records r where %s', v_where) into v_total;
  execute format(
    'select coalesce(jsonb_agg(q.j order by q.ord), ''[]''::jsonb) from (
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'') as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

revoke all on function events.workspace_query(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_query(uuid, uuid, jsonb) to service_role;
drop index if exists events.workspace_records_rank_idx;
alter table events.workspace_records drop column if exists rank;
