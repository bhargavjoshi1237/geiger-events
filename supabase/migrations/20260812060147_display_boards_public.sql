-- Public read for published display boards
--
-- Display Boards are events.conference_records rows with module = 'board' — a
-- billboard/signage playlist for one event, built on the canvas in
-- Program -> Display Boards. The board renders at /display/<boardId> on a screen
-- that is never signed in, so both the board row and the sessions it draws must
-- be readable by anon once the organiser publishes it.
--
-- Mirrors the recordings precedent (20260726194135_conference_recordings_public):
-- multiple permissive policies are OR-ed, so members keep full access through
-- conference_records_member_all and these only widen SELECT.
--
-- Owns: conference_records_board_public_read,
--       conference_records_board_session_public_read.

-- @up
create schema if not exists events;

-- The board itself — readable once config.published is true.
drop policy if exists conference_records_board_public_read on events.conference_records;
create policy conference_records_board_public_read on events.conference_records
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and module = 'board'
    and coalesce(config->>'published', '') = 'true'
  );

-- The sessions a published board draws. Scoped to the exact event the board
-- points at, so publishing one event's board never exposes another's agenda.
drop policy if exists conference_records_board_session_public_read on events.conference_records;
create policy conference_records_board_session_public_read on events.conference_records
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and module = 'session'
    and exists (
      select 1
      from events.conference_records board
      where board.module = 'board'
        and board.deleted_at is null
        and coalesce(board.config->>'published', '') = 'true'
        and board.project_id = conference_records.project_id
        and board.config->>'eventId' = conference_records.config->>'eventId'
    )
  );

-- Both policies filter on module + config->>'eventId'; index the pair so the
-- EXISTS above stays cheap as the records table grows.
create index if not exists events_conference_records_module_event_idx
  on events.conference_records (module, (config->>'eventId'))
  where deleted_at is null;

-- @down
drop index if exists events.events_conference_records_module_event_idx;
drop policy if exists conference_records_board_session_public_read on events.conference_records;
drop policy if exists conference_records_board_public_read on events.conference_records;
