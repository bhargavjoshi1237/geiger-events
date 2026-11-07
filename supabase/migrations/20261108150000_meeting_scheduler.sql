-- @up
-- Meeting Scheduler: attendee 1:1 networking (per-event settings, attendee profiles, meeting requests, booked meetings).
-- Double-booking is refused in the database: a guard trigger re-checks every scheduled meeting under a per-event
-- advisory lock, and the booking RPCs allocate a location under that same lock.
-- Members reach this through the portal API (service role); organisers through RLS and the RPCs below.

create schema if not exists events;

-- Per-event settings ---------------------------------------------------------
create table if not exists events.meeting_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  enabled boolean not null default false,
  -- When attendees may send and accept requests (null = no limit).
  opens_at timestamptz,
  closes_at timestamptz,
  slot_minutes integer not null default 20 check (slot_minutes between 5 and 240),
  buffer_minutes integer not null default 5 check (buffer_minutes between 0 and 120),
  -- [{ date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM", agendaDay: "Day 1 · Tue" }] in the event's timezone.
  days jsonb not null default '[]'::jsonb,
  exclude_sessions boolean not null default true,
  -- [{ id, name, capacity }]: tables, booths or rooms; capacity = meetings that can run there at once.
  locations jsonb not null default '[]'::jsonb,
  max_meetings integer check (max_meetings is null or max_meetings > 0),
  request_scope text not null default 'opted_in' check (request_scope in ('all', 'opted_in', 'exhibitors')),
  require_acceptance boolean not null default true,
  message_max_length integer not null default 500 check (message_max_length between 0 and 4000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists meeting_settings_event_key on events.meeting_settings (event_id);
create index if not exists meeting_settings_project_idx
  on events.meeting_settings (project_id) where deleted_at is null;

-- Attendee networking profiles (one per event + portal member) -----------------
create table if not exists events.meeting_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  member_id uuid not null references events.portal_members(id) on delete cascade,
  email text not null default '',
  opted_in boolean not null default false,
  role text not null default 'attendee' check (role in ('attendee', 'exhibitor')),
  display_name text not null default '',
  company text not null default '',
  title text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  looking_for text[] not null default '{}',
  avatar_url text,
  -- [{ start, end }] ISO instants the attendee can't meet.
  blocked_slots jsonb not null default '[]'::jsonb,
  -- Organiser moderation: a hidden profile leaves the directory and can't send requests.
  hidden boolean not null default false,
  hidden_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists meeting_profiles_event_member_key
  on events.meeting_profiles (event_id, member_id);
create index if not exists meeting_profiles_directory_idx
  on events.meeting_profiles (event_id) where deleted_at is null and opted_in and not hidden;
create index if not exists meeting_profiles_project_idx
  on events.meeting_profiles (project_id) where deleted_at is null;

-- Meeting requests ---------------------------------------------------------------
create table if not exists events.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  from_member uuid not null references events.portal_members(id) on delete cascade,
  to_member uuid not null references events.portal_members(id) on delete cascade,
  -- [{ start, end }] ISO instants the sender offered.
  proposed_slots jsonb not null default '[]'::jsonb,
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  responded_at timestamptz,
  decline_note text not null default '',
  cancelled_by text check (cancelled_by in ('sender', 'organiser')),
  -- After this the request lapses (its last proposed slot, or the booking window closing).
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_member <> to_member)
);

-- One open request per sender and recipient.
create unique index if not exists meeting_requests_pending_pair_key
  on events.meeting_requests (event_id, from_member, to_member)
  where status = 'pending' and deleted_at is null;
create index if not exists meeting_requests_to_idx
  on events.meeting_requests (event_id, to_member) where deleted_at is null;
create index if not exists meeting_requests_from_idx
  on events.meeting_requests (event_id, from_member) where deleted_at is null;
create index if not exists meeting_requests_project_idx
  on events.meeting_requests (project_id) where deleted_at is null;

-- Booked meetings ----------------------------------------------------------------
create table if not exists events.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  -- Null when the organiser booked it directly.
  request_id uuid references events.meeting_requests(id) on delete set null,
  -- Portal member ids (2 for a 1:1).
  participants uuid[] not null check (cardinality(participants) >= 2),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- An id from meeting_settings.locations; the name is snapshotted for display.
  location_id text,
  location_name text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed', 'no_show')),
  notes text not null default '',
  cancel_reason text not null default '',
  cancelled_by text check (cancelled_by in ('member', 'organiser')),
  cancelled_member uuid,
  rescheduled_at timestamptz,
  -- Bearer secret for the emailed add-to-calendar link.
  calendar_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create unique index if not exists meetings_calendar_token_key on events.meetings (calendar_token);
create unique index if not exists meetings_request_key
  on events.meetings (request_id)
  where request_id is not null and deleted_at is null and status <> 'cancelled';
create index if not exists meetings_event_time_idx
  on events.meetings (event_id, starts_at) where deleted_at is null;
create index if not exists meetings_participants_idx on events.meetings using gin (participants);
create index if not exists meetings_project_idx
  on events.meetings (project_id) where deleted_at is null;

-- Touch triggers -----------------------------------------------------------------
drop trigger if exists meeting_settings_touch on events.meeting_settings;
create trigger meeting_settings_touch before update on events.meeting_settings
  for each row execute function events.touch_updated_at();
drop trigger if exists meeting_profiles_touch on events.meeting_profiles;
create trigger meeting_profiles_touch before update on events.meeting_profiles
  for each row execute function events.touch_updated_at();
drop trigger if exists meeting_requests_touch on events.meeting_requests;
create trigger meeting_requests_touch before update on events.meeting_requests
  for each row execute function events.touch_updated_at();
drop trigger if exists meetings_touch on events.meetings;
create trigger meetings_touch before update on events.meetings
  for each row execute function events.touch_updated_at();

-- Rows always inherit their event's project, so an organiser can't file rows against another project's event.
create or replace function events.meeting_event_project()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  new.project_id := (select e.project_id from events.events e where e.id = new.event_id);
  if new.project_id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke all on function events.meeting_event_project() from public, anon, authenticated;

drop trigger if exists meeting_settings_project on events.meeting_settings;
create trigger meeting_settings_project before insert or update of event_id, project_id on events.meeting_settings
  for each row execute function events.meeting_event_project();
drop trigger if exists meeting_profiles_project on events.meeting_profiles;
create trigger meeting_profiles_project before insert or update of event_id, project_id on events.meeting_profiles
  for each row execute function events.meeting_event_project();
drop trigger if exists meeting_requests_project on events.meeting_requests;
create trigger meeting_requests_project before insert or update of event_id, project_id on events.meeting_requests
  for each row execute function events.meeting_event_project();
drop trigger if exists meetings_project on events.meetings;
create trigger meetings_project before insert or update of event_id, project_id on events.meetings
  for each row execute function events.meeting_event_project();

-- RLS: organisers via project membership; members only through the service-role portal API.
alter table events.meeting_settings enable row level security;
alter table events.meeting_profiles enable row level security;
alter table events.meeting_requests enable row level security;
alter table events.meetings enable row level security;

drop policy if exists meeting_settings_member_all on events.meeting_settings;
create policy meeting_settings_member_all on events.meeting_settings
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists meeting_profiles_member_all on events.meeting_profiles;
create policy meeting_profiles_member_all on events.meeting_profiles
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists meeting_requests_member_all on events.meeting_requests;
create policy meeting_requests_member_all on events.meeting_requests
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists meetings_member_all on events.meetings;
create policy meetings_member_all on events.meetings
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.meeting_settings to authenticated;
grant select, insert, update, delete on events.meeting_profiles to authenticated;
grant select, insert, update, delete on events.meeting_requests to authenticated;
grant select, insert, update, delete on events.meetings to authenticated;

-- Helpers --------------------------------------------------------------------------
-- Serialises every booking change for one event.
create or replace function events.meeting_lock(p_event uuid)
returns void
language sql
security definer
set search_path = events, public
as $$
  select pg_advisory_xact_lock(hashtextextended('events.meetings:' || p_event::text, 0));
$$;

-- Capacity of a configured location (null = not configured). Malformed capacities count as 1.
create or replace function events.meeting_location_capacity(p_event uuid, p_location text)
returns integer
language sql
stable
security definer
set search_path = events, public
as $$
  select greatest(
           case when (l->>'capacity') ~ '^\d{1,6}$' then (l->>'capacity')::integer else 1 end,
           1)
  from events.meeting_settings s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.locations) = 'array' then s.locations else '[]'::jsonb end) l
  where s.event_id = p_event and l->>'id' = p_location
  limit 1;
$$;

-- Guard: a scheduled meeting may not overlap another of any participant's (respecting the buffer),
-- and a location may not run more meetings at once than its capacity. Runs for every write path.
create or replace function events.meetings_guard()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_buffer integer;
  v_capacity integer;
  v_used integer;
begin
  if new.status <> 'scheduled' or new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'scheduled' and old.deleted_at is null
       and new.starts_at = old.starts_at and new.ends_at = old.ends_at
       and new.participants = old.participants
       and new.location_id is not distinct from old.location_id then
      return new;
    end if;
  end if;

  perform events.meeting_lock(new.event_id);

  select coalesce(s.buffer_minutes, 0) into v_buffer
    from events.meeting_settings s where s.event_id = new.event_id;
  v_buffer := coalesce(v_buffer, 0);

  if exists (
    select 1 from events.meetings m
    where m.event_id = new.event_id
      and m.id <> new.id
      and m.status = 'scheduled'
      and m.deleted_at is null
      and m.participants && new.participants
      and m.starts_at < new.ends_at + make_interval(mins => v_buffer)
      and new.starts_at < m.ends_at + make_interval(mins => v_buffer)
  ) then
    raise exception 'PERSON_BUSY' using hint = 'A participant already has a meeting at that time.';
  end if;

  if new.location_id is not null then
    v_capacity := events.meeting_location_capacity(new.event_id, new.location_id);
    if v_capacity is null then
      raise exception 'UNKNOWN_LOCATION' using hint = 'That location is not configured for this event.';
    end if;
    select count(*) into v_used
      from events.meetings m
      where m.event_id = new.event_id
        and m.id <> new.id
        and m.status = 'scheduled'
        and m.deleted_at is null
        and m.location_id = new.location_id
        and m.starts_at < new.ends_at
        and new.starts_at < m.ends_at;
    if v_used >= v_capacity then
      raise exception 'LOCATION_FULL' using hint = 'That location is fully booked at that time.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists meetings_guard on events.meetings;
create trigger meetings_guard before insert or update on events.meetings
  for each row execute function events.meetings_guard();

-- First configured location with room for the slot; null when the event has no locations.
create or replace function events.meeting_pick_location(
  p_event uuid, p_starts timestamptz, p_ends timestamptz, p_exclude uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_loc jsonb;
  v_any boolean := false;
  v_capacity integer;
  v_used integer;
begin
  for v_loc in
    select l.value
      from events.meeting_settings s
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.locations) = 'array' then s.locations else '[]'::jsonb end
      ) with ordinality as l(value, ord)
      where s.event_id = p_event and coalesce(l.value->>'id', '') <> ''
      order by l.ord
  loop
    v_any := true;
    v_capacity := events.meeting_location_capacity(p_event, v_loc->>'id');
    select count(*) into v_used
      from events.meetings m
      where m.event_id = p_event
        and (p_exclude is null or m.id <> p_exclude)
        and m.status = 'scheduled'
        and m.deleted_at is null
        and m.location_id = v_loc->>'id'
        and m.starts_at < p_ends
        and p_starts < m.ends_at;
    if v_used < coalesce(v_capacity, 1) then
      return v_loc->>'id';
    end if;
  end loop;
  if v_any then
    raise exception 'NO_LOCATION' using hint = 'Every meeting location is booked at that time.';
  end if;
  return null;
end;
$$;

-- Books a meeting under the event lock. p_enforce applies the attendee-facing rules
-- (networking on, blocked slots, per-attendee cap); organisers book with it off.
create or replace function events.meeting_book(
  p_event uuid,
  p_participants uuid[],
  p_starts timestamptz,
  p_ends timestamptz,
  p_location text,
  p_request uuid,
  p_notes text,
  p_created_by uuid,
  p_enforce boolean)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_settings events.meeting_settings%rowtype;
  v_people uuid[];
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_name text := '';
  v_member uuid;
  v_count integer;
  v_id uuid;
begin
  select array_agg(distinct x) into v_people from unnest(p_participants) x where x is not null;
  if coalesce(cardinality(v_people), 0) < 2 then
    raise exception 'NEED_TWO_PEOPLE';
  end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'INVALID_SLOT';
  end if;

  select project_id into v_project from events.events where id = p_event and deleted_at is null;
  if v_project is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  perform events.meeting_lock(p_event);
  select * into v_settings from events.meeting_settings where event_id = p_event;

  if p_enforce then
    if v_settings.id is null or not v_settings.enabled or v_settings.deleted_at is not null then
      raise exception 'MEETINGS_DISABLED';
    end if;
    if exists (
      select 1
        from events.meeting_profiles p
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(p.blocked_slots) = 'array' then p.blocked_slots else '[]'::jsonb end) b
        where p.event_id = p_event
          and p.member_id = any (v_people)
          and p.deleted_at is null
          and (b->>'start')::timestamptz < p_ends
          and p_starts < (b->>'end')::timestamptz
    ) then
      raise exception 'PERSON_BLOCKED';
    end if;
    if v_settings.max_meetings is not null then
      foreach v_member in array v_people loop
        select count(*) into v_count
          from events.meetings m
          where m.event_id = p_event
            and m.status = 'scheduled'
            and m.deleted_at is null
            and v_member = any (m.participants);
        if v_count >= v_settings.max_meetings then
          raise exception 'LIMIT_REACHED';
        end if;
      end loop;
    end if;
  end if;

  if v_location is null then
    v_location := events.meeting_pick_location(p_event, p_starts, p_ends, null);
  end if;
  if v_location is not null then
    select coalesce(l->>'name', '') into v_name
      from jsonb_array_elements(
        case when jsonb_typeof(v_settings.locations) = 'array' then v_settings.locations else '[]'::jsonb end) l
      where l->>'id' = v_location
      limit 1;
  end if;

  insert into events.meetings
    (project_id, event_id, request_id, participants, starts_at, ends_at, location_id, location_name, notes, created_by)
  values
    (v_project, p_event, p_request, v_people, p_starts, p_ends, v_location, coalesce(v_name, ''),
     coalesce(p_notes, ''), p_created_by)
  returning id into v_id;
  return v_id;
end;
$$;

-- Member accepts a request they received (called by the portal API with the service role).
create or replace function events.accept_meeting_request(
  p_request uuid, p_member uuid, p_starts timestamptz, p_ends timestamptz)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  r events.meeting_requests%rowtype;
  v_id uuid;
begin
  select * into r from events.meeting_requests
    where id = p_request and deleted_at is null
    for update;
  if r.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.to_member <> p_member then
    raise exception 'FORBIDDEN';
  end if;
  if r.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;
  v_id := events.meeting_book(
    r.event_id, array[r.from_member, r.to_member], p_starts, p_ends, null, r.id, '', null, true);
  update events.meeting_requests
    set status = 'accepted', responded_at = now()
    where id = r.id;
  return v_id;
end;
$$;

-- Organiser books a meeting for two attendees, or force-schedules an open request.
create or replace function events.create_meeting(
  p_event uuid,
  p_participants uuid[],
  p_starts timestamptz,
  p_ends timestamptz,
  p_location text default null,
  p_notes text default '',
  p_request uuid default null)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  r events.meeting_requests%rowtype;
  v_people uuid[] := p_participants;
  v_id uuid;
begin
  select project_id into v_project from events.events where id = p_event and deleted_at is null;
  if v_project is null or not events.can_access_project(v_project) then
    raise exception 'FORBIDDEN';
  end if;
  if p_request is not null then
    select * into r from events.meeting_requests
      where id = p_request and event_id = p_event and deleted_at is null
      for update;
    if r.id is null then
      raise exception 'REQUEST_NOT_FOUND';
    end if;
    if r.status not in ('pending', 'expired') then
      raise exception 'NOT_PENDING';
    end if;
    v_people := array[r.from_member, r.to_member];
  end if;
  if exists (
    select 1 from unnest(v_people) x
    where x is not null and not exists (select 1 from events.portal_members m where m.id = x)
  ) then
    raise exception 'UNKNOWN_ATTENDEE';
  end if;
  v_id := events.meeting_book(
    p_event, v_people, p_starts, p_ends, p_location, p_request, p_notes, auth.uid(), false);
  if p_request is not null then
    update events.meeting_requests
      set status = 'accepted', responded_at = now()
      where id = p_request;
  end if;
  return v_id;
end;
$$;

-- Organiser moves a scheduled meeting; a null location re-allocates one.
create or replace function events.reschedule_meeting(
  p_meeting uuid, p_starts timestamptz, p_ends timestamptz, p_location text default null)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  m events.meetings%rowtype;
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_name text := '';
begin
  select * into m from events.meetings where id = p_meeting and deleted_at is null for update;
  if m.id is null then
    raise exception 'MEETING_NOT_FOUND';
  end if;
  if not events.can_access_project(m.project_id) then
    raise exception 'FORBIDDEN';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'NOT_SCHEDULED';
  end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'INVALID_SLOT';
  end if;

  perform events.meeting_lock(m.event_id);
  if v_location is null then
    v_location := events.meeting_pick_location(m.event_id, p_starts, p_ends, m.id);
  end if;
  if v_location is not null then
    select coalesce(l->>'name', '') into v_name
      from events.meeting_settings s
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.locations) = 'array' then s.locations else '[]'::jsonb end) l
      where s.event_id = m.event_id and l->>'id' = v_location
      limit 1;
  end if;

  update events.meetings
    set starts_at = p_starts,
        ends_at = p_ends,
        location_id = v_location,
        location_name = coalesce(v_name, ''),
        rescheduled_at = now()
    where id = m.id;
  return m.id;
end;
$$;

-- Valid ticket holders of an event as portal members (organisers, and the portal's service role).
create or replace function events.meeting_attendees(p_event uuid)
returns table (member_id uuid, name text, email text, ticket_name text)
language sql
stable
security definer
set search_path = events, public
as $$
  select distinct on (m.id)
         m.id,
         coalesce(nullif(btrim(o.buyer_name), ''), nullif(btrim(m.name), ''), split_part(m.email, '@', 1)),
         m.email,
         coalesce(o.ticket_name, '')
    from events.event_orders o
    join events.events e on e.id = o.event_id
    join events.portal_members m on lower(m.email) = lower(btrim(o.buyer_email))
    where o.event_id = p_event
      and o.cancelled_at is null
      and coalesce(o.status, 'confirmed') not in ('cancelled', 'refunded')
      and not (coalesce(o.total, 0) > 0 and coalesce(o.refunded_total, 0) >= o.total)
      and (
        coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
        or events.can_access_project(e.project_id)
      )
    order by m.id, o.created_at desc;
$$;

revoke all on function events.meeting_lock(uuid) from public, anon, authenticated;
revoke all on function events.meeting_location_capacity(uuid, text) from public, anon, authenticated;
revoke all on function events.meetings_guard() from public, anon, authenticated;
revoke all on function events.meeting_pick_location(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function events.meeting_book(uuid, uuid[], timestamptz, timestamptz, text, uuid, text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function events.accept_meeting_request(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function events.create_meeting(uuid, uuid[], timestamptz, timestamptz, text, text, uuid) from public, anon;
revoke all on function events.reschedule_meeting(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function events.meeting_attendees(uuid) from public, anon;

grant execute on function events.accept_meeting_request(uuid, uuid, timestamptz, timestamptz) to service_role;
grant execute on function events.create_meeting(uuid, uuid[], timestamptz, timestamptz, text, text, uuid) to authenticated;
grant execute on function events.reschedule_meeting(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function events.meeting_attendees(uuid) to authenticated, service_role;

-- @down
drop function if exists events.meeting_attendees(uuid);
drop function if exists events.reschedule_meeting(uuid, timestamptz, timestamptz, text);
drop function if exists events.create_meeting(uuid, uuid[], timestamptz, timestamptz, text, text, uuid);
drop function if exists events.accept_meeting_request(uuid, uuid, timestamptz, timestamptz);
drop function if exists events.meeting_book(uuid, uuid[], timestamptz, timestamptz, text, uuid, text, uuid, boolean);
drop function if exists events.meeting_pick_location(uuid, timestamptz, timestamptz, uuid);
drop trigger if exists meetings_guard on events.meetings;
drop function if exists events.meetings_guard();
drop function if exists events.meeting_location_capacity(uuid, text);
drop function if exists events.meeting_lock(uuid);
drop table if exists events.meetings;
drop table if exists events.meeting_requests;
drop table if exists events.meeting_profiles;
drop table if exists events.meeting_settings;
drop function if exists events.meeting_event_project();
