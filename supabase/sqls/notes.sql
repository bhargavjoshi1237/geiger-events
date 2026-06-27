-- ===========================================================================
-- Geiger Events — per-event pre-launch notes
--
-- Self-contained and idempotent. Depends on public.flow_events (events.sql).
-- One row per event holding the organizer's pre-launch checklist as a JSON
-- array of { id, text, done } items, so the list can grow/shrink without a
-- migration. Reuses the shared flow_touch_updated_at trigger from events.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists public.flow_event_notes (
  -- One notes row per event; the event id is the primary key (upsert target).
  event_id uuid primary key references public.flow_events(id) on delete cascade,
  -- Ordered checklist: [{ id: text, text: text, done: bool }, ...].
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists flow_event_notes_touch_updated_at on public.flow_event_notes;
create trigger flow_event_notes_touch_updated_at
before update on public.flow_event_notes
for each row execute function public.flow_touch_updated_at();

-- Demo-open RLS (the dashboard runs unauthenticated). Tighten once auth lands.
alter table public.flow_event_notes enable row level security;

drop policy if exists flow_event_notes_demo_all on public.flow_event_notes;
create policy flow_event_notes_demo_all on public.flow_event_notes
  for all
  to anon, authenticated
  using (true)
  with check (true);
