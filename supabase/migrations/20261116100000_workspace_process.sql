-- Workspace process & automation: stage rules per list, automations (trigger → condition → steps) fed by the change log
-- through a queue, a run log, approvals and review setups. Automations, approvals and the public API write records through
-- events.workspace_system_command as a system actor. Only the service role can reach any of it.
-- @up

alter table events.workspace_changes drop constraint if exists workspace_changes_actor_kind_check;
alter table events.workspace_changes add constraint workspace_changes_actor_kind_check check (actor_kind in ('staff', 'portal', 'automation', 'api'));
alter table events.workspace_comments drop constraint if exists workspace_comments_actor_kind_check;
alter table events.workspace_comments add constraint workspace_comments_actor_kind_check check (actor_kind in ('staff', 'portal', 'automation', 'api'));
alter table events.workspace_command_receipts drop constraint if exists workspace_receipts_actor_kind_check;
alter table events.workspace_command_receipts add constraint workspace_receipts_actor_kind_check check (actor_kind in ('staff', 'portal', 'automation', 'api'));

-- Stage rules for one list: { enforce, moves: [{ from, to }], requires: { <status>: [fieldId] } }.
create table if not exists events.workspace_processes (
  object_id uuid primary key,
  project_id uuid not null,
  event_id uuid not null,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 65536),
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (project_id, event_id, object_id) references events.workspace_objects (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_automations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  enabled boolean not null default false,
  trigger jsonb not null check (jsonb_typeof(trigger) = 'object' and octet_length(trigger::text) <= 65536),
  condition jsonb check (condition is null or (jsonb_typeof(condition) = 'object' and octet_length(condition::text) <= 65536)),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and octet_length(steps::text) <= 524288),
  hook_token_hash text,
  next_run_at timestamptz,
  position integer not null default 0,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

-- Work waiting to be done: a record change, a due schedule, a resumed wait, a manual run, an incoming hook or a check-in.
create table if not exists events.workspace_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  kind text not null check (kind in ('change', 'schedule', 'date', 'resume', 'manual', 'hook', 'checkin')),
  automation_id uuid,
  change_id uuid,
  record_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  depth integer not null default 0 check (depth >= 0),
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  automation_id uuid not null references events.workspace_automations (id) on delete cascade,
  queue_id uuid,
  run_key text not null unique,
  record_id uuid,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped', 'waiting')),
  trigger jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  error text,
  depth integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  record_id uuid not null,
  automation_id uuid,
  run_id uuid,
  title text not null check (length(title) between 1 and 200),
  message text not null default '' check (length(message) <= 5000),
  approvers uuid[] not null check (cardinality(approvers) between 1 and 50),
  rule text not null default 'any' check (rule in ('any', 'all')),
  decisions jsonb not null default '[]'::jsonb check (jsonb_typeof(decisions) = 'array'),
  outcomes jsonb not null default '{}'::jsonb check (jsonb_typeof(outcomes) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  applied_error text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  foreign key (project_id, event_id, record_id) references events.workspace_records (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_review_setups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  name text not null check (length(name) between 1 and 100),
  config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 65536),
  revision bigint not null default 1 check (revision > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create index if not exists workspace_processes_event_idx on events.workspace_processes (project_id, event_id);
create index if not exists workspace_automations_event_idx on events.workspace_automations (project_id, event_id, position) where deleted_at is null;
create index if not exists workspace_automations_due_idx on events.workspace_automations (next_run_at) where enabled and deleted_at is null and next_run_at is not null;
create index if not exists workspace_queue_due_idx on events.workspace_queue (due_at) where status in ('pending', 'running');
create index if not exists workspace_queue_event_idx on events.workspace_queue (project_id, event_id, status, due_at);
create index if not exists workspace_runs_event_idx on events.workspace_runs (project_id, event_id, started_at desc);
create index if not exists workspace_runs_automation_idx on events.workspace_runs (automation_id, started_at desc);
create index if not exists workspace_runs_record_idx on events.workspace_runs (record_id, started_at desc) where record_id is not null;
create index if not exists workspace_approvals_event_idx on events.workspace_approvals (project_id, event_id, status, created_at desc);
create index if not exists workspace_approvals_record_idx on events.workspace_approvals (record_id);
create index if not exists workspace_review_setups_event_idx on events.workspace_review_setups (project_id, event_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array['workspace_processes', 'workspace_automations', 'workspace_queue', 'workspace_runs',
    'workspace_approvals', 'workspace_review_setups'] loop
    execute format('alter table events.%I enable row level security', t);
    execute format('revoke all on events.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on events.%I to service_role', t);
  end loop;
end $$;

-- Record writes by a system actor: an automation (actor = automation or approval id) or an API key (actor = key id).
-- p_depth marks how deep in an automation chain the change is, so the change trigger can stop loops.
create or replace function events.workspace_system_command(p_project uuid, p_event uuid, p_kind text, p_actor uuid,
  p_depth integer, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action';
  v_command_id uuid;
  v_hash text := p_command->>'requestHash';
  v_receipt events.workspace_command_receipts;
  v_result jsonb;
  v_revision bigint;
  v_ids uuid[];
  r events.workspace_records;
begin
  if p_kind is null or p_kind not in ('automation', 'api') or p_actor is null then perform events.workspace__fail('Not allowed', '42501'); end if;
  perform set_config('workspace.actor_kind', p_kind, true);
  perform set_config('workspace.depth', greatest(coalesce(p_depth, 0), 0)::text, true);
  begin
    v_command_id := (p_command->>'commandId')::uuid;
  exception when others then
    perform events.workspace__fail('Invalid command');
  end;
  if v_action is null or v_command_id is null or v_hash is null then perform events.workspace__fail('Invalid command'); end if;
  if v_action not in ('record.create', 'record.update', 'records.delete', 'comment.add') then perform events.workspace__fail('Not allowed', '42501'); end if;
  if not exists (select 1 from events.events e where e.id = p_event and e.project_id = p_project) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  if p_kind = 'automation' and not exists (
      select 1 from events.workspace_automations a where a.id = p_actor and a.project_id = p_project and a.event_id = p_event
      union all
      select 1 from events.workspace_approvals x where x.id = p_actor and x.project_id = p_project and x.event_id = p_event) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  if p_kind = 'api' and not exists (
      select 1 from events.api_keys k where k.id = p_actor and k.project_id = p_project and k.revoked_at is null and k.deleted_at is null) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  perform 1 from events.workspace_workspaces where project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Workspace required'); end if;
  select * into v_receipt from events.workspace_command_receipts
    where project_id = p_project and event_id = p_event and actor_kind = p_kind and actor_id = p_actor and command_id = v_command_id;
  if found then
    if v_receipt.request_hash <> v_hash then perform events.workspace__fail('Command ID reused', '23505'); end if;
    return v_receipt.response;
  end if;

  case v_action
    when 'record.create' then
      r := events.workspace__record_create(p_project, p_event, p_actor, (p_command->>'objectId')::uuid, p_command);
      v_result := jsonb_build_object('record', events.workspace__record_json(r));
    when 'record.update' then
      r := events.workspace__record_update(p_project, p_event, p_actor, p_command, p_command ? 'expectedRevision');
      v_result := jsonb_build_object('record', events.workspace__record_json(r));
    when 'records.delete' then
      select coalesce(array_agg(value::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_command->'recordIds', '[]'::jsonb));
      if cardinality(v_ids) = 0 or cardinality(v_ids) > 500 then perform events.workspace__fail('Invalid command'); end if;
      v_result := events.workspace__records_delete(p_project, p_event, p_actor, v_ids, true);
    when 'comment.add' then
      select * into r from events.workspace_records where id = (p_command->>'recordId')::uuid and project_id = p_project
        and event_id = p_event and deleted_at is null;
      if not found then perform events.workspace__fail('Unknown record'); end if;
      insert into events.workspace_comments (project_id, event_id, record_id, body, created_by)
      values (p_project, p_event, r.id, left(p_command->>'body', 5000), p_actor)
      returning jsonb_build_object('id', id, 'recordId', record_id, 'body', body, 'createdBy', created_by, 'createdAt', created_at) into v_result;
      v_result := jsonb_build_object('comment', v_result);
  end case;

  update events.workspace_workspaces set revision = revision + 1, updated_at = now()
    where project_id = p_project and event_id = p_event returning revision into v_revision;
  v_result := v_result || jsonb_build_object('revision', v_revision);
  insert into events.workspace_command_receipts (project_id, event_id, actor_id, command_id, request_hash, response)
  values (p_project, p_event, p_actor, v_command_id, v_hash, v_result);
  return v_result;
end $$;

-- Queues every record change (not undos) for the event's record-triggered automations, carrying the chain depth.
create or replace function events.workspace__enqueue_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'record' and new.undo_of is null and new.action in ('record.create', 'record.update') and new.record_id is not null
    and exists (select 1 from events.workspace_automations a where a.project_id = new.project_id and a.event_id = new.event_id
      and a.enabled and a.deleted_at is null and a.trigger->>'kind' in ('record.created', 'record.updated', 'status.changed')) then
    insert into events.workspace_queue (project_id, event_id, kind, change_id, record_id, depth)
    values (new.project_id, new.event_id, 'change', new.id, new.record_id,
      coalesce(nullif(current_setting('workspace.depth', true), '')::integer, 0));
  end if;
  return null;
end $$;

drop trigger if exists workspace_changes_enqueue on events.workspace_changes;
create trigger workspace_changes_enqueue after insert on events.workspace_changes
  for each row execute function events.workspace__enqueue_change();

-- Leases due queue items (optionally for one event); items whose lease ran out are retried up to 3 attempts.
create or replace function events.workspace_queue_claim(p_limit integer, p_lease_seconds integer, p_project uuid default null, p_event uuid default null)
returns setof events.workspace_queue language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select q.id from events.workspace_queue q
    where q.due_at <= now()
      and (q.status = 'pending' or (q.status = 'running' and q.locked_until < now() and q.attempts < 3))
      and (p_project is null or (q.project_id = p_project and q.event_id = p_event))
    order by q.due_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  )
  update events.workspace_queue q set status = 'running', attempts = q.attempts + 1,
    locked_until = now() + make_interval(secs => greatest(10, coalesce(p_lease_seconds, 120))), updated_at = now()
  from due where q.id = due.id
  returning q.*;
end $$;

-- One approver's decision; "any" settles on the first approval, "all" needs every approver; any rejection rejects.
create or replace function events.workspace_approval_decide(p_project uuid, p_event uuid, p_approval uuid, p_user uuid,
  p_decision text, p_note text)
returns events.workspace_approvals language plpgsql security definer set search_path = '' as $$
declare
  a events.workspace_approvals;
  v_approvals integer;
  v_status text;
begin
  if p_decision is null or p_decision not in ('approve', 'reject') then perform events.workspace__fail('Invalid command'); end if;
  select * into a from events.workspace_approvals where id = p_approval and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown approval'); end if;
  if a.status <> 'pending' then perform events.workspace__fail('Approval decided'); end if;
  if not (p_user = any (a.approvers)) then perform events.workspace__fail('Not allowed', '42501'); end if;
  if exists (select 1 from jsonb_array_elements(a.decisions) d where d->>'userId' = p_user::text) then
    perform events.workspace__fail('Approval decided');
  end if;
  a.decisions := a.decisions || jsonb_build_array(jsonb_build_object('userId', p_user, 'decision', p_decision,
    'note', left(coalesce(p_note, ''), 2000), 'at', now()));
  select count(*) into v_approvals from jsonb_array_elements(a.decisions) d where d->>'decision' = 'approve';
  v_status := case
    when p_decision = 'reject' then 'rejected'
    when a.rule = 'any' or v_approvals >= cardinality(a.approvers) then 'approved'
    else 'pending' end;
  update events.workspace_approvals set decisions = a.decisions, status = v_status,
    decided_at = case when v_status <> 'pending' then now() end
    where id = a.id returning * into a;
  return a;
end $$;

-- Trims the run log and finished queue items; items stuck after their last attempt are marked failed.
create or replace function events.workspace_process_housekeeping() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_runs integer;
  v_queue integer;
begin
  update events.workspace_queue set status = 'failed', last_error = coalesce(last_error, 'Stopped after 3 attempts'), updated_at = now()
    where status = 'running' and locked_until < now() and attempts >= 3;
  with gone as (delete from events.workspace_runs where started_at < now() - interval '90 days' returning 1)
    select count(*) into v_runs from gone;
  with gone as (delete from events.workspace_queue where (status = 'done' and updated_at < now() - interval '7 days')
    or (status = 'failed' and updated_at < now() - interval '30 days') returning 1)
    select count(*) into v_queue from gone;
  return jsonb_build_object('runs', v_runs, 'queue', v_queue);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'events' and p.proname like 'workspace\_\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
revoke all on function events.workspace_system_command(uuid, uuid, text, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function events.workspace_queue_claim(integer, integer, uuid, uuid) from public, anon, authenticated;
revoke all on function events.workspace_approval_decide(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function events.workspace_process_housekeeping() from public, anon, authenticated;
grant execute on function events.workspace_system_command(uuid, uuid, text, uuid, integer, jsonb) to service_role;
grant execute on function events.workspace_queue_claim(integer, integer, uuid, uuid) to service_role;
grant execute on function events.workspace_approval_decide(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function events.workspace_process_housekeeping() to service_role;

-- @down
drop trigger if exists workspace_changes_enqueue on events.workspace_changes;
drop function if exists events.workspace__enqueue_change();
drop function if exists events.workspace_process_housekeeping();
drop function if exists events.workspace_approval_decide(uuid, uuid, uuid, uuid, text, text);
drop function if exists events.workspace_queue_claim(integer, integer, uuid, uuid);
drop function if exists events.workspace_system_command(uuid, uuid, text, uuid, integer, jsonb);
drop table if exists events.workspace_review_setups, events.workspace_approvals, events.workspace_runs, events.workspace_queue,
  events.workspace_automations, events.workspace_processes cascade;
update events.workspace_changes set actor_kind = 'staff' where actor_kind in ('automation', 'api');
update events.workspace_comments set actor_kind = 'staff' where actor_kind in ('automation', 'api');
delete from events.workspace_command_receipts where actor_kind in ('automation', 'api');
alter table events.workspace_changes drop constraint if exists workspace_changes_actor_kind_check;
alter table events.workspace_changes add constraint workspace_changes_actor_kind_check check (actor_kind in ('staff', 'portal'));
alter table events.workspace_comments drop constraint if exists workspace_comments_actor_kind_check;
alter table events.workspace_comments add constraint workspace_comments_actor_kind_check check (actor_kind in ('staff', 'portal'));
alter table events.workspace_command_receipts drop constraint if exists workspace_receipts_actor_kind_check;
alter table events.workspace_command_receipts add constraint workspace_receipts_actor_kind_check check (actor_kind in ('staff', 'portal'));
