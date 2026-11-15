-- Operations completion: closing, automatic actions, room chairs, minimum evaluations, presenter comments,
-- attendance corrections, revocable personal access links, presenter files, workspace templates and a public programme.
-- Forward-only: replaces events.ops_workflow_command, ops_workflow_write_native and ops_workflow_snapshot.
-- @up

alter table events.ops_workflow_state add column if not exists closed_at timestamptz;
alter table events.ops_workflow_state add column if not exists automation jsonb not null
  default '{"notifyOnPublish":true,"remindOverdue":false,"absentTask":true}'::jsonb;

alter table events.ops_resources add column if not exists chair_person_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ops_resources_chair_fk') then
    alter table events.ops_resources add constraint ops_resources_chair_fk
      foreign key (project_id, event_id, chair_person_id) references events.ops_people(project_id, event_id, id);
  end if;
end $$;

alter table events.ops_cycles add column if not exists min_evaluations integer not null default 1;
alter table events.ops_cycles drop constraint if exists ops_cycles_min_evaluations_check;
alter table events.ops_cycles add constraint ops_cycles_min_evaluations_check check (min_evaluations between 1 and 50);

alter table events.ops_evaluations add column if not exists comment text not null default '';
alter table events.ops_evaluations drop constraint if exists ops_evaluations_comment_check;
alter table events.ops_evaluations add constraint ops_evaluations_comment_check check (length(comment) <= 10000);

-- "unknown" returns a mark to not-marked while keeping its correction history.
alter table events.ops_attendance drop constraint if exists ops_attendance_status_check;
alter table events.ops_attendance add constraint ops_attendance_status_check check (status in ('present','absent','excused','unknown'));
alter table events.ops_attendance_revisions add column if not exists reason text not null default '';

-- Staff-revoked access blocks self-service links until the person is invited again.
alter table events.ops_people add column if not exists access_revoked_at timestamptz;

create table if not exists events.ops_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null, event_id uuid not null, person_id uuid not null, activity_id uuid,
  path text not null unique, name text not null check (length(trim(name)) between 1 and 255),
  size bigint not null check (size between 1 and 52428800), mime text not null default 'application/octet-stream',
  uploaded_by_kind text not null check (uploaded_by_kind in ('staff','portal')),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  foreign key (project_id, event_id, person_id) references events.ops_people(project_id, event_id, id),
  foreign key (project_id, event_id, activity_id) references events.ops_activities(project_id, event_id, id)
);
create index if not exists ops_files_event on events.ops_files(project_id, event_id) where deleted_at is null;

create table if not exists events.ops_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  modules jsonb not null check (jsonb_typeof(modules) = 'array'),
  created_by uuid, created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists ops_templates_project on events.ops_templates(project_id) where deleted_at is null;

do $$ declare t text; begin
  foreach t in array array['ops_files','ops_templates'] loop
    execute format('alter table events.%I enable row level security', t);
    execute format('revoke all on events.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on events.%I to service_role', t);
  end loop;
end $$;

-- Private presenter materials; only the server (service role) reads or writes.
insert into storage.buckets (id, name, public, file_size_limit)
values ('operations', 'operations', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------- native writes
create or replace function events.ops_workflow_write_native(p_project uuid,p_event uuid,p_command jsonb,p_validate boolean default true) returns jsonb language plpgsql set search_path='' as $$
declare a text:=p_command->>'action';i uuid:=coalesce((p_command->>'id')::uuid,gen_random_uuid());m text;
  title text;ver integer;result jsonb;key text;begin
  m:=case a when 'savePerson' then 'ops-people' when 'saveResource' then 'ops-resources' when 'saveActivity' then 'ops-activities' end;
  if m is null then raise exception 'Invalid native action' using errcode='22023'; end if;
  foreach key in array array['startsAt','endsAt','availableFrom','availableUntil'] loop
    if p_command->>key is not null and (jsonb_typeof(p_command->key)<>'string' or p_command->>key !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then
      raise exception 'Timestamp must include UTC or numeric offset' using errcode='22023'; end if;
  end loop;
  foreach key in array case when a='savePerson' then array['name','email'] when a='saveResource' then array['name','kind'] else array['title','kind','timezone'] end loop
    if jsonb_typeof(p_command->key) is distinct from 'string' then raise exception 'String input required' using errcode='22023'; end if;
  end loop;
  title:=trim(case when a='saveActivity' then p_command->>'title' else p_command->>'name' end);
  if title is null or length(title) not between 1 and 200 then raise exception 'Invalid name/title' using errcode='22023'; end if;
  select definition_version into ver from events.ops_module_instances where project_id=p_project and event_id=p_event and module_key=m and enabled;
  if ver is null then raise exception 'Enabled module required' using errcode='23503'; end if;
  if exists(select 1 from events.ops_entities where id=i and (project_id<>p_project or event_id<>p_event or module_key<>m or archived_at is not null)) then
    raise exception 'Native identity scope mismatch' using errcode='23503'; end if;
  insert into events.ops_entities(id,project_id,event_id,module_key,definition_version,title,state) values(i,p_project,p_event,m,ver,title,
    coalesce((select definition->'states'->0->>'key' from events.ops_module_versions where project_id=p_project and event_id=p_event and module_key=m and version=ver),'active'))
    on conflict(id) do update set title=excluded.title,revision=events.ops_entities.revision+1,updated_at=now();
  if a='savePerson' then
    if p_command->>'email' is null or jsonb_typeof(coalesce(p_command->'roles','[]'))<>'array' then raise exception 'Invalid person' using errcode='22023'; end if;
    if p_command->>'contactId' is not null and not exists(select 1 from events.contacts where project_id=p_project and id=(p_command->>'contactId')::uuid and deleted_at is null) then
      raise exception 'Unknown project contact' using errcode='23503'; end if;
    insert into events.ops_people(id,project_id,event_id,definition_version,name,email,contact_id,roles)
      values(i,p_project,p_event,ver,title,lower(trim(p_command->>'email')),(p_command->>'contactId')::uuid,array(select jsonb_array_elements_text(coalesce(p_command->'roles','[]'))))
      on conflict(id) do update set name=excluded.name,email=excluded.email,contact_id=excluded.contact_id,roles=excluded.roles;
    select events.ops_workflow_dto(to_jsonb(x)) into result from (select p.*,e.revision from events.ops_people p join events.ops_entities e on e.id=p.id where p.id=i) x;
  elsif a='saveResource' then
    if p_command ? 'chairPersonId' and p_command->>'chairPersonId' is not null and not exists(select 1 from events.ops_people where project_id=p_project and event_id=p_event and id=(p_command->>'chairPersonId')::uuid) then
      raise exception 'Room chair must be a person in this event' using errcode='23503'; end if;
    insert into events.ops_resources(id,project_id,event_id,definition_version,name,kind,capacity,location,available_from,available_until,chair_person_id)
      values(i,p_project,p_event,ver,title,p_command->>'kind',(p_command->>'capacity')::integer,coalesce(p_command->>'location',''),(p_command->>'availableFrom')::timestamptz,(p_command->>'availableUntil')::timestamptz,(p_command->>'chairPersonId')::uuid)
      on conflict(id) do update set name=excluded.name,kind=excluded.kind,capacity=excluded.capacity,location=excluded.location,available_from=excluded.available_from,available_until=excluded.available_until,
        chair_person_id=case when p_command ? 'chairPersonId' then excluded.chair_person_id else events.ops_resources.chair_person_id end;
    if p_validate then perform events.ops_workflow_validate_schedule(p_project,p_event); end if;
    select events.ops_workflow_dto(to_jsonb(x)) into result from (select p.*,e.revision from events.ops_resources p join events.ops_entities e on e.id=p.id where p.id=i) x;
  else
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_command->>'timezone') then raise exception 'Invalid activity timezone' using errcode='22023'; end if;
    insert into events.ops_activities(id,project_id,event_id,definition_version,title,kind,resource_id,parent_id,starts_at,ends_at,timezone,capacity)
      values(i,p_project,p_event,ver,title,p_command->>'kind',(p_command->>'resourceId')::uuid,(p_command->>'parentId')::uuid,(p_command->>'startsAt')::timestamptz,(p_command->>'endsAt')::timestamptz,p_command->>'timezone',(p_command->>'capacity')::integer)
      on conflict(id) do update set title=excluded.title,kind=excluded.kind,resource_id=excluded.resource_id,parent_id=excluded.parent_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,capacity=excluded.capacity;
    if p_validate then perform events.ops_workflow_validate_schedule(p_project,p_event); end if;
    select events.ops_workflow_dto(to_jsonb(x)) into result from (select p.*,e.revision from events.ops_activities p join events.ops_entities e on e.id=p.id where p.id=i) x;
  end if;
  return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then
  raise exception 'Invalid native input' using errcode='22023';
end $$;

-- True when the person chairs the room an activity effectively sits in.
create or replace function events.ops_workflow_chairs(p_project uuid,p_event uuid,p_person uuid,p_activity uuid) returns boolean language sql stable set search_path='' as $$
  select p_person is not null and exists(select 1 from events.ops_resources r
    where r.project_id=p_project and r.event_id=p_event and r.id=events.ops_workflow_resource(p_project,p_event,p_activity) and r.chair_person_id=p_person)
$$;

-- Sessions excluded from results because every assigned presenter was absent or excused.
create or replace function events.ops_workflow_not_delivered(p_project uuid,p_event uuid,p_activity uuid) returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from events.ops_assignments x where x.project_id=p_project and x.event_id=p_event and x.activity_id=p_activity and x.role='presenter' and x.status='active')
    and not exists(select 1 from events.ops_assignments x where x.project_id=p_project and x.event_id=p_event and x.activity_id=p_activity and x.role='presenter' and x.status='active'
      and not exists(select 1 from events.ops_attendance t where t.project_id=p_project and t.event_id=p_event and t.activity_id=p_activity and t.person_id=x.person_id
        and t.purpose='delivery' and t.status in('absent','excused')))
$$;

-- ---------------------------------------------------------------- command
create or replace function events.ops_workflow_command(p_project_id uuid,p_event_id uuid,p_actor_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare
  a text:=p_command->>'action';v_principal_kind text:=p_command->>'principalKind';cid uuid;
  hash text:=p_command->>'requestHash';expected bigint;rev bigint;v_closed timestamptz;v_automation jsonb;
  receipt events.ops_command_receipts%rowtype;v_replay boolean:=false;result jsonb;response jsonb;row_json jsonb;
  i uuid;person uuid;activity uuid;cycle uuid;rel uuid;inv uuid;
  asn events.ops_assignments%rowtype;ev events.ops_evaluations%rowtype;cy events.ops_cycles%rowtype;invite_row events.ops_invitations%rowtype;att events.ops_attendance%rowtype;
  source_row events.conference_records%rowtype;binding events.ops_legacy_imports%rowtype;v_source_id uuid;source_config jsonb;
  criterion jsonb;score numeric;item jsonb;items jsonb:='[]';v_pending jsonb;v_index integer;version integer;permission text;allowed text[];keys text[];n integer;
  payload_keys jsonb:='{"enableWorkflow":[],"savePerson":["id","name","email","contactId","roles"],"saveResource":["id","name","kind","capacity","location","availableFrom","availableUntil","chairPersonId"],"saveActivity":["id","title","kind","resourceId","parentId","startsAt","endsAt","timezone","capacity"],"saveAssignment":["id","activityId","personId","role","cycleId","status","dueAt"],"publishProgramme":[],"acknowledgePlacement":["releaseId","activityId"],"invite":["personId","expiresInDays","tokenHash"],"revokeInvitation":["invitationId"],"revokeAccess":["personId"],"acceptInvitation":["tokenHash","principalEmail"],"linkStaff":["personId","userId"],"saveCycle":["id","title","rubric","state","dueAt","minEvaluations"],"releaseResults":["cycleId"],"reopenEvaluation":["evaluationId","reason"],"saveEvaluation":["assignmentId","scores","notes","comment","submit"],"markAttendance":["activityId","personId","purpose","status","notes","reason"],"clearAttendance":["activityId","personId","purpose","reason"],"saveTask":["id","title","personId","activityId","dueAt","status"],"completeTask":["taskId"],"deleteTask":["taskId"],"importPeople":["items"],"importActivities":["items"],"importAcceptedItems":["itemIds"],"approveFeedback":["evaluationId","feedback"],"retryNotice":["noticeId"],"queueReminders":[],"closeOperations":[],"reopenOperations":[],"saveAutomation":["notifyOnPublish","remindOverdue","absentTask"],"removeItem":["id"]}';
begin
  if jsonb_typeof(p_command) is distinct from 'object' then raise exception 'Command object required' using errcode='22023'; end if;
  cid:=(p_command->>'commandId')::uuid;expected:=(p_command->>'expectedRevision')::bigint;i:=coalesce((p_command->>'id')::uuid,gen_random_uuid());
  if jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' or jsonb_typeof(p_command->'requestHash') is distinct from 'string' then raise exception 'Invalid command metadata' using errcode='22023'; end if;
  if p_command ? 'submit' and jsonb_typeof(p_command->'submit') is distinct from 'boolean' then raise exception 'Submit must be boolean' using errcode='22023'; end if;
  if p_actor_id is null or cid is null or hash is null or length(hash) not between 1 and 200 or expected is null or expected<0
    or v_principal_kind is null or v_principal_kind not in('staff','portal') or a is null or not payload_keys ? a then
    raise exception 'Invalid workflow command' using errcode='22023'; end if;
  allowed:=array['action','expectedRevision','commandId','requestHash','principalKind']||array(select jsonb_array_elements_text(payload_keys->a));
  if exists(select 1 from jsonb_object_keys(p_command) k where not k=any(allowed)) then raise exception 'Unknown workflow command key' using errcode='22023'; end if;
  for item in select to_jsonb(k) from unnest(array['dueAt','startsAt','endsAt','availableFrom','availableUntil']) k loop
    if p_command->>(item#>>'{}') is not null and (jsonb_typeof(p_command->(item#>>'{}'))<>'string' or p_command->>(item#>>'{}') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then
      raise exception 'Timestamp must include UTC or numeric offset' using errcode='22023'; end if;
  end loop;
  foreach permission in array array['title','notes','comment','reason','role','status','location','principalEmail','tokenHash','feedback'] loop
    if p_command ? permission and jsonb_typeof(p_command->permission) is distinct from 'string' then raise exception 'String input required' using errcode='22023'; end if;
  end loop;
  perform events.ops_require_event(p_project_id,p_event_id);
  select * into receipt from events.ops_command_receipts where project_id=p_project_id and event_id=p_event_id and actor_id=p_actor_id and command_id=cid;
  if found then
    if receipt.request_hash<>hash then raise exception 'Command ID reused with different input' using errcode='23505'; end if;
    v_replay:=true;
  end if;
  if not events.ops_workflow_enabled(p_project_id,p_event_id) then raise exception 'Enabled operations workflow required' using errcode='23503'; end if;
  insert into events.ops_workflow_state(project_id,event_id) values(p_project_id,p_event_id) on conflict do nothing;
  select s.revision,s.closed_at,s.automation into rev,v_closed,v_automation from events.ops_workflow_state s where project_id=p_project_id and event_id=p_event_id for update;
  if v_principal_kind='staff' then
    perform 1 from public.projects p where p.id=p_project_id for share;
    perform 1 from public.organization_users m join public.projects p on p.organization_id=m.organization
      where p.id=p_project_id and m."user"=p_actor_id for share of m;
    perform 1 from events.role_grants g join public.roles r on r.id=g.role_id
      where g.project_id=p_project_id and g.user_id=p_actor_id and r.project_id=p_project_id for share of g,r;
    permission:=case when a in('enableWorkflow','publishProgramme','invite','revokeInvitation','revokeAccess','linkStaff','saveCycle','releaseResults','reopenEvaluation','retryNotice','queueReminders','importAcceptedItems','approveFeedback','closeOperations','reopenOperations','saveAutomation','deleteTask','removeItem') then 'events.operations.configure'
      when a in('importPeople','importActivities') and exists(select 1 from jsonb_array_elements(p_command->'items') x where x->>'id' is not null) then 'events.operations.record_update'
      when p_command ? 'id' or a in('saveEvaluation','markAttendance','clearAttendance','completeTask','acknowledgePlacement') then 'events.operations.record_update' else 'events.operations.record_create' end;
    if not events.ops_workflow_staff(p_project_id,p_event_id,p_actor_id,permission) then raise exception 'Workflow permission denied' using errcode='42501'; end if;
    if a in('importPeople','importActivities') and exists(select 1 from jsonb_array_elements(p_command->'items') x where x->>'id' is not null)
      and not events.ops_workflow_staff(p_project_id,p_event_id,p_actor_id,'events.operations.record_update') then
      raise exception 'Import identity requires update permission' using errcode='42501'; end if;
    if a in('importPeople','importActivities') and exists(select 1 from jsonb_array_elements(p_command->'items') x where x->>'id' is null or not exists(
      select 1 from events.ops_entities entity where entity.project_id=p_project_id and entity.event_id=p_event_id and entity.id=(x->>'id')::uuid
        and entity.module_key=case a when 'importPeople' then 'ops-people' else 'ops-activities' end))
      and not events.ops_workflow_staff(p_project_id,p_event_id,p_actor_id,'events.operations.record_create') then
      raise exception 'Import creation requires create permission' using errcode='42501'; end if;
    if p_command ? 'id' and (
      (a in('savePerson','saveResource','saveActivity') and not exists(select 1 from events.ops_entities entity where entity.project_id=p_project_id and entity.event_id=p_event_id and entity.id=i
        and entity.module_key=case a when 'savePerson' then 'ops-people' when 'saveResource' then 'ops-resources' else 'ops-activities' end))
      or (a='saveAssignment' and not exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id and x.id=i))
      or (a='saveTask' and not exists(select 1 from events.ops_tasks x where x.project_id=p_project_id and x.event_id=p_event_id and x.id=i)))
      and not events.ops_workflow_staff(p_project_id,p_event_id,p_actor_id,'events.operations.record_create') then
      raise exception 'New identity requires create permission' using errcode='42501'; end if;
    if a='acceptInvitation' then raise exception 'Portal principal required' using errcode='42501'; end if;
  else
    if a not in('acceptInvitation','acknowledgePlacement','saveEvaluation','markAttendance','clearAttendance','completeTask') then raise exception 'Portal action denied' using errcode='42501'; end if;
    select l.person_id into person from events.ops_identity_links l
      where l.project_id=p_project_id and l.event_id=p_event_id and l.kind='portal' and l.principal_id=p_actor_id
        and exists(select 1 from events.ops_invitations x where x.id=l.invitation_id and x.accepted_at is not null and x.revoked_at is null);
    if a<>'acceptInvitation' and person is null then raise exception 'Live operations identity required' using errcode='42501'; end if;
    if v_replay then
      if a='acceptInvitation' and not exists(select 1 from events.ops_invitations x join events.portal_members m on m.id=x.accepted_principal_id
        where x.project_id=p_project_id and x.event_id=p_event_id and x.token_hash=p_command->>'tokenHash'
          and x.accepted_principal_id=p_actor_id and x.accepted_at is not null and x.revoked_at is null
          and lower(x.email)=lower(p_command->>'principalEmail') and lower(m.email)=lower(x.email)) then
        raise exception 'Accepted invitation access revoked' using errcode='42501'; end if;
      if a='saveEvaluation' and not exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.id=(p_command->>'assignmentId')::uuid and x.person_id=person and x.role='evaluator' and x.status='active') then
        raise exception 'Live evaluator allocation required for replay' using errcode='42501'; end if;
      if a='acknowledgePlacement' and not exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.activity_id=(p_command->>'activityId')::uuid and x.person_id=person and x.role in('presenter','participant') and x.status='active') then
        raise exception 'Live placement required for replay' using errcode='42501'; end if;
      if a in('markAttendance','clearAttendance') and not exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.activity_id=(p_command->>'activityId')::uuid and x.person_id=person and x.role='staff' and x.status='active')
        and not events.ops_workflow_chairs(p_project_id,p_event_id,person,(p_command->>'activityId')::uuid) then
        raise exception 'Live staff allocation required for replay' using errcode='42501'; end if;
      if a='completeTask' and not exists(select 1 from events.ops_tasks x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.id=(p_command->>'taskId')::uuid and x.person_id=person) then raise exception 'Own task required for replay' using errcode='42501'; end if;
    end if;
  end if;
  if v_replay then return receipt.response||jsonb_build_object('replayed',true); end if;
  if rev<>expected then raise exception 'Workflow revision changed' using errcode='40001'; end if;
  if v_closed is not null and a<>'reopenOperations' then raise exception 'Operations are closed' using errcode='P7004'; end if;

  if a='enableWorkflow' then result:=jsonb_build_object('enabled',true);
  elsif a='closeOperations' then
    update events.ops_workflow_state set closed_at=now() where project_id=p_project_id and event_id=p_event_id;
    result:=jsonb_build_object('closedAt',now());
  elsif a='reopenOperations' then
    if v_closed is null then raise exception 'Operations are already open' using errcode='22023'; end if;
    update events.ops_workflow_state set closed_at=null where project_id=p_project_id and event_id=p_event_id;
    result:=jsonb_build_object('closedAt',null);
  elsif a='saveAutomation' then
    foreach permission in array array['notifyOnPublish','remindOverdue','absentTask'] loop
      if p_command ? permission and jsonb_typeof(p_command->permission) is distinct from 'boolean' then raise exception 'Automation switches must be true or false' using errcode='22023'; end if;
    end loop;
    v_automation:=v_automation||(p_command-array['action','expectedRevision','commandId','requestHash','principalKind']);
    update events.ops_workflow_state set automation=v_automation where project_id=p_project_id and event_id=p_event_id;
    result:=v_automation;
  elsif a in('savePerson','saveResource','saveActivity') then result:=events.ops_workflow_write_native(p_project_id,p_event_id,p_command);
  elsif a='removeItem' then
    -- Archives a person, room or session; history stays, but it stops taking part in schedules and access.
    select e.module_key into permission from events.ops_entities e where e.project_id=p_project_id and e.event_id=p_event_id and e.id=i and e.archived_at is null
      and e.module_key in('ops-people','ops-resources','ops-activities') for update;
    if permission is null then raise exception 'Unknown item' using errcode='23503'; end if;
    update events.ops_entities set archived_at=now(),revision=revision+1,updated_at=now() where id=i;
    if permission='ops-activities' then
      update events.ops_assignments set status='revoked' where project_id=p_project_id and event_id=p_event_id and activity_id=i and status='active';
      update events.ops_activities set parent_id=null where project_id=p_project_id and event_id=p_event_id and parent_id=i;
      update events.ops_activities set starts_at=null,ends_at=null,resource_id=null,parent_id=null where id=i;
    elsif permission='ops-resources' then
      update events.ops_activities set resource_id=null where project_id=p_project_id and event_id=p_event_id and resource_id=i;
    else
      update events.ops_assignments set status='revoked' where project_id=p_project_id and event_id=p_event_id and person_id=i and status='active';
      update events.ops_resources set chair_person_id=null where project_id=p_project_id and event_id=p_event_id and chair_person_id=i;
      update events.ops_invitations set revoked_at=now() where project_id=p_project_id and event_id=p_event_id and person_id=i and revoked_at is null;
      update events.ops_people set access_revoked_at=now() where id=i;
    end if;
    result:=jsonb_build_object('id',i,'kind',permission);
  elsif a='importAcceptedItems' then
    if jsonb_typeof(p_command->'itemIds') is distinct from 'array' or jsonb_array_length(p_command->'itemIds') not between 1 and 100 then raise exception 'Import requires 1 to 100 source identities' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_command->'itemIds') x where jsonb_typeof(x)<>'string') then raise exception 'Source identities must be UUID strings' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_command->'itemIds') x group by x having count(*)>1) then raise exception 'Duplicate source identity' using errcode='23505'; end if;
    for v_source_id in select value::uuid from jsonb_array_elements_text(p_command->'itemIds') order by value loop
      select * into source_row from events.conference_records where id=v_source_id and project_id=p_project_id and module='paper' and status='Accepted' and deleted_at is null for update;
      if not found then raise exception 'Accepted project source required' using errcode='23503'; end if;
      source_config:=coalesce(source_row.config,'{}');
      if (source_config->>'eventId' is not null and source_config->>'eventId'<>p_event_id::text)
        or (source_config->>'event_id' is not null and source_config->>'event_id'<>p_event_id::text) then raise exception 'Source event mismatch' using errcode='23503'; end if;
      select * into binding from events.ops_legacy_imports where project_id=p_project_id and source_id=source_row.id;
      if found then
        if binding.event_id<>p_event_id then raise exception 'Source already bound to another event' using errcode='23503'; end if;
      else
        row_json:=events.ops_workflow_write_native(p_project_id,p_event_id,jsonb_build_object('action','saveActivity','title',source_row.name,'kind',coalesce(nullif(lower(trim(source_config->>'format')),''),'talk'),'timezone',
          coalesce((select e.timezone from events.events e where e.id=p_event_id and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=e.timezone)),'UTC')));
        activity:=(row_json->>'id')::uuid;person:=null;inv:=null;
        if nullif(trim(source_config->>'authorName'),'') is not null then
          row_json:=events.ops_workflow_write_native(p_project_id,p_event_id,jsonb_build_object('action','savePerson','name',source_config->>'authorName','email',coalesce(source_config->>'email',''),'roles',jsonb_build_array('presenter')));
          person:=(row_json->>'id')::uuid;
          insert into events.ops_assignments(project_id,event_id,activity_id,person_id,role) values(p_project_id,p_event_id,activity,person,'presenter') returning id into inv;
        end if;
        insert into events.ops_legacy_imports(project_id,event_id,source_id,activity_id,person_id,assignment_id) values(p_project_id,p_event_id,v_source_id,activity,person,inv) returning * into binding;
      end if;
      items:=items||jsonb_build_array(jsonb_build_object('sourceId',binding.source_id,'activityId',binding.activity_id,'personId',binding.person_id,'assignmentId',binding.assignment_id));
    end loop;
    result:=jsonb_build_object('items',items,'count',jsonb_array_length(items));
  elsif a in('importPeople','importActivities') then
    if jsonb_typeof(p_command->'items') is distinct from 'array' or jsonb_array_length(p_command->'items') not between 1 and 100 then raise exception 'Import requires 1 to 100 entries' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_command->'items') x where jsonb_typeof(x)<>'object') then raise exception 'Invalid import item' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_command->'items') x where x ? 'id' group by x->>'id' having count(*)>1) then raise exception 'Duplicate import identity' using errcode='23505'; end if;
    v_pending:=p_command->'items';
    while jsonb_array_length(v_pending)>0 loop
      select entry.value,(entry.ordinality-1)::integer into item,v_index from jsonb_array_elements(v_pending) with ordinality entry
        where a='importPeople' or entry.value->>'parentId' is null
          or not exists(select 1 from jsonb_array_elements(v_pending) parent where parent->>'id'=entry.value->>'parentId')
        order by entry.ordinality limit 1;
      if item is null then raise exception 'Import parent cycle' using errcode='22023'; end if;
      allowed:=array(select jsonb_array_elements_text(payload_keys->case a when 'importPeople' then 'savePerson' else 'saveActivity' end));
      if exists(select 1 from jsonb_object_keys(item) k where not k=any(allowed)) then raise exception 'Invalid import key' using errcode='22023'; end if;
      items:=items||jsonb_build_array(events.ops_workflow_write_native(p_project_id,p_event_id,item||jsonb_build_object('action',case a when 'importPeople' then 'savePerson' else 'saveActivity' end),false));
      v_pending:=v_pending-v_index;
    end loop;
    if a='importActivities' then perform events.ops_workflow_validate_schedule(p_project_id,p_event_id); end if;
    result:=jsonb_build_object('items',items,'count',jsonb_array_length(items));
  elsif a='saveAssignment' then
    cycle:=(p_command->>'cycleId')::uuid;
    if p_command->>'role'='evaluator' and (cycle is null or not exists(select 1 from events.ops_cycles where id=cycle and project_id=p_project_id and event_id=p_event_id and (p_command->>'status'='revoked' or state in('draft','open')))) then
      raise exception 'Draft/open event cycle required' using errcode='23503'; end if;
    if p_command->>'role'<>'evaluator' and cycle is not null then raise exception 'Cycle applies to evaluators only' using errcode='22023'; end if;
    if exists(select 1 from events.ops_assignments where id=i and (project_id<>p_project_id or event_id<>p_event_id)) then raise exception 'Assignment scope mismatch' using errcode='23503'; end if;
    if exists(select 1 from events.ops_evaluations where assignment_id=i) and exists(select 1 from events.ops_assignments where id=i and
      (activity_id is distinct from (p_command->>'activityId')::uuid or person_id is distinct from (p_command->>'personId')::uuid or cycle_id is distinct from cycle or role is distinct from p_command->>'role')) then
      raise exception 'Evaluated assignment identity is immutable' using errcode='22023'; end if;
    insert into events.ops_assignments(id,project_id,event_id,activity_id,person_id,role,cycle_id,status,due_at)
      values(i,p_project_id,p_event_id,(p_command->>'activityId')::uuid,(p_command->>'personId')::uuid,p_command->>'role',cycle,coalesce(p_command->>'status','active'),(p_command->>'dueAt')::timestamptz)
      on conflict(id) do update set activity_id=excluded.activity_id,person_id=excluded.person_id,role=excluded.role,cycle_id=excluded.cycle_id,status=excluded.status,due_at=excluded.due_at returning to_jsonb(events.ops_assignments.*) into row_json;
    perform events.ops_workflow_validate_schedule(p_project_id,p_event_id);result:=events.ops_workflow_dto(row_json);
  elsif a='publishProgramme' then
    perform events.ops_workflow_validate_schedule(p_project_id,p_event_id);
    select coalesce(max(r.version),0)+1 into version from events.ops_releases r where project_id=p_project_id and event_id=p_event_id;
    select coalesce(jsonb_agg(jsonb_build_object('id',ac.id,'activityId',ac.id,'title',ac.title,'kind',ac.kind,
      'resourceId',events.ops_workflow_resource(p_project_id,p_event_id,ac.id),'resourceName',r.name,'parentId',ac.parent_id,
      'startsAt',ac.starts_at,'endsAt',ac.ends_at,'timezone',ac.timezone,'capacity',ac.capacity,'revision',e.revision,
      'assignments',coalesce((select jsonb_agg(events.ops_workflow_dto(to_jsonb(x))) from events.ops_assignments x where x.activity_id=ac.id and x.status='active'),'[]')) order by ac.starts_at,ac.id),'[]') into items
      from events.ops_activities ac join events.ops_entities e on e.id=ac.id left join events.ops_resources r on r.id=events.ops_workflow_resource(p_project_id,p_event_id,ac.id)
      where ac.project_id=p_project_id and ac.event_id=p_event_id and ac.starts_at is not null and e.archived_at is null;
    insert into events.ops_releases(project_id,event_id,version,items) values(p_project_id,p_event_id,version,items) returning id,to_jsonb(events.ops_releases.*) into rel,row_json;
    result:=events.ops_workflow_dto(row_json);
    update events.ops_notices set status='superseded',lease_id=null,lease_expires_at=null where project_id=p_project_id and event_id=p_event_id and kind='placement' and status='queued';
    if coalesce((v_automation->>'notifyOnPublish')::boolean,true) then
      insert into events.ops_notices(project_id,event_id,kind,person_id,release_id,dedupe_key,payload)
        select distinct p_project_id,p_event_id,'placement',x.person_id,rel,'placement:'||rel||':'||x.person_id,
          jsonb_build_object('version',version,'releaseId',rel,'items',(select coalesce(jsonb_agg(placement||jsonb_build_object('assignments',(select coalesce(jsonb_agg(own_assignment),'[]') from jsonb_array_elements(placement->'assignments') own_assignment where (own_assignment->>'personId')::uuid=x.person_id))),'[]') from jsonb_array_elements(items) placement where exists(select 1 from events.ops_assignments y where y.activity_id=(placement->>'activityId')::uuid and y.person_id=x.person_id and y.status='active')))
        from events.ops_assignments x join events.ops_activities ac on ac.id=x.activity_id join events.ops_people pp on pp.id=x.person_id
        where x.project_id=p_project_id and x.event_id=p_event_id and x.status='active' and ac.starts_at is not null and pp.email<>'';
    end if;
  elsif a='acknowledgePlacement' then
    rel:=(p_command->>'releaseId')::uuid;activity:=(p_command->>'activityId')::uuid;
    if v_principal_kind<>'portal' then raise exception 'Own portal placement required' using errcode='42501'; end if;
    if rel is distinct from (select r.id from events.ops_releases r where r.project_id=p_project_id and r.event_id=p_event_id order by r.version desc limit 1) then raise exception 'Programme release changed' using errcode='40001'; end if;
    if not exists(select 1 from events.ops_assignments where project_id=p_project_id and event_id=p_event_id and activity_id=activity and person_id=person and status='active' and role in('presenter','participant')) then raise exception 'Own live placement required' using errcode='42501'; end if;
    select (x->>'revision')::bigint into n from events.ops_releases r cross join lateral jsonb_array_elements(r.items) x where r.id=rel and (x->>'activityId')::uuid=activity;
    if n is null then raise exception 'Activity absent from release' using errcode='23503'; end if;
    insert into events.ops_acknowledgements(project_id,event_id,release_id,activity_id,person_id,released_revision) values(p_project_id,p_event_id,rel,activity,person,n)
      on conflict(project_id,event_id,release_id,activity_id,person_id) do nothing;
    select events.ops_workflow_dto(to_jsonb(x)) into result from events.ops_acknowledgements x where project_id=p_project_id and event_id=p_event_id and release_id=rel and activity_id=activity and person_id=person;
  elsif a='invite' then
    person:=(p_command->>'personId')::uuid;
    if coalesce((p_command->>'expiresInDays')::integer,14) not between 1 and 14 then raise exception 'Invalid invitation expiry' using errcode='22023'; end if;
    if not exists(select 1 from events.ops_people where project_id=p_project_id and event_id=p_event_id and id=person and email<>'') then raise exception 'Person with email required' using errcode='23503'; end if;
    update events.ops_people set access_revoked_at=null where id=person;
    update events.ops_invitations set revoked_at=now() where project_id=p_project_id and event_id=p_event_id and person_id=person and accepted_at is null and revoked_at is null;
    insert into events.ops_invitations(project_id,event_id,person_id,email,token_hash,expires_at)
      select p_project_id,p_event_id,person,email,p_command->>'tokenHash',now()+make_interval(days=>coalesce((p_command->>'expiresInDays')::integer,14)) from events.ops_people where id=person returning to_jsonb(events.ops_invitations.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='revokeInvitation' then
    update events.ops_invitations set revoked_at=coalesce(revoked_at,now()) where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'invitationId')::uuid returning to_jsonb(events.ops_invitations.*) into row_json;
    if row_json is null then raise exception 'Unknown invitation' using errcode='23503'; end if;result:=events.ops_workflow_dto(row_json);
  elsif a='revokeAccess' then
    person:=(p_command->>'personId')::uuid;
    update events.ops_people set access_revoked_at=now() where project_id=p_project_id and event_id=p_event_id and id=person;
    if not found then raise exception 'Unknown person' using errcode='23503'; end if;
    update events.ops_invitations set revoked_at=now() where project_id=p_project_id and event_id=p_event_id and person_id=person and revoked_at is null;
    get diagnostics n=row_count;result:=jsonb_build_object('personId',person,'revoked',n);
  elsif a='acceptInvitation' then
    select * into invite_row from events.ops_invitations where project_id=p_project_id and event_id=p_event_id and token_hash=p_command->>'tokenHash' for update;
    if not found or invite_row.expires_at<=now() or invite_row.revoked_at is not null or invite_row.accepted_at is not null then raise exception 'Invitation expired, revoked or consumed' using errcode='P7003'; end if;
    if p_command->>'principalEmail' is null or lower(p_command->>'principalEmail')<>lower(invite_row.email) or not exists(select 1 from events.portal_members where id=p_actor_id and lower(email)=lower(invite_row.email)) then raise exception 'Invitation principal mismatch' using errcode='42501'; end if;
    if exists(select 1 from events.ops_identity_links where project_id=p_project_id and event_id=p_event_id and kind='portal' and principal_id=p_actor_id and person_id<>invite_row.person_id) then raise exception 'Identity already bound to another person' using errcode='23505'; end if;
    update events.ops_invitations set accepted_at=now(),accepted_principal_id=p_actor_id where id=invite_row.id;
    insert into events.ops_identity_links(project_id,event_id,person_id,kind,principal_id,invitation_id) values(p_project_id,p_event_id,invite_row.person_id,'portal',p_actor_id,invite_row.id)
      on conflict(project_id,event_id,kind,principal_id) do update set invitation_id=excluded.invitation_id returning to_jsonb(events.ops_identity_links.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='linkStaff' then
    perform 1 from public.organization_users m join public.projects p on p.organization_id=m.organization
      where p.id=p_project_id and m."user"=(p_command->>'userId')::uuid for share of m;
    if not events.ops_workflow_member(p_project_id,(p_command->>'userId')::uuid) then raise exception 'Actual project membership required' using errcode='23503'; end if;
    insert into events.ops_identity_links(project_id,event_id,person_id,kind,principal_id) values(p_project_id,p_event_id,(p_command->>'personId')::uuid,'staff',(p_command->>'userId')::uuid)
      on conflict(project_id,event_id,kind,principal_id) do update set person_id=excluded.person_id returning to_jsonb(events.ops_identity_links.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='saveCycle' then
    if jsonb_typeof(p_command->'rubric') is distinct from 'array' or jsonb_array_length(p_command->'rubric') not between 1 and 20 then raise exception 'Cycle needs 1 to 20 rubric criteria' using errcode='22023'; end if;
    if p_command ? 'minEvaluations' and (jsonb_typeof(p_command->'minEvaluations') is distinct from 'number' or (p_command->>'minEvaluations')::numeric not between 1 and 50 or (p_command->>'minEvaluations')::numeric<>trunc((p_command->>'minEvaluations')::numeric)) then
      raise exception 'Minimum evaluations must be 1 to 50' using errcode='22023'; end if;
    for criterion in select value from jsonb_array_elements(p_command->'rubric') loop
      if jsonb_typeof(criterion)<>'object' or jsonb_typeof(criterion->'id') is distinct from 'string' or jsonb_typeof(criterion->'label') is distinct from 'string'
        or nullif(trim(criterion->>'id'),'') is null or length(criterion->>'id')>100 or nullif(trim(criterion->>'label'),'') is null or length(criterion->>'label')>200
        or jsonb_typeof(criterion->'min') is distinct from 'number' or jsonb_typeof(criterion->'max') is distinct from 'number' or jsonb_typeof(criterion->'weight') is distinct from 'number'
        or (criterion->>'min')::numeric >= (criterion->>'max')::numeric or (criterion->>'weight')::numeric<=0 then raise exception 'Invalid rubric criterion' using errcode='22023'; end if;
      if exists(select 1 from jsonb_object_keys(criterion) k where not k=any(array['id','label','min','max','weight'])) then raise exception 'Unknown rubric criterion key' using errcode='22023'; end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(p_command->'rubric') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate rubric ID' using errcode='22023'; end if;
    select * into cy from events.ops_cycles where id=i;
    if found then
      if cy.project_id<>p_project_id or cy.event_id<>p_event_id then raise exception 'Cycle scope mismatch' using errcode='23503'; end if;
      if cy.state='released' then raise exception 'Released cycle is immutable' using errcode='22023'; end if;
      if cy.rubric is distinct from p_command->'rubric' and exists(select 1 from events.ops_evaluation_revisions r join events.ops_evaluations e on e.id=r.evaluation_id where e.cycle_id=i) then raise exception 'Submitted rubric is immutable; create another cycle' using errcode='22023'; end if;
    end if;
    if p_command->>'state'='released' then raise exception 'Use releaseResults' using errcode='22023'; end if;
    insert into events.ops_cycles(id,project_id,event_id,title,rubric,state,due_at,min_evaluations) values(i,p_project_id,p_event_id,p_command->>'title',p_command->'rubric',coalesce(p_command->>'state','draft'),(p_command->>'dueAt')::timestamptz,coalesce((p_command->>'minEvaluations')::integer,1))
      on conflict(id) do update set title=excluded.title,rubric=excluded.rubric,state=excluded.state,due_at=excluded.due_at,
        min_evaluations=case when p_command ? 'minEvaluations' then excluded.min_evaluations else events.ops_cycles.min_evaluations end,revision=events.ops_cycles.revision+1 returning to_jsonb(events.ops_cycles.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='releaseResults' then
    select * into cy from events.ops_cycles where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'cycleId')::uuid for update;
    if not found then raise exception 'Unknown cycle' using errcode='23503'; end if;
    if cy.state='released' then raise exception 'Results are already released' using errcode='22023'; end if;
    if exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id and x.cycle_id=cy.id and x.role='evaluator' and x.status='active'
      and not events.ops_workflow_not_delivered(p_project_id,p_event_id,x.activity_id)
      group by x.activity_id
      having (select count(*) from events.ops_evaluations e where e.cycle_id=cy.id and e.activity_id=x.activity_id and e.status='submitted')<cy.min_evaluations) then
      raise exception 'Some sessions have fewer submitted evaluations than the minimum' using errcode='P7005'; end if;
    update events.ops_cycles set state='released',revision=revision+1 where id=cy.id returning to_jsonb(events.ops_cycles.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='reopenEvaluation' then
    if nullif(trim(p_command->>'reason'),'') is null or length(p_command->>'reason')>2000 then raise exception 'Correction reason required' using errcode='22023'; end if;
    select * into ev from events.ops_evaluations where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'evaluationId')::uuid;
    if not found then raise exception 'Unknown evaluation' using errcode='23503'; end if;
    if ev.status<>'submitted' or not exists(select 1 from events.ops_cycles where id=ev.cycle_id and state='open') then raise exception 'Submitted evaluation in open cycle required' using errcode='22023'; end if;
    update events.ops_evaluations set status='draft',submitted_at=null,approved_feedback=null,feedback_approved_at=null,feedback_approved_by=null,revision=revision+1 where id=ev.id returning to_jsonb(events.ops_evaluations.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='approveFeedback' then
    if jsonb_typeof(p_command->'feedback') is distinct from 'string' or length(p_command->>'feedback')>10000 then raise exception 'Approved feedback must be text within limit' using errcode='22023'; end if;
    select * into ev from events.ops_evaluations where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'evaluationId')::uuid;
    if not found then raise exception 'Unknown evaluation' using errcode='23503'; end if;
    if ev.status<>'submitted' then raise exception 'Only submitted feedback may be approved' using errcode='22023'; end if;
    update events.ops_evaluations set approved_feedback=nullif(trim(p_command->>'feedback'),''),
      feedback_approved_at=case when nullif(trim(p_command->>'feedback'),'') is not null then now() end,
      feedback_approved_by=case when nullif(trim(p_command->>'feedback'),'') is not null then p_actor_id end,
      revision=revision+1 where id=ev.id returning to_jsonb(events.ops_evaluations.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='saveEvaluation' then
    select * into asn from events.ops_assignments where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'assignmentId')::uuid and role='evaluator' and status='active' for update;
    if not found then raise exception 'Live evaluation assignment required' using errcode='23503'; end if;
    if v_principal_kind='portal' and asn.person_id<>person then raise exception 'Own evaluator assignment required' using errcode='42501'; end if;
    select * into cy from events.ops_cycles where id=asn.cycle_id;
    if cy.state is distinct from 'open' then raise exception 'Evaluation cycle must be open' using errcode='22023'; end if;
    select * into ev from events.ops_evaluations where assignment_id=asn.id;
    if found and ev.status='submitted' then raise exception 'Submitted evaluation is immutable; request reopening' using errcode='22023'; end if;
    if jsonb_typeof(p_command->'scores') is distinct from 'object' then raise exception 'Scores object required' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(p_command->'scores') k where not exists(select 1 from jsonb_array_elements(cy.rubric) c where c->>'id'=k)) then raise exception 'Unknown rubric score' using errcode='22023'; end if;
    for criterion in select value from jsonb_array_elements(cy.rubric) loop
      if not (p_command->'scores') ? (criterion->>'id') then
        if coalesce((p_command->>'submit')::boolean,false) then raise exception 'Complete scores required for submission' using errcode='22023'; end if;
      else
        if jsonb_typeof(p_command->'scores'->(criterion->>'id')) is distinct from 'number' then raise exception 'Numeric scores required' using errcode='22023'; end if;
        score:=(p_command->'scores'->>(criterion->>'id'))::numeric;
        if score<(criterion->>'min')::numeric or score>(criterion->>'max')::numeric then raise exception 'Score outside rubric range' using errcode='22023'; end if;
      end if;
    end loop;
    insert into events.ops_evaluations(project_id,event_id,assignment_id,cycle_id,person_id,activity_id,status,scores,notes,comment,submitted_at)
      values(p_project_id,p_event_id,asn.id,asn.cycle_id,asn.person_id,asn.activity_id,case when coalesce((p_command->>'submit')::boolean,false) then 'submitted' else 'draft' end,p_command->'scores',coalesce(p_command->>'notes',''),coalesce(p_command->>'comment',''),case when coalesce((p_command->>'submit')::boolean,false) then now() end)
      on conflict(project_id,event_id,assignment_id) do update set status=excluded.status,scores=excluded.scores,notes=excluded.notes,comment=excluded.comment,submitted_at=excluded.submitted_at,revision=events.ops_evaluations.revision+1 returning * into ev;
    if ev.status='submitted' then insert into events.ops_evaluation_revisions(project_id,event_id,evaluation_id,revision,scores,notes,submitted_at) values(p_project_id,p_event_id,ev.id,ev.revision,ev.scores,ev.notes,ev.submitted_at); end if;
    result:=events.ops_workflow_dto(to_jsonb(ev));
  elsif a in('markAttendance','clearAttendance') then
    activity:=(p_command->>'activityId')::uuid;
    if v_principal_kind='portal' and not exists(select 1 from events.ops_assignments where project_id=p_project_id and event_id=p_event_id and activity_id=activity and person_id=person and role='staff' and status='active')
      and not events.ops_workflow_chairs(p_project_id,p_event_id,person,activity) then raise exception 'Live activity staff responsibility required' using errcode='42501'; end if;
    if p_command->>'purpose' not in('delivery','participation') then raise exception 'Invalid attendance purpose' using errcode='22023'; end if;
    select * into att from events.ops_attendance where project_id=p_project_id and event_id=p_event_id and activity_id=activity and person_id=(p_command->>'personId')::uuid and purpose=p_command->>'purpose' for update;
    if a='clearAttendance' then
      if not found or att.status='unknown' then raise exception 'Nothing to clear' using errcode='22023'; end if;
      if nullif(trim(p_command->>'reason'),'') is null then raise exception 'A reason is required to clear a mark' using errcode='P7006'; end if;
    elsif found and att.status<>'unknown' and att.status<>p_command->>'status' and nullif(trim(coalesce(p_command->>'reason','')),'') is null then
      raise exception 'A reason is required to change a mark' using errcode='P7006';
    end if;
    insert into events.ops_attendance(project_id,event_id,activity_id,person_id,purpose,status,notes)
      values(p_project_id,p_event_id,activity,(p_command->>'personId')::uuid,p_command->>'purpose',case when a='clearAttendance' then 'unknown' else p_command->>'status' end,coalesce(p_command->>'notes',''))
      on conflict(project_id,event_id,activity_id,person_id,purpose) do update set status=excluded.status,notes=case when p_command ? 'notes' then excluded.notes else events.ops_attendance.notes end,recorded_at=now(),revision=events.ops_attendance.revision+1 returning to_jsonb(events.ops_attendance.*) into row_json;
    insert into events.ops_attendance_revisions(project_id,event_id,attendance_id,revision,status,notes,recorded_at,actor_id,reason)
      values(p_project_id,p_event_id,(row_json->>'id')::uuid,(row_json->>'revision')::bigint,row_json->>'status',row_json->>'notes',(row_json->>'recorded_at')::timestamptz,p_actor_id,coalesce(p_command->>'reason',''));
    if a='markAttendance' and p_command->>'purpose'='delivery' and p_command->>'status'='absent' and coalesce((v_automation->>'absentTask')::boolean,true) then
      insert into events.ops_tasks(project_id,event_id,title,person_id,activity_id,recipe) values(p_project_id,p_event_id,'Follow up absent presenter',(p_command->>'personId')::uuid,activity,'absent-presenter') on conflict do nothing;
    end if;
    result:=events.ops_workflow_dto(row_json);
  elsif a='saveTask' then
    if exists(select 1 from events.ops_tasks where id=i and (project_id<>p_project_id or event_id<>p_event_id)) then raise exception 'Task scope mismatch' using errcode='23503'; end if;
    insert into events.ops_tasks(id,project_id,event_id,title,person_id,activity_id,due_at,status) values(i,p_project_id,p_event_id,p_command->>'title',(p_command->>'personId')::uuid,(p_command->>'activityId')::uuid,(p_command->>'dueAt')::timestamptz,coalesce(p_command->>'status','open'))
      on conflict(id) do update set title=excluded.title,person_id=excluded.person_id,activity_id=excluded.activity_id,due_at=excluded.due_at,status=excluded.status,revision=events.ops_tasks.revision+1 returning to_jsonb(events.ops_tasks.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='completeTask' then
    update events.ops_tasks set status='complete',revision=revision+1 where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'taskId')::uuid and (v_principal_kind='staff' or person_id=person) returning to_jsonb(events.ops_tasks.*) into row_json;
    if row_json is null then raise exception 'Own task required' using errcode='42501'; end if;result:=events.ops_workflow_dto(row_json);
  elsif a='deleteTask' then
    delete from events.ops_tasks where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'taskId')::uuid returning jsonb_build_object('id',id) into result;
    if result is null then raise exception 'Unknown task' using errcode='23503'; end if;
  elsif a='retryNotice' then
    update events.ops_notices set status='queued',next_attempt_at=now(),last_error=null,lease_id=null,lease_expires_at=null where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'noticeId')::uuid and status in('failed','uncertain') returning to_jsonb(events.ops_notices.*) into row_json;
    if row_json is null then raise exception 'Only failed/uncertain notices may be retried' using errcode='22023'; end if;result:=events.ops_workflow_dto(row_json);
  elsif a='queueReminders' then
    insert into events.ops_notices(project_id,event_id,kind,person_id,assignment_id,dedupe_key,payload)
      select p_project_id,p_event_id,'evaluation-reminder',x.person_id,x.id,'evaluation-reminder:'||x.id||':'||coalesce(x.due_at,c.due_at),
        jsonb_build_object('assignmentId',x.id,'activityId',x.activity_id,'title',ac.title,'dueAt',coalesce(x.due_at,c.due_at))
      from events.ops_assignments x join events.ops_cycles c on c.id=x.cycle_id join events.ops_activities ac on ac.id=x.activity_id join events.ops_people pp on pp.id=x.person_id
      where x.project_id=p_project_id and x.event_id=p_event_id and x.role='evaluator' and x.status='active' and c.state='open' and coalesce(x.due_at,c.due_at)<now() and pp.email<>''
        and not exists(select 1 from events.ops_evaluations e where e.assignment_id=x.id and e.status='submitted') on conflict do nothing;
    get diagnostics n=row_count;result:=jsonb_build_object('queued',n);
  end if;
  update events.ops_workflow_state set revision=revision+1 where project_id=p_project_id and event_id=p_event_id returning revision into rev;
  response:=jsonb_build_object('revision',rev,'result',result);
  insert into events.ops_audit(project_id,event_id,actor_id,command_id,action,changes) values(p_project_id,p_event_id,p_actor_id,cid,'workflow:'||a,
    jsonb_build_object('revision',rev,'principalKind',v_principal_kind,'result',result)||case when a in('reopenEvaluation','markAttendance','clearAttendance') and p_command ? 'reason' then jsonb_build_object('reason',p_command->>'reason') else '{}' end);
  insert into events.ops_command_receipts(project_id,event_id,actor_id,command_id,request_hash,response) values(p_project_id,p_event_id,p_actor_id,cid,hash,response);
  return response;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
  raise exception 'Invalid workflow input' using errcode='22023';
end $$;

-- ---------------------------------------------------------------- snapshot
create or replace function events.ops_workflow_snapshot(p_project_id uuid,p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare r jsonb;v jsonb;t text;k text;n integer;truncated boolean:=false;st events.ops_workflow_state%rowtype; begin
  if not exists(select 1 from events.events where id=p_event_id and project_id=p_project_id and deleted_at is null) then raise exception 'Unknown event' using errcode='23503'; end if;
  select * into st from events.ops_workflow_state where project_id=p_project_id and event_id=p_event_id;
  r:=jsonb_build_object('revision',coalesce(st.revision,0),'enabled',events.ops_workflow_enabled(p_project_id,p_event_id),
    'closedAt',st.closed_at,'automation',coalesce(st.automation,'{"notifyOnPublish":true,"remindOverdue":false,"absentTask":true}'::jsonb),
    'timezone',(select e.timezone from events.events e where e.id=p_event_id));
  foreach t in array array['people','resources','activities','assignments','cycles','evaluations','attendance','releases','acknowledgements','tasks','notices','invitations','identity_links'] loop
    if t in('people','resources','activities') then
      execute format('select coalesce(jsonb_agg(events.ops_workflow_dto(to_jsonb(s))),''[]''::jsonb),count(*) from (select x.*,e.revision from events.ops_%I x join events.ops_entities e on e.id=x.id where x.project_id=$1 and x.event_id=$2 and e.archived_at is null order by x.id limit 500) s',t) into v,n using p_project_id,p_event_id;
    else
      execute format('select coalesce(jsonb_agg(events.ops_workflow_dto(to_jsonb(s))),''[]''::jsonb),count(*) from (select * from events.ops_%I where project_id=$1 and event_id=$2 order by id limit 500) s',t) into v,n using p_project_id,p_event_id;
    end if;
    k:=case t when 'notices' then 'outbox' when 'identity_links' then 'identityLinks' else t end;
    r:=r||jsonb_build_object(k,v);truncated:=truncated or n>=500;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'personId',f.person_id,'activityId',f.activity_id,'name',f.name,'size',f.size,'mime',f.mime,'uploadedByKind',f.uploaded_by_kind,'createdAt',f.created_at) order by f.created_at),'[]'::jsonb)
    into v from (select * from events.ops_files where project_id=p_project_id and event_id=p_event_id and deleted_at is null order by created_at limit 500) f;
  r:=r||jsonb_build_object('files',v);
  return r||jsonb_build_object('truncated',truncated);
end $$;

-- ---------------------------------------------------------------- personal access links
-- A fresh 14-day link for one person; older unaccepted links stop working. Refused after staff revoke access.
create or replace function events.ops_workflow_issue_link(p_person_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare p events.ops_people%rowtype;begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid link token' using errcode='22023'; end if;
  select * into p from events.ops_people where id=p_person_id for update;
  if not found or p.email='' or p.access_revoked_at is not null or not events.ops_workflow_enabled(p.project_id,p.event_id) then return jsonb_build_object('ok',false); end if;
  update events.ops_invitations set revoked_at=now() where project_id=p.project_id and event_id=p.event_id and person_id=p.id and accepted_at is null and revoked_at is null;
  insert into events.ops_invitations(project_id,event_id,person_id,email,token_hash,expires_at) values(p.project_id,p.event_id,p.id,p.email,p_token_hash,now()+interval '14 days');
  return jsonb_build_object('ok',true,'personId',p.id,'projectId',p.project_id,'eventId',p.event_id,'email',p.email,'name',p.name);
end $$;

-- Self-service: only for someone already invited to this event (any invitation on record) whose access isn't revoked.
create or replace function events.ops_workflow_reissue_link(p_event_id uuid,p_email text,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_person uuid;begin
  select p.id into v_person from events.ops_people p join events.ops_entities e on e.id=p.id
    where p.event_id=p_event_id and p.email<>'' and lower(p.email)=lower(trim(coalesce(p_email,''))) and e.archived_at is null and p.access_revoked_at is null
      and exists(select 1 from events.ops_invitations i where i.person_id=p.id)
    order by p.id limit 1;
  if v_person is null then return jsonb_build_object('ok',false); end if;
  return events.ops_workflow_issue_link(v_person,p_token_hash);
end $$;

-- Reads a live link before sign-in so the server can create or find the invited portal account.
create or replace function events.ops_workflow_open_link(p_token_hash text) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare i events.ops_invitations%rowtype;v_name text;begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid'); end if;
  select * into i from events.ops_invitations where token_hash=p_token_hash;
  if not found or i.revoked_at is not null then return jsonb_build_object('status','invalid'); end if;
  if i.accepted_at is not null then return jsonb_build_object('status','used','eventId',i.event_id); end if;
  if i.expires_at<=now() then return jsonb_build_object('status','expired','eventId',i.event_id); end if;
  select name into v_name from events.ops_people where id=i.person_id;
  return jsonb_build_object('status','live','projectId',i.project_id,'eventId',i.event_id,'email',i.email,'name',coalesce(v_name,''));
end $$;

-- Daily sweep: overdue-evaluation reminders for events that switched the reminder on.
create or replace function events.ops_workflow_queue_overdue() returns integer language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare total integer:=0;n integer;s record;begin
  for s in select st.project_id,st.event_id from events.ops_workflow_state st
    where st.closed_at is null and coalesce((st.automation->>'remindOverdue')::boolean,false) and events.ops_workflow_enabled(st.project_id,st.event_id) loop
    insert into events.ops_notices(project_id,event_id,kind,person_id,assignment_id,dedupe_key,payload)
      select s.project_id,s.event_id,'evaluation-reminder',x.person_id,x.id,'evaluation-reminder:'||x.id||':'||coalesce(x.due_at,c.due_at),
        jsonb_build_object('assignmentId',x.id,'activityId',x.activity_id,'title',ac.title,'dueAt',coalesce(x.due_at,c.due_at))
      from events.ops_assignments x join events.ops_cycles c on c.id=x.cycle_id join events.ops_activities ac on ac.id=x.activity_id join events.ops_people pp on pp.id=x.person_id
      where x.project_id=s.project_id and x.event_id=s.event_id and x.role='evaluator' and x.status='active' and c.state='open' and coalesce(x.due_at,c.due_at)<now() and pp.email<>''
        and not exists(select 1 from events.ops_evaluations e where e.assignment_id=x.id and e.status='submitted') on conflict do nothing;
    get diagnostics n=row_count;total:=total+n;
  end loop;
  return total;
end $$;

-- ---------------------------------------------------------------- public programme
-- The latest published release, only for a published event whose page shows the programme. Names and times only.
create or replace function events.ops_public_programme(p_event_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((
    select jsonb_build_object('version',r.version,'publishedAt',r.created_at,'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',item->>'activityId','title',item->>'title','kind',item->>'kind','startsAt',item->>'startsAt','endsAt',item->>'endsAt',
        'timezone',item->>'timezone','room',coalesce(item->>'resourceName',''),
        'presenters',coalesce((select jsonb_agg(p.name order by p.name) from jsonb_array_elements(coalesce(item->'assignments','[]'::jsonb)) a
          join events.ops_people p on p.id=(a->>'personId')::uuid where a->>'role'='presenter'),'[]'::jsonb))
        order by item->>'startsAt',item->>'title')
      from jsonb_array_elements(r.items) item where item->>'startsAt' is not null),'[]'::jsonb))
    from events.events e join events.ops_releases r on r.event_id=e.id and r.project_id=e.project_id
    where e.id=p_event_id and e.deleted_at is null and e.status='Published' and coalesce(e.metadata->>'scheduleSource','')='programme'
    order by r.version desc limit 1),'null'::jsonb)
$$;

-- Function privileges: service role only, except the public programme read.
do $$ declare f record;begin
  for f in select p.oid::regprocedure signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='events' and (p.proname like 'ops_workflow_%' or p.proname='ops_public_programme') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end $$;
grant execute on function events.ops_workflow_snapshot(uuid,uuid),events.ops_workflow_accepted_items(uuid,uuid),events.ops_workflow_history(uuid,uuid),events.ops_workflow_command(uuid,uuid,uuid,jsonb),
  events.ops_workflow_claim_notices(integer,uuid),events.ops_workflow_finish_notice(uuid,uuid,text,text,text),
  events.ops_workflow_issue_link(uuid,text),events.ops_workflow_reissue_link(uuid,text,text),events.ops_workflow_open_link(text),events.ops_workflow_queue_overdue()
  to service_role;
grant execute on function events.ops_public_programme(uuid) to anon,authenticated,service_role;
