-- Operations record permission keys
--
-- @up
-- RBAC keys must be <product>.<resource>.<action>. Translate the invalid
-- four-segment record keys without granting any action a role did not hold.
-- Keep earlier migrations immutable for databases that already applied them.
update public.roles as r
set permissions = array(
  select mapped.key
  from (
    select case entry.key
      when 'events.operations.records.create' then 'events.operations.record_create'
      when 'events.operations.records.update' then 'events.operations.record_update'
      when 'events.operations.records.archive' then 'events.operations.record_archive'
      else entry.key
    end as key, entry.position
    from unnest(r.permissions) with ordinality as entry(key, position)
  ) as mapped
  group by mapped.key
  order by min(mapped.position)
)
where r.permissions && array[
  'events.operations.records.create',
  'events.operations.records.update',
  'events.operations.records.archive'
]::text[];

-- @down
-- Keep valid permission keys on rollback; restoring invalid keys prevents
-- the RBAC catalog from loading. No permissions are added by this correction.
