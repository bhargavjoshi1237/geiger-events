-- Workspace documents: email templates and PDF documents built from a record's fields, and issued certificates anyone
-- can check at /e/<eventId>/verify/<code>. Only the service role can reach the tables; the public check goes through
-- events.workspace_certificate_public, which returns only what the verification page shows.
-- @up

create table if not exists events.workspace_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  kind text not null check (kind in ('email', 'pdf')),
  name text not null check (length(name) between 1 and 120),
  object_id uuid,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 524288),
  revision bigint not null default 1 check (revision > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

-- An issued certificate keeps a snapshot of what it certified, so it still verifies after the record changes or is purged.
create table if not exists events.workspace_certificates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  document_id uuid references events.workspace_documents (id) on delete set null,
  record_id uuid,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  title text not null default '' check (length(title) <= 200),
  holder text not null default '' check (length(holder) <= 200),
  data jsonb not null default '[]'::jsonb check (jsonb_typeof(data) = 'array' and octet_length(data::text) <= 65536),
  file_id uuid,
  issued_by_kind text not null default 'staff' check (issued_by_kind in ('staff', 'automation', 'api')),
  issued_by uuid,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or length(revoked_reason) <= 500),
  foreign key (project_id, event_id) references events.workspace_workspaces on delete cascade
);

create index if not exists workspace_documents_event_idx on events.workspace_documents (project_id, event_id) where deleted_at is null;
create index if not exists workspace_certificates_event_idx on events.workspace_certificates (project_id, event_id, issued_at desc);
create index if not exists workspace_certificates_record_idx on events.workspace_certificates (record_id) where record_id is not null;
create index if not exists workspace_certificates_document_idx on events.workspace_certificates (document_id, record_id) where revoked_at is null;

do $$
declare t text;
begin
  foreach t in array array['workspace_documents', 'workspace_certificates'] loop
    execute format('alter table events.%I enable row level security', t);
    execute format('revoke all on events.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on events.%I to service_role', t);
  end loop;
end $$;

-- What the public verification page may show for one code on one event; null when there's no such certificate.
create or replace function events.workspace_certificate_public(p_event uuid, p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', c.code, 'title', c.title, 'holder', c.holder, 'data', c.data, 'issuedAt', c.issued_at,
    'revokedAt', c.revoked_at, 'revokedReason', c.revoked_reason, 'eventId', c.event_id, 'eventName', coalesce(e.name, ''))
  from events.workspace_certificates c
  left join events.events e on e.id = c.event_id
  where c.event_id = p_event and c.code = upper(p_code)
  limit 1
$$;

-- Purge also keeps files a certificate points at, even after they were taken off the record.
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
      and not exists (select 1 from events.workspace_certificates c where c.file_id = f.id)
    returning f.path
  ) select coalesce(array_agg(path), '{}') into v_paths from gone;
  delete from events.workspace_roles where deleted_at < p_before;
  delete from events.workspace_pages where deleted_at < p_before;
  delete from events.workspace_portal_tokens where coalesce(used_at, revoked_at, expires_at) < now() - interval '30 days';
  delete from events.workspace_form_drafts where updated_at < now() - interval '90 days';
  delete from events.workspace_documents where deleted_at < p_before
    and not exists (select 1 from events.workspace_certificates c where c.document_id = workspace_documents.id);
  return jsonb_build_object('records', v_records, 'paths', to_jsonb(v_paths));
end $$;

revoke all on function events.workspace_certificate_public(uuid, text) from public, anon, authenticated;
grant execute on function events.workspace_certificate_public(uuid, text) to service_role;
revoke all on function events.workspace_purge(timestamptz) from public, anon, authenticated;
grant execute on function events.workspace_purge(timestamptz) to service_role;

-- @down
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
revoke all on function events.workspace_purge(timestamptz) from public, anon, authenticated;
grant execute on function events.workspace_purge(timestamptz) to service_role;
drop function if exists events.workspace_certificate_public(uuid, text);
drop table if exists events.workspace_certificates, events.workspace_documents cascade;
