-- @up
-- NFC gate (and zoned session) taps obey the same hard caps as the scanners (checkin_capacity, 20261108130000).
-- nfc_tap keeps its signature and the smart-badges body (20261108140000); the only change is a cap check before a new
-- presence row: a full area refuses with CAPACITY_FULL (zone, occupancy, cap), logged on the badge like other refusals.

-- Would admitting p_party more people break the hard cap governing this (zone, session) scope? { zone, occupancy, cap } if so,
-- else null. Takes the same per-area lock as checkin_admit, so readers and scanners can't jointly overshoot a cap.
create or replace function events.checkin_capacity_full(p_event uuid, p_zone text, p_session text, p_party integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_zone text := nullif(btrim(coalesce(p_zone, '')), '');
  v_session text := nullif(btrim(coalesce(p_session, '')), '');
  v_cap events.checkin_capacity;
  v_occ integer;
begin
  select * into v_cap from events.checkin_capacity c
    where c.event_id = p_event and c.deleted_at is null and c.hard_cap is not null
      and (
        (v_zone is not null and c.zone_key <> '' and lower(btrim(c.zone_name)) = lower(v_zone))
        or (v_zone is null and v_session is null and c.zone_key = '')
      )
    limit 1;
  if v_cap.id is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('checkin-cap:' || p_event::text || ':' || lower(coalesce(v_zone, ''))));
  v_occ := events.checkin_zone_occupancy(p_event, v_zone);
  if v_occ + greatest(1, coalesce(p_party, 1)) > v_cap.hard_cap then
    return jsonb_build_object('zone', coalesce(v_zone, ''), 'occupancy', v_occ, 'cap', v_cap.hard_cap);
  end if;
  return null;
end;
$$;

revoke all on function events.checkin_capacity_full(uuid, text, text, integer) from public, anon, authenticated;

-- nfc_tap — as in 20261108140000_smart_badges.sql, plus the cap check before admitting someone not already inside.
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
  v_full jsonb;
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
        -- Same hard caps as the scanners; a reader can't override, so a full area refuses (someone already inside never gets here).
        v_full := events.checkin_capacity_full(v_point.event_id, v_point.zone, v_session, 1);
        if v_full is not null then
          perform events.smart_badge_log_rejection(v_point, v_cred.id, 'CAPACITY_FULL', v_idem, v_at);
          return jsonb_build_object('ok', false, 'reason', 'CAPACITY_FULL', 'badge_status', v_cred.status,
            'attendee', jsonb_build_object('name', v_name)) || v_full;
        end if;
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

-- @down
-- The nfc_tap from 20261108140000_smart_badges.sql.
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

drop function if exists events.checkin_capacity_full(uuid, text, text, integer);
