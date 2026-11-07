-- @up
-- Discussion Boards: persistent, threaded, topic-based community between events.
-- Organisers manage everything through RLS (can_access_project); portal members only ever reach these tables through
-- service-role API routes (app/api/portal/boards/*) that check the board audience, bans and edit windows.

create schema if not exists events;

-- Boards ----------------------------------------------------------------------
create table if not exists events.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- null = community-wide; set = only that event's ticket holders.
  event_id uuid references events.events(id) on delete cascade,
  name text not null default 'Untitled board',
  slug text not null default '',
  description text not null default '',
  icon text not null default 'MessagesSquare',
  sort_order integer not null default 0,
  -- Audience spec (lib/audience/resolve.js shape); {} = everyone the board's scope reaches.
  audience jsonb not null default '{}'::jsonb,
  format text not null default 'discussion' check (format in ('discussion', 'qa')),
  posting_policy text not null default 'members' check (posting_policy in ('members', 'moderators_only')),
  require_approval boolean not null default false,
  -- inherit = use board_settings.config.emailDefault.
  email_notifications text not null default 'inherit' check (email_notifications in ('inherit', 'on', 'off')),
  archived boolean not null default false,
  topic_count integer not null default 0,
  post_count integer not null default 0,
  last_activity_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists boards_project_idx
  on events.boards (project_id, sort_order)
  where deleted_at is null;
create unique index if not exists boards_slug_uidx
  on events.boards (project_id, lower(slug))
  where deleted_at is null and slug <> '';

-- Topics ----------------------------------------------------------------------
create table if not exists events.board_topics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  board_id uuid not null references events.boards(id) on delete cascade,
  author_kind text not null default 'member' check (author_kind in ('member', 'organiser')),
  author_member_id uuid references events.portal_members(id) on delete set null,
  author_user_id uuid,
  -- Display snapshot so the dashboard never reads service-role-only portal_members.
  author_name text not null default '',
  author_email text not null default '',
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  locked boolean not null default false,
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  reply_count integer not null default 0,
  view_count integer not null default 0,
  reaction_counts jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  last_activity_at timestamptz not null default now(),
  last_reply_name text not null default '',
  published_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists board_topics_board_idx
  on events.board_topics (board_id, pinned desc, last_activity_at desc)
  where deleted_at is null;
create index if not exists board_topics_project_idx
  on events.board_topics (project_id, status, last_activity_at desc)
  where deleted_at is null;
create index if not exists board_topics_author_idx
  on events.board_topics (author_member_id)
  where author_member_id is not null and deleted_at is null;
create index if not exists board_topics_tags_idx
  on events.board_topics using gin (tags);

-- Posts (replies) -------------------------------------------------------------
create table if not exists events.board_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic_id uuid not null references events.board_topics(id) on delete cascade,
  -- One level of nesting: always points at a top-level reply (enforced by trigger).
  parent_post_id uuid references events.board_posts(id) on delete cascade,
  author_kind text not null default 'member' check (author_kind in ('member', 'organiser')),
  author_member_id uuid references events.portal_members(id) on delete set null,
  author_user_id uuid,
  author_name text not null default '',
  author_email text not null default '',
  body text not null default '',
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  reaction_counts jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  published_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists board_posts_topic_idx
  on events.board_posts (topic_id, created_at)
  where deleted_at is null;
create index if not exists board_posts_project_idx
  on events.board_posts (project_id, status, created_at desc)
  where deleted_at is null;
create index if not exists board_posts_parent_idx
  on events.board_posts (parent_post_id)
  where parent_post_id is not null;

-- Q&A-style boards: the topic author (or an organiser) marks one reply as the answer.
alter table events.board_topics
  add column if not exists accepted_post_id uuid references events.board_posts(id) on delete set null;

-- Reactions (one per member per target) ------------------------------------------
create table if not exists events.board_reactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic_id uuid not null references events.board_topics(id) on delete cascade,
  -- null = a reaction on the topic itself.
  post_id uuid references events.board_posts(id) on delete cascade,
  member_id uuid references events.portal_members(id) on delete cascade,
  user_id uuid,
  kind text not null default 'like' check (kind ~ '^[a-z_]{2,24}$'),
  created_at timestamptz not null default now(),
  constraint board_reactions_one_identity check (
    (member_id is not null and user_id is null) or (member_id is null and user_id is not null)
  )
);

create unique index if not exists board_reactions_member_uidx
  on events.board_reactions (coalesce(post_id, topic_id), member_id)
  where member_id is not null;
create unique index if not exists board_reactions_user_uidx
  on events.board_reactions (coalesce(post_id, topic_id), user_id)
  where user_id is not null;
create index if not exists board_reactions_topic_idx
  on events.board_reactions (topic_id, post_id);

-- Reports ---------------------------------------------------------------------
create table if not exists events.board_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic_id uuid not null references events.board_topics(id) on delete cascade,
  post_id uuid references events.board_posts(id) on delete cascade,
  reporter_member_id uuid references events.portal_members(id) on delete set null,
  reporter_name text not null default '',
  reason text not null default 'other' check (reason in ('spam', 'abuse', 'off_topic', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists board_reports_open_uidx
  on events.board_reports (coalesce(post_id, topic_id), reporter_member_id)
  where status = 'open' and reporter_member_id is not null;
create index if not exists board_reports_project_idx
  on events.board_reports (project_id, status, created_at desc);

-- Subscriptions (reply notifications) --------------------------------------------
create table if not exists events.board_subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic_id uuid not null references events.board_topics(id) on delete cascade,
  member_id uuid not null references events.portal_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (topic_id, member_id)
);

create index if not exists board_subscriptions_member_idx
  on events.board_subscriptions (member_id);

-- Read markers (unread / new indicators) -----------------------------------------
create table if not exists events.board_reads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references events.portal_members(id) on delete cascade,
  target_kind text not null check (target_kind in ('board', 'topic')),
  -- A board or topic id (polymorphic, so no FK; stale rows are harmless).
  target_id uuid not null,
  read_at timestamptz not null default now(),
  unique (member_id, target_id)
);

-- Member notifications (portal feed + optional email) -----------------------------
create table if not exists events.board_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references events.portal_members(id) on delete cascade,
  board_id uuid references events.boards(id) on delete cascade,
  topic_id uuid references events.board_topics(id) on delete cascade,
  post_id uuid references events.board_posts(id) on delete cascade,
  kind text not null check (kind in ('topic_reply', 'post_reply', 'subscribed', 'accepted')),
  actor_name text not null default '',
  title text not null default '',
  body text not null default '',
  email_status text not null default 'skipped'
    check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  emailed_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists board_notifications_member_idx
  on events.board_notifications (member_id, created_at desc);
create index if not exists board_notifications_pending_idx
  on events.board_notifications (created_at)
  where email_status = 'pending';

-- Bans (posting restriction across a project's boards) -----------------------------
create table if not exists events.board_bans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references events.portal_members(id) on delete cascade,
  member_name text not null default '',
  member_email text not null default '',
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists board_bans_member_uidx
  on events.board_bans (project_id, member_id)
  where deleted_at is null;

-- Project-wide settings (edit window, banned words, notification defaults) -----------
create table if not exists events.board_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Touch triggers -----------------------------------------------------------------
drop trigger if exists boards_touch on events.boards;
create trigger boards_touch before update on events.boards
  for each row execute function events.touch_updated_at();
drop trigger if exists board_topics_touch on events.board_topics;
create trigger board_topics_touch before update on events.board_topics
  for each row execute function events.touch_updated_at();
drop trigger if exists board_posts_touch on events.board_posts;
create trigger board_posts_touch before update on events.board_posts
  for each row execute function events.touch_updated_at();
drop trigger if exists board_reports_touch on events.board_reports;
create trigger board_reports_touch before update on events.board_reports
  for each row execute function events.touch_updated_at();
drop trigger if exists board_bans_touch on events.board_bans;
create trigger board_bans_touch before update on events.board_bans
  for each row execute function events.touch_updated_at();
drop trigger if exists board_settings_touch on events.board_settings;
create trigger board_settings_touch before update on events.board_settings
  for each row execute function events.touch_updated_at();

-- Integrity: children inherit project from their parent; callers can't forge it ------
create or replace function events.board_topic_before()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.boards where id = new.board_id;
  if v_project is null then
    raise exception 'Board % not found', new.board_id;
  end if;
  new.project_id := v_project;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
    new.last_activity_at := greatest(new.last_activity_at, new.published_at);
  end if;
  if new.accepted_post_id is not null then
    if not exists (
      select 1 from events.board_posts where id = new.accepted_post_id and topic_id = new.id
    ) then
      raise exception 'The accepted answer must be a reply in this topic';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists board_topics_before on events.board_topics;
create trigger board_topics_before before insert or update on events.board_topics
  for each row execute function events.board_topic_before();

create or replace function events.board_post_before()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_parent uuid;
  v_parent_topic uuid;
begin
  select project_id into v_project from events.board_topics where id = new.topic_id;
  if v_project is null then
    raise exception 'Topic % not found', new.topic_id;
  end if;
  new.project_id := v_project;
  if new.parent_post_id is not null then
    select coalesce(parent_post_id, id), topic_id into v_parent, v_parent_topic
      from events.board_posts where id = new.parent_post_id;
    if v_parent is null or v_parent_topic <> new.topic_id then
      raise exception 'Parent reply not found in this topic';
    end if;
    if v_parent = new.id then
      v_parent := null;
    end if;
    new.parent_post_id := v_parent;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists board_posts_before on events.board_posts;
create trigger board_posts_before before insert or update on events.board_posts
  for each row execute function events.board_post_before();

-- Reactions + reports: derive topic from the post (when given) and project from the topic.
create or replace function events.board_target_before()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_topic uuid;
  v_project uuid;
begin
  if new.post_id is not null then
    select topic_id into v_topic from events.board_posts where id = new.post_id;
    if v_topic is null then
      raise exception 'Reply % not found', new.post_id;
    end if;
    new.topic_id := v_topic;
  end if;
  select project_id into v_project from events.board_topics where id = new.topic_id;
  if v_project is null then
    raise exception 'Topic % not found', new.topic_id;
  end if;
  new.project_id := v_project;
  return new;
end;
$$;

drop trigger if exists board_reactions_before on events.board_reactions;
create trigger board_reactions_before before insert or update on events.board_reactions
  for each row execute function events.board_target_before();
drop trigger if exists board_reports_before on events.board_reports;
create trigger board_reports_before before insert or update on events.board_reports
  for each row execute function events.board_target_before();

create or replace function events.board_subscription_before()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.board_topics where id = new.topic_id;
  if v_project is null then
    raise exception 'Topic % not found', new.topic_id;
  end if;
  new.project_id := v_project;
  return new;
end;
$$;

drop trigger if exists board_subscriptions_before on events.board_subscriptions;
create trigger board_subscriptions_before before insert or update on events.board_subscriptions
  for each row execute function events.board_subscription_before();

-- Counters ------------------------------------------------------------------------
create or replace function events.board_refresh_topic(p_topic uuid)
returns void
language sql
security definer
set search_path = events, public
as $$
  with s as (
    select count(*)::int as n,
      max(coalesce(p.published_at, p.created_at)) as last_at,
      (array_agg(p.author_name order by coalesce(p.published_at, p.created_at) desc))[1] as last_name
    from events.board_posts p
    where p.topic_id = p_topic and p.status = 'published' and p.deleted_at is null
  ),
  v as (
    select s.n,
      greatest(coalesce(t.published_at, t.created_at), coalesce(s.last_at, t.published_at, t.created_at)) as last_at,
      coalesce(s.last_name, '') as last_name
    from s, events.board_topics t
    where t.id = p_topic
  )
  update events.board_topics t
     set reply_count = v.n, last_activity_at = v.last_at, last_reply_name = v.last_name
    from v
   where t.id = p_topic
     and (t.reply_count, t.last_activity_at, t.last_reply_name) is distinct from (v.n, v.last_at, v.last_name);
$$;

create or replace function events.board_refresh_board(p_board uuid)
returns void
language sql
security definer
set search_path = events, public
as $$
  with s as (
    select count(*)::int as topics,
      coalesce(sum(reply_count), 0)::int as posts,
      max(last_activity_at) as last_at
    from events.board_topics
    where board_id = p_board and status = 'published' and deleted_at is null
  )
  update events.boards b
     set topic_count = s.topics, post_count = s.posts, last_activity_at = s.last_at
    from s
   where b.id = p_board
     and (b.topic_count, b.post_count, b.last_activity_at) is distinct from (s.topics, s.posts, s.last_at);
$$;

create or replace function events.board_refresh_reactions(p_topic uuid, p_post uuid)
returns void
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_counts jsonb;
  v_total integer;
begin
  select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb), coalesce(sum(n), 0)::int
    into v_counts, v_total
    from (
      select kind, count(*)::int as n
        from events.board_reactions
       where topic_id = p_topic and post_id is not distinct from p_post
       group by kind
    ) s;
  if p_post is null then
    update events.board_topics set reaction_counts = v_counts, score = v_total where id = p_topic;
  else
    update events.board_posts set reaction_counts = v_counts, score = v_total where id = p_post;
  end if;
end;
$$;

revoke all on function events.board_refresh_topic(uuid) from public, anon, authenticated;
revoke all on function events.board_refresh_board(uuid) from public, anon, authenticated;
revoke all on function events.board_refresh_reactions(uuid, uuid) from public, anon, authenticated;

create or replace function events.board_posts_after()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if tg_op = 'DELETE' then
    perform events.board_refresh_topic(old.topic_id);
    return old;
  end if;
  perform events.board_refresh_topic(new.topic_id);
  return new;
end;
$$;

drop trigger if exists board_posts_counts on events.board_posts;
create trigger board_posts_counts
  after insert or delete or update of status, deleted_at, published_at on events.board_posts
  for each row execute function events.board_posts_after();

create or replace function events.board_topics_after()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if tg_op = 'DELETE' then
    perform events.board_refresh_board(old.board_id);
    return old;
  end if;
  perform events.board_refresh_board(new.board_id);
  if tg_op = 'UPDATE' then
    if old.board_id is distinct from new.board_id then
      perform events.board_refresh_board(old.board_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists board_topics_counts on events.board_topics;
create trigger board_topics_counts
  after insert or delete or update of board_id, status, deleted_at, reply_count, last_activity_at
  on events.board_topics
  for each row execute function events.board_topics_after();

create or replace function events.board_reactions_after()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform events.board_refresh_reactions(old.topic_id, old.post_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform events.board_refresh_reactions(new.topic_id, new.post_id);
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists board_reactions_counts on events.board_reactions;
create trigger board_reactions_counts
  after insert or update or delete on events.board_reactions
  for each row execute function events.board_reactions_after();

-- Authors follow their own topics so replies reach them.
create or replace function events.board_topics_subscribe_author()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if new.author_member_id is not null then
    insert into events.board_subscriptions (project_id, topic_id, member_id)
    values (new.project_id, new.id, new.author_member_id)
    on conflict (topic_id, member_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists board_topics_subscribe on events.board_topics;
create trigger board_topics_subscribe
  after insert on events.board_topics
  for each row execute function events.board_topics_subscribe_author();

-- Notifications -------------------------------------------------------------------
-- A reply becoming visible notifies every subscriber except its author. Email is queued ('pending') when the member's
-- preference (portal_members.metadata.boardEmail), else the board setting, else the project default says so.
create or replace function events.board_posts_notify()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
begin
  if new.status <> 'published' or new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'published' then
      return new;
    end if;
  end if;

  insert into events.board_notifications
    (project_id, member_id, board_id, topic_id, post_id, kind, actor_name, title, body, email_status)
  select new.project_id, s.member_id, t.board_id, t.id, new.id,
    case
      when s.member_id = t.author_member_id then 'topic_reply'
      when pp.author_member_id is not null and s.member_id = pp.author_member_id then 'post_reply'
      else 'subscribed'
    end,
    new.author_name, t.title, left(new.body, 280),
    case
      when coalesce(
        case m.metadata ->> 'boardEmail' when 'true' then true when 'false' then false else null end,
        case b.email_notifications when 'on' then true when 'off' then false else null end,
        coalesce(bs.config ->> 'emailDefault', 'on') <> 'off'
      ) then 'pending'
      else 'skipped'
    end
  from events.board_subscriptions s
  join events.board_topics t on t.id = s.topic_id
  join events.boards b on b.id = t.board_id
  join events.portal_members m on m.id = s.member_id
  left join events.board_posts pp on pp.id = new.parent_post_id
  left join events.board_settings bs on bs.project_id = t.project_id
  where s.topic_id = new.topic_id
    and s.member_id is distinct from new.author_member_id
    and t.status = 'published'
    and t.deleted_at is null;

  return new;
end;
$$;

drop trigger if exists board_posts_notify on events.board_posts;
create trigger board_posts_notify
  after insert or update of status on events.board_posts
  for each row execute function events.board_posts_notify();

create or replace function events.board_topics_accepted()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_author uuid;
  v_body text;
begin
  if new.accepted_post_id is null or new.accepted_post_id is not distinct from old.accepted_post_id then
    return new;
  end if;
  select author_member_id, body into v_author, v_body
    from events.board_posts where id = new.accepted_post_id;
  if v_author is null or v_author is not distinct from new.author_member_id then
    return new;
  end if;
  insert into events.board_notifications
    (project_id, member_id, board_id, topic_id, post_id, kind, actor_name, title, body, email_status)
  values
    (new.project_id, v_author, new.board_id, new.id, new.accepted_post_id, 'accepted', '', new.title,
     left(coalesce(v_body, ''), 280), 'skipped');
  return new;
end;
$$;

drop trigger if exists board_topics_accepted on events.board_topics;
create trigger board_topics_accepted
  after update of accepted_post_id on events.board_topics
  for each row execute function events.board_topics_accepted();

-- RPCs ------------------------------------------------------------------------------
-- View counter bump for the portal topic view (service role only).
create or replace function events.board_topic_viewed(p_topic_id uuid)
returns void
language sql
security definer
set search_path = events, public
as $$
  update events.board_topics set view_count = view_count + 1
   where id = p_topic_id and deleted_at is null;
$$;

revoke all on function events.board_topic_viewed(uuid) from public, anon, authenticated;
grant execute on function events.board_topic_viewed(uuid) to service_role;

-- Dashboard stats; security invoker so RLS scopes every count to projects the caller can access.
create or replace function events.board_stats(p_project_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = events, public
as $$
  -- Only topics on boards that still exist count.
  with live as (
    select t.id, t.status, t.author_member_id, t.created_at
      from events.board_topics t
      join events.boards b on b.id = t.board_id
     where t.project_id = p_project_id and t.deleted_at is null and b.deleted_at is null
  ),
  replies as (
    select p.status, p.author_member_id, p.created_at
      from events.board_posts p
      join live on live.id = p.topic_id
     where p.deleted_at is null
  )
  select jsonb_build_object(
    'boards', (select count(*) from events.boards
                where project_id = p_project_id and deleted_at is null and not archived),
    'topics', (select count(*) from live where status = 'published'),
    'pendingTopics', (select count(*) from live where status = 'pending'),
    'pendingPosts', (select count(*) from replies where status = 'pending'),
    'postsThisWeek', (select count(*) from replies
                       where status = 'published' and created_at > now() - interval '7 days')
                   + (select count(*) from live
                       where status = 'published' and created_at > now() - interval '7 days'),
    'activeMembers', (select count(distinct a.member_id) from (
                       select author_member_id as member_id from live where created_at > now() - interval '30 days'
                       union all
                       select author_member_id from replies where created_at > now() - interval '30 days'
                     ) a where a.member_id is not null),
    'openReports', (select count(*) from events.board_reports r
                     join live on live.id = r.topic_id
                    where r.status = 'open')
  );
$$;

revoke all on function events.board_stats(uuid) from public, anon;
grant execute on function events.board_stats(uuid) to authenticated, service_role;

-- RLS + grants ------------------------------------------------------------------------
alter table events.boards enable row level security;
alter table events.board_topics enable row level security;
alter table events.board_posts enable row level security;
alter table events.board_reactions enable row level security;
alter table events.board_reports enable row level security;
alter table events.board_subscriptions enable row level security;
alter table events.board_reads enable row level security;
alter table events.board_notifications enable row level security;
alter table events.board_bans enable row level security;
alter table events.board_settings enable row level security;

drop policy if exists boards_member_all on events.boards;
create policy boards_member_all on events.boards
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_topics_member_all on events.board_topics;
create policy board_topics_member_all on events.board_topics
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_posts_member_all on events.board_posts;
create policy board_posts_member_all on events.board_posts
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_reactions_member_all on events.board_reactions;
create policy board_reactions_member_all on events.board_reactions
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_reports_member_all on events.board_reports;
create policy board_reports_member_all on events.board_reports
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_subscriptions_member_all on events.board_subscriptions;
create policy board_subscriptions_member_all on events.board_subscriptions
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_reads_member_all on events.board_reads;
create policy board_reads_member_all on events.board_reads
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_notifications_member_all on events.board_notifications;
create policy board_notifications_member_all on events.board_notifications
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_bans_member_all on events.board_bans;
create policy board_bans_member_all on events.board_bans
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists board_settings_member_all on events.board_settings;
create policy board_settings_member_all on events.board_settings
  for all to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

revoke all on events.boards, events.board_topics, events.board_posts, events.board_reactions,
  events.board_reports, events.board_subscriptions, events.board_reads, events.board_notifications,
  events.board_bans, events.board_settings
  from anon;

grant select, insert, update, delete on events.boards, events.board_topics, events.board_posts,
  events.board_reactions, events.board_reports, events.board_subscriptions, events.board_reads,
  events.board_notifications, events.board_bans, events.board_settings
  to authenticated, service_role;

-- @down
drop function if exists events.board_stats(uuid);
drop function if exists events.board_topic_viewed(uuid);
drop table if exists events.board_notifications;
drop table if exists events.board_reads;
drop table if exists events.board_subscriptions;
drop table if exists events.board_reports;
drop table if exists events.board_reactions;
drop table if exists events.board_bans;
drop table if exists events.board_settings;
drop trigger if exists board_topics_accepted on events.board_topics;
alter table if exists events.board_topics drop column if exists accepted_post_id;
drop table if exists events.board_posts;
drop table if exists events.board_topics;
drop table if exists events.boards;
drop function if exists events.board_topics_accepted();
drop function if exists events.board_posts_notify();
drop function if exists events.board_topics_subscribe_author();
drop function if exists events.board_reactions_after();
drop function if exists events.board_topics_after();
drop function if exists events.board_posts_after();
drop function if exists events.board_refresh_reactions(uuid, uuid);
drop function if exists events.board_refresh_board(uuid);
drop function if exists events.board_refresh_topic(uuid);
drop function if exists events.board_subscription_before();
drop function if exists events.board_target_before();
drop function if exists events.board_post_before();
drop function if exists events.board_topic_before();
