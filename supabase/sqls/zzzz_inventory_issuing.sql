-- ===========================================================================
-- Geiger Events — Inventory issuing (hand-out to buyers)
--
-- Turns an event allocation into something staff can actually hand out, and
-- records who received what.
--
-- The design principle mirrors the rest of the module: just as items.on_hand is
-- DERIVED from the append-only movement ledger, entitlements are DERIVED from
-- the allocation's rules evaluated against a buyer's order/registration. Nothing
-- materialises "person X is owed a t-shirt" — change a rule and every buyer's
-- entitlement changes instantly, with no backfill and no stale rows.
--
-- The one thing stored is the REDEMPTION ledger: what was actually handed over.
--
-- Adds:
--   * inventory_redemptions   — the hand-out ledger, one row per collection.
--   * allocation rule columns — period_mode/period_config/session_ids/audience.
--   * 'issue' staff-code type — a third code space beside staff/kiosk.
--   * issue_* RPCs            — SECURITY DEFINER, code-gated, anon-callable, so
--                               an unauthenticated staff device can look up a
--                               buyer and issue stock without RLS exposure.
--
-- Runs after inventory.sql, orders.sql, checkin.sql, registrations.sql,
-- zz_project_access.sql and zzz_orders_management.sql (filename order).
-- Self-contained + idempotent.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff codes: a third code space. An issuing code must not open /door or
-- /kiosk, so it gets its own type rather than reusing the scanning roles.
-- ---------------------------------------------------------------------------
alter table events.checkin_staff_roles drop constraint if exists checkin_staff_roles_type_check;
alter table events.checkin_staff_roles add constraint checkin_staff_roles_type_check
  check (type in ('staff', 'kiosk', 'issue'));

-- ---------------------------------------------------------------------------
-- Allocation rules. The issuance mode says WHO qualifies; the period mode says
-- HOW OFTEN they may collect.
-- ---------------------------------------------------------------------------
alter table events.inventory_allocations
  add column if not exists period_mode text not null default 'none';
-- { windows: [{ id, label, startAt, endAt }], intervalHours: 2, totalCap: 3 }
alter table events.inventory_allocations
  add column if not exists period_config jsonb not null default '{}'::jsonb;
-- Agenda session ids (events.conference_records where module = 'session').
alter table events.inventory_allocations
  add column if not exists session_ids jsonb not null default '[]'::jsonb;
-- Audience spec, same serialisable shape as lib/audience/resolve.js.
alter table events.inventory_allocations
  add column if not exists audience jsonb not null default '{}'::jsonb;

alter table events.inventory_allocations drop constraint if exists inventory_allocations_issuance_check;
alter table events.inventory_allocations add constraint inventory_allocations_issuance_check
  check (issuance in ('internal', 'ticket', 'addon', 'session', 'all', 'audience'));

alter table events.inventory_allocations drop constraint if exists inventory_allocations_period_check;
alter table events.inventory_allocations add constraint inventory_allocations_period_check
  check (period_mode in ('none', 'day', 'window', 'rolling'));

-- ---------------------------------------------------------------------------
-- inventory_redemptions — one row per hand-out. item_id is the VARIANT that
-- physically left the shelf, which is chosen at the desk and so can differ from
-- the allocation's (parent) item.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_redemptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  allocation_id uuid not null references events.inventory_allocations(id) on delete cascade,
  item_id uuid not null references events.inventory_items(id) on delete cascade,
  -- order | registration | walkup
  subject_kind text not null default 'walkup',
  order_id uuid references events.event_orders(id) on delete set null,
  registration_id uuid references events.registrations(id) on delete set null,
  -- Order/registration id as text, else lower(email). '' for walk-ups, which
  -- are deliberately exempt from the one-per-subject rule.
  subject_key text not null default '',
  attendee_name text not null default '',
  attendee_email text not null default '',
  -- '' | 'YYYY-MM-DD' (day mode) | window id (window mode).
  period_key text not null default '',
  qty numeric(14, 2) not null default 1,
  -- The ledger movement this hand-out wrote, so an undo can reverse exactly it.
  movement_id uuid references events.inventory_movements(id) on delete set null,
  -- issued | returned | voided
  status text not null default 'issued',
  override boolean not null default false,
  override_reason text not null default '',
  issued_by text not null default '',
  role_id uuid references events.checkin_staff_roles(id) on delete set null,
  -- scan | search | manual | walkup
  method text not null default 'scan',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Double-collection is impossible at the DATABASE level, not merely in the UI.
-- Overrides are excluded: an override is a deliberate, recorded second issue.
create unique index if not exists events_inventory_redemptions_subject_uidx
  on events.inventory_redemptions (allocation_id, subject_key, period_key)
  where status = 'issued' and subject_key <> '' and override = false;

create index if not exists events_inventory_redemptions_event_idx
  on events.inventory_redemptions (event_id, created_at desc);
create index if not exists events_inventory_redemptions_allocation_idx
  on events.inventory_redemptions (allocation_id, created_at desc);
create index if not exists events_inventory_redemptions_project_idx
  on events.inventory_redemptions (project_id, created_at desc);
create index if not exists events_inventory_redemptions_subject_idx
  on events.inventory_redemptions (subject_key);

-- Matches the rest of the inventory module's demo-open policy. Tighten to
-- events.can_access_project(project_id) alongside the sibling tables when the
-- module moves off demo access.
alter table events.inventory_redemptions enable row level security;
drop policy if exists events_inventory_redemptions_demo_all on events.inventory_redemptions;
create policy events_inventory_redemptions_demo_all on events.inventory_redemptions
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- events.issue_subject() — resolve a scanned subject into the facts the rules
-- need. Returns null when the subject doesn't belong to the event or is
-- cancelled, so a refunded order can't collect.
--
-- { kind, id, key, name, email, units, tierId, ticketName, purchasables,
--   sessions, offerings }
-- ---------------------------------------------------------------------------
create or replace function events.issue_subject(p_event uuid, p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_o record;
  v_r record;
begin
  if p_kind = 'order' and p_id is not null then
    select o.id, o.buyer_name, o.buyer_email, o.ticket_name, o.quantity, o.metadata, o.status, o.cancelled_at
      into v_o
      from events.event_orders o
      where o.id = p_id and o.event_id = p_event;
    if not found or v_o.cancelled_at is not null or coalesce(v_o.status, 'confirmed') = 'cancelled' then
      return null;
    end if;
    return jsonb_build_object(
      'kind', 'order',
      'id', v_o.id,
      'key', v_o.id::text,
      'name', coalesce(v_o.buyer_name, ''),
      'email', lower(coalesce(v_o.buyer_email, '')),
      'units', greatest(1, coalesce(v_o.quantity, 1)),
      'tierId', coalesce(v_o.metadata->>'tierId', ''),
      'ticketName', coalesce(v_o.ticket_name, ''),
      'purchasables', coalesce(v_o.metadata->'purchasables', '[]'::jsonb),
      'sessions', coalesce(v_o.metadata->'sessions', '[]'::jsonb),
      'offerings', coalesce(v_o.metadata->'offerings', '{}'::jsonb));
  end if;

  if p_kind = 'registration' and p_id is not null then
    select r.id, r.name, r.email, r.party_size, r.status, r.metadata
      into v_r
      from events.registrations r
      where r.id = p_id and r.event_id = p_event and r.deleted_at is null;
    if not found or v_r.status in ('Cancelled', 'Declined') then
      return null;
    end if;
    return jsonb_build_object(
      'kind', 'registration',
      'id', v_r.id,
      'key', v_r.id::text,
      'name', coalesce(v_r.name, ''),
      'email', lower(coalesce(v_r.email, '')),
      'units', greatest(1, coalesce(v_r.party_size, 1)),
      'tierId', '',
      'ticketName', '',
      'purchasables', '[]'::jsonb,
      'sessions', coalesce(v_r.metadata->'sessions', '[]'::jsonb),
      'offerings', '{}'::jsonb);
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_actor() — who is calling, and what may they do?
--
-- Two ways in, one answer shape ({ id, name, permissions }):
--   * a staff device presents an 'issue' access code (the anonymous path);
--   * a signed-in organiser of the event's project acts with full rights, so
--     the workspace can undo or issue manually without minting a code.
--
-- The member path deliberately also requires auth.uid(): can_access_project()
-- treats an org-less project as open, and without this an anonymous caller
-- could skip the code entirely on those projects.
-- ---------------------------------------------------------------------------
create or replace function events.issue_actor(p_event uuid, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public, auth
as $$
declare
  v_role jsonb;
  v_project uuid;
begin
  v_role := events.checkin_validate_code(p_event, p_code, 'issue');
  if v_role is not null then
    return v_role;
  end if;

  select e.project_id into v_project
    from events.events e where e.id = p_event and e.deleted_at is null;
  if v_project is null then
    return null;
  end if;

  if auth.uid() is not null and events.can_access_project(v_project) then
    return jsonb_build_object(
      'id', null,
      'name', 'Organiser',
      'permissions', jsonb_build_object(
        'canIssue', true, 'canReturn', true, 'canOverride', true,
        'allocationIds', '[]'::jsonb));
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_lookup() — find the subject at the desk. Searches orders AND
-- registrations by name, email, or ticket code. The ticket code is the app-wide
-- convention: the first 8 hex characters of the id, upper-cased.
-- ---------------------------------------------------------------------------
create or replace function events.issue_lookup(p_event uuid, p_code text, p_query text)
returns table (
  subject_kind text,
  subject_id uuid,
  name text,
  email text,
  ticket_code text,
  ticket_name text,
  units integer
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_q text := upper(btrim(coalesce(p_query, '')));
begin
  if events.issue_actor(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  if v_q = '' then
    return;
  end if;

  return query
    select
      'order'::text,
      o.id,
      coalesce(o.buyer_name, ''),
      coalesce(o.buyer_email, ''),
      upper(substring(replace(o.id::text, '-', ''), 1, 8)),
      coalesce(o.ticket_name, ''),
      greatest(1, coalesce(o.quantity, 1))
    from events.event_orders o
    where o.event_id = p_event
      and o.cancelled_at is null
      and coalesce(o.status, 'confirmed') <> 'cancelled'
      and (
        o.buyer_name ilike '%' || p_query || '%'
        or o.buyer_email ilike '%' || p_query || '%'
        or upper(substring(replace(o.id::text, '-', ''), 1, 8)) = v_q
        or upper(replace(o.id::text, '-', '')) = replace(v_q, '-', '')
      )
    union all
    select
      'registration'::text,
      r.id,
      coalesce(r.name, ''),
      coalesce(r.email, ''),
      upper(substring(replace(r.id::text, '-', ''), 1, 8)),
      ''::text,
      greatest(1, coalesce(r.party_size, 1))
    from events.registrations r
    where r.event_id = p_event
      and r.deleted_at is null
      and r.status not in ('Cancelled', 'Declined')
      and (
        r.name ilike '%' || p_query || '%'
        or r.email ilike '%' || p_query || '%'
        or upper(substring(replace(r.id::text, '-', ''), 1, 8)) = v_q
        or upper(replace(r.id::text, '-', '')) = replace(v_q, '-', '')
      )
    limit 25;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_entitled_units() — how many units this subject qualifies for
-- under one allocation, per period. 0 means "not entitled".
--
-- Fails CLOSED: an audience spec using facets that can't be evaluated here
-- (tags, segments — they live in the contacts/segments tables) returns 0 rather
-- than silently entitling everyone who passes the remaining facets.
-- ---------------------------------------------------------------------------
create or replace function events.issue_entitled_units(p_alloc events.inventory_allocations, p_subject jsonb)
returns numeric
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_units numeric := greatest(1, coalesce((p_subject->>'units')::numeric, 1));
  v_per numeric := greatest(0, coalesce(p_alloc.qty_per_attendee, 1));
  v_tier text := coalesce(p_subject->>'tierId', '');
  v_ticket text := coalesce(p_subject->>'ticketName', '');
  v_email text := lower(coalesce(p_subject->>'email', ''));
  v_meta jsonb;
  v_entry jsonb;
  v_qty numeric;
  v_per_attendee boolean;
  v_spec jsonb;
  v_filters jsonb;
  v_matched boolean;
begin
  if p_subject is null or v_per <= 0 then
    return 0;
  end if;

  -- internal: no buyer link at all; only a walk-up issue can draw on it.
  if p_alloc.issuance = 'internal' then
    return 0;
  end if;

  if p_alloc.issuance = 'all' then
    return v_units * v_per;
  end if;

  if p_alloc.issuance = 'ticket' then
    -- Prefer the stable tier id; fall back to the ticket NAME for orders placed
    -- before buy_ticket recorded tierId (a rename breaks only that fallback).
    if v_tier <> '' and p_alloc.ticket_ids ? v_tier then
      return v_units * v_per;
    end if;
    if v_ticket <> '' then
      select e.metadata into v_meta from events.events e where e.id = p_alloc.event_id;
      if exists (
        select 1
        from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) t(val)
        where p_alloc.ticket_ids ? (t.val->>'id')
          and lower(btrim(coalesce(t.val->>'name', ''))) = lower(btrim(v_ticket))
      ) then
        return v_units * v_per;
      end if;
    end if;
    return 0;
  end if;

  if p_alloc.issuance = 'addon' then
    if coalesce(p_alloc.purchasable_id, '') = '' then
      return 0;
    end if;
    select pa.val into v_entry
      from jsonb_array_elements(coalesce(p_subject->'purchasables', '[]'::jsonb)) pa(val)
      where pa.val->>'id' = p_alloc.purchasable_id
      limit 1;
    if v_entry is null then
      return 0;
    end if;
    v_qty := greatest(0, coalesce((v_entry->>'quantity')::numeric, 0));
    -- A per-attendee add-on yields one unit per seat on the order.
    select e.metadata into v_meta from events.events e where e.id = p_alloc.event_id;
    select coalesce(p.val->>'priceType', '') = 'perAttendee' into v_per_attendee
      from jsonb_array_elements(coalesce(v_meta->'purchasables', '[]'::jsonb)) p(val)
      where p.val->>'id' = p_alloc.purchasable_id
      limit 1;
    if coalesce(v_per_attendee, false) then
      v_qty := v_qty * v_units;
    end if;
    return v_qty * v_per;
  end if;

  if p_alloc.issuance = 'session' then
    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_subject->'sessions', '[]'::jsonb)) s(val)
      where p_alloc.session_ids ? s.val
    ) then
      return v_units * v_per;
    end if;
    return 0;
  end if;

  if p_alloc.issuance = 'audience' then
    v_spec := coalesce(p_alloc.audience, '{}'::jsonb);
    v_filters := coalesce(v_spec->'filters', '{}'::jsonb);

    -- Explicit exclusions always win.
    if v_email <> '' and exists (
      select 1 from jsonb_array_elements_text(coalesce(v_spec->'exclude', '[]'::jsonb)) x(val)
      where lower(x.val) = v_email
    ) then
      return 0;
    end if;
    -- Explicit inclusions always qualify.
    if v_email <> '' and exists (
      select 1 from jsonb_array_elements_text(coalesce(v_spec->'include', '[]'::jsonb)) i(val)
      where lower(i.val) = v_email
    ) then
      return v_units * v_per;
    end if;

    if coalesce(v_spec->>'mode', 'all') = 'all' then
      return v_units * v_per;
    end if;

    -- Fail closed on facets this function cannot evaluate.
    if jsonb_array_length(coalesce(v_filters->'tags', '[]'::jsonb)) > 0
       or coalesce(v_filters->>'segmentId', '') <> '' then
      return 0;
    end if;

    v_matched := true;
    if jsonb_array_length(coalesce(v_filters->'tickets', '[]'::jsonb)) > 0 then
      v_matched := v_matched and (v_tier <> '' and v_filters->'tickets' ? v_tier);
    end if;
    if jsonb_array_length(coalesce(v_filters->'purchasables', '[]'::jsonb)) > 0 then
      v_matched := v_matched and exists (
        select 1
        from jsonb_array_elements(coalesce(p_subject->'purchasables', '[]'::jsonb)) pa(val)
        where v_filters->'purchasables' ? (pa.val->>'id')
      );
    end if;
    if v_matched then
      return v_units * v_per;
    end if;
    return 0;
  end if;

  return 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_period() — the active period for an allocation right now.
-- Returns { key, label, blocked } where blocked is '' or a reason code.
-- ---------------------------------------------------------------------------
create or replace function events.issue_period(p_alloc events.inventory_allocations)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_tz text;
  v_start date;
  v_end date;
  v_today date;
  v_win jsonb;
begin
  if p_alloc.period_mode = 'day' then
    select coalesce(e.timezone, 'UTC'), e.event_date,
           coalesce((e.metadata->>'endDate')::date, e.event_date)
      into v_tz, v_start, v_end
      from events.events e where e.id = p_alloc.event_id;
    v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;
    -- Only bound the window when the event actually carries dates.
    if v_start is not null and (v_today < v_start or v_today > coalesce(v_end, v_start)) then
      return jsonb_build_object('key', to_char(v_today, 'YYYY-MM-DD'),
                                'label', to_char(v_today, 'Dy DD Mon'),
                                'blocked', 'outside_event_dates');
    end if;
    return jsonb_build_object('key', to_char(v_today, 'YYYY-MM-DD'),
                              'label', to_char(v_today, 'Dy DD Mon'),
                              'blocked', '');
  end if;

  if p_alloc.period_mode = 'window' then
    select w.val into v_win
      from jsonb_array_elements(coalesce(p_alloc.period_config->'windows', '[]'::jsonb)) w(val)
      where coalesce(w.val->>'startAt', '') <> ''
        and coalesce(w.val->>'endAt', '') <> ''
        and now() >= (w.val->>'startAt')::timestamptz
        and now() <= (w.val->>'endAt')::timestamptz
      order by (w.val->>'startAt')::timestamptz
      limit 1;
    if v_win is null then
      return jsonb_build_object('key', '', 'label', 'No open window', 'blocked', 'outside_window');
    end if;
    return jsonb_build_object('key', coalesce(v_win->>'id', ''),
                              'label', coalesce(v_win->>'label', 'Window'),
                              'blocked', '');
  end if;

  -- 'none' and 'rolling' share an empty key; rolling is enforced by elapsed
  -- time in issue_state() because it has no stable period boundary.
  return jsonb_build_object('key', '', 'label', '', 'blocked', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_state() — the full picture for one allocation × one subject:
-- entitled, already redeemed, what remains, and any reason it's blocked.
-- Both issue_entitlements() (display) and issue_redeem() (enforcement) call
-- this, so the desk can never show one thing and the ledger record another.
-- ---------------------------------------------------------------------------
create or replace function events.issue_state(p_alloc events.inventory_allocations, p_subject jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_period jsonb := events.issue_period(p_alloc);
  v_key text := coalesce(v_period->>'key', '');
  v_subject_key text := coalesce(p_subject->>'key', '');
  v_entitled numeric := events.issue_entitled_units(p_alloc, p_subject);
  v_redeemed numeric := 0;
  v_lifetime numeric := 0;
  v_cap numeric := coalesce((p_alloc.period_config->>'totalCap')::numeric, 0);
  v_hours numeric := coalesce((p_alloc.period_config->>'intervalHours')::numeric, 0);
  v_last timestamptz;
  v_blocked text := coalesce(v_period->>'blocked', '');
begin
  if v_subject_key <> '' then
    select coalesce(sum(r.qty), 0) into v_redeemed
      from events.inventory_redemptions r
      where r.allocation_id = p_alloc.id
        and r.subject_key = v_subject_key
        and r.period_key = v_key
        and r.status = 'issued';

    select coalesce(sum(r.qty), 0), max(r.created_at) into v_lifetime, v_last
      from events.inventory_redemptions r
      where r.allocation_id = p_alloc.id
        and r.subject_key = v_subject_key
        and r.status = 'issued';
  end if;

  if v_blocked = '' and v_cap > 0 and v_lifetime >= v_cap then
    v_blocked := 'cap_reached';
  end if;

  if v_blocked = '' and p_alloc.period_mode = 'rolling' and v_hours > 0
     and v_last is not null and v_last > now() - make_interval(hours => v_hours::integer) then
    v_blocked := 'too_soon';
  end if;

  if v_blocked = '' and v_entitled > 0 and v_redeemed >= v_entitled then
    v_blocked := 'collected';
  end if;

  return jsonb_build_object(
    'periodKey', v_key,
    'periodLabel', coalesce(v_period->>'label', ''),
    'entitled', v_entitled,
    'redeemed', v_redeemed,
    'lifetime', v_lifetime,
    'lastAt', v_last,
    'remaining', greatest(0, v_entitled - v_redeemed),
    'blocked', v_blocked);
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_entitlements() — everything this subject may collect right now.
-- `variants` carries the pickable rows with live on-hand, because merch is
-- chosen by size at the desk, not at purchase.
-- ---------------------------------------------------------------------------
create or replace function events.issue_entitlements(
  p_event uuid,
  p_code text,
  p_subject_kind text default 'walkup',
  p_subject_id uuid default null
)
returns table (
  allocation_id uuid,
  item_id uuid,
  item_name text,
  variant_label text,
  image_url text,
  category text,
  issuance text,
  period_mode text,
  period_key text,
  period_label text,
  entitled_qty numeric,
  redeemed_qty numeric,
  remaining numeric,
  last_at timestamptz,
  blocked_reason text,
  variants jsonb
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_scope jsonb;
  v_subject jsonb;
  v_alloc events.inventory_allocations;
  v_state jsonb;
begin
  v_role := events.issue_actor(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  -- A role may be scoped to specific allocations; an empty list means all.
  v_scope := coalesce(v_role->'permissions'->'allocationIds', '[]'::jsonb);

  v_subject := events.issue_subject(p_event, p_subject_kind, p_subject_id);
  if v_subject is null then
    return;
  end if;

  for v_alloc in
    select a.* from events.inventory_allocations a
    where a.event_id = p_event
      and a.deleted_at is null
      and a.status in ('Planned', 'Reserved', 'Issued')
      and a.issuance <> 'internal'
      and (jsonb_array_length(v_scope) = 0 or v_scope ? a.id::text)
    order by a.created_at
  loop
    v_state := events.issue_state(v_alloc, v_subject);
    if coalesce((v_state->>'entitled')::numeric, 0) <= 0 then
      continue;
    end if;

    return query
      select
        v_alloc.id,
        i.id,
        i.name,
        i.variant_label,
        i.image_url,
        i.category,
        v_alloc.issuance,
        v_alloc.period_mode,
        (v_state->>'periodKey'),
        (v_state->>'periodLabel'),
        (v_state->>'entitled')::numeric,
        (v_state->>'redeemed')::numeric,
        (v_state->>'remaining')::numeric,
        nullif(v_state->>'lastAt', '')::timestamptz,
        (v_state->>'blocked'),
        -- The item itself when it has no variants, else its children. Only leaf
        -- rows hold stock, so these are what a movement can target.
        coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', v.id, 'name', v.name, 'variantLabel', v.variant_label,
                   'imageUrl', v.image_url, 'onHand', v.on_hand, 'sku', v.sku)
                 order by v.variant_label, v.name)
          from events.inventory_items v
          where v.parent_id = i.id and v.deleted_at is null
        ), jsonb_build_array(jsonb_build_object(
             'id', i.id, 'name', i.name, 'variantLabel', i.variant_label,
             'imageUrl', i.image_url, 'onHand', i.on_hand, 'sku', i.sku)))
      from events.inventory_items i
      where i.id = v_alloc.item_id and i.deleted_at is null;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_allocations() — every open allocation for the event with its
-- pickable variants. Powers walk-up issuing, where there is no subject to
-- derive entitlement from. Code-gated like the rest, so the staff device never
-- has to read the tables directly.
-- ---------------------------------------------------------------------------
create or replace function events.issue_allocations(p_event uuid, p_code text)
returns table (
  allocation_id uuid,
  item_id uuid,
  item_name text,
  variant_label text,
  image_url text,
  category text,
  issuance text,
  status text,
  planned_qty numeric,
  issued_qty numeric,
  variants jsonb
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_scope jsonb;
begin
  v_role := events.issue_actor(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  v_scope := coalesce(v_role->'permissions'->'allocationIds', '[]'::jsonb);

  return query
    select
      a.id, i.id, i.name, i.variant_label, i.image_url, i.category,
      a.issuance, a.status, a.planned_qty, a.issued_qty,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', v.id, 'name', v.name, 'variantLabel', v.variant_label,
                 'imageUrl', v.image_url, 'onHand', v.on_hand, 'sku', v.sku)
               order by v.variant_label, v.name)
        from events.inventory_items v
        where v.parent_id = i.id and v.deleted_at is null
      ), jsonb_build_array(jsonb_build_object(
           'id', i.id, 'name', i.name, 'variantLabel', i.variant_label,
           'imageUrl', i.image_url, 'onHand', i.on_hand, 'sku', i.sku)))
    from events.inventory_allocations a
    join events.inventory_items i on i.id = a.item_id and i.deleted_at is null
    where a.event_id = p_event
      and a.deleted_at is null
      and a.status in ('Planned', 'Reserved', 'Issued')
      and (jsonb_array_length(v_scope) = 0 or v_scope ? a.id::text)
    order by a.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_redeem() — hand it over. Re-derives entitlement server-side and
-- never trusts the client's numbers. Writes the stock movement and the
-- redemption row together; the movement trigger applies it to items.on_hand.
-- ---------------------------------------------------------------------------
create or replace function events.issue_redeem(
  p_event uuid,
  p_code text,
  p_allocation uuid,
  p_item uuid,
  p_subject_kind text default 'walkup',
  p_subject_id uuid default null,
  p_qty numeric default 1,
  p_override boolean default false,
  p_reason text default '',
  p_staff text default null,
  p_method text default 'scan'
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_alloc events.inventory_allocations;
  v_subject jsonb;
  v_state jsonb;
  v_qty numeric := greatest(1, coalesce(p_qty, 1));
  v_project uuid;
  v_movement uuid;
  v_redemption uuid;
  v_blocked text;
  v_subject_key text := '';
  v_walkup boolean;
begin
  v_role := events.issue_actor(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  if not coalesce((v_role->'permissions'->>'canIssue')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'no_permission');
  end if;

  select a.* into v_alloc from events.inventory_allocations a
    where a.id = p_allocation and a.event_id = p_event and a.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_allocation');
  end if;

  -- Honour the role's allocation scope. A scope that isn't enforced here would
  -- be decoration, since the client picks the allocation.
  if jsonb_array_length(coalesce(v_role->'permissions'->'allocationIds', '[]'::jsonb)) > 0
     and not (v_role->'permissions'->'allocationIds' ? v_alloc.id::text) then
    return jsonb_build_object('ok', false, 'reason', 'out_of_scope');
  end if;

  -- The chosen item must be the allocation's item or one of its variants, so a
  -- client can't redirect the movement at unrelated stock.
  if not exists (
    select 1 from events.inventory_items i
    where i.id = p_item and i.deleted_at is null
      and (i.id = v_alloc.item_id or i.parent_id = v_alloc.item_id)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_item');
  end if;

  v_walkup := p_subject_kind = 'walkup' or p_subject_id is null;

  if v_walkup then
    -- A walk-up is an untargeted issue: no entitlement to check, no subject key,
    -- so it is exempt from the one-per-subject index by design.
    if v_alloc.issuance <> 'internal'
       and not coalesce((v_role->'permissions'->>'canOverride')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', 'walkup_not_allowed');
    end if;
    v_subject := null;
  else
    v_subject := events.issue_subject(p_event, p_subject_kind, p_subject_id);
    if v_subject is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_subject');
    end if;
    v_subject_key := coalesce(v_subject->>'key', '');
    v_state := events.issue_state(v_alloc, v_subject);
    v_blocked := coalesce(v_state->>'blocked', '');

    if coalesce((v_state->>'entitled')::numeric, 0) <= 0 then
      return jsonb_build_object('ok', false, 'reason', 'not_entitled');
    end if;

    if v_blocked <> '' then
      if not p_override then
        return jsonb_build_object(
          'ok', false, 'reason', v_blocked,
          'already', v_blocked = 'collected',
          'lastAt', v_state->'lastAt',
          'state', v_state);
      end if;
      if not coalesce((v_role->'permissions'->>'canOverride')::boolean, false) then
        return jsonb_build_object('ok', false, 'reason', 'no_override_permission');
      end if;
    end if;

    -- Never hand out more than what remains, unless this is an override.
    if not p_override then
      v_qty := least(v_qty, greatest(0, coalesce((v_state->>'remaining')::numeric, 0)));
      if v_qty <= 0 then
        return jsonb_build_object('ok', false, 'reason', 'collected', 'already', true);
      end if;
    end if;
  end if;

  select e.project_id into v_project from events.events e where e.id = p_event;

  -- Negative movement: the trigger on inventory_movements applies it to on_hand.
  insert into events.inventory_movements
    (project_id, item_id, event_id, allocation_id, kind, qty, reason, note, reference)
  values
    (v_project, p_item, p_event, v_alloc.id, 'issue', -v_qty,
     case when v_walkup then 'Walk-up issue' else 'Issued to attendee' end,
     coalesce(p_reason, ''),
     coalesce(v_subject->>'name', ''))
  returning id into v_movement;

  insert into events.inventory_redemptions
    (project_id, event_id, allocation_id, item_id, subject_kind,
     order_id, registration_id, subject_key, attendee_name, attendee_email,
     period_key, qty, movement_id, status, override, override_reason,
     issued_by, role_id, method)
  values
    (v_project, p_event, v_alloc.id, p_item,
     case when v_walkup then 'walkup' else p_subject_kind end,
     case when v_walkup or p_subject_kind <> 'order' then null else p_subject_id end,
     case when v_walkup or p_subject_kind <> 'registration' then null else p_subject_id end,
     v_subject_key,
     coalesce(v_subject->>'name', ''),
     coalesce(v_subject->>'email', ''),
     coalesce(v_state->>'periodKey', ''),
     v_qty, v_movement, 'issued',
     coalesce(p_override, false) and coalesce(v_blocked, '') <> '',
     coalesce(p_reason, ''),
     coalesce(nullif(p_staff, ''), coalesce(v_role->>'name', '')),
     nullif(v_role->>'id', '')::uuid,
     case when v_walkup then 'walkup' else coalesce(nullif(p_method, ''), 'scan') end)
  returning id into v_redemption;

  return jsonb_build_object(
    'ok', true,
    'redemptionId', v_redemption,
    'movementId', v_movement,
    'qty', v_qty,
    'remaining', greatest(0, coalesce((v_state->>'remaining')::numeric, 0) - v_qty));
exception
  when unique_violation then
    -- The partial unique index is the last line of defence against a double tap.
    return jsonb_build_object('ok', false, 'reason', 'collected', 'already', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_undo() — reverse a hand-out: mark it returned and write the
-- compensating positive movement. The original movement stays, because the
-- ledger is append-only; corrections are counter-movements, never edits.
-- ---------------------------------------------------------------------------
create or replace function events.issue_undo(p_event uuid, p_code text, p_redemption uuid)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_role jsonb;
  v_row events.inventory_redemptions;
  v_movement uuid;
begin
  v_role := events.issue_actor(p_event, p_code);
  if v_role is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;
  if not coalesce((v_role->'permissions'->>'canReturn')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'no_permission');
  end if;

  select r.* into v_row from events.inventory_redemptions r
    where r.id = p_redemption and r.event_id = p_event;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_redemption');
  end if;
  if v_row.status <> 'issued' then
    return jsonb_build_object('ok', false, 'reason', 'not_issued');
  end if;

  insert into events.inventory_movements
    (project_id, item_id, event_id, allocation_id, kind, qty, reason, note, reference)
  values
    (v_row.project_id, v_row.item_id, v_row.event_id, v_row.allocation_id,
     'return', v_row.qty, 'Undo issue', '', coalesce(v_row.attendee_name, ''))
  returning id into v_movement;

  update events.inventory_redemptions
    set status = 'returned',
        metadata = coalesce(metadata, '{}'::jsonb)
                   || jsonb_build_object('undoMovementId', v_movement,
                                         'undoneAt', now(),
                                         'undoneBy', coalesce(v_role->>'name', ''))
    where id = p_redemption;

  return jsonb_build_object('ok', true, 'movementId', v_movement);
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_stats() — the desk header: today's hand-outs, unique collectors,
-- and the running total for the event.
-- ---------------------------------------------------------------------------
create or replace function events.issue_stats(p_event uuid, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_today numeric;
  v_total numeric;
  v_people integer;
begin
  if events.issue_actor(p_event, p_code) is null then
    raise exception 'INVALID_CODE' using errcode = 'check_violation';
  end if;

  select coalesce(sum(r.qty), 0) into v_today
    from events.inventory_redemptions r
    where r.event_id = p_event and r.status = 'issued'
      and r.created_at >= date_trunc('day', now());

  select coalesce(sum(r.qty), 0), count(distinct nullif(r.subject_key, ''))
    into v_total, v_people
    from events.inventory_redemptions r
    where r.event_id = p_event and r.status = 'issued';

  return jsonb_build_object(
    'issuedToday', coalesce(v_today, 0),
    'issuedTotal', coalesce(v_total, 0),
    'collectors', coalesce(v_people, 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- events.issue_entitlements_for_order() — the buyer's own view: what this order
-- may collect, and how much of it already has been.
--
-- Unlike the desk RPCs this takes no access code, because the members portal
-- authenticates buyers with its own cookie session rather than Supabase Auth.
-- The ownership check therefore lives in the portal API route (which looks the
-- order up by the signed-in member's email) and this function is granted ONLY
-- to service_role — never to anon. The revoke below matters: Postgres grants
-- EXECUTE to PUBLIC by default, which would otherwise expose it.
-- ---------------------------------------------------------------------------
create or replace function events.issue_entitlements_for_order(p_order uuid)
returns table (
  allocation_id uuid,
  item_id uuid,
  item_name text,
  variant_label text,
  image_url text,
  issuance text,
  period_mode text,
  period_label text,
  entitled_qty numeric,
  redeemed_qty numeric,
  remaining numeric,
  last_at timestamptz,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_event uuid;
  v_subject jsonb;
  v_alloc events.inventory_allocations;
  v_state jsonb;
begin
  select o.event_id into v_event from events.event_orders o where o.id = p_order;
  if v_event is null then
    return;
  end if;

  v_subject := events.issue_subject(v_event, 'order', p_order);
  if v_subject is null then
    return;
  end if;

  for v_alloc in
    select a.* from events.inventory_allocations a
    where a.event_id = v_event
      and a.deleted_at is null
      and a.status in ('Planned', 'Reserved', 'Issued')
      and a.issuance <> 'internal'
    order by a.created_at
  loop
    v_state := events.issue_state(v_alloc, v_subject);
    if coalesce((v_state->>'entitled')::numeric, 0) <= 0 then
      continue;
    end if;
    return query
      select
        v_alloc.id, i.id, i.name, i.variant_label, i.image_url,
        v_alloc.issuance, v_alloc.period_mode,
        (v_state->>'periodLabel'),
        (v_state->>'entitled')::numeric,
        (v_state->>'redeemed')::numeric,
        (v_state->>'remaining')::numeric,
        nullif(v_state->>'lastAt', '')::timestamptz,
        (v_state->>'blocked')
      from events.inventory_items i
      where i.id = v_alloc.item_id and i.deleted_at is null;
  end loop;
end;
$$;

revoke all on function events.issue_entitlements_for_order(uuid) from public;
revoke all on function events.issue_entitlements_for_order(uuid) from anon, authenticated;
grant execute on function events.issue_entitlements_for_order(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Grants. Every issue_* entry point is code-gated inside the function, so anon
-- staff devices can call them exactly like the check-in routes do.
-- ---------------------------------------------------------------------------
grant execute on function events.issue_actor(uuid, text) to anon, authenticated;
grant execute on function events.issue_subject(uuid, text, uuid) to anon, authenticated;
grant execute on function events.issue_lookup(uuid, text, text) to anon, authenticated;
grant execute on function events.issue_entitled_units(events.inventory_allocations, jsonb) to anon, authenticated;
grant execute on function events.issue_period(events.inventory_allocations) to anon, authenticated;
grant execute on function events.issue_state(events.inventory_allocations, jsonb) to anon, authenticated;
grant execute on function events.issue_entitlements(uuid, text, text, uuid) to anon, authenticated;
grant execute on function events.issue_allocations(uuid, text) to anon, authenticated;
grant execute on function events.issue_redeem(uuid, text, uuid, uuid, text, uuid, numeric, boolean, text, text, text) to anon, authenticated;
grant execute on function events.issue_undo(uuid, text, uuid) to anon, authenticated;
grant execute on function events.issue_stats(uuid, text) to anon, authenticated;
