-- Complete private event operations. Requires operations_foundation, contacts,
-- portal_members and canonical suite projects/organization_users/roles/role_grants.
-- @up
create unique index if not exists ops_contacts_project_identity on events.contacts(project_id,id);
create table events.ops_workflow_state (
  project_id uuid not null,event_id uuid not null,revision bigint not null default 0 check(revision>=0),
  primary key(project_id,event_id),foreign key(project_id,event_id) references events.ops_workspaces
);
create table events.ops_people (
  id uuid primary key,project_id uuid not null,event_id uuid not null,
  module_key text not null default 'ops-people' check(module_key='ops-people'),definition_version integer not null,
  name text not null check(length(trim(name)) between 1 and 200),
  email text not null default '' check(email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  contact_id uuid,roles text[] not null default '{}' check(cardinality(roles)<=5 and roles <@ array['presenter','evaluator','staff','volunteer','participant']),
  unique(project_id,event_id,id),unique(project_id,event_id,contact_id),
  foreign key(project_id,contact_id) references events.contacts(project_id,id),
  foreign key(project_id,event_id,id,module_key,definition_version) references events.ops_entities(project_id,event_id,id,module_key,definition_version) on update cascade
);
create table events.ops_resources (
  id uuid primary key,project_id uuid not null,event_id uuid not null,
  module_key text not null default 'ops-resources' check(module_key='ops-resources'),definition_version integer not null,
  name text not null check(length(trim(name)) between 1 and 200),kind text not null check(kind in('room','equipment')),
  capacity integer not null check(capacity>=1),location text not null default '' check(length(location)<=2000),
  available_from timestamptz,available_until timestamptz,
  check((available_from is null)=(available_until is null) and (available_from is null or available_until>available_from)),
  unique(project_id,event_id,id),
  foreign key(project_id,event_id,id,module_key,definition_version) references events.ops_entities(project_id,event_id,id,module_key,definition_version) on update cascade
);
create table events.ops_activities (
  id uuid primary key,project_id uuid not null,event_id uuid not null,
  module_key text not null default 'ops-activities' check(module_key='ops-activities'),definition_version integer not null,
  title text not null check(length(trim(title)) between 1 and 200),kind text not null check(length(trim(kind)) between 1 and 100),
  resource_id uuid,parent_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text not null,capacity integer check(capacity>=1),
  check((starts_at is null)=(ends_at is null) and (starts_at is null or ends_at>starts_at)),check(parent_id is distinct from id),
  unique(project_id,event_id,id),
  foreign key(project_id,event_id,resource_id) references events.ops_resources(project_id,event_id,id),
  foreign key(project_id,event_id,parent_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,id,module_key,definition_version) references events.ops_entities(project_id,event_id,id,module_key,definition_version) on update cascade
);
create table events.ops_cycles (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  title text not null check(length(trim(title)) between 1 and 200),rubric jsonb not null check(jsonb_typeof(rubric)='array'),
  state text not null default 'draft' check(state in('draft','open','closed','released')),due_at timestamptz,
  revision bigint not null default 1,unique(project_id,event_id,id),foreign key(project_id,event_id) references events.ops_workspaces
);
create index ops_activities_parent on events.ops_activities(project_id,event_id,parent_id);
create index ops_activities_resource on events.ops_activities(project_id,event_id,resource_id);
create table events.ops_assignments (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  activity_id uuid not null,person_id uuid not null,role text not null check(role in('presenter','evaluator','staff','volunteer','participant')),
  cycle_id uuid,status text not null default 'active' check(status in('active','revoked')),due_at timestamptz,
  unique(project_id,event_id,id),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id),
  foreign key(project_id,event_id,cycle_id) references events.ops_cycles(project_id,event_id,id)
);
create unique index ops_assignments_active_tuple on events.ops_assignments(project_id,event_id,activity_id,person_id,role,coalesce(cycle_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status='active';
create index ops_assignments_person on events.ops_assignments(project_id,event_id,person_id) where status='active';
create index ops_assignments_cycle on events.ops_assignments(project_id,event_id,cycle_id);
create index ops_assignments_activity on events.ops_assignments(project_id,event_id,activity_id);
-- Accepted legacy papers are copied once into the workflow; subsequent imports
-- return this binding and never overwrite organizer changes or dual-write papers.
create table events.ops_legacy_imports (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  source_id uuid not null references events.conference_records(id),activity_id uuid not null,person_id uuid,assignment_id uuid,
  unique(project_id,source_id),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id),
  foreign key(project_id,event_id,assignment_id) references events.ops_assignments(project_id,event_id,id)
);
create index ops_legacy_imports_event on events.ops_legacy_imports(project_id,event_id);
create table events.ops_releases (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  version integer not null,created_at timestamptz not null default now(),items jsonb not null,
  unique(project_id,event_id,id),unique(project_id,event_id,version),foreign key(project_id,event_id) references events.ops_workspaces
);
create table events.ops_acknowledgements (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  release_id uuid not null,activity_id uuid not null,person_id uuid not null,released_revision bigint not null,created_at timestamptz not null default now(),
  unique(project_id,event_id,release_id,activity_id,person_id),
  foreign key(project_id,event_id,release_id) references events.ops_releases(project_id,event_id,id),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id)
);
create table events.ops_invitations (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,person_id uuid not null,email text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),expires_at timestamptz not null,
  accepted_at timestamptz,revoked_at timestamptz,accepted_principal_id uuid references events.portal_members(id),
  unique(project_id,event_id,id),foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id)
);
create index ops_invitations_person on events.ops_invitations(project_id,event_id,person_id);
create table events.ops_identity_links (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,person_id uuid not null,
  kind text not null check(kind in('staff','portal')),principal_id uuid not null,invitation_id uuid,
  unique(project_id,event_id,kind,principal_id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id),
  foreign key(project_id,event_id,invitation_id) references events.ops_invitations(project_id,event_id,id)
);
create index ops_identity_links_person on events.ops_identity_links(project_id,event_id,person_id);
create table events.ops_evaluations (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,
  assignment_id uuid not null,cycle_id uuid not null,person_id uuid not null,activity_id uuid not null,
  status text not null default 'draft' check(status in('draft','submitted')),scores jsonb not null default '{}' check(jsonb_typeof(scores)='object'),
  notes text not null default '' check(length(notes)<=20000),submitted_at timestamptz,revision bigint not null default 1,
  approved_feedback text check(length(approved_feedback)<=10000),feedback_approved_at timestamptz,feedback_approved_by uuid,
  unique(project_id,event_id,id),unique(project_id,event_id,assignment_id),
  foreign key(project_id,event_id,assignment_id) references events.ops_assignments(project_id,event_id,id),
  foreign key(project_id,event_id,cycle_id) references events.ops_cycles(project_id,event_id,id),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id)
);
create table events.ops_evaluation_revisions (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,evaluation_id uuid not null,
  revision bigint not null,scores jsonb not null,notes text not null,submitted_at timestamptz not null,
  unique(project_id,event_id,evaluation_id,revision),foreign key(project_id,event_id,evaluation_id) references events.ops_evaluations(project_id,event_id,id)
);
create index ops_evaluations_cycle on events.ops_evaluations(project_id,event_id,cycle_id,activity_id);
create table events.ops_attendance (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,activity_id uuid not null,person_id uuid not null,
  purpose text not null check(purpose in('delivery','participation')),status text not null check(status in('present','absent','excused')),
  notes text not null default '' check(length(notes)<=20000),recorded_at timestamptz not null default now(),revision bigint not null default 1,
  unique(project_id,event_id,id),unique(project_id,event_id,activity_id,person_id,purpose),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id)
);
create table events.ops_attendance_revisions (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,attendance_id uuid not null,
  revision bigint not null,status text not null,notes text not null,recorded_at timestamptz not null,actor_id uuid not null,
  unique(project_id,event_id,attendance_id,revision),foreign key(project_id,event_id,attendance_id) references events.ops_attendance(project_id,event_id,id)
);
create table events.ops_tasks (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,title text not null check(length(trim(title)) between 1 and 200),
  person_id uuid,activity_id uuid,due_at timestamptz,status text not null default 'open' check(status in('open','complete')),
  recipe text,revision bigint not null default 1,unique(project_id,event_id,id),
  foreign key(project_id,event_id) references events.ops_workspaces,
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id),
  foreign key(project_id,event_id,activity_id) references events.ops_activities(project_id,event_id,id)
);
create unique index ops_tasks_absent_open on events.ops_tasks(project_id,event_id,activity_id,person_id) where status='open' and recipe='absent-presenter';
create index ops_tasks_person on events.ops_tasks(project_id,event_id,person_id);
create table events.ops_notices (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,event_id uuid not null,kind text not null,
  person_id uuid not null,release_id uuid,assignment_id uuid,dedupe_key text not null,
  status text not null default 'queued' check(status in('queued','sending','accepted','failed','uncertain','superseded')),
  attempts integer not null default 0,next_attempt_at timestamptz not null default now(),last_error text,provider_id text,
  payload jsonb not null default '{}',lease_id uuid,lease_expires_at timestamptz,created_at timestamptz not null default now(),
  unique(project_id,event_id,id),unique(project_id,event_id,dedupe_key),
  foreign key(project_id,event_id,person_id) references events.ops_people(project_id,event_id,id),
  foreign key(project_id,event_id,release_id) references events.ops_releases(project_id,event_id,id),
  foreign key(project_id,event_id,assignment_id) references events.ops_assignments(project_id,event_id,id)
);
create index ops_notices_due on events.ops_notices(next_attempt_at,id) where status='queued';
create index ops_notices_lease on events.ops_notices(lease_expires_at) where status='sending';

-- A server role owns writes. Client roles have neither table grants nor RPC execution.
do $$ declare t text; begin
  foreach t in array array['ops_workflow_state','ops_people','ops_resources','ops_activities','ops_cycles','ops_assignments','ops_legacy_imports','ops_releases','ops_acknowledgements','ops_invitations','ops_identity_links','ops_evaluations','ops_evaluation_revisions','ops_attendance','ops_attendance_revisions','ops_tasks','ops_notices'] loop
    execute format('alter table events.%I enable row level security',t);
    execute format('revoke all on events.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on events.%I to service_role',t);
  end loop;
end $$;

create function events.ops_workflow_command(p_project_id uuid,p_event_id uuid,p_actor_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare
  a text:=p_command->>'action';v_principal_kind text:=p_command->>'principalKind';cid uuid;
  hash text:=p_command->>'requestHash';expected bigint;rev bigint;
  receipt events.ops_command_receipts%rowtype;v_replay boolean:=false;result jsonb;response jsonb;row_json jsonb;
  i uuid;person uuid;activity uuid;cycle uuid;rel uuid;inv uuid;
  asn events.ops_assignments%rowtype;ev events.ops_evaluations%rowtype;cy events.ops_cycles%rowtype;invite_row events.ops_invitations%rowtype;
  source_row events.conference_records%rowtype;binding events.ops_legacy_imports%rowtype;v_source_id uuid;source_config jsonb;
  criterion jsonb;score numeric;item jsonb;items jsonb:='[]';v_pending jsonb;v_index integer;version integer;permission text;allowed text[];keys text[];n integer;
  payload_keys jsonb:='{"enableWorkflow":[],"savePerson":["id","name","email","contactId","roles"],"saveResource":["id","name","kind","capacity","location","availableFrom","availableUntil"],"saveActivity":["id","title","kind","resourceId","parentId","startsAt","endsAt","timezone","capacity"],"saveAssignment":["id","activityId","personId","role","cycleId","status","dueAt"],"publishProgramme":[],"acknowledgePlacement":["releaseId","activityId"],"invite":["personId","expiresInDays","tokenHash"],"revokeInvitation":["invitationId"],"acceptInvitation":["tokenHash","principalEmail"],"linkStaff":["personId","userId"],"saveCycle":["id","title","rubric","state","dueAt"],"releaseResults":["cycleId"],"reopenEvaluation":["evaluationId","reason"],"saveEvaluation":["assignmentId","scores","notes","submit"],"markAttendance":["activityId","personId","purpose","status","notes"],"saveTask":["id","title","personId","activityId","dueAt","status"],"completeTask":["taskId"],"importPeople":["items"],"importActivities":["items"],"importAcceptedItems":["itemIds"],"approveFeedback":["evaluationId","feedback"],"retryNotice":["noticeId"],"queueReminders":[]}';
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
  foreach permission in array array['title','notes','reason','role','status','location','principalEmail','tokenHash','feedback'] loop
    if p_command ? permission and jsonb_typeof(p_command->permission) is distinct from 'string' then raise exception 'String input required' using errcode='22023'; end if;
  end loop;
  perform events.ops_require_event(p_project_id,p_event_id);
  -- Event lock serializes core commands and A1 publication. A committed receipt
  -- is checked before the expected revision so transport retries are safe.
  select * into receipt from events.ops_command_receipts where project_id=p_project_id and event_id=p_event_id and actor_id=p_actor_id and command_id=cid;
  if found then
    if receipt.request_hash<>hash then raise exception 'Command ID reused with different input' using errcode='23505'; end if;
    v_replay:=true;
  end if;
  if not events.ops_workflow_enabled(p_project_id,p_event_id) then raise exception 'Enabled operations workflow required' using errcode='23503'; end if;
  insert into events.ops_workflow_state(project_id,event_id) values(p_project_id,p_event_id) on conflict do nothing;
  select revision into rev from events.ops_workflow_state where project_id=p_project_id and event_id=p_event_id for update;
  if v_principal_kind='staff' then
    -- Canonical access can be revoked outside operations. Hold its source rows
    -- through commit, then evaluate the current grant; revocation either wins
    -- before this check or waits for the authorized transaction to finish.
    perform 1 from public.projects p where p.id=p_project_id for share;
    perform 1 from public.organization_users m join public.projects p on p.organization_id=m.organization
      where p.id=p_project_id and m."user"=p_actor_id for share of m;
    perform 1 from events.role_grants g join public.roles r on r.id=g.role_id
      where g.project_id=p_project_id and g.user_id=p_actor_id and r.project_id=p_project_id for share of g,r;
    permission:=case when a in('enableWorkflow','publishProgramme','invite','revokeInvitation','linkStaff','saveCycle','releaseResults','reopenEvaluation','retryNotice','queueReminders','importAcceptedItems','approveFeedback') then 'events.operations.configure'
      when a in('importPeople','importActivities') and exists(select 1 from jsonb_array_elements(p_command->'items') x where x->>'id' is not null) then 'events.operations.record_update'
      when p_command ? 'id' or a in('saveEvaluation','markAttendance','completeTask','acknowledgePlacement') then 'events.operations.record_update' else 'events.operations.record_create' end;
    if not events.ops_workflow_staff(p_project_id,p_event_id,p_actor_id,permission) then raise exception 'Workflow permission denied' using errcode='42501'; end if;
    -- IDs in batch imports can address existing records. Recheck the update
    -- permission under the same locked grant rows used for this transaction.
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
    if a not in('acceptInvitation','acknowledgePlacement','saveEvaluation','markAttendance','completeTask') then raise exception 'Portal action denied' using errcode='42501'; end if;
    select l.person_id into person from events.ops_identity_links l
      where l.project_id=p_project_id and l.event_id=p_event_id and l.kind='portal' and l.principal_id=p_actor_id
        and exists(select 1 from events.ops_invitations x where x.id=l.invitation_id and x.accepted_at is not null and x.revoked_at is null);
    if a<>'acceptInvitation' and person is null then raise exception 'Live operations identity required' using errcode='42501'; end if;
    if v_replay then
      -- Receipts preserve exact retry results, but never preserve revoked access.
      -- State checks for new writes (submitted/open/latest release) do not apply
      -- to a valid replay; current identity and allocation still do.
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
      if a='markAttendance' and not exists(select 1 from events.ops_assignments x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.activity_id=(p_command->>'activityId')::uuid and x.person_id=person and x.role='staff' and x.status='active') then
        raise exception 'Live staff allocation required for replay' using errcode='42501'; end if;
      if a='completeTask' and not exists(select 1 from events.ops_tasks x where x.project_id=p_project_id and x.event_id=p_event_id
        and x.id=(p_command->>'taskId')::uuid and x.person_id=person) then raise exception 'Own task required for replay' using errcode='42501'; end if;
    end if;
  end if;
  if v_replay then return receipt.response||jsonb_build_object('replayed',true); end if;
  if rev<>expected then raise exception 'Workflow revision changed' using errcode='40001'; end if;
  if a='enableWorkflow' then result:=jsonb_build_object('enabled',true);
  elsif a in('savePerson','saveResource','saveActivity') then result:=events.ops_workflow_write_native(p_project_id,p_event_id,p_command);
  elsif a='importAcceptedItems' then
    if jsonb_typeof(p_command->'itemIds') is distinct from 'array' or jsonb_array_length(p_command->'itemIds') not between 1 and 100 then raise exception 'Import requires 1 to 100 source identities' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_command->'itemIds') x where jsonb_typeof(x)<>'string') then raise exception 'Source identities must be UUID strings' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_command->'itemIds') x group by x having count(*)>1) then raise exception 'Duplicate source identity' using errcode='23505'; end if;
    for v_source_id in select value::uuid from jsonb_array_elements_text(p_command->'itemIds') order by value loop
      -- Lock the source so acceptance/scope cannot change mid-import. A source
      -- lacking legacy event metadata is explicitly bound by this manager action.
      select * into source_row from events.conference_records where id=v_source_id and project_id=p_project_id and module='paper' and status='Accepted' and deleted_at is null for update;
      if not found then raise exception 'Accepted project source required' using errcode='23503'; end if;
      source_config:=coalesce(source_row.config,'{}');
      if (source_config->>'eventId' is not null and source_config->>'eventId'<>p_event_id::text)
        or (source_config->>'event_id' is not null and source_config->>'event_id'<>p_event_id::text) then raise exception 'Source event mismatch' using errcode='23503'; end if;
      select * into binding from events.ops_legacy_imports where project_id=p_project_id and source_id=source_row.id;
      if found then
        if binding.event_id<>p_event_id then raise exception 'Source already bound to another event' using errcode='23503'; end if;
      else
        row_json:=events.ops_workflow_write_native(p_project_id,p_event_id,jsonb_build_object('action','saveActivity','title',source_row.name,'kind',coalesce(nullif(lower(trim(source_config->>'format')),''),'talk'),'timezone','UTC'));
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
    insert into events.ops_notices(project_id,event_id,kind,person_id,release_id,dedupe_key,payload)
      select distinct p_project_id,p_event_id,'placement',x.person_id,rel,'placement:'||rel||':'||x.person_id,
        jsonb_build_object('version',version,'releaseId',rel,'items',(select coalesce(jsonb_agg(placement||jsonb_build_object('assignments',(select coalesce(jsonb_agg(own_assignment),'[]') from jsonb_array_elements(placement->'assignments') own_assignment where (own_assignment->>'personId')::uuid=x.person_id))),'[]') from jsonb_array_elements(items) placement where exists(select 1 from events.ops_assignments y where y.activity_id=(placement->>'activityId')::uuid and y.person_id=x.person_id and y.status='active')))
      from events.ops_assignments x join events.ops_activities ac on ac.id=x.activity_id where x.project_id=p_project_id and x.event_id=p_event_id and x.status='active' and ac.starts_at is not null;
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
    if coalesce((p_command->>'expiresInDays')::integer,7) not between 1 and 14 then raise exception 'Invalid invitation expiry' using errcode='22023'; end if;
    if not exists(select 1 from events.ops_people where project_id=p_project_id and event_id=p_event_id and id=person and email<>'') then raise exception 'Person with email required' using errcode='23503'; end if;
    update events.ops_invitations set revoked_at=now() where project_id=p_project_id and event_id=p_event_id and person_id=person and accepted_at is null and revoked_at is null;
    insert into events.ops_invitations(project_id,event_id,person_id,email,token_hash,expires_at)
      select p_project_id,p_event_id,person,email,p_command->>'tokenHash',now()+make_interval(days=>coalesce((p_command->>'expiresInDays')::integer,7)) from events.ops_people where id=person returning to_jsonb(events.ops_invitations.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='revokeInvitation' then
    update events.ops_invitations set revoked_at=coalesce(revoked_at,now()) where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'invitationId')::uuid returning to_jsonb(events.ops_invitations.*) into row_json;
    if row_json is null then raise exception 'Unknown invitation' using errcode='23503'; end if;result:=events.ops_workflow_dto(row_json);
  elsif a='acceptInvitation' then
    select * into invite_row from events.ops_invitations where project_id=p_project_id and event_id=p_event_id and token_hash=p_command->>'tokenHash' for update;
    if not found or invite_row.expires_at<=now() or invite_row.revoked_at is not null or invite_row.accepted_at is not null then raise exception 'Invitation expired, revoked or consumed' using errcode='22023'; end if;
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
    insert into events.ops_identity_links(project_id,event_id,person_id,kind,principal_id) values(p_project_id,p_event_id,(p_command->>'personId')::uuid,'staff',(p_command->>'userId')::uuid) returning to_jsonb(events.ops_identity_links.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='saveCycle' then
    if jsonb_typeof(p_command->'rubric') is distinct from 'array' or jsonb_array_length(p_command->'rubric') not between 1 and 20 then raise exception 'Cycle needs 1 to 20 rubric criteria' using errcode='22023'; end if;
    for criterion in select value from jsonb_array_elements(p_command->'rubric') loop
      if jsonb_typeof(criterion)<>'object' or jsonb_typeof(criterion->'id') is distinct from 'string' or jsonb_typeof(criterion->'label') is distinct from 'string'
        or nullif(trim(criterion->>'id'),'') is null or length(criterion->>'id')>100 or nullif(trim(criterion->>'label'),'') is null or length(criterion->>'label')>200
        or jsonb_typeof(criterion->'min') is distinct from 'number' or jsonb_typeof(criterion->'max') is distinct from 'number' or jsonb_typeof(criterion->'weight') is distinct from 'number'
        or (criterion->>'min')::numeric >= (criterion->>'max')::numeric or (criterion->>'weight')::numeric<=0 then raise exception 'Invalid rubric criterion' using errcode='22023'; end if;
      perform (criterion->>'min')::double precision,(criterion->>'max')::double precision,(criterion->>'weight')::double precision;
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
    insert into events.ops_cycles(id,project_id,event_id,title,rubric,state,due_at) values(i,p_project_id,p_event_id,p_command->>'title',p_command->'rubric',coalesce(p_command->>'state','draft'),(p_command->>'dueAt')::timestamptz)
      on conflict(id) do update set title=excluded.title,rubric=excluded.rubric,state=excluded.state,due_at=excluded.due_at,revision=events.ops_cycles.revision+1 returning to_jsonb(events.ops_cycles.*) into row_json;
    result:=events.ops_workflow_dto(row_json);
  elsif a='releaseResults' then
    update events.ops_cycles set state='released',revision=revision+1 where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'cycleId')::uuid returning to_jsonb(events.ops_cycles.*) into row_json;
    if row_json is null then raise exception 'Unknown cycle' using errcode='23503'; end if;result:=events.ops_workflow_dto(row_json);
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
    insert into events.ops_evaluations(project_id,event_id,assignment_id,cycle_id,person_id,activity_id,status,scores,notes,submitted_at)
      values(p_project_id,p_event_id,asn.id,asn.cycle_id,asn.person_id,asn.activity_id,case when coalesce((p_command->>'submit')::boolean,false) then 'submitted' else 'draft' end,p_command->'scores',coalesce(p_command->>'notes',''),case when coalesce((p_command->>'submit')::boolean,false) then now() end)
      on conflict(project_id,event_id,assignment_id) do update set status=excluded.status,scores=excluded.scores,notes=excluded.notes,submitted_at=excluded.submitted_at,revision=events.ops_evaluations.revision+1 returning * into ev;
    if ev.status='submitted' then insert into events.ops_evaluation_revisions(project_id,event_id,evaluation_id,revision,scores,notes,submitted_at) values(p_project_id,p_event_id,ev.id,ev.revision,ev.scores,ev.notes,ev.submitted_at); end if;
    result:=events.ops_workflow_dto(to_jsonb(ev));
  elsif a='markAttendance' then
    activity:=(p_command->>'activityId')::uuid;
    if v_principal_kind='portal' and not exists(select 1 from events.ops_assignments where project_id=p_project_id and event_id=p_event_id and activity_id=activity and person_id=person and role='staff' and status='active') then raise exception 'Live activity staff responsibility required' using errcode='42501'; end if;
    insert into events.ops_attendance(project_id,event_id,activity_id,person_id,purpose,status,notes) values(p_project_id,p_event_id,activity,(p_command->>'personId')::uuid,p_command->>'purpose',p_command->>'status',coalesce(p_command->>'notes',''))
      on conflict(project_id,event_id,activity_id,person_id,purpose) do update set status=excluded.status,notes=excluded.notes,recorded_at=now(),revision=events.ops_attendance.revision+1 returning to_jsonb(events.ops_attendance.*) into row_json;
    insert into events.ops_attendance_revisions(project_id,event_id,attendance_id,revision,status,notes,recorded_at,actor_id)
      values(p_project_id,p_event_id,(row_json->>'id')::uuid,(row_json->>'revision')::bigint,row_json->>'status',row_json->>'notes',(row_json->>'recorded_at')::timestamptz,p_actor_id);
    if p_command->>'purpose'='delivery' and p_command->>'status'='absent' then
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
  elsif a='retryNotice' then
    update events.ops_notices set status='queued',next_attempt_at=now(),last_error=null,lease_id=null,lease_expires_at=null where project_id=p_project_id and event_id=p_event_id and id=(p_command->>'noticeId')::uuid and status in('failed','uncertain') returning to_jsonb(events.ops_notices.*) into row_json;
    if row_json is null then raise exception 'Only failed/uncertain notices may be retried' using errcode='22023'; end if;result:=events.ops_workflow_dto(row_json);
  elsif a='queueReminders' then
    insert into events.ops_notices(project_id,event_id,kind,person_id,assignment_id,dedupe_key,payload)
      select p_project_id,p_event_id,'evaluation-reminder',x.person_id,x.id,'evaluation-reminder:'||x.id||':'||coalesce(x.due_at,c.due_at),
        jsonb_build_object('assignmentId',x.id,'activityId',x.activity_id,'title',ac.title,'dueAt',coalesce(x.due_at,c.due_at))
      from events.ops_assignments x join events.ops_cycles c on c.id=x.cycle_id join events.ops_activities ac on ac.id=x.activity_id
      where x.project_id=p_project_id and x.event_id=p_event_id and x.role='evaluator' and x.status='active' and c.state='open' and coalesce(x.due_at,c.due_at)<now()
        and not exists(select 1 from events.ops_evaluations e where e.assignment_id=x.id and e.status='submitted') on conflict do nothing;
    get diagnostics n=row_count;result:=jsonb_build_object('queued',n);
  end if;
  update events.ops_workflow_state set revision=revision+1 where project_id=p_project_id and event_id=p_event_id returning revision into rev;
  response:=jsonb_build_object('revision',rev,'result',result);
  insert into events.ops_audit(project_id,event_id,actor_id,command_id,action,changes) values(p_project_id,p_event_id,p_actor_id,cid,'workflow:'||a,
    jsonb_build_object('revision',rev,'principalKind',v_principal_kind,'result',result)||case when a='reopenEvaluation' then jsonb_build_object('reason',p_command->>'reason') else '{}' end);
  insert into events.ops_command_receipts(project_id,event_id,actor_id,command_id,request_hash,response) values(p_project_id,p_event_id,p_actor_id,cid,hash,response);
  return response;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
  raise exception 'Invalid workflow input' using errcode='22023';
end $$;

create function events.ops_workflow_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable workflow history' using errcode='42501'; end $$;
create trigger ops_releases_immutable before update or delete on events.ops_releases for each row execute function events.ops_workflow_immutable();
create trigger ops_acknowledgements_immutable before update or delete on events.ops_acknowledgements for each row execute function events.ops_workflow_immutable();
create trigger ops_evaluation_revisions_immutable before update or delete on events.ops_evaluation_revisions for each row execute function events.ops_workflow_immutable();
create trigger ops_attendance_revisions_immutable before update or delete on events.ops_attendance_revisions for each row execute function events.ops_workflow_immutable();

create function events.ops_workflow_member(p_project uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.projects p where p.id=p_project and
    ((p.organization_id is null and p.created_by=p_user) or exists(select 1 from public.organization_users m where m.organization=p.organization_id and m."user"=p_user)))
$$;
create function events.ops_workflow_staff(p_project uuid,p_event uuid,p_user uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$
  select events.ops_workflow_member(p_project,p_user) and exists(
    select 1 from events.role_grants g join public.roles r on r.id=g.role_id
    where g.project_id=p_project and g.user_id=p_user and g.status='active' and g.deleted_at is null
      and r.project_id=p_project and r.deleted_at is null and public.rbac_key_matches(r.permissions,p_permission)
      and (not (g.scope ? 'event') or (g.scope->'event') ? p_event::text))
$$;
create function events.ops_workflow_enabled(p_project uuid,p_event uuid) returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from events.ops_workspaces where project_id=p_project and event_id=p_event and status='active')
    and (select count(*)=3 from events.ops_module_instances i join events.ops_module_versions v
      on v.project_id=i.project_id and v.event_id=i.event_id and v.module_key=i.module_key and v.version=i.definition_version
      where i.project_id=p_project and i.event_id=p_event and i.module_key in('ops-people','ops-resources','ops-activities') and i.enabled and v.source_kind='native')
$$;
create function events.ops_workflow_ancestor(p_project uuid,p_event uuid,p_parent uuid,p_child uuid) returns boolean language sql stable set search_path='' as $$
  with recursive lineage as (select id,parent_id from events.ops_activities where project_id=p_project and event_id=p_event and id=p_child
    union select a.id,a.parent_id from events.ops_activities a join lineage l on a.id=l.parent_id where a.project_id=p_project and a.event_id=p_event)
  select exists(select 1 from lineage where id=p_parent)
$$;
create function events.ops_workflow_resource(p_project uuid,p_event uuid,p_activity uuid) returns uuid language sql stable set search_path='' as $$
  with recursive lineage as (select id,parent_id,resource_id,0 depth,array[id] path from events.ops_activities where project_id=p_project and event_id=p_event and id=p_activity
    union all select a.id,a.parent_id,a.resource_id,l.depth+1,l.path||a.id from events.ops_activities a join lineage l on a.id=l.parent_id
      where a.project_id=p_project and a.event_id=p_event and not a.id=any(l.path))
  select resource_id from lineage where resource_id is not null order by depth limit 1
$$;
create function events.ops_workflow_validate_schedule(p_project uuid,p_event uuid) returns void language plpgsql set search_path='' as $$
begin
  if exists(select 1 from events.ops_activities a where a.project_id=p_project and a.event_id=p_event and a.parent_id is not null
    and events.ops_workflow_ancestor(p_project,p_event,a.id,a.parent_id)) then
    raise exception 'Activity parent cycle' using errcode='22023'; end if;
  if exists(select 1 from events.ops_activities a join events.ops_activities p on p.id=a.parent_id where a.project_id=p_project and a.event_id=p_event
    and a.starts_at is not null and (p.starts_at is null or a.starts_at<p.starts_at or a.ends_at>p.ends_at)) then
    raise exception 'Scheduled child must fit its parent' using errcode='P7002'; end if;
  if exists(select 1 from events.ops_activities a join events.ops_resources r on r.id=events.ops_workflow_resource(p_project,p_event,a.id)
    where a.project_id=p_project and a.event_id=p_event and
      (a.capacity>r.capacity or (a.starts_at is not null and r.available_from is not null and (a.starts_at<r.available_from or a.ends_at>r.available_until)))) then
    raise exception 'Resource capacity or availability exceeded' using errcode='22023'; end if;
  if exists(select 1 from events.ops_activities a join events.ops_activities b on a.id<b.id and a.project_id=b.project_id and a.event_id=b.event_id
    where a.project_id=p_project and a.event_id=p_event and a.starts_at<b.ends_at and b.starts_at<a.ends_at
      and events.ops_workflow_resource(p_project,p_event,a.id)=events.ops_workflow_resource(p_project,p_event,b.id)
      and not events.ops_workflow_ancestor(p_project,p_event,a.id,b.id) and not events.ops_workflow_ancestor(p_project,p_event,b.id,a.id)) then
    raise exception 'Room reservation overlaps' using errcode='P7002'; end if;
  if exists(select 1 from events.ops_assignments x join events.ops_assignments y on x.person_id=y.person_id and x.activity_id<y.activity_id
    and x.project_id=y.project_id and x.event_id=y.event_id join events.ops_activities a on a.id=x.activity_id join events.ops_activities b on b.id=y.activity_id
    where x.project_id=p_project and x.event_id=p_event and x.status='active' and y.status='active' and a.starts_at<b.ends_at and b.starts_at<a.ends_at
      and not events.ops_workflow_ancestor(p_project,p_event,a.id,b.id) and not events.ops_workflow_ancestor(p_project,p_event,b.id,a.id)) then
    raise exception 'Person commitments overlap' using errcode='P7002'; end if;
end $$;

-- Explicit top-level camelCase projection. Secrets are removed before this helper.
create function events.ops_workflow_dto(p_row jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;parts text[];camel text;i integer;r jsonb:='{}'; begin
  for k,v in select key,value from jsonb_each(p_row) loop
    if k in('project_id','event_id','module_key','definition_version','token_hash','accepted_principal_id','lease_id','lease_expires_at','dedupe_key','recipe') then continue; end if;
    parts:=string_to_array(k,'_');camel:=parts[1];
    if cardinality(parts)>1 then for i in 2..cardinality(parts) loop camel:=camel||upper(left(parts[i],1))||substr(parts[i],2); end loop; end if;
    r:=r||jsonb_build_object(camel,v);
  end loop;return r;
end $$;
create function events.ops_workflow_snapshot(p_project_id uuid,p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare r jsonb;v jsonb;t text;k text;n integer;truncated boolean:=false; begin
  if not exists(select 1 from events.events where id=p_event_id and project_id=p_project_id and deleted_at is null) then raise exception 'Unknown event' using errcode='23503'; end if;
  r:=jsonb_build_object('revision',coalesce((select revision from events.ops_workflow_state where project_id=p_project_id and event_id=p_event_id),0),
    'enabled',events.ops_workflow_enabled(p_project_id,p_event_id));
  foreach t in array array['people','resources','activities','assignments','cycles','evaluations','attendance','releases','acknowledgements','tasks','notices','invitations','identity_links'] loop
    if t in('people','resources','activities') then
      execute format('select coalesce(jsonb_agg(events.ops_workflow_dto(to_jsonb(s))),''[]''::jsonb),count(*) from (select x.*,e.revision from events.ops_%I x join events.ops_entities e on e.id=x.id where x.project_id=$1 and x.event_id=$2 and e.archived_at is null order by x.id limit 500) s',t) into v,n using p_project_id,p_event_id;
    else
      execute format('select coalesce(jsonb_agg(events.ops_workflow_dto(to_jsonb(s))),''[]''::jsonb),count(*) from (select * from events.ops_%I where project_id=$1 and event_id=$2 order by id limit 500) s',t) into v,n using p_project_id,p_event_id;
    end if;
    k:=case t when 'notices' then 'outbox' when 'identity_links' then 'identityLinks' else t end;
    r:=r||jsonb_build_object(k,v);truncated:=truncated or n>=500;
  end loop;
  return r||jsonb_build_object('truncated',truncated);
end $$;

-- Manager source chooser; raw legacy reviewer notes and abstracts are excluded.
create function events.ops_workflow_accepted_items(p_project_id uuid,p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;n integer;begin
  if not exists(select 1 from events.events where id=p_event_id and project_id=p_project_id and deleted_at is null) then raise exception 'Unknown event' using errcode='23503'; end if;
  if not events.ops_workflow_enabled(p_project_id,p_event_id) then raise exception 'Enabled operations workflow required' using errcode='23503'; end if;
  select coalesce(jsonb_agg(s.value),'[]'::jsonb),count(*) into items,n from (
    select jsonb_build_object('id',r.id,'title',r.name,'authorName',coalesce(r.config->>'authorName',''),'email',coalesce(r.config->>'email',''),'format',coalesce(r.config->>'format','Talk')) value
    from events.conference_records r where r.project_id=p_project_id and r.module='paper' and r.status='Accepted' and r.deleted_at is null
      and (r.config->>'eventId' is null or r.config->>'eventId'=p_event_id::text)
      and (r.config->>'event_id' is null or r.config->>'event_id'=p_event_id::text)
      and not exists(select 1 from events.ops_legacy_imports b where b.project_id=p_project_id and b.source_id=r.id and b.event_id<>p_event_id)
    order by r.id limit 500
  ) s;
  return jsonb_build_object('items',items,'truncated',n>=500);
end $$;

-- Staff history reads use archive permission in the API. These routines and
-- the private history tables have no client-role access.
create function events.ops_workflow_history(p_project_id uuid,p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare result jsonb:='{}';rows jsonb;n integer;t text;truncated boolean:=false;begin
  if not exists(select 1 from events.events where id=p_event_id and project_id=p_project_id and deleted_at is null) then raise exception 'Unknown event' using errcode='23503'; end if;
  if not events.ops_workflow_enabled(p_project_id,p_event_id) then raise exception 'Enabled operations workflow required' using errcode='23503'; end if;
  foreach t in array array['attendance','evaluation'] loop
    execute format('select coalesce(jsonb_agg(events.ops_workflow_dto(to_jsonb(s))),''[]''::jsonb),count(*) from (select * from events.ops_%I_revisions where project_id=$1 and event_id=$2 order by id limit 500) s',t)
      into rows,n using p_project_id,p_event_id;
    result:=result||jsonb_build_object(t||'Revisions',rows);truncated:=truncated or n>=500;
  end loop;
  return result||jsonb_build_object('truncated',truncated);
end $$;

create function events.ops_workflow_write_native(p_project uuid,p_event uuid,p_command jsonb,p_validate boolean default true) returns jsonb language plpgsql set search_path='' as $$
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
    insert into events.ops_resources(id,project_id,event_id,definition_version,name,kind,capacity,location,available_from,available_until)
      values(i,p_project,p_event,ver,title,p_command->>'kind',(p_command->>'capacity')::integer,coalesce(p_command->>'location',''),(p_command->>'availableFrom')::timestamptz,(p_command->>'availableUntil')::timestamptz)
      on conflict(id) do update set name=excluded.name,kind=excluded.kind,capacity=excluded.capacity,location=excluded.location,available_from=excluded.available_from,available_until=excluded.available_until;
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

create function events.ops_workflow_live_placement_items(p_notice events.ops_notices) returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(placement||jsonb_build_object('assignments',live.assignments)),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_notice.payload->'items','[]'::jsonb)) placement
  cross join lateral (
    select jsonb_agg(frozen) assignments from jsonb_array_elements(coalesce(placement->'assignments','[]'::jsonb)) frozen
    where exists(select 1 from events.ops_assignments a join events.ops_activities ac on ac.id=a.activity_id join events.ops_entities e on e.id=ac.id
      where a.id=(frozen->>'id')::uuid and a.project_id=p_notice.project_id and a.event_id=p_notice.event_id
        and a.person_id=p_notice.person_id and a.person_id=(frozen->>'personId')::uuid
        and a.activity_id=(placement->>'activityId')::uuid and a.activity_id=(frozen->>'activityId')::uuid
        and a.role=frozen->>'role' and a.cycle_id is not distinct from (frozen->>'cycleId')::uuid
        and a.status='active' and ac.starts_at is not null and e.archived_at is null)
  ) live where jsonb_array_length(coalesce(live.assignments,'[]'::jsonb))>0
$$;

create function events.ops_workflow_notice_active(p_notice events.ops_notices) returns boolean language sql stable set search_path='' as $$
  select events.ops_workflow_enabled(p_notice.project_id,p_notice.event_id)
    and exists(select 1 from events.events where id=p_notice.event_id and project_id=p_notice.project_id and deleted_at is null)
    and exists(select 1 from events.ops_people p join events.ops_entities e on e.id=p.id left join events.contacts c on c.id=p.contact_id
      where p.id=p_notice.person_id and e.archived_at is null and (c.id is null or (c.deleted_at is null and not c.blocked)))
    and not (exists(select 1 from events.ops_identity_links l where l.project_id=p_notice.project_id and l.event_id=p_notice.event_id and l.person_id=p_notice.person_id and l.kind='portal')
      and not exists(select 1 from events.ops_identity_links l join events.ops_invitations i on i.id=l.invitation_id where l.project_id=p_notice.project_id and l.event_id=p_notice.event_id and l.person_id=p_notice.person_id and l.kind='portal' and i.accepted_at is not null and i.revoked_at is null))
    and case when p_notice.kind='placement' then
      p_notice.release_id=(select id from events.ops_releases where project_id=p_notice.project_id and event_id=p_notice.event_id order by version desc limit 1)
      and jsonb_array_length(events.ops_workflow_live_placement_items(p_notice))>0
    when p_notice.kind='evaluation-reminder' then exists(select 1 from events.ops_assignments a join events.ops_cycles c on c.id=a.cycle_id where a.id=p_notice.assignment_id and a.person_id=p_notice.person_id and a.status='active' and c.state='open'
      and coalesce(a.due_at,c.due_at)<=now() and coalesce(a.due_at,c.due_at)=(p_notice.payload->>'dueAt')::timestamptz
      and not exists(select 1 from events.ops_evaluations e where e.assignment_id=a.id and e.status='submitted')) else false end
$$;

create function events.ops_workflow_claim_notices(p_limit integer,p_lease_id uuid) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare e record;n events.ops_notices%rowtype;r jsonb:='[]';claimed integer:=0;mail text;begin
  if p_limit is null or p_limit not between 1 and 100 or p_lease_id is null then raise exception 'Invalid notice claim' using errcode='22023'; end if;
  -- Match the command lock order (event, then notices), skip busy events and
  -- notice rows. A expired lease represents an unknown external outcome.
  for e in select ev.id,ev.project_id from events.events ev where exists(select 1 from events.ops_notices x where x.event_id=ev.id and
      ((x.status='queued' and x.next_attempt_at<=now()) or (x.status='sending' and x.lease_expires_at<=now())))
    order by ev.id limit 100 for update of ev skip locked loop
    update events.ops_notices set status='uncertain',last_error='Send lease expired; provider outcome unknown',lease_id=null,lease_expires_at=null
      where project_id=e.project_id and event_id=e.id and status='sending' and lease_expires_at<=now();
    for n in select * from events.ops_notices where project_id=e.project_id and event_id=e.id and status='queued' and next_attempt_at<=now()
      order by next_attempt_at,id limit p_limit-claimed for update skip locked loop
      if not events.ops_workflow_notice_active(n) then
        update events.ops_notices set status='superseded',last_error='Recipient access or programme assignment is no longer current' where id=n.id;continue;
      end if;
      if n.kind='placement' then n.payload:=jsonb_set(n.payload,'{items}',events.ops_workflow_live_placement_items(n)); end if;
      select p.email into mail from events.ops_people p where p.id=n.person_id;
      update events.ops_notices set status='sending',attempts=attempts+1,payload=n.payload,lease_id=p_lease_id,lease_expires_at=now()+interval '5 minutes' where id=n.id returning * into n;
      r:=r||jsonb_build_array(events.ops_workflow_dto(to_jsonb(n))||jsonb_build_object('projectId',n.project_id,'eventId',n.event_id,'email',mail));claimed:=claimed+1;
    end loop;
    exit when claimed>=p_limit;
  end loop;
  return r;
end $$;
create function events.ops_workflow_finish_notice(p_notice_id uuid,p_lease_id uuid,p_status text,p_provider_id text,p_error text)
returns void language plpgsql security definer set search_path='' as $$
declare n events.ops_notices%rowtype;begin
  if p_status is null or p_status not in('accepted','failed','uncertain') or p_notice_id is null or p_lease_id is null then raise exception 'Invalid notice completion' using errcode='22023'; end if;
  select * into n from events.ops_notices where id=p_notice_id;
  if not found then raise exception 'Unknown notice' using errcode='23503'; end if;
  perform events.ops_require_event(n.project_id,n.event_id);
  select * into n from events.ops_notices where id=p_notice_id for update;
  if n.status<>'sending' or n.lease_id is distinct from p_lease_id or n.lease_expires_at<=now() then raise exception 'Notice lease changed or expired' using errcode='40001'; end if;
  update events.ops_notices set status=p_status,provider_id=left(p_provider_id,1000),last_error=left(p_error,2000),lease_id=null,lease_expires_at=null where id=p_notice_id;
end $$;

-- Revoke function defaults, including internal helpers: RPCs are service only.
do $$ declare f record;begin
  for f in select p.oid::regprocedure signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='events' and p.proname like 'ops_workflow_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end $$;
grant execute on function events.ops_workflow_snapshot(uuid,uuid),events.ops_workflow_accepted_items(uuid,uuid),events.ops_workflow_history(uuid,uuid),events.ops_workflow_command(uuid,uuid,uuid,jsonb),
  events.ops_workflow_claim_notices(integer,uuid),events.ops_workflow_finish_notice(uuid,uuid,text,text,text) to service_role;
