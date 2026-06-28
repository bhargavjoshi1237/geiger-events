-- ===========================================================================
-- Geiger Events — event templates store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.event_templates table, its indexes, RLS, and seeds the six demo
-- templates with the SAME ids the app ships in sample_data.js so the screen
-- resolves to real rows once the DB is live.
--
-- A template is a reusable starting point: its `blueprint` (stored in the
-- metadata bag) holds the event defaults applied when you "Use" it to spin up a
-- new draft event. `uses` tracks how many events were created from it.
--
-- Depends on events.touch_updated_at() (events.sql). Apply via the Supabase
-- SQL editor (or `npm run db:push`).
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled template',
  description text,
  category text not null default 'Community',
  -- Lucide icon name (string) — the screen maps it to a component. Kept as data
  -- so the table carries no JSX coupling.
  icon text not null default 'Sparkles',
  uses integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag. `blueprint` lives here: the event defaults (type, capacity,
  -- visibility, timezone, summary, …) applied when the template is used.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.event_templates add column if not exists description text;
alter table events.event_templates add column if not exists category text not null default 'Community';
alter table events.event_templates add column if not exists icon text not null default 'Sparkles';
alter table events.event_templates add column if not exists uses integer not null default 0;
alter table events.event_templates add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.event_templates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.event_templates add column if not exists deleted_at timestamptz;

drop trigger if exists event_templates_touch_updated_at on events.event_templates;
create trigger event_templates_touch_updated_at
before update on events.event_templates
for each row execute function events.touch_updated_at();

create index if not exists flow_event_templates_category_idx
  on events.event_templates (category) where deleted_at is null;
create index if not exists flow_event_templates_created_idx
  on events.event_templates (created_at desc);

-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
alter table events.event_templates enable row level security;

drop policy if exists flow_event_templates_demo_all on events.event_templates;
create policy flow_event_templates_demo_all on events.event_templates
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Seed — same ids as components/internal/screens/events/sample_data.js.
insert into events.event_templates
  (id, name, description, category, icon, uses, metadata)
values
  ('11111111-1111-4111-8111-000000000001', 'Meetup', 'Talks + networking, free RSVP, one ticket type.', 'Community', 'Users', 42,
   '{"blueprint":{"type":"In-person","capacity":80,"visibility":"Public","timezone":"Europe/London","summary":"An evening of short talks and relaxed networking."}}'::jsonb),
  ('11111111-1111-4111-8111-000000000002', 'Concert / Gig', 'Paid tickets, tiers, door sales, capacity cap.', 'Music', 'Music', 28,
   '{"blueprint":{"type":"In-person","capacity":300,"visibility":"Public","timezone":"Europe/London","summary":"A live night out — doors, support, and a headline set."}}'::jsonb),
  ('11111111-1111-4111-8111-000000000003', 'Workshop', 'Limited seats, custom questions, materials add-on.', 'Education', 'GraduationCap', 35,
   '{"blueprint":{"type":"In-person","capacity":30,"visibility":"Public","timezone":"Europe/London","summary":"A hands-on session with limited seats and materials provided."}}'::jsonb),
  ('11111111-1111-4111-8111-000000000004', 'Webinar', 'Online, registration form, automated reminders.', 'Online', 'Video', 51,
   '{"blueprint":{"type":"Online","capacity":500,"visibility":"Public","timezone":"Europe/London","summary":"A live online session — register to get the join link."}}'::jsonb),
  ('11111111-1111-4111-8111-000000000005', 'Conference Talk', 'Multi-session agenda, speakers, sponsor slots.', 'Conference', 'Mic', 17,
   '{"blueprint":{"type":"Hybrid","capacity":250,"visibility":"Public","timezone":"Europe/London","summary":"A flagship talk with speakers, an agenda, and sponsor moments."}}'::jsonb),
  ('11111111-1111-4111-8111-000000000006', 'Party', 'Guest list, plus-ones, who''s going, photo album.', 'Social', 'PartyPopper', 23,
   '{"blueprint":{"type":"In-person","capacity":120,"visibility":"Unlisted","timezone":"Europe/London","summary":"A guest-list party with plus-ones and a shared photo album."}}'::jsonb)
on conflict (id) do nothing;
