-- Workspace writes and reads. events.workspace_command applies one organiser action atomically (permission
-- check, integrity, change log, replay-safe receipts); events.workspace_query assembles a filtered, sorted page
-- from a plan the server has already validated, re-checking every field and operator against a whitelist.
-- Value formats are validated in lib/workspace before reaching these functions; here only integrity is enforced.
-- @up

create or replace function events.workspace__object_json(o events.workspace_objects) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'key', o.key, 'name', o.name, 'plural', o.plural, 'icon', o.icon,
    'titleFieldId', o.title_field_id, 'statuses', o.statuses, 'numberPrefix', o.number_prefix, 'position', o.position,
    'revision', o.revision, 'deletedAt', o.deleted_at);
$$;

create or replace function events.workspace__field_json(f events.workspace_fields) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'objectId', f.object_id, 'key', f.key, 'name', f.name, 'type', f.type,
    'config', f.config, 'required', f.required, 'isUnique', f.is_unique, 'position', f.position,
    'revision', f.revision, 'deletedAt', f.deleted_at);
$$;

create or replace function events.workspace__record_json(r events.workspace_records) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'objectId', r.object_id, 'number', r.number, 'title', r.title, 'status', r.status,
    'values', r.data, 'revision', r.revision, 'createdAt', r.created_at, 'updatedAt', r.updated_at,
    'createdBy', r.created_by, 'updatedBy', r.updated_by, 'deletedAt', r.deleted_at);
$$;

create or replace function events.workspace__view_json(v events.workspace_saved_views) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', v.id, 'objectId', v.object_id, 'name', v.name, 'shared', v.owner_id is null,
    'config', v.config, 'position', v.position);
$$;

create or replace function events.workspace__fail(p_message text, p_code text default '22023') returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using message = p_message, errcode = p_code;
end $$;

create or replace function events.workspace__invalid() returns text
language plpgsql set search_path = '' as $$
begin
  raise exception using message = 'Invalid filter', errcode = '22023';
end $$;

create or replace function events.workspace__log(p_project uuid, p_event uuid, p_actor uuid, p_kind text, p_action text,
  p_object uuid, p_field uuid, p_record uuid, p_before jsonb, p_after jsonb, p_undo_of uuid default null)
returns uuid language sql set search_path = '' as $$
  insert into events.workspace_changes (project_id, event_id, actor_id, kind, action, object_id, field_id, record_id, before, after, undo_of)
  values (p_project, p_event, p_actor, p_kind, p_action, p_object, p_field, p_record, p_before, p_after, p_undo_of)
  returning id;
$$;

create or replace function events.workspace__object(p_project uuid, p_event uuid, p_id uuid, p_live boolean default true)
returns events.workspace_objects language plpgsql set search_path = '' as $$
declare o events.workspace_objects;
begin
  select * into o from events.workspace_objects where id = p_id and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown object'); end if;
  if p_live and o.deleted_at is not null then perform events.workspace__fail('Object deleted'); end if;
  return o;
end $$;

create or replace function events.workspace__field(p_project uuid, p_event uuid, p_id uuid)
returns events.workspace_fields language plpgsql set search_path = '' as $$
declare f events.workspace_fields;
begin
  select * into f from events.workspace_fields where id = p_id and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown field'); end if;
  return f;
end $$;

create or replace function events.workspace__check_status(p_statuses jsonb, p_status text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_status is not null and not exists (select 1 from jsonb_array_elements(p_statuses) s where s->>'key' = p_status) then
    perform events.workspace__fail('Unknown status');
  end if;
end $$;

-- Applies a values patch (null removes a key); every key must be a live, stored field of the object.
create or replace function events.workspace__merge_values(p_object uuid, p_current jsonb, p_patch jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  k text;
  v jsonb;
  t text;
  merged jsonb := coalesce(p_current, '{}'::jsonb);
begin
  if p_patch is null or p_patch = 'null'::jsonb then return merged; end if;
  if jsonb_typeof(p_patch) <> 'object' then perform events.workspace__fail('Field not on object'); end if;
  for k, v in select * from jsonb_each(p_patch) loop
    select f.type into t from events.workspace_fields f where f.id::text = k and f.object_id = p_object and f.deleted_at is null;
    if t is null then perform events.workspace__fail('Field not on object'); end if;
    if t in ('link_record', 'link_event', 'lookup', 'rollup') then perform events.workspace__fail('Read-only field'); end if;
    if v = 'null'::jsonb then merged := merged - k; else merged := merged || jsonb_build_object(k, v); end if;
  end loop;
  if octet_length(merged::text) > 1100000 then perform events.workspace__fail('Values too large'); end if;
  return merged;
end $$;

create or replace function events.workspace__target_in_scope(p_project uuid, p_event uuid, p_kind text, p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select case p_kind
    when 'contact' then exists (select 1 from events.contacts c where c.id = p_id and c.project_id = p_project and c.deleted_at is null)
    when 'ticket' then exists (select 1 from events.registrations x where x.id = p_id and x.event_id = p_event and x.deleted_at is null)
    when 'order' then exists (select 1 from events.event_orders o where o.id = p_id and o.event_id = p_event)
    when 'team_member' then exists (select 1 from events.project_members m where m.id = p_id and m.project_id = p_project and m.deleted_at is null)
    when 'venue_space' then exists (select 1 from events.venue_spaces s join events.events e on e.venue_id = s.venue_id
      where s.id = p_id and e.id = p_event and s.deleted_at is null)
    else false end;
$$;

-- Replaces the links of each listed field; returns the previous links per field for the change log.
create or replace function events.workspace__set_links(p_project uuid, p_event uuid, p_record uuid, p_object uuid, p_links jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  item jsonb;
  target jsonb;
  f events.workspace_fields;
  v_kind text;
  v_id uuid;
  v_pos integer;
  v_previous jsonb := '{}'::jsonb;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'array' then return v_previous; end if;
  for item in select * from jsonb_array_elements(p_links) loop
    select * into f from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = p_object and deleted_at is null;
    if not found or f.type not in ('link_record', 'link_event') then perform events.workspace__fail('Field not on object'); end if;
    if jsonb_array_length(coalesce(item->'targets', '[]'::jsonb)) > 1
      and not coalesce((f.config->>'multiple')::boolean, f.type = 'link_record') then
      perform events.workspace__fail('Single link only');
    end if;
    v_previous := v_previous || jsonb_build_object(f.id::text, coalesce((
      select jsonb_agg(jsonb_build_object('kind', l.target_kind, 'id', l.target_id) order by l.position)
      from events.workspace_links l where l.source_record_id = p_record and l.field_id = f.id), '[]'::jsonb));
    delete from events.workspace_links where source_record_id = p_record and field_id = f.id;
    v_pos := 0;
    for target in select * from jsonb_array_elements(coalesce(item->'targets', '[]'::jsonb)) loop
      v_kind := target->>'kind';
      v_id := (target->>'id')::uuid;
      if f.type = 'link_record' then
        if v_kind <> 'record' or not exists (select 1 from events.workspace_records r
          where r.id = v_id and r.project_id = p_project and r.event_id = p_event and r.deleted_at is null) then
          perform events.workspace__fail('Link target out of scope');
        end if;
        if not exists (select 1 from events.workspace_records r where r.id = v_id and r.object_id = (f.config->>'targetObjectId')::uuid) then
          perform events.workspace__fail('Link target wrong list');
        end if;
      elsif v_kind is distinct from f.config->>'target' or not events.workspace__target_in_scope(p_project, p_event, v_kind, v_id) then
        perform events.workspace__fail('Link target out of scope');
      end if;
      insert into events.workspace_links (project_id, event_id, source_record_id, field_id, target_kind, target_id, position)
      values (p_project, p_event, p_record, f.id, v_kind, v_id, v_pos) on conflict do nothing;
      v_pos := v_pos + 1;
    end loop;
  end loop;
  return v_previous;
end $$;

-- Rebuilds the unique-value index rows of one record (or of one field across the object when p_field is set).
create or replace function events.workspace__sync_unique(p_project uuid, p_event uuid, p_record uuid, p_object uuid, p_field uuid default null)
returns void language plpgsql set search_path = '' as $$
declare
  f record;
  r record;
  v text;
begin
  if p_field is not null then
    delete from events.workspace_unique_values where field_id = p_field;
  else
    delete from events.workspace_unique_values where record_id = p_record;
  end if;
  for f in select id, name from events.workspace_fields
    where object_id = p_object and is_unique and deleted_at is null and (p_field is null or id = p_field) loop
    for r in select id, data from events.workspace_records
      where object_id = p_object and deleted_at is null and (p_record is null or id = p_record) loop
      v := r.data->>f.id::text;
      continue when v is null or v = '';
      begin
        insert into events.workspace_unique_values (project_id, event_id, field_id, value_hash, record_id)
        values (p_project, p_event, f.id, md5(lower(v)), r.id);
      exception when unique_violation then
        raise exception using message = 'Unique value: ' || lower(f.name), errcode = '23505';
      end;
    end loop;
  end loop;
end $$;

create or replace function events.workspace__record_create(p_project uuid, p_event uuid, p_actor uuid, p_object uuid, p_input jsonb)
returns events.workspace_records language plpgsql set search_path = '' as $$
declare
  o events.workspace_objects;
  r events.workspace_records;
  v_data jsonb;
  v_status text := p_input->>'status';
begin
  o := events.workspace__object(p_project, p_event, p_object);
  perform events.workspace__check_status(o.statuses, v_status);
  v_data := events.workspace__merge_values(o.id, '{}'::jsonb, p_input->'values');
  update events.workspace_objects set next_number = next_number + 1 where id = o.id;
  insert into events.workspace_records (id, project_id, event_id, object_id, number, title, status, data, created_by, updated_by)
  values (coalesce((p_input->>'id')::uuid, gen_random_uuid()), p_project, p_event, o.id, o.next_number,
    coalesce(nullif(p_input->>'title', ''), o.number_prefix || '-' || o.next_number), v_status, v_data, p_actor, p_actor)
  returning * into r;
  perform events.workspace__set_links(p_project, p_event, r.id, o.id, p_input->'links');
  perform events.workspace__sync_unique(p_project, p_event, r.id, o.id);
  perform events.workspace__log(p_project, p_event, p_actor, 'record', 'record.create', o.id, null, r.id, null,
    jsonb_strip_nulls(jsonb_build_object('title', r.title, 'status', v_status, 'note', p_input->>'note')) || jsonb_build_object('values', v_data));
  return r;
end $$;

create or replace function events.workspace__record_update(p_project uuid, p_event uuid, p_actor uuid, p_input jsonb, p_check_revision boolean)
returns events.workspace_records language plpgsql set search_path = '' as $$
declare
  r events.workspace_records;
  o events.workspace_objects;
  v_data jsonb;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_values_before jsonb := '{}'::jsonb;
  v_values_after jsonb := '{}'::jsonb;
  v_status text;
  v_title text;
  v_links jsonb;
  k text;
begin
  select * into r from events.workspace_records
    where id = (p_input->>'recordId')::uuid and project_id = p_project and event_id = p_event for update;
  if not found or r.deleted_at is not null then perform events.workspace__fail('Unknown record'); end if;
  if p_check_revision and (p_input->>'expectedRevision')::bigint is distinct from r.revision then
    perform events.workspace__fail('Record changed', '40001');
  end if;
  o := events.workspace__object(p_project, p_event, r.object_id);
  v_data := events.workspace__merge_values(o.id, r.data, p_input->'values');
  for k in select jsonb_object_keys(coalesce(nullif(p_input->'values', 'null'::jsonb), '{}'::jsonb)) loop
    v_values_before := v_values_before || jsonb_build_object(k, coalesce(r.data->k, 'null'::jsonb));
    v_values_after := v_values_after || jsonb_build_object(k, coalesce(v_data->k, 'null'::jsonb));
  end loop;
  v_before := jsonb_build_object('values', v_values_before);
  v_after := jsonb_build_object('values', v_values_after);
  v_status := r.status;
  if p_input ? 'status' then
    v_status := p_input->>'status';
    perform events.workspace__check_status(o.statuses, v_status);
    if v_status is distinct from r.status then
      v_before := v_before || jsonb_build_object('status', r.status);
      v_after := v_after || jsonb_build_object('status', v_status);
    end if;
  end if;
  v_title := r.title;
  if p_input ? 'title' then
    v_title := coalesce(nullif(p_input->>'title', ''), o.number_prefix || '-' || r.number);
  end if;
  if p_input ? 'links' then
    v_links := events.workspace__set_links(p_project, p_event, r.id, o.id, p_input->'links');
    v_before := v_before || jsonb_build_object('links', v_links);
    v_after := v_after || jsonb_build_object('links', p_input->'links');
  end if;
  update events.workspace_records
    set data = v_data, status = v_status, title = v_title, revision = revision + 1, updated_by = p_actor, updated_at = now()
    where id = r.id returning * into r;
  perform events.workspace__sync_unique(p_project, p_event, r.id, o.id);
  perform events.workspace__log(p_project, p_event, p_actor, 'record', 'record.update', o.id, null, r.id, v_before, v_after);
  return r;
end $$;

create or replace function events.workspace__records_delete(p_project uuid, p_event uuid, p_actor uuid, p_ids uuid[], p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_ids uuid[];
  v_change uuid;
begin
  with gone as (
    update events.workspace_records set deleted_at = now(), updated_by = p_actor, updated_at = now()
    where project_id = p_project and event_id = p_event and id = any (p_ids) and deleted_at is null
    returning id
  ) select coalesce(array_agg(id), '{}') into v_ids from gone;
  delete from events.workspace_unique_values where record_id = any (v_ids);
  if p_log and cardinality(v_ids) > 0 then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'record', 'records.delete', null, null,
      case when cardinality(v_ids) = 1 then v_ids[1] end, null, jsonb_build_object('recordIds', to_jsonb(v_ids)));
  end if;
  return jsonb_build_object('count', cardinality(v_ids), 'changeId', v_change);
end $$;

create or replace function events.workspace__records_restore(p_project uuid, p_event uuid, p_actor uuid, p_ids uuid[], p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  r record;
  v_ids uuid[] := '{}';
  v_change uuid;
begin
  for r in select x.id, x.object_id from events.workspace_records x
    join events.workspace_objects o on o.id = x.object_id and o.deleted_at is null
    where x.project_id = p_project and x.event_id = p_event and x.id = any (p_ids) and x.deleted_at is not null for update of x loop
    update events.workspace_records set deleted_at = null, updated_by = p_actor, updated_at = now() where id = r.id;
    perform events.workspace__sync_unique(p_project, p_event, r.id, r.object_id);
    v_ids := v_ids || r.id;
  end loop;
  if p_log and cardinality(v_ids) > 0 then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'record', 'records.restore', null, null,
      case when cardinality(v_ids) = 1 then v_ids[1] end, null, jsonb_build_object('recordIds', to_jsonb(v_ids)));
  end if;
  return jsonb_build_object('count', cardinality(v_ids), 'changeId', v_change);
end $$;

create or replace function events.workspace__object_delete(p_project uuid, p_event uuid, p_actor uuid, p_id uuid, p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  o events.workspace_objects;
  v_change uuid;
begin
  o := events.workspace__object(p_project, p_event, p_id);
  if exists (select 1 from events.workspace_fields f join events.workspace_objects other on other.id = f.object_id
    where f.project_id = p_project and f.event_id = p_event and f.type = 'link_record' and f.deleted_at is null
      and other.deleted_at is null and other.id <> o.id and f.config->>'targetObjectId' = o.id::text) then
    perform events.workspace__fail('Object in use');
  end if;
  update events.workspace_objects set deleted_at = now(), revision = revision + 1, updated_at = now() where id = o.id returning * into o;
  if p_log then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'object.delete', o.id, null, null, null, null);
  end if;
  return jsonb_build_object('object', events.workspace__object_json(o), 'changeId', v_change);
end $$;

create or replace function events.workspace__object_restore(p_project uuid, p_event uuid, p_actor uuid, p_id uuid, p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  o events.workspace_objects;
  v_change uuid;
begin
  o := events.workspace__object(p_project, p_event, p_id, false);
  if o.deleted_at is null then return jsonb_build_object('object', events.workspace__object_json(o)); end if;
  if (select count(*) from events.workspace_objects where project_id = p_project and event_id = p_event and deleted_at is null) >= 50 then
    perform events.workspace__fail('Object limit reached');
  end if;
  update events.workspace_objects set deleted_at = null, revision = revision + 1, updated_at = now() where id = o.id returning * into o;
  if p_log then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'object.restore', o.id, null, null, null, null);
  end if;
  return jsonb_build_object('object', events.workspace__object_json(o), 'changeId', v_change);
end $$;

create or replace function events.workspace__field_delete(p_project uuid, p_event uuid, p_actor uuid, p_id uuid, p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  f events.workspace_fields;
  v_change uuid;
begin
  f := events.workspace__field(p_project, p_event, p_id);
  if f.deleted_at is not null then perform events.workspace__fail('Unknown field'); end if;
  if exists (select 1 from events.workspace_objects o where o.id = f.object_id and o.title_field_id = f.id) then
    perform events.workspace__fail('Field in use');
  end if;
  update events.workspace_fields set deleted_at = now(), revision = revision + 1, updated_at = now() where id = f.id returning * into f;
  delete from events.workspace_unique_values where field_id = f.id;
  if p_log then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'field.delete', f.object_id, f.id, null, null, null);
  end if;
  return jsonb_build_object('field', events.workspace__field_json(f), 'changeId', v_change);
end $$;

create or replace function events.workspace__field_restore(p_project uuid, p_event uuid, p_actor uuid, p_id uuid, p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  f events.workspace_fields;
  v_change uuid;
begin
  f := events.workspace__field(p_project, p_event, p_id);
  if f.deleted_at is null then return jsonb_build_object('field', events.workspace__field_json(f)); end if;
  perform events.workspace__object(p_project, p_event, f.object_id);
  if exists (select 1 from events.workspace_fields x where x.object_id = f.object_id and x.deleted_at is null and lower(x.name) = lower(f.name)) then
    perform events.workspace__fail('Field name taken');
  end if;
  if (select count(*) from events.workspace_fields where object_id = f.object_id and deleted_at is null) >= 150 then
    perform events.workspace__fail('Field limit reached');
  end if;
  update events.workspace_fields set deleted_at = null, revision = revision + 1, updated_at = now() where id = f.id returning * into f;
  if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, f.object_id, f.id); end if;
  if p_log then
    v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'field.restore', f.object_id, f.id, null, null, null);
  end if;
  return jsonb_build_object('field', events.workspace__field_json(f), 'changeId', v_change);
end $$;

-- Applies a set of object/field definition values (used by update and by undo).
create or replace function events.workspace__object_apply(p_id uuid, p_patch jsonb) returns events.workspace_objects
language plpgsql set search_path = '' as $$
declare o events.workspace_objects;
begin
  update events.workspace_objects set
    name = coalesce(p_patch->>'name', name),
    plural = coalesce(p_patch->>'plural', plural),
    icon = coalesce(p_patch->>'icon', icon),
    number_prefix = coalesce(p_patch->>'numberPrefix', number_prefix),
    statuses = coalesce(p_patch->'statuses', statuses),
    title_field_id = case when p_patch ? 'titleFieldId' then (p_patch->>'titleFieldId')::uuid else title_field_id end,
    revision = revision + 1, updated_at = now()
  where id = p_id returning * into o;
  if o.title_field_id is not null and not exists (select 1 from events.workspace_fields f
    where f.id = o.title_field_id and f.object_id = o.id and f.deleted_at is null) then
    perform events.workspace__fail('Unknown field');
  end if;
  return o;
end $$;

create or replace function events.workspace__field_apply(p_id uuid, p_patch jsonb) returns events.workspace_fields
language plpgsql set search_path = '' as $$
declare f events.workspace_fields;
begin
  update events.workspace_fields set
    name = coalesce(p_patch->>'name', name),
    type = coalesce(p_patch->>'type', type),
    config = coalesce(p_patch->'config', config),
    required = coalesce((p_patch->>'required')::boolean, required),
    is_unique = coalesce((p_patch->>'isUnique')::boolean, is_unique),
    revision = revision + 1, updated_at = now()
  where id = p_id returning * into f;
  if exists (select 1 from events.workspace_fields x where x.object_id = f.object_id and x.id <> f.id
    and x.deleted_at is null and lower(x.name) = lower(f.name)) then
    perform events.workspace__fail('Field name taken');
  end if;
  return f;
end $$;

create or replace function events.workspace__set_values(p_record uuid, p_field uuid, p_value jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare v_old jsonb;
begin
  select coalesce(data->p_field::text, 'null'::jsonb) into v_old from events.workspace_records where id = p_record for update;
  update events.workspace_records
    set data = case when p_value is null or p_value = 'null'::jsonb then data - p_field::text else data || jsonb_build_object(p_field::text, p_value) end
    where id = p_record;
  return v_old;
end $$;

create or replace function events.workspace__undo(p_project uuid, p_event uuid, p_actor uuid, p_change uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c events.workspace_changes;
  item jsonb;
  v_ids uuid[];
  f events.workspace_fields;
begin
  select * into c from events.workspace_changes where id = p_change and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown change'); end if;
  if c.undone_at is not null or c.undo_of is not null then perform events.workspace__fail('Change cannot be undone'); end if;
  case c.action
    when 'object.create' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.delete' then perform events.workspace__object_restore(p_project, p_event, p_actor, c.object_id, false);
    when 'object.restore' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.update' then
      perform events.workspace__object(p_project, p_event, c.object_id);
      perform events.workspace__object_apply(c.object_id, c.before->'object');
      for item in select * from jsonb_array_elements(coalesce(c.before->'recordStatuses', '[]'::jsonb)) loop
        update events.workspace_records set status = item->>'status' where id = (item->>'id')::uuid and object_id = c.object_id;
      end loop;
    when 'field.create' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.delete' then perform events.workspace__field_restore(p_project, p_event, p_actor, c.field_id, false);
    when 'field.restore' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.update' then
      f := events.workspace__field(p_project, p_event, c.field_id);
      if f.deleted_at is not null then perform events.workspace__fail('Change cannot be undone'); end if;
      f := events.workspace__field_apply(f.id, c.before->'field');
      for item in select * from jsonb_array_elements(coalesce(c.before->'values', '[]'::jsonb)) loop
        perform events.workspace__set_values((item->>'recordId')::uuid, f.id, item->'value');
      end loop;
      if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, f.object_id, f.id);
      else delete from events.workspace_unique_values where field_id = f.id; end if;
    when 'records.delete' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_restore(p_project, p_event, p_actor, v_ids, false);
    when 'records.restore' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_delete(p_project, p_event, p_actor, v_ids, false);
    else perform events.workspace__fail('Change cannot be undone');
  end case;
  update events.workspace_changes set undone_at = now() where id = c.id;
  perform events.workspace__log(p_project, p_event, p_actor, c.kind, 'change.undo', c.object_id, c.field_id, c.record_id,
    null, jsonb_build_object('action', c.action), c.id);
  return jsonb_build_object('undone', c.id);
end $$;

create or replace function events.workspace_command(p_project uuid, p_event uuid, p_actor uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action';
  v_command_id uuid;
  v_hash text := p_command->>'requestHash';
  v_permission text;
  v_receipt events.workspace_command_receipts;
  v_result jsonb;
  v_revision bigint;
  o events.workspace_objects;
  f events.workspace_fields;
  r events.workspace_records;
  v events.workspace_saved_views;
  item jsonb;
  v_before jsonb;
  v_values jsonb;
  v_ids uuid[];
  v_count integer;
  v_change uuid;
begin
  begin
    v_command_id := (p_command->>'commandId')::uuid;
  exception when others then
    perform events.workspace__fail('Invalid command');
  end;
  if v_action is null or v_command_id is null or v_hash is null then perform events.workspace__fail('Invalid command'); end if;
  if not exists (select 1 from events.events e where e.id = p_event and e.project_id = p_project) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;

  if v_action = 'view.save' or v_action = 'view.delete' then
    if p_command ? 'viewId' then
      select * into v from events.workspace_saved_views where id = (p_command->>'viewId')::uuid and project_id = p_project and event_id = p_event;
      if not found then perform events.workspace__fail('Unknown view'); end if;
    end if;
    v_permission := case when coalesce((p_command->>'shared')::boolean, false) or (v.id is not null and v.owner_id is null) then 'configure' else 'view' end;
  else
    v_permission := case
      when v_action in ('record.create', 'records.import') then 'record_create'
      when v_action in ('record.update', 'records.bulk', 'comment.add') then 'record_update'
      when v_action in ('records.delete', 'records.restore') then 'record_delete'
      when v_action in ('workspace.create', 'workspace.delete', 'object.create', 'object.update', 'object.delete', 'object.restore',
        'object.reorder', 'field.create', 'field.update', 'field.delete', 'field.restore', 'field.reorder', 'records.recompute',
        'change.undo') then 'configure'
    end;
  end if;
  if v_permission is null then perform events.workspace__fail('Invalid command'); end if;
  if not events.workspace_can(p_project, p_event, p_actor, 'events.workspace.' || v_permission) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;

  if v_action = 'workspace.create' then
    if exists (select 1 from events.workspace_workspaces where project_id = p_project and event_id = p_event) then
      select * into v_receipt from events.workspace_command_receipts
        where project_id = p_project and event_id = p_event and actor_id = p_actor and command_id = v_command_id;
      if found and v_receipt.request_hash = v_hash then return v_receipt.response; end if;
      perform events.workspace__fail('Workspace exists');
    end if;
    insert into events.workspace_workspaces (project_id, event_id, created_from, created_by)
    values (p_project, p_event, coalesce(p_command->'createdFrom', '{"kind":"empty"}'::jsonb), p_actor);
  else
    perform 1 from events.workspace_workspaces where project_id = p_project and event_id = p_event for update;
    if not found then perform events.workspace__fail('Workspace required'); end if;
    select * into v_receipt from events.workspace_command_receipts
      where project_id = p_project and event_id = p_event and actor_id = p_actor and command_id = v_command_id;
    if found then
      if v_receipt.request_hash <> v_hash then perform events.workspace__fail('Command ID reused', '23505'); end if;
      return v_receipt.response;
    end if;
  end if;

  case v_action
    when 'workspace.create' then
      v_result := jsonb_build_object('created', true);

    when 'workspace.delete' then
      delete from events.workspace_workspaces where project_id = p_project and event_id = p_event;
      return jsonb_build_object('deleted', true);

    when 'object.create' then
      if (select count(*) from events.workspace_objects where project_id = p_project and event_id = p_event and deleted_at is null) >= 50 then
        perform events.workspace__fail('Object limit reached');
      end if;
      if exists (select 1 from events.workspace_objects where project_id = p_project and event_id = p_event and key = p_command->'object'->>'key') then
        perform events.workspace__fail('Object key taken');
      end if;
      insert into events.workspace_objects (id, project_id, event_id, key, name, plural, icon, statuses, number_prefix, position)
      values (coalesce((p_command->'object'->>'id')::uuid, gen_random_uuid()), p_project, p_event,
        p_command->'object'->>'key', p_command->'object'->>'name', p_command->'object'->>'plural',
        coalesce(p_command->'object'->>'icon', 'database'), coalesce(p_command->'object'->'statuses', '[]'::jsonb),
        p_command->'object'->>'numberPrefix',
        coalesce((select max(position) + 1 from events.workspace_objects where project_id = p_project and event_id = p_event), 0))
      returning * into o;
      v_count := 0;
      for item in select * from jsonb_array_elements(coalesce(p_command->'fields', '[]'::jsonb)) loop
        insert into events.workspace_fields (id, project_id, event_id, object_id, key, name, type, config, required, is_unique, position)
        values (coalesce((item->>'id')::uuid, gen_random_uuid()), p_project, p_event, o.id, item->>'key', item->>'name', item->>'type',
          coalesce(item->'config', '{}'::jsonb), coalesce((item->>'required')::boolean, false), coalesce((item->>'isUnique')::boolean, false), v_count);
        v_count := v_count + 1;
      end loop;
      if v_count > 150 then perform events.workspace__fail('Field limit reached'); end if;
      if p_command ? 'titleFieldKey' then
        update events.workspace_objects set title_field_id = (select id from events.workspace_fields
          where object_id = o.id and key = p_command->>'titleFieldKey') where id = o.id returning * into o;
      end if;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'object.create', o.id, null, null, null, null);
      v_result := jsonb_build_object('object', events.workspace__object_json(o), 'changeId', v_change,
        'fields', coalesce((select jsonb_agg(events.workspace__field_json(x) order by x.position) from events.workspace_fields x where x.object_id = o.id), '[]'::jsonb));

    when 'object.update' then
      o := events.workspace__object(p_project, p_event, (p_command->>'objectId')::uuid);
      if (p_command->>'expectedRevision')::bigint is distinct from o.revision then perform events.workspace__fail('Object changed', '40001'); end if;
      v_before := jsonb_build_object('name', o.name, 'plural', o.plural, 'icon', o.icon, 'numberPrefix', o.number_prefix,
        'statuses', o.statuses, 'titleFieldId', o.title_field_id);
      o := events.workspace__object_apply(o.id, p_command->'patch');
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status)), '[]'::jsonb) into v_values
        from events.workspace_records x where x.object_id = o.id and x.status is not null
          and not exists (select 1 from jsonb_array_elements(o.statuses) s where s->>'key' = x.status);
      update events.workspace_records x set status = null where x.object_id = o.id and x.status is not null
        and not exists (select 1 from jsonb_array_elements(o.statuses) s where s->>'key' = x.status);
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'object.update', o.id, null, null,
        jsonb_build_object('object', v_before, 'recordStatuses', v_values), jsonb_build_object('object', p_command->'patch'));
      v_result := jsonb_build_object('object', events.workspace__object_json(o), 'changeId', v_change);

    when 'object.delete' then
      v_result := events.workspace__object_delete(p_project, p_event, p_actor, (p_command->>'objectId')::uuid, true);
    when 'object.restore' then
      v_result := events.workspace__object_restore(p_project, p_event, p_actor, (p_command->>'objectId')::uuid, true);
    when 'object.reorder' then
      update events.workspace_objects x set position = ordered.idx - 1, updated_at = now()
      from jsonb_array_elements_text(p_command->'order') with ordinality as ordered(id, idx)
      where x.id = ordered.id::uuid and x.project_id = p_project and x.event_id = p_event;
      v_result := jsonb_build_object('reordered', true);

    when 'field.create' then
      o := events.workspace__object(p_project, p_event, (p_command->>'objectId')::uuid);
      if (select count(*) from events.workspace_fields where object_id = o.id and deleted_at is null) >= 150 then
        perform events.workspace__fail('Field limit reached');
      end if;
      if exists (select 1 from events.workspace_fields where object_id = o.id and key = p_command->'field'->>'key') then
        perform events.workspace__fail('Field key taken');
      end if;
      if exists (select 1 from events.workspace_fields where object_id = o.id and deleted_at is null and lower(name) = lower(p_command->'field'->>'name')) then
        perform events.workspace__fail('Field name taken');
      end if;
      insert into events.workspace_fields (id, project_id, event_id, object_id, key, name, type, config, required, is_unique, position)
      values (coalesce((p_command->'field'->>'id')::uuid, gen_random_uuid()), p_project, p_event, o.id,
        p_command->'field'->>'key', p_command->'field'->>'name', p_command->'field'->>'type',
        coalesce(p_command->'field'->'config', '{}'::jsonb), coalesce((p_command->'field'->>'required')::boolean, false),
        coalesce((p_command->'field'->>'isUnique')::boolean, false),
        coalesce((select max(position) + 1 from events.workspace_fields where object_id = o.id), 0))
      returning * into f;
      if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, o.id, f.id); end if;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'field.create', o.id, f.id, null, null, null);
      v_result := jsonb_build_object('field', events.workspace__field_json(f), 'changeId', v_change);

    when 'field.update' then
      f := events.workspace__field(p_project, p_event, (p_command->>'fieldId')::uuid);
      if f.deleted_at is not null then perform events.workspace__fail('Unknown field'); end if;
      perform events.workspace__object(p_project, p_event, f.object_id);
      if (p_command->>'expectedRevision')::bigint is distinct from f.revision then perform events.workspace__fail('Field changed', '40001'); end if;
      v_before := jsonb_build_object('name', f.name, 'type', f.type, 'config', f.config, 'required', f.required, 'isUnique', f.is_unique);
      f := events.workspace__field_apply(f.id, p_command->'patch');
      v_values := '[]'::jsonb;
      for item in select * from jsonb_array_elements(coalesce(p_command->'conversions', '[]'::jsonb)) loop
        if not exists (select 1 from events.workspace_records x where x.id = (item->>'recordId')::uuid and x.object_id = f.object_id) then
          perform events.workspace__fail('Unknown record');
        end if;
        v_values := v_values || jsonb_build_array(jsonb_build_object('recordId', item->>'recordId',
          'value', events.workspace__set_values((item->>'recordId')::uuid, f.id, item->'value')));
      end loop;
      if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, f.object_id, f.id);
      else delete from events.workspace_unique_values where field_id = f.id; end if;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'field.update', f.object_id, f.id, null,
        jsonb_build_object('field', v_before, 'values', v_values), jsonb_build_object('field', p_command->'patch'));
      v_result := jsonb_build_object('field', events.workspace__field_json(f), 'changeId', v_change);

    when 'field.delete' then
      v_result := events.workspace__field_delete(p_project, p_event, p_actor, (p_command->>'fieldId')::uuid, true);
    when 'field.restore' then
      v_result := events.workspace__field_restore(p_project, p_event, p_actor, (p_command->>'fieldId')::uuid, true);
    when 'field.reorder' then
      o := events.workspace__object(p_project, p_event, (p_command->>'objectId')::uuid);
      update events.workspace_fields x set position = ordered.idx - 1, updated_at = now()
      from jsonb_array_elements_text(p_command->'order') with ordinality as ordered(id, idx)
      where x.id = ordered.id::uuid and x.object_id = o.id;
      v_result := jsonb_build_object('reordered', true);

    when 'record.create' then
      r := events.workspace__record_create(p_project, p_event, p_actor, (p_command->>'objectId')::uuid, p_command);
      v_result := jsonb_build_object('record', events.workspace__record_json(r));

    when 'records.import' then
      if jsonb_array_length(coalesce(p_command->'rows', '[]'::jsonb)) > 500 then perform events.workspace__fail('Too many rows'); end if;
      v_count := 0;
      for item in select * from jsonb_array_elements(coalesce(p_command->'rows', '[]'::jsonb)) loop
        continue when item ? 'id' and exists (select 1 from events.workspace_records x
          where x.id = (item->>'id')::uuid and x.project_id = p_project and x.event_id = p_event);
        perform events.workspace__record_create(p_project, p_event, p_actor, (p_command->>'objectId')::uuid, item);
        v_count := v_count + 1;
      end loop;
      v_result := jsonb_build_object('count', v_count);

    when 'record.update' then
      r := events.workspace__record_update(p_project, p_event, p_actor, p_command, true);
      v_result := jsonb_build_object('record', events.workspace__record_json(r));

    when 'records.bulk' then
      if jsonb_array_length(coalesce(p_command->'updates', '[]'::jsonb)) > 500 then perform events.workspace__fail('Too many rows'); end if;
      v_count := 0;
      for item in select * from jsonb_array_elements(coalesce(p_command->'updates', '[]'::jsonb)) loop
        perform events.workspace__record_update(p_project, p_event, p_actor, item, false);
        v_count := v_count + 1;
      end loop;
      v_result := jsonb_build_object('count', v_count);

    when 'records.delete' then
      select coalesce(array_agg(value::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_command->'recordIds', '[]'::jsonb));
      v_result := events.workspace__records_delete(p_project, p_event, p_actor, v_ids, true);
    when 'records.restore' then
      select coalesce(array_agg(value::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_command->'recordIds', '[]'::jsonb));
      v_result := events.workspace__records_restore(p_project, p_event, p_actor, v_ids, true);

    when 'records.recompute' then
      o := events.workspace__object(p_project, p_event, (p_command->>'objectId')::uuid);
      if jsonb_array_length(coalesce(p_command->'updates', '[]'::jsonb)) > 500 then perform events.workspace__fail('Too many rows'); end if;
      v_count := 0;
      for item in select * from jsonb_array_elements(coalesce(p_command->'updates', '[]'::jsonb)) loop
        update events.workspace_records x set
          data = events.workspace__merge_values(o.id, x.data, item->'values'),
          title = case when item ? 'title' then coalesce(nullif(item->>'title', ''), o.number_prefix || '-' || x.number) else x.title end
        where x.id = (item->>'recordId')::uuid and x.object_id = o.id;
        if item ? 'links' then
          perform events.workspace__set_links(p_project, p_event, (item->>'recordId')::uuid, o.id, item->'links');
        end if;
        v_count := v_count + 1;
      end loop;
      perform events.workspace__sync_unique(p_project, p_event, null, o.id, uf.id) from events.workspace_fields uf
        where uf.object_id = o.id and uf.is_unique and uf.deleted_at is null;
      v_result := jsonb_build_object('count', v_count);

    when 'comment.add' then
      select * into r from events.workspace_records where id = (p_command->>'recordId')::uuid and project_id = p_project and event_id = p_event and deleted_at is null;
      if not found then perform events.workspace__fail('Unknown record'); end if;
      insert into events.workspace_comments (project_id, event_id, record_id, body, created_by)
      values (p_project, p_event, r.id, p_command->>'body', p_actor)
      returning jsonb_build_object('id', id, 'recordId', record_id, 'body', body, 'createdBy', created_by, 'createdAt', created_at) into v_result;
      v_result := jsonb_build_object('comment', v_result);

    when 'view.save' then
      if v.id is not null and v.owner_id is not null and v.owner_id <> p_actor then perform events.workspace__fail('Unknown view'); end if;
      o := events.workspace__object(p_project, p_event, coalesce(v.object_id, (p_command->>'objectId')::uuid));
      if v.id is null then
        if (select count(*) from events.workspace_saved_views where object_id = o.id) >= 100 then perform events.workspace__fail('View limit reached'); end if;
        insert into events.workspace_saved_views (project_id, event_id, object_id, name, owner_id, config, position)
        values (p_project, p_event, o.id, p_command->>'name',
          case when coalesce((p_command->>'shared')::boolean, false) then null else p_actor end,
          coalesce(p_command->'config', '{}'::jsonb),
          coalesce((select max(position) + 1 from events.workspace_saved_views where object_id = o.id), 0))
        returning * into v;
      else
        update events.workspace_saved_views set
          name = coalesce(p_command->>'name', name),
          config = coalesce(p_command->'config', config),
          owner_id = case when p_command ? 'shared' then case when (p_command->>'shared')::boolean then null else p_actor end else owner_id end,
          updated_at = now()
        where id = v.id returning * into v;
      end if;
      v_result := jsonb_build_object('view', events.workspace__view_json(v));

    when 'view.delete' then
      if v.id is null or (v.owner_id is not null and v.owner_id <> p_actor) then perform events.workspace__fail('Unknown view'); end if;
      delete from events.workspace_saved_views where id = v.id;
      v_result := jsonb_build_object('deleted', true);

    when 'change.undo' then
      v_result := events.workspace__undo(p_project, p_event, p_actor, (p_command->>'changeId')::uuid);

    else
      perform events.workspace__fail('Invalid command');
  end case;

  update events.workspace_workspaces set revision = revision + 1, updated_at = now()
    where project_id = p_project and event_id = p_event returning revision into v_revision;
  v_result := v_result || jsonb_build_object('revision', v_revision);
  insert into events.workspace_command_receipts (project_id, event_id, actor_id, command_id, request_hash, response)
  values (p_project, p_event, p_actor, v_command_id, v_hash, v_result);
  return v_result;
end $$;

-- Read-side cast of one stored value; mismatched shapes read as null instead of failing the whole page.
create or replace function events.workspace__value_sql(p_field text, p_cast text) returns text
language sql immutable set search_path = '' as $$
  select case p_cast
    when 'text' then format('(r.data->>%L)', p_field)
    when 'numeric' then format('(case when jsonb_typeof(r.data->%1$L) = ''number'' then (r.data->>%1$L)::numeric end)', p_field)
    when 'boolean' then format('(case when jsonb_typeof(r.data->%1$L) = ''boolean'' then (r.data->>%1$L)::boolean end)', p_field)
    when 'date' then format('(case when (r.data->>%1$L) ~ ''^\d{4}-\d{2}-\d{2}$'' then (r.data->>%1$L)::date end)', p_field)
    when 'timestamptz' then format('(case when (r.data->>%1$L) ~ ''^\d{4}-\d{2}-\d{2}T'' then (r.data->>%1$L)::timestamptz end)', p_field)
    when 'text[]' then format('(r.data->%L)', p_field)
    when 'file' then format('(r.data->%L)', p_field)
  end;
$$;

create or replace function events.workspace__condition_sql(p_object uuid, p_node jsonb, p_computed jsonb, p_depth integer)
returns text language plpgsql stable set search_path = '' as $$
declare
  v_parts text[] := '{}';
  item jsonb;
  v_source text := p_node->>'source';
  v_cast text := p_node->>'cast';
  v_op text := p_node->>'operator';
  v_value jsonb := p_node->'value';
  v_expr text;
  v_field uuid;
  v_type text;
  v_lit text;
begin
  if p_node ? 'op' then
    if p_depth > 3 or p_node->>'op' not in ('and', 'or') or jsonb_array_length(p_node->'items') > 50 then
      perform events.workspace__fail('Invalid filter');
    end if;
    for item in select * from jsonb_array_elements(p_node->'items') loop
      v_parts := v_parts || events.workspace__condition_sql(p_object, item, p_computed, p_depth + 1);
    end loop;
    if cardinality(v_parts) = 0 then return 'true'; end if;
    return '(' || array_to_string(v_parts, case when p_node->>'op' = 'and' then ' and ' else ' or ' end) || ')';
  end if;

  if v_cast not in ('text', 'numeric', 'boolean', 'date', 'timestamptz', 'text[]', 'link', 'file') then
    perform events.workspace__fail('Invalid filter');
  end if;
  if v_source = 'system' then
    v_expr := case p_node->>'column'
      when 'number' then 'r.number' when 'title' then 'r.title' when 'status' then 'r.status'
      when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
  elsif v_source = 'value' then
    v_field := (p_node->>'fieldId')::uuid;
    select type into v_type from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null;
    if v_type is null or v_type in ('link_record', 'link_event', 'lookup', 'rollup') then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := events.workspace__value_sql(v_field::text, v_cast);
  elsif v_source = 'computed' then
    v_expr := p_computed->>(p_node->>'alias');
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
  elsif v_source = 'link' then
    v_field := (p_node->>'fieldId')::uuid;
    if not exists (select 1 from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null
      and type in ('link_record', 'link_event')) then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := format('exists (select 1 from events.workspace_links l where l.source_record_id = r.id and l.field_id = %L', v_field);
    return case v_op
      when 'is_empty' then 'not ' || v_expr || ')'
      when 'is_not_empty' then v_expr || ')'
      when 'has_any' then v_expr || format(' and l.target_id = any (%L::uuid[]))', (select array_agg(value) from jsonb_array_elements_text(v_value)))
      else events.workspace__invalid() end;
  else
    perform events.workspace__fail('Invalid filter');
  end if;

  v_lit := case when jsonb_typeof(v_value) = 'array' then null else v_value #>> '{}' end;
  return case
    when v_op = 'is_empty' and v_cast in ('text[]', 'file') then format('(%1$s is null or jsonb_array_length(%1$s) = 0)', v_expr)
    when v_op = 'is_not_empty' and v_cast in ('text[]', 'file') then format('(%1$s is not null and jsonb_array_length(%1$s) > 0)', v_expr)
    when v_op = 'is_empty' and v_cast = 'text' then format('(%1$s is null or %1$s = '''')', v_expr)
    when v_op = 'is_not_empty' and v_cast = 'text' then format('(%1$s is not null and %1$s <> '''')', v_expr)
    when v_op = 'is_empty' then format('(%s is null)', v_expr)
    when v_op = 'is_not_empty' then format('(%s is not null)', v_expr)
    when v_op = 'is_true' and v_cast = 'boolean' then format('(%s is true)', v_expr)
    when v_op = 'is_false' and v_cast = 'boolean' then format('(%s is not true)', v_expr)
    when v_cast = 'text' and v_op = 'eq' then format('(lower(%s) = lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'neq' then format('(lower(coalesce(%s, '''')) <> lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) > 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'not_contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) = 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'starts_with' then format('(left(lower(coalesce(%1$s, '''')), length(%2$L)) = lower(%2$L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'any_of' then format('(%s = any (%L::text[]))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text' and v_op = 'none_of' then format('(%1$s is null or not (%1$s = any (%2$L::text[])))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'numeric' and v_op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte') then format('(%s %s %L::numeric)', v_expr,
      case v_op when 'eq' then '=' when 'neq' then 'is distinct from' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end, v_lit)
    when v_cast in ('date', 'timestamptz') and v_op in ('eq', 'before', 'after', 'on_or_before', 'on_or_after') then format('(%s %s %L::%s)', v_expr,
      case v_op when 'eq' then '=' when 'before' then '<' when 'after' then '>' when 'on_or_before' then '<=' else '>=' end, v_lit, v_cast)
    when v_cast = 'text[]' and v_op = 'has_any' then format('coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_all' then format('coalesce(%s ?& %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_none' then format('not coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    else events.workspace__invalid()
  end;
end $$;

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

-- Daily cleanup: permanently removes items that have been in the trash since p_before and returns file paths to delete.
create or replace function events.workspace_purge(p_before timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
  v_records integer;
begin
  update events.workspace_records r set data = r.data - f.id::text
    from events.workspace_fields f
    where f.deleted_at < p_before and r.object_id = f.object_id and r.data ? f.id::text;
  delete from events.workspace_objects where deleted_at < p_before;
  delete from events.workspace_fields where deleted_at < p_before;
  with gone as (delete from events.workspace_records where deleted_at < p_before returning 1)
    select count(*) into v_records from gone;
  delete from events.workspace_links l where l.target_kind = 'record'
    and not exists (select 1 from events.workspace_records r where r.id = l.target_id);
  with gone as (
    delete from events.workspace_files f where f.created_at < now() - interval '1 day'
      and not exists (select 1 from events.workspace_records r
        where r.project_id = f.project_id and r.event_id = f.event_id and strpos(r.data::text, f.id::text) > 0)
    returning f.path
  ) select coalesce(array_agg(path), '{}') into v_paths from gone;
  return jsonb_build_object('records', v_records, 'paths', to_jsonb(v_paths));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'events' and p.proname like 'workspace\_\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
revoke all on function events.workspace_command(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function events.workspace_query(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_command(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function events.workspace_query(uuid, uuid, jsonb) to service_role;
revoke all on function events.workspace_purge(timestamptz) from public, anon, authenticated;
grant execute on function events.workspace_purge(timestamptz) to service_role;

-- @down
drop function if exists events.workspace_purge(timestamptz);
drop function if exists events.workspace_query(uuid, uuid, jsonb);
drop function if exists events.workspace_command(uuid, uuid, uuid, jsonb);
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'events' and p.proname like 'workspace\_\_%' loop
    execute format('drop function if exists %s', f.signature);
  end loop;
end $$;
