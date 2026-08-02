-- Badge asset storage
--
-- Owns the "Products badge asset *" policies on storage.objects. Badge/pass
-- designs are saved per project (events.checkin_settings.config), so their
-- artwork — card backgrounds, section images, QR centre marks — lives at:
--     products / badges / <project-uuid> / <file>
-- Public read comes from the existing "Products public read" policy; writes are
-- allowed to any authenticated caller for a project that exists, matching the
-- demo-open posture of the product tables. Idempotent: policies are dropped
-- then recreated.

-- @up
drop policy if exists "Products badge asset insert" on storage.objects;
drop policy if exists "Products badge asset update" on storage.objects;
drop policy if exists "Products badge asset delete" on storage.objects;

create policy "Products badge asset insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'badges'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products badge asset update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'badges'
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'badges'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products badge asset delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'badges'
  );

-- @down
drop policy if exists "Products badge asset insert" on storage.objects;
drop policy if exists "Products badge asset update" on storage.objects;
drop policy if exists "Products badge asset delete" on storage.objects;
