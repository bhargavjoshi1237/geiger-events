-- Sellable expo booths
--
-- Owns events.hall_maps, events.hall_booths, events.booth_holds and
-- events.booth_assignments, plus the RPCs public_event_hall_map, hold_booths,
-- release_booths, release_order_booths and buy_booths.
--
-- Booths get exactly the machinery seats already have. A hall map is a
-- VENUE-LEVEL TEMPLATE built once and reused by many events:
--   events.hall_maps       one named exhibitor-floor configuration of a venue
--     events.hall_booths     one row per stall, percent-positioned
--
-- Per-event state is the same two thin tables seating uses:
--   events.booth_holds       TTL holds taken while an exhibitor checks out
--   events.booth_assignments the sold/comp/blocked stall, guarded by a unique
--                            partial index — that index IS the double-book guard
--
-- Which map an event sells, how booths are priced, and booth -> ticket mapping
-- live in events.events.metadata.expo (written via events.event_merge_meta):
--   { hallMapId, pricing: 'tier'|'direct', boothTiers: {}, holdMinutes }
--
--   pricing = 'tier'   the booth's mapped ticket sets the price, exactly as a
--                      seat map section does
--   pricing = 'direct' hall_booths.price sets the price and a nominated ticket
--                      carries the order line
--
-- NOTE ON buy_ticket: this file does NOT redefine it. 20260726194138 remains its
-- single owner. Booth purchases go through events.buy_booths(), a thin wrapper
-- that validates holds, delegates to buy_ticket, then writes the assignments —
-- the same shape as events.buy_seats().
--
-- Also migrates the pre-existing exhibitor booths, which lived as
-- events.conference_records with module = 'booth', into hall_booths so there is
-- one booth concept rather than two. The source records are COPIED, not moved.
--
-- Self-contained and idempotent: safe to re-run via `npm run db:push`.

-- @up
create extension if not exists pgcrypto;
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ---------------------------------------------------------------------------
-- Template tables
-- ---------------------------------------------------------------------------

-- One named exhibitor-floor configuration of a venue. A venue has many (full
-- hall, half hall, halls 1 + 2 combined) — each is a different hall map.
create table if not exists events.hall_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  venue_id uuid references events.venues(id) on delete cascade,
  name text not null default 'Untitled hall',
  -- Draft · Active · Archived
  status text not null default 'Draft',
  -- Canvas aspect, the central feature, and the traced-over plan image:
  -- { aspect, field: {...}, background: { url, path, opacity } }
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One row per stall. Geometry is percent-of-canvas, matching seat_map_sections.
-- Unlike a seat map section a booth has no interior chairs — the booth IS the
-- unit of sale, so it carries its own price and size class.
create table if not exists events.hall_booths (
  id uuid primary key default gen_random_uuid(),
  hall_map_id uuid not null references events.hall_maps(id) on delete cascade,
  -- Stall number as printed on the floor ("A12"). Unique within the map.
  code text not null default '',
  name text not null default '',
  -- booth (sellable) | zone (a named area, not sold) | feature (entrance, cafe)
  kind text not null default 'booth',
  hall text not null default '',
  size_class text not null default 'Standard',
  price numeric(14, 2) not null default 0,
  x numeric(6, 2) not null default 10,
  y numeric(6, 2) not null default 10,
  width numeric(6, 2) not null default 8,
  height numeric(6, 2) not null default 6,
  rotation numeric(6, 2) not null default 0,
  -- Power, water, corner, island, frontage… not-yet-promoted booth attributes.
  amenities jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-fill missing columns on older copies of the tables.
alter table events.hall_maps add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table events.hall_maps add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.hall_maps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.hall_maps add column if not exists deleted_at timestamptz;
alter table events.hall_booths add column if not exists amenities jsonb not null default '{}'::jsonb;
alter table events.hall_booths add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.hall_booths add column if not exists active boolean not null default true;
alter table events.hall_booths add column if not exists sort_order integer not null default 0;

create unique index if not exists events_hall_booths_code_idx
  on events.hall_booths (hall_map_id, code) where code <> '';
create index if not exists events_hall_booths_map_idx
  on events.hall_booths (hall_map_id, sort_order);
create index if not exists events_hall_maps_venue_idx
  on events.hall_maps (venue_id) where deleted_at is null;
create index if not exists events_hall_maps_project_idx
  on events.hall_maps (project_id) where deleted_at is null;

drop trigger if exists hall_maps_touch_updated_at on events.hall_maps;
create trigger hall_maps_touch_updated_at
before update on events.hall_maps
for each row execute function events.touch_updated_at();

drop trigger if exists hall_booths_touch_updated_at on events.hall_booths;
create trigger hall_booths_touch_updated_at
before update on events.hall_booths
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Per-event tables
-- ---------------------------------------------------------------------------

-- A booth held while an exhibitor checks out. Expired holds are never swept by
-- a job: every read filters `expires_at > now()` and hold_booths() steals dead
-- rows in place, so the table self-heals — same as events.seat_holds.
create table if not exists events.booth_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  booth_id uuid not null references events.hall_booths(id) on delete cascade,
  -- Opaque per-browser token; survives the Stripe redirect via sessionStorage.
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists events_booth_holds_unique_idx
  on events.booth_holds (event_id, booth_id);
create index if not exists events_booth_holds_token_idx
  on events.booth_holds (event_id, session_token);

-- The sold/comp/blocked stall. Organiser-reserved booths live here as
-- status = 'blocked'.
create table if not exists events.booth_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  booth_id uuid not null references events.hall_booths(id) on delete cascade,
  order_id uuid references events.event_orders(id) on delete set null,
  exhibitor_name text not null default '',
  exhibitor_email text not null default '',
  -- The event ticket tier this booth was sold under (metadata ticket id).
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
-- unique index is valid — a refunded booth frees up by being released.
create unique index if not exists events_booth_assignments_live_idx
  on events.booth_assignments (event_id, booth_id) where released_at is null;
create index if not exists events_booth_assignments_order_idx
  on events.booth_assignments (order_id);
create index if not exists events_booth_assignments_event_idx
  on events.booth_assignments (event_id) where released_at is null;

-- ---------------------------------------------------------------------------
-- RLS — members manage templates; the storefront goes through the RPCs below.
-- Mirrors the seating policies exactly.
-- ---------------------------------------------------------------------------

alter table events.hall_maps enable row level security;
alter table events.hall_booths enable row level security;
alter table events.booth_holds enable row level security;
alter table events.booth_assignments enable row level security;

drop policy if exists hall_maps_member_all on events.hall_maps;
create policy hall_maps_member_all on events.hall_maps
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists hall_booths_member_all on events.hall_booths;
create policy hall_booths_member_all on events.hall_booths
  for all to authenticated
  using (exists (
    select 1 from events.hall_maps m
    where m.id = hall_map_id and events.can_access_project(m.project_id)))
  with check (exists (
    select 1 from events.hall_maps m
    where m.id = hall_map_id and events.can_access_project(m.project_id)));

drop policy if exists booth_holds_member_read on events.booth_holds;
create policy booth_holds_member_read on events.booth_holds
  for select to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)));

drop policy if exists booth_assignments_member_all on events.booth_assignments;
create policy booth_assignments_member_all on events.booth_assignments
  for all to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)))
  with check (exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)));

-- ---------------------------------------------------------------------------
-- public_event_hall_map(): the anon read for the storefront.
-- Mirrors events.public_event_seat_map — exhibitors get the map and what's
-- taken without the member-only tables ever being exposed.
-- ---------------------------------------------------------------------------
drop function if exists events.public_event_hall_map(uuid);
create or replace function events.public_event_hall_map(p_event_id uuid)
returns table (map jsonb, booths jsonb, taken jsonb)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_map_id uuid;
begin
  select nullif(e.metadata->'expo'->>'hallMapId', '')::uuid
    into v_map_id
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;

  if v_map_id is null then
    return query select null::jsonb, '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  return query
  select
    (select jsonb_build_object('id', m.id, 'name', m.name, 'config', m.config)
       from events.hall_maps m
       where m.id = v_map_id and m.deleted_at is null),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', b.id, 'code', b.code, 'name', b.name, 'kind', b.kind,
              'hall', b.hall, 'sizeClass', b.size_class, 'price', b.price,
              'x', b.x, 'y', b.y, 'width', b.width, 'height', b.height,
              'rotation', b.rotation, 'amenities', b.amenities,
              'sortOrder', b.sort_order
            ) order by b.sort_order), '[]'::jsonb)
       from events.hall_booths b
       where b.hall_map_id = v_map_id and b.active),
    (select coalesce(jsonb_agg(t.booth_id), '[]'::jsonb) from (
       select a.booth_id from events.booth_assignments a
         where a.event_id = p_event_id and a.released_at is null
       union
       select h.booth_id from events.booth_holds h
         where h.event_id = p_event_id and h.expires_at > now()
     ) t);
end;
$$;

-- ---------------------------------------------------------------------------
-- hold_booths(): claim booths for a checkout session.
-- Steals expired holds in place; refuses live ones. Re-selecting is idempotent
-- because this token's existing holds are dropped first.
-- ---------------------------------------------------------------------------
drop function if exists events.hold_booths(uuid, uuid[], text, integer);
create or replace function events.hold_booths(
  p_event_id uuid,
  p_booth_ids uuid[],
  p_token text,
  p_minutes integer default 15
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
  v_booth uuid;
  v_hit uuid;
begin
  if p_event_id is null or coalesce(btrim(p_token), '') = '' then
    return query select false, '{}'::uuid[], coalesce(p_booth_ids, '{}'::uuid[]), null::timestamptz;
    return;
  end if;

  v_expires := now() + (greatest(1, coalesce(p_minutes, 15)) || ' minutes')::interval;

  -- Drop this token's prior holds so a changed selection doesn't strand booths.
  delete from events.booth_holds
    where event_id = p_event_id and session_token = p_token;

  foreach v_booth in array coalesce(p_booth_ids, '{}'::uuid[])
  loop
    -- Already sold, comped or blocked: reject without touching holds.
    perform 1 from events.booth_assignments a
      where a.event_id = p_event_id and a.booth_id = v_booth and a.released_at is null;
    if found then
      v_rejected := v_rejected || v_booth;
      continue;
    end if;

    -- Only a sellable booth can be held; zones and features are decoration.
    perform 1 from events.hall_booths b
      where b.id = v_booth and b.active and b.kind = 'booth';
    if not found then
      v_rejected := v_rejected || v_booth;
      continue;
    end if;

    insert into events.booth_holds (event_id, booth_id, session_token, expires_at)
    values (p_event_id, v_booth, p_token, v_expires)
    on conflict (event_id, booth_id) do update
      set session_token = excluded.session_token,
          expires_at = excluded.expires_at
      where events.booth_holds.expires_at < now()
    returning booth_id into v_hit;

    if v_hit is null then
      v_rejected := v_rejected || v_booth;
    else
      v_held := v_held || v_hit;
    end if;
    v_hit := null;
  end loop;

  return query select coalesce(array_length(v_rejected, 1), 0) = 0, v_held, v_rejected, v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_booths(): drop a checkout session's holds (exhibitor closed the map).
-- ---------------------------------------------------------------------------
drop function if exists events.release_booths(uuid, text);
create or replace function events.release_booths(p_event_id uuid, p_token text)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_count integer;
begin
  delete from events.booth_holds
    where event_id = p_event_id and session_token = coalesce(p_token, '');
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- release_order_booths(): return an order's booths to the pool on refund.
-- Without this, refunded booths leak permanently.
-- ---------------------------------------------------------------------------
drop function if exists events.release_order_booths(uuid);
create or replace function events.release_order_booths(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_count integer;
begin
  update events.booth_assignments
    set released_at = now()
    where order_id = p_order_id and released_at is null;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- buy_booths(): the exhibitor purchase path.
--
-- Validates the holds, delegates the money/inventory work to the existing
-- events.buy_ticket, then writes one booth_assignments row per booth. Runs
-- inside the caller's transaction, so a booth lost between validation and
-- insert raises a unique violation that rolls the order back with it.
--
-- Pricing follows events.metadata.expo.pricing:
--   'tier'   — p_price is the mapped ticket's price, as with seats
--   'direct' — each booth's own hall_booths.price applies. buy_ticket can only
--              multiply one unit price by the quantity, so it is called with the
--              mean and the order total is then corrected to the exact sum.
--              Discounts and donations already folded into `total` survive,
--              because only the booth subtotal is swapped.
-- ---------------------------------------------------------------------------
drop function if exists events.buy_booths(uuid, text, text, text, numeric, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text, uuid[], text);
create or replace function events.buy_booths(
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
  p_booth_ids uuid[] default '{}',
  p_booth_token text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_booths uuid[] := coalesce(p_booth_ids, '{}'::uuid[]);
  v_qty integer;
  v_map_id uuid;
  v_expo jsonb;
  v_pricing text;
  v_bad integer;
  v_res record;
  v_booth uuid;
  v_unit numeric;
  v_sum numeric := 0;
  v_mean numeric;
  v_name text := coalesce(p_name, '');
  v_email text := coalesce(p_email, '');
begin
  -- A Stripe return trip carries only the token: booth ids would blow Stripe's
  -- 500-char metadata cap on a large block, and the live holds are the
  -- authoritative record anyway. Resolve them here.
  if coalesce(array_length(v_booths, 1), 0) = 0 and coalesce(btrim(p_booth_token), '') <> '' then
    select coalesce(array_agg(h.booth_id), '{}'::uuid[])
      into v_booths
      from events.booth_holds h
      where h.event_id = p_event_id
        and h.session_token = p_booth_token
        and h.expires_at > now();
  end if;

  v_qty := coalesce(array_length(v_booths, 1), 0);
  if v_qty = 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  select e.metadata->'expo' into v_expo
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;

  v_map_id := nullif(v_expo->>'hallMapId', '')::uuid;
  v_pricing := coalesce(nullif(v_expo->>'pricing', ''), 'tier');

  if v_map_id is null then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Every booth must belong to this event's map, be active, and be sellable.
  select count(*) into v_bad
    from unnest(v_booths) as req(booth_id)
    where not exists (
      select 1 from events.hall_booths b
      where b.id = req.booth_id and b.hall_map_id = v_map_id and b.active and b.kind = 'booth');
  if v_bad > 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- Every booth must still be held by THIS buyer.
  select count(*) into v_bad
    from unnest(v_booths) as req(booth_id)
    where not exists (
      select 1 from events.booth_holds h
      where h.event_id = p_event_id
        and h.booth_id = req.booth_id
        and h.session_token = coalesce(p_booth_token, '')
        and h.expires_at > now());
  if v_bad > 0 then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  -- The exact booth subtotal, whichever pricing mode is in force.
  if v_pricing = 'direct' then
    select coalesce(sum(b.price), 0) into v_sum
      from events.hall_booths b
      where b.id = any(v_booths);
  else
    v_sum := coalesce(p_price, 0) * v_qty;
  end if;

  v_mean := round(v_sum / v_qty, 2);

  select * into v_res from events.buy_ticket(
    p_event_id, p_name, p_email, p_ticket,
    case when v_pricing = 'direct' then v_mean else coalesce(p_price, 0) end,
    v_qty,
    coalesce(p_addons, 0), coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id,
    p_tier_id, p_slot_id, p_discount_code, p_donation, p_bundle_id,
    p_attendees, p_access_code);

  if not v_res.ok then
    return query select v_res.ok, v_res.order_id, v_res.sold, v_res.capacity, v_res.remaining, v_res.created;
    return;
  end if;

  -- An idempotent re-hit of an existing Stripe session already has its booths.
  if v_res.created then
    foreach v_booth in array v_booths
    loop
      if v_pricing = 'direct' then
        select b.price into v_unit from events.hall_booths b where b.id = v_booth;
      else
        v_unit := coalesce(p_price, 0);
      end if;

      insert into events.booth_assignments
        (event_id, booth_id, order_id, exhibitor_name, exhibitor_email, ticket_id, price, status)
      values
        (p_event_id, v_booth, v_res.order_id, v_name, v_email, p_tier_id,
         coalesce(v_unit, 0), 'sold');
    end loop;

    -- Swap the approximated booth subtotal for the exact one, leaving any
    -- discount or donation already folded into `total` untouched.
    if v_pricing = 'direct' and v_mean * v_qty <> v_sum then
      update events.event_orders
        set total = greatest(0, total - (v_mean * v_qty) + v_sum)
        where id = v_res.order_id;
    end if;

    delete from events.booth_holds
      where event_id = p_event_id and session_token = coalesce(p_booth_token, '');
  end if;

  return query select v_res.ok, v_res.order_id, v_res.sold, v_res.capacity, v_res.remaining, v_res.created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Migrate the pre-existing conference booths into the new tables so the app has
-- ONE booth concept. Booths lived as events.conference_records with
-- module = 'booth' and their floor position in config.x / config.y.
--
-- The source records are COPIED, not moved — nothing is deleted. Each project
-- with booths gets one "Migrated exhibitor hall" map, and every copied booth
-- keeps its source id in metadata.sourceRecordId, which is also what makes this
-- whole block idempotent.
-- ---------------------------------------------------------------------------
insert into events.hall_maps (project_id, name, status, config, metadata)
select distinct
  r.project_id,
  'Migrated exhibitor hall',
  'Active',
  jsonb_build_object('aspect', '4/3', 'field', jsonb_build_object('shape', 'none')),
  jsonb_build_object('migratedFrom', 'conference_records')
from events.conference_records r
where r.module = 'booth'
  and r.deleted_at is null
  and r.project_id is not null
  and not exists (
    select 1 from events.hall_maps m
    where m.project_id = r.project_id
      and m.metadata->>'migratedFrom' = 'conference_records'
  );

insert into events.hall_booths (
  hall_map_id, code, name, kind, hall, size_class, price,
  x, y, width, height, metadata, sort_order
)
select
  src.map_id,
  src.name,
  src.name,
  'booth',
  src.hall,
  src.size_class,
  src.price,
  -- Unplaced booths (never dragged onto the old floor) are parked in a tidy row
  -- along the top rather than stacked on each other at the origin.
  coalesce(src.x, 4 + ((src.seq - 1) % 20) * 4.6),
  coalesce(src.y, 3),
  8,
  6,
  jsonb_build_object('sourceRecordId', src.record_id::text, 'sourceStatus', src.status),
  src.seq
from (
  select
    m.id as map_id,
    r.id as record_id,
    r.name,
    r.status,
    coalesce(r.config->>'hall', '') as hall,
    coalesce(nullif(r.config->>'size', ''), 'Standard') as size_class,
    coalesce((r.config->>'price')::numeric, 0) as price,
    (r.config->>'x')::numeric as x,
    (r.config->>'y')::numeric as y,
    row_number() over (partition by m.id order by r.created_at) as seq
  from events.conference_records r
  join events.hall_maps m
    on m.project_id = r.project_id
   and m.metadata->>'migratedFrom' = 'conference_records'
  where r.module = 'booth'
    and r.deleted_at is null
    and r.project_id is not null
    and not exists (
      select 1 from events.hall_booths b
      where b.hall_map_id = m.id
        and b.metadata->>'sourceRecordId' = r.id::text
    )
) src
on conflict do nothing;

-- A booth that was Reserved or Occupied on the old floor is held off sale on the
-- new one, so the migration doesn't quietly put sold stalls back up for grabs.
-- Nothing points at the migrated hall at migration time; this exists so a re-run
-- after an event is wired up still does the right thing.
insert into events.booth_assignments (event_id, booth_id, status, note)
select e.id, b.id, 'blocked', 'Reserved on the migrated conference floor'
from events.hall_booths b
join events.hall_maps m on m.id = b.hall_map_id
join events.events e
  on nullif(e.metadata->'expo'->>'hallMapId', '')::uuid = m.id
 and e.deleted_at is null
where m.metadata->>'migratedFrom' = 'conference_records'
  and b.metadata->>'sourceStatus' in ('Reserved', 'Occupied')
  and not exists (
    select 1 from events.booth_assignments a
    where a.event_id = e.id and a.booth_id = b.id and a.released_at is null
  );

-- @down
drop function if exists events.buy_booths(uuid, text, text, text, numeric, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text, uuid[], text);
drop function if exists events.release_order_booths(uuid);
drop function if exists events.release_booths(uuid, text);
drop function if exists events.hold_booths(uuid, uuid[], text, integer);
drop function if exists events.public_event_hall_map(uuid);

drop policy if exists booth_assignments_member_all on events.booth_assignments;
drop policy if exists booth_holds_member_read on events.booth_holds;
drop policy if exists hall_booths_member_all on events.hall_booths;
drop policy if exists hall_maps_member_all on events.hall_maps;

drop table if exists events.booth_assignments cascade;
drop table if exists events.booth_holds cascade;
drop table if exists events.hall_booths cascade;
drop table if exists events.hall_maps cascade;
