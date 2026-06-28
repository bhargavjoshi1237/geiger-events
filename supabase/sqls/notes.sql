-- ===========================================================================
-- Geiger Events — per-event pre-launch notes
--
-- Self-contained and idempotent. Depends on events.events (events.sql).
-- One row per event holding the organizer's pre-launch checklist as a JSON
-- array of { id, text, done } items, so the list can grow/shrink without a
-- migration. Reuses the shared events.touch_updated_at trigger from events.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.event_notes (
  -- One notes row per event; the event id is the primary key (upsert target).
  event_id uuid primary key references events.events(id) on delete cascade,
  -- Ordered checklist: [{ id: text, text: text, done: bool }, ...].
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists event_notes_touch_updated_at on events.event_notes;
create trigger event_notes_touch_updated_at
before update on events.event_notes
for each row execute function events.touch_updated_at();

-- Demo-open RLS (the dashboard runs unauthenticated). Tighten once auth lands.
alter table events.event_notes enable row level security;

drop policy if exists flow_event_notes_demo_all on events.event_notes;
create policy flow_event_notes_demo_all on events.event_notes
  for all
  to anon, authenticated
  using (true)
  with check (true);
