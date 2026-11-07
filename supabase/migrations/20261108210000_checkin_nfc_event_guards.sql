-- @up
-- Event ids are public, so check-in / NFC / floor-plan rows must name an event of their own project (as in 20261108200000).

-- Nullable-project tables: rows without a project are only ever written by SECURITY DEFINER code (RLS rejects them for members).
create or replace function events.assert_event_in_project_if_set()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if new.event_id is not null and new.project_id is not null and not exists (
    select 1 from events.events e where e.id = new.event_id and e.project_id = new.project_id
  ) then
    raise exception 'EVENT_NOT_IN_PROJECT' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function events.assert_event_in_project_if_set() from public, anon, authenticated;

-- A badge's ticket must belong to the badge's event; nfc_tap reads the holder's registration/order by id with no RLS.
create or replace function events.nfc_credential_holder_in_event()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if new.event_id is null then
    return new;
  end if;
  if new.registration_id is not null and not exists (
    select 1 from events.registrations r where r.id = new.registration_id and r.event_id = new.event_id
  ) then
    raise exception 'REGISTRATION_NOT_IN_EVENT' using errcode = 'check_violation';
  end if;
  if new.order_id is not null and not exists (
    select 1 from events.event_orders o where o.id = new.order_id and o.event_id = new.event_id
  ) then
    raise exception 'ORDER_NOT_IN_EVENT' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function events.nfc_credential_holder_in_event() from public, anon, authenticated;

drop trigger if exists checkin_capacity_event_project on events.checkin_capacity;
create trigger checkin_capacity_event_project
  before insert or update of event_id, project_id on events.checkin_capacity
  for each row execute function events.assert_event_in_project();

drop trigger if exists checkin_devices_event_project on events.checkin_devices;
create trigger checkin_devices_event_project
  before insert or update of event_id, project_id on events.checkin_devices
  for each row execute function events.assert_event_in_project();

drop trigger if exists checkin_conflicts_event_project on events.checkin_conflicts;
create trigger checkin_conflicts_event_project
  before insert or update of event_id, project_id on events.checkin_conflicts
  for each row execute function events.assert_event_in_project();

drop trigger if exists checkin_sync_log_event_project on events.checkin_sync_log;
create trigger checkin_sync_log_event_project
  before insert or update of event_id, project_id on events.checkin_sync_log
  for each row execute function events.assert_event_in_project();

drop trigger if exists capacity_overrides_event_project on events.capacity_overrides;
create trigger capacity_overrides_event_project
  before insert or update of event_id, project_id on events.capacity_overrides
  for each row execute function events.assert_event_in_project();

drop trigger if exists smart_badge_batches_event_project on events.smart_badge_batches;
create trigger smart_badge_batches_event_project
  before insert or update of event_id, project_id on events.smart_badge_batches
  for each row execute function events.assert_event_in_project();

drop trigger if exists floor_plans_event_project on events.floor_plans;
create trigger floor_plans_event_project
  before insert or update of event_id, project_id on events.floor_plans
  for each row execute function events.assert_event_in_project();

drop trigger if exists checkin_attendance_event_project on events.checkin_attendance;
create trigger checkin_attendance_event_project
  before insert or update of event_id, project_id on events.checkin_attendance
  for each row execute function events.assert_event_in_project_if_set();

drop trigger if exists checkin_leads_event_project on events.checkin_leads;
create trigger checkin_leads_event_project
  before insert or update of event_id, project_id on events.checkin_leads
  for each row execute function events.assert_event_in_project_if_set();

drop trigger if exists nfc_entry_points_event_project on events.nfc_entry_points;
create trigger nfc_entry_points_event_project
  before insert or update of event_id, project_id on events.nfc_entry_points
  for each row execute function events.assert_event_in_project_if_set();

drop trigger if exists nfc_credentials_event_project on events.nfc_credentials;
create trigger nfc_credentials_event_project
  before insert or update of event_id, project_id on events.nfc_credentials
  for each row execute function events.assert_event_in_project_if_set();

drop trigger if exists nfc_credentials_holder_event on events.nfc_credentials;
create trigger nfc_credentials_holder_event
  before insert or update of event_id, registration_id, order_id on events.nfc_credentials
  for each row execute function events.nfc_credential_holder_in_event();

drop trigger if exists nfc_taps_event_project on events.nfc_taps;
create trigger nfc_taps_event_project
  before insert or update of event_id, project_id on events.nfc_taps
  for each row execute function events.assert_event_in_project_if_set();

-- @down
drop trigger if exists nfc_taps_event_project on events.nfc_taps;
drop trigger if exists nfc_credentials_holder_event on events.nfc_credentials;
drop trigger if exists nfc_credentials_event_project on events.nfc_credentials;
drop trigger if exists nfc_entry_points_event_project on events.nfc_entry_points;
drop trigger if exists checkin_leads_event_project on events.checkin_leads;
drop trigger if exists checkin_attendance_event_project on events.checkin_attendance;
drop trigger if exists floor_plans_event_project on events.floor_plans;
drop trigger if exists smart_badge_batches_event_project on events.smart_badge_batches;
drop trigger if exists capacity_overrides_event_project on events.capacity_overrides;
drop trigger if exists checkin_sync_log_event_project on events.checkin_sync_log;
drop trigger if exists checkin_conflicts_event_project on events.checkin_conflicts;
drop trigger if exists checkin_devices_event_project on events.checkin_devices;
drop trigger if exists checkin_capacity_event_project on events.checkin_capacity;
drop function if exists events.nfc_credential_holder_in_event();
drop function if exists events.assert_event_in_project_if_set();
