-- No @down section: the previous search/admit signatures are replaced, so this can't be rolled back.

-- @up
-- Check-in for ticket orders. Paid tickets live in event_orders, not registrations, so the scanner,
-- kiosk and badge QR codes (which encode the full order or registration id) found nothing.
-- checkin_search now covers orders and registrations by name, email, 8-character ticket code or full id;
-- checkin_admit admits either, refuses cancelled/refunded/waitlisted/pending/declined tickets,
-- and dedupes per session so a session scan isn't blocked by the door scan.
-- Paid checkout also files a registration under the buyer's email; the order is the ticket, so that
-- registration is hidden from search and not counted twice, and a check-in made through it still counts.

-- Does an order on this event cover this email? Paid checkout files a registration under the buyer's email.
create or replace function events.checkin_order_covers(p_event uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = events, public
as $$
  select coalesce(btrim(p_email), '') <> '' and exists (
    select 1 from events.event_orders o
    where o.event_id = p_event and lower(o.buyer_email) = lower(btrim(p_email))
  );
$$;

-- Is this order checked in (for a session, or the door when null), directly or through its companion registration?
create or replace function events.checkin_order_in(p_event uuid, p_order uuid, p_email text, p_session text)
returns boolean
language sql
stable
security definer
set search_path = events, public
as $$
  select exists (
    select 1 from events.checkin_attendance a
    where a.event_id = p_event and a.status = 'in' and a.deleted_at is null
      and a.session_id is not distinct from p_session
      and (
        a.order_id = p_order
        or (coalesce(btrim(p_email), '') <> '' and a.registration_id in (
          select r.id from events.registrations r
          where r.event_id = p_event and r.deleted_at is null and lower(r.email) = lower(btrim(p_email))
        ))
      )
  );
$$;

revoke all on function events.checkin_order_covers(uuid, text) from public, anon, authenticated;
revoke all on function events.checkin_order_in(uuid, uuid, text, text) from public, anon, authenticated;

drop function if exists events.checkin_search(uuid, text, text);
create or replace function events.checkin_search(p_event uuid, p_code text, p_query text, p_session text default null)
returns table (
  kind text,
  registration_id uuid,
  order_id uuid,
  name text,
  email text,
  ticket_code text,
  ticket_name text,
  party_size integer,
  status text,
  admissible boolean,
  checked_in boolean
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_code text := upper(btrim(coalesce(p_query, '')));
  v_hex text := lower(replace(btrim(coalesce(p_query, '')), '-', ''));
  v_session text := nullif(btrim(coalesce(p_session, '')), '');
begin
  if events.checkin_validate_code(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  return query
    select s.s_kind, s.s_registration, s.s_order, s.s_name, s.s_email, s.s_code, s.s_ticket,
           s.s_party, s.s_status, s.s_admissible, s.s_in
    from (
      select
        'registration'::text as s_kind,
        r.id as s_registration,
        null::uuid as s_order,
        coalesce(r.name, '') as s_name,
        coalesce(r.email, '') as s_email,
        upper(substring(replace(r.id::text, '-', ''), 1, 8)) as s_code,
        ''::text as s_ticket,
        greatest(1, coalesce(r.party_size, 1)) as s_party,
        coalesce(r.status, '') as s_status,
        coalesce(r.status, '') in ('Confirmed', 'Checked-in') as s_admissible,
        exists (
          select 1 from events.checkin_attendance a
          where a.registration_id = r.id and a.status = 'in' and a.deleted_at is null
            and a.session_id is not distinct from v_session
        ) as s_in
      from events.registrations r
      where r.event_id = p_event
        and r.deleted_at is null
        and not events.checkin_order_covers(p_event, r.email)
        and (
          v_q = ''
          or r.name ilike '%' || v_q || '%'
          or r.email ilike '%' || v_q || '%'
          or upper(substring(replace(r.id::text, '-', ''), 1, 8)) = v_code
          or replace(r.id::text, '-', '') = v_hex
        )
      union all
      select
        'order'::text,
        null::uuid,
        o.id,
        coalesce(o.buyer_name, ''),
        coalesce(o.buyer_email, ''),
        upper(substring(replace(o.id::text, '-', ''), 1, 8)),
        coalesce(o.ticket_name, ''),
        greatest(1, coalesce(o.quantity, 1)),
        case
          when o.cancelled_at is not null or o.status = 'cancelled' then 'Cancelled'
          when o.status = 'refunded' or (o.total > 0 and o.refunded_total >= o.total) then 'Refunded'
          else 'Confirmed'
        end,
        o.cancelled_at is null
          and coalesce(o.status, 'confirmed') not in ('cancelled', 'refunded')
          and not (o.total > 0 and o.refunded_total >= o.total),
        events.checkin_order_in(p_event, o.id, o.buyer_email, v_session)
      from events.event_orders o
      where o.event_id = p_event
        and (
          v_q = ''
          or o.buyer_name ilike '%' || v_q || '%'
          or o.buyer_email ilike '%' || v_q || '%'
          or upper(substring(replace(o.id::text, '-', ''), 1, 8)) = v_code
          or replace(o.id::text, '-', '') = v_hex
        )
    ) s
    order by s.s_name
    limit 25;
end;
$$;

grant execute on function events.checkin_search(uuid, text, text, text) to anon, authenticated;

-- Admit a registration or an order. Returns { ok, already, blocked, reason, id, name, party }.
drop function if exists events.checkin_admit(uuid, text, uuid, uuid, text, text, text, text, text, text, text);
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
  v_session text := nullif(btrim(coalesce(p_session, '')), '');
  v_name text := coalesce(p_name, '');
  v_party integer := 1;
  v_reg events.registrations;
  v_order events.event_orders;
begin
  if events.checkin_validate_code(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  select project_id into v_project from events.events where id = p_event;

  -- Serialise admits of the same ticket so two scanners can't both let it in.
  if coalesce(p_registration, p_order) is not null then
    perform pg_advisory_xact_lock(hashtext(coalesce(p_registration, p_order)::text || coalesce(v_session, '')));
  end if;

  if p_registration is not null then
    select * into v_reg from events.registrations
      where id = p_registration and event_id = p_event and deleted_at is null;
    if not found then
      return jsonb_build_object('ok', false, 'already', false, 'blocked', true, 'reason', 'not_found');
    end if;
    if coalesce(v_reg.status, '') not in ('Confirmed', 'Checked-in') then
      return jsonb_build_object('ok', false, 'already', false, 'blocked', true,
        'reason', lower(coalesce(v_reg.status, 'unknown')), 'name', v_reg.name);
    end if;
    if exists (
      select 1 from events.checkin_attendance a
      where a.registration_id = p_registration and a.status = 'in' and a.deleted_at is null
        and a.session_id is not distinct from v_session
    ) then
      return jsonb_build_object('ok', false, 'already', true, 'name', v_reg.name);
    end if;
    v_party := greatest(1, coalesce(v_reg.party_size, 1));
    if v_name = '' then v_name := coalesce(v_reg.name, ''); end if;
  elsif p_order is not null then
    select * into v_order from events.event_orders
      where id = p_order and event_id = p_event;
    if not found then
      return jsonb_build_object('ok', false, 'already', false, 'blocked', true, 'reason', 'not_found');
    end if;
    if v_order.cancelled_at is not null or v_order.status = 'cancelled' then
      return jsonb_build_object('ok', false, 'already', false, 'blocked', true, 'reason', 'cancelled', 'name', v_order.buyer_name);
    end if;
    if v_order.status = 'refunded' or (v_order.total > 0 and v_order.refunded_total >= v_order.total) then
      return jsonb_build_object('ok', false, 'already', false, 'blocked', true, 'reason', 'refunded', 'name', v_order.buyer_name);
    end if;
    if events.checkin_order_in(p_event, p_order, v_order.buyer_email, v_session) then
      return jsonb_build_object('ok', false, 'already', true, 'name', v_order.buyer_name);
    end if;
    v_party := greatest(1, coalesce(v_order.quantity, 1));
    if v_name = '' then v_name := coalesce(v_order.buyer_name, ''); end if;
  end if;

  insert into events.checkin_attendance
    (event_id, project_id, registration_id, order_id, attendee_name, ticket_code,
     gate, zone, session_id, method, checked_in_by, status, metadata)
  values
    (p_event, v_project, p_registration, p_order, v_name,
     nullif(p_ticket_code, ''), nullif(p_gate, ''), nullif(p_zone, ''),
     v_session, coalesce(nullif(p_method, ''), 'manual'),
     nullif(p_staff, ''), 'in', jsonb_build_object('party', v_party))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'already', false, 'id', v_id, 'name', v_name, 'party', v_party);
end;
$$;

grant execute on function events.checkin_admit(uuid, text, uuid, uuid, text, text, text, text, text, text, text)
  to anon, authenticated;

-- Header counts: tickets and registrations checked in at the door vs. those expected.
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
  select count(distinct coalesce(a.registration_id::text, a.order_id::text, a.id::text)) into v_in
    from events.checkin_attendance a
    where a.event_id = p_event and a.status = 'in' and a.deleted_at is null and a.session_id is null;
  select
    (select count(*) from events.registrations r
       where r.event_id = p_event and r.deleted_at is null and r.status in ('Confirmed', 'Checked-in')
         and not events.checkin_order_covers(p_event, r.email))
    + (select count(*) from events.event_orders o
       where o.event_id = p_event and o.cancelled_at is null
         and coalesce(o.status, 'confirmed') not in ('cancelled', 'refunded')
         and not (o.total > 0 and o.refunded_total >= o.total))
    into v_expected;
  return jsonb_build_object('checkedIn', coalesce(v_in, 0), 'expected', coalesce(v_expected, 0));
end;
$$;

grant execute on function events.checkin_stats(uuid, text) to anon, authenticated;

