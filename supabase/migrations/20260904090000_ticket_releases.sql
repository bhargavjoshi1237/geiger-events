-- @up
-- ===========================================================================
-- Geiger Events — batched ticket releases (waves)
--
-- Lets an organiser split one ticket into ordered tranches, e.g.
--   Release 1: 100 tickets on 1 Oct
--   Release 2: 100 tickets on 1 Nov, or 10 days after Release 1 sells out
--
-- Storage (all in the event's metadata bag, so no new table):
--   metadata.tickets[].releases = [
--     { id, name, qty, startMode: now|date|after_stockout|manual,
--       startAt, afterReleaseId, delayDays, endAt, released, paused }
--   ]
--   metadata.releaseSoldOutAt = { <releaseId>: <ISO timestamptz> }
--
-- Sales fill tranches FIFO, so the existing per-ticket counter
-- (metadata.ticketSold[ticketId]) stays the single source of truth.
-- This file adds a pure helper + enforces the gate inside buy_ticket
-- (buy_seats / buy_booths delegate to buy_ticket, so they inherit it).
-- Tickets without a releases array keep legacy behaviour.
--
-- Self-contained and idempotent: safe to re-run via `npm run db:push`.
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

-- ---------------------------------------------------------------------------
-- unlocked_release_qty(): how many of a ticket's allocation is on sale NOW.
--
-- Returns NULL when the ticket has no releases (legacy — no gate),
-- -1 when an unlocked tranche is unlimited, else the summed unlocked qty.
-- p_sold is the ticket's sold counter BEFORE this purchase.
-- ---------------------------------------------------------------------------
create or replace function events.unlocked_release_qty(
  p_releases jsonb,
  p_sold integer,
  p_soldout jsonb,
  p_now timestamptz
)
returns integer
language plpgsql
stable
as $$
declare
  v_n integer := 0;
  v_i integer;
  v_r jsonb;
  v_qty integer;
  v_paused boolean;
  v_released boolean;
  v_mode text;
  v_start_at text;
  v_end_at text;
  v_after text;
  v_delay integer;
  v_start_t timestamptz;
  v_end_t timestamptz;
  v_so_t timestamptz;
  v_trigger text;
  v_trigger_idx integer;
  v_unlocked boolean;
  v_total integer := 0;
  v_any_unlimited boolean := false;
  v_sold_arr integer[];
  v_out_arr boolean[];
  v_left integer;
  v_cap integer;
  v_take integer;
  v_j integer;
  v_tr jsonb;
  v_tr_cap integer;
begin
  if p_releases is null or jsonb_typeof(p_releases) <> 'array' then
    return null;
  end if;
  select count(*) into v_n from jsonb_array_elements(p_releases);
  if v_n = 0 then
    return null;
  end if;

  -- Pass 1: FIFO allocation — sales fill release 0, then 1, …
  v_left := greatest(0, coalesce(p_sold, 0));
  v_sold_arr := array[]::integer[];
  v_out_arr := array[]::boolean[];
  for v_i in 0..v_n - 1 loop
    v_r := p_releases -> v_i;
    v_cap := greatest(0, coalesce((v_r->>'qty')::integer, 0));
    if v_cap <= 0 then
      v_sold_arr := v_sold_arr || 0;
      v_out_arr := v_out_arr || false;
    else
      v_take := least(v_cap, v_left);
      v_left := v_left - v_take;
      v_sold_arr := v_sold_arr || v_take;
      v_out_arr := v_out_arr || (v_take >= v_cap);
    end if;
  end loop;

  -- Pass 2: which tranches are unlocked right now.
  for v_i in 0..v_n - 1 loop
    v_r := p_releases -> v_i;
    v_qty := greatest(0, coalesce((v_r->>'qty')::integer, 0));
    begin
      v_paused := coalesce((v_r->>'paused')::boolean, false);
    exception when others then
      v_paused := false;
    end;
    if coalesce(v_paused, false) then
      continue;
    end if;

    -- Hard close for this tranche.
    v_end_at := v_r->>'endAt';
    if coalesce(v_end_at, '') <> '' then
      begin
        v_end_t := v_end_at::timestamptz;
        if p_now > v_end_t then
          continue;
        end if;
      exception when others then
        null;
      end;
    end if;

    v_mode := coalesce(v_r->>'startMode', 'now');
    begin
      v_released := coalesce((v_r->>'released')::boolean, true);
    exception when others then
      v_released := true;
    end;

    v_unlocked := false;
    if v_mode = 'manual' then
      v_unlocked := coalesce(v_released, true);
    elsif v_mode = 'date' then
      v_start_at := v_r->>'startAt';
      if coalesce(v_start_at, '') = '' then
        v_unlocked := true;
      else
        begin
          v_start_t := v_start_at::timestamptz;
          v_unlocked := p_now >= v_start_t;
        exception when others then
          v_unlocked := true;
        end;
      end if;
    elsif v_mode = 'after_stockout' then
      v_after := coalesce(v_r->>'afterReleaseId', '');
      if v_after = '' and v_i > 0 then
        v_after := coalesce((p_releases -> (v_i - 1))->>'id', '');
      end if;
      if v_after = '' then
        v_unlocked := true;
      else
        v_trigger_idx := -1;
        for v_j in 0..v_n - 1 loop
          v_tr := p_releases -> v_j;
          if coalesce(v_tr->>'id', '') = v_after then
            v_trigger_idx := v_j;
            exit;
          end if;
        end loop;
        if v_trigger_idx < 0 then
          v_unlocked := true;
        else
          v_tr := p_releases -> v_trigger_idx;
          v_tr_cap := greatest(0, coalesce((v_tr->>'qty')::integer, 0));
          if v_tr_cap <= 0 or not coalesce(v_out_arr[v_trigger_idx + 1], false) then
            v_unlocked := false;
          else
            v_delay := greatest(0, coalesce((v_r->>'delayDays')::integer, 0));
            if v_delay <= 0 then
              v_unlocked := true;
            else
              begin
                v_so_t := (p_soldout->>v_after)::timestamptz;
              exception when others then
                v_so_t := null;
              end;
              -- Sold out before we stamped times: treat the delay as elapsed
              -- rather than locking buyers out forever.
              if v_so_t is null then
                v_unlocked := true;
              else
                v_unlocked := p_now >= (v_so_t + (v_delay || ' days')::interval);
              end if;
            end if;
          end if;
        end if;
      end if;
    else
      -- "now" (and any unknown mode falls open, never locks silently).
      v_unlocked := true;
    end if;

    if v_unlocked then
      if v_qty <= 0 then
        v_any_unlimited := true;
      else
        v_total := v_total + v_qty;
      end if;
    end if;
  end loop;

  if v_any_unlimited then
    return -1;
  end if;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- buy_ticket(): final definition — identical to ticketing_addons.sql PLUS the
-- batched-release gate. Drops the 17-arg version and recreates it.
-- ---------------------------------------------------------------------------
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text, text, text);
drop function if exists events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text);

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
  -- Batched releases.
  v_rel_unlocked integer;
  v_rel_soldout jsonb;
  v_rel_releases jsonb;
  v_rel_sold integer;
  v_rel_left integer;
  v_rel_idx integer;
  v_rel_n integer;
  v_rel_r jsonb;
  v_rel_cap integer;
  v_rel_take integer;
  v_rel_id text;
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
      -- Batched releases: only unlocked tranches count (FIFO fill).
      v_rel_soldout := coalesce(v_meta->'releaseSoldOutAt', '{}'::jsonb);
      v_rel_unlocked := events.unlocked_release_qty(
        v_tier->'releases', v_tier_sold, v_rel_soldout, v_now);
      if v_rel_unlocked is not null and v_rel_unlocked >= 0
         and v_tier_sold + v_qty > v_rel_unlocked then
        return query select false, null::uuid, v_sold, v_cap, greatest(0, v_rel_unlocked - v_tier_sold), false;
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
        v_rel_soldout := coalesce(v_meta->'releaseSoldOutAt', '{}'::jsonb);
        v_rel_unlocked := events.unlocked_release_qty(
          v_item_ticket->'releases', v_tier_sold, v_rel_soldout, v_now);
        if v_rel_unlocked is not null and v_rel_unlocked >= 0
           and v_tier_sold + v_item_qty > v_rel_unlocked then
          return query select false, null::uuid, v_sold, v_cap, greatest(0, v_rel_unlocked - v_tier_sold), false;
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

  -- Discount code (base uses the post-early-bird unit; skipped for bundles).
  if coalesce(p_discount_code, '') <> '' and p_bundle_id is null then
    v_disc_attached := v_meta->'attached'->'discount';
    if v_disc_attached is not null and jsonb_typeof(v_disc_attached) = 'array' then
      select r.id, r.config into v_disc_id, v_disc_config
        from events.ticketing_records r
        where r.module = 'discount' and r.kind = 'coupon' and r.active is true and r.deleted_at is null
          and r.id::text in (select jsonb_array_elements_text(v_disc_attached))
          and upper(btrim(coalesce(r.config->>'code', ''))) = upper(btrim(p_discount_code))
        limit 1;
      if v_disc_id is not null then
        v_disc_applies := coalesce(v_meta->'discountSettings'->>'appliesTo', 'order');
        v_disc_base := case
          when v_disc_applies = 'tickets' then v_unit * v_qty
          else (v_unit + coalesce(p_addons, 0)) * v_qty end;
        if coalesce(v_disc_config->>'discountType', 'percent') = 'flat' then
          v_disc_amt := least(coalesce((v_disc_config->>'value')::numeric, 0), v_disc_base);
        else
          v_disc_amt := round(v_disc_base * coalesce((v_disc_config->>'value')::numeric, 0) / 100, 2);
        end if;
        v_disc_amt := greatest(0, least(v_disc_amt, v_total));
        v_total := v_total - v_disc_amt;
        p_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
          'discount', jsonb_build_object(
            'id', v_disc_id::text, 'code', upper(btrim(p_discount_code)),
            'type', coalesce(v_disc_config->>'discountType', 'percent'),
            'value', coalesce((v_disc_config->>'value')::numeric, 0), 'amount', v_disc_amt));
      end if;
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
        set name = case when events.portal_members.name = ''
                      then excluded.name else events.portal_members.name end;
    end if;
  end if;

  -- ---- Bump counters --------------------------------------------------------
  v_meta_out := coalesce(v_meta, '{}'::jsonb);
  -- Ensure the counter objects exist so jsonb_set can write nested keys.
  if v_meta_out->'ticketSold' is null then v_meta_out := v_meta_out || '{"ticketSold":{}}'::jsonb; end if;
  if v_meta_out->'slotsSold' is null then v_meta_out := v_meta_out || '{"slotsSold":{}}'::jsonb; end if;
  if v_meta_out->'releaseSoldOutAt' is null then v_meta_out := v_meta_out || '{"releaseSoldOutAt":{}}'::jsonb; end if;

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

  -- Stamp release sell-out moments (drives after_stockout + delayDays).
  -- For every touched ticket with releases, FIFO-allocate the NEW sold count;
  -- any tranche now full without a stamp gets one.
  if p_tier_id is not null and p_bundle_id is null then
    select t.val into v_tier
      from jsonb_array_elements(coalesce(v_meta_out->'tickets', '[]'::jsonb)) as t(val)
      where t.val->>'id' = p_tier_id limit 1;
    if v_tier is not null and jsonb_typeof(coalesce(v_tier->'releases', '[]'::jsonb)) = 'array' then
      v_rel_releases := v_tier->'releases';
      v_rel_sold := coalesce((v_meta_out->'ticketSold'->>p_tier_id)::integer, 0);
      select count(*) into v_rel_n from jsonb_array_elements(v_rel_releases);
      v_rel_left := v_rel_sold;
      for v_rel_idx in 0..v_rel_n - 1 loop
        v_rel_r := v_rel_releases -> v_rel_idx;
        v_rel_cap := greatest(0, coalesce((v_rel_r->>'qty')::integer, 0));
        v_rel_id := coalesce(v_rel_r->>'id', '');
        if v_rel_cap > 0 and v_rel_id <> '' then
          v_rel_take := least(v_rel_cap, v_rel_left);
          v_rel_left := v_rel_left - v_rel_take;
          if v_rel_take >= v_rel_cap
             and not (v_meta_out->'releaseSoldOutAt' ? v_rel_id) then
            v_meta_out := jsonb_set(
              v_meta_out, array['releaseSoldOutAt', v_rel_id],
              to_jsonb(v_now::text), true);
          end if;
        end if;
      end loop;
    end if;
  end if;
  if p_bundle_id is not null then
    for v_item in select it.val from jsonb_array_elements(coalesce(v_bundle->'items', '[]'::jsonb)) it(val)
    loop
      select t.val into v_item_ticket
        from jsonb_array_elements(coalesce(v_meta_out->'tickets', '[]'::jsonb)) t(val)
        where t.val->>'id' = v_item->>'ticketId' limit 1;
      if v_item_ticket is not null and jsonb_typeof(coalesce(v_item_ticket->'releases', '[]'::jsonb)) = 'array' then
        v_rel_releases := v_item_ticket->'releases';
        v_rel_sold := coalesce((v_meta_out->'ticketSold'->>(v_item->>'ticketId'))::integer, 0);
        select count(*) into v_rel_n from jsonb_array_elements(v_rel_releases);
        v_rel_left := v_rel_sold;
        for v_rel_idx in 0..v_rel_n - 1 loop
          v_rel_r := v_rel_releases -> v_rel_idx;
          v_rel_cap := greatest(0, coalesce((v_rel_r->>'qty')::integer, 0));
          v_rel_id := coalesce(v_rel_r->>'id', '');
          if v_rel_cap > 0 and v_rel_id <> '' then
            v_rel_take := least(v_rel_cap, v_rel_left);
            v_rel_left := v_rel_left - v_rel_take;
            if v_rel_take >= v_rel_cap
               and not (v_meta_out->'releaseSoldOutAt' ? v_rel_id) then
              v_meta_out := jsonb_set(
                v_meta_out, array['releaseSoldOutAt', v_rel_id],
                to_jsonb(v_now::text), true);
            end if;
          end if;
        end loop;
      end if;
    end loop;
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

grant execute on function events.unlocked_release_qty(jsonb, integer, jsonb, timestamptz) to anon, authenticated;
grant execute on function events.buy_ticket(uuid, text, text, text, numeric, integer, numeric, jsonb, text, text, text, text, text, numeric, text, jsonb, text)
  to anon, authenticated;
