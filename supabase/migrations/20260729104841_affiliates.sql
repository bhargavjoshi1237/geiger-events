-- Affiliates addon
--
-- Owns every events.affiliate_* table plus the attribution, click-logging and
-- clawback RPCs. Design:
-- docs/superpowers/specs/2026-07-29-affiliates-addon-design.md
--
-- The model in one sentence: an affiliate PERSON is project-wide (one identity,
-- one portal login, one lifetime earnings view), while each EVENT runs its own
-- fully independent PROGRAM — own tier ladder, rates, rules, budget and
-- enrolment — optionally minted from a reusable template.
--
-- Deliberately NOT touched: events.buy_ticket. Attribution runs as a separate
-- call after the order exists, so the purchase path keeps its capacity/oversell
-- guarantees and a failed attribution can never lose a sale.

-- @up
create extension if not exists pgcrypto;

create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

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
-- 1. Affiliates — the project-wide person.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Portal identity. Affiliates sign in through the existing members portal, so
  -- this points at the same person record buyers use. Null until they claim the
  -- invite and set a password.
  portal_member_id uuid references events.portal_members(id) on delete set null,
  name text not null default '',
  email text not null default '',
  -- Default tracked-link slug. Per-enrolment slugs override it so an affiliate
  -- can run distinct links per event.
  slug text not null,
  -- invited | active | suspended
  status text not null default 'invited',
  invited_at timestamptz,
  accepted_at timestamptz,
  -- Payout destination (method, handle, notes) — not payment credentials.
  payout_details jsonb not null default '{}'::jsonb,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists affiliates_project_idx
  on events.affiliates (project_id, created_at desc)
  where deleted_at is null;

create unique index if not exists affiliates_project_email_idx
  on events.affiliates (project_id, lower(email))
  where deleted_at is null;

create unique index if not exists affiliates_project_slug_idx
  on events.affiliates (project_id, lower(slug))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Program templates — a reusable ladder + rules bundle a program starts
--    from. Copy-on-create: a program NEVER syncs back to its template.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_program_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled template',
  description text not null default '',
  -- Same shapes as affiliate_programs.rules and the affiliate_tiers rows.
  rules jsonb not null default '{}'::jsonb,
  tiers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists affiliate_program_templates_project_idx
  on events.affiliate_program_templates (project_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. Programs — one per event, fully independent.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_programs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  name text not null default 'Affiliate program',
  -- draft | active | paused | ended
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  -- Hard stop on the event's own date, regardless of ends_at.
  stop_at_event_start boolean not null default false,
  -- Last-touch attribution window for the ?ref cookie, in days.
  attribution_window_days integer not null default 30,
  -- What the rate multiplies:
  --   commission_base:   tickets | tickets_addons
  --   discount_handling: post | pre
  commission_base text not null default 'tickets',
  discount_handling text not null default 'post',
  -- Total commission this program may ever accrue; null = uncapped. Exhausting
  -- it auto-pauses the program in attribute_affiliate_order.
  budget_cap numeric(14, 2),
  -- Default per-affiliate ceiling; an enrolment may override it.
  affiliate_cap numeric(14, 2),
  -- Eligibility gates evaluated at attribution time. Keys:
  --   excludeFreeTickets, excludeDiscountedOrders (bool)
  --   excludedTicketTypes (text[]), minOrderValue (numeric)
  rules jsonb not null default '{}'::jsonb,
  -- Automatic tier movement on rolling sales; false = manual tiers only.
  auto_tiers boolean not null default false,
  auto_tier_window_days integer not null default 90,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One live program per event — "per-event, fully separate" is the whole model.
create unique index if not exists affiliate_programs_event_idx
  on events.affiliate_programs (event_id)
  where deleted_at is null;

create index if not exists affiliate_programs_project_idx
  on events.affiliate_programs (project_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Tiers — the ladder rows of one program.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_tiers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references events.affiliate_programs(id) on delete cascade,
  name text not null default 'Tier',
  -- Ladder order, low to high; also the auto-promotion order.
  rank integer not null default 0,
  -- Sales needed to reach this tier when auto_tiers is on, measured over the
  -- program's rolling window. Ignored for manual assignment.
  threshold_sales integer not null default 0,
  threshold_revenue numeric(14, 2) not null default 0,
  -- percent | flat_per_ticket | flat_per_order
  rate_model text not null default 'percent',
  rate_value numeric(14, 2) not null default 0,
  -- Per-ticket-type overrides: { "<ticket type name>": <rate_value> }. Layered
  -- on top of rate_model, which stays the unit.
  ticket_type_rates jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists affiliate_tiers_program_idx
  on events.affiliate_tiers (program_id, rank)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 5. Enrolments — (program, affiliate). Carries the tracked slug and the code.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_enrolments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references events.affiliate_programs(id) on delete cascade,
  affiliate_id uuid not null references events.affiliates(id) on delete cascade,
  tier_id uuid references events.affiliate_tiers(id) on delete set null,
  -- Pins this affiliate to tier_id inside this program, overriding auto-tiering.
  tier_locked boolean not null default false,
  -- Per-enrolment rate override; null falls through to the tier.
  rate_model text,
  rate_value numeric(14, 2),
  -- The ?ref token for this program, unique within it so one link maps to one
  -- enrolment unambiguously.
  ref_slug text not null,
  -- The buyer-facing discount code and the coupon it resolves to. Every
  -- affiliate code in this design also discounts the buyer.
  code text,
  discount_record_id uuid references events.ticketing_records(id) on delete set null,
  -- active | paused | removed
  status text not null default 'active',
  -- Per-affiliate ceiling inside this program; null = the program default.
  cap numeric(14, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists affiliate_enrolments_program_affiliate_idx
  on events.affiliate_enrolments (program_id, affiliate_id)
  where deleted_at is null;

create unique index if not exists affiliate_enrolments_ref_idx
  on events.affiliate_enrolments (program_id, lower(ref_slug))
  where deleted_at is null;

create unique index if not exists affiliate_enrolments_code_idx
  on events.affiliate_enrolments (program_id, lower(code))
  where deleted_at is null and code is not null;

create index if not exists affiliate_enrolments_affiliate_idx
  on events.affiliate_enrolments (affiliate_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 6. Clicks — attribution input and fraud signal. Append-only.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references events.affiliate_enrolments(id) on delete cascade,
  -- Hashed, never raw: this is attribution and dedupe, not surveillance.
  ip_hash text,
  ua_hash text,
  landing_url text not null default '',
  referrer text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_enrolment_idx
  on events.affiliate_clicks (enrolment_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Commissions — the ledger. Manual approval only, by design: nothing here
--    auto-clears, the organiser approves rows on the Commissions screen.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  program_id uuid not null references events.affiliate_programs(id) on delete cascade,
  enrolment_id uuid not null references events.affiliate_enrolments(id) on delete cascade,
  affiliate_id uuid not null references events.affiliates(id) on delete cascade,
  order_id uuid not null references events.event_orders(id) on delete cascade,
  payout_id uuid,
  -- link | code — how the sale was attributed, for reporting and dispute.
  source text not null default 'link',
  -- The money the rate was applied to (post-discount ticket subtotal by default).
  base_amount numeric(14, 2) not null default 0,
  rate_model text not null default 'percent',
  rate_value numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  -- pending | approved | reversed | paid
  state text not null default 'pending',
  approved_at timestamptz,
  approved_by uuid,
  reversed_at timestamptz,
  reversal_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One commission per order: a retried attribution must never double-pay.
create unique index if not exists affiliate_commissions_order_idx
  on events.affiliate_commissions (order_id);

create index if not exists affiliate_commissions_project_state_idx
  on events.affiliate_commissions (project_id, state, created_at desc);

create index if not exists affiliate_commissions_affiliate_idx
  on events.affiliate_commissions (affiliate_id, state);

create index if not exists affiliate_commissions_program_idx
  on events.affiliate_commissions (program_id, state);

-- ---------------------------------------------------------------------------
-- 8. Payouts — a settled batch. Record-only, with a Stripe-ready reference.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  affiliate_id uuid not null references events.affiliates(id) on delete cascade,
  period_start timestamptz,
  period_end timestamptz,
  amount numeric(14, 2) not null default 0,
  method text not null default 'manual',
  reference text not null default '',
  -- draft | sent | failed
  state text not null default 'draft',
  sent_at timestamptz,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists affiliate_payouts_project_idx
  on events.affiliate_payouts (project_id, created_at desc)
  where deleted_at is null;

create index if not exists affiliate_payouts_affiliate_idx
  on events.affiliate_payouts (affiliate_id, created_at desc)
  where deleted_at is null;

-- Declared after affiliate_payouts exists so this file stays runnable top-down.
alter table events.affiliate_commissions
  drop constraint if exists affiliate_commissions_payout_fk;
alter table events.affiliate_commissions
  add constraint affiliate_commissions_payout_fk
  foreign key (payout_id) references events.affiliate_payouts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 9. Tier changes — audit of automatic and manual movement.
-- ---------------------------------------------------------------------------
create table if not exists events.affiliate_tier_changes (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references events.affiliate_enrolments(id) on delete cascade,
  from_tier_id uuid references events.affiliate_tiers(id) on delete set null,
  to_tier_id uuid references events.affiliate_tiers(id) on delete set null,
  -- auto | manual
  reason text not null default 'auto',
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_tier_changes_enrolment_idx
  on events.affiliate_tier_changes (enrolment_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 10. updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'affiliates',
    'affiliate_program_templates',
    'affiliate_programs',
    'affiliate_tiers',
    'affiliate_enrolments',
    'affiliate_commissions',
    'affiliate_payouts'
  ] loop
    execute format(
      'drop trigger if exists %1$s_touch_updated_at on events.%1$s', t);
    execute format(
      'create trigger %1$s_touch_updated_at before update on events.%1$s
         for each row execute function events.touch_updated_at()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 11. Public resolver — turn a ?ref slug or a typed code into an enrolment
--     without exposing the affiliate tables to anon. Mirrors the shape of
--     public_event_discount(). Always returns exactly one row.
-- ---------------------------------------------------------------------------
drop function if exists events.public_affiliate_ref(uuid, text, text);

create or replace function events.public_affiliate_ref(
  p_event_id uuid,
  p_ref text default null,
  p_code text default null
)
returns table (ok boolean, enrolment_id uuid, program_id uuid, source text, reason text)
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_program events.affiliate_programs%rowtype;
  v_enrol events.affiliate_enrolments%rowtype;
  v_source text;
  v_event_date date;
begin
  if p_event_id is null or (coalesce(p_ref, '') = '' and coalesce(p_code, '') = '') then
    return query select false, null::uuid, null::uuid, null::text, 'empty'::text;
    return;
  end if;

  select * into v_program
  from events.affiliate_programs
  where event_id = p_event_id and deleted_at is null;

  if v_program.id is null then
    return query select false, null::uuid, null::uuid, null::text, 'no_program'::text;
    return;
  end if;

  if v_program.status <> 'active' then
    return query select false, null::uuid, null::uuid, null::text, 'inactive'::text;
    return;
  end if;

  if v_program.starts_at is not null and now() < v_program.starts_at then
    return query select false, null::uuid, null::uuid, null::text, 'not_started'::text;
    return;
  end if;

  if v_program.ends_at is not null and now() > v_program.ends_at then
    return query select false, null::uuid, null::uuid, null::text, 'ended'::text;
    return;
  end if;

  if v_program.stop_at_event_start then
    select e.event_date into v_event_date from events.events e where e.id = p_event_id;
    if v_event_date is not null and current_date >= v_event_date then
      return query select false, null::uuid, null::uuid, null::text, 'ended'::text;
      return;
    end if;
  end if;

  -- A typed code beats the cookie: it is the more deliberate signal.
  if coalesce(p_code, '') <> '' then
    select * into v_enrol
    from events.affiliate_enrolments
    where program_id = v_program.id
      and deleted_at is null
      and lower(code) = lower(trim(p_code));
    v_source := 'code';
  end if;

  if v_enrol.id is null and coalesce(p_ref, '') <> '' then
    select * into v_enrol
    from events.affiliate_enrolments
    where program_id = v_program.id
      and deleted_at is null
      and lower(ref_slug) = lower(trim(p_ref));
    v_source := 'link';
  end if;

  if v_enrol.id is null then
    return query select false, null::uuid, null::uuid, null::text, 'invalid'::text;
    return;
  end if;

  if v_enrol.status <> 'active' then
    return query select false, null::uuid, null::uuid, null::text, 'suspended'::text;
    return;
  end if;

  return query select true, v_enrol.id, v_program.id, v_source, null::text;
end;
$$;

grant execute on function events.public_affiliate_ref(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Click logging — anon-callable, taking an enrolment id already validated
--     by public_affiliate_ref. Fingerprint inputs are hashed here, so no raw
--     IP or user-agent is ever stored. sha256() is built in; no pgcrypto
--     dependency at call time.
-- ---------------------------------------------------------------------------
drop function if exists events.log_affiliate_click(uuid, text, text, text, text);

create or replace function events.log_affiliate_click(
  p_enrolment_id uuid,
  p_ip text default null,
  p_ua text default null,
  p_landing_url text default '',
  p_referrer text default ''
)
returns boolean
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if p_enrolment_id is null then return false; end if;

  if not exists (
    select 1 from events.affiliate_enrolments
    where id = p_enrolment_id and deleted_at is null and status = 'active'
  ) then
    return false;
  end if;

  insert into events.affiliate_clicks (
    enrolment_id, ip_hash, ua_hash, landing_url, referrer
  ) values (
    p_enrolment_id,
    case when coalesce(p_ip, '') = '' then null
         else encode(sha256(convert_to(p_ip, 'UTF8')), 'hex') end,
    case when coalesce(p_ua, '') = '' then null
         else encode(sha256(convert_to(p_ua, 'UTF8')), 'hex') end,
    left(coalesce(p_landing_url, ''), 2048),
    left(coalesce(p_referrer, ''), 2048)
  );
  return true;
end;
$$;

grant execute on function events.log_affiliate_click(uuid, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. Attribution — the money path. Called once, after an order exists.
--
--     Idempotent on (order_id): a retry returns the existing commission rather
--     than paying twice. Every gate that can refuse is enforced HERE, because
--     the client half of attribution (a cookie) is untrusted input.
-- ---------------------------------------------------------------------------
drop function if exists events.attribute_affiliate_order(uuid, text, text);

create or replace function events.attribute_affiliate_order(
  p_order_id uuid,
  p_ref text default null,
  p_code text default null
)
returns table (ok boolean, commission_id uuid, amount numeric, reason text)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_order events.event_orders%rowtype;
  v_program events.affiliate_programs%rowtype;
  v_enrol events.affiliate_enrolments%rowtype;
  v_tier events.affiliate_tiers%rowtype;
  v_affiliate events.affiliates%rowtype;
  v_ok boolean;
  v_enrolment_id uuid;
  v_program_id uuid;
  v_source text;
  v_reason text;
  v_base numeric(14, 2);
  v_rate_model text;
  v_rate_value numeric(14, 2);
  v_amount numeric(14, 2);
  v_type_rate numeric(14, 2);
  v_accrued numeric(14, 2);
  v_cap numeric(14, 2);
  v_commission_id uuid;
  v_discount numeric(14, 2);
  v_addons numeric(14, 2);
begin
  if p_order_id is null then
    return query select false, null::uuid, 0::numeric, 'no_order'::text;
    return;
  end if;

  -- Idempotency first: a retry must never create a second commission.
  select id, amount into v_commission_id, v_amount
  from events.affiliate_commissions where order_id = p_order_id;
  if v_commission_id is not null then
    return query select true, v_commission_id, v_amount, 'already_attributed'::text;
    return;
  end if;

  select * into v_order from events.event_orders where id = p_order_id;
  if v_order.id is null then
    return query select false, null::uuid, 0::numeric, 'no_order'::text;
    return;
  end if;

  select r.ok, r.enrolment_id, r.program_id, r.source, r.reason
  into v_ok, v_enrolment_id, v_program_id, v_source, v_reason
  from events.public_affiliate_ref(v_order.event_id, p_ref, p_code) r;

  if not coalesce(v_ok, false) then
    return query select false, null::uuid, 0::numeric, coalesce(v_reason, 'invalid');
    return;
  end if;

  select * into v_enrol from events.affiliate_enrolments where id = v_enrolment_id;
  select * into v_program from events.affiliate_programs where id = v_program_id;
  select * into v_affiliate from events.affiliates where id = v_enrol.affiliate_id;

  -- Self-referral: an affiliate must not earn on their own purchase.
  if coalesce(v_affiliate.email, '') <> ''
     and lower(v_affiliate.email) = lower(coalesce(v_order.buyer_email, '')) then
    return query select false, null::uuid, 0::numeric, 'self_referral'::text;
    return;
  end if;

  -- Eligibility gates from the program's rules bag.
  v_discount := coalesce((v_order.metadata ->> 'discountAmount')::numeric, 0);
  v_addons := coalesce((v_order.metadata ->> 'addonsTotal')::numeric, 0);

  if coalesce((v_program.rules ->> 'excludeFreeTickets')::boolean, false)
     and coalesce(v_order.ticket_price, 0) <= 0 then
    return query select false, null::uuid, 0::numeric, 'free_ticket'::text;
    return;
  end if;

  if coalesce((v_program.rules ->> 'excludeDiscountedOrders')::boolean, false)
     and v_discount > 0 then
    return query select false, null::uuid, 0::numeric, 'discounted'::text;
    return;
  end if;

  if v_program.rules ? 'excludedTicketTypes'
     and exists (
       select 1
       from jsonb_array_elements_text(v_program.rules -> 'excludedTicketTypes') x
       where x = v_order.ticket_name
     ) then
    return query select false, null::uuid, 0::numeric, 'excluded_ticket_type'::text;
    return;
  end if;

  if coalesce(v_order.total, 0)
     < coalesce((v_program.rules ->> 'minOrderValue')::numeric, 0) then
    return query select false, null::uuid, 0::numeric, 'below_minimum'::text;
    return;
  end if;

  -- Commission base. Default: post-discount, tickets only — never pay a
  -- percentage of money that was discounted away, and never on add-ons.
  v_base := coalesce(v_order.ticket_price, 0) * greatest(coalesce(v_order.quantity, 1), 1);
  if v_program.commission_base = 'tickets_addons' then
    v_base := v_base + v_addons;
  end if;
  if v_program.discount_handling = 'post' then
    v_base := greatest(v_base - v_discount, 0);
  end if;

  -- Rate: the enrolment override, else the tier, else there is nothing to pay.
  select * into v_tier from events.affiliate_tiers
  where id = v_enrol.tier_id and deleted_at is null;

  v_rate_model := coalesce(v_enrol.rate_model, v_tier.rate_model);
  v_rate_value := coalesce(v_enrol.rate_value, v_tier.rate_value);

  if v_rate_model is null then
    return query select false, null::uuid, 0::numeric, 'no_rate'::text;
    return;
  end if;

  -- A per-ticket-type override replaces the rate VALUE, keeping the model as
  -- the unit (a percent stays a percent, a flat stays a flat).
  if v_tier.id is not null and v_tier.ticket_type_rates ? v_order.ticket_name then
    v_type_rate := (v_tier.ticket_type_rates ->> v_order.ticket_name)::numeric;
    if v_type_rate is not null then v_rate_value := v_type_rate; end if;
  end if;

  v_amount := case v_rate_model
    when 'percent' then round(v_base * coalesce(v_rate_value, 0) / 100.0, 2)
    when 'flat_per_ticket' then
      round(coalesce(v_rate_value, 0) * greatest(coalesce(v_order.quantity, 1), 1), 2)
    when 'flat_per_order' then round(coalesce(v_rate_value, 0), 2)
    else 0
  end;

  -- A percent commission can never exceed the base it came from.
  if v_rate_model = 'percent' then
    v_amount := least(v_amount, v_base);
  end if;

  if v_amount <= 0 then
    return query select false, null::uuid, 0::numeric, 'zero_amount'::text;
    return;
  end if;

  -- Per-affiliate ceiling inside this program: trim to what's left, refuse when
  -- nothing is.
  v_cap := coalesce(v_enrol.cap, v_program.affiliate_cap);
  if v_cap is not null then
    select coalesce(sum(amount), 0) into v_accrued
    from events.affiliate_commissions
    where enrolment_id = v_enrol.id and state <> 'reversed';
    if v_accrued + v_amount > v_cap then
      v_amount := greatest(v_cap - v_accrued, 0);
      if v_amount <= 0 then
        return query select false, null::uuid, 0::numeric, 'affiliate_cap'::text;
        return;
      end if;
    end if;
  end if;

  -- Program budget. Exhausting it pauses the program, so later orders stop
  -- accruing instead of quietly overspending.
  if v_program.budget_cap is not null then
    select coalesce(sum(amount), 0) into v_accrued
    from events.affiliate_commissions
    where program_id = v_program.id and state <> 'reversed';
    if v_accrued + v_amount > v_program.budget_cap then
      v_amount := greatest(v_program.budget_cap - v_accrued, 0);
      update events.affiliate_programs set status = 'paused' where id = v_program.id;
      if v_amount <= 0 then
        return query select false, null::uuid, 0::numeric, 'budget_exhausted'::text;
        return;
      end if;
    end if;
  end if;

  insert into events.affiliate_commissions (
    project_id, program_id, enrolment_id, affiliate_id, order_id,
    source, base_amount, rate_model, rate_value, amount, state
  ) values (
    v_program.project_id, v_program.id, v_enrol.id, v_enrol.affiliate_id, p_order_id,
    coalesce(v_source, 'link'), v_base, v_rate_model, coalesce(v_rate_value, 0),
    v_amount, 'pending'
  )
  on conflict (order_id) do nothing
  returning id into v_commission_id;

  -- Lost a concurrent race: the other transaction's row is the answer.
  if v_commission_id is null then
    select id, amount into v_commission_id, v_amount
    from events.affiliate_commissions where order_id = p_order_id;
    return query select true, v_commission_id, v_amount, 'already_attributed'::text;
    return;
  end if;

  return query select true, v_commission_id, v_amount, null::text;
end;
$$;

grant execute on function events.attribute_affiliate_order(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 14. Clawback — reverse a commission when its order is refunded. Paid rows are
--     left alone: money already sent is an accounting problem, not a state flip.
-- ---------------------------------------------------------------------------
drop function if exists events.reverse_affiliate_commission(uuid, text);

create or replace function events.reverse_affiliate_commission(
  p_order_id uuid,
  p_reason text default 'refunded'
)
returns boolean
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_updated integer;
begin
  update events.affiliate_commissions
  set state = 'reversed',
      reversed_at = now(),
      reversal_reason = coalesce(p_reason, 'refunded')
  where order_id = p_order_id
    and state in ('pending', 'approved');
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function events.reverse_affiliate_commission(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 15. RLS — org-membership scoped, matching every other project-owned table.
--     Child tables reach their project through their parent program.
-- ---------------------------------------------------------------------------
alter table events.affiliates enable row level security;
alter table events.affiliate_program_templates enable row level security;
alter table events.affiliate_programs enable row level security;
alter table events.affiliate_tiers enable row level security;
alter table events.affiliate_enrolments enable row level security;
alter table events.affiliate_clicks enable row level security;
alter table events.affiliate_commissions enable row level security;
alter table events.affiliate_payouts enable row level security;
alter table events.affiliate_tier_changes enable row level security;

drop policy if exists affiliates_member_all on events.affiliates;
create policy affiliates_member_all on events.affiliates
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists affiliate_program_templates_member_all on events.affiliate_program_templates;
create policy affiliate_program_templates_member_all on events.affiliate_program_templates
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists affiliate_programs_member_all on events.affiliate_programs;
create policy affiliate_programs_member_all on events.affiliate_programs
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists affiliate_commissions_member_all on events.affiliate_commissions;
create policy affiliate_commissions_member_all on events.affiliate_commissions
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists affiliate_payouts_member_all on events.affiliate_payouts;
create policy affiliate_payouts_member_all on events.affiliate_payouts
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists affiliate_tiers_member_all on events.affiliate_tiers;
create policy affiliate_tiers_member_all on events.affiliate_tiers
  for all to authenticated
  using (exists (
    select 1 from events.affiliate_programs p
    where p.id = program_id and events.can_access_project(p.project_id)))
  with check (exists (
    select 1 from events.affiliate_programs p
    where p.id = program_id and events.can_access_project(p.project_id)));

drop policy if exists affiliate_enrolments_member_all on events.affiliate_enrolments;
create policy affiliate_enrolments_member_all on events.affiliate_enrolments
  for all to authenticated
  using (exists (
    select 1 from events.affiliate_programs p
    where p.id = program_id and events.can_access_project(p.project_id)))
  with check (exists (
    select 1 from events.affiliate_programs p
    where p.id = program_id and events.can_access_project(p.project_id)));

drop policy if exists affiliate_clicks_member_all on events.affiliate_clicks;
create policy affiliate_clicks_member_all on events.affiliate_clicks
  for all to authenticated
  using (exists (
    select 1 from events.affiliate_enrolments e
    join events.affiliate_programs p on p.id = e.program_id
    where e.id = enrolment_id and events.can_access_project(p.project_id)))
  with check (exists (
    select 1 from events.affiliate_enrolments e
    join events.affiliate_programs p on p.id = e.program_id
    where e.id = enrolment_id and events.can_access_project(p.project_id)));

drop policy if exists affiliate_tier_changes_member_all on events.affiliate_tier_changes;
create policy affiliate_tier_changes_member_all on events.affiliate_tier_changes
  for all to authenticated
  using (exists (
    select 1 from events.affiliate_enrolments e
    join events.affiliate_programs p on p.id = e.program_id
    where e.id = enrolment_id and events.can_access_project(p.project_id)))
  with check (exists (
    select 1 from events.affiliate_enrolments e
    join events.affiliate_programs p on p.id = e.program_id
    where e.id = enrolment_id and events.can_access_project(p.project_id)));

-- @down
drop function if exists events.reverse_affiliate_commission(uuid, text);
drop function if exists events.attribute_affiliate_order(uuid, text, text);
drop function if exists events.log_affiliate_click(uuid, text, text, text, text);
drop function if exists events.public_affiliate_ref(uuid, text, text);
drop table if exists events.affiliate_tier_changes cascade;
drop table if exists events.affiliate_clicks cascade;
drop table if exists events.affiliate_commissions cascade;
drop table if exists events.affiliate_payouts cascade;
drop table if exists events.affiliate_enrolments cascade;
drop table if exists events.affiliate_tiers cascade;
drop table if exists events.affiliate_programs cascade;
drop table if exists events.affiliate_program_templates cascade;
drop table if exists events.affiliates cascade;
