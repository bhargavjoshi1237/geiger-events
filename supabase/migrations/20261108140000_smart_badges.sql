-- @up
-- Smart Badges: NFC chip badges as first-class credentials on events.nfc_credentials (status, serial, batch,
-- replace chain), a binding/status/rejection history log, entry-point purposes (gate | session | lead | payment | info)
-- and a purpose-aware nfc_tap(). The tap API stays backward compatible: same signature, same reasons, extra fields only.

create extension if not exists pgcrypto;

-- UID match key: uppercase alphanumerics only, so "04:a2:1f" and "04A21F" are the same chip.
create or replace function events.nfc_uid_key(p_uid text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(upper(coalesce(p_uid, '')), '[^0-9A-Z]', '', 'g');
$$;

-- ---------------------------------------------------------------------------
-- Project ids on the NFC tables (older rows could be written without one).
-- ---------------------------------------------------------------------------
update events.nfc_entry_points p set project_id = e.project_id
  from events.events e where p.project_id is null and e.id = p.event_id;
update events.nfc_credentials c set project_id = e.project_id
  from events.events e where c.project_id is null and e.id = c.event_id;
update events.nfc_taps t set project_id = e.project_id
  from events.events e where t.project_id is null and e.id = t.event_id;

-- ---------------------------------------------------------------------------
-- smart_badge_batches — a named run of badges (vendor import, generated serial range, desk issues).
-- ---------------------------------------------------------------------------
create table if not exists events.smart_badge_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  name text not null default 'Untitled batch',
  source text not null default 'import' check (source in ('import', 'generated', 'desk', 'manual')),
  badge_count integer not null default 0,
  serial_prefix text not null default '',
  serial_start integer,
  serial_digits integer,
  notes text not null default '',
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists smart_badge_batches_event_idx
  on events.smart_badge_batches (event_id, created_at desc) where deleted_at is null;
create index if not exists smart_badge_batches_project_idx
  on events.smart_badge_batches (project_id) where deleted_at is null;

drop trigger if exists smart_badge_batches_touch on events.smart_badge_batches;
create trigger smart_badge_batches_touch
  before update on events.smart_badge_batches
  for each row execute function events.touch_updated_at();

alter table events.smart_badge_batches enable row level security;
drop policy if exists smart_badge_batches_member_all on events.smart_badge_batches;
create policy smart_badge_batches_member_all on events.smart_badge_batches
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));
grant select, insert, update, delete on events.smart_badge_batches to authenticated;

-- ---------------------------------------------------------------------------
-- nfc_credentials -> smart badges. `active` stays as the legacy flag, kept in sync with `status` by trigger.
-- ---------------------------------------------------------------------------
alter table events.nfc_credentials add column if not exists status text not null default 'active';
alter table events.nfc_credentials add column if not exists serial text not null default '';
alter table events.nfc_credentials add column if not exists batch_id uuid references events.smart_badge_batches(id) on delete set null;
-- Pass-roster key of the holder (reg:<id> | order:<id>:<n> | reg:<id>:guest:<n> | speaker:<id> …), as Badge Printing uses.
alter table events.nfc_credentials add column if not exists attendee_key text;
alter table events.nfc_credentials add column if not exists replaced_by uuid references events.nfc_credentials(id) on delete set null;
alter table events.nfc_credentials add column if not exists replaces_id uuid references events.nfc_credentials(id) on delete set null;
alter table events.nfc_credentials add column if not exists issued_at timestamptz;
alter table events.nfc_credentials add column if not exists bound_at timestamptz;
alter table events.nfc_credentials add column if not exists bound_by uuid;
alter table events.nfc_credentials add column if not exists notes text not null default '';

update events.nfc_credentials set issued_at = created_at where issued_at is null;
alter table events.nfc_credentials alter column issued_at set default now();
update events.nfc_credentials set bound_at = created_at
  where bound_at is null and (registration_id is not null or order_id is not null);
update events.nfc_credentials set status = 'revoked' where active = false and status = 'active';

alter table events.nfc_credentials drop constraint if exists nfc_credentials_status_check;
alter table events.nfc_credentials add constraint nfc_credentials_status_check
  check (status in ('unassigned', 'active', 'lost', 'revoked', 'replaced'));

-- Serial-only badges (UID captured later) carry an empty UID, so uniqueness only applies to real UIDs.
drop index if exists events.events_nfc_credentials_event_uid_idx;
create unique index if not exists events_nfc_credentials_event_uid_live_idx
  on events.nfc_credentials (event_id, nfc_uid) where deleted_at is null and nfc_uid <> '';
create index if not exists events_nfc_credentials_uid_key_idx
  on events.nfc_credentials (event_id, events.nfc_uid_key(nfc_uid)) where deleted_at is null and nfc_uid <> '';
create unique index if not exists events_nfc_credentials_event_serial_idx
  on events.nfc_credentials (event_id, serial) where deleted_at is null and serial <> '';
create index if not exists events_nfc_credentials_batch_idx
  on events.nfc_credentials (batch_id) where deleted_at is null;
create index if not exists events_nfc_credentials_holder_idx
  on events.nfc_credentials (event_id, attendee_key) where deleted_at is null;
create index if not exists events_nfc_credentials_order_idx
  on events.nfc_credentials (order_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- smart_badge_events — append-only history: issue, bind/unbind, status changes, replacements, rejected taps.
-- ---------------------------------------------------------------------------
create table if not exists events.smart_badge_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete cascade,
  badge_id uuid references events.nfc_credentials(id) on delete cascade,
  kind text not null check (kind in ('issued', 'bound', 'unbound', 'rebound', 'status', 'replaced', 'deleted', 'tap_rejected')),
  from_status text,
  to_status text,
  registration_id uuid,
  order_id uuid,
  attendee_key text,
  holder_name text not null default '',
  entry_point_id uuid references events.nfc_entry_points(id) on delete set null,
  reason text not null default '',
  idempotency_key text,
  actor uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists smart_badge_events_badge_idx
  on events.smart_badge_events (badge_id, occurred_at desc) where deleted_at is null;
create index if not exists smart_badge_events_event_idx
  on events.smart_badge_events (event_id, occurred_at desc) where deleted_at is null;
-- Offline replays of a rejected tap log it once.
create unique index if not exists smart_badge_events_rejection_idem_idx
  on events.smart_badge_events (entry_point_id, idempotency_key)
  where kind = 'tap_rejected' and idempotency_key is not null and deleted_at is null;

drop trigger if exists smart_badge_events_touch on events.smart_badge_events;
create trigger smart_badge_events_touch
  before update on events.smart_badge_events
  for each row execute function events.touch_updated_at();

-- Read-only to members: rows are written by the credential trigger and the tap RPC (both SECURITY DEFINER).
alter table events.smart_badge_events enable row level security;
drop policy if exists smart_badge_events_member_read on events.smart_badge_events;
create policy smart_badge_events_member_read on events.smart_badge_events
  for select to authenticated
  using (events.can_access_project(project_id));
grant select on events.smart_badge_events to authenticated;

-- ---------------------------------------------------------------------------
-- Credential triggers: keep status/active/bound_at consistent, then log every change.
-- ---------------------------------------------------------------------------
create or replace function events.nfc_credentials_badge_sync()
returns trigger
language plpgsql
set search_path = events, public
as $$
declare
  v_bound boolean;
  v_was_bound boolean := false;
begin
  new.nfc_uid := upper(btrim(coalesce(new.nfc_uid, '')));
  new.serial := btrim(coalesce(new.serial, ''));
  new.label := coalesce(new.label, '');

  if tg_op = 'INSERT' then
    -- Legacy inserts omit status; an inactive legacy insert means disabled.
    if new.active = false and new.status in ('active', 'unassigned') then
      new.status := 'revoked';
    end if;
    if new.issued_at is null then new.issued_at := now(); end if;
  elsif new.status is distinct from old.status then
    null;
  elsif new.active is distinct from old.active then
    -- The RFID / NFC screen's Enable / Disable toggle.
    new.status := case when new.active then 'active' else 'revoked' end;
  end if;

  v_bound := new.registration_id is not null or new.order_id is not null
    or coalesce(btrim(new.attendee_key), '') <> '';
  if new.status = 'unassigned' and v_bound then
    new.status := 'active';
  elsif new.status = 'active' and not v_bound and btrim(new.label) = '' then
    new.status := 'unassigned';
  end if;
  new.active := new.status = 'active';

  if tg_op = 'UPDATE' then
    v_was_bound := old.registration_id is not null or old.order_id is not null
      or coalesce(btrim(old.attendee_key), '') <> '';
  end if;
  if v_bound and (tg_op = 'INSERT' or not v_was_bound
      or old.registration_id is distinct from new.registration_id
      or old.order_id is distinct from new.order_id
      or old.attendee_key is distinct from new.attendee_key) then
    new.bound_at := now();
    new.bound_by := coalesce(auth.uid(), new.bound_by);
  elsif not v_bound then
    new.bound_at := null;
    new.bound_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists nfc_credentials_badge_sync on events.nfc_credentials;
create trigger nfc_credentials_badge_sync
  before insert or update on events.nfc_credentials
  for each row execute function events.nfc_credentials_badge_sync();

create or replace function events.nfc_credentials_badge_log()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_reason text := coalesce(current_setting('events.badge_reason', true), '');
  v_actor uuid := auth.uid();
  v_bound boolean;
  v_was_bound boolean;
  v_holder_changed boolean;
begin
  v_project := coalesce(new.project_id, (select e.project_id from events.events e where e.id = new.event_id));
  if v_project is null then
    return null;
  end if;
  v_bound := new.registration_id is not null or new.order_id is not null
    or coalesce(btrim(new.attendee_key), '') <> '';

  if tg_op = 'INSERT' then
    insert into events.smart_badge_events
      (project_id, event_id, badge_id, kind, to_status, registration_id, order_id, attendee_key, holder_name, reason, actor, metadata)
    values
      (v_project, new.event_id, new.id, 'issued', new.status, null, null, null, '', v_reason, v_actor,
       jsonb_strip_nulls(jsonb_build_object('uid', nullif(new.nfc_uid, ''), 'serial', nullif(new.serial, ''), 'batchId', new.batch_id)));
    if v_bound then
      insert into events.smart_badge_events
        (project_id, event_id, badge_id, kind, to_status, registration_id, order_id, attendee_key, holder_name, reason, actor)
      values
        (v_project, new.event_id, new.id, 'bound', new.status, new.registration_id, new.order_id, new.attendee_key, new.label, v_reason, v_actor);
    end if;
    return null;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    insert into events.smart_badge_events
      (project_id, event_id, badge_id, kind, from_status, to_status, registration_id, order_id, attendee_key, holder_name, reason, actor)
    values
      (v_project, new.event_id, new.id, 'deleted', old.status, new.status, old.registration_id, old.order_id, old.attendee_key, old.label, v_reason, v_actor);
    return null;
  end if;

  v_was_bound := old.registration_id is not null or old.order_id is not null
    or coalesce(btrim(old.attendee_key), '') <> '';
  v_holder_changed := old.registration_id is distinct from new.registration_id
    or old.order_id is distinct from new.order_id
    or old.attendee_key is distinct from new.attendee_key;

  if v_holder_changed or (not v_was_bound and v_bound) then
    insert into events.smart_badge_events
      (project_id, event_id, badge_id, kind, from_status, to_status, registration_id, order_id, attendee_key, holder_name, reason, actor,
       metadata)
    values
      (v_project, new.event_id, new.id,
       case when v_bound and v_was_bound then 'rebound' when v_bound then 'bound' else 'unbound' end,
       old.status, new.status,
       case when v_bound then new.registration_id else old.registration_id end,
       case when v_bound then new.order_id else old.order_id end,
       case when v_bound then new.attendee_key else old.attendee_key end,
       case when v_bound then new.label else old.label end,
       v_reason, v_actor,
       case when v_bound and v_was_bound then jsonb_build_object('previousHolder', old.label) else '{}'::jsonb end);
  end if;

  if old.nfc_uid = '' and new.nfc_uid <> '' then
    insert into events.smart_badge_events
      (project_id, event_id, badge_id, kind, from_status, to_status, holder_name, reason, actor, metadata)
    values
      (v_project, new.event_id, new.id, 'issued', old.status, new.status, new.label, 'Chip UID recorded', v_actor,
       jsonb_build_object('uid', new.nfc_uid));
  end if;

  -- Status moves implied by binding (unassigned <-> active) are already covered by the bind row.
  if new.status is distinct from old.status
     and not (v_holder_changed and old.status in ('unassigned', 'active') and new.status in ('unassigned', 'active')) then
    insert into events.smart_badge_events
      (project_id, event_id, badge_id, kind, from_status, to_status, registration_id, order_id, attendee_key, holder_name, reason, actor,
       metadata)
    values
      (v_project, new.event_id, new.id,
       case when new.status = 'replaced' then 'replaced' else 'status' end,
       old.status, new.status, new.registration_id, new.order_id, new.attendee_key, new.label, v_reason, v_actor,
       jsonb_strip_nulls(jsonb_build_object('replacedBy', new.replaced_by)));
  end if;
  return null;
end;
$$;

revoke all on function events.nfc_credentials_badge_log() from public, anon, authenticated;

drop trigger if exists nfc_credentials_badge_log on events.nfc_credentials;
create trigger nfc_credentials_badge_log
  after insert or update on events.nfc_credentials
  for each row execute function events.nfc_credentials_badge_log();

-- ---------------------------------------------------------------------------
-- Entry-point purposes. Existing points default to 'gate' = admit + bill per billing mode (unchanged behaviour).
-- ---------------------------------------------------------------------------
alter table events.nfc_entry_points add column if not exists purpose text not null default 'gate';
alter table events.nfc_entry_points add column if not exists session_id text;
alter table events.nfc_entry_points add column if not exists session_name text not null default '';
alter table events.nfc_entry_points add column if not exists exhibitor_kind text;
alter table events.nfc_entry_points add column if not exists exhibitor_id uuid;
alter table events.nfc_entry_points add column if not exists exhibitor_name text not null default '';

alter table events.nfc_entry_points drop constraint if exists nfc_entry_points_purpose_check;
alter table events.nfc_entry_points add constraint nfc_entry_points_purpose_check
  check (purpose in ('gate', 'session', 'lead', 'payment', 'info'));
alter table events.nfc_entry_points drop constraint if exists nfc_entry_points_exhibitor_kind_check;
alter table events.nfc_entry_points add constraint nfc_entry_points_exhibitor_kind_check
  check (exhibitor_kind is null or exhibitor_kind in ('sponsor', 'booth', 'custom'));

-- ---------------------------------------------------------------------------
-- Tap ledger: what the tap was for and what happened.
-- ---------------------------------------------------------------------------
alter table events.nfc_taps add column if not exists purpose text not null default 'gate';
alter table events.nfc_taps add column if not exists outcome text;
alter table events.nfc_taps add column if not exists session_id text;
alter table events.nfc_taps add column if not exists lead_id uuid references events.checkin_leads(id) on delete set null;

create index if not exists events_nfc_taps_credential_idx
  on events.nfc_taps (credential_id, tapped_at desc) where deleted_at is null;
create index if not exists events_nfc_taps_event_time_idx
  on events.nfc_taps (event_id, tapped_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Leads written by exhibitor taps: deduped per exhibitor + attendee.
-- ---------------------------------------------------------------------------
alter table events.checkin_leads add column if not exists registration_id uuid;
alter table events.checkin_leads add column if not exists order_id uuid;
alter table events.checkin_leads add column if not exists exhibitor_ref text;
alter table events.checkin_leads add column if not exists attendee_ref text;

create unique index if not exists events_checkin_leads_badge_dedupe_idx
  on events.checkin_leads (event_id, exhibitor_ref, attendee_ref)
  where deleted_at is null and exhibitor_ref is not null and attendee_ref is not null;

-- ---------------------------------------------------------------------------
-- Tap helpers (internal to nfc_tap).
-- ---------------------------------------------------------------------------
create or replace function events.smart_badge_log_rejection(
  p_point events.nfc_entry_points,
  p_badge uuid,
  p_reason text,
  p_idem text,
  p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if p_point.project_id is null then
    return;
  end if;
  insert into events.smart_badge_events
    (project_id, event_id, badge_id, kind, entry_point_id, reason, idempotency_key, occurred_at, metadata)
  values
    (p_point.project_id, p_point.event_id, p_badge, 'tap_rejected', p_point.id, p_reason, p_idem, coalesce(p_at, now()),
     jsonb_build_object('point', p_point.name, 'location', p_point.location, 'purpose', coalesce(p_point.purpose, 'gate')))
  on conflict do nothing;
end;
$$;

revoke all on function events.smart_badge_log_rejection(events.nfc_entry_points, uuid, text, text, timestamptz)
  from public, anon, authenticated;

-- The reader receipt for a stored tap (fresh or replayed). Legacy fields first, Smart Badge fields after.
create or replace function events.nfc_tap_receipt(
  p_tap events.nfc_taps,
  p_point events.nfc_entry_points,
  p_deduped boolean,
  p_already boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_badge jsonb;
  v_purpose text := coalesce(nullif(p_tap.purpose, ''), 'gate');
begin
  select jsonb_build_object('id', c.id, 'serial', c.serial, 'status', c.status)
    into v_badge
    from events.nfc_credentials c
    where c.id = p_tap.credential_id;
  return jsonb_build_object(
    'ok', true,
    'deduped', p_deduped,
    'admitted', p_tap.attendance_id is not null,
    'already_in', p_already,
    'tap_id', p_tap.id,
    'attendance_id', p_tap.attendance_id,
    'status', p_tap.status,
    'amount_cents', p_tap.amount_cents,
    'currency', p_tap.currency,
    'attendee', jsonb_build_object('name', p_tap.attendee_name, 'registration_id', p_tap.registration_id, 'order_id', p_tap.order_id),
    'entry_point', jsonb_build_object('id', p_point.id, 'name', p_point.name, 'purpose', v_purpose),
    'purpose', v_purpose,
    'outcome', coalesce(p_tap.outcome, case when p_tap.attendance_id is not null then 'admitted' else 'logged' end),
    'badge', v_badge,
    'session', case when p_tap.session_id is not null then jsonb_build_object(
      'id', p_tap.session_id, 'name', coalesce(p_tap.metadata->>'sessionName', ''), 'already_in', p_already) end,
    'lead', case when p_tap.lead_id is not null then jsonb_build_object(
      'id', p_tap.lead_id, 'new', p_tap.outcome = 'lead_captured', 'exhibitor', coalesce(p_tap.metadata->>'exhibitor', '')) end
  );
end;
$$;

revoke all on function events.nfc_tap_receipt(events.nfc_taps, events.nfc_entry_points, boolean, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- nfc_tap — the hardware RPC, branching on purpose: gate = admit + bill (original), session = session attendance,
-- lead = deduped exhibitor lead, payment = bill only, info = log only. New refusal: TICKET_INVALID (gate/session).
-- ---------------------------------------------------------------------------
create or replace function events.nfc_tap(
  p_device_key text,
  p_nfc_uid text,
  p_idempotency_key text default null,
  p_tapped_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_point events.nfc_entry_points%rowtype;
  v_cred events.nfc_credentials%rowtype;
  v_existing events.nfc_taps%rowtype;
  v_reg events.registrations%rowtype;
  v_order events.event_orders%rowtype;
  v_uid text;
  v_key text;
  v_idem text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_at timestamptz := coalesce(p_tapped_at, now());
  v_purpose text;
  v_prior integer;
  v_amount integer := 0;
  v_status text := 'free';
  v_attendance uuid;
  v_already boolean := false;
  v_tap_id uuid := gen_random_uuid();
  v_name text;
  v_holder text;
  v_session text;
  v_lead uuid;
  v_lead_new boolean := false;
  v_outcome text := 'logged';
  v_ticket_ok boolean := true;
  v_email text;
  v_phone text;
  v_company text;
  v_title text;
  v_ct_company text;
  v_ct_title text;
  v_ct_phone text;
  v_exhibitor_ref text;
  v_attendee_ref text;
  v_last_move text;
begin
  if p_device_key is null or btrim(p_device_key) = '' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_POINT');
  end if;
  v_uid := upper(btrim(coalesce(p_nfc_uid, '')));
  v_key := events.nfc_uid_key(v_uid);
  if v_key = '' then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID');
  end if;

  select * into v_point
    from events.nfc_entry_points
    where device_key = btrim(p_device_key) and deleted_at is null
    limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_POINT');
  end if;
  if v_point.active = false then
    return jsonb_build_object('ok', false, 'reason', 'POINT_INACTIVE');
  end if;
  v_purpose := coalesce(nullif(v_point.purpose, ''), 'gate');

  -- Idempotent replay: same point + key returns the original receipt untouched.
  if v_idem is not null then
    select * into v_existing
      from events.nfc_taps
      where entry_point_id = v_point.id and idempotency_key = v_idem and deleted_at is null
      limit 1;
    if found then
      return events.nfc_tap_receipt(v_existing, v_point, true, false);
    end if;
  end if;

  select * into v_cred
    from events.nfc_credentials c
    where c.event_id = v_point.event_id
      and c.deleted_at is null
      and c.nfc_uid <> ''
      and events.nfc_uid_key(c.nfc_uid) = v_key
    order by (c.status = 'active') desc, c.updated_at desc
    limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID');
  end if;
  if v_cred.status = 'unassigned' then
    perform events.smart_badge_log_rejection(v_point, v_cred.id, 'UNASSIGNED', v_idem, v_at);
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID', 'badge_status', 'unassigned');
  end if;
  if v_cred.status in ('lost', 'revoked', 'replaced') or v_cred.active = false then
    perform events.smart_badge_log_rejection(v_point, v_cred.id, upper(v_cred.status), v_idem, v_at);
    return jsonb_build_object('ok', false, 'reason', 'CREDENTIAL_INACTIVE', 'badge_status', v_cred.status);
  end if;

  if v_cred.registration_id is not null then
    select * into v_reg from events.registrations where id = v_cred.registration_id;
  end if;
  if v_cred.order_id is not null then
    select * into v_order from events.event_orders where id = v_cred.order_id;
  end if;
  v_name := coalesce(
    nullif(btrim(v_cred.label), ''),
    nullif(btrim(v_reg.name), ''),
    nullif(btrim(v_order.buyer_name), ''),
    v_uid
  );
  v_holder := nullif(btrim(coalesce(v_cred.attendee_key, '')), '');

  -- A cancelled / refunded / declined ticket no longer gets through doors or into sessions.
  if v_purpose in ('gate', 'session') then
    if v_order.id is not null and (
      v_order.cancelled_at is not null
      or coalesce(v_order.status, '') in ('cancelled', 'refunded')
      or (v_order.total > 0 and coalesce(v_order.refunded_total, 0) >= v_order.total)
    ) then
      v_ticket_ok := false;
    end if;
    if v_reg.id is not null and (
      v_reg.deleted_at is not null
      or coalesce(v_reg.status, '') ~* '(waitlist|cancel|declin|reject|pending)'
    ) then
      v_ticket_ok := false;
    end if;
    if not v_ticket_ok then
      perform events.smart_badge_log_rejection(v_point, v_cred.id, 'TICKET_INVALID', v_idem, v_at);
      return jsonb_build_object('ok', false, 'reason', 'TICKET_INVALID', 'badge_status', v_cred.status,
        'attendee', jsonb_build_object('name', v_name));
    end if;
  end if;

  -- Serialise taps of one badge so two readers can't double-admit, double-bill or double-capture.
  perform pg_advisory_xact_lock(hashtext('nfc_tap:' || v_cred.id::text));
  if v_idem is not null then
    select * into v_existing
      from events.nfc_taps
      where entry_point_id = v_point.id and idempotency_key = v_idem and deleted_at is null
      limit 1;
    if found then
      return events.nfc_tap_receipt(v_existing, v_point, true, false);
    end if;
  end if;

  -- Billing (gate + payment only).
  if v_purpose in ('gate', 'payment') then
    if v_point.billing_mode = 'free' then
      v_amount := 0;
      v_status := 'free';
    elsif v_point.billing_mode = 'paid_once' then
      -- Once per holder: a replacement chip doesn't pay again.
      select count(*) into v_prior
        from events.nfc_taps t
        where t.entry_point_id = v_point.id
          and t.status in ('pending', 'settled')
          and t.deleted_at is null
          and (
            t.credential_id = v_cred.id
            or (v_holder is not null and t.credential_id in (
              select c.id from events.nfc_credentials c
              where c.event_id = v_point.event_id and c.attendee_key = v_holder
            ))
          );
      if coalesce(v_prior, 0) > 0 then
        v_amount := 0;
        v_status := 'free';
      else
        v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
        v_status := case when v_amount = 0 then 'free' else 'pending' end;
      end if;
    else
      v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
      v_status := case when v_amount = 0 then 'free' else 'pending' end;
    end if;
  end if;

  -- Presence: the door for gates, the linked session for session points. Deduped per holder, so each badge on a
  -- multi-ticket order counts once, while a party admitted by QR (no holder) covers every badge on it.
  if v_purpose = 'session' then
    v_session := nullif(btrim(coalesce(v_point.session_id, '')), '');
  end if;
  if v_purpose = 'gate' or (v_purpose = 'session' and v_session is not null) then
    -- Speakers, sponsors and team hold badges without a ticket; their roster key is the identity.
    if v_cred.registration_id is not null or v_cred.order_id is not null or v_holder is not null then
      -- Inside = the latest in/out movement for this holder in this (session, zone) scope is an 'in'; after an exit a tap re-admits.
      select a.status into v_last_move
        from events.checkin_attendance a
        where a.event_id = v_point.event_id
          and a.status in ('in', 'out')
          and a.deleted_at is null
          and a.session_id is not distinct from v_session
          and lower(coalesce(btrim(a.zone), '')) = lower(coalesce(btrim(v_point.zone), ''))
          and (
            (v_cred.registration_id is not null and a.registration_id = v_cred.registration_id)
            or (v_cred.order_id is not null and a.order_id = v_cred.order_id)
            or (v_cred.registration_id is null and v_cred.order_id is null and a.metadata->>'holder' = v_holder)
          )
          and (v_holder is null or coalesce(a.metadata->>'holder', '') in ('', v_holder))
        order by a.checked_in_at desc, a.created_at desc
        limit 1;
      if v_last_move = 'in' then
        v_already := true;
      else
        insert into events.checkin_attendance
          (event_id, project_id, registration_id, order_id, attendee_name, ticket_code, gate, zone, session_id,
           method, checked_in_by, status, metadata)
        values
          (v_point.event_id, v_point.project_id, v_cred.registration_id, v_cred.order_id, v_name,
           upper(substring(replace(coalesce(v_cred.order_id, v_cred.registration_id)::text, '-', ''), 1, 8)),
           coalesce(nullif(btrim(v_point.gate), ''), v_point.name), nullif(btrim(v_point.zone), ''), v_session,
           'rfid', 'nfc:' || v_point.name, 'in',
           jsonb_strip_nulls(jsonb_build_object('party', 1, 'holder', v_holder, 'badgeId', v_cred.id, 'entryPointId', v_point.id)))
        returning id into v_attendance;
      end if;
    end if;
    v_outcome := case
      when v_attendance is not null and v_purpose = 'session' then 'checked_in'
      when v_attendance is not null then 'admitted'
      when v_already then 'already_in'
      else 'logged'
    end;
  elsif v_purpose = 'payment' then
    v_outcome := case when v_status = 'pending' then 'charged' else 'free' end;
  end if;

  -- Lead capture for the linked exhibitor, deduped per exhibitor + attendee.
  if v_purpose = 'lead' and btrim(coalesce(v_point.exhibitor_name, '')) <> '' then
    v_exhibitor_ref := case
      when v_point.exhibitor_id is not null then coalesce(v_point.exhibitor_kind, 'custom') || ':' || v_point.exhibitor_id::text
      else 'name:' || lower(btrim(v_point.exhibitor_name))
    end;
    v_attendee_ref := coalesce(
      v_holder,
      case when v_cred.registration_id is not null then 'reg:' || v_cred.registration_id::text end,
      case when v_cred.order_id is not null then 'order:' || v_cred.order_id::text end,
      'badge:' || v_cred.id::text
    );
    v_email := coalesce(
      nullif(btrim(v_reg.email), ''),
      nullif(btrim(v_order.buyer_email), ''),
      nullif(btrim(v_cred.metadata->'holder'->>'email'), '')
    );
    v_phone := coalesce(nullif(btrim(v_reg.phone), ''), nullif(btrim(v_cred.metadata->'holder'->>'phone'), ''));
    v_company := coalesce(
      nullif(btrim(v_reg.metadata->>'company'), ''),
      (select nullif(btrim(kv.value), '') from jsonb_each_text(coalesce(v_reg.answers, '{}'::jsonb)) kv
         where kv.key ~* '(company|organi[sz]ation|employer|business)' limit 1),
      nullif(btrim(v_cred.metadata->'holder'->>'company'), '')
    );
    v_title := nullif(btrim(v_cred.metadata->'holder'->>'title'), '');
    if v_email is not null then
      select nullif(btrim(ct.company), ''), nullif(btrim(ct.title), ''), nullif(btrim(ct.phone), '')
        into v_ct_company, v_ct_title, v_ct_phone
        from events.contacts ct
        where ct.project_id = v_point.project_id and lower(ct.email) = lower(v_email) and ct.deleted_at is null
        limit 1;
      v_company := coalesce(v_company, v_ct_company);
      v_title := coalesce(v_title, v_ct_title);
      v_phone := coalesce(v_phone, v_ct_phone);
    end if;

    insert into events.checkin_leads
      (event_id, project_id, exhibitor, attendee_name, contact, captured_at, metadata,
       registration_id, order_id, exhibitor_ref, attendee_ref)
    values
      (v_point.event_id, v_point.project_id, btrim(v_point.exhibitor_name), v_name,
       jsonb_strip_nulls(jsonb_build_object('email', v_email, 'phone', v_phone, 'company', v_company, 'title', v_title)),
       v_at,
       jsonb_strip_nulls(jsonb_build_object(
         'source', 'smart_badge', 'badgeId', v_cred.id, 'entryPointId', v_point.id, 'tapId', v_tap_id,
         'taps', 1, 'lastTapAt', v_at, 'exhibitorKind', v_point.exhibitor_kind, 'exhibitorId', v_point.exhibitor_id)),
       v_cred.registration_id, v_cred.order_id, v_exhibitor_ref, v_attendee_ref)
    on conflict do nothing
    returning id into v_lead;
    if v_lead is not null then
      v_lead_new := true;
    else
      update events.checkin_leads l
        set metadata = l.metadata || jsonb_build_object(
          'taps', case when l.metadata->>'taps' ~ '^\d+$' then (l.metadata->>'taps')::integer + 1 else 2 end,
          'lastTapAt', v_at)
        where l.event_id = v_point.event_id
          and l.exhibitor_ref = v_exhibitor_ref
          and l.attendee_ref = v_attendee_ref
          and l.deleted_at is null
        returning l.id into v_lead;
    end if;
    v_outcome := case when v_lead_new then 'lead_captured' else 'lead_repeat' end;
  end if;

  insert into events.nfc_taps
    (id, project_id, event_id, entry_point_id, credential_id, registration_id, order_id, nfc_uid, attendee_name,
     amount_cents, currency, status, billing_mode, idempotency_key, tapped_at, attendance_id,
     purpose, outcome, session_id, lead_id, metadata)
  values
    (v_tap_id, v_point.project_id, v_point.event_id, v_point.id, v_cred.id, v_cred.registration_id, v_cred.order_id,
     v_uid, v_name, v_amount, coalesce(v_point.currency, 'usd'), v_status, v_point.billing_mode, v_idem, v_at,
     v_attendance, v_purpose, v_outcome, v_session, v_lead,
     jsonb_strip_nulls(jsonb_build_object(
       'point', v_point.name,
       'location', nullif(btrim(v_point.location), ''),
       'sessionName', nullif(btrim(v_point.session_name), ''),
       'exhibitor', nullif(btrim(v_point.exhibitor_name), ''),
       'holder', v_holder,
       'serial', nullif(v_cred.serial, ''))))
  returning * into v_existing;

  return events.nfc_tap_receipt(v_existing, v_point, false, v_already);
end;
$$;

grant execute on function events.nfc_tap(text, text, text, timestamptz) to anon, authenticated;

-- Provisioning check, now also reporting the purpose and what the point is linked to. Never returns the key.
create or replace function events.nfc_point_config(p_device_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_point record;
begin
  select * into v_point
    from events.nfc_entry_points
    where device_key = btrim(coalesce(p_device_key, '')) and deleted_at is null
    limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_point.id,
    'name', v_point.name,
    'location', v_point.location,
    'event_id', v_point.event_id,
    'project_id', v_point.project_id,
    'amount_cents', v_point.amount_cents,
    'currency', v_point.currency,
    'billing_mode', v_point.billing_mode,
    'active', v_point.active,
    'purpose', coalesce(v_point.purpose, 'gate'),
    'session', case when v_point.purpose = 'session' and v_point.session_id is not null
      then jsonb_build_object('id', v_point.session_id, 'name', v_point.session_name) end,
    'exhibitor', case when v_point.purpose = 'lead' and btrim(coalesce(v_point.exhibitor_name, '')) <> ''
      then jsonb_build_object('name', v_point.exhibitor_name, 'kind', v_point.exhibitor_kind) end
  );
end;
$$;

grant execute on function events.nfc_point_config(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard RPCs (SECURITY INVOKER: the member RLS policies apply to every statement).
-- ---------------------------------------------------------------------------

-- Live counters for the Smart Badges header. p_since = the viewer's local midnight.
create or replace function events.smart_badge_stats(p_event uuid, p_since timestamptz)
returns jsonb
language sql
stable
set search_path = events, public
as $$
  select jsonb_build_object(
    'taps_today', (select count(*) from events.nfc_taps t
      where t.event_id = p_event and t.deleted_at is null and t.tapped_at >= p_since),
    'active_today', (select count(distinct t.credential_id) from events.nfc_taps t
      where t.event_id = p_event and t.deleted_at is null and t.tapped_at >= p_since and t.credential_id is not null),
    'rejected_today', (select count(*) from events.smart_badge_events e
      where e.event_id = p_event and e.deleted_at is null and e.kind = 'tap_rejected' and e.occurred_at >= p_since),
    'leads', (select count(*) from events.checkin_leads l
      where l.event_id = p_event and l.deleted_at is null and l.metadata->>'source' = 'smart_badge')
  );
$$;

-- Per-badge tap count + last tap for the badge table, as one { badge_id: [taps, last_tap_at] } object (no row cap).
create or replace function events.smart_badge_tap_summary(p_event uuid)
returns jsonb
language sql
stable
set search_path = events, public
as $$
  select coalesce(jsonb_object_agg(s.credential_id, jsonb_build_array(s.taps, s.last_tap_at)), '{}'::jsonb)
  from (
    select t.credential_id, count(*) as taps, max(t.tapped_at) as last_tap_at
    from events.nfc_taps t
    where t.event_id = p_event and t.deleted_at is null and t.credential_id is not null
    group by t.credential_id
  ) s;
$$;

-- Bulk-add badges. Rows: [{ uid, serial, label?, registration_id?, order_id?, attendee_key?, holder? }].
-- A serial that already exists without a UID gets the UID attached (vendor encode-back file).
create or replace function events.smart_badge_import(p_event uuid, p_batch uuid, p_rows jsonb)
returns jsonb
language plpgsql
set search_path = events, public
as $$
declare
  v_project uuid;
  v_row jsonb;
  v_uid text;
  v_serial text;
  v_bind boolean;
  v_hit events.nfc_credentials%rowtype;
  v_created integer := 0;
  v_attached integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  select e.project_id into v_project from events.events e where e.id = p_event and e.deleted_at is null;
  if v_project is null then
    return jsonb_build_object('ok', false, 'reason', 'NO_ACCESS');
  end if;
  if p_batch is not null and not exists (
    select 1 from events.smart_badge_batches b where b.id = p_batch and b.event_id = p_event and b.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'BAD_BATCH');
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_uid := events.nfc_uid_key(v_row->>'uid');
    v_serial := btrim(coalesce(v_row->>'serial', ''));
    v_bind := coalesce(nullif(v_row->>'registration_id', ''), nullif(v_row->>'order_id', ''),
      nullif(v_row->>'attendee_key', '')) is not null;
    if v_uid = '' and v_serial = '' then
      v_skipped := v_skipped || jsonb_build_object('uid', '', 'serial', '', 'reason', 'EMPTY');
      continue;
    end if;
    if v_uid <> '' and exists (
      select 1 from events.nfc_credentials c
      where c.event_id = p_event and c.deleted_at is null and c.nfc_uid <> '' and events.nfc_uid_key(c.nfc_uid) = v_uid
    ) then
      v_skipped := v_skipped || jsonb_build_object('uid', v_uid, 'serial', v_serial, 'reason', 'DUPLICATE_UID');
      continue;
    end if;
    if v_serial <> '' then
      select * into v_hit from events.nfc_credentials c
        where c.event_id = p_event and c.deleted_at is null and c.serial = v_serial
        limit 1;
      if found then
        if v_hit.nfc_uid = '' and v_uid <> '' then
          update events.nfc_credentials c set
            nfc_uid = v_uid,
            registration_id = case when v_bind and v_hit.status = 'unassigned' then nullif(v_row->>'registration_id', '')::uuid else c.registration_id end,
            order_id = case when v_bind and v_hit.status = 'unassigned' then nullif(v_row->>'order_id', '')::uuid else c.order_id end,
            attendee_key = case when v_bind and v_hit.status = 'unassigned' then nullif(v_row->>'attendee_key', '') else c.attendee_key end,
            label = case when v_bind and v_hit.status = 'unassigned' then coalesce(v_row->>'label', '') else c.label end,
            metadata = case when v_bind and v_hit.status = 'unassigned'
              then coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('holder', coalesce(v_row->'holder', '{}'::jsonb))
              else c.metadata end
          where c.id = v_hit.id;
          v_attached := v_attached + 1;
        else
          v_skipped := v_skipped || jsonb_build_object('uid', v_uid, 'serial', v_serial, 'reason', 'DUPLICATE_SERIAL');
        end if;
        continue;
      end if;
    end if;

    insert into events.nfc_credentials
      (project_id, event_id, nfc_uid, serial, batch_id, status, registration_id, order_id, attendee_key, label, metadata)
    values
      (v_project, p_event, v_uid, v_serial, p_batch, 'unassigned',
       case when v_bind then nullif(v_row->>'registration_id', '')::uuid end,
       case when v_bind then nullif(v_row->>'order_id', '')::uuid end,
       case when v_bind then nullif(v_row->>'attendee_key', '') end,
       case when v_bind then coalesce(v_row->>'label', '') else '' end,
       case when v_bind then jsonb_build_object('holder', coalesce(v_row->'holder', '{}'::jsonb)) else '{}'::jsonb end);
    v_created := v_created + 1;
  end loop;

  if p_batch is not null then
    update events.smart_badge_batches b
      set badge_count = (select count(*) from events.nfc_credentials c where c.batch_id = p_batch and c.deleted_at is null)
      where b.id = p_batch;
  end if;
  return jsonb_build_object('ok', true, 'created', v_created, 'attached', v_attached, 'skipped', v_skipped);
end;
$$;

-- Bulk-bind spare badges to attendees. Assignments: [{ badge_id, registration_id?, order_id?, attendee_key, label, holder }].
create or replace function events.smart_badge_assign(p_event uuid, p_assignments jsonb)
returns jsonb
language plpgsql
set search_path = events, public
as $$
declare
  v_row jsonb;
  v_assigned integer := 0;
  v_skipped integer := 0;
begin
  for v_row in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    update events.nfc_credentials c set
      registration_id = nullif(v_row->>'registration_id', '')::uuid,
      order_id = nullif(v_row->>'order_id', '')::uuid,
      attendee_key = nullif(v_row->>'attendee_key', ''),
      label = coalesce(v_row->>'label', ''),
      metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('holder', coalesce(v_row->'holder', '{}'::jsonb))
    where c.id = nullif(v_row->>'badge_id', '')::uuid
      and c.event_id = p_event
      and c.deleted_at is null
      and c.status = 'unassigned';
    if found then
      v_assigned := v_assigned + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'assigned', v_assigned, 'skipped', v_skipped);
end;
$$;

-- Binding desk: tie a tapped/scanned UID to an attendee. A spare badge with that UID is bound; an unknown UID becomes a
-- new badge. p_replace marks the attendee's other live badges as replaced by this one.
create or replace function events.smart_badge_bind(
  p_event uuid,
  p_uid text,
  p_attendee jsonb,
  p_replace boolean default true,
  p_batch uuid default null
)
returns jsonb
language plpgsql
set search_path = events, public
as $$
declare
  v_project uuid;
  v_key text := events.nfc_uid_key(p_uid);
  v_hit events.nfc_credentials%rowtype;
  v_id uuid;
  v_reg uuid := nullif(p_attendee->>'registration_id', '')::uuid;
  v_ord uuid := nullif(p_attendee->>'order_id', '')::uuid;
  v_akey text := nullif(btrim(coalesce(p_attendee->>'attendee_key', '')), '');
  v_label text := btrim(coalesce(p_attendee->>'label', ''));
  v_holder jsonb := coalesce(p_attendee->'holder', '{}'::jsonb);
  v_created boolean := false;
  v_replaced uuid[] := '{}';
begin
  select e.project_id into v_project from events.events e where e.id = p_event and e.deleted_at is null;
  if v_project is null then
    return jsonb_build_object('ok', false, 'reason', 'NO_ACCESS');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'reason', 'MISSING_UID');
  end if;
  if v_reg is null and v_ord is null and v_akey is null then
    return jsonb_build_object('ok', false, 'reason', 'MISSING_ATTENDEE');
  end if;
  if p_batch is not null and not exists (
    select 1 from events.smart_badge_batches b where b.id = p_batch and b.event_id = p_event and b.deleted_at is null
  ) then
    p_batch := null;
  end if;

  perform pg_advisory_xact_lock(hashtext('smart_badge_bind:' || p_event::text || ':' || v_key));

  select * into v_hit from events.nfc_credentials c
    where c.event_id = p_event and c.deleted_at is null and c.nfc_uid <> '' and events.nfc_uid_key(c.nfc_uid) = v_key
    order by c.updated_at desc
    limit 1;
  if found then
    if v_hit.status in ('lost', 'revoked', 'replaced') then
      return jsonb_build_object('ok', false, 'reason', 'UID_INACTIVE', 'status', v_hit.status, 'badge_id', v_hit.id);
    end if;
    if v_hit.status = 'active' then
      if (v_akey is not null and v_hit.attendee_key = v_akey)
         or (v_hit.attendee_key is null and v_reg is not null and v_hit.registration_id = v_reg)
         or (v_hit.attendee_key is null and v_reg is null and v_ord is not null and v_hit.order_id = v_ord) then
        return jsonb_build_object('ok', true, 'already', true, 'badge_id', v_hit.id, 'created', false);
      end if;
      return jsonb_build_object('ok', false, 'reason', 'UID_TAKEN', 'holder', v_hit.label, 'badge_id', v_hit.id);
    end if;
    update events.nfc_credentials c set
      registration_id = v_reg, order_id = v_ord, attendee_key = v_akey, label = v_label,
      metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('holder', v_holder)
    where c.id = v_hit.id;
    v_id := v_hit.id;
  else
    insert into events.nfc_credentials
      (project_id, event_id, nfc_uid, batch_id, status, registration_id, order_id, attendee_key, label, metadata)
    values
      (v_project, p_event, v_key, p_batch, 'unassigned', v_reg, v_ord, v_akey, v_label, jsonb_build_object('holder', v_holder))
    returning id into v_id;
    v_created := true;
  end if;

  if p_replace then
    perform set_config('events.badge_reason', 'Replaced at the binding desk', true);
    with old as (
      update events.nfc_credentials c set status = 'replaced', replaced_by = v_id
      where c.event_id = p_event and c.deleted_at is null and c.id <> v_id and c.status in ('active', 'lost')
        and (
          (v_akey is not null and c.attendee_key = v_akey)
          or (c.attendee_key is null and v_reg is not null and c.registration_id = v_reg)
          or (c.attendee_key is null and v_reg is null and v_ord is not null and c.order_id = v_ord)
        )
      returning c.id
    )
    select coalesce(array_agg(old.id), '{}') into v_replaced from old;
    if coalesce(array_length(v_replaced, 1), 0) > 0 then
      update events.nfc_credentials set replaces_id = v_replaced[1] where id = v_id;
    end if;
    perform set_config('events.badge_reason', '', true);
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'badge_id', v_id, 'created', v_created, 'replaced', to_jsonb(v_replaced));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'UID_TAKEN');
end;
$$;

-- Swap a holder onto a new chip: the new UID inherits the attendee, the old badge is marked replaced.
create or replace function events.smart_badge_replace(p_badge uuid, p_new_uid text, p_reason text default '')
returns jsonb
language plpgsql
set search_path = events, public
as $$
declare
  v_old events.nfc_credentials%rowtype;
  v_res jsonb;
  v_new uuid;
begin
  select * into v_old from events.nfc_credentials where id = p_badge and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_old.status in ('replaced', 'unassigned') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_REPLACEABLE', 'status', v_old.status);
  end if;
  if events.nfc_uid_key(p_new_uid) = '' then
    return jsonb_build_object('ok', false, 'reason', 'MISSING_UID');
  end if;
  if v_old.nfc_uid <> '' and events.nfc_uid_key(v_old.nfc_uid) = events.nfc_uid_key(p_new_uid) then
    return jsonb_build_object('ok', false, 'reason', 'SAME_UID');
  end if;

  v_res := events.smart_badge_bind(
    v_old.event_id,
    p_new_uid,
    jsonb_build_object(
      'registration_id', v_old.registration_id,
      'order_id', v_old.order_id,
      'attendee_key', coalesce(v_old.attendee_key,
        case when v_old.registration_id is null and v_old.order_id is null then 'badge:' || v_old.id::text end),
      'label', v_old.label,
      'holder', coalesce(v_old.metadata->'holder', '{}'::jsonb)
    ),
    false,
    v_old.batch_id
  );
  if not coalesce((v_res->>'ok')::boolean, false) then
    return v_res;
  end if;
  v_new := (v_res->>'badge_id')::uuid;
  if v_new = v_old.id then
    return jsonb_build_object('ok', false, 'reason', 'SAME_UID');
  end if;

  perform set_config('events.badge_reason', coalesce(nullif(btrim(p_reason), ''), 'Replaced'), true);
  update events.nfc_credentials set status = 'replaced', replaced_by = v_new where id = v_old.id;
  update events.nfc_credentials set replaces_id = v_old.id where id = v_new;
  perform set_config('events.badge_reason', '', true);
  return jsonb_build_object('ok', true, 'badge_id', v_new, 'replaced', jsonb_build_array(v_old.id));
end;
$$;

-- Mark a badge lost / revoked, or reactivate a lost / revoked one. Replaced badges are final.
create or replace function events.smart_badge_set_status(p_badge uuid, p_status text, p_reason text default '')
returns jsonb
language plpgsql
set search_path = events, public
as $$
declare
  v_badge events.nfc_credentials%rowtype;
  v_now text;
begin
  if p_status not in ('active', 'lost', 'revoked') then
    return jsonb_build_object('ok', false, 'reason', 'BAD_STATUS');
  end if;
  select * into v_badge from events.nfc_credentials where id = p_badge and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_badge.status = 'replaced' then
    return jsonb_build_object('ok', false, 'reason', 'REPLACED');
  end if;
  if p_status = 'active' and v_badge.status not in ('lost', 'revoked') then
    return jsonb_build_object('ok', true, 'status', v_badge.status);
  end if;
  perform set_config('events.badge_reason', coalesce(btrim(p_reason), ''), true);
  update events.nfc_credentials set status = p_status where id = p_badge returning status into v_now;
  perform set_config('events.badge_reason', '', true);
  return jsonb_build_object('ok', true, 'status', v_now);
end;
$$;

revoke all on function events.smart_badge_stats(uuid, timestamptz) from public, anon;
revoke all on function events.smart_badge_tap_summary(uuid) from public, anon;
revoke all on function events.smart_badge_import(uuid, uuid, jsonb) from public, anon;
revoke all on function events.smart_badge_assign(uuid, jsonb) from public, anon;
revoke all on function events.smart_badge_bind(uuid, text, jsonb, boolean, uuid) from public, anon;
revoke all on function events.smart_badge_replace(uuid, text, text) from public, anon;
revoke all on function events.smart_badge_set_status(uuid, text, text) from public, anon;
grant execute on function events.smart_badge_stats(uuid, timestamptz) to authenticated;
grant execute on function events.smart_badge_tap_summary(uuid) to authenticated;
grant execute on function events.smart_badge_import(uuid, uuid, jsonb) to authenticated;
grant execute on function events.smart_badge_assign(uuid, jsonb) to authenticated;
grant execute on function events.smart_badge_bind(uuid, text, jsonb, boolean, uuid) to authenticated;
grant execute on function events.smart_badge_replace(uuid, text, text) to authenticated;
grant execute on function events.smart_badge_set_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The NFC tables shipped with open demo policies (anon could read device keys and bindings). Readers only ever need
-- the SECURITY DEFINER tap RPCs, so scope the tables to project members like the rest of Check-in.
-- ---------------------------------------------------------------------------
drop policy if exists events_nfc_entry_points_demo_all on events.nfc_entry_points;
drop policy if exists nfc_entry_points_member_all on events.nfc_entry_points;
create policy nfc_entry_points_member_all on events.nfc_entry_points
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_nfc_credentials_demo_all on events.nfc_credentials;
drop policy if exists nfc_credentials_member_all on events.nfc_credentials;
create policy nfc_credentials_member_all on events.nfc_credentials
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists events_nfc_taps_demo_all on events.nfc_taps;
drop policy if exists nfc_taps_member_all on events.nfc_taps;
create policy nfc_taps_member_all on events.nfc_taps
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.nfc_entry_points to authenticated;
grant select, insert, update, delete on events.nfc_credentials to authenticated;
grant select, insert, update, delete on events.nfc_taps to authenticated;

-- @down
-- Restores the original tap RPCs and drops the Smart Badge additions. The member-only NFC policies are kept.
drop function if exists events.smart_badge_set_status(uuid, text, text);
drop function if exists events.smart_badge_replace(uuid, text, text);
drop function if exists events.smart_badge_bind(uuid, text, jsonb, boolean, uuid);
drop function if exists events.smart_badge_assign(uuid, jsonb);
drop function if exists events.smart_badge_import(uuid, uuid, jsonb);
drop function if exists events.smart_badge_tap_summary(uuid);
drop function if exists events.smart_badge_stats(uuid, timestamptz);

create or replace function events.nfc_point_config(p_device_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_point record;
begin
  select * into v_point
    from events.nfc_entry_points
    where device_key = trim(coalesce(p_device_key, '')) and deleted_at is null
    limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_point.id, 'name', v_point.name, 'location', v_point.location,
    'event_id', v_point.event_id, 'project_id', v_point.project_id,
    'amount_cents', v_point.amount_cents, 'currency', v_point.currency,
    'billing_mode', v_point.billing_mode, 'active', v_point.active
  );
end;
$$;

create or replace function events.nfc_tap(
  p_device_key text,
  p_nfc_uid text,
  p_idempotency_key text default null,
  p_tapped_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_point record;
  v_cred record;
  v_uid text;
  v_existing record;
  v_prior_bill integer;
  v_amount integer;
  v_status text;
  v_attendance uuid;
  v_already_in boolean := false;
  v_tap_id uuid;
  v_name text;
begin
  if p_device_key is null or length(trim(p_device_key)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_POINT');
  end if;
  v_uid := upper(trim(coalesce(p_nfc_uid, '')));
  if v_uid = '' then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID');
  end if;
  select * into v_point from events.nfc_entry_points
    where device_key = trim(p_device_key) and deleted_at is null limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_POINT');
  end if;
  if v_point.active = false then
    return jsonb_build_object('ok', false, 'reason', 'POINT_INACTIVE');
  end if;
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select * into v_existing from events.nfc_taps
      where entry_point_id = v_point.id and idempotency_key = trim(p_idempotency_key) and deleted_at is null limit 1;
    if found then
      return jsonb_build_object(
        'ok', true, 'deduped', true, 'admitted', v_existing.attendance_id is not null, 'already_in', false,
        'tap_id', v_existing.id, 'attendance_id', v_existing.attendance_id, 'status', v_existing.status,
        'amount_cents', v_existing.amount_cents, 'currency', v_existing.currency,
        'attendee', jsonb_build_object('name', v_existing.attendee_name, 'registration_id', v_existing.registration_id),
        'entry_point', jsonb_build_object('id', v_point.id, 'name', v_point.name));
    end if;
  end if;
  select * into v_cred from events.nfc_credentials
    where event_id = v_point.event_id and upper(trim(nfc_uid)) = v_uid and deleted_at is null limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID');
  end if;
  if v_cred.active = false then
    return jsonb_build_object('ok', false, 'reason', 'CREDENTIAL_INACTIVE');
  end if;
  if v_point.billing_mode = 'free' then
    v_amount := 0; v_status := 'free';
  elsif v_point.billing_mode = 'paid_once' then
    select count(*) into v_prior_bill from events.nfc_taps
      where entry_point_id = v_point.id and credential_id = v_cred.id and status in ('pending', 'settled') and deleted_at is null;
    if coalesce(v_prior_bill, 0) > 0 then
      v_amount := 0; v_status := 'free';
    else
      v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
      v_status := case when v_amount = 0 then 'free' else 'pending' end;
    end if;
  else
    v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
    v_status := case when v_amount = 0 then 'free' else 'pending' end;
  end if;
  v_name := nullif(trim(coalesce(v_cred.label, '')), '');
  if v_name is null and v_cred.registration_id is not null then
    select nullif(trim(name), '') into v_name from events.registrations where id = v_cred.registration_id;
  end if;
  v_name := coalesce(v_name, v_uid);
  if v_cred.registration_id is not null then
    if exists (select 1 from events.checkin_attendance a
      where a.registration_id = v_cred.registration_id and a.status = 'in' and a.deleted_at is null) then
      v_already_in := true;
    else
      insert into events.checkin_attendance
        (event_id, project_id, registration_id, order_id, attendee_name, ticket_code, gate, zone, method, checked_in_by, status)
      values
        (v_point.event_id, v_point.project_id, v_cred.registration_id, v_cred.order_id, v_name, null,
         coalesce(v_point.gate, v_point.name), v_point.zone, 'rfid', 'nfc:' || v_point.name, 'in')
      returning id into v_attendance;
    end if;
  end if;
  insert into events.nfc_taps
    (project_id, event_id, entry_point_id, credential_id, registration_id, order_id, nfc_uid, attendee_name,
     amount_cents, currency, status, billing_mode, idempotency_key, tapped_at, attendance_id)
  values
    (v_point.project_id, v_point.event_id, v_point.id, v_cred.id, v_cred.registration_id, v_cred.order_id, v_uid,
     v_name, v_amount, coalesce(v_point.currency, 'usd'), v_status, v_point.billing_mode,
     nullif(trim(coalesce(p_idempotency_key, '')), ''), coalesce(p_tapped_at, now()), v_attendance)
  returning id into v_tap_id;
  return jsonb_build_object(
    'ok', true, 'deduped', false, 'admitted', v_attendance is not null, 'already_in', v_already_in,
    'tap_id', v_tap_id, 'attendance_id', v_attendance, 'status', v_status, 'amount_cents', v_amount,
    'currency', coalesce(v_point.currency, 'usd'),
    'attendee', jsonb_build_object('name', v_name, 'registration_id', v_cred.registration_id),
    'entry_point', jsonb_build_object('id', v_point.id, 'name', v_point.name));
end;
$$;

drop function if exists events.nfc_tap_receipt(events.nfc_taps, events.nfc_entry_points, boolean, boolean);
drop function if exists events.smart_badge_log_rejection(events.nfc_entry_points, uuid, text, text, timestamptz);

drop index if exists events.events_checkin_leads_badge_dedupe_idx;
alter table events.checkin_leads drop column if exists attendee_ref;
alter table events.checkin_leads drop column if exists exhibitor_ref;
alter table events.checkin_leads drop column if exists registration_id;
alter table events.checkin_leads drop column if exists order_id;

drop index if exists events.events_nfc_taps_credential_idx;
drop index if exists events.events_nfc_taps_event_time_idx;
alter table events.nfc_taps drop column if exists lead_id;
alter table events.nfc_taps drop column if exists session_id;
alter table events.nfc_taps drop column if exists outcome;
alter table events.nfc_taps drop column if exists purpose;

alter table events.nfc_entry_points drop constraint if exists nfc_entry_points_exhibitor_kind_check;
alter table events.nfc_entry_points drop constraint if exists nfc_entry_points_purpose_check;
alter table events.nfc_entry_points drop column if exists exhibitor_name;
alter table events.nfc_entry_points drop column if exists exhibitor_id;
alter table events.nfc_entry_points drop column if exists exhibitor_kind;
alter table events.nfc_entry_points drop column if exists session_name;
alter table events.nfc_entry_points drop column if exists session_id;
alter table events.nfc_entry_points drop column if exists purpose;

drop trigger if exists nfc_credentials_badge_log on events.nfc_credentials;
drop trigger if exists nfc_credentials_badge_sync on events.nfc_credentials;
drop function if exists events.nfc_credentials_badge_log();
drop function if exists events.nfc_credentials_badge_sync();
drop table if exists events.smart_badge_events;

drop index if exists events.events_nfc_credentials_order_idx;
drop index if exists events.events_nfc_credentials_holder_idx;
drop index if exists events.events_nfc_credentials_batch_idx;
drop index if exists events.events_nfc_credentials_event_serial_idx;
drop index if exists events.events_nfc_credentials_uid_key_idx;
drop index if exists events.events_nfc_credentials_event_uid_live_idx;
update events.nfc_credentials set deleted_at = now() where nfc_uid = '' and deleted_at is null;
create unique index if not exists events_nfc_credentials_event_uid_idx
  on events.nfc_credentials (event_id, nfc_uid) where deleted_at is null;
alter table events.nfc_credentials drop constraint if exists nfc_credentials_status_check;
alter table events.nfc_credentials drop column if exists notes;
alter table events.nfc_credentials drop column if exists bound_by;
alter table events.nfc_credentials drop column if exists bound_at;
alter table events.nfc_credentials drop column if exists issued_at;
alter table events.nfc_credentials drop column if exists replaces_id;
alter table events.nfc_credentials drop column if exists replaced_by;
alter table events.nfc_credentials drop column if exists attendee_key;
alter table events.nfc_credentials drop column if exists batch_id;
alter table events.nfc_credentials drop column if exists serial;
alter table events.nfc_credentials drop column if exists status;
drop table if exists events.smart_badge_batches;
drop function if exists events.nfc_uid_key(text);
