-- @up
-- Offline check-in and capacity control.
-- checkin_attendance becomes an idempotent in/out ledger: client_id dedupes replays, device_id/admitted_offline/scanned_at record where and when a scan really happened.
-- Staff devices cache a code-gated snapshot (checkin_snapshot), admit offline into a local queue and replay it through checkin_sync; a ticket admitted on two devices becomes a checkin_conflicts row.
-- Zone and venue caps live in checkin_capacity; checkin_admit refuses at a hard cap unless a supervisor overrides with a reason (capacity_overrides).
-- An 'out' row is an exit; occupancy = party admitted minus party exited (zone_occupancy view). For an 'out' row checked_in_at is the exit time.

create schema if not exists events;

-- --- Attendance ledger columns ---------------------------------------------

alter table events.checkin_attendance add column if not exists client_id uuid;
alter table events.checkin_attendance add column if not exists device_id text;
alter table events.checkin_attendance add column if not exists admitted_offline boolean not null default false;
alter table events.checkin_attendance add column if not exists scanned_at timestamptz;
alter table events.checkin_attendance add column if not exists party_size integer not null default 1;
-- An offline admit that, once synced, took its zone past the hard cap.
alter table events.checkin_attendance add column if not exists over_capacity boolean not null default false;

-- checkin_admit has always written the party into metadata; lift it into the column occupancy counts.
update events.checkin_attendance
  set party_size = greatest(1, round((metadata->>'party')::numeric)::integer)
  where jsonb_typeof(metadata->'party') = 'number'
    and party_size = 1
    and (metadata->>'party')::numeric > 1;

create unique index if not exists checkin_attendance_client_idx
  on events.checkin_attendance (client_id)
  where client_id is not null;
create index if not exists checkin_attendance_event_reg_idx
  on events.checkin_attendance (event_id, registration_id)
  where deleted_at is null;
create index if not exists checkin_attendance_event_order_idx
  on events.checkin_attendance (event_id, order_id)
  where deleted_at is null;
create index if not exists checkin_attendance_event_zone_idx
  on events.checkin_attendance (event_id, (lower(coalesce(btrim(zone), ''))), status)
  where deleted_at is null;

-- --- Devices ------------------------------------------------------------------

-- One row per staff device per event, upserted whenever the device fetches a snapshot, syncs or heartbeats.
create table if not exists events.checkin_devices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  -- Client-generated, kept in the device's localStorage.
  device_id text not null,
  label text not null default '',
  -- checkin | door | kiosk
  route text not null default 'checkin',
  role_name text not null default '',
  app_version text not null default '',
  user_agent text not null default '',
  snapshot_count integer not null default 0,
  queued_count integer not null default 0,
  synced_total integer not null default 0,
  conflicts_total integer not null default 0,
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_snapshot_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists checkin_devices_event_device_idx
  on events.checkin_devices (event_id, device_id);
create index if not exists checkin_devices_project_idx
  on events.checkin_devices (project_id)
  where deleted_at is null;

drop trigger if exists checkin_devices_touch on events.checkin_devices;
create trigger checkin_devices_touch
  before update on events.checkin_devices
  for each row execute function events.touch_updated_at();

-- --- Conflicts ----------------------------------------------------------------

-- Offline admits the server could not simply accept. Duplicate kinds are never inserted as attendance; they wait here for review.
create table if not exists events.checkin_conflicts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  kind text not null default 'duplicate'
    check (kind in ('duplicate', 'reentry', 'over_capacity', 'invalid_ticket')),
  registration_id uuid,
  order_id uuid,
  attendee_name text not null default '',
  ticket_code text,
  session_id text,
  zone text,
  -- The admission that stands.
  first_attendance_id uuid,
  first_at timestamptz,
  first_gate text,
  first_device_id text,
  first_offline boolean not null default false,
  -- The admission that collided with it.
  client_id uuid,
  device_id text,
  gate text,
  method text,
  staff text,
  scanned_at timestamptz,
  -- over_capacity: the admitted attendance row and the count it reached.
  attendance_id uuid,
  occupancy integer,
  cap integer,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution in ('keep_first', 'reviewed')),
  note text not null default '',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists checkin_conflicts_client_idx
  on events.checkin_conflicts (client_id)
  where client_id is not null;
create index if not exists checkin_conflicts_event_idx
  on events.checkin_conflicts (event_id, status, created_at desc)
  where deleted_at is null;

drop trigger if exists checkin_conflicts_touch on events.checkin_conflicts;
create trigger checkin_conflicts_touch
  before update on events.checkin_conflicts
  for each row execute function events.touch_updated_at();

-- --- Sync log -----------------------------------------------------------------

-- One row per checkin_sync batch.
create table if not exists events.checkin_sync_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  device_id text not null default '',
  items integer not null default 0,
  admitted integer not null default 0,
  exited integer not null default 0,
  duplicates integer not null default 0,
  conflicts integer not null default 0,
  rejected integer not null default 0,
  over_capacity integer not null default 0,
  errors integer not null default 0,
  oldest_scan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists checkin_sync_log_event_idx
  on events.checkin_sync_log (event_id, created_at desc)
  where deleted_at is null;

drop trigger if exists checkin_sync_log_touch on events.checkin_sync_log;
create trigger checkin_sync_log_touch
  before update on events.checkin_sync_log
  for each row execute function events.touch_updated_at();

-- --- Capacity -----------------------------------------------------------------

-- Caps per event: zone_key '' is the whole venue (door admits, no session); otherwise the zone id from the event's checkinGates.
-- Admits match a zone by name (attendance stores the zone name), so zone_name is kept in step with the event's zone list.
create table if not exists events.checkin_capacity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  zone_key text not null default '',
  zone_name text not null default '',
  hard_cap integer check (hard_cap is null or hard_cap >= 0),
  warn_pct integer not null default 85 check (warn_pct between 1 and 100),
  -- inherit = the project's Check-in App re-entry setting.
  reentry text not null default 'inherit' check (reentry in ('inherit', 'once', 'multi')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists checkin_capacity_event_zone_idx
  on events.checkin_capacity (event_id, zone_key);
create index if not exists checkin_capacity_project_idx
  on events.checkin_capacity (project_id)
  where deleted_at is null;

drop trigger if exists checkin_capacity_touch on events.checkin_capacity;
create trigger checkin_capacity_touch
  before update on events.checkin_capacity
  for each row execute function events.touch_updated_at();

-- Supervisor admits past a hard cap.
create table if not exists events.capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  attendance_id uuid,
  zone text not null default '',
  registration_id uuid,
  order_id uuid,
  attendee_name text not null default '',
  party_size integer not null default 1,
  -- Occupancy before this admit, and the cap it went past.
  occupancy integer not null default 0,
  cap integer not null default 0,
  reason text not null default '',
  role_id uuid,
  role_name text not null default '',
  staff text,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists capacity_overrides_event_idx
  on events.capacity_overrides (event_id, created_at desc)
  where deleted_at is null;

drop trigger if exists capacity_overrides_touch on events.capacity_overrides;
create trigger capacity_overrides_touch
  before update on events.capacity_overrides
  for each row execute function events.touch_updated_at();

-- --- RLS: dashboard members read and manage; staff devices only go through the RPCs below ---

alter table events.checkin_devices enable row level security;
alter table events.checkin_conflicts enable row level security;
alter table events.checkin_sync_log enable row level security;
alter table events.checkin_capacity enable row level security;
alter table events.capacity_overrides enable row level security;

drop policy if exists checkin_devices_member_all on events.checkin_devices;
create policy checkin_devices_member_all on events.checkin_devices
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists checkin_conflicts_member_all on events.checkin_conflicts;
create policy checkin_conflicts_member_all on events.checkin_conflicts
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists checkin_sync_log_member_all on events.checkin_sync_log;
create policy checkin_sync_log_member_all on events.checkin_sync_log
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists checkin_capacity_member_all on events.checkin_capacity;
create policy checkin_capacity_member_all on events.checkin_capacity
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists capacity_overrides_member_all on events.capacity_overrides;
create policy capacity_overrides_member_all on events.capacity_overrides
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.checkin_devices to authenticated;
grant select, insert, update, delete on events.checkin_conflicts to authenticated;
grant select, insert, update, delete on events.checkin_sync_log to authenticated;
grant select, insert, update, delete on events.checkin_capacity to authenticated;
grant select, insert, update, delete on events.capacity_overrides to authenticated;

-- --- Occupancy ----------------------------------------------------------------

-- Live occupancy per event and zone ('' = the venue: door movements with no session). Runs as the caller, so RLS scopes it.
create or replace view events.zone_occupancy
with (security_invoker = true)
as
select
  a.event_id,
  a.project_id,
  lower(coalesce(btrim(a.zone), '')) as zone_key,
  coalesce(max(nullif(btrim(a.zone), '')), '') as zone,
  coalesce(sum(a.party_size) filter (where a.status = 'in'), 0)::integer as admitted,
  coalesce(sum(a.party_size) filter (where a.status = 'out'), 0)::integer as exited,
  greatest(
    0,
    coalesce(sum(a.party_size) filter (where a.status = 'in'), 0)
      - coalesce(sum(a.party_size) filter (where a.status = 'out'), 0)
  )::integer as occupancy,
  (count(*) filter (where a.status = 'in' and a.over_capacity))::integer as over_capacity_admits,
  (count(*) filter (where a.status = 'in' and a.admitted_offline))::integer as offline_admits,
  max(a.checked_in_at) as last_movement_at
from events.checkin_attendance a
where a.deleted_at is null
  and a.status in ('in', 'out')
  and (coalesce(btrim(a.zone), '') <> '' or a.session_id is null)
group by a.event_id, a.project_id, lower(coalesce(btrim(a.zone), ''));

grant select on events.zone_occupancy to authenticated;

-- Occupancy for one zone (null/'' = the venue). Internal: called by the staff RPCs.
create or replace function events.checkin_zone_occupancy(p_event uuid, p_zone text)
returns integer
language sql
stable
security definer
set search_path = events, public
as $$
  select greatest(0, coalesce(sum(case when a.status = 'in' then a.party_size else -a.party_size end), 0))::integer
  from events.checkin_attendance a
  where a.event_id = p_event
    and a.deleted_at is null
    and a.status in ('in', 'out')
    and lower(coalesce(btrim(a.zone), '')) = lower(coalesce(btrim(p_zone), ''))
    and (coalesce(btrim(p_zone), '') <> '' or a.session_id is null);
$$;

-- Arrivals and exits per bucket over the last p_hours of activity, per zone. Runs as the caller (RLS applies).
create or replace function events.checkin_timeline(p_event uuid, p_hours integer default 6, p_bucket_minutes integer default 15)
returns table (bucket timestamptz, zone_key text, arrivals integer, exits integer)
language sql
stable
set search_path = events, public
as $$
  with scoped as (
    select a.checked_in_at, a.status, a.party_size, lower(coalesce(btrim(a.zone), '')) as zk
    from events.checkin_attendance a
    where a.event_id = p_event
      and a.deleted_at is null
      and a.status in ('in', 'out')
      and (coalesce(btrim(a.zone), '') <> '' or a.session_id is null)
  ),
  anchor as (
    select coalesce(max(checked_in_at), now()) as t from scoped
  )
  select
    date_bin(make_interval(mins => greatest(1, least(coalesce(p_bucket_minutes, 15), 240))), s.checked_in_at, timestamptz '2000-01-01') as bucket,
    s.zk as zone_key,
    coalesce(sum(s.party_size) filter (where s.status = 'in'), 0)::integer as arrivals,
    coalesce(sum(s.party_size) filter (where s.status = 'out'), 0)::integer as exits
  from scoped s, anchor
  where s.checked_in_at >= anchor.t - make_interval(hours => greatest(1, least(coalesce(p_hours, 6), 72)))
  group by 1, 2
  order by 1;
$$;

revoke all on function events.checkin_zone_occupancy(uuid, text) from public, anon, authenticated;
revoke all on function events.checkin_timeline(uuid, integer, integer) from public, anon;
grant execute on function events.checkin_timeline(uuid, integer, integer) to authenticated;

-- --- Internal helpers -----------------------------------------------------------

-- Where a ticket stands in one (session, zone) scope: inside now, ever exited, and its latest admission.
-- An order also covers check-ins made through the registration paid checkout filed under the buyer's email.
create or replace function events.checkin_scope_state(
  p_event uuid,
  p_registration uuid,
  p_order uuid,
  p_email text,
  p_session text,
  p_zone text
)
returns table (
  inside boolean,
  exited boolean,
  last_id uuid,
  last_at timestamptz,
  last_gate text,
  last_device text,
  last_offline boolean,
  party integer
)
language sql
stable
security definer
set search_path = events, public
as $$
  with moves as (
    select a.id, a.status, a.checked_in_at, a.created_at, a.gate, a.device_id, a.admitted_offline, a.party_size
    from events.checkin_attendance a
    where a.event_id = p_event
      and a.deleted_at is null
      and a.status in ('in', 'out')
      and a.session_id is not distinct from p_session
      and lower(coalesce(btrim(a.zone), '')) = lower(coalesce(btrim(p_zone), ''))
      and (
        (p_registration is not null and a.registration_id = p_registration)
        or (p_order is not null and (
          a.order_id = p_order
          or (coalesce(btrim(p_email), '') <> '' and a.registration_id in (
            select r.id from events.registrations r
            where r.event_id = p_event and r.deleted_at is null
              and lower(btrim(r.email)) = lower(btrim(p_email))
          ))
        ))
      )
  ),
  latest as (
    select status, party_size from moves order by checked_in_at desc, created_at desc limit 1
  ),
  latest_in as (
    select id, checked_in_at, gate, device_id, admitted_offline
    from moves where status = 'in'
    order by checked_in_at desc, created_at desc limit 1
  )
  select
    coalesce((select status = 'in' from latest), false),
    exists (select 1 from moves where status = 'out'),
    (select id from latest_in),
    (select checked_in_at from latest_in),
    (select gate from latest_in),
    (select device_id from latest_in),
    coalesce((select admitted_offline from latest_in), false),
    coalesce((select party_size from latest), 1);
$$;

-- Record that a device was seen. p_kind: seen | sync | snapshot.
create or replace function events.checkin_touch_device(
  p_event uuid,
  p_device text,
  p_route text,
  p_role text,
  p_app_version text,
  p_agent text,
  p_queued integer,
  p_kind text,
  p_snapshot_count integer default null,
  p_synced integer default 0,
  p_conflicts integer default 0
)
returns void
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_device text := left(nullif(btrim(coalesce(p_device, '')), ''), 64);
begin
  if v_device is null then
    return;
  end if;
  select project_id into v_project from events.events where id = p_event;
  if v_project is null then
    return;
  end if;
  insert into events.checkin_devices as d
    (project_id, event_id, device_id, route, role_name, app_version, user_agent,
     snapshot_count, queued_count, synced_total, conflicts_total,
     last_seen_at, last_sync_at, last_snapshot_at)
  values
    (v_project, p_event, v_device,
     coalesce(nullif(btrim(coalesce(p_route, '')), ''), 'checkin'),
     left(coalesce(p_role, ''), 80), left(coalesce(p_app_version, ''), 40), left(coalesce(p_agent, ''), 120),
     greatest(0, coalesce(p_snapshot_count, 0)), greatest(0, coalesce(p_queued, 0)),
     greatest(0, coalesce(p_synced, 0)), greatest(0, coalesce(p_conflicts, 0)),
     now(),
     case when p_kind = 'sync' then now() end,
     case when p_kind = 'snapshot' then now() end)
  on conflict (event_id, device_id) do update set
    route = case when nullif(btrim(coalesce(p_route, '')), '') is null then d.route else excluded.route end,
    role_name = case when excluded.role_name <> '' then excluded.role_name else d.role_name end,
    app_version = case when excluded.app_version <> '' then excluded.app_version else d.app_version end,
    user_agent = case when excluded.user_agent <> '' then excluded.user_agent else d.user_agent end,
    snapshot_count = case when p_snapshot_count is null then d.snapshot_count else excluded.snapshot_count end,
    queued_count = case when p_queued is null then d.queued_count else excluded.queued_count end,
    synced_total = d.synced_total + excluded.synced_total,
    conflicts_total = d.conflicts_total + excluded.conflicts_total,
    last_seen_at = now(),
    last_sync_at = coalesce(excluded.last_sync_at, d.last_sync_at),
    last_snapshot_at = coalesce(excluded.last_snapshot_at, d.last_snapshot_at),
    deleted_at = null;
end;
$$;

revoke all on function events.checkin_scope_state(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function events.checkin_touch_device(uuid, text, text, text, text, text, integer, text, integer, integer, integer) from public, anon, authenticated;

-- --- Admit / exit cores (shared by the online RPCs and the offline sync) ---------

-- p_offline = replaying a queued offline admit: the guest is already inside, so caps are counted and flagged rather than enforced,
-- and a collision with another device's admission becomes a conflict instead of being dropped.
create or replace function events.checkin_admit_core(
  p_event uuid,
  p_role jsonb,
  p_registration uuid,
  p_order uuid,
  p_name text,
  p_ticket_code text,
  p_gate text,
  p_zone text,
  p_session text,
  p_method text,
  p_staff text,
  p_client_id uuid,
  p_device text,
  p_scanned_at timestamptz,
  p_override_reason text,
  p_offline boolean
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_cfg jsonb;
  v_session text := nullif(btrim(coalesce(p_session, '')), '');
  v_zone text := nullif(btrim(coalesce(p_zone, '')), '');
  v_gate text := nullif(btrim(coalesce(p_gate, '')), '');
  v_device text := left(nullif(btrim(coalesce(p_device, '')), ''), 64);
  v_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_method text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'manual');
  v_staff text := nullif(btrim(coalesce(p_staff, '')), '');
  v_name text := coalesce(p_name, '');
  v_email text := '';
  v_code text := nullif(btrim(coalesce(p_ticket_code, '')), '');
  v_party integer := 1;
  v_offline boolean := coalesce(p_offline, false);
  v_can_override boolean := coalesce(p_role #>> '{permissions,canOverride}', 'false') = 'true';
  v_reg events.registrations;
  v_order events.event_orders;
  v_prev events.checkin_attendance;
  v_conflict events.checkin_conflicts;
  v_state record;
  v_cap events.checkin_capacity;
  v_has_cap boolean;
  v_reentry text;
  v_occ integer;
  v_at timestamptz := now();
  v_id uuid;
  v_conflict_id uuid;
  v_blocked text;
  v_over boolean := false;
  v_override boolean := false;
begin
  select project_id into v_project from events.events where id = p_event;
  select s.config into v_cfg from events.checkin_settings s
    where s.project_id = v_project and s.deleted_at is null limit 1;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);

  -- Trust the device clock only within a sane window.
  if p_scanned_at is not null and p_scanned_at between now() - interval '48 hours' and now() + interval '5 minutes' then
    v_at := least(p_scanned_at, now());
  end if;

  -- One ticket at a time, so two scanners (or a replayed queue) can't both admit it.
  perform pg_advisory_xact_lock(hashtext('checkin:' || coalesce(p_registration, p_order, p_client_id)::text));

  -- Idempotent replay: the same client_id always gets its original outcome.
  if p_client_id is not null then
    select * into v_prev from events.checkin_attendance where client_id = p_client_id;
    if v_prev.id is not null then
      return jsonb_build_object('ok', true, 'already', false, 'replay', true, 'id', v_prev.id,
        'name', v_prev.attendee_name, 'party', v_prev.party_size, 'zone', coalesce(v_prev.zone, ''),
        'overCapacity', v_prev.over_capacity, 'at', v_prev.checked_in_at);
    end if;
    select * into v_conflict from events.checkin_conflicts where client_id = p_client_id;
    if v_conflict.id is not null then
      return jsonb_build_object('ok', false,
        'already', v_conflict.kind in ('duplicate', 'reentry'),
        'blocked', v_conflict.kind = 'invalid_ticket',
        'reason', coalesce(v_conflict.reason, case when v_conflict.kind = 'reentry' then 'no_reentry' else 'inside' end),
        'replay', true, 'conflict', true, 'conflictId', v_conflict.id, 'name', v_conflict.attendee_name,
        'firstAt', v_conflict.first_at, 'firstGate', v_conflict.first_gate, 'firstDevice', v_conflict.first_device_id);
    end if;
  end if;

  if p_registration is not null then
    select * into v_reg from events.registrations
      where id = p_registration and event_id = p_event and deleted_at is null;
    if v_reg.id is null then
      v_blocked := 'not_found';
    else
      if v_name = '' then v_name := coalesce(v_reg.name, ''); end if;
      v_party := greatest(1, coalesce(v_reg.party_size, 1));
      if coalesce(v_reg.status, '') not in ('Confirmed', 'Checked-in') then
        v_blocked := lower(coalesce(nullif(v_reg.status, ''), 'unknown'));
      end if;
    end if;
  elsif p_order is not null then
    select * into v_order from events.event_orders
      where id = p_order and event_id = p_event;
    if v_order.id is null then
      v_blocked := 'not_found';
    else
      if v_name = '' then v_name := coalesce(v_order.buyer_name, ''); end if;
      v_email := lower(btrim(coalesce(v_order.buyer_email, '')));
      v_party := greatest(1, coalesce(v_order.quantity, 1));
      if v_order.cancelled_at is not null or v_order.status = 'cancelled' then
        v_blocked := 'cancelled';
      elsif v_order.status = 'refunded' or (v_order.total > 0 and v_order.refunded_total >= v_order.total) then
        v_blocked := 'refunded';
      end if;
    end if;
  end if;

  if v_code is null and coalesce(p_registration, p_order) is not null then
    v_code := upper(substring(replace(coalesce(p_registration, p_order)::text, '-', ''), 1, 8));
  end if;

  if v_blocked is not null then
    -- The guest already walked in on an offline device: keep it for review rather than drop it.
    if v_offline and p_client_id is not null then
      insert into events.checkin_conflicts
        (project_id, event_id, kind, registration_id, order_id, attendee_name, ticket_code, session_id, zone,
         client_id, device_id, gate, method, staff, scanned_at, reason)
      values
        (v_project, p_event, 'invalid_ticket', p_registration, p_order, v_name, v_code, v_session, v_zone,
         p_client_id, v_device, v_gate, v_method, v_staff, v_at, v_blocked)
      on conflict (client_id) where client_id is not null do nothing
      returning id into v_conflict_id;
    end if;
    return jsonb_build_object('ok', false, 'already', false, 'blocked', true, 'reason', v_blocked,
      'name', v_name, 'conflict', v_conflict_id is not null, 'conflictId', v_conflict_id);
  end if;

  select * into v_state
    from events.checkin_scope_state(p_event, p_registration, p_order, v_email, v_session, v_zone);

  select * into v_cap from events.checkin_capacity c
    where c.event_id = p_event and c.deleted_at is null
      and (
        (v_zone is not null and c.zone_key <> '' and lower(btrim(c.zone_name)) = lower(v_zone))
        or (v_zone is null and v_session is null and c.zone_key = '')
      )
    limit 1;
  v_has_cap := v_cap.id is not null and v_cap.hard_cap is not null;
  v_reentry := case
    when v_cap.id is not null and v_cap.reentry <> 'inherit' then v_cap.reentry
    else coalesce(nullif(v_cfg #>> '{checkinApp,reentry}', ''), 'once')
  end;

  if coalesce(p_registration, p_order) is not null
     and (v_state.inside or (v_state.exited and v_reentry = 'once')) then
    if v_offline and p_client_id is not null and v_state.last_device is distinct from v_device then
      insert into events.checkin_conflicts
        (project_id, event_id, kind, registration_id, order_id, attendee_name, ticket_code, session_id, zone,
         first_attendance_id, first_at, first_gate, first_device_id, first_offline,
         client_id, device_id, gate, method, staff, scanned_at, reason)
      values
        (v_project, p_event, case when v_state.inside then 'duplicate' else 'reentry' end,
         p_registration, p_order, v_name, v_code, v_session, v_zone,
         v_state.last_id, v_state.last_at, v_state.last_gate, v_state.last_device, v_state.last_offline,
         p_client_id, v_device, v_gate, v_method, v_staff, v_at,
         case when v_state.inside then 'inside' else 'no_reentry' end)
      on conflict (client_id) where client_id is not null do nothing
      returning id into v_conflict_id;
    end if;
    return jsonb_build_object('ok', false, 'already', true,
      'reason', case when v_state.inside then 'inside' else 'no_reentry' end,
      'name', v_name, 'party', v_party,
      'firstAt', v_state.last_at, 'firstGate', v_state.last_gate, 'firstDevice', v_state.last_device,
      'conflict', v_conflict_id is not null, 'conflictId', v_conflict_id);
  end if;

  -- Online admits enforce the hard cap; the per-zone lock keeps concurrent gates from overshooting it.
  if v_has_cap and not v_offline then
    perform pg_advisory_xact_lock(hashtext('checkin-cap:' || p_event::text || ':' || lower(coalesce(v_zone, ''))));
    v_occ := events.checkin_zone_occupancy(p_event, v_zone);
    if v_occ + v_party > v_cap.hard_cap then
      if v_reason is not null and v_can_override then
        v_override := true;
      else
        return jsonb_build_object('ok', false, 'already', false, 'capacity', true, 'reason', 'capacity_full',
          'name', v_name, 'party', v_party, 'zone', coalesce(v_zone, ''), 'occupancy', v_occ,
          'cap', v_cap.hard_cap, 'canOverride', v_can_override);
      end if;
    end if;
  end if;

  begin
    insert into events.checkin_attendance
      (event_id, project_id, registration_id, order_id, attendee_name, ticket_code,
       gate, zone, session_id, method, checked_in_by, status, checked_in_at, party_size,
       client_id, device_id, admitted_offline, scanned_at, metadata)
    values
      (p_event, v_project, p_registration, p_order, v_name, v_code,
       v_gate, v_zone, v_session, v_method, v_staff, 'in', v_at, v_party,
       p_client_id, v_device, v_offline, p_scanned_at,
       jsonb_build_object('party', v_party)
         || case when v_override then '{"override": true}'::jsonb else '{}'::jsonb end
         || case when coalesce(v_state.exited, false) then '{"reentry": true}'::jsonb else '{}'::jsonb end)
    returning id into v_id;
  exception when unique_violation then
    select * into v_prev from events.checkin_attendance where client_id = p_client_id;
    return jsonb_build_object('ok', true, 'already', false, 'replay', true, 'id', v_prev.id,
      'name', v_prev.attendee_name, 'party', v_prev.party_size, 'zone', coalesce(v_prev.zone, ''),
      'overCapacity', v_prev.over_capacity, 'at', v_prev.checked_in_at);
  end;

  if v_has_cap then
    if v_override then
      insert into events.capacity_overrides
        (project_id, event_id, attendance_id, zone, registration_id, order_id, attendee_name, party_size,
         occupancy, cap, reason, role_id, role_name, staff, device_id)
      values
        (v_project, p_event, v_id, coalesce(v_zone, ''), p_registration, p_order, v_name, v_party,
         v_occ, v_cap.hard_cap, v_reason, nullif(p_role->>'id', '')::uuid, coalesce(p_role->>'name', ''),
         v_staff, v_device);
    end if;
    v_occ := events.checkin_zone_occupancy(p_event, v_zone);
    -- An offline admit that lands past the cap is kept (the guest is inside) but flagged for both screens.
    if v_offline and v_occ > v_cap.hard_cap then
      v_over := true;
      update events.checkin_attendance set over_capacity = true where id = v_id;
      insert into events.checkin_conflicts
        (project_id, event_id, kind, registration_id, order_id, attendee_name, ticket_code, session_id, zone,
         client_id, device_id, gate, method, staff, scanned_at, attendance_id, occupancy, cap, reason)
      values
        (v_project, p_event, 'over_capacity', p_registration, p_order, v_name, v_code, v_session, v_zone,
         p_client_id, v_device, v_gate, v_method, v_staff, v_at, v_id, v_occ, v_cap.hard_cap, 'over_capacity')
      on conflict (client_id) where client_id is not null do nothing;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'id', v_id, 'name', v_name, 'party', v_party,
    'zone', coalesce(v_zone, ''), 'at', v_at,
    'occupancy', case when v_has_cap then v_occ end,
    'cap', case when v_has_cap then v_cap.hard_cap end,
    'warnPct', case when v_has_cap then v_cap.warn_pct end,
    'overCapacity', v_over, 'override', v_override, 'reentry', coalesce(v_state.exited, false));
end;
$$;

-- Record an exit, so occupancy can come down. Only a ticket currently inside the scope can leave it.
create or replace function events.checkin_exit_core(
  p_event uuid,
  p_registration uuid,
  p_order uuid,
  p_name text,
  p_gate text,
  p_zone text,
  p_session text,
  p_method text,
  p_staff text,
  p_client_id uuid,
  p_device text,
  p_scanned_at timestamptz,
  p_offline boolean
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_session text := nullif(btrim(coalesce(p_session, '')), '');
  v_zone text := nullif(btrim(coalesce(p_zone, '')), '');
  v_device text := left(nullif(btrim(coalesce(p_device, '')), ''), 64);
  v_name text := coalesce(p_name, '');
  v_lookup_name text;
  v_email text := '';
  v_prev events.checkin_attendance;
  v_state record;
  v_cap events.checkin_capacity;
  v_occ integer;
  v_at timestamptz := now();
  v_id uuid;
begin
  if coalesce(p_registration, p_order) is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select project_id into v_project from events.events where id = p_event;

  if p_scanned_at is not null and p_scanned_at between now() - interval '48 hours' and now() + interval '5 minutes' then
    v_at := least(p_scanned_at, now());
  end if;

  perform pg_advisory_xact_lock(hashtext('checkin:' || coalesce(p_registration, p_order)::text));

  if p_client_id is not null then
    select * into v_prev from events.checkin_attendance where client_id = p_client_id;
    if v_prev.id is not null then
      return jsonb_build_object('ok', true, 'exited', v_prev.status = 'out', 'replay', true, 'id', v_prev.id,
        'name', v_prev.attendee_name, 'party', v_prev.party_size, 'zone', coalesce(v_prev.zone, ''));
    end if;
  end if;

  if p_registration is not null then
    select r.name into v_lookup_name from events.registrations r
      where r.id = p_registration and r.event_id = p_event;
  else
    select o.buyer_name, lower(btrim(coalesce(o.buyer_email, '')))
      into v_lookup_name, v_email
      from events.event_orders o where o.id = p_order and o.event_id = p_event;
  end if;
  if v_name = '' then v_name := coalesce(v_lookup_name, ''); end if;

  select * into v_state
    from events.checkin_scope_state(p_event, p_registration, p_order, coalesce(v_email, ''), v_session, v_zone);
  if not v_state.inside then
    return jsonb_build_object('ok', false, 'exited', false, 'notInside', true, 'reason', 'not_inside', 'name', v_name);
  end if;

  begin
    insert into events.checkin_attendance
      (event_id, project_id, registration_id, order_id, attendee_name, ticket_code,
       gate, zone, session_id, method, checked_in_by, status, checked_in_at, party_size,
       client_id, device_id, admitted_offline, scanned_at, metadata)
    values
      (p_event, v_project, p_registration, p_order, v_name,
       upper(substring(replace(coalesce(p_registration, p_order)::text, '-', ''), 1, 8)),
       nullif(btrim(coalesce(p_gate, '')), ''), v_zone, v_session,
       coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'manual'), nullif(btrim(coalesce(p_staff, '')), ''),
       'out', v_at, v_state.party, p_client_id, v_device, coalesce(p_offline, false), p_scanned_at,
       jsonb_build_object('party', v_state.party, 'exitOf', v_state.last_id))
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'exited', true, 'replay', true, 'name', v_name);
  end;

  select * into v_cap from events.checkin_capacity c
    where c.event_id = p_event and c.deleted_at is null and c.hard_cap is not null
      and (
        (v_zone is not null and c.zone_key <> '' and lower(btrim(c.zone_name)) = lower(v_zone))
        or (v_zone is null and v_session is null and c.zone_key = '')
      )
    limit 1;
  if v_cap.id is not null then
    v_occ := events.checkin_zone_occupancy(p_event, v_zone);
  end if;

  return jsonb_build_object('ok', true, 'exited', true, 'id', v_id, 'name', v_name, 'party', v_state.party,
    'zone', coalesce(v_zone, ''), 'at', v_at,
    'occupancy', v_occ, 'cap', v_cap.hard_cap, 'warnPct', v_cap.warn_pct);
end;
$$;

revoke all on function events.checkin_admit_core(uuid, jsonb, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, text, boolean)
  from public, anon, authenticated;
revoke all on function events.checkin_exit_core(uuid, uuid, uuid, text, text, text, text, text, text, uuid, text, timestamptz, boolean)
  from public, anon, authenticated;

-- --- Staff RPCs (access-code gated) ---------------------------------------------

-- Admit a registration or an order. Returns { ok, already, blocked, capacity, reason, id, name, party, zone, occupancy, cap,
-- firstAt, firstGate, firstDevice, replay, override }. p_client_id makes a retry return the original outcome;
-- p_override_reason admits past a hard cap when the code's role has canOverride.
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
  p_staff text default null,
  p_client_id uuid default null,
  p_device text default null,
  p_scanned_at timestamptz default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_result jsonb;
begin
  v_role := events.checkin_validate_code(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  v_result := events.checkin_admit_core(p_event, v_role, p_registration, p_order, p_name, p_ticket_code,
    p_gate, p_zone, p_session, p_method, p_staff, p_client_id, p_device, p_scanned_at, p_override_reason, false);
  if p_device is not null then
    perform events.checkin_touch_device(p_event, p_device, null, v_role->>'name', null, null, null, 'seen');
  end if;
  return v_result;
end;
$$;

grant execute on function events.checkin_admit(uuid, text, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, text)
  to anon, authenticated;

-- Scan someone out of a zone (or the venue). Returns { ok, exited, notInside, reason, name, party, zone, occupancy, cap }.
create or replace function events.checkin_exit(
  p_event uuid,
  p_code text,
  p_registration uuid default null,
  p_order uuid default null,
  p_name text default '',
  p_gate text default null,
  p_zone text default null,
  p_session text default null,
  p_method text default 'manual',
  p_staff text default null,
  p_client_id uuid default null,
  p_device text default null,
  p_scanned_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
begin
  v_role := events.checkin_validate_code(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  return events.checkin_exit_core(p_event, p_registration, p_order, p_name, p_gate, p_zone, p_session,
    p_method, p_staff, p_client_id, p_device, p_scanned_at, false);
end;
$$;

grant execute on function events.checkin_exit(uuid, text, uuid, uuid, text, text, text, text, text, text, uuid, text, timestamptz)
  to anon, authenticated;

-- Replay a device's offline queue in order. p_items: [{ clientId, kind: in|out, registrationId, orderId, name, ticketCode,
-- gate, zone, sessionId, method, staff, scannedAt }]. Returns { serverTime, results: [{ clientId, outcome, ...core result }] }
-- where outcome is admitted | exited | duplicate | rejected | error (error = retry later).
create or replace function events.checkin_sync(
  p_event uuid,
  p_code text,
  p_device text,
  p_items jsonb,
  p_route text default null,
  p_app_version text default null,
  p_agent text default null,
  p_queued integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_project uuid;
  v_item jsonb;
  v_res jsonb;
  v_outcome text;
  v_out jsonb := '[]'::jsonb;
  v_items integer := 0;
  v_admitted integer := 0;
  v_exited integer := 0;
  v_duplicates integer := 0;
  v_conflicts integer := 0;
  v_rejected integer := 0;
  v_over integer := 0;
  v_errors integer := 0;
  v_oldest timestamptz;
  v_scanned timestamptz;
begin
  v_role := events.checkin_validate_code(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  if nullif(btrim(coalesce(p_device, '')), '') is null then
    raise exception 'DEVICE_REQUIRED' using errcode = 'check_violation';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'check_violation';
  end if;
  select project_id into v_project from events.events where id = p_event;

  for v_item in select value from jsonb_array_elements(p_items) with ordinality as e(value, idx) order by idx loop
    v_items := v_items + 1;
    begin
      v_scanned := nullif(v_item->>'scannedAt', '')::timestamptz;
      if v_scanned is not null and (v_oldest is null or v_scanned < v_oldest) then
        v_oldest := v_scanned;
      end if;
      if coalesce(v_item->>'kind', 'in') = 'out' then
        v_res := events.checkin_exit_core(p_event,
          nullif(v_item->>'registrationId', '')::uuid, nullif(v_item->>'orderId', '')::uuid,
          coalesce(v_item->>'name', ''), v_item->>'gate', v_item->>'zone', v_item->>'sessionId',
          v_item->>'method', v_item->>'staff', nullif(v_item->>'clientId', '')::uuid, p_device, v_scanned, true);
      else
        v_res := events.checkin_admit_core(p_event, v_role,
          nullif(v_item->>'registrationId', '')::uuid, nullif(v_item->>'orderId', '')::uuid,
          coalesce(v_item->>'name', ''), v_item->>'ticketCode', v_item->>'gate', v_item->>'zone',
          v_item->>'sessionId', v_item->>'method', v_item->>'staff', nullif(v_item->>'clientId', '')::uuid,
          p_device, v_scanned, null, true);
      end if;
      v_outcome := case
        when coalesce((v_res->>'ok')::boolean, false) and coalesce((v_res->>'exited')::boolean, false) then 'exited'
        when coalesce((v_res->>'ok')::boolean, false) then 'admitted'
        when coalesce((v_res->>'already')::boolean, false) then 'duplicate'
        else 'rejected'
      end;
    exception
      when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
        v_res := jsonb_build_object('ok', false, 'reason', 'invalid');
        v_outcome := 'rejected';
      when others then
        v_res := jsonb_build_object('ok', false, 'reason', 'error', 'error', sqlerrm);
        v_outcome := 'error';
    end;

    if v_outcome = 'admitted' then v_admitted := v_admitted + 1; end if;
    if v_outcome = 'exited' then v_exited := v_exited + 1; end if;
    if v_outcome = 'duplicate' then v_duplicates := v_duplicates + 1; end if;
    if v_outcome = 'rejected' then v_rejected := v_rejected + 1; end if;
    if v_outcome = 'error' then v_errors := v_errors + 1; end if;
    if coalesce((v_res->>'overCapacity')::boolean, false) then v_over := v_over + 1; end if;
    if coalesce((v_res->>'conflict')::boolean, false) or coalesce((v_res->>'overCapacity')::boolean, false) then
      v_conflicts := v_conflicts + 1;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object('clientId', v_item->>'clientId', 'outcome', v_outcome) || coalesce(v_res, '{}'::jsonb));
  end loop;

  perform events.checkin_touch_device(p_event, p_device, p_route, v_role->>'name', p_app_version, p_agent,
    case when p_queued is null then null else greatest(0, p_queued - v_items + v_errors) end,
    'sync', null, v_admitted + v_exited + v_duplicates + v_rejected, v_conflicts);

  if v_items > 0 then
    insert into events.checkin_sync_log
      (project_id, event_id, device_id, items, admitted, exited, duplicates, conflicts, rejected, over_capacity, errors, oldest_scan_at)
    values
      (v_project, p_event, left(btrim(p_device), 64), v_items, v_admitted, v_exited, v_duplicates, v_conflicts,
       v_rejected, v_over, v_errors, v_oldest);
  end if;

  return jsonb_build_object('serverTime', now(), 'results', v_out);
end;
$$;

grant execute on function events.checkin_sync(uuid, text, text, jsonb, text, text, text, integer) to anon, authenticated;

-- Everything a staff device needs to keep scanning without a connection: every ticket for the event (admissible or not)
-- with where it stands per (session|zone) scope, the gates/zones/sessions, caps and the offline policy.
-- Tickets are only included when offline mode is on for the event; the device clears its cache otherwise.
create or replace function events.checkin_snapshot(
  p_event uuid,
  p_code text,
  p_device text default null,
  p_route text default null,
  p_app_version text default null,
  p_agent text default null,
  p_queued integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_event events.events;
  v_cfg jsonb;
  v_offline jsonb;
  v_enabled boolean;
  v_refresh integer;
  v_allow_capped boolean;
  v_reentry text;
  v_caps jsonb;
  v_tickets jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  v_role := events.checkin_validate_code(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  select * into v_event from events.events where id = p_event and deleted_at is null;
  select s.config into v_cfg from events.checkin_settings s
    where s.project_id = v_event.project_id and s.deleted_at is null limit 1;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_offline := coalesce(v_cfg->'offline', '{}'::jsonb);

  -- Per-event switch, then the project default, then the older Check-in App "Offline caching" toggle.
  v_enabled := coalesce(
    case when jsonb_typeof(v_offline #> array['events', p_event::text]) = 'boolean'
      then (v_offline #>> array['events', p_event::text])::boolean end,
    case when jsonb_typeof(v_offline->'enabled') = 'boolean' then (v_offline->>'enabled')::boolean end,
    case when jsonb_typeof(v_cfg #> '{checkinApp,offlineCache}') = 'boolean'
      then (v_cfg #>> '{checkinApp,offlineCache}')::boolean end,
    false);
  v_refresh := least(120, greatest(1, coalesce(
    case when jsonb_typeof(v_offline->'refreshMinutes') = 'number' then round((v_offline->>'refreshMinutes')::numeric)::integer end,
    5)));
  v_allow_capped := coalesce(
    case when jsonb_typeof(v_offline->'allowCappedZones') = 'boolean' then (v_offline->>'allowCappedZones')::boolean end,
    false);
  v_reentry := coalesce(nullif(v_cfg #>> '{checkinApp,reentry}', ''), 'once');

  select coalesce(jsonb_agg(jsonb_build_object(
      'zoneKey', c.zone_key, 'zone', c.zone_name, 'hardCap', c.hard_cap, 'warnPct', c.warn_pct, 'reentry', c.reentry
    )), '[]'::jsonb)
    into v_caps
    from events.checkin_capacity c
    where c.event_id = p_event and c.deleted_at is null;

  if v_enabled then
    with att as (
      select a.registration_id, a.order_id, coalesce(a.session_id, '') as s,
             lower(coalesce(btrim(a.zone), '')) as zk, a.status, a.checked_in_at as moved_at, a.created_at,
             a.gate, a.device_id
      from events.checkin_attendance a
      where a.event_id = p_event and a.deleted_at is null and a.status in ('in', 'out')
    ),
    reg_email as (
      select r.id, lower(btrim(r.email)) as em
      from events.registrations r
      where r.event_id = p_event and r.deleted_at is null and coalesce(btrim(r.email), '') <> ''
    ),
    ord as (
      select o.id, o.buyer_name, o.buyer_email, o.ticket_name, o.quantity, o.status, o.cancelled_at,
             o.total, o.refunded_total, lower(btrim(coalesce(o.buyer_email, ''))) as em
      from events.event_orders o
      where o.event_id = p_event
    ),
    linked as (
      select att.registration_id as tid, att.s, att.zk, att.status, att.moved_at, att.created_at, att.gate, att.device_id
      from att where att.registration_id is not null
      union all
      select att.order_id, att.s, att.zk, att.status, att.moved_at, att.created_at, att.gate, att.device_id
      from att where att.order_id is not null
      union all
      select ord.id, att.s, att.zk, att.status, att.moved_at, att.created_at, att.gate, att.device_id
      from att
      join reg_email re on re.id = att.registration_id
      join ord on ord.em = re.em and ord.em <> ''
    ),
    scope_rows as (
      select tid, s, zk,
        (array_agg(status order by moved_at desc, created_at desc))[1] = 'in' as inside,
        bool_or(status = 'out') as exited,
        (array_agg(moved_at order by moved_at desc, created_at desc) filter (where status = 'in'))[1] as last_at,
        (array_agg(gate order by moved_at desc, created_at desc) filter (where status = 'in'))[1] as last_gate,
        (array_agg(device_id order by moved_at desc, created_at desc) filter (where status = 'in'))[1] as last_device
      from linked
      group by tid, s, zk
    ),
    scopes as (
      select tid, jsonb_object_agg(s || '|' || zk, jsonb_strip_nulls(jsonb_build_object(
        'in', inside, 'out', exited, 'at', last_at, 'gate', last_gate, 'device', last_device))) as doc
      from scope_rows
      group by tid
    ),
    covered as (
      select distinct em from ord where em <> ''
    ),
    tickets as (
      select jsonb_build_object(
        'id', r.id, 'kind', 'registration',
        'name', coalesce(r.name, ''), 'email', coalesce(r.email, ''),
        'code', upper(substring(replace(r.id::text, '-', ''), 1, 8)), 'ticket', '',
        'party', greatest(1, coalesce(r.party_size, 1)), 'status', coalesce(r.status, ''),
        'admissible', coalesce(r.status, '') in ('Confirmed', 'Checked-in'),
        'scopes', coalesce(sc.doc, '{}'::jsonb)) as doc
      from events.registrations r
      left join scopes sc on sc.tid = r.id
      where r.event_id = p_event and r.deleted_at is null
        and not exists (
          select 1 from covered c
          where coalesce(btrim(r.email), '') <> '' and c.em = lower(btrim(r.email))
        )
      union all
      select jsonb_build_object(
        'id', o.id, 'kind', 'order',
        'name', coalesce(o.buyer_name, ''), 'email', coalesce(o.buyer_email, ''),
        'code', upper(substring(replace(o.id::text, '-', ''), 1, 8)), 'ticket', coalesce(o.ticket_name, ''),
        'party', greatest(1, coalesce(o.quantity, 1)),
        'status', case
          when o.cancelled_at is not null or o.status = 'cancelled' then 'Cancelled'
          when o.status = 'refunded' or (o.total > 0 and o.refunded_total >= o.total) then 'Refunded'
          else 'Confirmed'
        end,
        'admissible', o.cancelled_at is null
          and coalesce(o.status, 'confirmed') not in ('cancelled', 'refunded')
          and not (o.total > 0 and o.refunded_total >= o.total),
        'scopes', coalesce(sc.doc, '{}'::jsonb))
      from ord o
      left join scopes sc on sc.tid = o.id
    )
    select coalesce(jsonb_agg(t.doc), '[]'::jsonb), count(*)::integer
      into v_tickets, v_count
      from tickets t;
  end if;

  perform events.checkin_touch_device(p_event, p_device, p_route, v_role->>'name', p_app_version, p_agent,
    p_queued, 'snapshot', v_count, 0, 0);

  return jsonb_build_object(
    'version', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'generatedAt', now(),
    'enabled', v_enabled,
    'settings', jsonb_build_object('refreshMinutes', v_refresh, 'allowCappedZones', v_allow_capped, 'reentry', v_reentry),
    'event', jsonb_build_object(
      'id', p_event,
      'name', coalesce(v_event.name, ''),
      'gates', coalesce(v_event.metadata #> '{checkinGates,gates}', '[]'::jsonb),
      'zones', coalesce(v_event.metadata #> '{checkinGates,zones}', '[]'::jsonb),
      'sessions', coalesce(v_event.metadata #> '{checkinSessions,sessions}', '[]'::jsonb)),
    'caps', v_caps,
    'count', v_count,
    'tickets', v_tickets);
end;
$$;

grant execute on function events.checkin_snapshot(uuid, text, text, text, text, text, integer) to anon, authenticated;

-- Liveness ping from a staff device: refreshes the device registry and returns live occupancy for capped zones.
create or replace function events.checkin_heartbeat(
  p_event uuid,
  p_code text,
  p_device text default null,
  p_route text default null,
  p_app_version text default null,
  p_agent text default null,
  p_queued integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_occ jsonb;
begin
  v_role := events.checkin_validate_code(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  perform events.checkin_touch_device(p_event, p_device, p_route, v_role->>'name', p_app_version, p_agent, p_queued, 'seen');
  select coalesce(jsonb_agg(jsonb_build_object(
      'zoneKey', c.zone_key, 'zone', c.zone_name, 'hardCap', c.hard_cap, 'warnPct', c.warn_pct,
      'occupancy', events.checkin_zone_occupancy(p_event, case when c.zone_key = '' then null else c.zone_name end)
    )), '[]'::jsonb)
    into v_occ
    from events.checkin_capacity c
    where c.event_id = p_event and c.deleted_at is null and c.hard_cap is not null;
  return jsonb_build_object('serverTime', now(), 'occupancy', v_occ);
end;
$$;

grant execute on function events.checkin_heartbeat(uuid, text, text, text, text, text, integer) to anon, authenticated;

-- @down
drop function if exists events.checkin_heartbeat(uuid, text, text, text, text, text, integer);
drop function if exists events.checkin_snapshot(uuid, text, text, text, text, text, integer);
drop function if exists events.checkin_sync(uuid, text, text, jsonb, text, text, text, integer);
drop function if exists events.checkin_exit(uuid, text, uuid, uuid, text, text, text, text, text, text, uuid, text, timestamptz);
drop function if exists events.checkin_admit(uuid, text, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, text);
drop function if exists events.checkin_exit_core(uuid, uuid, uuid, text, text, text, text, text, text, uuid, text, timestamptz, boolean);
drop function if exists events.checkin_admit_core(uuid, jsonb, uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, text, boolean);
drop function if exists events.checkin_touch_device(uuid, text, text, text, text, text, integer, text, integer, integer, integer);
drop function if exists events.checkin_scope_state(uuid, uuid, uuid, text, text, text);
drop function if exists events.checkin_timeline(uuid, integer, integer);
drop function if exists events.checkin_zone_occupancy(uuid, text);
drop view if exists events.zone_occupancy;
drop table if exists events.capacity_overrides;
drop table if exists events.checkin_capacity;
drop table if exists events.checkin_sync_log;
drop table if exists events.checkin_conflicts;
drop table if exists events.checkin_devices;
drop index if exists events.checkin_attendance_client_idx;
drop index if exists events.checkin_attendance_event_reg_idx;
drop index if exists events.checkin_attendance_event_order_idx;
drop index if exists events.checkin_attendance_event_zone_idx;
-- Exit rows have no meaning to the restored admit, which counts any 'in' row.
delete from events.checkin_attendance where status = 'out';
alter table events.checkin_attendance drop column if exists over_capacity;
alter table events.checkin_attendance drop column if exists party_size;
alter table events.checkin_attendance drop column if exists scanned_at;
alter table events.checkin_attendance drop column if exists admitted_offline;
alter table events.checkin_attendance drop column if exists device_id;
alter table events.checkin_attendance drop column if exists client_id;

-- The admit from 20261107120000_checkin_orders.sql.
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
