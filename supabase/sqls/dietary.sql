-- ===========================================================================
-- Geiger Events — dietary & accessibility store
--
-- Backs the Dietary & Accessibility screen's two new surfaces:
--   * events.dietary_config   — one row per project: the post-purchase requests
--     master switch + prompt, and the reusable radio/multiselect "inquiry"
--     question set attached to ticket forms per event.
--   * events.dietary_requests — the inbox of free-text queries an attendee sends
--     from the order-success step after a completed sign-up.
--
-- Guidelines (the public informational blocks) are NOT here — they live in the
-- venue and event metadata bags (events.venues.metadata.guidelines /
-- events.events.metadata.guidelines) and need no table.
--
-- Two SECURITY DEFINER RPCs let the anonymous public page read the config and
-- file a request despite member-scoped RLS. Self-contained + idempotent.
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
-- Per-project config — the D&A screen's Requests + Inquiry settings.
-- ---------------------------------------------------------------------------
create table if not exists events.dietary_config (
  project_id uuid primary key references public.projects(id) on delete cascade,
  -- Master switch for the post-purchase request affordance (an event must also
  -- opt in via its metadata.dietaryRequests.enabled flag).
  requests_enabled boolean not null default false,
  request_prompt text,
  -- Optional intro shown above the inquiry in the ticket form.
  inquiry_title text,
  inquiry_description text,
  -- Ordered question defs: [{ id, label, type:'radio'|'multiselect', required,
  -- options:[{ id, label }] }].
  questions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events.dietary_config add column if not exists requests_enabled boolean not null default false;
alter table events.dietary_config add column if not exists request_prompt text;
alter table events.dietary_config add column if not exists inquiry_title text;
alter table events.dietary_config add column if not exists inquiry_description text;
alter table events.dietary_config add column if not exists questions jsonb not null default '[]'::jsonb;
alter table events.dietary_config add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists dietary_config_touch_updated_at on events.dietary_config;
create trigger dietary_config_touch_updated_at
before update on events.dietary_config
for each row execute function events.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Requests inbox — one row per submitted free-text query.
-- ---------------------------------------------------------------------------
create table if not exists events.dietary_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete cascade,
  registration_id uuid references events.registrations(id) on delete set null,
  name text not null default '',
  email text not null default '',
  message text not null default '',
  -- Open · Resolved
  status text not null default 'Open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table events.dietary_requests add column if not exists registration_id uuid references events.registrations(id) on delete set null;
alter table events.dietary_requests add column if not exists status text not null default 'Open';
alter table events.dietary_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.dietary_requests add column if not exists deleted_at timestamptz;

drop trigger if exists dietary_requests_touch_updated_at on events.dietary_requests;
create trigger dietary_requests_touch_updated_at
before update on events.dietary_requests
for each row execute function events.touch_updated_at();

create index if not exists events_dietary_requests_project_idx
  on events.dietary_requests (project_id) where deleted_at is null;
create index if not exists events_dietary_requests_event_idx
  on events.dietary_requests (event_id) where deleted_at is null;
create index if not exists events_dietary_requests_created_idx
  on events.dietary_requests (created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Public read of a project's D&A config for the anon event page. SECURITY
-- DEFINER so it works despite the member-scoped RLS on dietary_config. Returns
-- a single row of empty defaults when the project has no config yet.
create or replace function events.dietary_public_config(p_project_id uuid)
returns table (
  requests_enabled boolean,
  request_prompt text,
  inquiry_title text,
  inquiry_description text,
  questions jsonb
)
language sql
stable
security definer
set search_path = events, public
as $$
  select
    coalesce(c.requests_enabled, false),
    c.request_prompt,
    c.inquiry_title,
    c.inquiry_description,
    coalesce(c.questions, '[]'::jsonb)
  from (select p_project_id as pid) q
  left join events.dietary_config c on c.project_id = q.pid;
$$;

grant execute on function events.dietary_public_config(uuid) to anon, authenticated;

-- File a post-purchase request from the public order-success step. Derives
-- project_id from the event (never trusts a client-supplied project) and drops
-- blank messages. SECURITY DEFINER so the anon storefront can insert despite
-- member-scoped RLS. Returns the created row.
create or replace function events.submit_dietary_request(
  p_event_id uuid,
  p_registration_id uuid default null,
  p_name text default '',
  p_email text default '',
  p_message text default ''
)
returns events.dietary_requests
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
  r events.dietary_requests;
begin
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'EMPTY_MESSAGE';
  end if;

  select project_id into v_project from events.events where id = p_event_id;

  insert into events.dietary_requests
    (project_id, event_id, registration_id, name, email, message)
  values
    (v_project, p_event_id, p_registration_id,
     coalesce(p_name, ''), coalesce(p_email, ''), btrim(p_message))
  returning * into r;

  return r;
end;
$$;

grant execute on function events.submit_dietary_request(uuid, uuid, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Base demo policy (open) — zz_project_access.sql replaces it with the
-- authoritative member-scoped policy. Public reads/inserts go through the two
-- SECURITY DEFINER RPCs above, so no anon table policy is needed.
-- ---------------------------------------------------------------------------
alter table events.dietary_config enable row level security;
drop policy if exists events_dietary_config_demo_all on events.dietary_config;
create policy events_dietary_config_demo_all on events.dietary_config
  for all to anon, authenticated using (true) with check (true);

alter table events.dietary_requests enable row level security;
drop policy if exists events_dietary_requests_demo_all on events.dietary_requests;
create policy events_dietary_requests_demo_all on events.dietary_requests
  for all to anon, authenticated using (true) with check (true);
