-- Workspace code & openness: API keys may read and write workspace records, each workspace gets a secret for signing
-- outgoing automation webhooks, and record changes become webhook events (workspace.record.created/updated/deleted,
-- workspace.status.changed) for endpoints that subscribe to them.
-- @up

alter table events.api_keys drop constraint if exists api_keys_scopes_check;
alter table events.api_keys add constraint api_keys_scopes_check check (
  scopes <@ array['read:events', 'read:orders', 'read:attendees', 'read:checkins', 'write:checkins', 'read:workspace', 'write:workspace']::text[]
);

alter table events.workspace_workspaces add column if not exists hook_secret text not null
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- One record's identity for webhook payloads, with values keyed by field key instead of field id.
create or replace function events.workspace__webhook_record(p_record uuid, p_values jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'object', 'workspace_record', 'id', r.id, 'number', r.number, 'title', r.title, 'status', r.status,
    'list', jsonb_build_object('id', o.id, 'key', o.key, 'name', o.name),
    'event_id', r.event_id, 'updated_at', r.updated_at,
    'values', coalesce((select jsonb_object_agg(coalesce(f.key, e.key), e.value)
      from jsonb_each(coalesce(p_values, '{}'::jsonb)) e left join events.workspace_fields f on f.id::text = e.key), '{}'::jsonb))
  from events.workspace_records r join events.workspace_objects o on o.id = r.object_id
  where r.id = p_record
$$;

-- Queues record changes for automations (as before) and emits workspace webhook events. Undos are never sent on.
create or replace function events.workspace__enqueue_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  v_actor jsonb;
begin
  if new.kind = 'record' and new.undo_of is null and new.action in ('record.create', 'record.update') and new.record_id is not null
    and exists (select 1 from events.workspace_automations a where a.project_id = new.project_id and a.event_id = new.event_id
      and a.enabled and a.deleted_at is null and a.trigger->>'kind' in ('record.created', 'record.updated', 'status.changed')) then
    insert into events.workspace_queue (project_id, event_id, kind, change_id, record_id, depth)
    values (new.project_id, new.event_id, 'change', new.id, new.record_id,
      coalesce(nullif(current_setting('workspace.depth', true), '')::integer, 0));
  end if;

  if new.kind <> 'record' or new.undo_of is not null then return null; end if;
  -- A webhook problem must never stop a record from saving.
  begin
    v_actor := jsonb_build_object('kind', new.actor_kind, 'id', new.actor_id);
    if new.action = 'record.create' and new.record_id is not null and events.webhook_wants(new.project_id, 'workspace.record.created') then
      perform events.webhook_emit(new.project_id, 'workspace.record.created',
        events.workspace__webhook_record(new.record_id, (select r.data from events.workspace_records r where r.id = new.record_id)) || jsonb_build_object('actor', v_actor));
    elsif new.action = 'record.update' and new.record_id is not null then
      if events.webhook_wants(new.project_id, 'workspace.record.updated') then
        perform events.webhook_emit(new.project_id, 'workspace.record.updated',
          events.workspace__webhook_record(new.record_id, new.after->'values') || jsonb_build_object('actor', v_actor,
            'changed', (select coalesce(jsonb_agg(coalesce(f.key, e.key)), '[]'::jsonb) from jsonb_object_keys(coalesce(new.after->'values', '{}'::jsonb)) e(key)
              left join events.workspace_fields f on f.id::text = e.key)));
      end if;
      if new.after ? 'status' and (new.before->>'status') is distinct from (new.after->>'status')
        and events.webhook_wants(new.project_id, 'workspace.status.changed') then
        perform events.webhook_emit(new.project_id, 'workspace.status.changed',
          events.workspace__webhook_record(new.record_id, '{}'::jsonb) || jsonb_build_object('actor', v_actor,
            'from', new.before->'status', 'to', new.after->'status'));
      end if;
    elsif new.action = 'records.delete' and events.webhook_wants(new.project_id, 'workspace.record.deleted') then
      for v_id in select coalesce(new.record_id::text, x) from jsonb_array_elements_text(
          case when new.record_id is null then coalesce(new.after->'recordIds', '[]'::jsonb) else '["-"]'::jsonb end) x loop
        perform events.webhook_emit(new.project_id, 'workspace.record.deleted',
          events.workspace__webhook_record(v_id::uuid, '{}'::jsonb) || jsonb_build_object('actor', v_actor, 'deleted', true));
      end loop;
    end if;
  exception when others then
    raise warning 'workspace webhook skipped: %', sqlerrm;
  end;
  return null;
end $$;

revoke all on function events.workspace__webhook_record(uuid, jsonb) from public, anon, authenticated;
revoke all on function events.workspace__enqueue_change() from public, anon, authenticated;

-- @down
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
drop function if exists events.workspace__webhook_record(uuid, jsonb);
alter table events.workspace_workspaces drop column if exists hook_secret;
update events.api_keys set scopes = array_remove(array_remove(scopes, 'read:workspace'), 'write:workspace')
  where scopes && array['read:workspace', 'write:workspace']::text[];
alter table events.api_keys drop constraint if exists api_keys_scopes_check;
alter table events.api_keys add constraint api_keys_scopes_check check (
  scopes <@ array['read:events', 'read:orders', 'read:attendees', 'read:checkins', 'write:checkins']::text[]
);
