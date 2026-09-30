-- @up
-- Sponsor enquiries — interest submitted from an event's public sponsorship page.
-- Spots and fills live in the event's metadata bag (lib/events/sponsorship.js); only anonymous submissions need a table.
-- anon may INSERT a fresh row but never SELECT it: these rows are a lead list of names, companies and emails.

create schema if not exists events;

create table if not exists events.sponsor_enquiries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id uuid not null,
  -- Text, not a FK: spots live in event metadata and can be renamed or removed.
  spot_id text,
  spot_name text not null default '',
  company text not null default '',
  contact_name text not null default '',
  email text not null default '',
  -- Custom form answers, snapshotted with their labels: [{ id, label, value }].
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'declined')),
  -- The conference_records sponsor this enquiry became, once converted.
  sponsor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sponsor_enquiries_event_idx
  on events.sponsor_enquiries (event_id, created_at desc)
  where deleted_at is null;

drop trigger if exists sponsor_enquiries_touch on events.sponsor_enquiries;
create trigger sponsor_enquiries_touch
  before update on events.sponsor_enquiries
  for each row execute function events.touch_updated_at();

alter table events.sponsor_enquiries enable row level security;

-- Anyone may submit, but only a fresh, unconverted, undeleted row.
drop policy if exists sponsor_enquiries_public_insert on events.sponsor_enquiries;
create policy sponsor_enquiries_public_insert on events.sponsor_enquiries
  for insert
  to anon, authenticated
  with check (status = 'new' and sponsor_id is null and deleted_at is null);

-- Reading, triage and conversion stay with the project's members.
drop policy if exists sponsor_enquiries_member_all on events.sponsor_enquiries;
create policy sponsor_enquiries_member_all on events.sponsor_enquiries
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

-- @down
drop table if exists events.sponsor_enquiries;
