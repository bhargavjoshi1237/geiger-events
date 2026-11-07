-- @up
-- Event Design collaboration: tokenised share links (only a sha256 of the token is stored), canvas comments and version history.
-- Guests reach a shared plan at /plan/<token> without an account, solely through the floor_plan_public_* definer functions.

create schema if not exists events;

-- Display name of the signed-in caller from the request JWT ('' for anon / service role).
create or replace function events.floor_plan_actor_name()
returns text
language sql
stable
set search_path = events, public
as $$
  select coalesce(
    nullif(btrim(c->'user_metadata'->>'full_name'), ''),
    nullif(btrim(c->'user_metadata'->>'name'), ''),
    nullif(split_part(coalesce(c->>'email', ''), '@', 1), ''),
    ''
  )
  from (select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb as c) claims;
$$;

-- Child rows take project_id from their plan, so a link or comment can never point across projects.
create or replace function events.floor_plan_child_project()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.floor_plans where id = new.floor_plan_id;
  if v_project is null then
    raise exception 'FLOOR_PLAN_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;
  new.project_id := v_project;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Share links
-- ---------------------------------------------------------------------------

create table if not exists events.floor_plan_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_id uuid not null references events.floor_plans(id) on delete cascade,
  -- Who the link is for ("Caterer", "Venue", "Client").
  label text not null default '' check (char_length(label) <= 80),
  permission text not null default 'view' check (permission in ('view', 'comment')),
  -- sha256 hex of the link token; the raw token is returned once, by floor_plan_share_create / _reissue.
  token_hash text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  -- Throttles the "new guest comment" email to one per link per 15 minutes.
  last_notified_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists floor_plan_shares_token_idx
  on events.floor_plan_shares (token_hash);
create index if not exists floor_plan_shares_plan_idx
  on events.floor_plan_shares (floor_plan_id, created_at desc)
  where deleted_at is null;
create index if not exists floor_plan_shares_project_idx
  on events.floor_plan_shares (project_id, created_at desc)
  where deleted_at is null;

drop trigger if exists floor_plan_shares_project on events.floor_plan_shares;
create trigger floor_plan_shares_project
  before insert or update of floor_plan_id, project_id on events.floor_plan_shares
  for each row execute function events.floor_plan_child_project();

drop trigger if exists floor_plan_shares_touch on events.floor_plan_shares;
create trigger floor_plan_shares_touch
  before update on events.floor_plan_shares
  for each row execute function events.touch_updated_at();

alter table events.floor_plan_shares enable row level security;

drop policy if exists floor_plan_shares_member_all on events.floor_plan_shares;
create policy floor_plan_shares_member_all on events.floor_plan_shares
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.floor_plan_shares to authenticated;

-- Append-only view log (one row per counted open) — powers "views this week".
create table if not exists events.floor_plan_share_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  share_id uuid not null references events.floor_plan_shares(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists floor_plan_share_views_project_idx
  on events.floor_plan_share_views (project_id, created_at desc);
create index if not exists floor_plan_share_views_share_idx
  on events.floor_plan_share_views (share_id, created_at desc);

alter table events.floor_plan_share_views enable row level security;

drop policy if exists floor_plan_share_views_member_read on events.floor_plan_share_views;
create policy floor_plan_share_views_member_read on events.floor_plan_share_views
  for select
  to authenticated
  using (events.can_access_project(project_id));

grant select on events.floor_plan_share_views to authenticated;

-- ---------------------------------------------------------------------------
-- Comments (pins on the canvas, one level of replies)
-- ---------------------------------------------------------------------------

create table if not exists events.floor_plan_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_id uuid not null references events.floor_plans(id) on delete cascade,
  parent_id uuid references events.floor_plan_comments(id) on delete cascade,
  -- Pin position in plan metres (null = a general comment); item_id = the placed object it was dropped on.
  x_m numeric(9, 3),
  y_m numeric(9, 3),
  item_id text check (item_id is null or char_length(item_id) <= 64),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  -- Team-only threads never reach share links.
  internal boolean not null default false,
  author_kind text not null default 'member' check (author_kind in ('member', 'guest')),
  author_id uuid,
  author_name text not null default '' check (char_length(author_name) <= 120),
  share_id uuid references events.floor_plan_shares(id) on delete set null,
  -- The plan version the comment was written against.
  plan_version integer,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists floor_plan_comments_plan_idx
  on events.floor_plan_comments (floor_plan_id, created_at)
  where deleted_at is null;
create index if not exists floor_plan_comments_project_idx
  on events.floor_plan_comments (project_id, created_at desc)
  where deleted_at is null;
create index if not exists floor_plan_comments_parent_idx
  on events.floor_plan_comments (parent_id)
  where parent_id is not null;
create index if not exists floor_plan_comments_share_idx
  on events.floor_plan_comments (share_id, created_at desc)
  where share_id is not null;

-- Project from the plan; replies hang off the thread root, inherit its visibility and carry no pin; members are stamped as the author.
create or replace function events.floor_plan_comment_prepare()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  v_root events.floor_plan_comments;
begin
  select project_id into v_project from events.floor_plans where id = new.floor_plan_id;
  if v_project is null then
    raise exception 'FLOOR_PLAN_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;
  new.project_id := v_project;

  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    select * into v_root from events.floor_plan_comments where id = new.parent_id;
    if v_root.id is null or v_root.floor_plan_id <> new.floor_plan_id then
      raise exception 'COMMENT_PARENT_INVALID' using errcode = 'check_violation';
    end if;
    if v_root.parent_id is not null then
      new.parent_id := v_root.parent_id;
      select * into v_root from events.floor_plan_comments where id = new.parent_id;
    end if;
    new.internal := v_root.internal;
    new.x_m := null;
    new.y_m := null;
    new.item_id := null;
  end if;

  if tg_op = 'INSERT' and new.author_kind = 'member' and auth.uid() is not null then
    new.author_id := auth.uid();
    if btrim(coalesce(new.author_name, '')) = '' then
      new.author_name := left(events.floor_plan_actor_name(), 120);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists floor_plan_comments_prepare on events.floor_plan_comments;
create trigger floor_plan_comments_prepare
  before insert or update of floor_plan_id, project_id, parent_id on events.floor_plan_comments
  for each row execute function events.floor_plan_comment_prepare();

drop trigger if exists floor_plan_comments_touch on events.floor_plan_comments;
create trigger floor_plan_comments_touch
  before update on events.floor_plan_comments
  for each row execute function events.touch_updated_at();

alter table events.floor_plan_comments enable row level security;

drop policy if exists floor_plan_comments_member_all on events.floor_plan_comments;
create policy floor_plan_comments_member_all on events.floor_plan_comments
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.floor_plan_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Version history — written by a trigger whenever floor_plans.version changes
-- ---------------------------------------------------------------------------

create table if not exists events.floor_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_id uuid not null references events.floor_plans(id) on delete cascade,
  version integer not null check (version >= 1),
  -- {name, widthM, lengthM, unit, outline, setupStyle, objects} as saved.
  snapshot jsonb not null default '{}'::jsonb,
  object_count integer not null default 0,
  seat_count integer not null default 0,
  note text not null default '' check (char_length(note) <= 500),
  -- Set when this version was created by restoring an older one.
  restored_from integer,
  created_by uuid,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists floor_plan_versions_plan_version_idx
  on events.floor_plan_versions (floor_plan_id, version);
create index if not exists floor_plan_versions_project_idx
  on events.floor_plan_versions (project_id, created_at desc);

drop trigger if exists floor_plan_versions_touch on events.floor_plan_versions;
create trigger floor_plan_versions_touch
  before update on events.floor_plan_versions
  for each row execute function events.touch_updated_at();

alter table events.floor_plan_versions enable row level security;

drop policy if exists floor_plan_versions_member_read on events.floor_plan_versions;
create policy floor_plan_versions_member_read on events.floor_plan_versions
  for select
  to authenticated
  using (events.can_access_project(project_id));

drop policy if exists floor_plan_versions_member_note on events.floor_plan_versions;
create policy floor_plan_versions_member_note on events.floor_plan_versions
  for update
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- Snapshots are written only by the trigger; members may annotate (note) and mark restores.
grant select on events.floor_plan_versions to authenticated;
grant update (note, restored_from) on events.floor_plan_versions to authenticated;

create or replace function events.floor_plan_record_version()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_objects jsonb := case when jsonb_typeof(new.objects) = 'array' then new.objects else '[]'::jsonb end;
begin
  if tg_op = 'UPDATE' and new.version is not distinct from old.version then
    return new;
  end if;

  insert into events.floor_plan_versions
    (project_id, floor_plan_id, version, snapshot, object_count, seat_count, created_by, author_name)
  values (
    new.project_id,
    new.id,
    new.version,
    jsonb_build_object(
      'name', new.name,
      'widthM', new.width_m,
      'lengthM', new.length_m,
      'unit', new.unit,
      'outline', new.outline,
      'setupStyle', new.setup_style,
      'objects', v_objects
    ),
    jsonb_array_length(v_objects),
    coalesce((
      select sum(greatest(0, floor((o->>'seats')::numeric)))::integer
      from jsonb_array_elements(v_objects) as o
      where jsonb_typeof(o->'seats') = 'number'
    ), 0),
    coalesce(auth.uid(), case when tg_op = 'INSERT' then new.created_by end),
    left(events.floor_plan_actor_name(), 120)
  )
  on conflict (floor_plan_id, version) do update set
    snapshot = excluded.snapshot,
    object_count = excluded.object_count,
    seat_count = excluded.seat_count,
    created_by = excluded.created_by,
    author_name = excluded.author_name,
    note = '',
    restored_from = null,
    created_at = now();

  -- Keep the newest 100 versions per plan.
  delete from events.floor_plan_versions
    where floor_plan_id = new.id and version <= new.version - 100;
  return new;
end;
$$;

drop trigger if exists floor_plans_record_version on events.floor_plans;
create trigger floor_plans_record_version
  after insert or update of version on events.floor_plans
  for each row execute function events.floor_plan_record_version();

-- Baseline: every existing plan starts its history at its current version.
insert into events.floor_plan_versions
  (project_id, floor_plan_id, version, snapshot, object_count, seat_count, created_by, created_at)
select
  p.project_id,
  p.id,
  p.version,
  jsonb_build_object(
    'name', p.name,
    'widthM', p.width_m,
    'lengthM', p.length_m,
    'unit', p.unit,
    'outline', p.outline,
    'setupStyle', p.setup_style,
    'objects', case when jsonb_typeof(p.objects) = 'array' then p.objects else '[]'::jsonb end
  ),
  case when jsonb_typeof(p.objects) = 'array' then jsonb_array_length(p.objects) else 0 end,
  coalesce((
    select sum(greatest(0, floor((o->>'seats')::numeric)))::integer
    from jsonb_array_elements(case when jsonb_typeof(p.objects) = 'array' then p.objects else '[]'::jsonb end) as o
    where jsonb_typeof(o->'seats') = 'number'
  ), 0),
  p.created_by,
  p.updated_at
from events.floor_plans p
where p.deleted_at is null
on conflict (floor_plan_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- Member RPCs: links are minted here so the raw token exists only in the response
-- ---------------------------------------------------------------------------

create or replace function events.floor_plan_new_token()
returns text
language sql
volatile
set search_path = events, public
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Runs as the caller, so RLS decides which plans they may share.
create or replace function events.floor_plan_share_create(
  p_plan uuid,
  p_label text,
  p_permission text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = events, public
as $$
declare
  v_token text := events.floor_plan_new_token();
  v_share events.floor_plan_shares;
begin
  insert into events.floor_plan_shares (project_id, floor_plan_id, label, permission, token_hash, expires_at, created_by)
  select
    p.project_id,
    p.id,
    left(btrim(coalesce(p_label, '')), 80),
    case when p_permission = 'comment' then 'comment' else 'view' end,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    p_expires_at,
    auth.uid()
  from events.floor_plans p
  where p.id = p_plan and p.deleted_at is null
  returning * into v_share;

  if v_share.id is null then
    raise exception 'FLOOR_PLAN_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object('share', to_jsonb(v_share) - 'token_hash', 'token', v_token);
end;
$$;

-- A fresh address for an existing link; the old address stops working immediately.
create or replace function events.floor_plan_share_reissue(p_share uuid)
returns jsonb
language plpgsql
security invoker
set search_path = events, public
as $$
declare
  v_token text := events.floor_plan_new_token();
  v_share events.floor_plan_shares;
begin
  update events.floor_plan_shares
    set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex')
    where id = p_share and deleted_at is null
    returning * into v_share;
  if v_share.id is null then
    raise exception 'SHARE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object('share', to_jsonb(v_share) - 'token_hash', 'token', v_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- Token-gated public surface
-- ---------------------------------------------------------------------------

-- The share a raw link token belongs to (in any state), or a null row.
create or replace function events.floor_plan_share_by_token(p_token text)
returns events.floor_plan_shares
language sql
stable
security definer
set search_path = events, public
as $$
  select s.*
  from events.floor_plan_shares s
  where p_token ~ '^[A-Za-z0-9_-]{32,128}$'
    and s.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and s.deleted_at is null
  limit 1;
$$;

-- active | revoked | expired | not_found.
create or replace function events.floor_plan_share_state(p_share events.floor_plan_shares)
returns text
language sql
stable
set search_path = events, public
as $$
  select case
    when p_share.id is null then 'not_found'
    when p_share.revoked_at is not null then 'revoked'
    when p_share.expires_at is not null and p_share.expires_at <= now() then 'expired'
    else 'active'
  end;
$$;

-- A comment as guests see it (no author ids, no link labels).
create or replace function events.floor_plan_comment_public_json(p_comment events.floor_plan_comments)
returns jsonb
language sql
stable
set search_path = events, public
as $$
  select jsonb_build_object(
    'id', p_comment.id,
    'parentId', p_comment.parent_id,
    'xM', p_comment.x_m,
    'yM', p_comment.y_m,
    'itemId', p_comment.item_id,
    'body', p_comment.body,
    'authorKind', p_comment.author_kind,
    'authorName', p_comment.author_name,
    'planVersion', p_comment.plan_version,
    'resolvedAt', p_comment.resolved_at,
    'createdAt', p_comment.created_at
  );
$$;

-- The shared plan: geometry, where it is, and (comment links only) the non-internal threads. No internal notes.
create or replace function events.floor_plan_public_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = events, public
as $$
declare
  v_share events.floor_plan_shares := events.floor_plan_share_by_token(p_token);
  v_state text := events.floor_plan_share_state(v_share);
  v_plan events.floor_plans;
  v_venue text;
  v_space text;
  v_space_height numeric;
  v_event text;
  v_event_date date;
  v_org text;
  v_comments jsonb := '[]'::jsonb;
begin
  if v_state <> 'active' then
    return jsonb_build_object('ok', false, 'reason', v_state);
  end if;
  select * into v_plan from events.floor_plans where id = v_share.floor_plan_id and deleted_at is null;
  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Linked rows only count when they belong to the plan's own project, so a link can't surface another project's names.
  select v.name into v_venue from events.venues v
    where v.id = v_plan.venue_id and v.project_id = v_plan.project_id and v.deleted_at is null;
  select s.name, s.height_m into v_space, v_space_height
    from events.venue_spaces s
    where s.id = v_plan.venue_space_id and s.project_id = v_plan.project_id and s.deleted_at is null;
  select e.name, e.event_date into v_event, v_event_date
    from events.events e
    where e.id = v_plan.event_id and e.project_id = v_plan.project_id and e.deleted_at is null;
  select p.name into v_org from public.projects p where p.id = v_plan.project_id;

  if v_share.permission = 'comment' then
    select coalesce(jsonb_agg(events.floor_plan_comment_public_json(c) order by c.created_at), '[]'::jsonb)
      into v_comments
      from events.floor_plan_comments c
      where c.floor_plan_id = v_plan.id and c.deleted_at is null and not c.internal;
  end if;

  return jsonb_build_object(
    'ok', true,
    'share', jsonb_build_object(
      'label', v_share.label,
      'permission', v_share.permission,
      'expiresAt', v_share.expires_at
    ),
    'plan', jsonb_build_object(
      'name', v_plan.name,
      'kind', v_plan.kind,
      'status', v_plan.status,
      'widthM', v_plan.width_m,
      'lengthM', v_plan.length_m,
      'unit', v_plan.unit,
      'outline', v_plan.outline,
      'setupStyle', v_plan.setup_style,
      'objects', v_plan.objects,
      'version', v_plan.version,
      'updatedAt', v_plan.updated_at,
      'venueName', coalesce(v_venue, ''),
      'spaceName', coalesce(v_space, ''),
      'spaceHeightM', v_space_height,
      'eventName', coalesce(v_event, ''),
      'eventDate', v_event_date,
      'organizerName', coalesce(v_org, '')
    ),
    'comments', v_comments
  );
end;
$$;

-- Counts an open of the link (at most once per 30 seconds per link, so reload storms don't inflate it).
create or replace function events.floor_plan_public_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_share events.floor_plan_shares := events.floor_plan_share_by_token(p_token);
  v_state text := events.floor_plan_share_state(v_share);
begin
  if v_state <> 'active' then
    return jsonb_build_object('ok', false, 'reason', v_state);
  end if;
  if v_share.last_viewed_at is not null and v_share.last_viewed_at > now() - interval '30 seconds' then
    return jsonb_build_object('ok', true, 'counted', false);
  end if;
  update events.floor_plan_shares
    set view_count = view_count + 1, last_viewed_at = now()
    where id = v_share.id;
  insert into events.floor_plan_share_views (project_id, share_id) values (v_share.project_id, v_share.id);
  return jsonb_build_object('ok', true, 'counted', true);
end;
$$;

-- A guest comment or reply through a comment link. Validates length, position and parent; rate-guarded per link and per plan.
create or replace function events.floor_plan_public_comment(
  p_token text,
  p_name text,
  p_body text,
  p_x numeric,
  p_y numeric,
  p_item_id text,
  p_parent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_share events.floor_plan_shares := events.floor_plan_share_by_token(p_token);
  v_state text := events.floor_plan_share_state(v_share);
  v_plan events.floor_plans;
  v_parent events.floor_plan_comments;
  v_parent_id uuid;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_body text := btrim(coalesce(p_body, ''));
  v_item text := nullif(left(btrim(coalesce(p_item_id, '')), 64), '');
  v_x numeric;
  v_y numeric;
  v_recent integer;
  v_comment events.floor_plan_comments;
  v_notify boolean := false;
begin
  if v_state <> 'active' then
    return jsonb_build_object('ok', false, 'reason', v_state);
  end if;
  if v_share.permission <> 'comment' then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'message', 'This link is view-only.');
  end if;
  if char_length(v_name) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Add your name so the team knows who wrote it.');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Comments are 1 to 2,000 characters.');
  end if;

  select * into v_plan from events.floor_plans where id = v_share.floor_plan_id and deleted_at is null;
  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select count(*) into v_recent from events.floor_plan_comments
    where share_id = v_share.id and created_at > now() - interval '10 minutes';
  if v_recent >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'message', 'That''s a lot of comments in a short time — try again in a few minutes.');
  end if;
  select count(*) into v_recent from events.floor_plan_comments
    where floor_plan_id = v_plan.id and author_kind = 'guest' and created_at > now() - interval '1 hour';
  if v_recent >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'message', 'This plan is taking too many comments right now — try again later.');
  end if;

  if p_parent_id is not null then
    select * into v_parent from events.floor_plan_comments
      where id = p_parent_id and floor_plan_id = v_plan.id and deleted_at is null and not internal;
    if v_parent.id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'That thread is no longer there.');
    end if;
    v_parent_id := coalesce(v_parent.parent_id, v_parent.id);
  else
    -- Pins must land on (or near) the drawing; anything else becomes a general comment.
    if p_x is not null and p_y is not null and p_x between -50 and 550 and p_y between -50 and 550 then
      v_x := round(p_x, 3);
      v_y := round(p_y, 3);
    end if;
    if v_item is not null and not exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(v_plan.objects) = 'array' then v_plan.objects else '[]'::jsonb end
      ) as o where o->>'id' = v_item
    ) then
      v_item := null;
    end if;
  end if;

  insert into events.floor_plan_comments
    (project_id, floor_plan_id, parent_id, x_m, y_m, item_id, body, internal, author_kind, author_name, share_id, plan_version)
  values
    (v_plan.project_id, v_plan.id, v_parent_id, v_x, v_y, case when v_parent_id is null then v_item end,
     v_body, false, 'guest', v_name, v_share.id, v_plan.version)
  returning * into v_comment;

  if v_share.last_notified_at is null or v_share.last_notified_at < now() - interval '15 minutes' then
    update events.floor_plan_shares set last_notified_at = now() where id = v_share.id;
    v_notify := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'comment', events.floor_plan_comment_public_json(v_comment),
    'notify', v_notify
  );
end;
$$;

revoke all on function events.floor_plan_actor_name() from public, anon, authenticated;
revoke all on function events.floor_plan_child_project() from public, anon, authenticated;
revoke all on function events.floor_plan_comment_prepare() from public, anon, authenticated;
revoke all on function events.floor_plan_record_version() from public, anon, authenticated;
revoke all on function events.floor_plan_new_token() from public, anon, authenticated;
revoke all on function events.floor_plan_share_create(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function events.floor_plan_share_reissue(uuid) from public, anon, authenticated;
revoke all on function events.floor_plan_share_by_token(text) from public, anon, authenticated;
revoke all on function events.floor_plan_share_state(events.floor_plan_shares) from public, anon, authenticated;
revoke all on function events.floor_plan_comment_public_json(events.floor_plan_comments) from public, anon, authenticated;
revoke all on function events.floor_plan_public_get(text) from public, anon, authenticated;
revoke all on function events.floor_plan_public_view(text) from public, anon, authenticated;
revoke all on function events.floor_plan_public_comment(text, text, text, numeric, numeric, text, uuid) from public, anon, authenticated;

grant execute on function events.floor_plan_actor_name() to authenticated;
grant execute on function events.floor_plan_new_token() to authenticated;
grant execute on function events.floor_plan_share_create(uuid, text, text, timestamptz) to authenticated;
grant execute on function events.floor_plan_share_reissue(uuid) to authenticated;
grant execute on function events.floor_plan_public_get(text) to anon, authenticated;
grant execute on function events.floor_plan_public_view(text) to anon, authenticated;
grant execute on function events.floor_plan_public_comment(text, text, text, numeric, numeric, text, uuid) to anon, authenticated;

-- @down
drop function if exists events.floor_plan_public_comment(text, text, text, numeric, numeric, text, uuid);
drop function if exists events.floor_plan_public_view(text);
drop function if exists events.floor_plan_public_get(text);
drop function if exists events.floor_plan_comment_public_json(events.floor_plan_comments);
drop function if exists events.floor_plan_share_state(events.floor_plan_shares);
drop function if exists events.floor_plan_share_by_token(text);
drop function if exists events.floor_plan_share_reissue(uuid);
drop function if exists events.floor_plan_share_create(uuid, text, text, timestamptz);
drop function if exists events.floor_plan_new_token();
drop trigger if exists floor_plans_record_version on events.floor_plans;
drop function if exists events.floor_plan_record_version();
drop table if exists events.floor_plan_versions;
drop table if exists events.floor_plan_comments;
drop function if exists events.floor_plan_comment_prepare();
drop table if exists events.floor_plan_share_views;
drop table if exists events.floor_plan_shares;
drop function if exists events.floor_plan_child_project();
drop function if exists events.floor_plan_actor_name();
