-- Wall asset storage
--
-- Owns the "Products wall asset *" policies on storage.objects. The Event Wall
-- is one row per project, so the assets a brand import pulls in for it — the
-- logo, its self-hosted font files — belong to the project rather than to any
-- one event, and live at:
--     products / walls / <project-uuid> / <file>
-- Public read comes from the existing "Products public read" policy; writes are
-- allowed to any authenticated caller for a project that exists, matching the
-- badge-asset policies. Idempotent: policies are dropped then recreated.

-- @up
drop policy if exists "Products wall asset insert" on storage.objects;
drop policy if exists "Products wall asset update" on storage.objects;
drop policy if exists "Products wall asset delete" on storage.objects;

create policy "Products wall asset insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'walls'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products wall asset update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'walls'
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'walls'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

create policy "Products wall asset delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'walls'
  );

-- @down
drop policy if exists "Products wall asset insert" on storage.objects;
drop policy if exists "Products wall asset update" on storage.objects;
drop policy if exists "Products wall asset delete" on storage.objects;
