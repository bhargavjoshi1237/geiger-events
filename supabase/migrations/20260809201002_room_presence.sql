-- Room presence
--
-- Owns events.room_presence and events.room_presence_touch(). One row per
-- (room, browser tab); the watch page heartbeats every 30s. Every live metric —
-- concurrency, unique viewers, watch time, attendance — rolls up from this one
-- write path so no number on the Broadcast screens is hand-typed.

-- @up
create extension if not exists pgcrypto;
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists events.room_presence (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  room_id         uuid not null
                    references events.conference_records(id) on delete cascade,
  -- Plain uuid, no FK: portal members are not auth.users.
  member_id       uuid,
  session_key     text not null,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  seconds_watched integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create unique index if not exists room_presence_room_session_idx
  on events.room_presence (room_id, session_key);
create index if not exists room_presence_room_seen_idx
  on events.room_presence (room_id, last_seen_at);
create index if not exists room_presence_member_idx
  on events.room_presence (member_id);

drop trigger if exists room_presence_touch_updated_at on events.room_presence;
create trigger room_presence_touch_updated_at
before update on events.room_presence
for each row execute function events.touch_updated_at();

-- Idempotent heartbeat: the first call creates the row, later calls advance
-- last_seen_at and accumulate watch time for that tab.
create or replace function events.room_presence_touch(
  p_room_id uuid,
  p_member_id uuid,
  p_session_key text,
  p_seconds integer default 0
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into events.room_presence (room_id, member_id, session_key, seconds_watched, project_id)
  select p_room_id, p_member_id, p_session_key, greatest(coalesce(p_seconds, 0), 0), r.project_id
    from events.conference_records r where r.id = p_room_id
  on conflict (room_id, session_key) do update
    set last_seen_at    = now(),
        seconds_watched = events.room_presence.seconds_watched
                          + greatest(coalesce(p_seconds, 0), 0),
        member_id       = coalesce(events.room_presence.member_id, excluded.member_id)
  returning id into v_id;
  return v_id;
end;
$$;

alter table events.room_presence enable row level security;
drop policy if exists room_presence_demo_all on events.room_presence;
create policy room_presence_demo_all on events.room_presence for all to anon, authenticated
  using (true) with check (true);

-- @down
drop function if exists events.room_presence_touch(uuid, uuid, text, integer);
drop policy if exists room_presence_demo_all on events.room_presence;
drop table if exists events.room_presence cascade;
