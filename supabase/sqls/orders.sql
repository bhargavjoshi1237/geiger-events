-- ===========================================================================
-- Geiger Events — ticket orders / registrations
--
-- Self-contained and idempotent. Depends on public.flow_events (events.sql).
-- Provides an orders table plus an atomic flow_buy_ticket() RPC that records an
-- order AND bumps the event's sold/revenue in one transaction, with a capacity
-- guard so an event can't oversell under concurrent purchases.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists public.flow_event_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.flow_events(id) on delete cascade,
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

create index if not exists flow_event_orders_event_idx
  on public.flow_event_orders (event_id, created_at desc);

-- Demo-open RLS (the storefront is unauthenticated). Tighten once auth lands.
alter table public.flow_event_orders enable row level security;

drop policy if exists flow_event_orders_demo_all on public.flow_event_orders;
create policy flow_event_orders_demo_all on public.flow_event_orders
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
-- offering selections, stored on the order's metadata bag.
-- The pre-offerings 6-arg signature is dropped so callers resolve to this one.
drop function if exists public.flow_buy_ticket(uuid, text, text, text, numeric, integer);

create or replace function public.flow_buy_ticket(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_ticket text,
  p_price numeric,
  p_qty integer,
  p_addons numeric default 0,
  p_meta jsonb default '{}'::jsonb
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sold integer;
  v_cap integer;
  v_total numeric;
  v_order uuid;
  v_qty integer := greatest(1, coalesce(p_qty, 1));
begin
  select e.sold, e.capacity
    into v_sold, v_cap
    from public.flow_events e
    where e.id = p_event_id and e.deleted_at is null
    for update;

  if not found then
    return query select false, null::uuid, 0, 0, 0;
    return;
  end if;

  if v_cap > 0 and v_sold + v_qty > v_cap then
    return query select false, null::uuid, v_sold, v_cap, greatest(0, v_cap - v_sold);
    return;
  end if;

  v_total := (coalesce(p_price, 0) + coalesce(p_addons, 0)) * v_qty;

  insert into public.flow_event_orders
    (event_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata)
  values
    (p_event_id, coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_ticket, 'General Admission'), coalesce(p_price, 0), v_qty, v_total, coalesce(p_meta, '{}'::jsonb))
  returning id into v_order;

  update public.flow_events as e
    set sold = e.sold + v_qty,
        revenue = e.revenue + v_total
    where e.id = p_event_id
    returning e.sold, e.capacity into v_sold, v_cap;

  return query select true, v_order, v_sold, v_cap, greatest(0, v_cap - v_sold);
end;
$$;

grant execute on function public.flow_buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb)
  to anon, authenticated;
