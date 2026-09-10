-- No @down section — this migration cannot be rolled back.

-- @up
-- ===========================================================================
-- Geiger Events — NFC paid entry points + pass-based billing
--
-- Lets an organizer turn any physical spot (ride gate, VIP zone, bar counter,
-- activity desk) into a *paid tap point*:
--
--   events.nfc_entry_points — one row per scanning device/point. Carries the
--                             price snapshot (amount_cents + currency), the
--                             billing mode, and the device_key secret that the
--                             hardware reader presents on every tap.
--   events.nfc_credentials  — NFC UID <-> attendee binding (one UID per event,
--                             linked to a registration and/or order).
--   events.nfc_taps         — the ledger. One row per tap: the amount snapshot
--                             taken at tap time plus a lifecycle status
--                             (pending | settled | void | free). "Pending bill"
--                             = sum of pending taps per attendee.
--
-- Hardware never touches these tables directly. It calls POST /api/nfc/tap,
-- which delegates to the SECURITY DEFINER events.nfc_tap() RPC below — the
-- same pattern as checkin_admit() for the staff scanner routes: the anon key
-- is safe to ship on a device because the device_key secret is validated
-- server-side inside the RPC.
--
-- Billing modes (nfc_entry_points.billing_mode):
--   free           — admit only, no charge (tap recorded as status 'free').
--   paid_every_tap — every tap bills (bar items, per-ride charges).
--   paid_once      — first tap per credential bills; re-taps admit free.
--
-- Self-contained and idempotent: safe to run repeatedly. Runs after
-- checkin.sql (reuses events.touch_updated_at()). Demo-open RLS mirrors the
-- other check-in tables; org-scoped member policies are finalized in
-- zz_project_access.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- nfc_entry_points — one row per scanning device / paid spot.
-- ---------------------------------------------------------------------------
create table if not exists events.nfc_entry_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete cascade,
  name text not null default 'Untitled point',
  location text not null default '',
  -- Optional link to a gate/zone name from the event's checkinGates config,
  -- so taps also show up grouped in Real-time Attendance.
  gate text,
  zone text,
  -- Price snapshot inputs. amount_cents is authoritative; the RPC copies it
  -- onto every tap so later price edits never rewrite history.
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  -- free | paid_every_tap | paid_once
  billing_mode text not null default 'paid_every_tap',
  active boolean not null default true,
  -- Secret provisioned onto the hardware reader. Presented as
  -- `x-nfc-device-key` / `device_key` on every tap call. Rotate by writing a
  -- new value; the old one stops working immediately.
  device_key text,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.nfc_entry_points add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.nfc_entry_points add column if not exists event_id uuid references events.events(id) on delete cascade;
alter table events.nfc_entry_points add column if not exists name text not null default 'Untitled point';
alter table events.nfc_entry_points add column if not exists location text not null default '';
alter table events.nfc_entry_points add column if not exists gate text;
alter table events.nfc_entry_points add column if not exists zone text;
alter table events.nfc_entry_points add column if not exists amount_cents integer not null default 0;
alter table events.nfc_entry_points add column if not exists currency text not null default 'usd';
alter table events.nfc_entry_points add column if not exists billing_mode text not null default 'paid_every_tap';
alter table events.nfc_entry_points add column if not exists active boolean not null default true;
alter table events.nfc_entry_points add column if not exists device_key text;
alter table events.nfc_entry_points add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.nfc_entry_points add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.nfc_entry_points add column if not exists deleted_at timestamptz;

alter table events.nfc_entry_points drop constraint if exists nfc_entry_points_billing_mode_check;
alter table events.nfc_entry_points add constraint nfc_entry_points_billing_mode_check
  check (billing_mode in ('free', 'paid_every_tap', 'paid_once'));

-- A device key identifies exactly one live point. Partial so key-less draft
-- rows (and soft-deleted rows) never collide.
create unique index if not exists events_nfc_entry_points_device_key_idx
  on events.nfc_entry_points (device_key) where deleted_at is null and device_key is not null;
create index if not exists events_nfc_entry_points_event_idx
  on events.nfc_entry_points (event_id) where deleted_at is null;
create index if not exists events_nfc_entry_points_project_idx
  on events.nfc_entry_points (project_id) where deleted_at is null;

drop trigger if exists nfc_entry_points_touch_updated_at on events.nfc_entry_points;
create trigger nfc_entry_points_touch_updated_at
before update on events.nfc_entry_points
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- nfc_credentials — NFC UID <-> attendee binding.
-- ---------------------------------------------------------------------------
create table if not exists events.nfc_credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete cascade,
  registration_id uuid,
  order_id uuid,
  -- The UID read off the wristband/card by the hardware (stored upper-cased,
  -- trimmed by the app layer; the RPC matches case-insensitively anyway).
  nfc_uid text not null default '',
  label text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.nfc_credentials add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.nfc_credentials add column if not exists event_id uuid references events.events(id) on delete cascade;
alter table events.nfc_credentials add column if not exists registration_id uuid;
alter table events.nfc_credentials add column if not exists order_id uuid;
alter table events.nfc_credentials add column if not exists nfc_uid text not null default '';
alter table events.nfc_credentials add column if not exists label text not null default '';
alter table events.nfc_credentials add column if not exists active boolean not null default true;
alter table events.nfc_credentials add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.nfc_credentials add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.nfc_credentials add column if not exists deleted_at timestamptz;

-- One UID maps to exactly one live binding per event.
create unique index if not exists events_nfc_credentials_event_uid_idx
  on events.nfc_credentials (event_id, nfc_uid) where deleted_at is null;
create index if not exists events_nfc_credentials_registration_idx
  on events.nfc_credentials (registration_id) where deleted_at is null;
create index if not exists events_nfc_credentials_event_idx
  on events.nfc_credentials (event_id) where deleted_at is null;

drop trigger if exists nfc_credentials_touch_updated_at on events.nfc_credentials;
create trigger nfc_credentials_touch_updated_at
before update on events.nfc_credentials
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- nfc_taps — the billing ledger. One row per tap.
-- ---------------------------------------------------------------------------
create table if not exists events.nfc_taps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete cascade,
  entry_point_id uuid references events.nfc_entry_points(id) on delete set null,
  credential_id uuid references events.nfc_credentials(id) on delete set null,
  registration_id uuid,
  order_id uuid,
  nfc_uid text not null default '',
  attendee_name text not null default '',
  -- Amount snapshot copied from the entry point at tap time.
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  -- pending | settled | void | free
  status text not null default 'pending',
  -- Snapshot of the point's billing mode at tap time (audit trail).
  billing_mode text not null default 'paid_every_tap',
  -- Hardware-supplied idempotency key (offline replays reuse it). Scoped to
  -- the entry point so two readers can share a counter scheme safely.
  idempotency_key text,
  tapped_at timestamptz not null default now(),
  settled_at timestamptz,
  settled_by text,
  -- The checkin_attendance row created for first-entry presence (null when the
  -- attendee was already inside or the point is purchase-only traffic).
  attendance_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.nfc_taps add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.nfc_taps add column if not exists event_id uuid references events.events(id) on delete cascade;
alter table events.nfc_taps add column if not exists entry_point_id uuid references events.nfc_entry_points(id) on delete set null;
alter table events.nfc_taps add column if not exists credential_id uuid references events.nfc_credentials(id) on delete set null;
alter table events.nfc_taps add column if not exists registration_id uuid;
alter table events.nfc_taps add column if not exists order_id uuid;
alter table events.nfc_taps add column if not exists nfc_uid text not null default '';
alter table events.nfc_taps add column if not exists attendee_name text not null default '';
alter table events.nfc_taps add column if not exists amount_cents integer not null default 0;
alter table events.nfc_taps add column if not exists currency text not null default 'usd';
alter table events.nfc_taps add column if not exists status text not null default 'pending';
alter table events.nfc_taps add column if not exists billing_mode text not null default 'paid_every_tap';
alter table events.nfc_taps add column if not exists idempotency_key text;
alter table events.nfc_taps add column if not exists tapped_at timestamptz not null default now();
alter table events.nfc_taps add column if not exists settled_at timestamptz;
alter table events.nfc_taps add column if not exists settled_by text;
alter table events.nfc_taps add column if not exists attendance_id uuid;
alter table events.nfc_taps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.nfc_taps add column if not exists deleted_at timestamptz;

alter table events.nfc_taps drop constraint if exists nfc_taps_status_check;
alter table events.nfc_taps add constraint nfc_taps_status_check
  check (status in ('pending', 'settled', 'void', 'free'));

-- Offline-safe replay: the same (point, key) pair returns the original tap.
create unique index if not exists events_nfc_taps_point_idem_idx
  on events.nfc_taps (entry_point_id, idempotency_key)
  where deleted_at is null and idempotency_key is not null;
create index if not exists events_nfc_taps_event_idx
  on events.nfc_taps (event_id) where deleted_at is null;
create index if not exists events_nfc_taps_registration_idx
  on events.nfc_taps (registration_id) where deleted_at is null;
create index if not exists events_nfc_taps_status_idx
  on events.nfc_taps (event_id, status) where deleted_at is null;

drop trigger if exists nfc_taps_touch_updated_at on events.nfc_taps;
create trigger nfc_taps_touch_updated_at
before update on events.nfc_taps
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- nfc_tap — the hardware entry RPC. Validates the device key, resolves the
-- UID to a bound attendee, records presence + the billing line, atomically.
--
-- Returns one of:
--   { ok:true, deduped, admitted, already_in, tap_id, attendance_id,
--     status, amount_cents, currency,
--     attendee:{ name, registration_id }, entry_point:{ id, name } }
--   { ok:false, reason }  -- INVALID_POINT | POINT_INACTIVE | UNKNOWN_UID |
--                            CREDENTIAL_INACTIVE
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

  select * into v_point
    from events.nfc_entry_points
    where device_key = trim(p_device_key)
      and deleted_at is null
    limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_POINT');
  end if;
  if v_point.active = false then
    return jsonb_build_object('ok', false, 'reason', 'POINT_INACTIVE');
  end if;

  -- Idempotent replay: same point + key returns the original tap untouched.
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select * into v_existing
      from events.nfc_taps
      where entry_point_id = v_point.id
        and idempotency_key = trim(p_idempotency_key)
        and deleted_at is null
      limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'deduped', true,
        'admitted', v_existing.attendance_id is not null,
        'already_in', false,
        'tap_id', v_existing.id,
        'attendance_id', v_existing.attendance_id,
        'status', v_existing.status,
        'amount_cents', v_existing.amount_cents,
        'currency', v_existing.currency,
        'attendee', jsonb_build_object('name', v_existing.attendee_name, 'registration_id', v_existing.registration_id),
        'entry_point', jsonb_build_object('id', v_point.id, 'name', v_point.name)
      );
    end if;
  end if;

  select * into v_cred
    from events.nfc_credentials
    where event_id = v_point.event_id
      and upper(trim(nfc_uid)) = v_uid
      and deleted_at is null
    limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_UID');
  end if;
  if v_cred.active = false then
    return jsonb_build_object('ok', false, 'reason', 'CREDENTIAL_INACTIVE');
  end if;

  -- Price + status decision from the point's current config.
  if v_point.billing_mode = 'free' then
    v_amount := 0;
    v_status := 'free';
  elsif v_point.billing_mode = 'paid_once' then
    select count(*) into v_prior_bill
      from events.nfc_taps
      where entry_point_id = v_point.id
        and credential_id = v_cred.id
        and status in ('pending', 'settled')
        and deleted_at is null;
    if coalesce(v_prior_bill, 0) > 0 then
      v_amount := 0;
      v_status := 'free'; -- re-entry: admit, no new charge
    else
      v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
      v_status := case when v_amount = 0 then 'free' else 'pending' end;
    end if;
  else -- paid_every_tap
    v_amount := greatest(0, coalesce(v_point.amount_cents, 0));
    v_status := case when v_amount = 0 then 'free' else 'pending' end;
  end if;

  -- Resolve a display name: credential label, else the registration, else UID.
  v_name := nullif(trim(coalesce(v_cred.label, '')), '');
  if v_name is null and v_cred.registration_id is not null then
    select nullif(trim(name), '') into v_name
      from events.registrations
      where id = v_cred.registration_id;
  end if;
  v_name := coalesce(v_name, v_uid);

  -- Presence: first tap admits (method rfid); later taps keep the original
  -- row so Real-time Attendance (distinct count) never inflates.
  if v_cred.registration_id is not null then
    if exists (
      select 1 from events.checkin_attendance a
      where a.registration_id = v_cred.registration_id
        and a.status = 'in'
        and a.deleted_at is null
    ) then
      v_already_in := true;
    else
      insert into events.checkin_attendance
        (event_id, project_id, registration_id, order_id, attendee_name,
         ticket_code, gate, zone, method, checked_in_by, status)
      values
        (v_point.event_id, v_point.project_id, v_cred.registration_id, v_cred.order_id,
         v_name, null, coalesce(v_point.gate, v_point.name), v_point.zone,
         'rfid', 'nfc:' || v_point.name, 'in')
      returning id into v_attendance;
    end if;
  end if;

  insert into events.nfc_taps
    (project_id, event_id, entry_point_id, credential_id, registration_id,
     order_id, nfc_uid, attendee_name, amount_cents, currency, status,
     billing_mode, idempotency_key, tapped_at, attendance_id)
  values
    (v_point.project_id, v_point.event_id, v_point.id, v_cred.id,
     v_cred.registration_id, v_cred.order_id, v_uid, v_name, v_amount,
     coalesce(v_point.currency, 'usd'), v_status, v_point.billing_mode,
     nullif(trim(coalesce(p_idempotency_key, '')), ''),
     coalesce(p_tapped_at, now()), v_attendance)
  returning id into v_tap_id;

  return jsonb_build_object(
    'ok', true,
    'deduped', false,
    'admitted', v_attendance is not null,
    'already_in', v_already_in,
    'tap_id', v_tap_id,
    'attendance_id', v_attendance,
    'status', v_status,
    'amount_cents', v_amount,
    'currency', coalesce(v_point.currency, 'usd'),
    'attendee', jsonb_build_object('name', v_name, 'registration_id', v_cred.registration_id),
    'entry_point', jsonb_build_object('id', v_point.id, 'name', v_point.name)
  );
end;
$$;

grant execute on function events.nfc_tap(text, text, text, timestamptz)
  to anon, authenticated;

-- Look up a point's public config for device provisioning checks
-- (GET /api/nfc/tap?device_key=…). Never returns the key itself.
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
    where device_key = trim(coalesce(p_device_key, ''))
      and deleted_at is null
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
    'active', v_point.active
  );
end;
$$;

grant execute on function events.nfc_point_config(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Open demo policies (anon key) — replaced with org-scoped member
-- policies in zz_project_access.sql, like the other check-in tables.
-- ---------------------------------------------------------------------------
alter table events.nfc_entry_points enable row level security;
alter table events.nfc_credentials enable row level security;
alter table events.nfc_taps enable row level security;

drop policy if exists events_nfc_entry_points_demo_all on events.nfc_entry_points;
create policy events_nfc_entry_points_demo_all on events.nfc_entry_points
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_nfc_credentials_demo_all on events.nfc_credentials;
create policy events_nfc_credentials_demo_all on events.nfc_credentials
  for all to anon, authenticated using (true) with check (true);

drop policy if exists events_nfc_taps_demo_all on events.nfc_taps;
create policy events_nfc_taps_demo_all on events.nfc_taps
  for all to anon, authenticated using (true) with check (true);

-- No demo seed. Points, bindings and taps are event-scoped and created in-app.
