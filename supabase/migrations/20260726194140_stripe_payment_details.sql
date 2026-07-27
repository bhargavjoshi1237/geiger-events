-- Imported from zzzz_stripe_payment_details.sql by geiger-orm.
-- No @down section — this migration cannot be rolled back.

-- @up
-- Full, safe Stripe payment snapshot captured during Checkout fulfillment.
-- The JSON contains the Checkout Session, every line item, and expanded
-- PaymentIntent / PaymentMethod / Charge / BalanceTransaction data. Credentials
-- such as PaymentIntent.client_secret are removed before persistence.

alter table events.event_orders
  add column if not exists stripe_payment_details jsonb not null default '{}'::jsonb;

comment on column events.event_orders.stripe_payment_details is
  'Redacted Stripe Checkout payment snapshot captured at fulfillment time.';
