-- Fix infinite recursion in the display-board session read policy
--
-- 20260812060147_display_boards_public added
-- conference_records_board_session_public_read, whose USING clause runs an
-- EXISTS over events.conference_records itself. Postgres re-applies the table's
-- policies to that inner scan, so EVERY select on events.conference_records
-- failed with 42P17 "infinite recursion detected in policy" — for anon and
-- authenticated alike, because permissive policies are OR-ed and all of them get
-- evaluated. That took down every Conference module (Live Stream Rooms,
-- speakers, sessions…), not just display boards.
--
-- The lookup moves into a SECURITY DEFINER helper, which runs as the table owner
-- and therefore does not re-enter RLS — the same technique
-- events.can_access_project already uses. Policy semantics are unchanged.
--
-- Owns: events.board_publishes_event,
--       conference_records_board_session_public_read (taken over from
--       20260812060147_display_boards_public).

-- @up
create schema if not exists events;

-- Is there a published board for this project + event? SECURITY DEFINER so the
-- read runs outside RLS and the policy below cannot recurse into itself.
create or replace function events.board_publishes_event(
  p_project_id uuid,
  p_event_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, events
as $$
  select exists (
    select 1
    from events.conference_records board
    where board.module = 'board'
      and board.deleted_at is null
      and coalesce(board.config->>'published', '') = 'true'
      and board.project_id = p_project_id
      and board.config->>'eventId' = p_event_id
  );
$$;

grant execute on function events.board_publishes_event(uuid, text) to anon, authenticated;

drop policy if exists conference_records_board_session_public_read on events.conference_records;
create policy conference_records_board_session_public_read on events.conference_records
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and module = 'session'
    and events.board_publishes_event(project_id, config->>'eventId')
  );

-- @down
-- Restores the recursive policy from 20260812060147 verbatim; rolling this back
-- re-breaks reads on events.conference_records.
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

drop function if exists events.board_publishes_event(uuid, text);
