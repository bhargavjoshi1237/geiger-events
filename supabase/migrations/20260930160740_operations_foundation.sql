-- Event-scoped operations foundation. Apply after events.events and project access.
-- No rollback: moving archived records and audit across versions is a deliberate export.

-- @up
create unique index if not exists ops_events_event_project_uq on events.events (id, project_id);

create table events.ops_workspaces (
  project_id uuid not null, event_id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  published_version integer check (published_version > 0),
  draft_json jsonb not null default '[]'::jsonb check (jsonb_typeof(draft_json) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id,event_id),
  foreign key (event_id,project_id) references events.events(id,project_id) on delete cascade
);

create table events.ops_workspace_versions (
  project_id uuid not null, event_id uuid not null,
  version integer not null check (version > 0),
  modules jsonb not null check (jsonb_typeof(modules) = 'array'),
  created_by uuid not null, created_at timestamptz not null default now(),
  primary key (project_id,event_id,version),
  foreign key (project_id,event_id) references events.ops_workspaces on delete cascade
);

-- One catalogue stores native and custom definitions for every published revision.
create table events.ops_module_versions (
  project_id uuid not null, event_id uuid not null,
  module_key text not null, version integer not null check (version > 0),
  source_kind text not null check (source_kind in ('native','custom')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  primary key (project_id,event_id,module_key,version),
  foreign key (project_id,event_id,version)
    references events.ops_workspace_versions(project_id,event_id,version) on delete cascade
);

create table events.ops_module_instances (
  project_id uuid not null, event_id uuid not null, module_key text not null,
  definition_version integer not null check (definition_version > 0),
  enabled boolean not null default true,
  primary key (project_id,event_id,module_key),
  foreign key (project_id,event_id) references events.ops_workspaces on delete cascade,
  foreign key (project_id,event_id,module_key,definition_version)
    references events.ops_module_versions(project_id,event_id,module_key,version)
);

create table events.ops_entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null, event_id uuid not null, module_key text not null,
  definition_version integer not null check (definition_version > 0),
  title text not null check (length(title) between 1 and 200),
  state text not null, revision bigint not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id,event_id,id),
  unique (project_id,event_id,id,module_key,definition_version),
  foreign key (project_id,event_id) references events.ops_workspaces on delete cascade,
  foreign key (project_id,event_id,module_key,definition_version)
    references events.ops_module_versions(project_id,event_id,module_key,version)
);

create table events.ops_custom_records (
  project_id uuid not null, event_id uuid not null, entity_id uuid not null,
  module_key text not null, definition_version integer not null,
  field_values jsonb not null default '{}'::jsonb check (jsonb_typeof(field_values) = 'object'),
  primary key (project_id,event_id,entity_id),
  foreign key (project_id,event_id,entity_id,module_key,definition_version)
    references events.ops_entities(project_id,event_id,id,module_key,definition_version)
    on update cascade on delete cascade
);

create table events.ops_entity_links (
  project_id uuid not null, event_id uuid not null,
  source_entity_id uuid not null, target_entity_id uuid not null,
  field_id text not null, created_at timestamptz not null default now(),
  primary key (project_id,event_id,source_entity_id,field_id),
  foreign key (project_id,event_id,source_entity_id)
    references events.ops_entities(project_id,event_id,id) on delete cascade,
  foreign key (project_id,event_id,target_entity_id)
    references events.ops_entities(project_id,event_id,id)
);

create table events.ops_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null, event_id uuid not null, actor_id uuid not null,
  command_id uuid not null, action text not null, entity_id uuid,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (project_id,event_id) references events.ops_workspaces on delete cascade
);

create table events.ops_command_receipts (
  project_id uuid not null, event_id uuid not null, actor_id uuid not null,
  command_id uuid not null, request_hash text not null, response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (project_id,event_id,actor_id,command_id),
  foreign key (project_id,event_id) references events.ops_workspaces on delete cascade
);

create index ops_entities_list_idx on events.ops_entities
  (project_id,event_id,module_key,state,created_at desc,id) where archived_at is null;
create index ops_entities_history_idx on events.ops_entities
  (project_id,event_id,module_key,archived_at) where archived_at is not null;
create index ops_entity_links_target_idx on events.ops_entity_links
  (project_id,event_id,target_entity_id);
create index ops_audit_event_idx on events.ops_audit
  (project_id,event_id,created_at desc);

revoke all on events.ops_workspaces, events.ops_workspace_versions,
  events.ops_module_versions, events.ops_module_instances, events.ops_entities,
  events.ops_custom_records, events.ops_entity_links, events.ops_audit,
  events.ops_command_receipts from public, anon, authenticated, service_role;
grant select, insert, update on events.ops_workspaces,
  events.ops_module_instances, events.ops_entities, events.ops_custom_records to service_role;
grant select, insert, delete on events.ops_entity_links to service_role;
grant select, insert on events.ops_workspace_versions, events.ops_module_versions,
  events.ops_audit, events.ops_command_receipts to service_role;
alter table events.ops_workspaces enable row level security;
alter table events.ops_workspace_versions enable row level security;
alter table events.ops_module_versions enable row level security;
alter table events.ops_module_instances enable row level security;
alter table events.ops_entities enable row level security;
alter table events.ops_custom_records enable row level security;
alter table events.ops_entity_links enable row level security;
alter table events.ops_audit enable row level security;
alter table events.ops_command_receipts enable row level security;


create or replace function events.ops_require_event(p_project_id uuid, p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from events.events
    where id=p_event_id and project_id=p_project_id and deleted_at is null for update) then
    raise exception 'Unknown event or project' using errcode='23503';
  end if;
end;
$$;

create or replace function events.ops_save_workspace_draft(
  p_project_id uuid, p_event_id uuid, p_actor_id uuid,
  p_expected_revision bigint, p_modules jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_workspace events.ops_workspaces%rowtype;
begin
  if p_actor_id is null or p_expected_revision is null or p_expected_revision < 0 or
    jsonb_typeof(p_modules) is distinct from 'array' then
    raise exception 'Invalid workspace draft' using errcode='22023';
  end if;
  perform events.ops_require_event(p_project_id,p_event_id);
  select * into v_workspace from events.ops_workspaces
    where project_id=p_project_id and event_id=p_event_id for update;
  if not found then
    if p_expected_revision <> 0 then
      raise exception 'Workspace revision changed' using errcode='40001';
    end if;
    insert into events.ops_workspaces (project_id,event_id,draft_json)
      values (p_project_id,p_event_id,p_modules) returning * into v_workspace;
  else
    if v_workspace.revision <> p_expected_revision then
      raise exception 'Workspace revision changed' using errcode='40001';
    end if;
    update events.ops_workspaces
      set draft_json=p_modules, revision=revision+1, updated_at=now()
      where project_id=p_project_id and event_id=p_event_id returning * into v_workspace;
  end if;
  return jsonb_build_object('revision',v_workspace.revision,'status',v_workspace.status,
    'draft',v_workspace.draft_json,'publishedVersion',v_workspace.published_version);
end;
$$;

create or replace function events.ops_publish_workspace(
  p_project_id uuid, p_event_id uuid, p_actor_id uuid, p_expected_revision bigint,
  p_modules jsonb, p_command_id uuid, p_request_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_workspace events.ops_workspaces%rowtype;
  v_receipt events.ops_command_receipts%rowtype;
  v_version integer;
  v_response jsonb;
begin
  if p_actor_id is null or p_command_id is null or nullif(p_request_hash,'') is null or
    jsonb_typeof(p_modules) is distinct from 'array' then
    raise exception 'Invalid publication' using errcode='22023';
  end if;
  perform events.ops_require_event(p_project_id,p_event_id);
  select * into v_receipt from events.ops_command_receipts
    where project_id=p_project_id and event_id=p_event_id
      and actor_id=p_actor_id and command_id=p_command_id;
  if found then
    if v_receipt.request_hash <> p_request_hash then
      raise exception 'Command ID reused with different input' using errcode='23505';
    end if;
    return v_receipt.response;
  end if;
  select * into v_workspace from events.ops_workspaces
    where project_id=p_project_id and event_id=p_event_id for update;
  if not found then raise exception 'Workspace not found' using errcode='23503'; end if;
  if v_workspace.revision <> p_expected_revision then
    raise exception 'Workspace revision changed' using errcode='40001';
  end if;
  v_version := coalesce(v_workspace.published_version,0)+1;
  insert into events.ops_workspace_versions (project_id,event_id,version,modules,created_by)
    values (p_project_id,p_event_id,v_version,p_modules,p_actor_id);
  insert into events.ops_module_versions
    (project_id,event_id,module_key,version,source_kind,definition)
    select p_project_id,p_event_id,item->>'key',v_version,item->>'sourceKind',item
    from jsonb_array_elements(p_modules) as item;
  update events.ops_module_instances set enabled=false
    where project_id=p_project_id and event_id=p_event_id;
  insert into events.ops_module_instances
    (project_id,event_id,module_key,definition_version,enabled)
    select p_project_id,p_event_id,item->>'key',v_version,
      coalesce((item->>'enabled')::boolean,true)
    from jsonb_array_elements(p_modules) as item
    on conflict (project_id,event_id,module_key)
    do update set definition_version=excluded.definition_version,enabled=excluded.enabled;
  update events.ops_entities entity
    set definition_version=v_version,revision=revision+1,updated_at=now()
    from events.ops_module_instances instance
    where entity.project_id=p_project_id and entity.event_id=p_event_id
      and instance.project_id=entity.project_id and instance.event_id=entity.event_id
      and instance.module_key=entity.module_key and instance.definition_version=v_version;
  update events.ops_workspaces
    set published_version=v_version,status='active',
      draft_json=p_modules,revision=revision+1,updated_at=now()
    where project_id=p_project_id and event_id=p_event_id returning * into v_workspace;
  v_response := jsonb_build_object('revision',v_workspace.revision,'status',v_workspace.status,
    'publishedVersion',v_version,'draft',p_modules);
  insert into events.ops_audit (project_id,event_id,actor_id,command_id,action,changes)
    values (p_project_id,p_event_id,p_actor_id,p_command_id,'publish',
      jsonb_build_object('version',v_version));
  insert into events.ops_command_receipts
    (project_id,event_id,actor_id,command_id,request_hash,response)
    values (p_project_id,p_event_id,p_actor_id,p_command_id,p_request_hash,v_response);
  return v_response;
end;
$$;

create or replace function events.ops_record_response(
  p_project_id uuid, p_event_id uuid, p_record_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',e.id,'projectId',e.project_id,'eventId',e.event_id,
    'moduleKey',e.module_key,'definitionVersion',e.definition_version,
    'title',e.title,'state',e.state,'revision',e.revision,
    'archivedAt',e.archived_at,'values',r.field_values,
    'references',coalesce((select jsonb_agg(jsonb_build_object(
      'fieldId',l.field_id,'targetId',l.target_entity_id) order by l.field_id)
      from events.ops_entity_links l
      where l.project_id=e.project_id and l.event_id=e.event_id
        and l.source_entity_id=e.id),'[]'::jsonb)
  ) from events.ops_entities e
    join events.ops_custom_records r on r.project_id=e.project_id
      and r.event_id=e.event_id and r.entity_id=e.id
    where e.project_id=p_project_id and e.event_id=p_event_id and e.id=p_record_id;
$$;

create or replace function events.ops_mutate_record(
  p_project_id uuid, p_event_id uuid, p_actor_id uuid, p_command jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action';
  v_module_key text := p_command->>'moduleKey';
  v_command_id uuid := nullif(p_command->>'commandId','')::uuid;
  v_hash text := p_command->>'requestHash';
  v_record_id uuid := nullif(p_command->>'recordId','')::uuid;
  v_expected bigint := nullif(p_command->>'expectedRevision','')::bigint;
  v_definition_version integer := nullif(p_command->>'definitionVersion','')::integer;
  v_instance events.ops_module_instances%rowtype;
  v_entity events.ops_entities%rowtype;
  v_receipt events.ops_command_receipts%rowtype;
  v_response jsonb;
  v_ref jsonb;
  v_title text := nullif(trim(p_command->>'title'),'');
begin
  if p_actor_id is null or v_command_id is null or nullif(v_hash,'') is null or
    v_action is null or v_action not in ('create','update','transition','archive') or
    v_module_key is null or (v_action <> 'create' and (v_record_id is null or v_expected is null)) then
    raise exception 'Invalid record command' using errcode='22023';
  end if;
  perform events.ops_require_event(p_project_id,p_event_id);
  select * into v_receipt from events.ops_command_receipts
    where project_id=p_project_id and event_id=p_event_id
      and actor_id=p_actor_id and command_id=v_command_id;
  if found then
    if v_receipt.request_hash <> v_hash then
      raise exception 'Command ID reused with different input' using errcode='23505';
    end if;
    return v_receipt.response;
  end if;
  if not exists (select 1 from events.ops_workspaces
    where project_id=p_project_id and event_id=p_event_id and status='active') then
    raise exception 'Active workspace required' using errcode='23503';
  end if;
  select * into v_instance from events.ops_module_instances
    where project_id=p_project_id and event_id=p_event_id and module_key=v_module_key
      and enabled for update;
  if not found then raise exception 'Enabled module required' using errcode='23503'; end if;
  if v_definition_version is null or v_definition_version <> v_instance.definition_version then
    raise exception 'Module definition changed' using errcode='40001';
  end if;
  if v_action = 'create' then
    if v_title is null or length(v_title)>200 or
      jsonb_typeof(p_command->'values') is distinct from 'object' or
      jsonb_typeof(p_command->'references') is distinct from 'array' then
      raise exception 'Invalid new record' using errcode='22023';
    end if;
    insert into events.ops_entities
      (project_id,event_id,module_key,definition_version,title,state)
      values (p_project_id,p_event_id,v_module_key,v_instance.definition_version,v_title,
        coalesce((select definition->'states'->0->>'key'
          from events.ops_module_versions
          where project_id=p_project_id and event_id=p_event_id
            and module_key=v_module_key and version=v_instance.definition_version),'new'))
      returning * into v_entity;
    v_record_id := v_entity.id;
    insert into events.ops_custom_records
      (project_id,event_id,entity_id,module_key,definition_version,field_values)
      values (p_project_id,p_event_id,v_record_id,v_module_key,v_instance.definition_version,
        p_command->'values');
  else
    select * into v_entity from events.ops_entities
      where project_id=p_project_id and event_id=p_event_id and id=v_record_id
        and module_key=v_module_key and archived_at is null for update;
    if not found then raise exception 'Record not found' using errcode='23503'; end if;
    if v_entity.revision <> v_expected then
      raise exception 'Record revision changed' using errcode='40001';
    end if;
    if v_action = 'update' then
      if v_title is null or length(v_title)>200 or
        jsonb_typeof(p_command->'values') is distinct from 'object' or
        jsonb_typeof(p_command->'references') is distinct from 'array' then
        raise exception 'Invalid record update' using errcode='22023';
      end if;
      update events.ops_entities set title=v_title,revision=revision+1,updated_at=now()
        where id=v_record_id returning * into v_entity;
      update events.ops_custom_records set field_values=p_command->'values'
        where project_id=p_project_id and event_id=p_event_id and entity_id=v_record_id;
      delete from events.ops_entity_links where project_id=p_project_id and event_id=p_event_id
        and source_entity_id=v_record_id;
    elsif v_action = 'transition' then
      if not exists (select 1 from events.ops_module_versions versions
        cross join lateral jsonb_array_elements(versions.definition->'transitions') transition
        where versions.project_id=p_project_id and versions.event_id=p_event_id
          and versions.module_key=v_module_key and versions.version=v_instance.definition_version
          and transition->>'from'=v_entity.state
          and transition->>'to'=p_command->>'nextState') then
        raise exception 'Unsupported state transition' using errcode='22023';
      end if;
      update events.ops_entities set state=p_command->>'nextState',revision=revision+1,updated_at=now()
        where id=v_record_id returning * into v_entity;
    else
      update events.ops_entities set archived_at=now(),revision=revision+1,updated_at=now()
        where id=v_record_id returning * into v_entity;
    end if;
  end if;
  if v_action in ('create','update') then
    for v_ref in select value from jsonb_array_elements(p_command->'references') loop
      insert into events.ops_entity_links
        (project_id,event_id,source_entity_id,target_entity_id,field_id)
        values (p_project_id,p_event_id,v_record_id,(v_ref->>'targetId')::uuid,
          v_ref->>'fieldId');
    end loop;
  end if;
  v_response := events.ops_record_response(p_project_id,p_event_id,v_record_id);
  insert into events.ops_audit
    (project_id,event_id,actor_id,command_id,action,entity_id,changes)
    values (p_project_id,p_event_id,p_actor_id,v_command_id,v_action,v_record_id,
      jsonb_build_object('revision',v_entity.revision,'moduleKey',v_module_key));
  insert into events.ops_command_receipts
    (project_id,event_id,actor_id,command_id,request_hash,response)
    values (p_project_id,p_event_id,p_actor_id,v_command_id,v_hash,v_response);
  return v_response;
end;
$$;

revoke all on function events.ops_require_event(uuid,uuid),
  events.ops_save_workspace_draft(uuid,uuid,uuid,bigint,jsonb),
  events.ops_publish_workspace(uuid,uuid,uuid,bigint,jsonb,uuid,text),
  events.ops_record_response(uuid,uuid,uuid),
  events.ops_mutate_record(uuid,uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function events.ops_save_workspace_draft(uuid,uuid,uuid,bigint,jsonb),
  events.ops_publish_workspace(uuid,uuid,uuid,bigint,jsonb,uuid,text),
  events.ops_mutate_record(uuid,uuid,uuid,jsonb) to service_role;


