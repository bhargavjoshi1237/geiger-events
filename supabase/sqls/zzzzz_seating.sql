-- ===========================================================================
-- Geiger Events — reserved seating (section / row / seat)
--
-- A seat map is a VENUE-LEVEL TEMPLATE built once and reused by many events:
--   events.seat_maps          one named configuration of a venue
--     events.seat_map_sections  seated blocks + GA zones (percent-positioned)
--       events.seats            one row per physical chair (generated)
--
-- Per-event state is two thin tables:
--   events.seat_holds        TTL holds taken while the buyer checks out
--   events.seat_assignments  the sold/comp/blocked chair, guarded by a unique
--                            partial index — that index IS the double-book guard
--
-- Which map an event uses, how it sells, and section→ticket pricing all live in
-- events.events.metadata.seating (written via events.event_merge_meta):
--   { seatMapId, mode: 'map-first'|'type-first', sectionTiers: {}, holdMinutes }
--
-- GA zones keep the existing counter-based inventory: a 'ga' section has no
-- seats rows, so a GA purchase supplies no seat ids and flows through
-- events.buy_ticket's per-tier arithmetic unchanged.
--
-- NOTE ON buy_ticket: this file does NOT redefine it. zzz_ticketing_addons.sql
-- remains its single owner. Seated purchases go through events.buy_seats(),
-- a thin wrapper that validates holds, delegates to buy_ticket, then writes the
-- assignments. plpgsql calls share the caller's transaction, so a seat conflict
-- rolls the order back too — atomic, without a second 450-line copy to maintain.
--
-- Runs after events.sql (touch_updated_at), zz_project_access.sql
-- (can_access_project) and zzz_ticketing_addons.sql (buy_ticket) by filename
-- order. Self-contained and idempotent: safe to re-run via `npm run db:push`.
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

-- ---------------------------------------------------------------------------
-- Template tables
-- ---------------------------------------------------------------------------

-- One named configuration of a venue. A venue has many (end-stage concert,
-- in-the-round, banquet rounds, half-house) — each is a different seat map.
create table if not exists events.seat_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  venue_id uuid references events.venues(id) on delete cascade,
  name text not null default 'Untitled configuration',
  -- Draft · Active · Archived
  status text not null default 'Draft',
  -- Canvas aspect ratio and the stage marker: { aspect, stage: { x, y, label } }
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A block on the floor. Geometry is percent-of-canvas, matching the convention
-- the conference floor plan already uses for booths.
create table if not exists events.seat_map_sections (
  id uuid primary key default gen_random_uuid(),
  seat_map_id uuid not null references events.seat_maps(id) on delete cascade,
  name text not null default 'Section',
  -- seated (individual chairs) | ga (capacity only, no chairs)
  kind text not null default 'seated',
  x numeric(6, 2) not null default 10,
  y numeric(6, 2) not null default 10,
  width numeric(6, 2) not null default 30,
  height numeric(6, 2) not null default 20,
  rotation numeric(6, 2) not null default 0,
  -- { rows, seatsPerRow, rowLabels, rowLabelStart, numbering, curve, rake, aisleAfter }
  layout jsonb not null default '{}'::jsonb,
  -- GA zones only; a seated section derives its capacity from events.seats.
  capacity integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per physical chair. x/y are percent-of-canvas and are COMPUTED by
-- lib/seating/generate.js — venue exports essentially never carry coordinates.
create table if not exists events.seats (
  id uuid primary key default gen_random_uuid(),
  seat_map_id uuid not null references events.seat_maps(id) on delete cascade,
  section_id uuid not null references events.seat_map_sections(id) on delete cascade,
  row_label text not null default '',
  seat_label text not null default '',
  x numeric(6, 2) not null default 0,
  y numeric(6, 2) not null default 0,
  -- standard | wheelchair | companion | obstructed | house
  kind text not null default 'standard',
  -- Pairs a companion seat to its wheelchair space so they sell together.
  companion_of uuid references events.seats(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Back-fill missing columns on older copies of the tables.
alter table events.seat_maps add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.seat_maps add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.seat_maps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.seat_maps add column if not exists deleted_at timestamptz;
alter table events.seat_map_sections add column if not exists rotation numeric(6, 2) not null default 0;
alter table events.seat_map_sections add column if not exists capacity integer not null default 0;
alter table events.seat_map_sections add column if not exists sort_order integer not null default 0;
alter table events.seats add column if not exists companion_of uuid references events.seats(id) on delete set null;
alter table events.seats add column if not exists active boolean not null default true;

create unique index if not exists events_seats_unique_label_idx
  on events.seats (section_id, row_label, seat_label);
create index if not exists events_seats_map_idx on events.seats (seat_map_id);
create index if not exists events_seat_sections_map_idx on events.seat_map_sections (seat_map_id, sort_order);
create index if not exists events_seat_maps_venue_idx on events.seat_maps (venue_id) where deleted_at is null;

drop trigger if exists seat_maps_touch_updated_at on events.seat_maps;
create trigger seat_maps_touch_updated_at
before update on events.seat_maps
for each row execute function events.touch_updated_at();

drop trigger if exists seat_map_sections_touch_updated_at on events.seat_map_sections;
create trigger seat_map_sections_touch_updated_at
before update on events.seat_map_sections
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Per-event tables
-- ---------------------------------------------------------------------------

-- A seat held while a buyer checks out. Expired holds are never swept by a job:
-- every read filters `expires_at > now()` and hold_seats() steals dead rows in
-- place, so the table self-heals.
create table if not exists events.seat_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  seat_id uuid not null references events.seats(id) on delete cascade,
  -- Opaque per-browser token; survives the Stripe redirect via sessionStorage.
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- One hold per seat per event. The upsert in hold_seats() relies on this.
create unique index if not exists events_seat_holds_unique_idx
  on events.seat_holds (event_id, seat_id);
create index if not exists events_seat_holds_token_idx
  on events.seat_holds (event_id, session_token);

-- The sold/comp/blocked chair. Organiser production holds and house seats live
-- here as status = 'blocked'.
create table if not exists events.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  seat_id uuid not null references events.seats(id) on delete cascade,
  order_id uuid references events.event_orders(id) on delete set null,
  attendee_name text not null default '',
  attendee_email text not null default '',
  -- The event ticket tier this seat was sold under (metadata ticket id).
  ticket_id text,
  price numeric(14, 2) not null default 0,
  -- sold | comp | blocked
  status text not null default 'sold',
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

-- THE double-book guard. `released_at is null` is immutable, so the partial
-- unique index is valid — a refunded seat frees up simply by being released.
create unique index if not exists events_seat_assignments_live_idx
  on events.seat_assignments (event_id, seat_id) where released_at is null;
create index if not exists events_seat_assignments_order_idx
  on events.seat_assignments (order_id);
create index if not exists events_seat_assignments_event_idx
  on events.seat_assignments (event_id) where released_at is null;

-- ---------------------------------------------------------------------------
-- RLS — members manage templates; the storefront never touches these tables
-- directly, it goes through the security-definer RPCs below.
-- ---------------------------------------------------------------------------

alter table events.seat_maps enable row level security;
alter table events.seat_map_sections enable row level security;
alter table events.seats enable row level security;
alter table events.seat_holds enable row level security;
alter table events.seat_assignments enable row level security;

drop policy if exists seat_maps_member_all on events.seat_maps;
create policy seat_maps_member_all on events.seat_maps
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Sections and seats inherit their map's project.
drop policy if exists seat_map_sections_member_all on events.seat_map_sections;
create policy seat_map_sections_member_all on events.seat_map_sections
  for all to authenticated
  using (exists (
    select 1 from events.seat_maps m
    where m.id = seat_map_id and events.can_access_project(m.project_id)))
  with check (exists (
    select 1 from events.seat_maps m
    where m.id = seat_map_id and events.can_access_project(m.project_id)));

drop policy if exists seats_member_all on events.seats;
create policy seats_member_all on events.seats
  for all to authenticated
  using (exists (
    select 1 from events.seat_maps m
    where m.id = seat_map_id and events.can_access_project(m.project_id)))
  with check (exists (
    select 1 from events.seat_maps m
    where m.id = seat_map_id and events.can_access_project(m.project_id)));

-- Members read live state for the box office; all writes go through RPCs.
drop policy if exists seat_holds_member_read on events.seat_holds;
create policy seat_holds_member_read on events.seat_holds
  for select to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)));

drop policy if exists seat_assignments_member_all on events.seat_assignments;
create policy seat_assignments_member_all on events.seat_assignments
  for all to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)))
  with check (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)));

-- ---------------------------------------------------------------------------
-- public_event_seat_map(): the anon read for the storefront.
-- Mirrors public_event_discount / public_event_access_code — buyers get the map
-- and what's taken without the member-only tables ever being exposed.
-- ---------------------------------------------------------------------------
drop function if exists events.public_event_seat_map(uuid);
create or replace function events.public_event_seat_map(p_event_id uuid)
returns table (map jsonb, sections jsonb, seats jsonb, taken jsonb)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_map_id uuid;
begin
  select nullif(e.metadata->'seating'->>'seatMapId', '')::uuid
    into v_map_id
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;

  if v_map_id is null then
    return query select null::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  return query
  select
    (select jsonb_build_object('id', m.id, 'name', m.name, 'config', m.config)
       from events.seat_maps m
       where m.id = v_map_id and m.deleted_at is null),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', s.id, 'name', s.name, 'kind', s.kind,
              'x', s.x, 'y', s.y, 'width', s.width, 'height', s.height,
              'rotation', s.rotation, 'layout', s.layout,
              'capacity', s.capacity, 'sortOrder', s.sort_order
            ) order by s.sort_order), '[]'::jsonb)
       from events.seat_map_sections s
       where s.seat_map_id = v_map_id),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', st.id, 'sectionId', st.section_id,
              'rowLabel', st.row_label, 'seatLabel', st.seat_label,
              'x', st.x, 'y', st.y, 'kind', st.kind,
              'companionOf', st.companion_of
            )), '[]'::jsonb)
       from events.seats st
       where st.seat_map_id = v_map_id and st.active),
    (select coalesce(jsonb_agg(t.seat_id), '[]'::jsonb) from (
       select a.seat_id from events.seat_assignments a
         where a.event_id = p_event_id and a.released_at is null
       union
       select h.seat_id from events.seat_holds h
         where h.event_id = p_event_id and h.expires_at > now()
     ) t);
end;
$$;

-- ---------------------------------------------------------------------------
-- hold_seats(): claim seats for a checkout session.
-- Steals expired holds in place; refuses live ones. Re-selecting is idempotent
-- because this token's existing holds are dropped first.
-- ---------------------------------------------------------------------------
drop function if exists events.hold_seats(uuid, uuid[], text, integer);
create or replace function events.hold_seats(
  p_event_id uuid,
  p_seat_ids uuid[],
  p_token text,
  p_minutes integer default 10
)
returns table (ok boolean, held uuid[], rejected uuid[], expires_at timestamptz)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_expires timestamptz;
  v_held uuid[] := '{}';
  v_rejected uuid[] := '{}';
  v_seat uuid;
  v_hit uuid;
begin
  if p_event_id is null or coalesce(btrim(p_token), '') = '' then
    return query select false, '{}'::uuid[], coalesce(p_seat_ids, '{}'::uuid[]), null::timestamptz;
    return;
  end if;

  v_expires := now() + (greatest(1, coalesce(p_minutes, 10)) || ' minutes')::interval;

  -- Drop this token's prior holds so a changed selection doesn't strand seats.
  delete from events.seat_holds
    where event_id = p_event_id and session_token = p_token;

  foreach v_seat in array coalesce(p_seat_ids, '{}'::uuid[])
  loop
    -- Already sold, comped or blocked: reject without touching holds.
    perform 1 from events.seat_assignments a
      where a.event_id = p_event_id and a.seat_id = v_seat and a.released_at is null;
    if found then
      v_rejected := v_rejected || v_seat;
      continue;
    end if;

    -- Take the hold, stealing it only if the existing one has expired.
    insert into events.seat_holds (event_id, seat_id, session_token, expires_at)
    values (p_event_id, v_seat, p_token, v_expires)
    on conflict (event_id, seat_id) do update
      set session_token = excluded.session_token,
          expires_at = excluded.expires_at
      where events.seat_holds.expires_at < now()
    returning seat_id into v_hit;

    if v_hit is null then
      v_rejected := v_rejected || v_seat;
    else
      v_held := v_held || v_hit;
    end if;
    v_hit := null;
  end loop;

  return query select coalesce(array_length(v_rejected, 1), 0) = 0, v_held, v_rejected, v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_seats(): drop a checkout session's holds (buyer closed the picker).
-- ---------------------------------------------------------------------------
drop function if exists events.release_seats(uuid, text);
create or replace function events.release_seats(p_event_id uuid, p_token text)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_count integer;
begin
  delete from events.seat_holds
    where event_id = p_event_id and session_token = coalesce(p_token, '');
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- release_order_seats(): return an order's seats to the pool on refund/cancel.
-- Without this, refunded seats leak permanently.
-- ---------------------------------------------------------------------------
drop function if exists events.release_order_seats(uuid);
create or replace function events.release_order_seats(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_count integer;
begin
  update events.seat_assignments
    set released_at = now()
    where order_id = p_order_id and released_at is null;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- buy_seats(): the seated purchase path.
--
-- Validates the buyer's holds, delegates the money/inventory work to the
-- existing events.buy_ticket (still owned by zzz_ticketing_addons.sql), then
-- writes one seat_assignments row per seat. Runs inside the caller's
-- transaction, so a seat lost between validation and insert raises a unique
-- violation that rolls the order back with it.
-- ---------------------------------------------------------------------------
drop function if exists events.buy_seats(uuid, text, text, text, numeric, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text, uuid[], text);
create or replace function events.buy_seats(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_ticket text,
  p_price numeric,
  p_addons numeric default 0,
  p_meta jsonb default '{}'::jsonb,
  p_stripe_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_tier_id text default null,
  p_slot_id text default null,
  p_discount_code text default null,
  p_donation numeric default 0,
  p_bundle_id text default null,
  p_attendees jsonb default null,
  p_access_code text default null,
  p_seat_ids uuid[] default '{}',
  p_seat_token text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_seats uuid[] := coalesce(p_seat_ids, '{}'::uuid[]);
  v_qty integer;
  v_map_id uuid;
  v_bad integer;
  v_res record;
  v_seat uuid;
  v_name text := coalesce(p_name, '');
  v_email text := coalesce(p_email, '');
begin
  -- A Stripe return trip carries only the token: seat ids would blow Stripe's
  -- 500-char metadata cap on a large block, and the live holds are the
  -- authoritative record anyway. Resolve them here.
  if coalesce(array_length(v_seats, 1), 0) = 0 and coalesce(btrim(p_seat_token), '') <> '' then
    select coalesce(array_agg(h.seat_id), '{}'::uuid[])
      into v_seats
      from events.seat_holds h
      where h.event_id = p_event_id
        and h.session_token = p_seat_token
        and h.expires_at > now();
  end if;

  v_qty := coalesce(array_length(v_seats, 1), 0);
  if v_qty = 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  select nullif(e.metadata->'seating'->>'seatMapId', '')::uuid
    into v_map_id
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;

  if v_map_id is null then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Every seat must belong to this event's map and still be active.
  select count(*) into v_bad
    from unnest(v_seats) as req(seat_id)
    where not exists (
      select 1 from events.seats s
      where s.id = req.seat_id and s.seat_map_id = v_map_id and s.active);
  if v_bad > 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Every seat must still be held by THIS buyer.
  select count(*) into v_bad
    from unnest(v_seats) as req(seat_id)
    where not exists (
      select 1 from events.seat_holds h
      where h.event_id = p_event_id
        and h.seat_id = req.seat_id
        and h.session_token = coalesce(p_seat_token, '')
        and h.expires_at > now());
  if v_bad > 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Money, capacity, tiers, discounts, counters — all unchanged.
  select * into v_res from events.buy_ticket(
    p_event_id, p_name, p_email, p_ticket, p_price, v_qty,
    coalesce(p_addons, 0), coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id,
    p_tier_id, p_slot_id, p_discount_code, p_donation, p_bundle_id,
    p_attendees, p_access_code);

  if not v_res.ok then
    return query select v_res.ok, v_res.order_id, v_res.sold, v_res.capacity, v_res.remaining, v_res.created;
    return;
  end if;

  -- An idempotent re-hit of an existing Stripe session already has its seats.
  if v_res.created then
    foreach v_seat in array v_seats
    loop
      insert into events.seat_assignments
        (event_id, seat_id, order_id, attendee_name, attendee_email, ticket_id, price, status)
      values
        (p_event_id, v_seat, v_res.order_id, v_name, v_email, p_tier_id,
         coalesce(p_price, 0), 'sold');
    end loop;

    delete from events.seat_holds
      where event_id = p_event_id and session_token = coalesce(p_seat_token, '');
  end if;

  return query select v_res.ok, v_res.order_id, v_res.sold, v_res.capacity, v_res.remaining, v_res.created;
end;
$$;
