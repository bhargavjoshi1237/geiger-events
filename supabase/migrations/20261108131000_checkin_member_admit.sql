-- @up
-- Dashboard check-in (Name-search Lookup) through the same capacity-aware admit core as the staff scanners, so hard caps,
-- duplicate and ticket-status checks apply there too. Project members may override a full area with a reason,
-- which is recorded in capacity_overrides like a supervisor override at the gate.

create or replace function events.checkin_admit_member(
  p_event uuid,
  p_registration uuid default null,
  p_order uuid default null,
  p_name text default '',
  p_method text default 'manual',
  p_staff text default null,
  p_override_reason text default null,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.events where id = p_event and deleted_at is null;
  if v_project is null or not events.can_access_project(v_project) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return events.checkin_admit_core(
    p_event,
    jsonb_build_object('name', 'Dashboard', 'permissions', jsonb_build_object('canOverride', true)),
    p_registration, p_order, p_name, null, null, null, null,
    coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'manual'),
    coalesce(nullif(btrim(coalesce(p_staff, '')), ''), 'Name search'),
    p_client_id, null, null, p_override_reason, false);
end;
$$;

revoke all on function events.checkin_admit_member(uuid, uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function events.checkin_admit_member(uuid, uuid, uuid, text, text, text, text, uuid) to authenticated;

-- @down
drop function if exists events.checkin_admit_member(uuid, uuid, uuid, text, text, text, text, uuid);
