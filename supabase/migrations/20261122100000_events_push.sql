-- Member push notifications in their own schema, events_push: the per-member queue (which doubles as in-app history),
-- device tokens, preferences, per-project settings, audience fan-outs and dispatcher runs. Triggers on events.* tables
-- enqueue; pg_cron + pg_net wake the Next.js dispatcher (/api/internal/push/*), which renders and sends through Expo.
-- Service-role only: RLS on, no anon/authenticated policies, no schema usage for them.

-- @up
create schema if not exists events_push;
revoke all on schema events_push from public;
grant usage on schema events_push to service_role;

-- Single row: where pg_net reaches the app, the shared secret, and a global kill switch. Set by scripts/push-setup.mjs.
create table if not exists events_push.runtime (
  id boolean primary key default true check (id),
  base_url text,
  secret text,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into events_push.runtime (id) values (true) on conflict (id) do nothing;

create table if not exists events_push.devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  push_token text not null,
  platform text not null default 'unknown',
  app_version text,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists devices_token_key on events_push.devices (push_token);
create index if not exists devices_member_idx on events_push.devices (member_id) where deleted_at is null;

-- Carry over tokens registered before this schema existed (events.portal_devices stays read-only for one release).
do $$
begin
  if to_regclass('events.portal_devices') is not null then
    insert into events_push.devices (id, member_id, push_token, platform, app_version, last_seen_at, metadata, created_at, updated_at, deleted_at)
    select id, member_id, push_token, platform, app_version, last_seen_at, metadata, created_at, updated_at, deleted_at
      from events.portal_devices
    on conflict (push_token) do nothing;
  end if;
end $$;

create table if not exists events_push.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  project_id uuid,
  event_id uuid,
  type text not null,
  category text not null,
  -- Ids the renderer loads at send time ({orderId}, {threadId, messageId}, ...); `scope` groups rows that supersede.
  ref jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  send_after timestamptz not null default now(),
  expires_at timestamptz,
  -- queued · sending · sent · failed · skipped
  status text not null default 'queued',
  skip_reason text,
  attempts integer not null default 0,
  lease_until timestamptz,
  title text,
  body text,
  data jsonb,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists notifications_dedupe_key on events_push.notifications (dedupe_key);
create index if not exists notifications_due_idx on events_push.notifications (send_after) where status in ('queued', 'sending');
create index if not exists notifications_member_idx on events_push.notifications (member_id, created_at desc);
create index if not exists notifications_project_idx on events_push.notifications (project_id, created_at desc);

create table if not exists events_push.deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references events_push.notifications(id) on delete cascade,
  device_id uuid,
  push_token text not null,
  platform text,
  ticket_id text,
  -- ok · error (the Expo push ticket)
  status text not null,
  error text,
  -- pending · ok · error (the Expo receipt, checked ~15 min later)
  receipt_status text,
  receipt_error text,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists deliveries_notification_idx on events_push.deliveries (notification_id);
create index if not exists deliveries_receipt_idx on events_push.deliveries (created_at) where receipt_status = 'pending';

create table if not exists events_push.member_preferences (
  member_id uuid primary key,
  categories jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists events_push.project_settings (
  project_id uuid primary key,
  types jsonb not null default '{}'::jsonb,
  event_offsets integer[] not null default '{1440,60}',
  membership_days integer[] not null default '{7,1}',
  quiet_hours jsonb not null default '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb,
  paused boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Audience sends resolved in JS (announcements use lib/audience): one row per send, expanded by the dispatcher.
create table if not exists events_push.fanouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  event_id uuid,
  type text not null,
  ref jsonb not null default '{}'::jsonb,
  audience jsonb,
  dedupe_key text not null,
  -- pending · done · failed
  status text not null default 'pending',
  send_after timestamptz not null default now(),
  lease_until timestamptz,
  attempts integer not null default 0,
  recipients integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fanouts_dedupe_key on events_push.fanouts (dedupe_key);
create index if not exists fanouts_pending_idx on events_push.fanouts (send_after) where status = 'pending';

create table if not exists events_push.dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  -- dispatch · plan
  kind text not null,
  started_at timestamptz not null default now(),
  ms integer,
  claimed integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  planned integer not null default 0,
  error text
);
create index if not exists dispatch_runs_started_idx on events_push.dispatch_runs (started_at desc);

alter table events_push.runtime enable row level security;
alter table events_push.devices enable row level security;
alter table events_push.notifications enable row level security;
alter table events_push.deliveries enable row level security;
alter table events_push.member_preferences enable row level security;
alter table events_push.project_settings enable row level security;
alter table events_push.fanouts enable row level security;
alter table events_push.dispatch_runs enable row level security;

create or replace function events_push.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists devices_touch on events_push.devices;
create trigger devices_touch before update on events_push.devices for each row execute function events_push.touch_updated_at();
drop trigger if exists notifications_touch on events_push.notifications;
create trigger notifications_touch before update on events_push.notifications for each row execute function events_push.touch_updated_at();
drop trigger if exists fanouts_touch on events_push.fanouts;
create trigger fanouts_touch before update on events_push.fanouts for each row execute function events_push.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Enqueue. Mirrors lib/push/types.js (verify-events-push-db.mjs checks the two agree).
-- ---------------------------------------------------------------------------

create or replace function events_push.category_of(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_type in ('order_confirmed', 'ticket_gifted', 'order_cancelled', 'refund_update', 'payment_failed', 'registration_update', 'checked_in') then 'tickets'
    when p_type in ('event_starting', 'meeting_soon', 'live_starting', 'membership_expiring', 'membership_expired') then 'reminders'
    when p_type in ('event_changed', 'event_cancelled') then 'updates'
    when p_type in ('thread_reply', 'announcement', 'test') then 'messages'
    when p_type in ('chat_reply', 'chat_organiser_post', 'qa_answer') then 'community'
    when p_type like 'meeting\_%' then 'meetings'
    else 'messages'
  end;
$$;

-- Portal member ids for a set of emails (case-insensitive), skipping unknown addresses.
create or replace function events_push.member_ids_for_emails(p_emails text[])
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct m.id), '{}')
    from events.portal_members m
   where lower(m.email) = any (select lower(trim(e)) from unnest(coalesce(p_emails, '{}')) e where coalesce(trim(e), '') <> '');
$$;

-- lower(email) -> member id pairs, for the JS planner.
create or replace function events_push.members_by_emails(p_emails text[])
returns table (email text, id uuid) language sql stable security definer set search_path = '' as $$
  select distinct on (lower(m.email)) lower(m.email), m.id
    from events.portal_members m
   where lower(m.email) = any (select lower(trim(e)) from unnest(coalesce(p_emails, '{}')) e)
   order by lower(m.email), m.created_at;
$$;

-- One row per member; the per-member dedupe key makes every enqueue idempotent. With p_supersede, still-queued rows of
-- the same type, member and ref->>'scope' are skipped so only the newest goes out (event edits, quick organiser replies).
create or replace function events_push.enqueue(
  p_project uuid,
  p_event uuid,
  p_type text,
  p_members uuid[],
  p_ref jsonb default '{}'::jsonb,
  p_dedupe text default null,
  p_send_after timestamptz default null,
  p_expires_at timestamptz default null,
  p_supersede boolean default false
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_members uuid[];
  v_count integer;
  v_project uuid := p_project;
begin
  select coalesce(array_agg(distinct m), '{}') into v_members from unnest(coalesce(p_members, '{}')) m where m is not null;
  if cardinality(v_members) = 0 or coalesce(p_type, '') = '' then
    return 0;
  end if;
  if v_project is null and p_event is not null then
    select e.project_id into v_project from events.events e where e.id = p_event;
  end if;
  if p_supersede and coalesce(p_ref->>'scope', '') <> '' then
    update events_push.notifications n
       set status = 'skipped', skip_reason = 'superseded', lease_until = null
     where n.status = 'queued'
       and n.type = p_type
       and n.member_id = any (v_members)
       and n.ref->>'scope' = p_ref->>'scope';
  end if;
  insert into events_push.notifications (member_id, project_id, event_id, type, category, ref, dedupe_key, send_after, expires_at)
  select m, v_project, p_event, p_type, events_push.category_of(p_type), coalesce(p_ref, '{}'::jsonb),
         coalesce(p_dedupe, p_type || ':' || gen_random_uuid()::text) || ':' || m::text,
         coalesce(p_send_after, now()), p_expires_at
    from unnest(v_members) m
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function events_push.enqueue_emails(
  p_project uuid,
  p_event uuid,
  p_type text,
  p_emails text[],
  p_ref jsonb default '{}'::jsonb,
  p_dedupe text default null,
  p_send_after timestamptz default null,
  p_expires_at timestamptz default null,
  p_supersede boolean default false
)
returns integer language sql security definer set search_path = '' as $$
  select events_push.enqueue(p_project, p_event, p_type, events_push.member_ids_for_emails(p_emails), p_ref, p_dedupe,
                             p_send_after, p_expires_at, p_supersede);
$$;

-- Bulk insert for the JS planner: [{member, project, event, type, ref, dedupe, sendAfter, expiresAt}], dedupe as given.
create or replace function events_push.enqueue_rows(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into events_push.notifications (member_id, project_id, event_id, type, category, ref, dedupe_key, send_after, expires_at)
  select r.member, r.project, r.event, r.type, events_push.category_of(r.type), coalesce(r.ref, '{}'::jsonb),
         r.dedupe, coalesce(r."sendAfter", now()), r."expiresAt"
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
         as r(member uuid, project uuid, event uuid, type text, ref jsonb, dedupe text, "sendAfter" timestamptz, "expiresAt" timestamptz)
   where r.member is not null and coalesce(r.type, '') <> '' and coalesce(r.dedupe, '') <> ''
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Everyone holding a live ticket or a confirmed registration for an event.
create or replace function events_push.event_holder_members(p_event uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select events_push.member_ids_for_emails(array(
    select o.buyer_email from events.event_orders o
     where o.event_id = p_event and o.cancelled_at is null and coalesce(o.status, 'confirmed') in ('confirmed', 'paid')
    union
    select r.email from events.registrations r
     where r.event_id = p_event and r.deleted_at is null and r.status in ('Confirmed', 'Checked-in')
  ));
$$;

-- ---------------------------------------------------------------------------
-- Dispatcher RPCs (service role)
-- ---------------------------------------------------------------------------

-- Due rows (or the given ids, regardless of schedule) under a lease so two dispatchers never send the same row.
create or replace function events_push.claim(p_limit integer default 100, p_ids uuid[] default null, p_lease_seconds integer default 120)
returns setof events_push.notifications language plpgsql security definer set search_path = '' as $$
begin
  if p_ids is null then
    -- A dispatcher that died after Expo accepted the send: settle as sent instead of sending twice.
    update events_push.notifications n
       set status = 'sent', sent_at = coalesce(n.sent_at, now()), lease_until = null
     where n.status = 'sending' and n.lease_until < now()
       and exists (select 1 from events_push.deliveries d where d.notification_id = n.id and d.status = 'ok');
    -- A row that keeps dying mid-send stops being re-claimed.
    update events_push.notifications
       set status = 'failed', last_error = coalesce(last_error, 'Gave up after repeated dispatcher interruptions'), lease_until = null
     where status = 'sending' and lease_until < now() and attempts >= 8;
    update events_push.notifications
       set status = 'skipped', skip_reason = 'expired', lease_until = null
     where status in ('queued', 'sending')
       and expires_at is not null and expires_at <= now()
       and (status = 'queued' or lease_until < now());
  end if;
  return query
  update events_push.notifications n
     set status = 'sending', attempts = n.attempts + 1, lease_until = now() + make_interval(secs => p_lease_seconds)
   where n.id in (
     select c.id from events_push.notifications c
      where case when p_ids is not null then c.id = any (p_ids) and c.status in ('queued', 'failed', 'skipped')
                 else (c.status = 'queued' and c.send_after <= now()) or (c.status = 'sending' and c.lease_until < now())
            end
      order by c.send_after
      limit greatest(1, least(coalesce(p_limit, 100), 500))
      for update skip locked
   )
  returning n.*;
end;
$$;

create or replace function events_push.claim_fanouts(p_limit integer default 10, p_lease_seconds integer default 120)
returns setof events_push.fanouts language sql security definer set search_path = '' as $$
  update events_push.fanouts f
     set lease_until = now() + make_interval(secs => p_lease_seconds), attempts = f.attempts + 1
   where f.id in (
     select c.id from events_push.fanouts c
      where c.status = 'pending' and c.send_after <= now() and (c.lease_until is null or c.lease_until < now())
      order by c.send_after
      limit greatest(1, least(coalesce(p_limit, 10), 50))
      for update skip locked
   )
  returning f.*;
$$;

-- True when the dispatcher has work: due rows, pending fan-outs, or receipts old enough to check.
create or replace function events_push.has_work()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from events_push.notifications
                  where (status = 'queued' and send_after <= now()) or (status = 'sending' and lease_until < now()))
      or exists (select 1 from events_push.fanouts
                  where status = 'pending' and send_after <= now() and (lease_until is null or lease_until < now()))
      or exists (select 1 from events_push.deliveries
                  where receipt_status = 'pending' and created_at <= now() - interval '15 minutes');
$$;

-- pg_cron entry points: POST the app only when configured, not paused and (for dispatch) there is work.
create or replace function events_push.kick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v events_push.runtime;
begin
  select * into v from events_push.runtime where id;
  if v.paused or coalesce(v.base_url, '') = '' or coalesce(v.secret, '') = '' or not events_push.has_work() then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v.base_url, '/') || '/api/internal/push/dispatch',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v.secret),
    timeout_milliseconds := 60000
  );
end;
$$;

create or replace function events_push.kick_plan()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v events_push.runtime;
begin
  select * into v from events_push.runtime where id;
  if v.paused or coalesce(v.base_url, '') = '' or coalesce(v.secret, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v.base_url, '/') || '/api/internal/push/plan',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v.secret),
    timeout_milliseconds := 60000
  );
end;
$$;

-- For the dashboard's Scheduler tab: the two cron jobs with their latest run, and whether the runtime row is set.
create or replace function events_push.scheduler_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v events_push.runtime;
begin
  select * into v from events_push.runtime where id;
  if to_regclass('cron.job') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
               'lastRunAt', r.start_time, 'lastStatus', r.status, 'lastMessage', r.return_message) order by j.jobname), '[]'::jsonb)
        from cron.job j
        left join lateral (
          select d.start_time, d.status, d.return_message from cron.job_run_details d
           where d.jobid = j.jobid order by d.start_time desc limit 1
        ) r on true
       where j.jobname like 'events-push-%'
    $q$ into v_jobs;
  end if;
  return jsonb_build_object(
    'configured', coalesce(v.base_url, '') <> '' and coalesce(v.secret, '') <> '',
    'globalPaused', coalesce(v.paused, false),
    'jobs', v_jobs
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Capture triggers. Each one swallows its own errors so a push problem never fails the source write.
-- ---------------------------------------------------------------------------

create or replace function events_push.member_for_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from events.portal_members m where lower(m.email) = lower(trim(coalesce(p_email, ''))) limit 1;
$$;

-- Deferred to commit: buy_ticket inserts the order before it creates the buyer's portal member.
create or replace function events_push.on_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_member uuid;
  v_active boolean;
  v_was_active boolean;
  v_organizer text;
  v_event_date date;
begin
  begin
    v_member := events_push.member_for_email(new.buyer_email);
    if v_member is null then
      return null;
    end if;
    select coalesce(new.project_id, e.project_id), e.event_date into v_project, v_event_date
      from events.events e where e.id = new.event_id;
    v_active := new.cancelled_at is null and coalesce(new.status, 'confirmed') in ('confirmed', 'paid');

    if tg_op = 'INSERT' then
      v_was_active := false;
    else
      v_was_active := old.cancelled_at is null and coalesce(old.status, 'confirmed') in ('confirmed', 'paid');
    end if;

    -- Confirmed now and not before; imports of long-past events stay quiet.
    if v_active and not v_was_active and coalesce(v_event_date, current_date) >= current_date - 1 then
      v_organizer := lower(trim(coalesce(new.metadata->'group'->>'organizer', '')));
      perform events_push.enqueue(
        v_project, new.event_id,
        case when v_organizer <> '' and v_organizer <> lower(trim(new.buyer_email)) then 'ticket_gifted' else 'order_confirmed' end,
        array[v_member], jsonb_build_object('orderId', new.id), 'order_confirmed:' || new.id::text);
      -- A group buyer who isn't one of the attendees still hears that the booking went through (once per group).
      if v_organizer <> '' and new.metadata->'group'->>'index' = '0' and v_organizer <> lower(trim(new.buyer_email)) then
        perform events_push.enqueue(
          v_project, new.event_id, 'order_confirmed', array[events_push.member_for_email(v_organizer)],
          jsonb_build_object('orderId', new.id, 'groupSize', new.metadata->'group'->'size', 'organizer', true),
          'group_confirmed:' || coalesce(new.metadata->'group'->>'id', new.id::text));
      end if;
    end if;

    if tg_op = 'UPDATE'
       and old.cancelled_at is null and coalesce(old.status, '') <> 'cancelled'
       and (new.cancelled_at is not null or new.status = 'cancelled') then
      perform events_push.enqueue(v_project, new.event_id, 'order_cancelled', array[v_member],
        jsonb_build_object('orderId', new.id), 'order_cancelled:' || new.id::text);
    end if;
  exception when others then
    raise warning '[events_push] order capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Restores chat enrolment for new buyers (the latest buy_ticket stopped calling it); deferred like on_order.
create or replace function events_push.on_order_chat()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if new.cancelled_at is null and coalesce(new.status, 'confirmed') in ('confirmed', 'paid') and coalesce(new.buyer_email, '') <> '' then
      perform events.add_ticket_buyer_to_chat(new.event_id, lower(new.buyer_email), coalesce(new.buyer_name, ''));
    end if;
  exception when others then
    raise warning '[events_push] chat enrolment skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Refund decisions on requests; "refunded" shares a 10-minute per-order key with issued order_refunds so it sends once.
create or replace function events_push.on_refund_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order events.event_orders;
  v_member uuid;
begin
  begin
    if new.deleted_at is not null or new.status is not distinct from old.status
       or new.status not in ('Approved', 'Denied', 'Refunded') then
      return null;
    end if;
    select * into v_order from events.event_orders where id = new.order_id;
    v_member := events_push.member_for_email(coalesce(nullif(new.buyer_email, ''), v_order.buyer_email));
    if v_member is null then
      return null;
    end if;
    perform events_push.enqueue(
      coalesce(new.project_id, v_order.project_id), coalesce(new.event_id, v_order.event_id), 'refund_update', array[v_member],
      jsonb_build_object('orderId', new.order_id, 'refundRequestId', new.id, 'status', new.status, 'amount', new.amount),
      case when new.status = 'Refunded'
           then 'refund_done:' || coalesce(new.order_id::text, new.id::text) || ':' || floor(extract(epoch from now()) / 600)::text
           else 'refund_request:' || new.id::text || ':' || new.status end);
  exception when others then
    raise warning '[events_push] refund request capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events_push.on_order_refund()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order events.event_orders;
  v_member uuid;
begin
  begin
    if new.deleted_at is not null or new.status <> 'Issued' or (tg_op = 'UPDATE' and old.status = 'Issued') then
      return null;
    end if;
    select * into v_order from events.event_orders where id = new.order_id;
    v_member := events_push.member_for_email(v_order.buyer_email);
    if v_member is null then
      return null;
    end if;
    perform events_push.enqueue(
      coalesce(new.project_id, v_order.project_id), coalesce(new.event_id, v_order.event_id), 'refund_update', array[v_member],
      jsonb_build_object('orderId', new.order_id, 'refundId', new.id, 'status', 'Issued', 'amount', new.amount),
      'refund_done:' || new.order_id::text || ':' || floor(extract(epoch from now()) / 600)::text);
  exception when others then
    raise warning '[events_push] refund capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events_push.on_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_project uuid;
  v_event_date date;
begin
  begin
    if new.deleted_at is not null or new.status not in ('Confirmed', 'Pending', 'Waitlisted', 'Declined') then
      return null;
    end if;
    if tg_op = 'INSERT' and (new.source = 'Import' or new.status = 'Declined') then
      return null;
    end if;
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
      return null;
    end if;
    select coalesce(new.project_id, e.project_id), e.event_date into v_project, v_event_date
      from events.events e where e.id = new.event_id;
    if coalesce(v_event_date, current_date) < current_date then
      return null;
    end if;
    v_member := events_push.member_for_email(new.email);
    if v_member is null then
      return null;
    end if;
    -- A plain "you're registered" waits two minutes so a paid order's confirmation can cover it.
    perform events_push.enqueue(
      v_project, new.event_id, 'registration_update', array[v_member],
      jsonb_build_object('registrationId', new.id, 'status', new.status,
                         'previous', case when tg_op = 'UPDATE' then old.status end,
                         'position', new.waitlist_position),
      'registration:' || new.id::text || ':' || new.status,
      case when tg_op = 'INSERT' and new.status = 'Confirmed' then now() + interval '2 minutes' else now() end);
  exception when others then
    raise warning '[events_push] registration capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Once per attendee per day, so re-entry scans and multi-ticket orders don't repeat it.
create or replace function events_push.on_checkin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_member uuid;
  v_project uuid;
  v_key text;
begin
  begin
    if new.status <> 'in' or new.deleted_at is not null or (new.order_id is null and new.registration_id is null) then
      return null;
    end if;
    if new.order_id is not null then
      select o.buyer_email, coalesce(new.project_id, o.project_id) into v_email, v_project
        from events.event_orders o where o.id = new.order_id;
    end if;
    if v_email is null and new.registration_id is not null then
      select r.email, coalesce(new.project_id, r.project_id) into v_email, v_project
        from events.registrations r where r.id = new.registration_id;
    end if;
    v_member := events_push.member_for_email(v_email);
    if v_member is null then
      return null;
    end if;
    v_key := 'checked_in:' || coalesce(new.order_id, new.registration_id)::text || ':' || to_char(new.checked_in_at, 'YYYY-MM-DD');
    perform events_push.enqueue(
      v_project, new.event_id, 'checked_in', array[v_member],
      jsonb_build_object('orderId', new.order_id, 'registrationId', new.registration_id, 'checkinId', new.id, 'gate', new.gate),
      v_key, now(), new.checked_in_at + interval '6 hours');
  exception when others then
    raise warning '[events_push] check-in capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events_push.on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_changed text[] := '{}';
  v_members uuid[];
begin
  begin
    if coalesce(new.event_date, current_date) < current_date then
      return null;
    end if;
    -- Cancelled: soft-deleted or moved to a Cancelled status while it still had holders.
    if (old.deleted_at is null and new.deleted_at is not null)
       or (coalesce(old.status, '') <> 'Cancelled' and new.status = 'Cancelled') then
      v_members := events_push.event_holder_members(new.id);
      perform events_push.enqueue(new.project_id, new.id, 'event_cancelled', v_members,
        jsonb_build_object('eventId', new.id), 'event_cancelled:' || new.id::text);
      return null;
    end if;
    if new.deleted_at is not null or coalesce(new.status, 'Draft') in ('Draft', 'Ended') then
      return null;
    end if;
    if old.event_date is distinct from new.event_date or old.event_time is distinct from new.event_time
       or old.timezone is distinct from new.timezone then
      v_changed := array_append(v_changed, 'time');
    end if;
    if old.venue is distinct from new.venue or old.address is distinct from new.address or old.city is distinct from new.city then
      v_changed := array_append(v_changed, 'venue');
    end if;
    if cardinality(v_changed) = 0 then
      return null;
    end if;
    v_members := events_push.event_holder_members(new.id);
    -- Waits three minutes and supersedes earlier queued edits, so a burst of saves sends one push with the final values.
    perform events_push.enqueue(
      new.project_id, new.id, 'event_changed', v_members,
      jsonb_build_object('eventId', new.id, 'changed', to_jsonb(v_changed), 'scope', 'event:' || new.id::text),
      -- Keyed per transaction, not per content: going back to an earlier venue or time is still news.
      'event_changed:' || new.id::text || ':' || txid_current()::text,
      now() + interval '3 minutes', null, true);
  exception when others then
    raise warning '[events_push] event capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events_push.on_thread_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_thread events.portal_threads;
begin
  begin
    if new.sender <> 'organiser' then
      return null;
    end if;
    select * into v_thread from events.portal_threads where id = new.thread_id;
    if v_thread.id is null then
      return null;
    end if;
    perform events_push.enqueue(
      v_thread.project_id, v_thread.event_id, 'thread_reply', array[v_thread.member_id],
      jsonb_build_object('threadId', v_thread.id, 'messageId', new.id, 'scope', 'thread:' || v_thread.id::text),
      'thread_msg:' || new.id::text, now() + interval '20 seconds', null, true);
  exception when others then
    raise warning '[events_push] thread capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function events_push.on_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if new.module <> 'announcement' or new.status <> 'Sent' or new.deleted_at is not null then
      return null;
    end if;
    if tg_op = 'UPDATE' and old.status = 'Sent' then
      return null;
    end if;
    insert into events_push.fanouts (project_id, event_id, type, ref, audience, dedupe_key)
    values (new.project_id,
            case when coalesce(new.config->'audience'->>'eventId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then (new.config->'audience'->>'eventId')::uuid end,
            'announcement',
            jsonb_build_object('announcementId', new.id), new.config->'audience', 'announcement:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  exception when others then
    raise warning '[events_push] announcement capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Replies reach the replied-to member; an organiser's top-level post reaches the channel. Throttled to one push per
-- channel per member per five minutes through the dedupe key.
create or replace function events_push.on_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_channel events.chat_channels;
  v_parent uuid;
  v_target uuid;
  v_members uuid[];
  v_bucket text := floor(extract(epoch from now()) / 300)::text;
  v_type text;
begin
  begin
    if new.deleted_at is not null then
      return null;
    end if;
    select * into v_channel from events.chat_channels where id = new.channel_id;
    if v_channel.id is null or v_channel.deleted_at is not null or v_channel.status <> 'active' then
      return null;
    end if;
    if coalesce(new.metadata->>'replyTo', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_parent := (new.metadata->>'replyTo')::uuid;
      select m.author_member_id into v_target from events.chat_messages m where m.id = v_parent;
      if v_target is not null and v_target is distinct from new.author_member_id then
        v_type := case when v_channel.kind = 'qa' and new.sender_kind = 'organiser' then 'qa_answer' else 'chat_reply' end;
        perform events_push.enqueue(
          v_channel.project_id, v_channel.event_id, v_type, array[v_target],
          jsonb_build_object('channelId', v_channel.id, 'messageId', new.id, 'kind', v_channel.kind),
          v_type || ':' || v_channel.id::text || ':' || v_bucket);
      end if;
      return null;
    end if;
    if new.sender_kind = 'organiser' then
      select coalesce(array_agg(p.member_id), '{}') into v_members
        from events.chat_participants p
       where p.channel_id = v_channel.id and p.member_id is not null and p.member_id is distinct from new.author_member_id;
      perform events_push.enqueue(
        v_channel.project_id, v_channel.event_id, 'chat_organiser_post', v_members,
        jsonb_build_object('channelId', v_channel.id, 'messageId', new.id, 'kind', v_channel.kind),
        'chat_org:' || v_channel.id::text || ':' || v_bucket);
    end if;
  exception when others then
    raise warning '[events_push] chat capture skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists event_orders_push on events.event_orders;
create constraint trigger event_orders_push
  after insert or update on events.event_orders
  deferrable initially deferred
  for each row execute function events_push.on_order();

drop trigger if exists event_orders_chat_enrol on events.event_orders;
create constraint trigger event_orders_chat_enrol
  after insert on events.event_orders
  deferrable initially deferred
  for each row execute function events_push.on_order_chat();

drop trigger if exists refund_requests_push on events.refund_requests;
create trigger refund_requests_push
  after update on events.refund_requests
  for each row execute function events_push.on_refund_request();

drop trigger if exists order_refunds_push on events.order_refunds;
create constraint trigger order_refunds_push
  after insert or update on events.order_refunds
  deferrable initially deferred
  for each row execute function events_push.on_order_refund();

drop trigger if exists registrations_push on events.registrations;
create constraint trigger registrations_push
  after insert or update on events.registrations
  deferrable initially deferred
  for each row execute function events_push.on_registration();

drop trigger if exists checkin_attendance_push on events.checkin_attendance;
create trigger checkin_attendance_push
  after insert on events.checkin_attendance
  for each row execute function events_push.on_checkin();

drop trigger if exists events_push on events.events;
create trigger events_push
  after update on events.events
  for each row execute function events_push.on_event();

drop trigger if exists portal_thread_messages_push on events.portal_thread_messages;
create trigger portal_thread_messages_push
  after insert on events.portal_thread_messages
  for each row execute function events_push.on_thread_message();

drop trigger if exists community_records_push on events.community_records;
create trigger community_records_push
  after insert or update on events.community_records
  for each row execute function events_push.on_announcement();

drop trigger if exists chat_messages_push on events.chat_messages;
create trigger chat_messages_push
  after insert on events.chat_messages
  for each row execute function events_push.on_chat_message();

-- Back-fill chat enrolment for buyers who bought while it was broken: event chats plus open-audience Q&A threads.
insert into events.chat_participants (channel_id, member_id, role)
select distinct c.id, m.id, 'member'
  from events.event_orders o
  join events.portal_members m on lower(m.email) = lower(o.buyer_email)
  join events.chat_channels c on c.event_id = o.event_id and c.deleted_at is null
   and (c.kind = 'event' or (c.kind = 'qa' and coalesce(c.metadata->>'audience', 'all') = 'all'))
 where o.cancelled_at is null and coalesce(o.status, 'confirmed') in ('confirmed', 'paid') and coalesce(o.buyer_email, '') <> ''
on conflict (channel_id, member_id) where member_id is not null do nothing;

-- ---------------------------------------------------------------------------
-- Grants: service role only.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema events_push from public, anon, authenticated;
revoke all on all functions in schema events_push from public, anon, authenticated;
grant all on all tables in schema events_push to service_role;
grant execute on all functions in schema events_push to service_role;
alter default privileges in schema events_push revoke all on tables from public, anon, authenticated;
alter default privileges in schema events_push revoke execute on functions from public, anon, authenticated;
alter default privileges in schema events_push grant all on tables to service_role;
alter default privileges in schema events_push grant execute on functions to service_role;

-- ---------------------------------------------------------------------------
-- Scheduler: pg_cron every 30 s (dispatch, only when there's work) and every 5 min (plan). Skipped where unavailable.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron;
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname in ('events-push-dispatch', 'events-push-plan');
    perform cron.schedule('events-push-dispatch', '30 seconds', 'select events_push.kick()');
    perform cron.schedule('events-push-plan', '*/5 * * * *', 'select events_push.kick_plan()');
  end if;
end $$;

-- @down
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname in ('events-push-dispatch', 'events-push-plan');
  end if;
end $$;
drop trigger if exists event_orders_push on events.event_orders;
drop trigger if exists event_orders_chat_enrol on events.event_orders;
drop trigger if exists refund_requests_push on events.refund_requests;
drop trigger if exists order_refunds_push on events.order_refunds;
drop trigger if exists registrations_push on events.registrations;
drop trigger if exists checkin_attendance_push on events.checkin_attendance;
drop trigger if exists events_push on events.events;
drop trigger if exists portal_thread_messages_push on events.portal_thread_messages;
drop trigger if exists community_records_push on events.community_records;
drop trigger if exists chat_messages_push on events.chat_messages;
drop schema if exists events_push cascade;
