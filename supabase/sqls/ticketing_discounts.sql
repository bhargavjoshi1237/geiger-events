-- ===========================================================================
-- Geiger Events — discount-code validation (public checkout)
--
-- Self-contained and idempotent. Depends on events.events, events.ticketing_
-- records and events.event_orders (created by earlier migrations; plpgsql bodies
-- are late-bound so creation order is safe). Filename sorts after ticketing.sql
-- and orders.sql.
--
-- public_event_discount() lets an anonymous buyer validate a typed code against
-- the coupons ATTACHED to an event (events.metadata.attached.discount). Only an
-- attached, active coupon whose code matches and whose usage limit is not yet
-- reached resolves — so a code works on an event only when the organiser has
-- attached it, and the member-only ticketing_records table stays private.
-- SECURITY DEFINER so it can read the member-only records for an anon buyer.
-- The buy_ticket RPC re-derives the discount authoritatively (zz_project_access
-- .sql); this function only powers the live "Apply code" feedback + display.
-- ===========================================================================

create extension if not exists pgcrypto;

create or replace function events.public_event_discount(p_event_id uuid, p_code text)
returns table (ok boolean, id uuid, code text, discount_type text, value numeric, reason text)
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_attached jsonb;
  v_id uuid;
  v_config jsonb;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_limit integer;
  v_used integer;
begin
  if v_code = '' then
    return query select false, null::uuid, null::text, null::text, null::numeric, 'empty'::text;
    return;
  end if;

  -- The coupons attached to this event (array of ticketing_records ids).
  select e.metadata->'attached'->'discount'
    into v_attached
    from events.events e
    where e.id = p_event_id and e.deleted_at is null;

  if v_attached is null or jsonb_typeof(v_attached) <> 'array' or jsonb_array_length(v_attached) = 0 then
    return query select false, null::uuid, null::text, null::text, null::numeric, 'not_allowed'::text;
    return;
  end if;

  -- Match the typed code against an attached, active coupon.
  select r.id, r.config
    into v_id, v_config
    from events.ticketing_records r
    where r.module = 'discount'
      and r.kind = 'coupon'
      and r.active is true
      and r.deleted_at is null
      and r.id::text in (select jsonb_array_elements_text(v_attached))
      and upper(btrim(coalesce(r.config->>'code', ''))) = v_code
    limit 1;

  if v_id is null then
    return query select false, null::uuid, null::text, null::text, null::numeric, 'invalid'::text;
    return;
  end if;

  -- Enforce the usage limit (0 = unlimited): count prior redemptions on this event.
  v_limit := coalesce((v_config->>'usageLimit')::integer, 0);
  if v_limit > 0 then
    select count(*) into v_used
      from events.event_orders o
      where o.event_id = p_event_id
        and o.status not in ('cancelled', 'refunded')
        and o.metadata->'discount'->>'id' = v_id::text;
    if v_used >= v_limit then
      return query select false, v_id, v_code, null::text, null::numeric, 'limit'::text;
      return;
    end if;
  end if;

  return query select true, v_id, v_code,
    coalesce(v_config->>'discountType', 'percent'),
    coalesce((v_config->>'value')::numeric, 0),
    null::text;
end;
$$;

grant execute on function events.public_event_discount(uuid, text) to anon, authenticated;
