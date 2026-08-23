-- Package enquiries — the "talk to us first" route on an event's packages page
--
-- A VIP package can be set to collect enquiries instead of taking payment, and
-- the packages page also carries a general enquiry form. Both write here.
--
-- The submitter is never signed in, so anon needs INSERT. It must NOT get
-- SELECT: these rows carry a name, an email and a phone number, and a readable
-- enquiries table would be a lead list anyone could scrape. Reads are for
-- project members only, through the same membership helper the rest of the
-- events schema uses.
--
-- Packages themselves live in the event's metadata bag (see lib/events/packages.js)
-- — only the inbound submissions need a table, because only they are written by
-- the public.
--
-- Owns: events.package_enquiries and its policies.

-- @up
create schema if not exists events;

create table if not exists events.package_enquiries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  -- Which package they asked about. Text, not a FK: packages live in the event's
  -- metadata and can be renamed or removed without orphaning an enquiry.
  package_id text,
  package_name text,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  quantity integer,
  message text not null default '',
  -- Where the organiser wanted these sent, captured at submit time so a later
  -- settings change doesn't rewrite the history of who was told what.
  recipient text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists package_enquiries_event_idx
  on events.package_enquiries (event_id, created_at desc)
  where deleted_at is null;

alter table events.package_enquiries enable row level security;

-- Anyone may submit. No USING clause exists for INSERT — WITH CHECK is the only
-- gate, and it deliberately allows any project/event pair because an anonymous
-- visitor cannot be asked to prove which event they are looking at. The columns
-- are all free text the organiser already expects from a form.
drop policy if exists package_enquiries_public_insert on events.package_enquiries;
create policy package_enquiries_public_insert on events.package_enquiries
  for insert
  to anon, authenticated
  with check (true);

-- Reading, updating and deleting stay with the project's members.
drop policy if exists package_enquiries_member_all on events.package_enquiries;
create policy package_enquiries_member_all on events.package_enquiries
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));
