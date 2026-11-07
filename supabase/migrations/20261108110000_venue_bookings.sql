-- @up
-- Instant Book: bookable venue spaces (rate card, opening hours, blackouts) and events.venue_bookings.
-- Bookings are only written through book_venue_space / confirm_venue_booking / cancel_venue_booking, which
-- lock the space row, re-check rules and clashes, and price server-side from the stored rates. Confirmed
-- bookings are also guarded by an exclusion constraint; expired holds simply stop blocking (no job runner).

create schema if not exists events;
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Booking setup on the shared venue_spaces table (20261108090000_venue_spaces.sql).
alter table events.venue_spaces add column if not exists bookable boolean not null default false;
alter table events.venue_spaces add column if not exists rate_hourly numeric(12, 2);
alter table events.venue_spaces add column if not exists rate_half_day numeric(12, 2);
alter table events.venue_spaces add column if not exists rate_full_day numeric(12, 2);
alter table events.venue_spaces add column if not exists rate_currency text not null default 'GBP';
alter table events.venue_spaces add column if not exists min_hours numeric(5, 2) not null default 1;
alter table events.venue_spaces add column if not exists buffer_minutes integer not null default 0;
-- {"mon": {"open": "08:00", "close": "22:00"}, "sun": {"closed": true}}; {} = open around the clock.
alter table events.venue_spaces add column if not exists opening_hours jsonb not null default '{}'::jsonb;
-- [{"from": "2026-12-24", "to": "2026-12-26", "reason": "Christmas"}]
alter table events.venue_spaces add column if not exists blackout_dates jsonb not null default '[]'::jsonb;

create index if not exists venue_spaces_bookable_idx
  on events.venue_spaces (project_id)
  where deleted_at is null and bookable;

create table if not exists events.venue_bookings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  venue_id uuid not null references events.venues(id) on delete cascade,
  space_id uuid not null references events.venue_spaces(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  reference text not null,
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- ends_at plus the space's turnover buffer at booking time; the clash range is [starts_at, blocked_until).
  blocked_until timestamptz not null,
  status text not null default 'confirmed' check (status in ('hold', 'confirmed', 'cancelled')),
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  setup_style text not null default '',
  attendees integer not null default 0 check (attendees >= 0),
  timezone text not null default 'UTC',
  rate_snapshot jsonb not null default '{}'::jsonb,
  price_breakdown jsonb not null default '{}'::jsonb,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'GBP',
  booked_by uuid,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  notes text not null default '',
  cancelled_at timestamptz,
  cancel_reason text not null default '',
  cancelled_by uuid,
  -- Bearer secret for the logged-out .ics download linked from booking emails.
  public_token uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint venue_bookings_range_check check (ends_at > starts_at and blocked_until >= ends_at),
  constraint venue_bookings_no_overlap exclude using gist (
    space_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status = 'confirmed' and deleted_at is null)
);

create unique index if not exists venue_bookings_reference_idx on events.venue_bookings (reference);
create unique index if not exists venue_bookings_token_idx on events.venue_bookings (public_token);
create index if not exists venue_bookings_project_idx
  on events.venue_bookings (project_id, starts_at desc)
  where deleted_at is null;
create index if not exists venue_bookings_space_idx
  on events.venue_bookings (space_id, starts_at)
  where deleted_at is null and status <> 'cancelled';
create index if not exists venue_bookings_event_idx
  on events.venue_bookings (event_id)
  where deleted_at is null and event_id is not null;

drop trigger if exists venue_bookings_touch on events.venue_bookings;
create trigger venue_bookings_touch
  before update on events.venue_bookings
  for each row execute function events.touch_updated_at();

alter table events.venue_bookings enable row level security;

drop policy if exists venue_bookings_member_all on events.venue_bookings;
create policy venue_bookings_member_all on events.venue_bookings
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Schema default privileges grant everything; members may read and edit descriptive fields only.
revoke all on events.venue_bookings from anon, authenticated;
grant select on events.venue_bookings to authenticated;
grant update (title, event_id, contact_name, contact_email, contact_phone, notes, metadata)
  on events.venue_bookings to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by clients)
-- ---------------------------------------------------------------------------

create or replace function events.venue_booking_try_date(p_value text)
returns date
language plpgsql
immutable
as $$
begin
  if coalesce(p_value, '') !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

-- "HH:MM" -> minutes since midnight ("24:00" = 1440), or the fallback.
create or replace function events.venue_booking_minutes(p_value text, p_fallback integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_parts text[];
  v_h integer;
  v_m integer;
begin
  v_parts := regexp_match(btrim(coalesce(p_value, '')), '^(\d{1,2}):(\d{2})$');
  if v_parts is null then
    return p_fallback;
  end if;
  v_h := v_parts[1]::integer;
  v_m := v_parts[2]::integer;
  if v_h > 24 or v_m > 59 or (v_h = 24 and v_m > 0) then
    return p_fallback;
  end if;
  return v_h * 60 + v_m;
end;
$$;

create or replace function events.venue_booking_tz(p_tz text)
returns text
language sql
stable
as $$
  select coalesce((select name from pg_timezone_names where name = p_tz limit 1), 'UTC');
$$;

create or replace function events.venue_booking_code(p_len integer default 6)
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::integer, 1), '')
  from generate_series(1, greatest(p_len, 4));
$$;

-- Cheapest of one full day, or n half-day (4 h) blocks plus hourly; mirrors lib/venue_booking/pricing.js.
create or replace function events.venue_booking_price_day(
  p_hours numeric,
  p_hourly numeric,
  p_half numeric,
  p_full numeric
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_best numeric;
  v_items jsonb := '[]'::jsonb;
  v_max integer;
  v_rem numeric;
  v_amt numeric;
begin
  if coalesce(p_hours, 0) <= 0 then
    return jsonb_build_object('amount', 0, 'items', '[]'::jsonb);
  end if;
  if p_full is not null then
    v_best := p_full;
    v_items := jsonb_build_array(jsonb_build_object('kind', 'full_day', 'qty', 1, 'unit', p_full, 'amount', p_full));
  end if;
  v_max := case when p_half is not null then ceil(p_hours / 4.0)::integer else 0 end;
  for v_n in 0..v_max loop
    v_rem := greatest(0, p_hours - 4 * v_n);
    continue when v_rem > 0 and p_hourly is null;
    continue when v_n = 0 and v_rem = 0;
    v_amt := v_n * coalesce(p_half, 0) + v_rem * coalesce(p_hourly, 0);
    if v_best is null or v_amt < v_best then
      v_best := v_amt;
      v_items := '[]'::jsonb;
      if v_n > 0 then
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'kind', 'half_day', 'qty', v_n, 'unit', p_half, 'amount', round(v_n * p_half, 2)));
      end if;
      if v_rem > 0 then
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'kind', 'hourly', 'qty', v_rem, 'unit', p_hourly, 'amount', round(v_rem * p_hourly, 2)));
      end if;
    end if;
  end loop;
  return jsonb_build_object('amount', round(coalesce(v_best, 0), 2), 'items', v_items);
end;
$$;

-- Validates a slot against the space's rules (venue-local days) and prices it; mirrors evaluateSlot().
create or replace function events.venue_booking_evaluate(
  p_space events.venue_spaces,
  p_tz text,
  p_starts timestamptz,
  p_ends timestamptz
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_keys constant text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_plural constant text[] := array['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  v_hours jsonb := coalesce(p_space.opening_hours, '{}'::jsonb);
  v_ls timestamp := p_starts at time zone p_tz;
  v_le timestamp := p_ends at time zone p_tz;
  v_first date;
  v_last date;
  v_day date;
  v_dow integer;
  v_win jsonb;
  v_open integer;
  v_close integer;
  v_seg_start integer;
  v_seg_end integer;
  v_billh numeric;
  v_price jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_total_hours numeric := 0;
  v_blackout jsonb;
begin
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RANGE', 'message', 'The end time must be after the start time.');
  end if;
  if extract(epoch from (p_ends - p_starts)) / 3600.0 < coalesce(p_space.min_hours, 0) then
    return jsonb_build_object('ok', false, 'code', 'BELOW_MINIMUM',
      'message', format('This space has a %s-hour minimum.', trim(trailing '.' from trim(trailing '0' from p_space.min_hours::text))));
  end if;

  v_first := v_ls::date;
  v_last := (v_le - interval '1 microsecond')::date;
  v_day := v_first;
  while v_day <= v_last loop
    v_dow := extract(dow from v_day)::integer;

    select b into v_blackout
    from jsonb_array_elements(case when jsonb_typeof(p_space.blackout_dates) = 'array' then p_space.blackout_dates else '[]'::jsonb end) b
    where events.venue_booking_try_date(b ->> 'from') is not null
      and v_day between events.venue_booking_try_date(b ->> 'from')
        and coalesce(events.venue_booking_try_date(b ->> 'to'), events.venue_booking_try_date(b ->> 'from'))
    limit 1;
    if v_blackout is not null then
      return jsonb_build_object('ok', false, 'code', 'BLACKOUT',
        'message', format('Unavailable on %s%s.', v_day, case when coalesce(v_blackout ->> 'reason', '') <> '' then ' (' || (v_blackout ->> 'reason') || ')' else '' end));
    end if;

    -- A missing day is open around the clock; a JSON null or {"closed": true} is closed.
    v_win := case when jsonb_typeof(v_hours) = 'object' then v_hours -> v_keys[v_dow + 1] end;
    if v_win is null then
      v_open := 0;
      v_close := 1440;
    else
      if jsonb_typeof(v_win) <> 'object' or (v_win ->> 'closed') = 'true' then
        v_open := null;
      else
        v_open := events.venue_booking_minutes(v_win ->> 'open', 0);
        v_close := events.venue_booking_minutes(v_win ->> 'close', 1440);
        if v_close <= v_open then
          v_open := null;
        end if;
      end if;
    end if;
    if v_open is null then
      return jsonb_build_object('ok', false, 'code', 'CLOSED', 'message', format('Closed on %s.', v_plural[v_dow + 1]));
    end if;

    v_seg_start := case when v_day = v_first then floor(extract(epoch from (v_ls - v_day::timestamp)) / 60)::integer else 0 end;
    v_seg_end := case when v_day = v_last then ceil(extract(epoch from (v_le - v_day::timestamp)) / 60)::integer else 1440 end;
    if v_day = v_first then
      if v_seg_start < v_open then
        return jsonb_build_object('ok', false, 'code', 'BEFORE_OPENING',
          'message', format('Opens at %s on %s.', to_char(make_time(v_open / 60, v_open % 60, 0), 'HH24:MI'), v_plural[v_dow + 1]));
      end if;
      if v_seg_start >= v_close then
        return jsonb_build_object('ok', false, 'code', 'AFTER_CLOSING', 'message', format('Closes at %s:%s on %s.',
          lpad((v_close / 60)::text, 2, '0'), lpad((v_close % 60)::text, 2, '0'), v_plural[v_dow + 1]));
      end if;
    end if;
    if v_day = v_last then
      if v_seg_end > v_close then
        return jsonb_build_object('ok', false, 'code', 'AFTER_CLOSING', 'message', format('Closes at %s:%s on %s.',
          lpad((v_close / 60)::text, 2, '0'), lpad((v_close % 60)::text, 2, '0'), v_plural[v_dow + 1]));
      end if;
      if v_seg_end <= v_open then
        return jsonb_build_object('ok', false, 'code', 'BEFORE_OPENING',
          'message', format('Opens at %s on %s.', to_char(make_time(v_open / 60, v_open % 60, 0), 'HH24:MI'), v_plural[v_dow + 1]));
      end if;
    end if;

    v_billh := ceil(greatest(0, least(v_seg_end, v_close) - greatest(v_seg_start, v_open)) / 30.0) / 2;
    v_price := events.venue_booking_price_day(v_billh, p_space.rate_hourly, p_space.rate_half_day, p_space.rate_full_day);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'date', to_char(v_day, 'YYYY-MM-DD'),
      'hours', v_billh,
      'amount', (v_price ->> 'amount')::numeric,
      'items', v_price -> 'items'));
    v_subtotal := v_subtotal + (v_price ->> 'amount')::numeric;
    v_total_hours := v_total_hours + v_billh;
    v_day := v_day + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'lines', v_lines,
    'hours', v_total_hours,
    'subtotal', round(v_subtotal, 2),
    'total', round(v_subtotal, 2));
end;
$$;

-- The first confirmed booking or live hold on the space overlapping [p_starts, p_until).
create or replace function events.venue_booking_clash(
  p_space_id uuid,
  p_starts timestamptz,
  p_until timestamptz,
  p_exclude uuid
)
returns events.venue_bookings
language sql
stable
as $$
  select b.*
  from events.venue_bookings b
  where b.space_id = p_space_id
    and b.deleted_at is null
    and b.id is distinct from p_exclude
    and (b.status = 'confirmed' or (b.status = 'hold' and b.hold_expires_at > now()))
    and b.starts_at < p_until
    and p_starts < b.blocked_until
  order by b.starts_at
  limit 1;
$$;

create or replace function events.venue_booking_clash_message(p_clash events.venue_bookings)
returns text
language sql
stable
as $$
  select format('Already %s %s – %s (%s).',
    case when p_clash.status = 'hold' then 'held' else 'booked' end,
    to_char(p_clash.starts_at at time zone p_clash.timezone, 'Dy DD Mon HH24:MI'),
    to_char(p_clash.ends_at at time zone p_clash.timezone, 'HH24:MI'),
    p_clash.reference);
$$;

revoke all on function events.venue_booking_try_date(text) from public, anon, authenticated;
revoke all on function events.venue_booking_minutes(text, integer) from public, anon, authenticated;
revoke all on function events.venue_booking_tz(text) from public, anon, authenticated;
revoke all on function events.venue_booking_code(integer) from public, anon, authenticated;
revoke all on function events.venue_booking_price_day(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function events.venue_booking_evaluate(events.venue_spaces, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function events.venue_booking_clash(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function events.venue_booking_clash_message(events.venue_bookings) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs. Each returns {ok, booking} or {ok: false, code, message}.
-- ---------------------------------------------------------------------------

drop function if exists events.book_venue_space(uuid, timestamptz, timestamptz, text, integer, uuid, text, text, integer, text, text, text, text);
create or replace function events.book_venue_space(
  p_space_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text default 'confirmed',
  p_hold_hours integer default 48,
  p_event_id uuid default null,
  p_title text default '',
  p_setup_style text default '',
  p_attendees integer default 0,
  p_contact_name text default '',
  p_contact_email text default '',
  p_contact_phone text default '',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_space events.venue_spaces%rowtype;
  v_venue events.venues%rowtype;
  v_tz text;
  v_eval jsonb;
  v_until timestamptz;
  v_clash events.venue_bookings%rowtype;
  v_cap integer;
  v_ref text;
  v_row events.venue_bookings%rowtype;
  v_status text := case when p_status = 'hold' then 'hold' else 'confirmed' end;
  v_hold_hours integer := least(greatest(coalesce(p_hold_hours, 48), 1), 336);
  v_style text := left(btrim(coalesce(p_setup_style, '')), 40);
begin
  -- The row lock serialises every booking of this space, so the clash check below can't race.
  select * into v_space
  from events.venue_spaces
  where id = p_space_id and deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'That space no longer exists.');
  end if;
  if not events.can_access_project(v_space.project_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not v_space.bookable then
    return jsonb_build_object('ok', false, 'code', 'NOT_BOOKABLE', 'message', 'This space isn''t open for Instant Book.');
  end if;

  select * into v_venue from events.venues where id = v_space.venue_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'That venue no longer exists.');
  end if;
  v_tz := events.venue_booking_tz(v_venue.timezone);

  if p_starts_at is null or p_starts_at < now() then
    return jsonb_build_object('ok', false, 'code', 'IN_PAST', 'message', 'That time has already passed.');
  end if;
  if p_event_id is not null and not exists (
    select 1 from events.events e
    where e.id = p_event_id and e.project_id = v_space.project_id and e.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'BAD_EVENT', 'message', 'That event isn''t in this project.');
  end if;
  if v_style <> '' and (v_space.capacities ->> v_style) ~ '^\d+$' then
    v_cap := (v_space.capacities ->> v_style)::integer;
    if v_cap > 0 and coalesce(p_attendees, 0) > v_cap then
      return jsonb_build_object('ok', false, 'code', 'OVER_CAPACITY', 'message', format('Holds %s in this setup.', v_cap));
    end if;
  end if;

  v_eval := events.venue_booking_evaluate(v_space, v_tz, p_starts_at, p_ends_at);
  if not coalesce((v_eval ->> 'ok')::boolean, false) then
    return v_eval;
  end if;

  v_until := p_ends_at + make_interval(mins => greatest(coalesce(v_space.buffer_minutes, 0), 0));
  select * into v_clash from events.venue_booking_clash(p_space_id, p_starts_at, v_until, null);
  if v_clash.id is not null then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', events.venue_booking_clash_message(v_clash));
  end if;

  loop
    v_ref := 'IB-' || events.venue_booking_code(6);
    exit when not exists (select 1 from events.venue_bookings where reference = v_ref);
  end loop;

  insert into events.venue_bookings (
    project_id, venue_id, space_id, event_id, reference, title,
    starts_at, ends_at, blocked_until, status, hold_expires_at, confirmed_at,
    setup_style, attendees, timezone, rate_snapshot, price_breakdown, subtotal, total, currency,
    booked_by, contact_name, contact_email, contact_phone, notes
  ) values (
    v_space.project_id, v_space.venue_id, v_space.id, p_event_id, v_ref, left(btrim(coalesce(p_title, '')), 200),
    p_starts_at, p_ends_at, v_until, v_status,
    case when v_status = 'hold' then now() + make_interval(hours => v_hold_hours) end,
    case when v_status = 'confirmed' then now() end,
    v_style, greatest(coalesce(p_attendees, 0), 0), v_tz,
    jsonb_build_object(
      'hourly', v_space.rate_hourly,
      'halfDay', v_space.rate_half_day,
      'fullDay', v_space.rate_full_day,
      'currency', v_space.rate_currency,
      'minHours', v_space.min_hours,
      'bufferMinutes', v_space.buffer_minutes),
    jsonb_build_object('lines', v_eval -> 'lines', 'hours', v_eval -> 'hours'),
    (v_eval ->> 'subtotal')::numeric, (v_eval ->> 'total')::numeric, coalesce(nullif(v_space.rate_currency, ''), 'GBP'),
    auth.uid(), left(btrim(coalesce(p_contact_name, '')), 200), left(lower(btrim(coalesce(p_contact_email, ''))), 320),
    left(btrim(coalesce(p_contact_phone, '')), 60), left(coalesce(p_notes, ''), 4000)
  )
  returning * into v_row;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_row));
end;
$$;

drop function if exists events.confirm_venue_booking(uuid);
create or replace function events.confirm_venue_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_row events.venue_bookings%rowtype;
  v_clash events.venue_bookings%rowtype;
begin
  select * into v_row from events.venue_bookings where id = p_booking_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'That booking no longer exists.');
  end if;
  if not events.can_access_project(v_row.project_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Same lock order as book_venue_space: space first, then the booking.
  perform 1 from events.venue_spaces where id = v_row.space_id for update;
  select * into v_row from events.venue_bookings where id = p_booking_id for update;

  if v_row.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'booking', to_jsonb(v_row));
  end if;
  if v_row.status <> 'hold' then
    return jsonb_build_object('ok', false, 'code', 'NOT_HOLD', 'message', 'Only a hold can be confirmed.');
  end if;
  if v_row.starts_at < now() then
    return jsonb_build_object('ok', false, 'code', 'IN_PAST', 'message', 'This booking''s start time has passed.');
  end if;

  -- An expired hold can still be confirmed while nobody else has taken the slot.
  select * into v_clash from events.venue_booking_clash(v_row.space_id, v_row.starts_at, v_row.blocked_until, v_row.id);
  if v_clash.id is not null then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', events.venue_booking_clash_message(v_clash));
  end if;

  update events.venue_bookings
  set status = 'confirmed', confirmed_at = now(), hold_expires_at = null
  where id = p_booking_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_row));
end;
$$;

drop function if exists events.cancel_venue_booking(uuid, text);
create or replace function events.cancel_venue_booking(p_booking_id uuid, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_row events.venue_bookings%rowtype;
begin
  select * into v_row from events.venue_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'That booking no longer exists.');
  end if;
  if not events.can_access_project(v_row.project_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'booking', to_jsonb(v_row));
  end if;

  update events.venue_bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = left(btrim(coalesce(p_reason, '')), 500),
      cancelled_by = auth.uid()
  where id = p_booking_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_row));
end;
$$;

revoke all on function events.book_venue_space(uuid, timestamptz, timestamptz, text, integer, uuid, text, text, integer, text, text, text, text) from public, anon;
revoke all on function events.confirm_venue_booking(uuid) from public, anon;
revoke all on function events.cancel_venue_booking(uuid, text) from public, anon;
grant execute on function events.book_venue_space(uuid, timestamptz, timestamptz, text, integer, uuid, text, text, integer, text, text, text, text) to authenticated;
grant execute on function events.confirm_venue_booking(uuid) to authenticated;
grant execute on function events.cancel_venue_booking(uuid, text) to authenticated;

-- @down
drop function if exists events.cancel_venue_booking(uuid, text);
drop function if exists events.confirm_venue_booking(uuid);
drop function if exists events.book_venue_space(uuid, timestamptz, timestamptz, text, integer, uuid, text, text, integer, text, text, text, text);
drop function if exists events.venue_booking_clash_message(events.venue_bookings);
drop function if exists events.venue_booking_clash(uuid, timestamptz, timestamptz, uuid);
drop function if exists events.venue_booking_evaluate(events.venue_spaces, text, timestamptz, timestamptz);
drop function if exists events.venue_booking_price_day(numeric, numeric, numeric, numeric);
drop function if exists events.venue_booking_code(integer);
drop function if exists events.venue_booking_tz(text);
drop function if exists events.venue_booking_minutes(text, integer);
drop function if exists events.venue_booking_try_date(text);
drop table if exists events.venue_bookings;
drop index if exists events.venue_spaces_bookable_idx;
alter table events.venue_spaces drop column if exists blackout_dates;
alter table events.venue_spaces drop column if exists opening_hours;
alter table events.venue_spaces drop column if exists buffer_minutes;
alter table events.venue_spaces drop column if exists min_hours;
alter table events.venue_spaces drop column if exists rate_currency;
alter table events.venue_spaces drop column if exists rate_full_day;
alter table events.venue_spaces drop column if exists rate_half_day;
alter table events.venue_spaces drop column if exists rate_hourly;
alter table events.venue_spaces drop column if exists bookable;
