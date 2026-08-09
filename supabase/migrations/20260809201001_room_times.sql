-- Room scheduling times
--
-- Promotes start/end instants out of the config jsonb bag onto
-- events.conference_records so rooms can be scheduled, sorted and counted down.
-- Nullable on purpose: legacy rows hold display text ("Day 1 · 09:00") that is
-- relative to an event day and cannot be parsed to an instant. A null starts_at
-- means "no schedule; the organiser drives state manually".

-- @up
alter table events.conference_records
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

create index if not exists conference_records_starts_at_idx
  on events.conference_records (project_id, module, starts_at);

-- @down
drop index if exists events.conference_records_starts_at_idx;
alter table events.conference_records
  drop column if exists ends_at,
  drop column if exists starts_at;
