-- ===========================================================================
-- Geiger Events — check-in staff routes (Phase 2)
--
-- SECURITY DEFINER RPCs that power the anonymous staff-facing routes
-- (/checkin, /kiosk, /door). checkin_attendance is member-only under RLS, so an
-- anon staff device can't write it directly — these RPCs validate a per-event
-- access code (checkin_staff_roles.access_code) and then do the lookup / admit
-- server-side, exactly like buy_ticket() / register() serve public checkout.
--
-- Runs after checkin.sql (tables exist). Self-contained + idempotent.
-- ===========================================================================

-- Validate a staff access code for an event. Returns the matching active role
-- ({ id, name, permissions, type }) for the event's project, or null. `p_type`
-- narrows to 'staff' or 'kiosk' — the AccessGate on each route passes its own,
-- so staff and kiosk codes are separate spaces (one can't unlock the other).
-- Left null (the default) for the internal callers below, which only need to
-- confirm a code is valid+active and don't care which type it is.
drop function if exists events.checkin_validate_code(uuid, text);
create or replace function events.checkin_validate_code(p_event uuid, p_code text, p_type text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_role record;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return null;
  end if;
  select project_id into v_project
    from events.events
    where id = p_event and deleted_at is null;
  if v_project is null then
    return null;
  end if;
  select id, name, permissions, type into v_role
    from events.checkin_staff_roles
    where project_id = v_project
      and access_code = p_code
      and active = true
      and deleted_at is null
      and (p_type is null or type = p_type)
    limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object('id', v_role.id, 'name', v_role.name, 'permissions', v_role.permissions, 'type', v_role.type);
end;
$$;

grant execute on function events.checkin_validate_code(uuid, text, text) to anon, authenticated;

-- Search an event's registrations by name / email / ticket code. Each row
-- carries checked_in (an `in` attendance row exists). Ticket code mirrors the
-- Phase-1 JS ticketCode(): first 8 hex of the id, upper-cased.
create or replace function events.checkin_search(p_event uuid, p_code text, p_query text)
returns table (
  registration_id uuid,
  name text,
  email text,
  ticket_code text,
  party_size integer,
  status text,
  checked_in boolean
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
begin
  if events.checkin_validate_code(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  return query
    select
      r.id,
      r.name,
      r.email,
      upper(substring(replace(r.id::text, '-', ''), 1, 8)) as ticket_code,
      r.party_size,
      r.status,
      exists (
        select 1 from events.checkin_attendance a
        where a.registration_id = r.id and a.status = 'in' and a.deleted_at is null
      ) as checked_in
    from events.registrations r
    where r.event_id = p_event
      and r.deleted_at is null
      and (
        p_query is null or p_query = ''
        or r.name ilike '%' || p_query || '%'
        or r.email ilike '%' || p_query || '%'
        or upper(substring(replace(r.id::text, '-', ''), 1, 8)) = upper(trim(p_query))
      )
    order by r.name
    limit 25;
end;
$$;

grant execute on function events.checkin_search(uuid, text, text) to anon, authenticated;

-- Admit an attendee. Validates the code, dedupes (a registration already `in`
-- returns already=true), else inserts an attendance row and returns { ok, id }.
create or replace function events.checkin_admit(
  p_event uuid,
  p_code text,
  p_registration uuid default null,
  p_order uuid default null,
  p_name text default '',
  p_ticket_code text default null,
  p_gate text default null,
  p_zone text default null,
  p_session text default null,
  p_method text default 'manual',
  p_staff text default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_id uuid;
begin
  if events.checkin_validate_code(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  select project_id into v_project from events.events where id = p_event;

  if p_registration is not null and exists (
    select 1 from events.checkin_attendance a
    where a.registration_id = p_registration and a.status = 'in' and a.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'already', true);
  end if;

  insert into events.checkin_attendance
    (event_id, project_id, registration_id, order_id, attendee_name, ticket_code,
     gate, zone, session_id, method, checked_in_by, status)
  values
    (p_event, v_project, p_registration, p_order, coalesce(p_name, ''),
     nullif(p_ticket_code, ''), nullif(p_gate, ''), nullif(p_zone, ''),
     nullif(p_session, ''), coalesce(nullif(p_method, ''), 'manual'),
     nullif(p_staff, ''), 'in')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'already', false, 'id', v_id);
end;
$$;

grant execute on function events.checkin_admit(uuid, text, uuid, uuid, text, text, text, text, text, text, text)
  to anon, authenticated;

-- Live counts for a route's header: checked-in (distinct registrations `in`)
-- and expected (confirmed/checked-in registrations).
create or replace function events.checkin_stats(p_event uuid, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_in integer;
  v_expected integer;
begin
  if events.checkin_validate_code(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  select count(distinct coalesce(a.registration_id::text, a.id::text)) into v_in
    from events.checkin_attendance a
    where a.event_id = p_event and a.status = 'in' and a.deleted_at is null;
  select count(*) into v_expected
    from events.registrations r
    where r.event_id = p_event and r.deleted_at is null
      and r.status in ('Confirmed', 'Checked-in');
  return jsonb_build_object('checkedIn', coalesce(v_in, 0), 'expected', coalesce(v_expected, 0));
end;
$$;

grant execute on function events.checkin_stats(uuid, text) to anon, authenticated;
