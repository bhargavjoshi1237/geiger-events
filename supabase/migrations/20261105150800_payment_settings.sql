-- @up
-- Payment settings per project: whether ticket checkout runs in demo mode on Geiger's Stripe sandbox
-- instead of the organization's connected Stripe account (@geiger/pay).
-- Service role only: the Payments settings API checks the organization owner before writing.

create schema if not exists events;

create table if not exists events.payment_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  demo_mode boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payment_settings_touch on events.payment_settings;
create trigger payment_settings_touch
  before update on events.payment_settings
  for each row execute function events.touch_updated_at();

alter table events.payment_settings enable row level security;

revoke all on events.payment_settings from anon, authenticated;
grant all on events.payment_settings to service_role;

-- @down
drop table if exists events.payment_settings;
