-- @up
-- API & Webhooks: scoped API keys for the public REST API (/api/v1), webhook endpoints, an outbox filled by
-- triggers on the core tables, and signed deliveries the dispatcher (/api/webhooks/dispatch) sends and retries.
-- Members can read all of it; every write goes through server routes on the service role (secrets never reach the browser).

create schema if not exists events;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists events.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Untitled key',
  -- Shown in lists (e.g. gev_live_ab12cd); the full key is only ever shown once, at creation.
  prefix text not null,
  -- sha256 hex of the full key; the API resolves keys by this.
  key_hash text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  last_used_ip text,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint api_keys_scopes_check check (
    scopes <@ array['read:events', 'read:orders', 'read:attendees', 'read:checkins', 'write:checkins']::text[]
  )
);

create unique index if not exists api_keys_hash_idx on events.api_keys (key_hash);
create index if not exists api_keys_project_idx
  on events.api_keys (project_id, created_at desc)
  where deleted_at is null;

drop trigger if exists api_keys_touch on events.api_keys;
create trigger api_keys_touch
  before update on events.api_keys
  for each row execute function events.touch_updated_at();

create table if not exists events.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  description text not null default '',
  -- HMAC signing secret; only the service role can read it (revealed through the settings API).
  secret text not null,
  secret_rotated_at timestamptz,
  -- Subscribed types, e.g. {order.created, checkin.created}; '*' means every type.
  event_types text[] not null default '{}',
  active boolean not null default true,
  failure_streak integer not null default 0,
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint webhook_endpoints_https check (url ~* '^https://[^/\s]+')
);

create index if not exists webhook_endpoints_project_idx
  on events.webhook_endpoints (project_id)
  where deleted_at is null;

drop trigger if exists webhook_endpoints_touch on events.webhook_endpoints;
create trigger webhook_endpoints_touch
  before update on events.webhook_endpoints
  for each row execute function events.touch_updated_at();

-- The outbox: one immutable row per captured event.
create table if not exists events.webhook_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_project_idx on events.webhook_events (project_id, occurred_at desc);
create index if not exists webhook_events_occurred_idx on events.webhook_events (occurred_at);

-- One row per (event, endpoint) send; a replay is a fresh row pointing at the original.
create table if not exists events.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.webhook_events(id) on delete cascade,
  endpoint_id uuid not null references events.webhook_endpoints(id) on delete cascade,
  event_type text not null default '',
  -- pending = not tried yet · failed = last attempt failed, retry scheduled · succeeded · dead = gave up
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'dead')),
  origin text not null default 'event' check (origin in ('event', 'test', 'replay')),
  replay_of uuid references events.webhook_deliveries(id) on delete set null,
  attempts integer not null default 0,
  next_attempt_at timestamptz default now(),
  -- Lease held while a dispatcher is sending, so a cron run and a "Retry now" never send the same row twice.
  locked_until timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  response_ms integer,
  response_body text,
  last_error text,
  -- Newest first, capped at 10: [{ at, attempt, status, ms, error }].
  attempt_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_due_idx
  on events.webhook_deliveries (next_attempt_at)
  where status in ('pending', 'failed');
create index if not exists webhook_deliveries_project_idx on events.webhook_deliveries (project_id, created_at desc);
create index if not exists webhook_deliveries_endpoint_idx on events.webhook_deliveries (endpoint_id, created_at desc);
create index if not exists webhook_deliveries_event_idx on events.webhook_deliveries (event_id);

drop trigger if exists webhook_deliveries_touch on events.webhook_deliveries;
create trigger webhook_deliveries_touch
  before update on events.webhook_deliveries
  for each row execute function events.touch_updated_at();

-- Fixed-window request counters for the public API's per-key rate limit.
create table if not exists events.api_rate_limits (
  key_id uuid not null references events.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key_id, window_start)
);

-- Orders had no updated_at; the API's `updated_since` filter needs one. Existing rows fall back to created_at.
alter table events.event_orders add column if not exists updated_at timestamptz;
alter table events.event_orders alter column updated_at set default now();

drop trigger if exists event_orders_touch_updated_at on events.event_orders;
create trigger event_orders_touch_updated_at
  before update on events.event_orders
  for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants: members read (secrets and key hashes excluded by column grants), nobody but the service role writes.
-- ---------------------------------------------------------------------------

alter table events.api_keys enable row level security;
alter table events.webhook_endpoints enable row level security;
alter table events.webhook_events enable row level security;
alter table events.webhook_deliveries enable row level security;
alter table events.api_rate_limits enable row level security;

drop policy if exists api_keys_member_read on events.api_keys;
create policy api_keys_member_read on events.api_keys
  for select to authenticated
  using (events.can_access_project(project_id));

drop policy if exists webhook_endpoints_member_read on events.webhook_endpoints;
create policy webhook_endpoints_member_read on events.webhook_endpoints
  for select to authenticated
  using (events.can_access_project(project_id));

drop policy if exists webhook_events_member_read on events.webhook_events;
create policy webhook_events_member_read on events.webhook_events
  for select to authenticated
  using (events.can_access_project(project_id));

drop policy if exists webhook_deliveries_member_read on events.webhook_deliveries;
create policy webhook_deliveries_member_read on events.webhook_deliveries
  for select to authenticated
  using (events.can_access_project(project_id));

revoke all on events.api_keys from anon, authenticated;
revoke all on events.webhook_endpoints from anon, authenticated;
revoke all on events.webhook_events from anon, authenticated;
revoke all on events.webhook_deliveries from anon, authenticated;
revoke all on events.api_rate_limits from anon, authenticated;

grant select (
  id, project_id, name, prefix, scopes, last_used_at, last_used_ip, expires_at, revoked_at, revoked_by,
  created_by, created_at, updated_at, deleted_at
) on events.api_keys to authenticated;

grant select (
  id, project_id, url, description, secret_rotated_at, event_types, active, failure_streak, last_delivery_at,
  last_success_at, last_failure_at, disabled_at, disabled_reason, created_by, created_at, updated_at, deleted_at
) on events.webhook_endpoints to authenticated;

grant select on events.webhook_events to authenticated;
grant select on events.webhook_deliveries to authenticated;

grant all on events.api_keys to service_role;
grant all on events.webhook_endpoints to service_role;
grant all on events.webhook_events to service_role;
grant all on events.webhook_deliveries to service_role;
grant all on events.api_rate_limits to service_role;

-- ---------------------------------------------------------------------------
-- Serializers: one JSON shape per resource, shared by the REST API and webhook payloads.
-- ---------------------------------------------------------------------------

create or replace function events.api_enum(p text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '_', 'g'), '_'), '');
$$;

-- Same 8-character code the scanner, tickets and badges show.
create or replace function events.api_ticket_code(p_id uuid)
returns text
language sql
immutable
as $$
  select upper(substring(replace(p_id::text, '-', ''), 1, 8));
$$;

create or replace function events.api_order_status(p_status text, p_total numeric, p_refunded numeric, p_cancelled timestamptz)
returns text
language sql
immutable
as $$
  select case
    when p_cancelled is not null or p_status = 'cancelled' then 'cancelled'
    when p_status = 'refunded' or (coalesce(p_total, 0) > 0 and coalesce(p_refunded, 0) >= p_total) then 'refunded'
    when coalesce(p_refunded, 0) > 0 then 'partially_refunded'
    when coalesce(p_status, 'confirmed') not in ('confirmed', 'paid') then events.api_enum(p_status)
    when coalesce(p_total, 0) > 0 then 'paid'
    else 'confirmed'
  end;
$$;

create or replace function events.api_event_json(e events.events)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select jsonb_build_object(
    'object', 'event',
    'id', e.id,
    'name', e.name,
    'status', events.api_enum(e.status),
    'type', events.api_enum(e.type),
    'visibility', events.api_enum(e.visibility),
    'date', e.event_date,
    'time', nullif(e.event_time, ''),
    'timezone', e.timezone,
    'venue', nullif(e.venue, ''),
    'address', nullif(e.address, ''),
    'city', nullif(e.city, ''),
    'summary', nullif(e.summary, ''),
    'cover_url', e.cover_url,
    'capacity', e.capacity,
    'tickets_sold', e.sold,
    'revenue', e.revenue,
    'currency', lower(coalesce(nullif(e.metadata #>> '{payments,currency}', ''), 'usd')),
    'created_at', e.created_at,
    'updated_at', e.updated_at
  );
$$;

create or replace function events.api_order_json(o events.event_orders)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select jsonb_build_object(
    'object', 'order',
    'id', o.id,
    'event_id', o.event_id,
    'ticket_code', events.api_ticket_code(o.id),
    'status', events.api_order_status(o.status, o.total, o.refunded_total, o.cancelled_at),
    'buyer', jsonb_build_object('name', o.buyer_name, 'email', o.buyer_email),
    'ticket_name', o.ticket_name,
    'quantity', o.quantity,
    'unit_price', o.ticket_price,
    'total', o.total,
    'refunded_total', o.refunded_total,
    'currency', coalesce(
      (select lower(nullif(e.metadata #>> '{payments,currency}', '')) from events.events e where e.id = o.event_id),
      'usd'
    ),
    'payment_intent', o.stripe_payment_intent_id,
    'cancelled_at', o.cancelled_at,
    'created_at', o.created_at,
    'updated_at', coalesce(o.updated_at, o.created_at)
  );
$$;

create or replace function events.api_refund_json(f events.order_refunds)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select jsonb_build_object(
    'object', 'refund',
    'id', f.id,
    'order_id', f.order_id,
    'event_id', f.event_id,
    'amount', f.amount,
    'status', events.api_enum(f.status),
    'reason_code', f.reason_code,
    'reason', nullif(f.reason, ''),
    'method', f.method,
    'created_at', f.created_at
  );
$$;

-- An attendee is a registration; paid checkout files one under the buyer's email, so check-ins via the order count too.
create or replace function events.api_attendee_json(r events.registrations)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select jsonb_build_object(
    'object', 'attendee',
    'id', r.id,
    'event_id', r.event_id,
    'ticket_code', events.api_ticket_code(r.id),
    'name', r.name,
    'email', r.email,
    'phone', r.phone,
    'status', events.api_enum(r.status),
    'source', events.api_enum(r.source),
    'party_size', r.party_size,
    'checked_in_at', (
      select min(a.checked_in_at)
        from events.checkin_attendance a
       where a.event_id = r.event_id
         and a.status = 'in'
         and a.deleted_at is null
         and a.session_id is null
         and (
           a.registration_id = r.id
           or (coalesce(btrim(r.email), '') <> '' and a.order_id in (
             select o.id from events.event_orders o
              where o.event_id = r.event_id and lower(o.buyer_email) = lower(btrim(r.email))
           ))
         )
    ),
    'created_at', r.created_at,
    'updated_at', r.updated_at
  );
$$;

create or replace function events.api_checkin_json(a events.checkin_attendance)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select jsonb_build_object(
    'object', 'checkin',
    'id', a.id,
    'event_id', a.event_id,
    'registration_id', a.registration_id,
    'order_id', a.order_id,
    'attendee_name', a.attendee_name,
    'ticket_code', a.ticket_code,
    'gate', a.gate,
    'zone', a.zone,
    'session_id', a.session_id,
    'method', a.method,
    'status', a.status,
    'checked_in_by', a.checked_in_by,
    'checked_in_at', a.checked_in_at,
    'created_at', a.created_at
  );
$$;

-- ---------------------------------------------------------------------------
-- Capture: outbox + fan-out, and the triggers that feed it. Capture never fails the source write.
-- ---------------------------------------------------------------------------

create or replace function events.webhook_wants(p_project uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = events, public
as $$
  select p_project is not null and exists (
    select 1 from events.webhook_endpoints w
     where w.project_id = p_project
       and w.active
       and w.deleted_at is null
       and (p_type = any (w.event_types) or '*' = any (w.event_types))
  );
$$;

create or replace function events.webhook_emit(p_project uuid, p_type text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_event uuid;
begin
  if not events.webhook_wants(p_project, p_type) then
    return null;
  end if;
  insert into events.webhook_events (project_id, type, payload)
  values (p_project, p_type, coalesce(p_data, '{}'::jsonb))
  returning id into v_event;

  insert into events.webhook_deliveries (project_id, event_id, endpoint_id, event_type)
  select p_project, v_event, w.id, p_type
    from events.webhook_endpoints w
   where w.project_id = p_project
     and w.active
     and w.deleted_at is null
     and (p_type = any (w.event_types) or '*' = any (w.event_types));
  return v_event;
end;
$$;

create or replace function events.webhook_capture_order()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_paid boolean;
begin
  begin
    v_project := coalesce(new.project_id, (select e.project_id from events.events e where e.id = new.event_id));
    if v_project is null then
      return null;
    end if;
    v_paid := new.cancelled_at is null and coalesce(new.status, 'confirmed') in ('confirmed', 'paid') and new.total > 0;

    if tg_op = 'INSERT' then
      if events.webhook_wants(v_project, 'order.created') then
        perform events.webhook_emit(v_project, 'order.created', events.api_order_json(new));
      end if;
      if v_paid and events.webhook_wants(v_project, 'order.paid') then
        perform events.webhook_emit(v_project, 'order.paid', events.api_order_json(new));
      end if;
    else
      if old.cancelled_at is null
         and coalesce(old.status, '') <> 'cancelled'
         and (new.cancelled_at is not null or new.status = 'cancelled')
         and events.webhook_wants(v_project, 'order.cancelled') then
        perform events.webhook_emit(v_project, 'order.cancelled', events.api_order_json(new));
      end if;
      -- Paid on update only when the order moves out of a pre-payment state (e.g. pending).
      if v_paid
         and old.status is distinct from new.status
         and coalesce(old.status, '') not in ('confirmed', 'paid', 'refunded', 'cancelled')
         and events.webhook_wants(v_project, 'order.paid') then
        perform events.webhook_emit(v_project, 'order.paid', events.api_order_json(new));
      end if;
    end if;
  exception when others then
    raise warning '[webhooks] order capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Deferred to commit: issue_order_refund inserts the refund before it bumps the order's refunded_total.
create or replace function events.webhook_capture_refund()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_order events.event_orders;
  v_project uuid;
begin
  begin
    if new.deleted_at is not null or new.status <> 'Issued' then
      return null;
    end if;
    if tg_op = 'UPDATE' and old.status = 'Issued' then
      return null;
    end if;
    select * into v_order from events.event_orders where id = new.order_id;
    if not found then
      return null;
    end if;
    v_project := coalesce(
      new.project_id,
      v_order.project_id,
      (select e.project_id from events.events e where e.id = v_order.event_id)
    );
    if events.webhook_wants(v_project, 'order.refunded') then
      perform events.webhook_emit(
        v_project,
        'order.refunded',
        events.api_order_json(v_order) || jsonb_build_object('refund', events.api_refund_json(new))
      );
    end if;
  exception when others then
    raise warning '[webhooks] refund capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events.webhook_capture_registration()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  begin
    v_project := coalesce(new.project_id, (select e.project_id from events.events e where e.id = new.event_id));
    if v_project is null or new.deleted_at is not null then
      return null;
    end if;
    if tg_op = 'INSERT' then
      if events.webhook_wants(v_project, 'registration.created') then
        perform events.webhook_emit(v_project, 'registration.created', events.api_attendee_json(new));
      end if;
    elsif new.status = 'Cancelled'
          and old.status is distinct from 'Cancelled'
          and events.webhook_wants(v_project, 'registration.cancelled') then
      perform events.webhook_emit(v_project, 'registration.cancelled', events.api_attendee_json(new));
    end if;
  exception when others then
    raise warning '[webhooks] registration capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events.webhook_capture_checkin()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  begin
    if new.status <> 'in' or new.deleted_at is not null then
      return null;
    end if;
    v_project := coalesce(new.project_id, (select e.project_id from events.events e where e.id = new.event_id));
    if events.webhook_wants(v_project, 'checkin.created') then
      perform events.webhook_emit(v_project, 'checkin.created', events.api_checkin_json(new));
    end if;
  exception when others then
    raise warning '[webhooks] check-in capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Published = leaves Draft for a selling/scheduled state; updated = a field integrators show changed (not sold counters or page design).
create or replace function events.webhook_capture_event()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_published boolean := false;
begin
  begin
    if new.deleted_at is not null then
      return null;
    end if;
    if tg_op = 'INSERT' then
      v_published := coalesce(new.status, 'Draft') not in ('Draft', 'Ended');
    else
      v_published := coalesce(old.status, 'Draft') = 'Draft' and coalesce(new.status, 'Draft') not in ('Draft', 'Ended');
    end if;

    if v_published then
      if events.webhook_wants(new.project_id, 'event.published') then
        perform events.webhook_emit(new.project_id, 'event.published', events.api_event_json(new));
      end if;
    elsif tg_op = 'UPDATE'
          and (old.name, old.status, old.type, old.event_date, old.event_time, old.timezone, old.venue, old.address,
               old.city, old.capacity, old.visibility, old.summary, old.cover_url)
              is distinct from
              (new.name, new.status, new.type, new.event_date, new.event_time, new.timezone, new.venue, new.address,
               new.city, new.capacity, new.visibility, new.summary, new.cover_url)
          and events.webhook_wants(new.project_id, 'event.updated') then
      perform events.webhook_emit(new.project_id, 'event.updated', events.api_event_json(new));
    end if;
  exception when others then
    raise warning '[webhooks] event capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists event_orders_webhook on events.event_orders;
create trigger event_orders_webhook
  after insert or update on events.event_orders
  for each row execute function events.webhook_capture_order();

drop trigger if exists order_refunds_webhook on events.order_refunds;
create constraint trigger order_refunds_webhook
  after insert or update on events.order_refunds
  deferrable initially deferred
  for each row execute function events.webhook_capture_refund();

drop trigger if exists registrations_webhook on events.registrations;
create trigger registrations_webhook
  after insert or update on events.registrations
  for each row execute function events.webhook_capture_registration();

drop trigger if exists checkin_attendance_webhook on events.checkin_attendance;
create trigger checkin_attendance_webhook
  after insert on events.checkin_attendance
  for each row execute function events.webhook_capture_checkin();

drop trigger if exists events_webhook on events.events;
create trigger events_webhook
  after insert or update on events.events
  for each row execute function events.webhook_capture_event();

-- ---------------------------------------------------------------------------
-- Dispatcher RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Claims due deliveries (or the given ids, regardless of schedule or endpoint state) under a lease so two
-- dispatchers never send the same row; a crashed send is picked up again once the lease runs out.
create or replace function events.webhook_claim_deliveries(
  p_limit integer default 25,
  p_ids uuid[] default null,
  p_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  project_id uuid,
  endpoint_id uuid,
  url text,
  secret text,
  event_id uuid,
  event_type text,
  payload jsonb,
  occurred_at timestamptz,
  attempts integer,
  origin text
)
language plpgsql
security definer
set search_path = events, public
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select d.id
      from events.webhook_deliveries d
      join events.webhook_endpoints w on w.id = d.endpoint_id
     where d.status in ('pending', 'failed')
       and (d.locked_until is null or d.locked_until < now())
       and w.deleted_at is null
       and (
         (p_ids is null and w.active and d.next_attempt_at <= now())
         or (p_ids is not null and d.id = any (p_ids))
       )
     order by d.next_attempt_at nulls first
     limit greatest(1, least(coalesce(p_limit, 25), 100))
     for update of d skip locked
  ), claimed as (
    update events.webhook_deliveries d
       set attempts = d.attempts + 1,
           last_attempt_at = now(),
           locked_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120)))
      from due
     where d.id = due.id
    returning d.id as c_id, d.project_id as c_project, d.endpoint_id as c_endpoint, d.event_id as c_event,
              d.attempts as c_attempts, d.origin as c_origin
  )
  select c.c_id, c.c_project, c.c_endpoint, w.url, w.secret, c.c_event, e.type, e.payload, e.occurred_at,
         c.c_attempts, c.c_origin
    from claimed c
    join events.webhook_endpoints w on w.id = c.c_endpoint
    join events.webhook_events e on e.id = c.c_event;
end;
$$;

-- Records one attempt; on failure bumps the endpoint's streak and turns the endpoint off after a long one.
create or replace function events.webhook_record_attempt(
  p_delivery uuid,
  p_outcome text,
  p_next_attempt_at timestamptz default null,
  p_response_status integer default null,
  p_response_ms integer default null,
  p_response_body text default null,
  p_error text default null,
  p_disable_after integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_ok boolean := p_outcome = 'succeeded';
  v_endpoint uuid;
  v_streak integer := 0;
  v_since timestamptz;
  v_disabled boolean := false;
begin
  if p_outcome not in ('succeeded', 'failed', 'dead') then
    raise exception 'INVALID_OUTCOME' using errcode = 'check_violation';
  end if;

  update events.webhook_deliveries d
     set status = p_outcome,
         locked_until = null,
         next_attempt_at = case when p_outcome = 'failed' then coalesce(p_next_attempt_at, now() + interval '5 minutes') end,
         delivered_at = case when v_ok then now() else d.delivered_at end,
         response_status = p_response_status,
         response_ms = p_response_ms,
         response_body = left(p_response_body, 2048),
         last_error = case when v_ok then null else left(p_error, 500) end,
         attempt_log = (
           select coalesce(jsonb_agg(x.item order by x.ord), '[]'::jsonb)
             from jsonb_array_elements(
               jsonb_build_array(jsonb_build_object(
                 'at', now(), 'attempt', d.attempts, 'status', p_response_status,
                 'ms', p_response_ms, 'error', left(p_error, 200)
               )) || coalesce(d.attempt_log, '[]'::jsonb)
             ) with ordinality as x(item, ord)
            where x.ord <= 10
         )
   where d.id = p_delivery
  returning d.endpoint_id into v_endpoint;

  if v_endpoint is null then
    return null;
  end if;

  if v_ok then
    update events.webhook_endpoints
       set failure_streak = 0, last_delivery_at = now(), last_success_at = now()
     where id = v_endpoint;
  else
    update events.webhook_endpoints
       set failure_streak = failure_streak + 1, last_delivery_at = now(), last_failure_at = now()
     where id = v_endpoint
    returning failure_streak, coalesce(last_success_at, created_at) into v_streak, v_since;

    -- Only an endpoint that has kept failing for a day is turned off, so one bad deploy doesn't disable it.
    if coalesce(p_disable_after, 0) > 0 and v_streak >= p_disable_after and v_since < now() - interval '24 hours' then
      update events.webhook_endpoints
         set active = false,
             disabled_at = now(),
             disabled_reason = format(
               'Turned off automatically after %s failed deliveries in a row. Last error: %s',
               v_streak,
               coalesce(left(p_error, 200), 'HTTP ' || p_response_status::text, 'unknown')
             )
       where id = v_endpoint and active;
      v_disabled := found;
    end if;
  end if;

  return jsonb_build_object('endpoint_id', v_endpoint, 'failure_streak', v_streak, 'disabled', v_disabled);
end;
$$;

-- Trims the outbox (deliveries cascade) and stale rate-limit windows; bounded per run.
create or replace function events.webhook_housekeeping(p_keep_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_events integer;
  v_windows integer;
begin
  delete from events.webhook_events
   where id in (
     select id from events.webhook_events
      where occurred_at < now() - make_interval(days => greatest(1, coalesce(p_keep_days, 30)))
      limit 1000
   );
  get diagnostics v_events = row_count;
  delete from events.api_rate_limits where window_start < now() - interval '1 hour';
  get diagnostics v_windows = row_count;
  return jsonb_build_object('events', v_events, 'rate_windows', v_windows);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public API RPCs (service role only; every one is scoped to the key's project)
-- ---------------------------------------------------------------------------

-- Resolves a key by hash, counts the request against its window and stamps last use.
create or replace function events.api_authenticate(
  p_hash text,
  p_ip text default null,
  p_limit integer default 120,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_key events.api_keys;
  v_window_len integer := greatest(1, coalesce(p_window_seconds, 60));
  v_window timestamptz;
  v_hits integer;
begin
  select * into v_key from events.api_keys where key_hash = p_hash and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;
  if v_key.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked_key');
  end if;
  if v_key.expires_at is not null and v_key.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired_key');
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_window_len) * v_window_len);
  insert into events.api_rate_limits as l (key_id, window_start, hits)
  values (v_key.id, v_window, 1)
  on conflict (key_id, window_start) do update set hits = l.hits + 1
  returning l.hits into v_hits;

  if v_key.last_used_at is null
     or v_key.last_used_at < now() - interval '60 seconds'
     or v_key.last_used_ip is distinct from left(p_ip, 64) then
    update events.api_keys set last_used_at = now(), last_used_ip = left(p_ip, 64) where id = v_key.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'key_id', v_key.id,
    'project_id', v_key.project_id,
    'name', v_key.name,
    'scopes', to_jsonb(v_key.scopes),
    'rate', jsonb_build_object(
      'limit', p_limit,
      'remaining', greatest(0, p_limit - v_hits),
      'reset', floor(extract(epoch from v_window))::bigint + v_window_len,
      'limited', v_hits > p_limit
    )
  );
end;
$$;

create or replace function events.api_list_events(
  p_project uuid,
  p_limit integer default 25,
  p_starting_after uuid default null,
  p_status text default null,
  p_updated_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_after timestamptz;
  v_data jsonb;
  v_more boolean;
begin
  if p_starting_after is not null then
    select e.created_at into v_after from events.events e where e.id = p_starting_after and e.project_id = p_project;
    if v_after is null then
      return jsonb_build_object('error', 'invalid_cursor');
    end if;
  end if;

  with page as (
    select e as r, e.created_at as c_at, e.id as c_id
      from events.events e
     where e.project_id = p_project
       and e.deleted_at is null
       and (p_status is null or events.api_enum(e.status) = p_status)
       and (p_updated_since is null or e.updated_at >= p_updated_since)
       and (v_after is null or (e.created_at, e.id) < (v_after, p_starting_after))
     order by e.created_at desc, e.id desc
     limit v_limit + 1
  ), numbered as (
    select r, row_number() over (order by c_at desc, c_id desc) as n from page
  )
  select coalesce(jsonb_agg(events.api_event_json(r) order by n) filter (where n <= v_limit), '[]'::jsonb),
         count(*) > v_limit
    into v_data, v_more
    from numbered;

  return jsonb_build_object('data', v_data, 'has_more', coalesce(v_more, false));
end;
$$;

create or replace function events.api_get_event(p_project uuid, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select events.api_event_json(e)
    from events.events e
   where e.id = p_id and e.project_id = p_project and e.deleted_at is null;
$$;

create or replace function events.api_list_orders(
  p_project uuid,
  p_limit integer default 25,
  p_starting_after uuid default null,
  p_event uuid default null,
  p_status text default null,
  p_updated_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_after timestamptz;
  v_data jsonb;
  v_more boolean;
begin
  if p_starting_after is not null then
    select o.created_at into v_after
      from events.event_orders o
      join events.events e on e.id = o.event_id
     where o.id = p_starting_after and e.project_id = p_project;
    if v_after is null then
      return jsonb_build_object('error', 'invalid_cursor');
    end if;
  end if;

  with page as (
    select o as r, o.created_at as c_at, o.id as c_id
      from events.event_orders o
      join events.events e on e.id = o.event_id
     where e.project_id = p_project
       and (p_event is null or o.event_id = p_event)
       and (p_status is null or events.api_order_status(o.status, o.total, o.refunded_total, o.cancelled_at) = p_status)
       and (p_updated_since is null or coalesce(o.updated_at, o.created_at) >= p_updated_since)
       and (v_after is null or (o.created_at, o.id) < (v_after, p_starting_after))
     order by o.created_at desc, o.id desc
     limit v_limit + 1
  ), numbered as (
    select r, row_number() over (order by c_at desc, c_id desc) as n from page
  )
  select coalesce(jsonb_agg(events.api_order_json(r) order by n) filter (where n <= v_limit), '[]'::jsonb),
         count(*) > v_limit
    into v_data, v_more
    from numbered;

  return jsonb_build_object('data', v_data, 'has_more', coalesce(v_more, false));
end;
$$;

create or replace function events.api_get_order(p_project uuid, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select events.api_order_json(o)
    from events.event_orders o
    join events.events e on e.id = o.event_id
   where o.id = p_id and e.project_id = p_project;
$$;

create or replace function events.api_list_attendees(
  p_project uuid,
  p_limit integer default 25,
  p_starting_after uuid default null,
  p_event uuid default null,
  p_status text default null,
  p_updated_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_after timestamptz;
  v_data jsonb;
  v_more boolean;
begin
  if p_starting_after is not null then
    select g.created_at into v_after
      from events.registrations g
      join events.events e on e.id = g.event_id
     where g.id = p_starting_after and e.project_id = p_project;
    if v_after is null then
      return jsonb_build_object('error', 'invalid_cursor');
    end if;
  end if;

  with page as (
    select g as r, g.created_at as c_at, g.id as c_id
      from events.registrations g
      join events.events e on e.id = g.event_id
     where e.project_id = p_project
       and g.deleted_at is null
       and (p_event is null or g.event_id = p_event)
       and (p_status is null or events.api_enum(g.status) = p_status)
       and (p_updated_since is null or g.updated_at >= p_updated_since)
       and (v_after is null or (g.created_at, g.id) < (v_after, p_starting_after))
     order by g.created_at desc, g.id desc
     limit v_limit + 1
  ), numbered as (
    select r, row_number() over (order by c_at desc, c_id desc) as n from page
  )
  select coalesce(jsonb_agg(events.api_attendee_json(r) order by n) filter (where n <= v_limit), '[]'::jsonb),
         count(*) > v_limit
    into v_data, v_more
    from numbered;

  return jsonb_build_object('data', v_data, 'has_more', coalesce(v_more, false));
end;
$$;

create or replace function events.api_list_checkins(
  p_project uuid,
  p_limit integer default 25,
  p_starting_after uuid default null,
  p_event uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_after timestamptz;
  v_data jsonb;
  v_more boolean;
begin
  if p_starting_after is not null then
    select a.created_at into v_after
      from events.checkin_attendance a
      join events.events e on e.id = a.event_id
     where a.id = p_starting_after and e.project_id = p_project;
    if v_after is null then
      return jsonb_build_object('error', 'invalid_cursor');
    end if;
  end if;

  with page as (
    select a as r, a.created_at as c_at, a.id as c_id
      from events.checkin_attendance a
      join events.events e on e.id = a.event_id
     where e.project_id = p_project
       and a.deleted_at is null
       and (p_event is null or a.event_id = p_event)
       and (p_since is null or a.checked_in_at >= p_since)
       and (v_after is null or (a.created_at, a.id) < (v_after, p_starting_after))
     order by a.created_at desc, a.id desc
     limit v_limit + 1
  ), numbered as (
    select r, row_number() over (order by c_at desc, c_id desc) as n from page
  )
  select coalesce(jsonb_agg(events.api_checkin_json(r) order by n) filter (where n <= v_limit), '[]'::jsonb),
         count(*) > v_limit
    into v_data, v_more
    from numbered;

  return jsonb_build_object('data', v_data, 'has_more', coalesce(v_more, false));
end;
$$;

create or replace function events.api_get_checkin(p_project uuid, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = events, public
as $$
  select events.api_checkin_json(a)
    from events.checkin_attendance a
    join events.events e on e.id = a.event_id
   where a.id = p_id and e.project_id = p_project;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard health (invoker: RLS limits it to projects the member can see)
-- ---------------------------------------------------------------------------

create or replace function events.webhook_health(p_project uuid, p_since timestamptz default null)
returns table (
  endpoint_id uuid,
  total bigint,
  succeeded bigint,
  failed bigint,
  dead bigint,
  pending bigint,
  avg_ms numeric,
  last_attempt_at timestamptz
)
language sql
stable
set search_path = events, public
as $$
  select d.endpoint_id,
         count(*),
         count(*) filter (where d.status = 'succeeded'),
         count(*) filter (where d.status = 'failed'),
         count(*) filter (where d.status = 'dead'),
         count(*) filter (where d.status = 'pending'),
         round(avg(d.response_ms) filter (where d.response_ms is not null)),
         max(d.last_attempt_at)
    from events.webhook_deliveries d
   where d.project_id = p_project
     and d.created_at >= coalesce(p_since, now() - interval '7 days')
   group by d.endpoint_id;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on function events.api_enum(text) from public, anon, authenticated;
revoke all on function events.api_ticket_code(uuid) from public, anon, authenticated;
revoke all on function events.api_order_status(text, numeric, numeric, timestamptz) from public, anon, authenticated;
revoke all on function events.api_event_json(events.events) from public, anon, authenticated;
revoke all on function events.api_order_json(events.event_orders) from public, anon, authenticated;
revoke all on function events.api_refund_json(events.order_refunds) from public, anon, authenticated;
revoke all on function events.api_attendee_json(events.registrations) from public, anon, authenticated;
revoke all on function events.api_checkin_json(events.checkin_attendance) from public, anon, authenticated;
revoke all on function events.webhook_wants(uuid, text) from public, anon, authenticated;
revoke all on function events.webhook_emit(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function events.webhook_capture_order() from public, anon, authenticated;
revoke all on function events.webhook_capture_refund() from public, anon, authenticated;
revoke all on function events.webhook_capture_registration() from public, anon, authenticated;
revoke all on function events.webhook_capture_checkin() from public, anon, authenticated;
revoke all on function events.webhook_capture_event() from public, anon, authenticated;
revoke all on function events.webhook_claim_deliveries(integer, uuid[], integer) from public, anon, authenticated;
revoke all on function events.webhook_record_attempt(uuid, text, timestamptz, integer, integer, text, text, integer)
  from public, anon, authenticated;
revoke all on function events.webhook_housekeeping(integer) from public, anon, authenticated;
revoke all on function events.api_authenticate(text, text, integer, integer) from public, anon, authenticated;
revoke all on function events.api_list_events(uuid, integer, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function events.api_get_event(uuid, uuid) from public, anon, authenticated;
revoke all on function events.api_list_orders(uuid, integer, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function events.api_get_order(uuid, uuid) from public, anon, authenticated;
revoke all on function events.api_list_attendees(uuid, integer, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function events.api_list_checkins(uuid, integer, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function events.api_get_checkin(uuid, uuid) from public, anon, authenticated;
revoke all on function events.webhook_health(uuid, timestamptz) from public, anon;

grant execute on function events.webhook_claim_deliveries(integer, uuid[], integer) to service_role;
grant execute on function events.webhook_record_attempt(uuid, text, timestamptz, integer, integer, text, text, integer)
  to service_role;
grant execute on function events.webhook_housekeeping(integer) to service_role;
grant execute on function events.api_authenticate(text, text, integer, integer) to service_role;
grant execute on function events.api_list_events(uuid, integer, uuid, text, timestamptz) to service_role;
grant execute on function events.api_get_event(uuid, uuid) to service_role;
grant execute on function events.api_list_orders(uuid, integer, uuid, uuid, text, timestamptz) to service_role;
grant execute on function events.api_get_order(uuid, uuid) to service_role;
grant execute on function events.api_list_attendees(uuid, integer, uuid, uuid, text, timestamptz) to service_role;
grant execute on function events.api_list_checkins(uuid, integer, uuid, uuid, timestamptz) to service_role;
grant execute on function events.api_get_checkin(uuid, uuid) to service_role;
grant execute on function events.webhook_health(uuid, timestamptz) to authenticated, service_role;

-- @down
drop trigger if exists events_webhook on events.events;
drop trigger if exists checkin_attendance_webhook on events.checkin_attendance;
drop trigger if exists registrations_webhook on events.registrations;
drop trigger if exists order_refunds_webhook on events.order_refunds;
drop trigger if exists event_orders_webhook on events.event_orders;
drop trigger if exists event_orders_touch_updated_at on events.event_orders;
alter table events.event_orders drop column if exists updated_at;

drop function if exists events.webhook_health(uuid, timestamptz);
drop function if exists events.api_get_checkin(uuid, uuid);
drop function if exists events.api_list_checkins(uuid, integer, uuid, uuid, timestamptz);
drop function if exists events.api_list_attendees(uuid, integer, uuid, uuid, text, timestamptz);
drop function if exists events.api_get_order(uuid, uuid);
drop function if exists events.api_list_orders(uuid, integer, uuid, uuid, text, timestamptz);
drop function if exists events.api_get_event(uuid, uuid);
drop function if exists events.api_list_events(uuid, integer, uuid, text, timestamptz);
drop function if exists events.api_authenticate(text, text, integer, integer);
drop function if exists events.webhook_housekeeping(integer);
drop function if exists events.webhook_record_attempt(uuid, text, timestamptz, integer, integer, text, text, integer);
drop function if exists events.webhook_claim_deliveries(integer, uuid[], integer);
drop function if exists events.webhook_capture_event();
drop function if exists events.webhook_capture_checkin();
drop function if exists events.webhook_capture_registration();
drop function if exists events.webhook_capture_refund();
drop function if exists events.webhook_capture_order();
drop function if exists events.webhook_emit(uuid, text, jsonb);
drop function if exists events.webhook_wants(uuid, text);
drop function if exists events.api_checkin_json(events.checkin_attendance);
drop function if exists events.api_attendee_json(events.registrations);
drop function if exists events.api_refund_json(events.order_refunds);
drop function if exists events.api_order_json(events.event_orders);
drop function if exists events.api_event_json(events.events);
drop function if exists events.api_order_status(text, numeric, numeric, timestamptz);
drop function if exists events.api_ticket_code(uuid);
drop function if exists events.api_enum(text);

drop table if exists events.api_rate_limits;
drop table if exists events.webhook_deliveries;
drop table if exists events.webhook_events;
drop table if exists events.webhook_endpoints;
drop table if exists events.api_keys;
