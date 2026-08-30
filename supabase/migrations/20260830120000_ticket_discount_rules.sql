-- Ticket-scoped discount codes with a priority rule engine
--
-- Two changes to how discounts work.
--
-- 1. SCOPE. A coupon used to be attached to the EVENT and then redeemed against
--    any ticket on it. It is now attached to the TICKET: a code redeems only
--    against a ticket whose metadata.tickets[].discountIds lists the coupon's
--    record id. One ticket can accept many codes. The event-level
--    metadata.attached.discount list is retained as the organiser's "codes
--    available to this event" picker, but it no longer decides redemption —
--    it is only consulted when a purchase has no ticket to scope to (expo
--    booths, ad-hoc sales) so those paths keep working.
--
-- 2. AMOUNT. How much a code gives is decided by an ORDERED rule list on the
--    coupon config. Rules are evaluated top-down and the FIRST match wins, so
--    the organiser drags the most specific rule to the top. Each rule may gate
--    on quantity (minQty/maxQty — "only when 3+ tickets are bought") and/or a
--    time window (validFrom/validUntil), and carries its own percent/flat
--    reward. With no matching rule the coupon's base discount applies as the
--    catch-all, which is what every pre-existing coupon has — so nothing that
--    worked before changes amount.
--
--    Separate from the rules, the coupon carries eligibility GATES (minQty,
--    maxQty, validFrom, validUntil) that reject the code outright rather than
--    falling back to a smaller discount. Rules answer "how much"; gates answer
--    "at all".
--
-- The resolver below is the single source of truth. events.buy_ticket() calls
-- it instead of doing its own discount maths, and public_event_discount() is a
-- thin, grant-able wrapper over it. The same algorithm is mirrored in
-- lib/events/discount_rules.js for the live preview — keep the two in step.
--
-- Idempotent: every object is create-or-replace and the back-fill is a
-- distinct union, so re-running changes nothing.

-- @up

create extension if not exists pgcrypto;

-- datetime-local strings arrive from <input type="datetime-local"> as bare
-- text. An empty or malformed value must mean "no bound", never an exception
-- thrown from inside a money calculation.
create or replace function events.discount_when(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = events, public
as $when$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$when$;

-- Resolve a typed code against a ticket in one step.
--
-- p_ticket_id scopes the code; pass null for purchases with no ticket, which
-- falls back to the event's attached list. p_base is the amount a percentage is
-- taken from (tickets only, or tickets + add-ons, per the event's
-- discountSettings.appliesTo). Pass null to derive it from the ticket price.
--
-- Returns ok=false with a reason on any failure: empty | not_allowed | invalid
-- | limit | pending | expired | min_qty | max_qty. Internal: callers use
-- public_event_discount(), which is what carries the grants.
create or replace function events.resolve_ticket_discount(
  p_event_id uuid,
  p_code text,
  p_ticket_id text,
  p_qty integer,
  p_base numeric
)
returns table (
  ok boolean,
  id uuid,
  code text,
  discount_type text,
  value numeric,
  amount numeric,
  max_discount numeric,
  apply_per text,
  rule_id text,
  rule_label text,
  matched boolean,
  reason text
)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_meta jsonb;
  v_ticket jsonb;
  v_scope jsonb;
  v_id uuid;
  v_config jsonb;
  v_qty integer := greatest(1, coalesce(p_qty, 1));
  v_base numeric;
  v_limit integer;
  v_used integer;
  v_now timestamptz := now();
  v_when timestamptz;
  v_min integer;
  v_max integer;
  v_rule jsonb;
  v_out_type text;
  v_out_value numeric;
  v_out_per text;
  v_out_rule text;
  v_out_label text;
  v_matched boolean := false;
  v_units integer;
  v_amt numeric := 0;
  v_cap numeric;
begin
  if v_code = '' then
    return query select false, null::uuid, null::text, null::text, null::numeric,
                        0::numeric, null::numeric, null::text, null::text, null::text, false,
                        'empty'::text;
    return;
  end if;

  select e.metadata into v_meta
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;
  if not found then
    return query select false, null::uuid, null::text, null::text, null::numeric,
                        0::numeric, null::numeric, null::text, null::text, null::text, false,
                        'invalid'::text;
    return;
  end if;

  -- Scope: the ticket's own code list, or the event's list when there is no
  -- ticket to scope to.
  if coalesce(p_ticket_id, '') <> '' then
    select t.val into v_ticket
      from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) t(val)
      where t.val->>'id' = p_ticket_id
      limit 1;
    v_scope := coalesce(v_ticket->'discountIds', '[]'::jsonb);
  else
    v_scope := coalesce(v_meta->'attached'->'discount', '[]'::jsonb);
  end if;

  if v_scope is null
     or jsonb_typeof(v_scope) <> 'array'
     or jsonb_array_length(v_scope) = 0 then
    return query select false, null::uuid, null::text, null::text, null::numeric,
                        0::numeric, null::numeric, null::text, null::text, null::text, false,
                        'not_allowed'::text;
    return;
  end if;

  select r.id, r.config into v_id, v_config
    from events.ticketing_records r
    where r.module = 'discount'
      and r.kind = 'coupon'
      and r.active is true
      and r.deleted_at is null
      and upper(btrim(coalesce(r.config->>'code', ''))) = v_code
      and r.id::text in (select jsonb_array_elements_text(v_scope))
    limit 1;

  if v_id is null then
    return query select false, null::uuid, null::text, null::text, null::numeric,
                        0::numeric, null::numeric, null::text, null::text, null::text, false,
                        'invalid'::text;
    return;
  end if;

  -- Usage limit (0 = unlimited), counted over live orders on this event.
  v_limit := coalesce((v_config->>'usageLimit')::integer, 0);
  if v_limit > 0 then
    select count(*) into v_used
      from events.event_orders o
      where o.event_id = p_event_id
        and o.status not in ('cancelled', 'refunded')
        and o.metadata->'discount'->>'id' = v_id::text;
    if v_used >= v_limit then
      return query select false, v_id, v_code, null::text, null::numeric,
                            0::numeric, null::numeric, null::text, null::text, null::text, false,
                            'limit'::text;
      return;
    end if;
  end if;

  -- Eligibility gates: fail these and the code is rejected outright.
  v_when := events.discount_when(v_config->>'validFrom');
  if v_when is not null and v_now < v_when then
    return query select false, v_id, v_code, null::text, null::numeric,
                            0::numeric, null::numeric, null::text, null::text, null::text, false,
                            'pending'::text;
    return;
  end if;
  v_when := events.discount_when(v_config->>'validUntil');
  if v_when is not null and v_now > v_when then
    return query select false, v_id, v_code, null::text, null::numeric,
                            0::numeric, null::numeric, null::text, null::text, null::text, false,
                            'expired'::text;
    return;
  end if;

  v_min := nullif(coalesce(v_config->>'minQty', ''), '')::integer;
  if v_min is not null and v_qty < v_min then
    return query select false, v_id, v_code, null::text, null::numeric,
                            0::numeric, null::numeric, null::text, null::text, null::text, false,
                            'min_qty'::text;
    return;
  end if;
  v_max := nullif(coalesce(v_config->>'maxQty', ''), '')::integer;
  if v_max is not null and v_qty > v_max then
    return query select false, v_id, v_code, null::text, null::numeric,
                            0::numeric, null::numeric, null::text, null::text, null::text, false,
                            'max_qty'::text;
    return;
  end if;

  -- Base the percentage is taken from; derived from the ticket price when the
  -- caller (the validation RPC) has no add-on totals to hand.
  if p_base is not null then
    v_base := greatest(0, p_base);
  else
    v_base := greatest(0, coalesce((v_ticket->>'price')::numeric, 0)) * v_qty;
  end if;

  -- Ordered rules: first match wins. When nothing matches, the coupon's base
  -- discount is the catch-all — which is the only thing legacy coupons have.
  for v_rule in select value from jsonb_array_elements(coalesce(v_config->'rules', '[]'::jsonb))
  loop
    if nullif(coalesce(v_rule->>'minQty', ''), '')::integer is not null
       and v_qty < nullif(coalesce(v_rule->>'minQty', ''), '')::integer then
      continue;
    end if;
    if nullif(coalesce(v_rule->>'maxQty', ''), '')::integer is not null
       and v_qty > nullif(coalesce(v_rule->>'maxQty', ''), '')::integer then
      continue;
    end if;
    v_when := events.discount_when(v_rule->>'validFrom');
    if v_when is not null and v_now < v_when then
      continue;
    end if;
    v_when := events.discount_when(v_rule->>'validUntil');
    if v_when is not null and v_now > v_when then
      continue;
    end if;

    v_out_type := case when v_rule->>'discountType' = 'flat' then 'flat' else 'percent' end;
    v_out_value := coalesce((v_rule->>'value')::numeric, 0);
    v_out_per := case when v_rule->>'applyPer' = 'ticket' then 'ticket' else 'order' end;
    v_out_rule := v_rule->>'id';
    v_out_label := coalesce(v_rule->>'label', '');
    v_matched := true;
    exit;
  end loop;

  if not v_matched then
    v_out_type := case when v_config->>'discountType' = 'flat' then 'flat' else 'percent' end;
    v_out_value := coalesce((v_config->>'value')::numeric, 0);
    v_out_per := case when v_config->>'applyPer' = 'ticket' then 'ticket' else 'order' end;
    v_out_rule := null;
    v_out_label := '';
  end if;

  -- Money. A percentage comes off the whole base once; a flat amount is taken
  -- once per order, or once per ticket when applyPer = 'ticket'.
  v_units := case when v_out_type = 'flat' and v_out_per = 'ticket' then v_qty else 1 end;
  if v_out_type = 'flat' then
    v_amt := v_out_value * v_units;
  else
    v_amt := v_base * v_out_value / 100.0;
  end if;
  v_amt := greatest(0, least(v_amt, v_base));

  v_cap := nullif(coalesce(v_config->>'maxDiscount', ''), '')::numeric;
  if v_cap is not null and v_cap >= 0 then
    v_amt := least(v_amt, v_cap);
  end if;
  v_amt := round(v_amt, 2);

  return query select true, v_id, v_code, v_out_type, v_out_value, v_amt, v_cap,
                        v_out_per, v_out_rule, v_out_label, v_matched, null::text;
end;
$$;

-- Public validation for the checkout's "Apply code" field. Exposes nothing the
-- buyer could not already reach by typing the code, and the code list itself
-- stays scoped to the ticket they are buying.
create or replace function events.public_event_discount(
  p_event_id uuid,
  p_code text,
  p_ticket_id text,
  p_qty integer,
  p_base numeric
)
returns table (
  ok boolean,
  id uuid,
  code text,
  discount_type text,
  value numeric,
  amount numeric,
  max_discount numeric,
  apply_per text,
  rule_id text,
  rule_label text,
  matched boolean,
  reason text
)
language sql
security definer
stable
set search_path = events, public
as $$
  select * from events.resolve_ticket_discount(
    p_event_id, p_code, p_ticket_id, p_qty, p_base);
$$;

-- Legacy two-argument form, kept so anything still calling the old shape keeps
-- resolving (no ticket to scope to, quantity of one).
create or replace function events.public_event_discount(p_event_id uuid, p_code text)
returns table (ok boolean, id uuid, code text, discount_type text, value numeric, reason text)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  r record;
begin
  select * into r
    from events.resolve_ticket_discount(p_event_id, p_code, null, 1, null);
  return query select r.ok, r.id, r.code, r.discount_type, r.value, r.reason;
end;
$$;

grant execute on function events.public_event_discount(uuid, text, text, integer, numeric)
  to anon, authenticated;
grant execute on function events.public_event_discount(uuid, text)
  to anon, authenticated;

-- Back-fill: every code that used to work across a whole event now has to be
-- listed on each ticket that should still accept it. Seed all tickets with the
-- event's previously attached codes, as a distinct union so re-running is a
-- no-op. Organisers can then narrow the list per ticket from the ticket editor.
update events.events e
   set metadata = jsonb_set(
         e.metadata,
         '{tickets}',
         coalesce((
           select jsonb_agg(t.val || jsonb_build_object('discountIds', t.merged))
           from (
             select t.val,
                    coalesce((
                      select jsonb_agg(distinct d.x order by d.x)
                      from jsonb_array_elements(
                             coalesce(t.val->'discountIds', '[]'::jsonb)
                             || coalesce(e.metadata->'attached'->'discount', '[]'::jsonb)
                           ) d(x)
                    ), '[]'::jsonb) as merged
             from jsonb_array_elements(coalesce(e.metadata->'tickets', '[]'::jsonb)) t(val)
           ) t
         ), '[]'::jsonb)
       )
 where e.deleted_at is null
   and jsonb_typeof(e.metadata->'tickets') = 'array'
   and jsonb_typeof(e.metadata->'attached'->'discount') = 'array'
   and jsonb_array_length(e.metadata->'attached'->'discount') > 0;

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
  p_stripe_payment_intent_id text default null,
  p_tier_id text default null,
  p_slot_id text default null,
  p_discount_code text default null,
  p_donation numeric default 0,
  p_bundle_id text default null,
  p_attendees jsonb default null,
  p_access_code text default null
)
returns table (ok boolean, order_id uuid, sold integer, capacity integer, remaining integer, created boolean)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_sold integer;
  v_cap integer;
  v_meta jsonb;
  v_buffer integer;
  v_effcap integer;
  v_tier jsonb;
  v_tier_qty integer;
  v_tier_sold integer;
  v_tier_reserved integer;
  v_reserved_total integer := 0;
  v_slot jsonb;
  v_slot_cap integer;
  v_slot_sold integer;
  v_disc_attached jsonb;
  v_disc_id uuid;
  v_disc_config jsonb;
  v_disc_applies text;
  v_disc_base numeric;
  v_disc_amt numeric := 0;
  v_meta_out jsonb;
  v_total numeric;
  v_order uuid;
  v_project uuid;
  v_qty integer := greatest(1, coalesce(p_qty, 1));
  v_now timestamptz := now();
  v_eb jsonb;
  v_eb_unit numeric := 0;
  v_in_window boolean;
  v_unit numeric;
  v_ticket_subtotal numeric;
  v_donation numeric := greatest(0, coalesce(p_donation, 0));
  v_group jsonb;
  v_group_pct numeric;
  v_group_amt numeric := 0;
  v_att_count integer := 0;
  v_group_id text;
  v_att jsonb;
  v_ticket_total numeric;
  v_per numeric;
  v_i integer;
  v_att_email text;
  v_att_name text;
  v_att_total numeric;
  v_first uuid;
  v_bundle jsonb;
  v_item jsonb;
  v_item_ticket jsonb;
  v_item_qty integer;
  v_bundle_price numeric := 0;
  v_seat_count integer;
  v_gated boolean;
  v_code_ok boolean;
  -- Ticket-scoped discount resolution (resolve_ticket_discount).
  v_disc_ok boolean := false;
  v_disc_type text;
  v_disc_value numeric;
  v_disc_per text;
  v_disc_rule_id text;
  v_disc_rule_label text;
  v_disc_matched boolean := false;
  v_disc_reason text;
begin
  -- Idempotency: a return-trip that re-hits an existing session never re-books.
  if p_stripe_session_id is not null then
    select o.id into v_order from events.event_orders o
      where o.stripe_session_id = p_stripe_session_id;
    if found then
      select e.sold, e.capacity into v_sold, v_cap from events.events e where e.id = p_event_id;
      return query select true, v_order, v_sold, v_cap, greatest(0, coalesce(v_cap, 0) - coalesce(v_sold, 0)), false;
      return;
    end if;
  end if;

  select e.sold, e.capacity, e.project_id, e.metadata
    into v_sold, v_cap, v_project, v_meta
    from events.events e
    where e.id = p_event_id and e.deleted_at is null
    for update;
  if not found then
    return query select false, null::uuid, 0, 0, 0, false; return;
  end if;

  -- Reserved holds: total held across tickets reduces public availability.
  if coalesce((v_meta->'ticketRules'->>'reservedSeating')::boolean, false) and v_meta ? 'reserved' then
    select coalesce(sum(greatest(0, coalesce((r.value->>'qty')::integer, 0))), 0)
      into v_reserved_total
      from jsonb_each(v_meta->'reserved') as r(key, value);
  end if;

  -- Access-code gating: a hidden tier requires a matching code.
  if p_tier_id is not null and coalesce((v_meta->'ticketRules'->>'accessCode')::boolean, false) then
    select true into v_gated
      from jsonb_array_elements(coalesce(v_meta->'accessCodes', '[]'::jsonb)) ac(val)
      where ac.val->'ticketIds' ? p_tier_id limit 1;
    if coalesce(v_gated, false) then
      select true into v_code_ok
        from jsonb_array_elements(coalesce(v_meta->'accessCodes', '[]'::jsonb)) ac(val)
        where ac.val->'ticketIds' ? p_tier_id
          and upper(btrim(coalesce(ac.val->>'code', ''))) = upper(btrim(coalesce(p_access_code, '')))
        limit 1;
      if not coalesce(v_code_ok, false) then
        return query select false, null::uuid, v_sold, v_cap, greatest(0, coalesce(v_cap, 0) - coalesce(v_sold, 0)), false;
        return;
      end if;
    end if;
  end if;

  v_buffer := greatest(0, coalesce((v_meta->>'capacityBuffer')::integer, 0));
  v_effcap := case when coalesce(v_cap, 0) > 0 then v_cap + v_buffer else 0 end;

  -- Seat count = tickets consumed from inventory. A bundle consumes the sum of
  -- its items × qty; otherwise it's the plain quantity.
  v_seat_count := v_qty;
  if p_bundle_id is not null then
    select b.val into v_bundle
      from jsonb_array_elements(coalesce(v_meta->'bundles', '[]'::jsonb)) b(val)
      where b.val->>'id' = p_bundle_id limit 1;
    if v_bundle is null then
      return query select false, null::uuid, v_sold, v_cap, greatest(0, coalesce(v_effcap, 0) - v_sold), false;
      return;
    end if;
    select coalesce(sum(greatest(1, coalesce((it.val->>'qty')::integer, 1))), 0) * v_qty
      into v_seat_count
      from jsonb_array_elements(coalesce(v_bundle->'items', '[]'::jsonb)) it(val);
  end if;

  -- Event capacity guard (reserved holds reduce availability).
  if v_effcap > 0 and v_sold + v_seat_count + v_reserved_total > v_effcap then
    return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold - v_reserved_total), false;
    return;
  end if;

  -- Per-tier inventory (non-bundle): qty minus sold minus reserved.
  if p_tier_id is not null and p_bundle_id is null then
    select t.val into v_tier
      from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) as t(val)
      where t.val->>'id' = p_tier_id limit 1;
    if v_tier is not null then
      v_tier_qty := coalesce((v_tier->>'qty')::integer, 0);
      v_tier_sold := coalesce((v_meta->'ticketSold'->>p_tier_id)::integer, 0);
      v_tier_reserved := greatest(0, coalesce((v_meta->'reserved'->p_tier_id->>'qty')::integer, 0));
      if v_tier_qty > 0 and v_tier_sold + v_qty + v_tier_reserved > v_tier_qty then
        return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold), false;
        return;
      end if;
    end if;
  end if;

  -- Per-item inventory for bundles: every included tier must have room.
  if p_bundle_id is not null then
    for v_item in select it.val from jsonb_array_elements(coalesce(v_bundle->'items', '[]'::jsonb)) it(val)
    loop
      select t.val into v_item_ticket
        from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) t(val)
        where t.val->>'id' = v_item->>'ticketId' limit 1;
      if v_item_ticket is not null then
        v_tier_qty := coalesce((v_item_ticket->>'qty')::integer, 0);
        v_tier_sold := coalesce((v_meta->'ticketSold'->>(v_item->>'ticketId'))::integer, 0);
        v_item_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1)) * v_qty;
        v_tier_reserved := greatest(0, coalesce((v_meta->'reserved'->(v_item->>'ticketId')->>'qty')::integer, 0));
        if v_tier_qty > 0 and v_tier_sold + v_item_qty + v_tier_reserved > v_tier_qty then
          return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold), false;
          return;
        end if;
      end if;
    end loop;
  end if;

  -- Per-slot inventory.
  if p_slot_id is not null then
    select s.val into v_slot
      from jsonb_array_elements(coalesce(v_meta->'slots', '[]'::jsonb)) as s(val)
      where s.val->>'id' = p_slot_id limit 1;
    if v_slot is not null then
      v_slot_cap := coalesce((v_slot->>'capacity')::integer, 0);
      v_slot_sold := coalesce((v_meta->'slotsSold'->>p_slot_id)::integer, 0);
      if v_slot_cap > 0 and v_slot_sold + v_qty > v_slot_cap then
        return query select false, null::uuid, v_sold, v_cap, greatest(0, v_effcap - v_sold), false;
        return;
      end if;
    end if;
  end if;

  -- ---- Pricing --------------------------------------------------------------
  if p_bundle_id is not null then
    if coalesce(v_bundle->>'pricingMode', 'fixed') = 'sum' then
      select coalesce(sum(
               coalesce((t.val->>'price')::numeric, 0)
               * greatest(1, coalesce((it.val->>'qty')::integer, 1))), 0)
        into v_bundle_price
        from jsonb_array_elements(coalesce(v_bundle->'items', '[]'::jsonb)) it(val)
        left join lateral (
          select tv.val from jsonb_array_elements(coalesce(v_meta->'tickets', '[]'::jsonb)) tv(val)
          where tv.val->>'id' = it.val->>'ticketId' limit 1
        ) t on true;
    else
      v_bundle_price := coalesce((v_bundle->>'price')::numeric, 0);
    end if;
    v_unit := v_bundle_price;
    v_ticket_subtotal := v_bundle_price * v_qty;
    v_total := v_ticket_subtotal + coalesce(p_addons, 0) * v_qty + v_donation;
    p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
      'bundle', jsonb_build_object(
        'id', p_bundle_id, 'name', coalesce(v_bundle->>'name', ''),
        'items', coalesce(v_bundle->'items', '[]'::jsonb), 'price', v_bundle_price));
  else
    -- Early-bird: re-derive the reduction from config + the server clock.
    if coalesce((v_meta->'ticketRules'->>'earlybird')::boolean, false) then
      v_eb := v_meta->'earlybird';
      if v_eb is not null then
        v_in_window := true;
        if coalesce(v_eb->>'startAt', '') <> '' then
          begin
            if v_now < (v_eb->>'startAt')::timestamptz then v_in_window := false; end if;
          exception when others then null;
          end;
        end if;
        if coalesce(v_eb->>'endAt', '') <> '' then
          begin
            if v_now > (v_eb->>'endAt')::timestamptz then v_in_window := false; end if;
          exception when others then null;
          end;
        end if;
        if v_in_window then
          if coalesce(v_eb->>'mode', 'percent') = 'flat' then
            v_eb_unit := coalesce((v_eb->>'amount')::numeric, 0);
          else
            v_eb_unit := round(coalesce(p_price, 0) * coalesce((v_eb->>'percent')::numeric, 0) / 100, 2);
          end if;
          v_eb_unit := greatest(0, least(v_eb_unit, coalesce(p_price, 0)));
        end if;
      end if;
    end if;

    v_unit := greatest(0, coalesce(p_price, 0) - v_eb_unit);
    v_ticket_subtotal := v_unit * v_qty;
    v_total := (v_unit + coalesce(p_addons, 0)) * v_qty + v_donation;

    if v_eb_unit > 0 then
      p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
        'earlybird', jsonb_build_object('perTicket', v_eb_unit, 'amount', v_eb_unit * v_qty));
    end if;
  end if;

  -- Donation record.
  if v_donation > 0 then
    p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
      'donation', jsonb_build_object('amount', v_donation, 'cause', coalesce(v_meta->'donation'->>'cause', '')));
  end if;

  -- Discount code — ticket-scoped and rule-driven.
  --
  -- A code redeems only against a ticket that lists its id in
  -- metadata.tickets[].discountIds; the event-level attached list is legacy and
  -- is consulted only when there is no ticket to scope to (expo booths, ad-hoc
  -- purchases). How much the code gives is decided by its ordered rule list,
  -- evaluated top-down with the first match winning. Both halves live in
  -- events.resolve_ticket_discount() so the client preview, the Stripe session
  -- and this authoritative path cannot drift. Skipped for bundles.
  if coalesce(p_discount_code, '') <> '' and p_bundle_id is null then
    v_disc_base := case
      when coalesce(v_meta->'discountSettings'->>'appliesTo', 'order') = 'tickets'
        then v_unit * v_qty
      else (v_unit + coalesce(p_addons, 0)) * v_qty end;

    select d.ok, d.id, d.amount, d.discount_type, d.value, d.apply_per,
           d.rule_id, d.rule_label, d.matched, d.reason
      into v_disc_ok, v_disc_id, v_disc_amt, v_disc_type, v_disc_value,
           v_disc_per, v_disc_rule_id, v_disc_rule_label, v_disc_matched,
           v_disc_reason
      from events.resolve_ticket_discount(
             p_event_id, p_discount_code, p_tier_id, v_qty, v_disc_base) d;

    if v_disc_ok then
      v_disc_amt := greatest(0, least(coalesce(v_disc_amt, 0), v_total));
      v_total := v_total - v_disc_amt;
      p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
        'discount', jsonb_build_object(
          'id', v_disc_id::text, 'code', upper(btrim(p_discount_code)),
          'type', v_disc_type, 'value', v_disc_value, 'amount', v_disc_amt,
          'applyPer', v_disc_per, 'ruleId', v_disc_rule_id,
          'rule', v_disc_rule_label, 'matched', v_disc_matched));
    end if;
  end if;

  -- Group discount on the ticket subtotal (when dispensing to attendees).
  if p_attendees is not null and jsonb_typeof(p_attendees) = 'array' and jsonb_array_length(p_attendees) > 0
     and coalesce((v_meta->'ticketRules'->>'groupPurchase')::boolean, false) then
    v_group := v_meta->'groupPurchase';
    v_group_pct := coalesce((v_group->>'discountPercent')::numeric, 0);
    if v_group_pct > 0 then
      v_group_amt := round(v_ticket_subtotal * v_group_pct / 100, 2);
      v_group_amt := greatest(0, least(v_group_amt, v_total));
      v_total := v_total - v_group_amt;
      p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
        'group', jsonb_build_object('discountPercent', v_group_pct, 'amount', v_group_amt));
    end if;
  end if;

  v_total := greatest(0, v_total);

  -- ---- Insert order(s) ------------------------------------------------------
  if p_attendees is not null and jsonb_typeof(p_attendees) = 'array' and jsonb_array_length(p_attendees) > 0 then
    -- Group fan-out: one email-keyed order row per attendee, sharing a groupId,
    -- so each attendee sees their own ticket in their own portal.
    v_att_count := jsonb_array_length(p_attendees);
    v_group_id := gen_random_uuid()::text;
    v_ticket_total := greatest(0, v_total - v_donation);  -- donation rides the primary row
    v_per := round(v_ticket_total / v_att_count, 2);
    v_i := 0;
    for v_att in select value from jsonb_array_elements(p_attendees)
    loop
      v_att_email := lower(coalesce(v_att->>'email', ''));
      v_att_name := coalesce(v_att->>'name', '');
      if v_i = 0 then
        v_att_total := (v_ticket_total - v_per * (v_att_count - 1)) + v_donation;
      else
        v_att_total := v_per;
      end if;
      insert into events.event_orders
        (event_id, project_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata,
         stripe_session_id, stripe_payment_intent_id)
      values
        (p_event_id, v_project, v_att_name, v_att_email, coalesce(p_ticket, 'General Admission'),
         v_unit, 1, v_att_total,
         coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('group',
           coalesce(p_meta->'group', '{}'::jsonb) || jsonb_build_object(
             'id', v_group_id, 'size', v_att_count, 'index', v_i, 'organizer', coalesce(p_email, ''))),
         case when v_i = 0 then p_stripe_session_id else null end,
         case when v_i = 0 then p_stripe_payment_intent_id else null end)
      returning id into v_order;
      if v_i = 0 then v_first := v_order; end if;
      if v_att_email <> '' then
        insert into events.portal_members (email, name)
        values (v_att_email, v_att_name)
        on conflict (lower(email)) do update
          set name = case when events.portal_members.name = '' then excluded.name else events.portal_members.name end;
      end if;
      v_i := v_i + 1;
    end loop;
    v_order := v_first;
  else
    insert into events.event_orders
      (event_id, project_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, metadata,
       stripe_session_id, stripe_payment_intent_id)
    values
      (p_event_id, v_project, coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_ticket, 'General Admission'),
       v_unit, v_qty, v_total, coalesce(p_meta, '{}'::jsonb), p_stripe_session_id, p_stripe_payment_intent_id)
    returning id into v_order;

    if coalesce(p_email, '') <> '' then
      insert into events.portal_members (email, name)
      values (lower(p_email), coalesce(p_name, ''))
      on conflict (lower(email)) do update
        set name = case when events.portal_members.name = '' then excluded.name else events.portal_members.name end;
    end if;
  end if;

  -- ---- Bump counters --------------------------------------------------------
  v_meta_out := coalesce(v_meta, '{}'::jsonb);
  -- Ensure the counter objects exist so jsonb_set can write nested keys.
  if v_meta_out->'ticketSold' is null then v_meta_out := v_meta_out || '{"ticketSold":{}}'::jsonb; end if;
  if v_meta_out->'slotsSold' is null then v_meta_out := v_meta_out || '{"slotsSold":{}}'::jsonb; end if;

  if p_bundle_id is not null then
    for v_item in select it.val from jsonb_array_elements(coalesce(v_bundle->'items', '[]'::jsonb)) it(val)
    loop
      v_meta_out := jsonb_set(
        v_meta_out, array['ticketSold', v_item->>'ticketId'],
        to_jsonb(coalesce((v_meta_out->'ticketSold'->>(v_item->>'ticketId'))::integer, 0)
                 + greatest(1, coalesce((v_item->>'qty')::integer, 1)) * v_qty), true);
    end loop;
  elsif p_tier_id is not null then
    v_meta_out := jsonb_set(
      v_meta_out, array['ticketSold', p_tier_id],
      to_jsonb(coalesce((v_meta->'ticketSold'->>p_tier_id)::integer, 0) + v_qty), true);
  end if;
  if p_slot_id is not null then
    v_meta_out := jsonb_set(
      v_meta_out, array['slotsSold', p_slot_id],
      to_jsonb(coalesce((v_meta->'slotsSold'->>p_slot_id)::integer, 0) + v_qty), true);
  end if;

  update events.events as e
    set sold = e.sold + v_seat_count,
        revenue = e.revenue + v_total,
        metadata = v_meta_out
    where e.id = p_event_id
    returning e.sold, e.capacity into v_sold, v_cap;

  return query select true, v_order, v_sold, v_cap, greatest(0, v_effcap - v_sold), true;
end;
$$;
grant execute on function events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text)
  to anon, authenticated;

-- @down

-- Restore event-level behaviour by hoisting every ticket's code list back onto
-- the event, then drop the new objects. buy_ticket reverts to the definition in
-- 20260726194138_ticketing_addons.sql (event-scoped, base discount only), which
-- is why it is dropped rather than replaced here.
update events.events e
   set metadata = jsonb_set(
         e.metadata,
         '{attached,discount}',
         coalesce((
           select jsonb_agg(distinct d.x order by d.x)
           from jsonb_array_elements(coalesce(e.metadata->'tickets', '[]'::jsonb)) t(val)
           cross join lateral jsonb_array_elements(coalesce(t.val->'discountIds', '[]'::jsonb)) d(x)
         ), '[]'::jsonb)
       )
 where e.deleted_at is null
   and jsonb_typeof(e.metadata->'tickets') = 'array'
   and exists (
     select 1
     from jsonb_array_elements(coalesce(e.metadata->'tickets', '[]'::jsonb)) t(val)
     where jsonb_array_length(coalesce(t.val->'discountIds', '[]'::jsonb)) > 0
   );

drop function if exists events.public_event_discount(uuid, text, text, integer, numeric);
drop function if exists events.public_event_discount(uuid, text);
drop function if exists events.resolve_ticket_discount(uuid, text, text, integer, numeric);
drop function if exists events.discount_when(text);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text);
