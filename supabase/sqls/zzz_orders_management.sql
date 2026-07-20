-- ===========================================================================
-- Geiger Events — Order Management module
--
-- Self-contained and idempotent. Backs the operational Orders area (All Orders,
-- Refunds & Cancellations, Transactions, Billing & Receipts, Disputes). Runs
-- after orders.sql and zz_project_access.sql (filename order: zzz_) so it can
-- extend events.event_orders and reference the finalized buy_ticket().
--
-- Adds:
--   * refunded_total / cancelled_at columns on events.event_orders (buy_ticket
--     is left untouched; display status is derived in the data layer).
--   * events.order_refunds  — one row per issued/requested refund, order-linked.
--   * events.order_events   — the per-order activity timeline.
--   * events.order_disputes — chargeback / dispute tracking.
--   * events.issue_order_refund(...) — records a refund, bumps refunded_total,
--     adjusts event revenue, and writes a timeline entry, atomically. The real
--     Stripe refund call belongs in a future server route (see hook note below);
--     this RPC only records.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger fn (defined locally; suite convention).
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
-- event_orders — refund/cancellation lifecycle columns.
-- ---------------------------------------------------------------------------
alter table events.event_orders add column if not exists refunded_total numeric(14, 2) not null default 0;
alter table events.event_orders add column if not exists cancelled_at timestamptz;

-- ---------------------------------------------------------------------------
-- order_refunds — one row per refund against an order (full or partial).
-- ---------------------------------------------------------------------------
create table if not exists events.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references events.event_orders(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  amount numeric(14, 2) not null default 0,
  reason text not null default '',
  -- duplicate | requested_by_customer | event_cancelled | fraudulent | other
  reason_code text not null default 'other',
  -- original | credit | manual
  method text not null default 'original',
  -- Requested · Approved · Denied · Issued
  status text not null default 'Requested',
  notes text not null default '',
  -- Actor who issued the refund (no FK: this DB has no shared public.users).
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists order_refunds_touch_updated_at on events.order_refunds;
create trigger order_refunds_touch_updated_at
before update on events.order_refunds
for each row execute function events.touch_updated_at();

create index if not exists events_order_refunds_project_idx
  on events.order_refunds (project_id, created_at desc) where deleted_at is null;
create index if not exists events_order_refunds_order_idx
  on events.order_refunds (order_id);

alter table events.order_refunds enable row level security;
drop policy if exists events_order_refunds_demo_all on events.order_refunds;
create policy events_order_refunds_demo_all on events.order_refunds
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- order_events — the per-order activity timeline.
-- ---------------------------------------------------------------------------
create table if not exists events.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references events.event_orders(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  -- created | refund_requested | refund_issued | cancelled | receipt_sent |
  -- invoice_generated | note | status_change | disputed
  type text not null default 'note',
  summary text not null default '',
  amount numeric(14, 2),
  actor text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_order_events_order_idx
  on events.order_events (order_id, created_at desc);

alter table events.order_events enable row level security;
drop policy if exists events_order_events_demo_all on events.order_events;
create policy events_order_events_demo_all on events.order_events
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- order_disputes — chargeback / dispute tracking.
-- ---------------------------------------------------------------------------
create table if not exists events.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references events.event_orders(id) on delete set null,
  event_id uuid references events.events(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  amount numeric(14, 2) not null default 0,
  -- Needs response · Under review · Won · Lost
  status text not null default 'Needs response',
  reason text not null default '',
  evidence_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists order_disputes_touch_updated_at on events.order_disputes;
create trigger order_disputes_touch_updated_at
before update on events.order_disputes
for each row execute function events.touch_updated_at();

create index if not exists events_order_disputes_project_idx
  on events.order_disputes (project_id, created_at desc) where deleted_at is null;

alter table events.order_disputes enable row level security;
drop policy if exists events_order_disputes_demo_all on events.order_disputes;
create policy events_order_disputes_demo_all on events.order_disputes
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- issue_order_refund — record a refund atomically.
--
-- Locks the order, clamps the amount so it can't over-refund, inserts an
-- order_refunds row (status Issued), bumps event_orders.refunded_total, reduces
-- the parent event's revenue, and writes an order_events timeline entry.
--
-- STRIPE-READY HOOK: this RPC only records the refund in our own tables. To move
-- real money, a future server route should call stripe.refunds.create() for the
-- order's payment intent and, on success, call this RPC (or reconcile via the
-- charge.refunded webhook). No external call happens here.
-- ---------------------------------------------------------------------------
drop function if exists events.issue_order_refund(uuid, numeric, text, text, text, text);

create or replace function events.issue_order_refund(
  p_order_id uuid,
  p_amount numeric,
  p_reason text default '',
  p_reason_code text default 'other',
  p_method text default 'original',
  p_actor text default ''
)
returns table (ok boolean, refund_id uuid, refunded_total numeric, order_total numeric)
language plpgsql
security definer
set search_path = events
as $$
declare
  v_total numeric;
  v_refunded numeric;
  v_event uuid;
  v_project uuid;
  v_amount numeric;
  v_refund uuid;
begin
  select o.total, o.refunded_total, o.event_id, o.project_id
    into v_total, v_refunded, v_event, v_project
    from events.event_orders o
    where o.id = p_order_id
    for update;

  if not found then
    return query select false, null::uuid, 0::numeric, 0::numeric;
    return;
  end if;

  -- Clamp so the running refunded total never exceeds the order total.
  v_amount := least(greatest(coalesce(p_amount, 0), 0), greatest(v_total - v_refunded, 0));
  if v_amount <= 0 then
    return query select false, null::uuid, v_refunded, v_total;
    return;
  end if;

  insert into events.order_refunds
    (order_id, event_id, project_id, amount, reason, reason_code, method, status)
  values
    (p_order_id, v_event, v_project, v_amount, coalesce(p_reason, ''),
     coalesce(p_reason_code, 'other'), coalesce(p_method, 'original'), 'Issued')
  returning id into v_refund;

  update events.event_orders
    set refunded_total = refunded_total + v_amount,
        status = case when refunded_total + v_amount >= total then 'refunded' else status end
    where id = p_order_id
    returning refunded_total, total into v_refunded, v_total;

  -- Give the money back on the event's revenue tally.
  if v_event is not null then
    update events.events set revenue = greatest(0, revenue - v_amount) where id = v_event;
  end if;

  insert into events.order_events (order_id, project_id, type, summary, amount, actor)
  values (
    p_order_id, v_project, 'refund_issued',
    'Refund issued' || case when coalesce(p_reason, '') <> '' then ' — ' || p_reason else '' end,
    v_amount, coalesce(p_actor, '')
  );

  return query select true, v_refund, v_refunded, v_total;
end;
$$;

grant execute on function events.issue_order_refund(uuid, numeric, text, text, text, text)
  to anon, authenticated;
