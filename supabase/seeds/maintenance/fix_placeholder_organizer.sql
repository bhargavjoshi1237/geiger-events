-- One-off repair: remove the "Ava Mitchell" placeholder organizer.
--
-- Every event created before the organizer default was fixed was stamped with a
-- hard-coded demo name, which the public page renders as "Hosted by". This
-- re-credits those events to their own project; anything without a project is
-- blanked (the page omits the host block entirely when there is no organizer,
-- and the name is editable under Event details).
--
-- Idempotent, and only ever matches the literal placeholder, so a re-run after
-- someone has set a real organizer is a no-op. Safe to delete once it has run
-- against every environment.

update events.events e
set organizer = coalesce(nullif(p.name, ''), '')
from public.projects p
where p.id = e.project_id
  and e.organizer = 'Ava Mitchell';

update events.events
set organizer = ''
where organizer = 'Ava Mitchell';
