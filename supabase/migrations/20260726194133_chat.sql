-- ===========================================================================
-- Geiger Events — Community chat foundation (channels + participants + messages)
--
-- Slice 1 of the Community area: a reusable chat backbone. One "event" channel
-- per event; ticket buyers (events.portal_members) are auto-added when the event
-- is published and on every purchase; organisers (public.users) join as
-- moderators. Buyers use it from the members portal, organisers from the event
-- editor's Communication section.
--
-- Two participant kinds share a channel: organisers (Supabase-authenticated) and
-- portal members (custom cookie auth → a scoped realtime JWT carrying member_id).
-- RLS lives in zz_project_access.sql (needs events.can_access_project, defined
-- there). This file: schema, tables, indexes, realtime publication, and the
-- SECURITY DEFINER helpers that create channels and enrol buyers.
--
-- FILE ORDER: migrations run in alphabetical filename order. These tables FK
-- events.events / events.portal_members / event_orders, so this file MUST run
-- AFTER events.sql, orders.sql and portal_members.sql create them — hence the
-- `z_` prefix. It still runs BEFORE zz_project_access.sql, so the chat RLS
-- policies and the buy_ticket enrolment (both in zz) can reference these tables
-- and the add_ticket_buyer_to_chat helper. Self-contained + idempotent.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists events.chat_channels (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  event_id      uuid references events.events(id) on delete cascade,
  kind          text not null default 'event',        -- event | board | qa | dm (future)
  name          text not null default '',
  topic         text not null default '',
  -- open = group discussion; announce = organisers post, members react only.
  posting_mode  text not null default 'announce',
  status        text not null default 'active',       -- active | archived
  created_by    uuid references auth.users(id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- One active event-chat per event.
create unique index if not exists chat_channels_event_uidx
  on events.chat_channels (event_id)
  where kind = 'event' and deleted_at is null;
create index if not exists chat_channels_project_idx
  on events.chat_channels (project_id) where deleted_at is null;

drop trigger if exists chat_channels_touch_updated_at on events.chat_channels;
create trigger chat_channels_touch_updated_at
before update on events.chat_channels
for each row execute function events.touch_updated_at();

create table if not exists events.chat_participants (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references events.chat_channels(id) on delete cascade,
  member_id     uuid references events.portal_members(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text not null default 'member',       -- member | organiser | moderator
  muted         boolean not null default false,
  last_read_at  timestamptz,
  joined_at     timestamptz not null default now(),
  -- Exactly one identity per participant row.
  constraint chat_participants_one_identity check (
    (member_id is not null and user_id is null) or
    (member_id is null and user_id is not null)
  )
);

create unique index if not exists chat_participants_member_uidx
  on events.chat_participants (channel_id, member_id) where member_id is not null;
create unique index if not exists chat_participants_user_uidx
  on events.chat_participants (channel_id, user_id) where user_id is not null;
create index if not exists chat_participants_channel_idx
  on events.chat_participants (channel_id);
create index if not exists chat_participants_member_idx
  on events.chat_participants (member_id) where member_id is not null;

create table if not exists events.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid not null references events.chat_channels(id) on delete cascade,
  author_member_id  uuid references events.portal_members(id) on delete set null,
  author_user_id    uuid references auth.users(id) on delete set null,
  sender_kind       text not null default 'member',   -- member | organiser | system
  -- Denormalized display name so the client never reads service-role-only
  -- portal_members to render an author.
  author_name       text not null default '',
  body              text not null default '',
  metadata          jsonb not null default '{}'::jsonb, -- reactions {emoji:[key]}, replyTo, type
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);

create index if not exists chat_messages_channel_idx
  on events.chat_messages (channel_id, created_at);

-- ---------------------------------------------------------------------------
-- Realtime publication (idempotent). Members subscribe with a scoped JWT; RLS
-- (zz_project_access.sql) scopes which rows they receive.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'events' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table events.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'events' and tablename = 'chat_participants'
  ) then
    alter publication supabase_realtime add table events.chat_participants;
  end if;
exception when undefined_object then
  -- No supabase_realtime publication in this environment; skip.
  null;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-population helpers (SECURITY DEFINER so the public checkout path and the
-- dashboard publish action can create/enrol without their own table grants).
-- ---------------------------------------------------------------------------

-- Create the event's chat channel if missing and back-fill every existing buyer
-- as a participant. Returns the channel id. p_posting_mode only applies at
-- creation (an existing channel keeps its configured mode).
create or replace function events.ensure_event_chat(
  p_event_id uuid,
  p_posting_mode text default 'announce'
)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_channel uuid;
  v_project uuid;
  v_name text;
begin
  select id into v_channel
    from events.chat_channels
    where event_id = p_event_id and kind = 'event' and deleted_at is null
    limit 1;
  if v_channel is not null then
    return v_channel;
  end if;

  select project_id, name into v_project, v_name
    from events.events where id = p_event_id;
  if v_project is null then
    return null;               -- event has no project; nothing to scope to
  end if;

  insert into events.chat_channels (project_id, event_id, kind, name, posting_mode)
  values (
    v_project, p_event_id, 'event', coalesce(v_name, 'Event chat'),
    case when p_posting_mode in ('open', 'announce') then p_posting_mode else 'announce' end
  )
  returning id into v_channel;

  -- Back-fill existing buyers (resolve members by email, one set-based insert).
  insert into events.chat_participants (channel_id, member_id, role)
  select v_channel, m.id, 'member'
    from events.event_orders o
    join events.portal_members m on lower(m.email) = lower(o.buyer_email)
    where o.event_id = p_event_id and coalesce(o.buyer_email, '') <> ''
  on conflict (channel_id, member_id) where member_id is not null do nothing;

  return v_channel;
end;
$$;

grant execute on function events.ensure_event_chat(uuid, text) to anon, authenticated, service_role;

-- Ensure the channel exists and enrol a single buyer (called from buy_ticket).
-- Also enrols the buyer into every open-audience Q&A thread for the event, so
-- attendees accrue into those threads automatically as they buy tickets.
create or replace function events.add_ticket_buyer_to_chat(
  p_event_id uuid,
  p_email text,
  p_name text default ''
)
returns void
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_channel uuid;
  v_member uuid;
begin
  if coalesce(p_email, '') = '' then
    return;
  end if;
  v_channel := events.ensure_event_chat(p_event_id, 'announce');
  if v_channel is null then
    return;
  end if;
  select id into v_member
    from events.portal_members where lower(email) = lower(p_email) limit 1;
  if v_member is null then
    return;
  end if;
  insert into events.chat_participants (channel_id, member_id, role)
  values (v_channel, v_member, 'member')
  on conflict (channel_id, member_id) where member_id is not null do nothing;

  -- Q&A threads for this event whose audience is 'all' — enrol the buyer too.
  insert into events.chat_participants (channel_id, member_id, role)
  select c.id, v_member, 'member'
    from events.chat_channels c
    where c.event_id = p_event_id and c.kind = 'qa' and c.deleted_at is null
      and coalesce(c.metadata ->> 'audience', 'all') = 'all'
  on conflict (channel_id, member_id) where member_id is not null do nothing;
end;
$$;

grant execute on function events.add_ticket_buyer_to_chat(uuid, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Q&A threads (kind='qa' channels). Organiser-created topic threads for an
-- event; each open to all attendees or a managed subset. SECURITY DEFINER so the
-- organiser's create/manage actions can enrol portal members (service-role-only
-- readable) — guarded by can_access_project against the caller's auth.uid().
-- ---------------------------------------------------------------------------

-- Create a Q&A thread and enrol its audience. Returns the new channel id (null if
-- the caller can't access the event's project). p_audience: 'all' back-fills every
-- event buyer; 'selected' enrols only the members matching p_emails.
create or replace function events.create_qa_thread(
  p_event_id uuid,
  p_name text,
  p_topic text default '',
  p_posting_mode text default 'open',
  p_audience text default 'all',
  p_emails text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project  uuid;
  v_channel  uuid;
  v_audience text := case when p_audience = 'selected' then 'selected' else 'all' end;
  v_mode     text := case when p_posting_mode in ('open', 'announce') then p_posting_mode else 'open' end;
begin
  select project_id into v_project from events.events where id = p_event_id;
  if v_project is null then
    return null;                            -- event has no project to scope to
  end if;
  if not events.can_access_project(v_project) then
    return null;                            -- caller isn't an org member
  end if;

  insert into events.chat_channels
    (project_id, event_id, kind, name, topic, posting_mode, status, created_by, metadata)
  values (
    v_project, p_event_id, 'qa',
    coalesce(nullif(trim(p_name), ''), 'Thread'),
    coalesce(p_topic, ''), v_mode, 'active', auth.uid(),
    jsonb_build_object('audience', v_audience)
  )
  returning id into v_channel;

  if v_audience = 'all' then
    insert into events.chat_participants (channel_id, member_id, role)
    select v_channel, m.id, 'member'
      from events.event_orders o
      join events.portal_members m on lower(m.email) = lower(o.buyer_email)
      where o.event_id = p_event_id and coalesce(o.buyer_email, '') <> ''
    on conflict (channel_id, member_id) where member_id is not null do nothing;
  else
    insert into events.chat_participants (channel_id, member_id, role)
    select v_channel, m.id, 'member'
      from events.portal_members m
      where lower(m.email) = any (select lower(x) from unnest(p_emails) x)
    on conflict (channel_id, member_id) where member_id is not null do nothing;
  end if;

  return v_channel;
end;
$$;

grant execute on function events.create_qa_thread(uuid, text, text, text, text, text[]) to authenticated, service_role;

-- Add members (by email) to an existing Q&A thread. Returns how many were added.
create or replace function events.add_qa_participants(
  p_channel_id uuid,
  p_emails text[]
)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_added   integer;
begin
  select project_id into v_project
    from events.chat_channels where id = p_channel_id and deleted_at is null;
  if v_project is null or not events.can_access_project(v_project) then
    return 0;
  end if;

  with ins as (
    insert into events.chat_participants (channel_id, member_id, role)
    select p_channel_id, m.id, 'member'
      from events.portal_members m
      where lower(m.email) = any (select lower(x) from unnest(p_emails) x)
    on conflict (channel_id, member_id) where member_id is not null do nothing
    returning 1
  )
  select count(*) into v_added from ins;
  return v_added;
end;
$$;

grant execute on function events.add_qa_participants(uuid, text[]) to authenticated, service_role;

-- Whether the current realtime JWT's member_id participates in a channel. Used
-- by the member RLS policies (SECURITY DEFINER to avoid recursive RLS on
-- chat_participants).
create or replace function events.chat_channel_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = events, public, auth
as $$
  select exists (
    select 1 from events.chat_participants p
    where p.channel_id = p_channel
      and p.member_id is not null
      and p.member_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'member_id', '')::uuid
  );
$$;

grant execute on function events.chat_channel_member(uuid) to anon, authenticated;
