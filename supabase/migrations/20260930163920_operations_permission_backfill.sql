-- Operations permission backfill
--
-- Add `-- @no-transaction` above @up only if this migration needs to run
-- outside a transaction (e.g. create index concurrently).

-- @up
-- Existing system-role rows are persisted per project. Keep them in sync with
-- the A1 manager/admin template without widening member or custom roles.
update public.roles as r
set permissions = r.permissions || array(
  select p from unnest(array[
    'events.operations.view',
    'events.operations.configure',
    'events.operations.records.create',
    'events.operations.records.update',
    'events.operations.records.archive'
  ]::text[]) as p where not p = any(r.permissions)
)
where r.is_system = true and r.key in ('admin', 'manager') and r.deleted_at is null;

-- @down

-- Existing role edits may have been made after this backfill; do not remove
-- permissions from persisted roles automatically.

