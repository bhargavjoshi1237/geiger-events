-- ===========================================================================
-- Geiger Events — ticket orders / registrations
--
-- Self-contained and idempotent. Depends on events.events (events.sql).
-- Provides an orders table plus an atomic events.buy_ticket() RPC that records an
-- order AND bumps the event's sold/revenue in one transaction, with a capacity
-- guard so an event can't oversell under concurrent purchases.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.event_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events(id) on delete cascade,
  buyer_name text not null default '',
  buyer_email text not null default '',
  ticket_name text not null default 'General Admission',
  ticket_price numeric(14, 2) not null default 0,
  quantity integer not null default 1,
  total numeric(14, 2) not null default 0,
  status text not null default 'confirmed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table events.event_orders add column if not exists stripe_session_id text;
alter table events.event_orders add column if not exists stripe_payment_intent_id text;

create index if not exists flow_event_orders_event_idx
  on events.event_orders (event_id, created_at desc);

-- Guards against double-processing the same Checkout Session (e.g. the buyer
-- refreshing the return page) from creating two orders.
create unique index if not exists flow_event_orders_stripe_session_idx
  on events.event_orders (stripe_session_id)
  where stripe_session_id is not null;

-- Demo-open RLS (the storefront is unauthenticated). Tighten once auth lands.
alter table events.event_orders enable row level security;

drop policy if exists flow_event_orders_demo_all on events.event_orders;
create policy flow_event_orders_demo_all on events.event_orders
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Atomic purchase. Locks the event row, refuses to oversell, inserts the order,
-- bumps sold/revenue, and returns the new tallies. security definer so it keeps
-- working if/when the tables get stricter RLS.
--
-- p_addons is the per-ticket add-on total from chosen offerings; the order total
-- (and the revenue bump) is (price + addons) × qty. p_meta carries the buyer's
-- offering selections, stored on the order's metadata bag. p_stripe_session_id /
-- p_stripe_payment_intent_id record the Stripe references for a paid order (both
-- null for free/no-payment tickets).
-- `created` tells the caller whether this call actually inserted a new order
-- (false on an idempotent re-hit of an existing stripe_session_id) so a
-- webhook/return handler can skip re-sending a confirmation email.
-- Older signatures are dropped so callers resolve to this one (Postgres treats a
-- new trailing-default-arg list, or a changed return type, as requiring a drop
-- rather than an in-place replace).
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text);

create or replace function events.buy_ticket(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_ticket text,
  p_price numeric,
  p_qty integer,
  p_addons numeric default 0,
  p_meta jsonb default '{}'::jsonb,
  p_stripe_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events
as $$
declare
  v_sold integer;
  v_cap integer;
  v_total numeric;
  v_order uuid;
  v_qty integer := greatest(1, coalesce(p_qty, 1));
begin
  -- Idempotent re-entry: a Checkout Session already turned into an order (e.g.
  -- the buyer refreshed the return page) — hand back the existing tallies
  -- instead of double-counting sold/revenue.
  if p_stripe_session_id is not null then
    select o.id into v_order
      from events.event_orders o
      where o.stripe_session_id = p_stripe_session_id;

    if found then
      select e.sold, e.capacity into v_sold, v_cap
        from events.events e where e.id = p_event_id;
      return query select true, v_order, v_sold, v_cap, greatest(0, v_cap - v_sold), false;
      return;
    end if;
  end if;

  select e.sold, e.capacity
    into v_sold, v_cap
    from events.events e
    where e.id = p_event_id and e.deleted_at is null
    for update;

  if not found then
    return query select false, null::uuid, 0, 0, 0, false;
    return;
  end if;

  if v_cap > 0 and v_sold + v_qty > v_cap then
    return query select false, null::uuid, v_sold, v_cap, greatest(0, v_cap - v_sold), false;
    return;
  end if;

  v_total := (coalesce(p_price, 0) + coalesce(p_addons, 0)) * v_qty;

  insert into events.event_orders
    (event_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata, stripe_session_id, stripe_payment_intent_id)
  values
    (p_event_id, coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_ticket, 'General Admission'), coalesce(p_price, 0), v_qty, v_total, coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id)
  returning id into v_order;

  update events.events as e
    set sold = e.sold + v_qty,
        revenue = e.revenue + v_total
    where e.id = p_event_id
    returning e.sold, e.capacity into v_sold, v_cap;

  return query select true, v_order, v_sold, v_cap, greatest(0, v_cap - v_sold), true;
end;
$$;

grant execute on function events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text)
  to anon, authenticated;
