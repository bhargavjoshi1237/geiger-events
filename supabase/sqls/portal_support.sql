-- ===========================================================================
-- Geiger Events — members portal support threads (buyer ↔ organiser messaging)
--
-- Self-contained + idempotent. A portal member opens a thread (optionally about
-- an order/event), and messages go back and forth. The buyer side is written by
-- the portal's server routes (service role, scoped to the session member); the
-- organiser side would reply from the dashboard (sender = 'organiser') — the
-- schema supports it now even though that admin surface is a later slice.
--
-- RLS ENABLED with NO policy: only the service role touches these tables, from
-- server routes only (same posture as portal_members.sql). Runs after
-- portal_members.sql; defines touch_updated_at() locally.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists events.portal_threads (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references events.portal_members(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete set null,
  event_id        uuid references events.events(id) on delete set null,
  order_id        uuid references events.event_orders(id) on delete set null,
  subject         text not null default '',
  -- open | closed
  status          text not null default 'open',
  -- Bumped on every new message so lists sort by recency cheaply.
  last_message_at timestamptz not null default now(),
  -- Whether the member has unread organiser replies (cleared when they open it).
  member_unread   boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists portal_threads_member_idx
  on events.portal_threads (member_id, last_message_at desc);
create index if not exists portal_threads_project_idx
  on events.portal_threads (project_id);

drop trigger if exists portal_threads_touch_updated_at on events.portal_threads;
create trigger portal_threads_touch_updated_at
before update on events.portal_threads
for each row execute function events.touch_updated_at();

create table if not exists events.portal_thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references events.portal_threads(id) on delete cascade,
  -- member | organiser
  sender      text not null default 'member',
  body        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists portal_thread_messages_thread_idx
  on events.portal_thread_messages (thread_id, created_at asc);

-- RLS on, no policy: service-role-only access.
alter table events.portal_threads          enable row level security;
alter table events.portal_thread_messages  enable row level security;
