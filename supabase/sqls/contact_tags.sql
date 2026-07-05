-- ===========================================================================
-- Geiger Events — contact tag catalog
--
-- Backs the Guests > Tags screen. Tag MEMBERSHIP still lives in the
-- events.contacts.tags text[] column (a contact carries its own tags); this
-- catalog only stores per-tag presentation (color, description) plus a stable
-- id, so the Tags screen can recolor/rename/merge/delete a tag across the whole
-- project. Usage counts are derived from contacts.tags in the data layer.
--
-- events.rewrite_contact_tags() is the atomic array rewrite behind rename
-- (1 -> 1), merge (N -> 1), and delete (-> removed).
--
-- Self-contained + idempotent. The demo-open RLS policy here is REPLACED by the
-- authoritative org-scoped policy in zz_project_access.sql (runs last).
-- Apply via the Supabase SQL editor or `npm run db:push`.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger fn (defined locally so this migration
-- doesn't depend on another having run).
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
-- contact_tags — the tag vocabulary catalog (presentation only).
-- ---------------------------------------------------------------------------
create table if not exists events.contact_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default '',
  -- Pill color token (slate · emerald · sky · amber · violet · rose).
  color text not null default 'slate',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.contact_tags add column if not exists description text;
alter table events.contact_tags add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.contact_tags add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.contact_tags add column if not exists deleted_at timestamptz;

drop trigger if exists contact_tags_touch_updated_at on events.contact_tags;
create trigger contact_tags_touch_updated_at
before update on events.contact_tags
for each row execute function events.touch_updated_at();

create index if not exists events_contact_tags_project_idx
  on events.contact_tags (project_id) where deleted_at is null;
-- One catalog row per tag name within a project (case-insensitive).
create unique index if not exists events_contact_tags_project_name_idx
  on events.contact_tags (project_id, lower(name)) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- rewrite_contact_tags — atomic tag-array rewrite across a project's contacts.
--   p_from : the tag(s) to match on each contact.
--   p_to   : the replacement. NULL/'' removes the matched tag(s).
--   Every matched contact's tags array is rebuilt: each element in p_from maps
--   to p_to (or is dropped), then the array is de-duplicated and nulls removed.
--   Returns the number of contacts touched. SECURITY INVOKER (default) so RLS
--   still scopes it to the caller's project.
-- ---------------------------------------------------------------------------
create or replace function events.rewrite_contact_tags(
  p_project uuid,
  p_from text[],
  p_to text
)
returns integer
language plpgsql
as $$
declare
  n integer := 0;
begin
  if p_project is null or p_from is null or array_length(p_from, 1) is null then
    return 0;
  end if;

  with upd as (
    update events.contacts c
    set tags = coalesce((
      select array_agg(distinct nt order by nt)
      from (
        select case when elem = any(p_from) then nullif(p_to, '') else elem end as nt
        from unnest(c.tags) as elem
      ) s
      where s.nt is not null
    ), '{}')
    where c.project_id = p_project
      and c.deleted_at is null
      and c.tags && p_from
    returning 1
  )
  select count(*) into n from upd;

  return n;
end;
$$;

grant execute on function events.rewrite_contact_tags(uuid, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Base demo policy (open) — zz_project_access.sql replaces it with the
-- authoritative member-scoped policy. The Tags catalog has no public surface.
-- ---------------------------------------------------------------------------
alter table events.contact_tags enable row level security;
drop policy if exists events_contact_tags_demo_all on events.contact_tags;
create policy events_contact_tags_demo_all on events.contact_tags
  for all to anon, authenticated using (true) with check (true);
