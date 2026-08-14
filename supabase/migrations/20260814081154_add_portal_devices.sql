-- Add portal devices
--
-- Owns events.portal_devices — the Expo push tokens registered by the members
-- mobile app, one row per (member, device token). Written only through the
-- service role from app/api/portal/devices, so RLS is enabled with no policy:
-- anon/authenticated can never read another member's push tokens.

-- @up
create extension if not exists pgcrypto;

create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here
-- so this migration never depends on another having run first.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.portal_devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  -- Expo push token ("ExponentPushToken[...]"), unique across members so a
  -- re-installed device re-points at whoever signs in on it.
  push_token text not null,
  platform text not null default 'unknown',
  app_version text,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists portal_devices_token_key
  on events.portal_devices (push_token);

create index if not exists portal_devices_member_idx
  on events.portal_devices (member_id)
  where deleted_at is null;

drop trigger if exists portal_devices_touch_updated_at on events.portal_devices;
create trigger portal_devices_touch_updated_at
before update on events.portal_devices
for each row execute function events.touch_updated_at();

-- Service-role only: RLS on, no policy (same posture as portal_sessions and
-- portal_threads). Every read/write goes through lib/supabase/admin.js.
alter table events.portal_devices enable row level security;

-- @down
drop table if exists events.portal_devices cascade;
