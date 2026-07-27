-- ===========================================================================
-- Geiger Events — Guests / contacts store
--
-- Backs the Guests workspace area. Four tables, all in the dedicated `events`
-- schema, project-scoped:
--   * events.contacts          — the contact-book master record (one row per
--     person). Also the source for Blocklist (blocked = true) and the derived
--     Guest List (contacts joined to registrations/orders in the data layer).
--   * events.contact_segments  — saved DYNAMIC audience filters (rules jsonb);
--     membership is recomputed client-side, so there is no membership table.
--   * events.contact_activity  — per-contact interaction log (Communication
--     History): channel / direction / subject, newest-first.
--   * events.data_requests     — the GDPR export/erasure/rectification queue.
--
-- Plus events.merge_contacts() — the Dedupe & Merge tool's atomic merge.
--
-- Self-contained + idempotent. The demo-open RLS policy here is REPLACED by the
-- authoritative org-scoped policy in zz_project_access.sql (runs last).
-- Apply via the Supabase SQL editor or `npm run db:push`.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger fn (suite convention; defined locally so
-- this migration doesn't depend on another having run).
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts — the contact-book master record.
-- ---------------------------------------------------------------------------
create table if not exists events.contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text,
  company text,
  title text,
  location text,
  -- Lead · Active · VIP · Archived (CRM lifecycle; attendance is derived).
  status text not null default 'Active',
  tags text[] not null default '{}',
  -- Marketing consent, tracked independently of status.
  consent_email boolean not null default false,
  consent_sms boolean not null default false,
  consent_updated_at timestamptz,
  -- Blocklist flags.
  blocked boolean not null default false,
  blocked_reason text,
  blocked_at timestamptz,
  avatar_url text,
  -- Expansion bag; metadata.notes = [{ id, body, createdAt, createdBy }].
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill missing columns on older copies.
alter table events.contacts add column if not exists company text;
alter table events.contacts add column if not exists title text;
alter table events.contacts add column if not exists location text;
alter table events.contacts add column if not exists tags text[] not null default '{}';
alter table events.contacts add column if not exists consent_email boolean not null default false;
alter table events.contacts add column if not exists consent_sms boolean not null default false;
alter table events.contacts add column if not exists consent_updated_at timestamptz;
alter table events.contacts add column if not exists blocked boolean not null default false;
alter table events.contacts add column if not exists blocked_reason text;
alter table events.contacts add column if not exists blocked_at timestamptz;
alter table events.contacts add column if not exists avatar_url text;
alter table events.contacts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.contacts add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.contacts add column if not exists deleted_at timestamptz;

drop trigger if exists contacts_touch_updated_at on events.contacts;
create trigger contacts_touch_updated_at
before update on events.contacts
for each row execute function events.touch_updated_at();

create index if not exists events_contacts_project_idx
  on events.contacts (project_id) where deleted_at is null;
-- Dedupe / guest-join key: normalized email within a project (not unique —
-- duplicates are expected and resolved by the Dedupe & Merge tool).
create index if not exists events_contacts_project_email_idx
  on events.contacts (project_id, lower(email)) where deleted_at is null;
create index if not exists events_contacts_created_idx
  on events.contacts (created_at desc);

-- ---------------------------------------------------------------------------
-- contact_segments — saved dynamic audience filters.
-- ---------------------------------------------------------------------------
create table if not exists events.contact_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Untitled segment',
  description text,
  -- AND-combined clauses: [{ field, op, value }].
  rules jsonb not null default '[]'::jsonb,
  -- Tag-style token for the segment pill.
  color text not null default 'slate',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.contact_segments add column if not exists description text;
alter table events.contact_segments add column if not exists rules jsonb not null default '[]'::jsonb;
alter table events.contact_segments add column if not exists color text not null default 'slate';
alter table events.contact_segments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.contact_segments add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.contact_segments add column if not exists deleted_at timestamptz;

drop trigger if exists contact_segments_touch_updated_at on events.contact_segments;
create trigger contact_segments_touch_updated_at
before update on events.contact_segments
for each row execute function events.touch_updated_at();

create index if not exists events_contact_segments_project_idx
  on events.contact_segments (project_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- contact_activity — per-contact interaction log (Communication History).
-- ---------------------------------------------------------------------------
create table if not exists events.contact_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid not null references events.contacts(id) on delete cascade,
  -- Email · SMS · Call · Note · System
  channel text not null default 'Note',
  -- Outbound · Inbound · Internal
  direction text not null default 'Internal',
  subject text not null default '',
  body text not null default '',
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.contact_activity add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.contact_activity add column if not exists deleted_at timestamptz;

drop trigger if exists contact_activity_touch_updated_at on events.contact_activity;
create trigger contact_activity_touch_updated_at
before update on events.contact_activity
for each row execute function events.touch_updated_at();

create index if not exists events_contact_activity_contact_idx
  on events.contact_activity (contact_id) where deleted_at is null;
create index if not exists events_contact_activity_occurred_idx
  on events.contact_activity (occurred_at desc);

-- ---------------------------------------------------------------------------
-- data_requests — GDPR export / erasure / rectification queue.
-- ---------------------------------------------------------------------------
create table if not exists events.data_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Nullable: a request may reference a raw email with no contact row yet.
  contact_id uuid references events.contacts(id) on delete set null,
  email text not null default '',
  -- Export · Erasure · Rectification
  type text not null default 'Export',
  -- New · In Progress · Completed · Rejected
  status text not null default 'New',
  note text,
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.data_requests add column if not exists note text;
alter table events.data_requests add column if not exists due_at timestamptz not null default (now() + interval '30 days');
alter table events.data_requests add column if not exists resolved_at timestamptz;
alter table events.data_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.data_requests add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.data_requests add column if not exists deleted_at timestamptz;

drop trigger if exists data_requests_touch_updated_at on events.data_requests;
create trigger data_requests_touch_updated_at
before update on events.data_requests
for each row execute function events.touch_updated_at();

create index if not exists events_data_requests_project_idx
  on events.data_requests (project_id) where deleted_at is null;
create index if not exists events_data_requests_created_idx
  on events.data_requests (created_at desc);

-- ---------------------------------------------------------------------------
-- merge_contacts — the Dedupe & Merge tool's atomic merge.
--   Folds losers into the survivor: union tags, OR consent/blocked flags,
--   concat metadata.notes[], repoint activity + data_requests, soft-delete the
--   losers. SECURITY INVOKER (default) so RLS still scopes it to the caller's
--   project. Returns the merged survivor row.
-- ---------------------------------------------------------------------------
create or replace function events.merge_contacts(p_survivor uuid, p_losers uuid[])
returns events.contacts
language plpgsql
as $$
declare
  r events.contacts;
  v_tags text[] := '{}';
  v_email boolean := false;
  v_sms boolean := false;
  v_blocked boolean := false;
  v_notes jsonb := '[]'::jsonb;
begin
  if p_survivor is null or p_losers is null then
    raise exception 'MERGE_MISSING_ARGS';
  end if;

  -- Union tags across survivor + losers.
  select coalesce(array_agg(distinct tg), '{}')
    into v_tags
    from events.contacts c
    cross join lateral unnest(coalesce(c.tags, '{}'::text[])) as tg
    where c.id = p_survivor or c.id = any(p_losers);

  -- OR the consent + blocked flags.
  select bool_or(coalesce(consent_email, false)),
         bool_or(coalesce(consent_sms, false)),
         bool_or(coalesce(blocked, false))
    into v_email, v_sms, v_blocked
    from events.contacts
    where id = p_survivor or id = any(p_losers);

  -- Concat every contact's notes into one list.
  select coalesce(jsonb_agg(n), '[]'::jsonb)
    into v_notes
    from events.contacts c
    cross join lateral jsonb_array_elements(
      coalesce(c.metadata->'notes', '[]'::jsonb)
    ) as n
    where c.id = p_survivor or c.id = any(p_losers);

  -- Repoint children onto the survivor.
  update events.contact_activity set contact_id = p_survivor
    where contact_id = any(p_losers);
  update events.data_requests set contact_id = p_survivor
    where contact_id = any(p_losers);

  -- Retire the losers.
  update events.contacts set deleted_at = now()
    where id = any(p_losers);

  -- Write the merged fields onto the survivor.
  update events.contacts s set
      tags = v_tags,
      consent_email = v_email,
      consent_sms = v_sms,
      blocked = v_blocked,
      metadata = jsonb_set(coalesce(s.metadata, '{}'::jsonb), '{notes}', v_notes, true)
    where s.id = p_survivor
    returning * into r;

  return r;
end;
$$;

grant execute on function events.merge_contacts(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Base demo policy (open) — zz_project_access.sql replaces each with the
-- authoritative member-scoped policy. The Guests area has no public surface,
-- so no anon policy is needed.
-- ---------------------------------------------------------------------------
alter table events.contacts enable row level security;
drop policy if exists events_contacts_demo_all on events.contacts;
create policy events_contacts_demo_all on events.contacts
  for all to anon, authenticated using (true) with check (true);

alter table events.contact_segments enable row level security;
drop policy if exists events_contact_segments_demo_all on events.contact_segments;
create policy events_contact_segments_demo_all on events.contact_segments
  for all to anon, authenticated using (true) with check (true);

alter table events.contact_activity enable row level security;
drop policy if exists events_contact_activity_demo_all on events.contact_activity;
create policy events_contact_activity_demo_all on events.contact_activity
  for all to anon, authenticated using (true) with check (true);

alter table events.data_requests enable row level security;
drop policy if exists events_data_requests_demo_all on events.data_requests;
create policy events_data_requests_demo_all on events.data_requests
  for all to anon, authenticated using (true) with check (true);
