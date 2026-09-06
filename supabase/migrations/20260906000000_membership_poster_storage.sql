-- Membership plan poster storage
--
-- Owns the "Products membership poster *" policies on storage.objects.
-- Membership plans are reusable ticketing_records (module "membership"), so
-- their poster backgrounds live at:
--     products / memberships / <project-uuid> / <file>
-- The plan's config stores the public URL (config.posterUrl). Public read comes
-- from the existing "Products public read" policy; writes are allowed to any
-- authenticated caller for a project that exists, matching the badge/wall
-- asset policies. Idempotent: policies are dropped then recreated.

-- @up
drop policy if exists "Products membership poster insert" on storage.objects;
drop policy if exists "Products membership poster update" on storage.objects;
drop policy if exists "Products membership poster delete" on storage.objects;

create policy "Products membership poster insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'memberships'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products membership poster update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'memberships'
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'memberships'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products membership poster delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'memberships'
  );

-- @down
drop policy if exists "Products membership poster insert" on storage.objects;
drop policy if exists "Products membership poster update" on storage.objects;
drop policy if exists "Products membership poster delete" on storage.objects;
