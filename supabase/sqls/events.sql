-- ===========================================================================
-- Geiger Events — events store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the shared
-- updated_at trigger function, the events.events table, its indexes, RLS,
-- and seeds the eight demo events with the SAME UUIDs the app ships in
-- sample_data.js so existing /e/<uuid> links resolve to real rows.
--
-- Apply via the Supabase SQL editor (or psql) for the project in .env.
-- ===========================================================================

create extension if not exists pgcrypto;

-- This app's objects live in the dedicated `events` schema. The `events` schema
-- must also be present in PostgREST's exposed-schemas list (managed at the
-- Supabase project level — already configured for this project).
create schema if not exists events;
grant usage on schema events to anon, authenticated, service_role;
alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
alter default privileges in schema events grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema events grant all on routines to anon, authenticated, service_role;

-- Shared "touch updated_at" trigger function (suite convention). Defined here
-- so this migration doesn't depend on the core migration having run.
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.events (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled event',
  status text not null default 'Draft',
  type text not null default 'In-person',
  event_date date,
  event_time text,
  venue text,
  address text,
  city text,
  timezone text not null default 'Europe/London',
  capacity integer not null default 0,
  sold integer not null default 0,
  revenue numeric(14, 2) not null default 0,
  visibility text not null default 'Public',
  organizer text,
  summary text,
  -- Direct public URLs of uploaded images (Supabase Storage, bucket "products",
  -- folder events/<id>/). cover_url is the hero; gallery is an ordered list.
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,
  -- The owner. Only this user may upload/replace this event's images.
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag: store not-yet-promoted attributes (page design, ticket
  -- tiers, custom questions…) here without a migration. Promote to a real
  -- column once a field needs indexing, constraints, or its own RLS.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.events add column if not exists address text;
alter table events.events add column if not exists timezone text not null default 'Europe/London';
alter table events.events add column if not exists summary text;
alter table events.events add column if not exists cover_url text;
alter table events.events add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table events.events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.events add column if not exists deleted_at timestamptz;

drop trigger if exists events_touch_updated_at on events.events;
create trigger events_touch_updated_at
before update on events.events
for each row execute function events.touch_updated_at();

create index if not exists flow_events_status_idx
  on events.events (status) where deleted_at is null;
create index if not exists flow_events_created_idx
  on events.events (created_at desc);

-- RLS. The events dashboard currently runs unauthenticated (anon key), so the
-- demo policy below grants open access. When auth lands, replace this with an
-- organization-scoped policy (see public.flow_is_org_member in the core
-- migration) and drop the open policy.
alter table events.events enable row level security;

drop policy if exists flow_events_demo_all on events.events;
create policy flow_events_demo_all on events.events
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Seed — same UUIDs as components/internal/screens/events/sample_data.js.
insert into events.events
  (id, name, status, type, event_date, event_time, venue, address, city, timezone, capacity, sold, revenue, visibility, organizer, summary)
values
  ('7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01', 'Summer Product Launch', 'On sale', 'Hybrid', '2026-06-18', '18:00', 'The Glasshouse', '61 Southwark Street, London SE1 0HL', 'London', 'Europe/London', 400, 312, 9840, 'Public', 'Ava Mitchell', 'An evening unveiling our biggest release yet — talks, live demos, and drinks.'),
  ('a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02', 'Local Music Night', 'Sold out', 'In-person', '2026-06-12', '20:00', 'Basement 45', 'Frogmore Street, Bristol BS1 5NA', 'Bristol', 'Europe/London', 300, 300, 5400, 'Public', 'Marco Reyes', 'Three local bands, one tiny basement, and a very loud night out.'),
  ('c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03', 'Founder AMA — Live', 'On sale', 'Online', '2026-06-20', '16:00', 'Zoom Webinar', 'Online — link sent on registration', 'Remote', 'Europe/London', 150, 128, 3120, 'Unlisted', 'Ava Mitchell', 'Ask our founders anything — product, fundraising, and lessons learned.'),
  ('d4f618ac-3d5e-4f70-ab12-4c5d6e7f8004', 'Design Systems Workshop', 'Draft', 'In-person', '2026-07-02', '10:00', 'WeWork Moorgate', '1 Fore Street Avenue, London EC2Y 9DT', 'London', 'Europe/London', 80, 54, 2160, 'Private', 'Priya Shah', 'A hands-on day building a scalable design system from tokens to components.'),
  ('e50729bd-4e6f-4081-bc23-5d6e7f809105', 'Indie Film Screening', 'On sale', 'In-person', '2026-06-28', '19:30', 'The Ritzy', 'Brixton Oval, London SW2 1JG', 'London', 'Europe/London', 120, 74, 1480, 'Public', 'Marco Reyes', 'A première screening followed by a Q&A with the director and cast.'),
  ('f61830ce-5f70-4192-cd34-6e7f8091a206', 'Startup Networking Brunch', 'Scheduled', 'In-person', '2026-07-11', '11:00', 'Caravan King''s Cross', '1 Granary Square, London N1C 4AA', 'London', 'Europe/London', 90, 0, 0, 'Public', 'Priya Shah', 'Founders, operators, and investors over brunch — relaxed, no pitches.'),
  ('072941df-6081-42a3-de45-7f8091a2b307', 'Q2 Customer Webinar', 'Ended', 'Online', '2026-05-22', '15:00', 'Geiger Live', 'Online — link sent on registration', 'Remote', 'Europe/London', 500, 438, 0, 'Public', 'Ava Mitchell', 'A walkthrough of everything we shipped this quarter, plus a live roadmap Q&A.'),
  ('183a52e0-7192-43b4-ef56-8091a2b3c408', 'Pottery Masterclass', 'On sale', 'In-person', '2026-07-05', '14:00', 'Turning Earth', 'Argall Avenue, London E10 7QE', 'London', 'Europe/London', 24, 19, 1140, 'Public', 'Lena Okafor', 'A beginner-friendly afternoon at the wheel — clay, glaze, and a piece to take home.')
on conflict (id) do nothing;
