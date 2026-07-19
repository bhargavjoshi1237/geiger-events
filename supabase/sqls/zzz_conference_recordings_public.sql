-- ===========================================================================
-- Geiger Events — public read for shared recordings
--
-- The Conference area is otherwise member-only (see zz_project_access.sql:
-- conference_records_member_all). Recordings & Replay adds an OPT-IN public
-- surface: /r/<id> renders an organiser's external video link to anyone with the
-- URL. This policy exposes ONLY recording rows explicitly shared
-- (config.public = true) to anon — everything else stays member-scoped.
--
-- Multiple permissive policies are OR-ed, so members still see all their rows via
-- conference_records_member_all; this only widens read for shared recordings.
--
-- Runs after zz_project_access.sql (zzz_ filename). Idempotent. Apply via the
-- Supabase SQL editor or `npm run db:push`.
-- ===========================================================================

create schema if not exists events;

drop policy if exists conference_records_recording_public_read on events.conference_records;
create policy conference_records_recording_public_read on events.conference_records
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and module = 'recording'
    and coalesce(config->>'public', '') = 'true'
  );
