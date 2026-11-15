-- Workspace event components: a ticket holder checking in queues a "checkin" item for the event's check-in automations.
-- Schedules, placement, scanners and passes need no tables: blocks live in page bodies, attendance is ordinary records.
-- @up

create or replace function events.workspace__enqueue_checkin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is null or new.deleted_at is not null or coalesce(new.status, 'in') <> 'in' then return null; end if;
  -- A workspace problem must never stop someone getting through the door.
  begin
    insert into events.workspace_queue (project_id, event_id, kind, payload)
    select distinct a.project_id, a.event_id, 'checkin', jsonb_build_object(
      'checkinId', new.id, 'registrationId', new.registration_id, 'orderId', new.order_id, 'ticketCode', new.ticket_code,
      'name', new.attendee_name, 'gate', new.gate, 'zone', new.zone, 'sessionId', new.session_id, 'method', new.method,
      'at', new.checked_in_at,
      'email', coalesce(
        (select lower(r.email) from events.registrations r where r.id = new.registration_id),
        (select lower(o.buyer_email) from events.event_orders o where o.id = new.order_id)))
    from events.workspace_automations a
    where a.event_id = new.event_id and a.enabled and a.deleted_at is null and a.trigger->>'kind' = 'checkin';
  exception when others then
    raise warning 'workspace check-in automations skipped: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists workspace_checkin_enqueue on events.checkin_attendance;
create trigger workspace_checkin_enqueue after insert on events.checkin_attendance
  for each row execute function events.workspace__enqueue_checkin();

revoke all on function events.workspace__enqueue_checkin() from public, anon, authenticated;

-- @down
drop trigger if exists workspace_checkin_enqueue on events.checkin_attendance;
drop function if exists events.workspace__enqueue_checkin();
