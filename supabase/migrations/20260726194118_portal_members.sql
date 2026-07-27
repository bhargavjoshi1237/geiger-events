-- ===========================================================================
-- Geiger Events — members portal (custom auth store)
--
-- Self-contained + idempotent. A "member" is a buyer account, distinct from any
-- Supabase Auth user. Rows are auto-created passwordless by events.buy_ticket
-- (see zz_project_access.sql). Passwords are scrypt-hashed in the app (Node) and
-- stored here; sessions + one-time setup tokens live in their own tables.
--
-- RLS is ENABLED with NO policy: only the service role (which bypasses RLS)
-- touches these tables, exclusively from server routes. Runs before
-- zz_project_access.sql (buy_ticket references portal_members); defines
-- touch_updated_at() locally.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists events.portal_members (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  name           text not null default '',
  password_hash  text,
  password_set_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  metadata       jsonb not null default '{}'::jsonb
);

-- Case-insensitive unique email (also the ON CONFLICT target in buy_ticket).
create unique index if not exists portal_members_email_key
  on events.portal_members (lower(email));

drop trigger if exists portal_members_touch_updated_at on events.portal_members;
create trigger portal_members_touch_updated_at
before update on events.portal_members
for each row execute function events.touch_updated_at();

create table if not exists events.portal_sessions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references events.portal_members(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists portal_sessions_member_idx on events.portal_sessions (member_id);

create table if not exists events.portal_password_setups (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references events.portal_members(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists portal_password_setups_member_idx on events.portal_password_setups (member_id);

-- RLS on, no policy: service-role-only access.
alter table events.portal_members          enable row level security;
alter table events.portal_sessions         enable row level security;
alter table events.portal_password_setups  enable row level security;
