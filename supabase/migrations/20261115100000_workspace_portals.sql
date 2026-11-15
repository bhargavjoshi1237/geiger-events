-- Workspace portals: organiser-built pages and roles for people outside the team. Configuration rows are edited through
-- events.workspace_portal_config (staff, configure) and frozen into numbered versions on publish. Portal reads add a
-- compiled role policy to events.workspace_query; portal writes go through events.workspace_portal_command, which
-- re-checks the role rules before and after the change. Only the service role can reach any of it.
-- @up

-- Who made a change: staff (dashboard) or portal (an outside person). Portal functions set workspace.actor_kind.
alter table events.workspace_changes add column if not exists actor_kind text not null
  default coalesce(nullif(current_setting('workspace.actor_kind', true), ''), 'staff');
alter table events.workspace_comments add column if not exists actor_kind text not null
  default coalesce(nullif(current_setting('workspace.actor_kind', true), ''), 'staff');
alter table events.workspace_command_receipts add column if not exists actor_kind text not null
  default coalesce(nullif(current_setting('workspace.actor_kind', true), ''), 'staff');
do $$
begin
  alter table events.workspace_changes add constraint workspace_changes_actor_kind_check check (actor_kind in ('staff', 'portal'));
  alter table events.workspace_comments add constraint workspace_comments_actor_kind_check check (actor_kind in ('staff', 'portal'));
  alter table events.workspace_command_receipts add constraint workspace_receipts_actor_kind_check check (actor_kind in ('staff', 'portal'));
exception when duplicate_object then null;
end $$;
alter table events.workspace_command_receipts drop constraint if exists workspace_command_receipts_pkey;
alter table events.workspace_command_receipts add constraint workspace_command_receipts_pkey
  primary key (project_id, event_id, actor_kind, actor_id, command_id);

create table if not exists events.workspace_portals (
  project_id uuid not null,
  event_id uuid not null,
  enabled boolean not null default false,
  people_object_id uuid,
  email_field_id uuid,
  name_field_id uuid,
  signup_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 65536),
  published_version_id uuid,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, event_id),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  name text not null check (length(name) between 1 and 60),
  icon text not null default 'user' check (length(icon) <= 60),
  color text not null default 'gray' check (length(color) <= 20),
  builtin boolean not null default false,
  membership jsonb check (membership is null or jsonb_typeof(membership) = 'object'),
  access jsonb not null default '{}'::jsonb check (jsonb_typeof(access) = 'object' and octet_length(access::text) <= 262144),
  position integer not null default 0,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not builtin or membership is null),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  title text not null check (length(title) between 1 and 80),
  icon text not null default 'file' check (length(icon) <= 60),
  kind text not null default 'page' check (kind in ('page', 'record')),
  object_id uuid,
  audience jsonb not null default '{}'::jsonb check (jsonb_typeof(audience) = 'object' and octet_length(audience::text) <= 16384),
  layout text not null default 'blocks' check (layout in ('blocks', 'canvas')),
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 524288),
  position integer not null default 0,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'record') = (object_id is not null)),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_portal_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  number integer not null check (number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 5242880),
  note text check (note is null or length(note) <= 200),
  published_by uuid not null,
  published_at timestamptz not null default now(),
  unique (project_id, event_id, number),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  email text not null check (length(email) between 3 and 320),
  purpose text not null check (purpose in ('invite', 'code')),
  token_hash text not null,
  member_id uuid,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create table if not exists events.workspace_form_drafts (
  project_id uuid not null,
  event_id uuid not null,
  member_id uuid not null,
  page_id uuid not null,
  block_id text not null check (block_id ~ '^b_[a-z0-9]{4,24}$'),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1100000),
  updated_at timestamptz not null default now(),
  primary key (project_id, event_id, member_id, page_id, block_id),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create unique index if not exists workspace_roles_key_uq on events.workspace_roles (project_id, event_id, key) where deleted_at is null;
create index if not exists workspace_roles_event_idx on events.workspace_roles (project_id, event_id, position);
create unique index if not exists workspace_pages_slug_uq on events.workspace_pages (project_id, event_id, slug) where deleted_at is null and kind = 'page';
create unique index if not exists workspace_pages_record_uq on events.workspace_pages (project_id, event_id, object_id) where deleted_at is null and kind = 'record';
create index if not exists workspace_pages_event_idx on events.workspace_pages (project_id, event_id, position);
create index if not exists workspace_portal_tokens_email_idx on events.workspace_portal_tokens (project_id, event_id, lower(email), purpose, created_at desc);
create unique index if not exists workspace_portal_tokens_hash_uq on events.workspace_portal_tokens (token_hash);
create index if not exists workspace_portal_versions_event_idx on events.workspace_portal_versions (project_id, event_id, number desc);

do $$
declare t text;
begin
  foreach t in array array['workspace_portals','workspace_roles','workspace_pages','workspace_portal_versions',
    'workspace_portal_tokens','workspace_form_drafts'] loop
    execute format('alter table events.%I enable row level security', t);
    execute format('revoke all on events.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on events.%I to service_role', t);
  end loop;
end $$;

-- Read-side cast of one stored value of the record aliased p_alias.
create or replace function events.workspace__value_at(p_alias text, p_field text, p_cast text) returns text
language sql immutable set search_path = '' as $$
  select case p_cast
    when 'text' then format('(%1$s.data->>%2$L)', p_alias, p_field)
    when 'numeric' then format('(case when jsonb_typeof(%1$s.data->%2$L) = ''number'' then (%1$s.data->>%2$L)::numeric end)', p_alias, p_field)
    when 'boolean' then format('(case when jsonb_typeof(%1$s.data->%2$L) = ''boolean'' then (%1$s.data->>%2$L)::boolean end)', p_alias, p_field)
    when 'date' then format('(case when (%1$s.data->>%2$L) ~ ''^\d{4}-\d{2}-\d{2}$'' then (%1$s.data->>%2$L)::date end)', p_alias, p_field)
    when 'timestamptz' then format('(case when (%1$s.data->>%2$L) ~ ''^\d{4}-\d{2}-\d{2}T'' then (%1$s.data->>%2$L)::timestamptz end)', p_alias, p_field)
    when 'text[]' then format('(%1$s.data->%2$L)', p_alias, p_field)
    when 'file' then format('(%1$s.data->%2$L)', p_alias, p_field)
  end;
$$;

create or replace function events.workspace__value_sql(p_field text, p_cast text) returns text
language sql immutable set search_path = '' as $$
  select events.workspace__value_at('r', p_field, p_cast);
$$;

-- One filter node as SQL against the record aliased p_alias. "related" looks through a link (either direction) at
-- the linked records, up to two hops (aliases x1, x2); p_limit caps group nesting (3 for views, 8 for role policies).
create or replace function events.workspace__condition_at(p_alias text, p_object uuid, p_node jsonb, p_computed jsonb,
  p_depth integer, p_limit integer)
returns text language plpgsql stable set search_path = '' as $$
declare
  v_parts text[] := '{}';
  item jsonb;
  v_source text := p_node->>'source';
  v_cast text := p_node->>'cast';
  v_op text := p_node->>'operator';
  v_value jsonb := p_node->'value';
  v_expr text;
  v_field uuid;
  v_type text;
  v_lit text;
  f events.workspace_fields;
  v_next text;
  v_link text;
  v_target uuid;
begin
  if p_alias not in ('r', 'x1', 'x2') or p_node is null or jsonb_typeof(p_node) <> 'object' then
    perform events.workspace__fail('Invalid filter');
  end if;
  if p_node ? 'op' then
    if p_depth > p_limit or p_node->>'op' not in ('and', 'or') or jsonb_typeof(p_node->'items') <> 'array'
      or jsonb_array_length(p_node->'items') > 50 then
      perform events.workspace__fail('Invalid filter');
    end if;
    for item in select * from jsonb_array_elements(p_node->'items') loop
      v_parts := v_parts || events.workspace__condition_at(p_alias, p_object, item, p_computed, p_depth + 1, p_limit);
    end loop;
    if cardinality(v_parts) = 0 then return case when p_node->>'op' = 'or' then 'false' else 'true' end; end if;
    return '(' || array_to_string(v_parts, case when p_node->>'op' = 'and' then ' and ' else ' or ' end) || ')';
  end if;

  if v_source = 'related' then
    if p_alias = 'x2' or p_depth > p_limit then perform events.workspace__fail('Invalid filter'); end if;
    v_next := case p_alias when 'r' then 'x1' else 'x2' end;
    v_link := 'l' || v_next;
    if p_node->>'direction' = 'forward' then
      select * into f from events.workspace_fields where id = (p_node->>'fieldId')::uuid and object_id = p_object
        and deleted_at is null and type = 'link_record';
      if not found then perform events.workspace__fail('Invalid filter'); end if;
      v_target := (f.config->>'targetObjectId')::uuid;
      v_expr := format('%1$s.target_id = %2$s.id and %1$s.source_record_id = %3$s.id', v_link, v_next, p_alias);
    elsif p_node->>'direction' = 'back' then
      select * into f from events.workspace_fields where id = (p_node->>'fieldId')::uuid and deleted_at is null
        and type = 'link_record' and (config->>'targetObjectId')::uuid = p_object;
      if not found then perform events.workspace__fail('Invalid filter'); end if;
      v_target := f.object_id;
      v_expr := format('%1$s.source_record_id = %2$s.id and %1$s.target_id = %3$s.id', v_link, v_next, p_alias);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    return format('exists (select 1 from events.workspace_links %1$s join events.workspace_records %2$s on %3$s and %2$s.deleted_at is null and %2$s.object_id = %4$L where %1$s.field_id = %5$L and %1$s.target_kind = ''record'' and %6$s)',
      v_link, v_next, v_expr, v_target, f.id,
      case when p_node->'match' is null or p_node->'match' = 'null'::jsonb then 'true'
        else events.workspace__condition_at(v_next, v_target, p_node->'match', '{}'::jsonb, p_depth + 1, p_limit) end);
  end if;

  if v_cast is null or v_cast not in ('text', 'numeric', 'boolean', 'date', 'timestamptz', 'text[]', 'link', 'file') then
    perform events.workspace__fail('Invalid filter');
  end if;
  if v_source = 'system' then
    v_expr := case p_node->>'column'
      when 'number' then p_alias || '.number' when 'title' then p_alias || '.title' when 'status' then p_alias || '.status'
      when 'created_at' then p_alias || '.created_at' when 'updated_at' then p_alias || '.updated_at'
      when 'created_by' then p_alias || '.created_by::text' when 'id' then p_alias || '.id::text' end;
    if v_expr is null or (p_node->>'column' = 'created_by' and (v_cast <> 'text' or v_op <> 'eq'))
      or (p_node->>'column' = 'id' and (v_cast <> 'text' or v_op not in ('eq', 'any_of'))) then
      perform events.workspace__fail('Invalid filter');
    end if;
  elsif v_source = 'value' then
    v_field := (p_node->>'fieldId')::uuid;
    select type into v_type from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null;
    if v_type is null or v_type in ('link_record', 'link_event', 'lookup', 'rollup') then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := events.workspace__value_at(p_alias, v_field::text, v_cast);
  elsif v_source = 'computed' then
    v_expr := case when p_alias = 'r' then p_computed->>(p_node->>'alias') end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
  elsif v_source = 'link' then
    v_field := (p_node->>'fieldId')::uuid;
    if not exists (select 1 from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null
      and type in ('link_record', 'link_event')) then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := format('exists (select 1 from events.workspace_links l where l.source_record_id = %s.id and l.field_id = %L', p_alias, v_field);
    return case v_op
      when 'is_empty' then 'not ' || v_expr || ')'
      when 'is_not_empty' then v_expr || ')'
      when 'has_any' then v_expr || format(' and l.target_id = any (%L::uuid[]))', (select array_agg(value) from jsonb_array_elements_text(v_value)))
      else events.workspace__invalid() end;
  else
    perform events.workspace__fail('Invalid filter');
  end if;

  v_lit := case when jsonb_typeof(v_value) = 'array' then null else v_value #>> '{}' end;
  return case
    when v_op = 'is_empty' and v_cast in ('text[]', 'file') then format('(%1$s is null or jsonb_array_length(%1$s) = 0)', v_expr)
    when v_op = 'is_not_empty' and v_cast in ('text[]', 'file') then format('(%1$s is not null and jsonb_array_length(%1$s) > 0)', v_expr)
    when v_op = 'is_empty' and v_cast = 'text' then format('(%1$s is null or %1$s = '''')', v_expr)
    when v_op = 'is_not_empty' and v_cast = 'text' then format('(%1$s is not null and %1$s <> '''')', v_expr)
    when v_op = 'is_empty' then format('(%s is null)', v_expr)
    when v_op = 'is_not_empty' then format('(%s is not null)', v_expr)
    when v_op = 'is_true' and v_cast = 'boolean' then format('(%s is true)', v_expr)
    when v_op = 'is_false' and v_cast = 'boolean' then format('(%s is not true)', v_expr)
    when v_cast = 'text' and v_op = 'eq' then format('(lower(%s) = lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'neq' then format('(lower(coalesce(%s, '''')) <> lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) > 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'not_contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) = 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'starts_with' then format('(left(lower(coalesce(%1$s, '''')), length(%2$L)) = lower(%2$L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'any_of' then format('(%s = any (%L::text[]))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text' and v_op = 'none_of' then format('(%1$s is null or not (%1$s = any (%2$L::text[])))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'numeric' and v_op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte') then format('(%s %s %L::numeric)', v_expr,
      case v_op when 'eq' then '=' when 'neq' then 'is distinct from' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end, v_lit)
    when v_cast in ('date', 'timestamptz') and v_op in ('eq', 'before', 'after', 'on_or_before', 'on_or_after') then format('(%s %s %L::%s)', v_expr,
      case v_op when 'eq' then '=' when 'before' then '<' when 'after' then '>' when 'on_or_before' then '<=' else '>=' end, v_lit, v_cast)
    when v_cast = 'text[]' and v_op = 'has_any' then format('coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_all' then format('coalesce(%s ?& %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_none' then format('not coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    else events.workspace__invalid()
  end;
end $$;

create or replace function events.workspace__condition_sql(p_object uuid, p_node jsonb, p_computed jsonb, p_depth integer)
returns text language sql stable set search_path = '' as $$
  select events.workspace__condition_at('r', p_object, p_node, p_computed, p_depth, 3);
$$;

-- The shared part of a read plan: computed columns, then the where clause (filter, role policy, search).
create or replace function events.workspace__plan_sql(p_project uuid, p_event uuid, p_plan jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_where text;
  v_computed jsonb := '{}'::jsonb;
  v_select text := '';
  v_link events.workspace_fields;
  v_target events.workspace_fields;
  v_fn text;
  v_expr text;
  item jsonb;
  v_terms text[];
  v_term text;
  v_cols text[];
begin
  if not exists (select 1 from events.workspace_objects where id = v_object and project_id = p_project and event_id = p_event) then
    perform events.workspace__fail('Unknown object');
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'computed', '[]'::jsonb)) loop
    if (item->>'alias') !~ '^c[0-9]{1,3}$' or not exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid
      and object_id = v_object and type = item->>'kind' and deleted_at is null and type in ('lookup', 'rollup')) then
      perform events.workspace__fail('Invalid filter');
    end if;
    select * into v_link from events.workspace_fields where id = (item->>'linkFieldId')::uuid and object_id = v_object
      and type = 'link_record' and deleted_at is null;
    if not found then perform events.workspace__fail('Invalid filter'); end if;
    v_target := null;
    if item->>'targetFieldId' is not null then
      select * into v_target from events.workspace_fields where id = (item->>'targetFieldId')::uuid
        and object_id = (v_link.config->>'targetObjectId')::uuid and deleted_at is null;
      if not found then perform events.workspace__fail('Invalid filter'); end if;
    end if;
    v_fn := coalesce(item->>'fn', 'count');
    if item->>'kind' = 'lookup' then
      if v_target.id is null then perform events.workspace__fail('Invalid filter'); end if;
      v_expr := format('(select string_agg(t.data->>%L, '', '' order by l.position) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')', v_target.id, v_link.id);
    elsif v_fn = 'count' then
      v_expr := format('(select count(*) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')::numeric', v_link.id);
    elsif v_fn in ('sum', 'avg', 'min', 'max') and v_target.id is not null then
      v_expr := format('(select %s(case when jsonb_typeof(t.data->%L) = ''number'' then (t.data->>%L)::numeric end) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')',
        v_fn, v_target.id, v_target.id, v_link.id);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    v_computed := v_computed || jsonb_build_object(item->>'alias', v_expr);
    v_select := v_select || format(', %L, %s', item->>'fieldId', v_expr);
  end loop;

  v_where := format('r.project_id = %L and r.event_id = %L and r.object_id = %L and r.deleted_at is %s null',
    p_project, p_event, v_object, case when coalesce((p_plan->>'deleted')::boolean, false) then 'not' else '' end);
  if p_plan->'filter' is not null and p_plan->'filter' <> 'null'::jsonb then
    v_where := v_where || ' and ' || events.workspace__condition_at('r', v_object, p_plan->'filter', v_computed, 1, 3);
  end if;
  if p_plan->'policy' is not null and p_plan->'policy' <> 'null'::jsonb then
    v_where := v_where || ' and ' || events.workspace__condition_at('r', v_object, p_plan->'policy', v_computed, 1, 8);
  end if;
  if jsonb_typeof(p_plan->'search') = 'array' and jsonb_array_length(p_plan->'search') > 0 then
    select array_agg(value) into v_terms from jsonb_array_elements_text(p_plan->'search') where value ~ '^[[:alnum:]]{1,50}$';
    if v_terms is not null and jsonb_typeof(p_plan->'searchFields') = 'array' then
      -- Portal search: plain matching over the title and the fields this viewer may see, never the full-text index.
      v_cols := array['r.title'];
      for v_term in select value from jsonb_array_elements_text(p_plan->'searchFields') loop
        if not exists (select 1 from events.workspace_fields where id::text = v_term and object_id = v_object and deleted_at is null) then
          perform events.workspace__fail('Invalid filter');
        end if;
        v_cols := v_cols || format('(r.data->>%L)', v_term);
      end loop;
      foreach v_term in array v_terms loop
        v_where := v_where || ' and (' || (select string_agg(format('strpos(lower(coalesce(%s, '''')), %L) > 0', c, lower(v_term)), ' or ') from unnest(v_cols) c)
          || case when v_term ~ '^[0-9]{1,15}$' then format(' or r.number = %s', v_term) else '' end || ')';
      end loop;
    elsif v_terms is not null then
      v_where := v_where || format(' and (r.search @@ to_tsquery(''simple'', %L)%s)',
        array_to_string(array(select t || ':*' from unnest(v_terms) t), ' & '),
        case when cardinality(v_terms) = 1 and v_terms[1] ~ '^[0-9]{1,15}$' then format(' or r.number = %s', v_terms[1]) else '' end);
    end if;
  end if;
  return jsonb_build_object('where', v_where, 'computed', v_computed, 'select', v_select);
end $$;

create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_sql jsonb;
  v_where text;
  v_computed jsonb;
  v_select text;
  v_policy text := '';
  v_order text[] := '{}';
  v_expr text;
  item jsonb;
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  v_sql := events.workspace__plan_sql(p_project, p_event, p_plan);
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;
  v_where := v_sql->>'where';
  v_computed := v_sql->'computed';
  v_select := v_sql->>'select';

  -- Per-row flags: which of the viewer's roles' view rules this row matches (decides field visibility per row).
  if jsonb_typeof(p_plan->'policyParts') = 'array' then
    if jsonb_array_length(p_plan->'policyParts') > 30 then perform events.workspace__fail('Invalid filter'); end if;
    for item in select * from jsonb_array_elements(p_plan->'policyParts') loop
      if coalesce(item->>'alias', '') !~ '^p[0-9]{1,2}$' then perform events.workspace__fail('Invalid filter'); end if;
      v_policy := v_policy || format(', %L, %s', item->>'alias', events.workspace__condition_at('r', v_object, item->'condition', v_computed, 1, 8));
    end loop;
    v_policy := format(' || jsonb_build_object(''policy'', jsonb_build_object(''_'', null%s) - ''_'')', v_policy);
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'sort', '[]'::jsonb)) loop
    v_expr := case item->>'source'
      when 'system' then case item->>'column' when 'number' then 'r.number' when 'title' then 'lower(r.title)' when 'status' then 'r.status'
        when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end
      when 'computed' then v_computed->>(item->>'alias')
      when 'value' then case when exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = v_object and deleted_at is null
        and type not in ('link_record', 'link_event', 'lookup', 'rollup', 'multi_select', 'attachments'))
        then events.workspace__value_sql(item->>'fieldId', case when item->>'cast' in ('text', 'numeric', 'boolean', 'date', 'timestamptz') then item->>'cast' end) end
    end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
    v_order := v_order || format('%s %s nulls last', v_expr, case when item->>'dir' = 'desc' then 'desc' else 'asc' end);
  end loop;
  v_order := v_order || 'r.number asc'::text;

  execute format('select count(*) from events.workspace_records r where %s', v_where) into v_total;
  execute format(
    'select coalesce(jsonb_agg(q.j order by q.ord), ''[]''::jsonb) from (
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'')%s as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, v_policy, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

-- Counts and totals for stats and charts, optionally grouped by status, a choice/text/checkbox field or a date bucket.
create or replace function events.workspace_aggregate(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_sql jsonb;
  v_where text;
  v_computed jsonb;
  v_measures text[] := '{}';
  v_values text := '';
  item jsonb;
  v_expr text;
  v_fn text;
  v_type text;
  v_cast text;
  v_key text;
  v_from text := 'events.workspace_records r';
  v_group jsonb := p_plan->'groupBy';
  v_bucket text;
  v_result jsonb;
begin
  v_sql := events.workspace__plan_sql(p_project, p_event, p_plan);
  v_where := v_sql->>'where';
  v_computed := v_sql->'computed';
  if jsonb_typeof(p_plan->'measures') is distinct from 'array' or jsonb_array_length(p_plan->'measures') not between 1 and 8 then
    perform events.workspace__fail('Invalid filter');
  end if;
  for item in select * from jsonb_array_elements(p_plan->'measures') loop
    if coalesce(item->>'alias', '') !~ '^m[0-9]$' then perform events.workspace__fail('Invalid filter'); end if;
    v_fn := item->>'fn';
    if v_fn = 'count' then
      v_expr := 'count(*)::numeric';
    elsif v_fn in ('sum', 'avg', 'min', 'max') then
      if item->>'computed' is not null then
        v_expr := v_computed->>(item->>'computed');
      else
        select type into v_type from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = v_object and deleted_at is null;
        if v_type is null or v_type in ('link_record', 'link_event', 'lookup', 'rollup', 'attachments') then perform events.workspace__fail('Invalid filter'); end if;
        v_expr := events.workspace__value_at('r', item->>'fieldId', 'numeric');
      end if;
      if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
      v_expr := format('round(%s(%s), 4)', v_fn, v_expr);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    v_measures := v_measures || format('%s as %I', v_expr, item->>'alias');
    v_values := v_values || format(', %L, g.%I', item->>'alias', item->>'alias');
  end loop;

  if v_group is null or v_group = 'null'::jsonb then
    execute format('select jsonb_build_object(''_'', null%s) - ''_'' from (select %s from events.workspace_records r where %s) g',
      v_values, array_to_string(v_measures, ', '), v_where) into v_result;
    return jsonb_build_object('values', v_result);
  end if;

  if v_group->>'source' = 'system' then
    v_key := case v_group->>'column' when 'status' then 'r.status' when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end;
    v_cast := case when v_group->>'column' in ('created_at', 'updated_at') then 'timestamptz' else 'text' end;
  elsif v_group->>'source' = 'value' then
    select type into v_type from events.workspace_fields where id = (v_group->>'fieldId')::uuid and object_id = v_object and deleted_at is null;
    v_cast := v_group->>'cast';
    if v_type is null or v_type in ('link_record', 'link_event', 'lookup', 'rollup', 'attachments')
      or v_cast not in ('text', 'text[]', 'boolean', 'date', 'timestamptz', 'numeric') then
      perform events.workspace__fail('Invalid filter');
    end if;
    if v_cast = 'text[]' then
      v_from := format('events.workspace_records r cross join lateral jsonb_array_elements_text(case when jsonb_typeof(r.data->%1$L) = ''array'' then r.data->%1$L else ''[]''::jsonb end) as gk(v)',
        v_group->>'fieldId');
      v_key := 'gk.v';
    else
      v_key := events.workspace__value_at('r', v_group->>'fieldId', v_cast);
    end if;
  end if;
  if v_key is null then perform events.workspace__fail('Invalid filter'); end if;
  v_bucket := v_group->>'bucket';
  if v_bucket is not null then
    if v_cast not in ('date', 'timestamptz') or v_bucket not in ('day', 'week', 'month') then perform events.workspace__fail('Invalid filter'); end if;
    v_key := format('date_trunc(%L, %s)::date', v_bucket, v_key);
  end if;
  execute format('select coalesce(jsonb_agg(jsonb_build_object(''key'', g.k, ''values'', jsonb_build_object(''_'', null%s) - ''_'') order by g.k nulls last), ''[]''::jsonb)
     from (select %s as k, %s from %s where %s group by 1 order by 1 nulls last limit 200) g',
    v_values, v_key, array_to_string(v_measures, ', '), v_from, v_where) into v_result;
  return jsonb_build_object('groups', v_result);
end $$;

-- Whether one live record of p_object matches a role rule (with the lookups/rollups that rule may use).
create or replace function events.workspace__record_matches(p_project uuid, p_event uuid, p_object uuid, p_record uuid,
  p_condition jsonb, p_computed jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  v_sql jsonb;
  v_ok boolean;
begin
  v_sql := events.workspace__plan_sql(p_project, p_event, jsonb_build_object('objectId', p_object,
    'computed', coalesce(p_computed, '[]'::jsonb), 'policy', coalesce(p_condition, '{"op":"and","items":[]}'::jsonb)));
  execute format('select exists (select 1 from events.workspace_records r where %s and r.id = %L)', v_sql->>'where', p_record) into v_ok;
  return v_ok;
end $$;

-- Fields a portal command writes: values (formulas are recalculated, not chosen), link fields and, on update, status.
create or replace function events.workspace__written_keys(p_object uuid, p_command jsonb, p_status boolean)
returns text[] language sql stable set search_path = '' as $$
  select array(
    select k from jsonb_object_keys(case when jsonb_typeof(p_command->'values') = 'object' then p_command->'values' else '{}'::jsonb end) k
      where not exists (select 1 from events.workspace_fields f where f.id::text = k and f.object_id = p_object and f.type = 'formula')
    union all
    select item->>'fieldId' from jsonb_array_elements(case when jsonb_typeof(p_command->'links') = 'array' then p_command->'links' else '[]'::jsonb end) item
    union all
    select 'status' where p_status and p_command ? 'status');
$$;

create or replace function events.workspace__keys_allowed(p_keys text[], p_part jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (select 1 from unnest(p_keys) k
    where not (coalesce(p_part->'fields', '[]'::jsonb) ? k or (k = 'status' and coalesce((p_part->>'status')::boolean, false))));
$$;

-- One portal person's record action, allowed only inside the role rules the server compiled into p_guard:
-- { objectId, computed, create|edit|delete|comment: [{ condition, after, fields, status }] }; "after" (the role's view rule)
-- must still match once the change is made, so nobody can move a record out of their own reach or into someone else's.
create or replace function events.workspace_portal_command(p_project uuid, p_event uuid, p_member uuid, p_person uuid,
  p_guard jsonb, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action';
  v_command_id uuid;
  v_hash text := p_command->>'requestHash';
  v_object uuid;
  v_receipt events.workspace_command_receipts;
  v_parts jsonb;
  v_keys text[];
  v_ids uuid[];
  v_id uuid;
  v_result jsonb;
  v_revision bigint;
  r events.workspace_records;
begin
  perform set_config('workspace.actor_kind', 'portal', true);
  begin
    v_command_id := (p_command->>'commandId')::uuid;
    v_object := (p_guard->>'objectId')::uuid;
  exception when others then
    perform events.workspace__fail('Invalid command');
  end;
  if v_action is null or v_command_id is null or v_hash is null or v_object is null then perform events.workspace__fail('Invalid command'); end if;
  if p_member is null then perform events.workspace__fail('Not allowed', '42501'); end if;
  if v_action not in ('record.create', 'record.update', 'records.delete', 'comment.add') then perform events.workspace__fail('Not allowed', '42501'); end if;
  if not exists (select 1 from events.events e where e.id = p_event and e.project_id = p_project) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  perform 1 from events.workspace_workspaces where project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Workspace required'); end if;
  select * into v_receipt from events.workspace_command_receipts
    where project_id = p_project and event_id = p_event and actor_kind = 'portal' and actor_id = p_member and command_id = v_command_id;
  if found then
    if v_receipt.request_hash <> v_hash then perform events.workspace__fail('Command ID reused', '23505'); end if;
    return v_receipt.response;
  end if;
  perform events.workspace__object(p_project, p_event, v_object);

  case v_action
    when 'record.create' then
      if p_command->>'objectId' is distinct from v_object::text then perform events.workspace__fail('Not allowed', '42501'); end if;
      v_keys := events.workspace__written_keys(v_object, p_command, false);
      select coalesce(jsonb_agg(x), '[]'::jsonb) into v_parts from jsonb_array_elements(coalesce(p_guard->'create', '[]'::jsonb)) x
        where events.workspace__keys_allowed(v_keys, x);
      if jsonb_array_length(v_parts) = 0 then perform events.workspace__fail('Not allowed', '42501'); end if;
      r := events.workspace__record_create(p_project, p_event, p_member, v_object, p_command - 'id');
      if not exists (select 1 from jsonb_array_elements(v_parts) x
        where events.workspace__record_matches(p_project, p_event, v_object, r.id, coalesce(x->'after', x->'condition'), p_guard->'computed')) then
        perform events.workspace__fail('Not allowed', '42501');
      end if;
      v_result := jsonb_build_object('record', events.workspace__record_json(r));

    when 'record.update' then
      select * into r from events.workspace_records where id = (p_command->>'recordId')::uuid and project_id = p_project
        and event_id = p_event and object_id = v_object and deleted_at is null for update;
      if not found then perform events.workspace__fail('Unknown record'); end if;
      v_keys := events.workspace__written_keys(v_object, p_command, true);
      select coalesce(jsonb_agg(x), '[]'::jsonb) into v_parts from jsonb_array_elements(coalesce(p_guard->'edit', '[]'::jsonb)) x
        where events.workspace__keys_allowed(v_keys, x)
          and events.workspace__record_matches(p_project, p_event, v_object, r.id, x->'condition', p_guard->'computed');
      if jsonb_array_length(v_parts) = 0 then perform events.workspace__fail('Not allowed', '42501'); end if;
      r := events.workspace__record_update(p_project, p_event, p_member, p_command, true);
      if not exists (select 1 from jsonb_array_elements(v_parts) x
        where events.workspace__record_matches(p_project, p_event, v_object, r.id, coalesce(x->'after', x->'condition'), p_guard->'computed')) then
        perform events.workspace__fail('Not allowed', '42501');
      end if;
      v_result := jsonb_build_object('record', events.workspace__record_json(r));

    when 'records.delete' then
      select coalesce(array_agg(value::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_command->'recordIds', '[]'::jsonb));
      if cardinality(v_ids) = 0 or cardinality(v_ids) > 100 then perform events.workspace__fail('Invalid command'); end if;
      foreach v_id in array v_ids loop
        if not exists (select 1 from events.workspace_records x where x.id = v_id and x.object_id = v_object and x.deleted_at is null)
          or not exists (select 1 from jsonb_array_elements(coalesce(p_guard->'delete', '[]'::jsonb)) x
            where events.workspace__record_matches(p_project, p_event, v_object, v_id, x->'condition', p_guard->'computed')) then
          perform events.workspace__fail('Not allowed', '42501');
        end if;
      end loop;
      v_result := events.workspace__records_delete(p_project, p_event, p_member, v_ids, true);

    when 'comment.add' then
      v_id := (p_command->>'recordId')::uuid;
      if not exists (select 1 from events.workspace_records x where x.id = v_id and x.object_id = v_object and x.deleted_at is null)
        or not exists (select 1 from jsonb_array_elements(coalesce(p_guard->'comment', '[]'::jsonb)) x
          where events.workspace__record_matches(p_project, p_event, v_object, v_id, x->'condition', p_guard->'computed')) then
        perform events.workspace__fail('Not allowed', '42501');
      end if;
      insert into events.workspace_comments (project_id, event_id, record_id, body, created_by)
      values (p_project, p_event, v_id, p_command->>'body', p_member)
      returning jsonb_build_object('id', id, 'recordId', record_id, 'body', body, 'createdBy', created_by, 'createdAt', created_at) into v_result;
      v_result := jsonb_build_object('comment', v_result);
  end case;

  update events.workspace_workspaces set revision = revision + 1, updated_at = now()
    where project_id = p_project and event_id = p_event returning revision into v_revision;
  v_result := v_result || jsonb_build_object('revision', v_revision);
  insert into events.workspace_command_receipts (project_id, event_id, actor_id, command_id, request_hash, response)
  values (p_project, p_event, p_member, v_command_id, v_hash, v_result);
  return v_result;
end $$;

create or replace function events.workspace__portal_json(p events.workspace_portals) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('enabled', p.enabled, 'peopleObjectId', p.people_object_id, 'emailFieldId', p.email_field_id,
    'nameFieldId', p.name_field_id, 'signupEnabled', p.signup_enabled, 'settings', p.settings,
    'publishedVersionId', p.published_version_id, 'revision', p.revision);
$$;

create or replace function events.workspace__role_json(x events.workspace_roles) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', x.id, 'key', x.key, 'name', x.name, 'icon', x.icon, 'color', x.color, 'builtin', x.builtin,
    'membership', x.membership, 'access', x.access, 'position', x.position, 'revision', x.revision, 'deletedAt', x.deleted_at);
$$;

create or replace function events.workspace__page_json(x events.workspace_pages) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', x.id, 'slug', x.slug, 'title', x.title, 'icon', x.icon, 'kind', x.kind, 'objectId', x.object_id,
    'audience', x.audience, 'layout', x.layout, 'body', x.body, 'position', x.position, 'revision', x.revision, 'deletedAt', x.deleted_at);
$$;

-- Applies portal settings from a patch (or a change's "before"), checking that the chosen list and fields belong here.
create or replace function events.workspace__portal_apply(p_project uuid, p_event uuid, p_patch jsonb)
returns events.workspace_portals language plpgsql set search_path = '' as $$
declare
  p events.workspace_portals;
  f events.workspace_fields;
begin
  update events.workspace_portals set
    enabled = case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else enabled end,
    people_object_id = case when p_patch ? 'peopleObjectId' then (p_patch->>'peopleObjectId')::uuid else people_object_id end,
    email_field_id = case when p_patch ? 'emailFieldId' then (p_patch->>'emailFieldId')::uuid else email_field_id end,
    name_field_id = case when p_patch ? 'nameFieldId' then (p_patch->>'nameFieldId')::uuid else name_field_id end,
    signup_enabled = case when p_patch ? 'signupEnabled' then (p_patch->>'signupEnabled')::boolean else signup_enabled end,
    settings = case when jsonb_typeof(p_patch->'settings') = 'object' then p_patch->'settings' else settings end,
    revision = revision + 1, updated_at = now()
  where project_id = p_project and event_id = p_event returning * into p;
  if p.people_object_id is not null and not exists (select 1 from events.workspace_objects o where o.id = p.people_object_id
    and o.project_id = p_project and o.event_id = p_event and o.deleted_at is null) then
    perform events.workspace__fail('Unknown object');
  end if;
  if p.email_field_id is not null then
    select * into f from events.workspace_fields where id = p.email_field_id and object_id = p.people_object_id and deleted_at is null;
    if not found or f.type not in ('email', 'short_text') then perform events.workspace__fail('Unknown field'); end if;
  end if;
  if p.name_field_id is not null and not exists (select 1 from events.workspace_fields where id = p.name_field_id
    and object_id = p.people_object_id and deleted_at is null) then
    perform events.workspace__fail('Unknown field');
  end if;
  if p.enabled then
    if p.people_object_id is null or p.email_field_id is null then perform events.workspace__fail('Portal needs people'); end if;
    if not f.is_unique then perform events.workspace__fail('Portal email must be unique'); end if;
  end if;
  return p;
end $$;

create or replace function events.workspace__role_apply(p_id uuid, p_patch jsonb) returns events.workspace_roles
language sql set search_path = '' as $$
  update events.workspace_roles set
    name = coalesce(p_patch->>'name', name),
    icon = coalesce(p_patch->>'icon', icon),
    color = coalesce(p_patch->>'color', color),
    membership = case when builtin then null when p_patch ? 'membership' then nullif(p_patch->'membership', 'null'::jsonb) else membership end,
    access = case when jsonb_typeof(p_patch->'access') = 'object' then p_patch->'access' else access end,
    revision = revision + 1, updated_at = now()
  where id = p_id returning *;
$$;

create or replace function events.workspace__page_apply(p_id uuid, p_patch jsonb) returns events.workspace_pages
language sql set search_path = '' as $$
  update events.workspace_pages set
    slug = coalesce(p_patch->>'slug', slug),
    title = coalesce(p_patch->>'title', title),
    icon = coalesce(p_patch->>'icon', icon),
    audience = case when jsonb_typeof(p_patch->'audience') = 'object' then p_patch->'audience' else audience end,
    layout = coalesce(p_patch->>'layout', layout),
    body = case when jsonb_typeof(p_patch->'body') = 'object' then p_patch->'body' else body end,
    revision = revision + 1, updated_at = now()
  where id = p_id returning *;
$$;

create or replace function events.workspace__role_live(p_project uuid, p_event uuid, p_id uuid, p_live boolean)
returns void language plpgsql set search_path = '' as $$
declare x events.workspace_roles;
begin
  select * into x from events.workspace_roles where id = p_id and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown role'); end if;
  if x.builtin and not p_live then perform events.workspace__fail('Built-in role'); end if;
  if p_live and x.deleted_at is not null and exists (select 1 from events.workspace_roles y where y.project_id = p_project
    and y.event_id = p_event and y.key = x.key and y.deleted_at is null) then
    perform events.workspace__fail('Role key taken');
  end if;
  update events.workspace_roles set deleted_at = case when p_live then null else now() end, updated_at = now() where id = x.id;
end $$;

create or replace function events.workspace__page_live(p_project uuid, p_event uuid, p_id uuid, p_live boolean)
returns void language plpgsql set search_path = '' as $$
declare x events.workspace_pages;
begin
  select * into x from events.workspace_pages where id = p_id and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown page'); end if;
  if p_live and x.deleted_at is not null then
    if x.kind = 'page' and exists (select 1 from events.workspace_pages y where y.project_id = p_project and y.event_id = p_event
      and y.kind = 'page' and y.slug = x.slug and y.deleted_at is null) then
      perform events.workspace__fail('Page address taken');
    end if;
    if x.kind = 'record' and exists (select 1 from events.workspace_pages y where y.project_id = p_project and y.event_id = p_event
      and y.kind = 'record' and y.object_id = x.object_id and y.deleted_at is null) then
      perform events.workspace__fail('Record page exists');
    end if;
  end if;
  update events.workspace_pages set deleted_at = case when p_live then null else now() end, updated_at = now() where id = x.id;
end $$;

-- Reverses one portal configuration change (called from events.workspace__undo).
create or replace function events.workspace__portal_undo(p_project uuid, p_event uuid, c events.workspace_changes)
returns void language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  case c.action
    when 'portal.update' then
      perform 1 from events.workspace_portals where project_id = p_project and event_id = p_event for update;
      perform events.workspace__portal_apply(p_project, p_event, c.before->'portal');
    when 'role.save' then
      v_id := (c.after->'role'->>'id')::uuid;
      if c.before->'role' is null or c.before->'role' = 'null'::jsonb then
        perform events.workspace__role_live(p_project, p_event, v_id, false);
      else
        if not exists (select 1 from events.workspace_roles where id = v_id and deleted_at is null) then
          perform events.workspace__fail('Change cannot be undone');
        end if;
        perform events.workspace__role_apply(v_id, c.before->'role');
      end if;
    when 'role.delete' then perform events.workspace__role_live(p_project, p_event, (c.after->>'roleId')::uuid, true);
    when 'role.restore' then perform events.workspace__role_live(p_project, p_event, (c.after->>'roleId')::uuid, false);
    when 'page.save' then
      v_id := (c.after->'page'->>'id')::uuid;
      if c.before->'page' is null or c.before->'page' = 'null'::jsonb then
        perform events.workspace__page_live(p_project, p_event, v_id, false);
      else
        if not exists (select 1 from events.workspace_pages where id = v_id and deleted_at is null) then
          perform events.workspace__fail('Change cannot be undone');
        end if;
        perform events.workspace__page_apply(v_id, c.before->'page');
      end if;
    when 'page.delete' then perform events.workspace__page_live(p_project, p_event, (c.after->>'pageId')::uuid, true);
    when 'page.restore' then perform events.workspace__page_live(p_project, p_event, (c.after->>'pageId')::uuid, false);
    else perform events.workspace__fail('Change cannot be undone');
  end case;
end $$;

-- Builder actions on the portal (settings, roles, pages, publishing). Staff with the configure permission only.
create or replace function events.workspace_portal_config(p_project uuid, p_event uuid, p_actor uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action';
  v_command_id uuid;
  v_hash text := p_command->>'requestHash';
  v_receipt events.workspace_command_receipts;
  v_result jsonb;
  v_revision bigint;
  v_before jsonb;
  v_change uuid;
  v_input jsonb;
  v_number integer;
  v_snapshot jsonb;
  v_version events.workspace_portal_versions;
  item jsonb;
  p events.workspace_portals;
  x events.workspace_roles;
  pg events.workspace_pages;
begin
  begin
    v_command_id := (p_command->>'commandId')::uuid;
  exception when others then
    perform events.workspace__fail('Invalid command');
  end;
  if v_action is null or v_command_id is null or v_hash is null then perform events.workspace__fail('Invalid command'); end if;
  if not exists (select 1 from events.events e where e.id = p_event and e.project_id = p_project) then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  if not events.workspace_can(p_project, p_event, p_actor, 'events.workspace.configure') then
    perform events.workspace__fail('Not allowed', '42501');
  end if;
  perform 1 from events.workspace_workspaces where project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Workspace required'); end if;
  select * into v_receipt from events.workspace_command_receipts
    where project_id = p_project and event_id = p_event and actor_kind = 'staff' and actor_id = p_actor and command_id = v_command_id;
  if found then
    if v_receipt.request_hash <> v_hash then perform events.workspace__fail('Command ID reused', '23505'); end if;
    return v_receipt.response;
  end if;
  insert into events.workspace_portals (project_id, event_id) values (p_project, p_event) on conflict do nothing;
  if not exists (select 1 from events.workspace_roles where project_id = p_project and event_id = p_event and builtin) then
    insert into events.workspace_roles (project_id, event_id, key, name, icon, color, builtin, position) values
      (p_project, p_event, 'public', 'Public visitor', 'globe', 'gray', true, 0),
      (p_project, p_event, 'signed_in', 'Anyone signed in', 'user-check', 'blue', true, 1);
  end if;

  case v_action
    when 'portal.update' then
      select * into p from events.workspace_portals where project_id = p_project and event_id = p_event for update;
      if p_command ? 'expectedRevision' and (p_command->>'expectedRevision')::bigint is distinct from p.revision then
        perform events.workspace__fail('Portal changed', '40001');
      end if;
      v_before := events.workspace__portal_json(p) - 'publishedVersionId' - 'revision';
      p := events.workspace__portal_apply(p_project, p_event, coalesce(p_command->'patch', '{}'::jsonb));
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'portal.update', null, null, null,
        jsonb_build_object('portal', v_before), jsonb_build_object('portal', p_command->'patch'));
      v_result := jsonb_build_object('portal', events.workspace__portal_json(p), 'changeId', v_change);

    when 'role.save' then
      v_input := coalesce(p_command->'role', '{}'::jsonb);
      if v_input->>'id' is not null and exists (select 1 from events.workspace_roles where id = (v_input->>'id')::uuid) then
        select * into x from events.workspace_roles where id = (v_input->>'id')::uuid and project_id = p_project and event_id = p_event for update;
        if not found or x.deleted_at is not null then perform events.workspace__fail('Unknown role'); end if;
        if p_command ? 'expectedRevision' and (p_command->>'expectedRevision')::bigint is distinct from x.revision then
          perform events.workspace__fail('Role changed', '40001');
        end if;
        v_before := events.workspace__role_json(x);
        x := events.workspace__role_apply(x.id, v_input);
      else
        if (select count(*) from events.workspace_roles where project_id = p_project and event_id = p_event and deleted_at is null) >= 32 then
          perform events.workspace__fail('Role limit reached');
        end if;
        if exists (select 1 from events.workspace_roles where project_id = p_project and event_id = p_event and key = v_input->>'key' and deleted_at is null) then
          perform events.workspace__fail('Role key taken');
        end if;
        insert into events.workspace_roles (id, project_id, event_id, key, name, icon, color, membership, access, position)
        values (coalesce((v_input->>'id')::uuid, gen_random_uuid()), p_project, p_event, v_input->>'key', v_input->>'name',
          coalesce(v_input->>'icon', 'user'), coalesce(v_input->>'color', 'gray'), nullif(v_input->'membership', 'null'::jsonb),
          coalesce(v_input->'access', '{}'::jsonb),
          coalesce((select max(position) + 1 from events.workspace_roles where project_id = p_project and event_id = p_event), 0))
        returning * into x;
        v_before := null;
      end if;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'role.save', null, null, null,
        jsonb_build_object('role', v_before), jsonb_build_object('role', events.workspace__role_json(x)));
      v_result := jsonb_build_object('role', events.workspace__role_json(x), 'changeId', v_change);

    when 'role.delete', 'role.restore' then
      perform events.workspace__role_live(p_project, p_event, (p_command->>'roleId')::uuid, v_action = 'role.restore');
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', v_action, null, null, null, null,
        jsonb_build_object('roleId', p_command->>'roleId'));
      v_result := jsonb_build_object('changeId', v_change);

    when 'role.reorder' then
      update events.workspace_roles x2 set position = ordered.idx - 1, updated_at = now()
      from jsonb_array_elements_text(p_command->'order') with ordinality as ordered(id, idx)
      where x2.id = ordered.id::uuid and x2.project_id = p_project and x2.event_id = p_event;
      v_result := jsonb_build_object('reordered', true);

    when 'page.save' then
      v_input := coalesce(p_command->'page', '{}'::jsonb);
      if v_input->>'id' is not null and exists (select 1 from events.workspace_pages where id = (v_input->>'id')::uuid) then
        select * into pg from events.workspace_pages where id = (v_input->>'id')::uuid and project_id = p_project and event_id = p_event for update;
        if not found or pg.deleted_at is not null then perform events.workspace__fail('Unknown page'); end if;
        if p_command ? 'expectedRevision' and (p_command->>'expectedRevision')::bigint is distinct from pg.revision then
          perform events.workspace__fail('Page changed', '40001');
        end if;
        if pg.kind = 'page' and v_input ? 'slug' and exists (select 1 from events.workspace_pages y where y.project_id = p_project
          and y.event_id = p_event and y.kind = 'page' and y.slug = v_input->>'slug' and y.deleted_at is null and y.id <> pg.id) then
          perform events.workspace__fail('Page address taken');
        end if;
        v_before := events.workspace__page_json(pg);
        pg := events.workspace__page_apply(pg.id, v_input);
      else
        if (select count(*) from events.workspace_pages where project_id = p_project and event_id = p_event and deleted_at is null) >= 60 then
          perform events.workspace__fail('Page limit reached');
        end if;
        if coalesce(v_input->>'kind', 'page') = 'record' then
          perform events.workspace__object(p_project, p_event, (v_input->>'objectId')::uuid);
          if exists (select 1 from events.workspace_pages y where y.project_id = p_project and y.event_id = p_event and y.kind = 'record'
            and y.object_id = (v_input->>'objectId')::uuid and y.deleted_at is null) then
            perform events.workspace__fail('Record page exists');
          end if;
        elsif exists (select 1 from events.workspace_pages y where y.project_id = p_project and y.event_id = p_event and y.kind = 'page'
          and y.slug = v_input->>'slug' and y.deleted_at is null) then
          perform events.workspace__fail('Page address taken');
        end if;
        insert into events.workspace_pages (id, project_id, event_id, slug, title, icon, kind, object_id, audience, layout, body, position)
        values (coalesce((v_input->>'id')::uuid, gen_random_uuid()), p_project, p_event, v_input->>'slug', v_input->>'title',
          coalesce(v_input->>'icon', 'file'), coalesce(v_input->>'kind', 'page'),
          case when v_input->>'kind' = 'record' then (v_input->>'objectId')::uuid end,
          coalesce(v_input->'audience', '{}'::jsonb), coalesce(v_input->>'layout', 'blocks'), coalesce(v_input->'body', '{}'::jsonb),
          coalesce((select max(position) + 1 from events.workspace_pages where project_id = p_project and event_id = p_event), 0))
        returning * into pg;
        v_before := null;
      end if;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'page.save', pg.object_id, null, null,
        jsonb_build_object('page', v_before), jsonb_build_object('page', events.workspace__page_json(pg)));
      v_result := jsonb_build_object('page', events.workspace__page_json(pg), 'changeId', v_change);

    when 'page.delete', 'page.restore' then
      perform events.workspace__page_live(p_project, p_event, (p_command->>'pageId')::uuid, v_action = 'page.restore');
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', v_action, null, null, null, null,
        jsonb_build_object('pageId', p_command->>'pageId'));
      v_result := jsonb_build_object('changeId', v_change);

    when 'page.reorder' then
      update events.workspace_pages y set position = ordered.idx - 1, updated_at = now()
      from jsonb_array_elements_text(p_command->'order') with ordinality as ordered(id, idx)
      where y.id = ordered.id::uuid and y.project_id = p_project and y.event_id = p_event;
      v_result := jsonb_build_object('reordered', true);

    when 'portal.publish' then
      select * into p from events.workspace_portals where project_id = p_project and event_id = p_event for update;
      v_snapshot := jsonb_build_object(
        'portal', events.workspace__portal_json(p) - 'publishedVersionId' - 'revision',
        'roles', coalesce((select jsonb_agg(events.workspace__role_json(y) - 'revision' - 'deletedAt' order by y.position, y.created_at)
          from events.workspace_roles y where y.project_id = p_project and y.event_id = p_event and y.deleted_at is null), '[]'::jsonb),
        'pages', coalesce((select jsonb_agg(events.workspace__page_json(y) - 'revision' - 'deletedAt' order by y.position, y.created_at)
          from events.workspace_pages y where y.project_id = p_project and y.event_id = p_event and y.deleted_at is null), '[]'::jsonb));
      v_number := coalesce((select max(number) from events.workspace_portal_versions where project_id = p_project and event_id = p_event), 0) + 1;
      insert into events.workspace_portal_versions (project_id, event_id, number, snapshot, note, published_by)
      values (p_project, p_event, v_number, v_snapshot, nullif(p_command->>'note', ''), p_actor) returning * into v_version;
      update events.workspace_portals set published_version_id = v_version.id, updated_at = now()
        where project_id = p_project and event_id = p_event;
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'portal.publish', null, null, null, null,
        jsonb_build_object('versionId', v_version.id, 'number', v_number));
      v_result := jsonb_build_object('version', jsonb_build_object('id', v_version.id, 'number', v_number, 'publishedAt', v_version.published_at));

    when 'portal.restore_version' then
      select * into v_version from events.workspace_portal_versions
        where id = (p_command->>'versionId')::uuid and project_id = p_project and event_id = p_event;
      if not found then perform events.workspace__fail('Unknown version'); end if;
      update events.workspace_roles set deleted_at = now(), updated_at = now()
        where project_id = p_project and event_id = p_event and deleted_at is null and not builtin
          and id not in (select (value->>'id')::uuid from jsonb_array_elements(v_version.snapshot->'roles'));
      for item in select * from jsonb_array_elements(v_version.snapshot->'roles') loop
        insert into events.workspace_roles (id, project_id, event_id, key, name, icon, color, builtin, membership, access, position)
        values ((item->>'id')::uuid, p_project, p_event, item->>'key', item->>'name', item->>'icon', item->>'color',
          coalesce((item->>'builtin')::boolean, false), nullif(item->'membership', 'null'::jsonb), item->'access', (item->>'position')::integer)
        on conflict (id) do update set key = excluded.key, name = excluded.name, icon = excluded.icon, color = excluded.color,
          membership = excluded.membership, access = excluded.access, position = excluded.position, deleted_at = null,
          revision = events.workspace_roles.revision + 1, updated_at = now();
      end loop;
      update events.workspace_pages set deleted_at = now(), updated_at = now()
        where project_id = p_project and event_id = p_event and deleted_at is null
          and id not in (select (value->>'id')::uuid from jsonb_array_elements(v_version.snapshot->'pages'));
      for item in select * from jsonb_array_elements(v_version.snapshot->'pages') loop
        insert into events.workspace_pages (id, project_id, event_id, slug, title, icon, kind, object_id, audience, layout, body, position)
        values ((item->>'id')::uuid, p_project, p_event, item->>'slug', item->>'title', item->>'icon', item->>'kind',
          (item->>'objectId')::uuid, item->'audience', item->>'layout', item->'body', (item->>'position')::integer)
        on conflict (id) do update set slug = excluded.slug, title = excluded.title, icon = excluded.icon,
          audience = excluded.audience, layout = excluded.layout, body = excluded.body, position = excluded.position, deleted_at = null,
          revision = events.workspace_pages.revision + 1, updated_at = now();
      end loop;
      perform events.workspace__portal_apply(p_project, p_event, v_version.snapshot->'portal');
      v_change := events.workspace__log(p_project, p_event, p_actor, 'structure', 'portal.restore_version', null, null, null, null,
        jsonb_build_object('versionId', v_version.id, 'number', v_version.number));
      v_result := jsonb_build_object('restored', v_version.number);

    else
      perform events.workspace__fail('Invalid command');
  end case;

  update events.workspace_workspaces set revision = revision + 1, updated_at = now()
    where project_id = p_project and event_id = p_event returning revision into v_revision;
  v_result := v_result || jsonb_build_object('revision', v_revision);
  insert into events.workspace_command_receipts (project_id, event_id, actor_id, command_id, request_hash, response)
  values (p_project, p_event, p_actor, v_command_id, v_hash, v_result);
  return v_result;
end $$;

create or replace function events.workspace__undo(p_project uuid, p_event uuid, p_actor uuid, p_change uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c events.workspace_changes;
  item jsonb;
  v_ids uuid[];
  f events.workspace_fields;
begin
  select * into c from events.workspace_changes where id = p_change and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown change'); end if;
  if c.undone_at is not null or c.undo_of is not null then perform events.workspace__fail('Change cannot be undone'); end if;
  case c.action
    when 'object.create' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.delete' then perform events.workspace__object_restore(p_project, p_event, p_actor, c.object_id, false);
    when 'object.restore' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.update' then
      perform events.workspace__object(p_project, p_event, c.object_id);
      perform events.workspace__object_apply(c.object_id, c.before->'object');
      for item in select * from jsonb_array_elements(coalesce(c.before->'recordStatuses', '[]'::jsonb)) loop
        update events.workspace_records set status = item->>'status' where id = (item->>'id')::uuid and object_id = c.object_id;
      end loop;
    when 'field.create' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.delete' then perform events.workspace__field_restore(p_project, p_event, p_actor, c.field_id, false);
    when 'field.restore' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.update' then
      f := events.workspace__field(p_project, p_event, c.field_id);
      if f.deleted_at is not null then perform events.workspace__fail('Change cannot be undone'); end if;
      f := events.workspace__field_apply(f.id, c.before->'field');
      for item in select * from jsonb_array_elements(coalesce(c.before->'values', '[]'::jsonb)) loop
        perform events.workspace__set_values((item->>'recordId')::uuid, f.id, item->'value');
      end loop;
      if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, f.object_id, f.id);
      else delete from events.workspace_unique_values where field_id = f.id; end if;
    when 'records.delete' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_restore(p_project, p_event, p_actor, v_ids, false);
    when 'records.restore' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_delete(p_project, p_event, p_actor, v_ids, false);
    when 'portal.update', 'role.save', 'role.delete', 'role.restore', 'page.save', 'page.delete', 'page.restore' then
      perform events.workspace__portal_undo(p_project, p_event, c);
    else perform events.workspace__fail('Change cannot be undone');
  end case;
  update events.workspace_changes set undone_at = now() where id = c.id;
  perform events.workspace__log(p_project, p_event, p_actor, c.kind, 'change.undo', c.object_id, c.field_id, c.record_id,
    null, jsonb_build_object('action', c.action), c.id);
  return jsonb_build_object('undone', c.id);
end $$;

create or replace function events.workspace_purge(p_before timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
  v_records integer;
begin
  update events.workspace_records r set data = r.data - f.id::text
    from events.workspace_fields f
    where f.deleted_at < p_before and r.object_id = f.object_id and r.data ? f.id::text;
  delete from events.workspace_objects where deleted_at < p_before;
  delete from events.workspace_fields where deleted_at < p_before;
  with gone as (delete from events.workspace_records where deleted_at < p_before returning 1)
    select count(*) into v_records from gone;
  delete from events.workspace_links l where l.target_kind = 'record'
    and not exists (select 1 from events.workspace_records r where r.id = l.target_id);
  with gone as (
    delete from events.workspace_files f where f.created_at < now() - interval '1 day'
      and not exists (select 1 from events.workspace_records r
        where r.project_id = f.project_id and r.event_id = f.event_id and strpos(r.data::text, f.id::text) > 0)
    returning f.path
  ) select coalesce(array_agg(path), '{}') into v_paths from gone;
  delete from events.workspace_roles where deleted_at < p_before;
  delete from events.workspace_pages where deleted_at < p_before;
  delete from events.workspace_portal_tokens where coalesce(used_at, revoked_at, expires_at) < now() - interval '30 days';
  delete from events.workspace_form_drafts where updated_at < now() - interval '90 days';
  return jsonb_build_object('records', v_records, 'paths', to_jsonb(v_paths));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'events' and p.proname like 'workspace\_\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
revoke all on function events.workspace_aggregate(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function events.workspace_portal_command(uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function events.workspace_portal_config(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function events.workspace_aggregate(uuid, uuid, jsonb) to service_role;
grant execute on function events.workspace_portal_command(uuid, uuid, uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function events.workspace_portal_config(uuid, uuid, uuid, jsonb) to service_role;

-- @down
drop function if exists events.workspace_portal_config(uuid, uuid, uuid, jsonb);
drop function if exists events.workspace_portal_command(uuid, uuid, uuid, uuid, jsonb, jsonb);
drop function if exists events.workspace_aggregate(uuid, uuid, jsonb);

create or replace function events.workspace__value_sql(p_field text, p_cast text) returns text
language sql immutable set search_path = '' as $$
  select case p_cast
    when 'text' then format('(r.data->>%L)', p_field)
    when 'numeric' then format('(case when jsonb_typeof(r.data->%1$L) = ''number'' then (r.data->>%1$L)::numeric end)', p_field)
    when 'boolean' then format('(case when jsonb_typeof(r.data->%1$L) = ''boolean'' then (r.data->>%1$L)::boolean end)', p_field)
    when 'date' then format('(case when (r.data->>%1$L) ~ ''^\d{4}-\d{2}-\d{2}$'' then (r.data->>%1$L)::date end)', p_field)
    when 'timestamptz' then format('(case when (r.data->>%1$L) ~ ''^\d{4}-\d{2}-\d{2}T'' then (r.data->>%1$L)::timestamptz end)', p_field)
    when 'text[]' then format('(r.data->%L)', p_field)
    when 'file' then format('(r.data->%L)', p_field)
  end;
$$;

create or replace function events.workspace__condition_sql(p_object uuid, p_node jsonb, p_computed jsonb, p_depth integer)
returns text language plpgsql stable set search_path = '' as $$
declare
  v_parts text[] := '{}';
  item jsonb;
  v_source text := p_node->>'source';
  v_cast text := p_node->>'cast';
  v_op text := p_node->>'operator';
  v_value jsonb := p_node->'value';
  v_expr text;
  v_field uuid;
  v_type text;
  v_lit text;
begin
  if p_node ? 'op' then
    if p_depth > 3 or p_node->>'op' not in ('and', 'or') or jsonb_array_length(p_node->'items') > 50 then
      perform events.workspace__fail('Invalid filter');
    end if;
    for item in select * from jsonb_array_elements(p_node->'items') loop
      v_parts := v_parts || events.workspace__condition_sql(p_object, item, p_computed, p_depth + 1);
    end loop;
    if cardinality(v_parts) = 0 then return 'true'; end if;
    return '(' || array_to_string(v_parts, case when p_node->>'op' = 'and' then ' and ' else ' or ' end) || ')';
  end if;

  if v_cast not in ('text', 'numeric', 'boolean', 'date', 'timestamptz', 'text[]', 'link', 'file') then
    perform events.workspace__fail('Invalid filter');
  end if;
  if v_source = 'system' then
    v_expr := case p_node->>'column'
      when 'number' then 'r.number' when 'title' then 'r.title' when 'status' then 'r.status'
      when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
  elsif v_source = 'value' then
    v_field := (p_node->>'fieldId')::uuid;
    select type into v_type from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null;
    if v_type is null or v_type in ('link_record', 'link_event', 'lookup', 'rollup') then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := events.workspace__value_sql(v_field::text, v_cast);
  elsif v_source = 'computed' then
    v_expr := p_computed->>(p_node->>'alias');
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
  elsif v_source = 'link' then
    v_field := (p_node->>'fieldId')::uuid;
    if not exists (select 1 from events.workspace_fields where id = v_field and object_id = p_object and deleted_at is null
      and type in ('link_record', 'link_event')) then perform events.workspace__fail('Invalid filter'); end if;
    v_expr := format('exists (select 1 from events.workspace_links l where l.source_record_id = r.id and l.field_id = %L', v_field);
    return case v_op
      when 'is_empty' then 'not ' || v_expr || ')'
      when 'is_not_empty' then v_expr || ')'
      when 'has_any' then v_expr || format(' and l.target_id = any (%L::uuid[]))', (select array_agg(value) from jsonb_array_elements_text(v_value)))
      else events.workspace__invalid() end;
  else
    perform events.workspace__fail('Invalid filter');
  end if;

  v_lit := case when jsonb_typeof(v_value) = 'array' then null else v_value #>> '{}' end;
  return case
    when v_op = 'is_empty' and v_cast in ('text[]', 'file') then format('(%1$s is null or jsonb_array_length(%1$s) = 0)', v_expr)
    when v_op = 'is_not_empty' and v_cast in ('text[]', 'file') then format('(%1$s is not null and jsonb_array_length(%1$s) > 0)', v_expr)
    when v_op = 'is_empty' and v_cast = 'text' then format('(%1$s is null or %1$s = '''')', v_expr)
    when v_op = 'is_not_empty' and v_cast = 'text' then format('(%1$s is not null and %1$s <> '''')', v_expr)
    when v_op = 'is_empty' then format('(%s is null)', v_expr)
    when v_op = 'is_not_empty' then format('(%s is not null)', v_expr)
    when v_op = 'is_true' and v_cast = 'boolean' then format('(%s is true)', v_expr)
    when v_op = 'is_false' and v_cast = 'boolean' then format('(%s is not true)', v_expr)
    when v_cast = 'text' and v_op = 'eq' then format('(lower(%s) = lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'neq' then format('(lower(coalesce(%s, '''')) <> lower(%L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) > 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'not_contains' then format('(strpos(lower(coalesce(%s, '''')), lower(%L)) = 0)', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'starts_with' then format('(left(lower(coalesce(%1$s, '''')), length(%2$L)) = lower(%2$L))', v_expr, v_lit)
    when v_cast = 'text' and v_op = 'any_of' then format('(%s = any (%L::text[]))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text' and v_op = 'none_of' then format('(%1$s is null or not (%1$s = any (%2$L::text[])))', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'numeric' and v_op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte') then format('(%s %s %L::numeric)', v_expr,
      case v_op when 'eq' then '=' when 'neq' then 'is distinct from' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end, v_lit)
    when v_cast in ('date', 'timestamptz') and v_op in ('eq', 'before', 'after', 'on_or_before', 'on_or_after') then format('(%s %s %L::%s)', v_expr,
      case v_op when 'eq' then '=' when 'before' then '<' when 'after' then '>' when 'on_or_before' then '<=' else '>=' end, v_lit, v_cast)
    when v_cast = 'text[]' and v_op = 'has_any' then format('coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_all' then format('coalesce(%s ?& %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    when v_cast = 'text[]' and v_op = 'has_none' then format('not coalesce(%s ?| %L::text[], false)', v_expr, (select array_agg(value) from jsonb_array_elements_text(v_value)))
    else events.workspace__invalid()
  end;
end $$;

create or replace function events.workspace_query(p_project uuid, p_event uuid, p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_object uuid := (p_plan->>'objectId')::uuid;
  v_where text;
  v_computed jsonb := '{}'::jsonb;
  v_select text := '';
  v_order text[] := '{}';
  v_link events.workspace_fields;
  v_target events.workspace_fields;
  v_fn text;
  v_expr text;
  item jsonb;
  v_terms text[];
  v_limit integer := (p_plan->>'limit')::integer;
  v_offset integer := coalesce((p_plan->>'offset')::integer, 0);
  v_rows jsonb;
  v_total bigint;
begin
  if not exists (select 1 from events.workspace_objects where id = v_object and project_id = p_project and event_id = p_event) then
    perform events.workspace__fail('Unknown object');
  end if;
  if v_limit is null or v_limit < 1 or v_limit > 200 or v_offset < 0 or v_offset > 100000 then perform events.workspace__fail('Invalid filter'); end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'computed', '[]'::jsonb)) loop
    if (item->>'alias') !~ '^c[0-9]{1,3}$' or not exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid
      and object_id = v_object and type = item->>'kind' and deleted_at is null and type in ('lookup', 'rollup')) then
      perform events.workspace__fail('Invalid filter');
    end if;
    select * into v_link from events.workspace_fields where id = (item->>'linkFieldId')::uuid and object_id = v_object
      and type = 'link_record' and deleted_at is null;
    if not found then perform events.workspace__fail('Invalid filter'); end if;
    v_target := null;
    if item->>'targetFieldId' is not null then
      select * into v_target from events.workspace_fields where id = (item->>'targetFieldId')::uuid
        and object_id = (v_link.config->>'targetObjectId')::uuid and deleted_at is null;
      if not found then perform events.workspace__fail('Invalid filter'); end if;
    end if;
    v_fn := coalesce(item->>'fn', 'count');
    if item->>'kind' = 'lookup' then
      if v_target.id is null then perform events.workspace__fail('Invalid filter'); end if;
      v_expr := format('(select string_agg(t.data->>%L, '', '' order by l.position) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')', v_target.id, v_link.id);
    elsif v_fn = 'count' then
      v_expr := format('(select count(*) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')::numeric', v_link.id);
    elsif v_fn in ('sum', 'avg', 'min', 'max') and v_target.id is not null then
      v_expr := format('(select %s(case when jsonb_typeof(t.data->%L) = ''number'' then (t.data->>%L)::numeric end) from events.workspace_links l join events.workspace_records t on t.id = l.target_id and t.deleted_at is null where l.source_record_id = r.id and l.field_id = %L and l.target_kind = ''record'')',
        v_fn, v_target.id, v_target.id, v_link.id);
    else
      perform events.workspace__fail('Invalid filter');
    end if;
    v_computed := v_computed || jsonb_build_object(item->>'alias', v_expr);
    v_select := v_select || format(', %L, %s', item->>'fieldId', v_expr);
  end loop;

  v_where := format('r.project_id = %L and r.event_id = %L and r.object_id = %L and r.deleted_at is %s null',
    p_project, p_event, v_object, case when coalesce((p_plan->>'deleted')::boolean, false) then 'not' else '' end);
  if p_plan->'filter' is not null and p_plan->'filter' <> 'null'::jsonb then
    v_where := v_where || ' and ' || events.workspace__condition_sql(v_object, p_plan->'filter', v_computed, 1);
  end if;
  if jsonb_typeof(p_plan->'search') = 'array' and jsonb_array_length(p_plan->'search') > 0 then
    select array_agg(value) into v_terms from jsonb_array_elements_text(p_plan->'search') where value ~ '^[[:alnum:]]{1,50}$';
    if v_terms is not null then
      v_where := v_where || format(' and (r.search @@ to_tsquery(''simple'', %L)%s)',
        array_to_string(array(select t || ':*' from unnest(v_terms) t), ' & '),
        case when cardinality(v_terms) = 1 and v_terms[1] ~ '^[0-9]{1,15}$' then format(' or r.number = %s', v_terms[1]) else '' end);
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_plan->'sort', '[]'::jsonb)) loop
    v_expr := case item->>'source'
      when 'system' then case item->>'column' when 'number' then 'r.number' when 'title' then 'lower(r.title)' when 'status' then 'r.status'
        when 'created_at' then 'r.created_at' when 'updated_at' then 'r.updated_at' end
      when 'computed' then v_computed->>(item->>'alias')
      when 'value' then case when exists (select 1 from events.workspace_fields where id = (item->>'fieldId')::uuid and object_id = v_object and deleted_at is null
        and type not in ('link_record', 'link_event', 'lookup', 'rollup', 'multi_select', 'attachments'))
        then events.workspace__value_sql(item->>'fieldId', case when item->>'cast' in ('text', 'numeric', 'boolean', 'date', 'timestamptz') then item->>'cast' end) end
    end;
    if v_expr is null then perform events.workspace__fail('Invalid filter'); end if;
    v_order := v_order || format('%s %s nulls last', v_expr, case when item->>'dir' = 'desc' then 'desc' else 'asc' end);
  end loop;
  v_order := v_order || 'r.number asc'::text;

  execute format('select count(*) from events.workspace_records r where %s', v_where) into v_total;
  execute format(
    'select coalesce(jsonb_agg(q.j order by q.ord), ''[]''::jsonb) from (
       select events.workspace__record_json(r) || jsonb_build_object(''computed'', jsonb_build_object(''_'', null%s) - ''_'') as j,
         row_number() over (order by %s) as ord
       from events.workspace_records r where %s order by %s limit %s offset %s) q',
    v_select, array_to_string(v_order, ', '), v_where, array_to_string(v_order, ', '), v_limit, v_offset) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

create or replace function events.workspace__undo(p_project uuid, p_event uuid, p_actor uuid, p_change uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c events.workspace_changes;
  item jsonb;
  v_ids uuid[];
  f events.workspace_fields;
begin
  select * into c from events.workspace_changes where id = p_change and project_id = p_project and event_id = p_event for update;
  if not found then perform events.workspace__fail('Unknown change'); end if;
  if c.undone_at is not null or c.undo_of is not null then perform events.workspace__fail('Change cannot be undone'); end if;
  case c.action
    when 'object.create' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.delete' then perform events.workspace__object_restore(p_project, p_event, p_actor, c.object_id, false);
    when 'object.restore' then perform events.workspace__object_delete(p_project, p_event, p_actor, c.object_id, false);
    when 'object.update' then
      perform events.workspace__object(p_project, p_event, c.object_id);
      perform events.workspace__object_apply(c.object_id, c.before->'object');
      for item in select * from jsonb_array_elements(coalesce(c.before->'recordStatuses', '[]'::jsonb)) loop
        update events.workspace_records set status = item->>'status' where id = (item->>'id')::uuid and object_id = c.object_id;
      end loop;
    when 'field.create' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.delete' then perform events.workspace__field_restore(p_project, p_event, p_actor, c.field_id, false);
    when 'field.restore' then perform events.workspace__field_delete(p_project, p_event, p_actor, c.field_id, false);
    when 'field.update' then
      f := events.workspace__field(p_project, p_event, c.field_id);
      if f.deleted_at is not null then perform events.workspace__fail('Change cannot be undone'); end if;
      f := events.workspace__field_apply(f.id, c.before->'field');
      for item in select * from jsonb_array_elements(coalesce(c.before->'values', '[]'::jsonb)) loop
        perform events.workspace__set_values((item->>'recordId')::uuid, f.id, item->'value');
      end loop;
      if f.is_unique then perform events.workspace__sync_unique(p_project, p_event, null, f.object_id, f.id);
      else delete from events.workspace_unique_values where field_id = f.id; end if;
    when 'records.delete' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_restore(p_project, p_event, p_actor, v_ids, false);
    when 'records.restore' then
      select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(c.after->'recordIds');
      perform events.workspace__records_delete(p_project, p_event, p_actor, v_ids, false);
    else perform events.workspace__fail('Change cannot be undone');
  end case;
  update events.workspace_changes set undone_at = now() where id = c.id;
  perform events.workspace__log(p_project, p_event, p_actor, c.kind, 'change.undo', c.object_id, c.field_id, c.record_id,
    null, jsonb_build_object('action', c.action), c.id);
  return jsonb_build_object('undone', c.id);
end $$;

create or replace function events.workspace_purge(p_before timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
  v_records integer;
begin
  update events.workspace_records r set data = r.data - f.id::text
    from events.workspace_fields f
    where f.deleted_at < p_before and r.object_id = f.object_id and r.data ? f.id::text;
  delete from events.workspace_objects where deleted_at < p_before;
  delete from events.workspace_fields where deleted_at < p_before;
  with gone as (delete from events.workspace_records where deleted_at < p_before returning 1)
    select count(*) into v_records from gone;
  delete from events.workspace_links l where l.target_kind = 'record'
    and not exists (select 1 from events.workspace_records r where r.id = l.target_id);
  with gone as (
    delete from events.workspace_files f where f.created_at < now() - interval '1 day'
      and not exists (select 1 from events.workspace_records r
        where r.project_id = f.project_id and r.event_id = f.event_id and strpos(r.data::text, f.id::text) > 0)
    returning f.path
  ) select coalesce(array_agg(path), '{}') into v_paths from gone;
  return jsonb_build_object('records', v_records, 'paths', to_jsonb(v_paths));
end $$;

drop function if exists events.workspace__portal_undo(uuid, uuid, events.workspace_changes);
drop function if exists events.workspace__page_live(uuid, uuid, uuid, boolean);
drop function if exists events.workspace__role_live(uuid, uuid, uuid, boolean);
drop function if exists events.workspace__page_apply(uuid, jsonb);
drop function if exists events.workspace__role_apply(uuid, jsonb);
drop function if exists events.workspace__portal_apply(uuid, uuid, jsonb);
drop function if exists events.workspace__page_json(events.workspace_pages);
drop function if exists events.workspace__role_json(events.workspace_roles);
drop function if exists events.workspace__portal_json(events.workspace_portals);
drop function if exists events.workspace__keys_allowed(text[], jsonb);
drop function if exists events.workspace__written_keys(uuid, jsonb, boolean);
drop function if exists events.workspace__record_matches(uuid, uuid, uuid, uuid, jsonb, jsonb);
drop function if exists events.workspace__plan_sql(uuid, uuid, jsonb);
drop function if exists events.workspace__condition_at(text, uuid, jsonb, jsonb, integer, integer);
drop function if exists events.workspace__value_at(text, text, text);
drop table if exists events.workspace_form_drafts, events.workspace_portal_tokens, events.workspace_portal_versions,
  events.workspace_pages, events.workspace_roles, events.workspace_portals cascade;
delete from events.workspace_command_receipts where actor_kind = 'portal';
alter table events.workspace_command_receipts drop constraint if exists workspace_command_receipts_pkey;
alter table events.workspace_command_receipts add constraint workspace_command_receipts_pkey primary key (project_id, event_id, actor_id, command_id);
alter table events.workspace_command_receipts drop column if exists actor_kind;
alter table events.workspace_comments drop column if exists actor_kind;
alter table events.workspace_changes drop column if exists actor_kind;
