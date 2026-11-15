-- Re-applies board manual order: 20261120100000 had no @up marker, so its @down ran on push and left workspace_query pre-portal.
-- @up

alter table events.workspace_records add column if not exists rank double precision;

create index if not exists workspace_records_rank_idx
  on events.workspace_records (object_id, (coalesce(rank, number::double precision))) where deleted_at is null;

-- The portal read path (role policy, per-row policy flags, portal search) plus the 'rank' sort for board manual order.
create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_sql jsonb;
  v_where text;
  v_computed jsonb;
  v_select text;
  v_policy text := '';
  v_order text[] := '{}';
  v_expr text;
  item jsonb;
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  v_sql := events.workspace__plan_sql(p_project, p_event, p_plan);
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;
  v_where := v_sql->>'where';
  v_computed := v_sql->'computed';
  v_select := v_sql->>'select';

  -- Per-row flags: which of the viewer's roles' view rules this row matches (decides field visibility per row).
  if jsonb_typeof(p_plan->'policyParts') = 'array' then
    if jsonb_array_length(p_plan->'policyParts') > 30 then perform events.workspace__fail('Invalid filter'); end if;
    for item in select * from jsonb_array_elements(p_plan->'policyParts') loop
      if coalesce(item->>'alias', '') !~ '^p[0-9]{1,2}$' then perform events.workspace__fail('Invalid filter'); end if;
      v_policy := v_policy || format(', %L, %s', item->>'alias', events.workspace__condition_at('r', v_object, item->'condition', v_computed, 1, 8));
    end loop;
    v_policy := format(' || jsonb_build_object(''policy'', jsonb_build_object(''_'', null%s) - ''_'')', v_policy);
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
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'')%s as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, v_policy, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

revoke all on function events.workspace_query(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_query(uuid, uuid, jsonb) to service_role;

-- @down
-- Back to the portal body without the 'rank' sort (the state before board manual order).
create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_sql jsonb;
  v_where text;
  v_computed jsonb;
  v_select text;
  v_policy text := '';
  v_order text[] := '{}';
  v_expr text;
  item jsonb;
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  v_sql := events.workspace__plan_sql(p_project, p_event, p_plan);
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;
  v_where := v_sql->>'where';
  v_computed := v_sql->'computed';
  v_select := v_sql->>'select';

  if jsonb_typeof(p_plan->'policyParts') = 'array' then
    if jsonb_array_length(p_plan->'policyParts') > 30 then perform events.workspace__fail('Invalid filter'); end if;
    for item in select * from jsonb_array_elements(p_plan->'policyParts') loop
      if coalesce(item->>'alias', '') !~ '^p[0-9]{1,2}$' then perform events.workspace__fail('Invalid filter'); end if;
      v_policy := v_policy || format(', %L, %s', item->>'alias', events.workspace__condition_at('r', v_object, item->'condition', v_computed, 1, 8));
    end loop;
    v_policy := format(' || jsonb_build_object(''policy'', jsonb_build_object(''_'', null%s) - ''_'')', v_policy);
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
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'')%s as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, v_policy, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

revoke all on function events.workspace_query(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_query(uuid, uuid, jsonb) to service_role;
drop index if exists events.workspace_records_rank_idx;
alter table events.workspace_records drop column if exists rank;
