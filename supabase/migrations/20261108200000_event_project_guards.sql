-- @up
-- A row's optional event_id must belong to the row's own project; event ids are public, so RLS on project_id alone
-- would let a member of project A attach project B's event to their booking, RFP or board.

create or replace function events.assert_event_in_project()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if new.event_id is not null and not exists (
    select 1 from events.events e where e.id = new.event_id and e.project_id = new.project_id
  ) then
    raise exception 'EVENT_NOT_IN_PROJECT' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function events.assert_event_in_project() from public, anon, authenticated;

drop trigger if exists venue_bookings_event_project on events.venue_bookings;
create trigger venue_bookings_event_project
  before insert or update of event_id, project_id on events.venue_bookings
  for each row execute function events.assert_event_in_project();

drop trigger if exists rfps_event_project on events.rfps;
create trigger rfps_event_project
  before insert or update of event_id, project_id on events.rfps
  for each row execute function events.assert_event_in_project();

drop trigger if exists boards_event_project on events.boards;
create trigger boards_event_project
  before insert or update of event_id, project_id on events.boards
  for each row execute function events.assert_event_in_project();

-- @down
drop trigger if exists venue_bookings_event_project on events.venue_bookings;
drop trigger if exists rfps_event_project on events.rfps;
drop trigger if exists boards_event_project on events.boards;
drop function if exists events.assert_event_in_project();
