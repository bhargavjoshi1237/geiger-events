-- Workspace foundation: organiser-built objects, fields, records and links per event.
-- Definitions are rows; record values live in the jsonb data column keyed by field id. Only the service role can touch
-- these tables, and all writes go through events.workspace_command (next migration).
-- @up

create unique index if not exists workspace_events_event_project_uq on events.events (id, project_id);

create table if not exists events.workspace_workspaces (
  project_id uuid not null,
  event_id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  created_from jsonb not null default '{"kind":"empty"}'::jsonb check (jsonb_typeof(created_from) = 'object'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, event_id),
  foreign key (event_id, project_id) references events.events (id, project_id) on delete cascade
);

create table if not exists events.workspace_objects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  name text not null check (length(name) between 1 and 100),
  plural text not null check (length(plural) between 1 and 100),
  icon text not null default 'database' check (icon ~ '^[a-z0-9-]{1,40}$'),
  title_field_id uuid,
  statuses jsonb not null default '[]'::jsonb check (jsonb_typeof(statuses) = 'array'),
  number_prefix text not null check (number_prefix ~ '^[A-Z0-9]{1,6}$'),
  next_number bigint not null default 1 check (next_number > 0),
  position integer not null default 0,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, event_id, key),
  unique (project_id, event_id, id),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  object_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  name text not null check (length(name) between 1 and 100),
  type text not null check (type in (
    'short_text','long_text','rich_text','email','phone','url',
    'number','currency','percent','rating',
    'single_select','multi_select','checkbox',
    'date','datetime','duration',
    'link_record','link_event','attachments',
    'formula','lookup','rollup')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  required boolean not null default false,
  is_unique boolean not null default false,
  position integer not null default 0,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (object_id, key),
  unique (project_id, event_id, id),
  foreign key (project_id, event_id, object_id) references events.workspace_objects (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  object_id uuid not null,
  number bigint not null check (number > 0),
  title text check (title is null or length(title) <= 200),
  status text,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1100000),
  search tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    jsonb_to_tsvector('simple'::regconfig, data, '["string","numeric"]'::jsonb)
  ) stored,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (object_id, number),
  unique (project_id, event_id, id),
  foreign key (project_id, event_id, object_id) references events.workspace_objects (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_links (
  project_id uuid not null,
  event_id uuid not null,
  source_record_id uuid not null,
  field_id uuid not null references events.workspace_fields (id) on delete cascade,
  target_kind text not null check (target_kind in ('record','contact','order','ticket','team_member','venue_space')),
  target_id uuid not null,
  position integer not null default 0,
  primary key (source_record_id, field_id, target_kind, target_id),
  foreign key (project_id, event_id, source_record_id) references events.workspace_records (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_unique_values (
  project_id uuid not null,
  event_id uuid not null,
  field_id uuid not null references events.workspace_fields (id) on delete cascade,
  value_hash text not null,
  record_id uuid not null,
  primary key (field_id, value_hash),
  foreign key (project_id, event_id, record_id) references events.workspace_records (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  field_id uuid not null,
  path text not null unique,
  name text not null check (length(name) between 1 and 255),
  type text not null default 'application/octet-stream',
  size bigint not null check (size >= 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  record_id uuid not null,
  body text not null check (length(body) between 1 and 5000),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (project_id, event_id, record_id) references events.workspace_records (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_saved_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  object_id uuid not null,
  name text not null check (length(name) between 1 and 60),
  owner_id uuid,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 65536),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, event_id, object_id) references events.workspace_objects (project_id, event_id, id) on delete cascade
);

create table if not exists events.workspace_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  actor_id uuid not null,
  kind text not null check (kind in ('record','structure')),
  action text not null,
  object_id uuid,
  field_id uuid,
  record_id uuid,
  before jsonb,
  after jsonb,
  undo_of uuid,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_command_receipts (
  project_id uuid not null,
  event_id uuid not null,
  actor_id uuid not null,
  command_id uuid not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (project_id, event_id, actor_id, command_id),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events.workspace_copy_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  status text not null default 'running' check (status in ('running','done','failed')),
  progress jsonb not null default '{}'::jsonb,
  id_map jsonb not null default '{}'::jsonb,
  cursor jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create index if not exists workspace_objects_event_idx on events.workspace_objects (project_id, event_id, position);
create index if not exists workspace_fields_object_idx on events.workspace_fields (object_id, position);
create index if not exists workspace_records_list_idx on events.workspace_records (project_id, event_id, object_id, status, updated_at desc) where deleted_at is null;
create index if not exists workspace_records_deleted_idx on events.workspace_records (object_id, deleted_at) where deleted_at is not null;
create index if not exists workspace_records_data_idx on events.workspace_records using gin (data jsonb_path_ops);
create index if not exists workspace_records_search_idx on events.workspace_records using gin (search);
create index if not exists workspace_links_target_idx on events.workspace_links (target_kind, target_id);
create index if not exists workspace_links_field_idx on events.workspace_links (field_id);
create index if not exists workspace_unique_record_idx on events.workspace_unique_values (record_id);
create index if not exists workspace_files_field_idx on events.workspace_files (field_id);
create index if not exists workspace_comments_record_idx on events.workspace_comments (record_id, created_at);
create index if not exists workspace_views_object_idx on events.workspace_saved_views (object_id, position);
create index if not exists workspace_changes_event_idx on events.workspace_changes (project_id, event_id, created_at desc);
create index if not exists workspace_changes_record_idx on events.workspace_changes (record_id, created_at desc) where record_id is not null;
create index if not exists workspace_templates_project_idx on events.workspace_templates (project_id, updated_at desc);
create index if not exists workspace_copy_jobs_running_idx on events.workspace_copy_jobs (status, updated_at) where status = 'running';

do $$
declare t text;
begin
  foreach t in array array['workspace_workspaces','workspace_objects','workspace_fields','workspace_records',
    'workspace_links','workspace_unique_values','workspace_files','workspace_comments','workspace_saved_views',
    'workspace_changes','workspace_command_receipts','workspace_templates','workspace_copy_jobs'] loop
    execute format('alter table events.%I enable row level security', t);
    execute format('revoke all on events.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on events.%I to service_role', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace', 'workspace', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- A staff member may act when they belong to the project and hold a role granting the key for this event.
create or replace function events.workspace_can(p_project uuid, p_event uuid, p_actor uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.projects p
      where p.id = p_project and (
        (p.organization_id is null and p.created_by = p_actor) or
        exists (select 1 from public.organization_users m where m.organization = p.organization_id and m."user" = p_actor)))
    and exists (
      select 1 from events.role_grants g join public.roles r on r.id = g.role_id
      where g.project_id = p_project and g.user_id = p_actor and g.status = 'active' and g.deleted_at is null
        and r.project_id = p_project and r.deleted_at is null
        and public.rbac_key_matches(r.permissions, p_permission)
        and (not (g.scope ? 'event') or (g.scope -> 'event') ? p_event::text));
$$;
revoke all on function events.workspace_can(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function events.workspace_can(uuid, uuid, uuid, text) to service_role;

-- @down
drop function if exists events.workspace_can(uuid, uuid, uuid, text);
drop table if exists events.workspace_copy_jobs, events.workspace_templates, events.workspace_command_receipts,
  events.workspace_changes, events.workspace_saved_views, events.workspace_comments, events.workspace_files,
  events.workspace_unique_values, events.workspace_links, events.workspace_records, events.workspace_fields,
  events.workspace_objects, events.workspace_workspaces cascade;
drop index if exists events.workspace_events_event_project_uq;
