-- ===========================================================================
-- Geiger Events — image storage (Supabase Storage)
--
-- Self-contained and idempotent. Creates the "products" bucket and the RLS
-- policies on storage.objects. Event images live at:
--     products / events / <event-uuid> / <file>
-- Public read (so direct URLs stored in events.events.cover_url just work), but
-- WRITE is authoritative: only the user who created the event (events.events
-- .created_by) may upload/replace/remove that event's images.
--
-- Runs as part of `npm run db:push` — the bucket is created if absent.
-- Depends on events.events.created_by (events.sql).
-- ===========================================================================

-- Bucket (public read for direct object URLs).
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public;

-- Repeatable: drop then recreate this app's policies.
drop policy if exists "Products public read" on storage.objects;
drop policy if exists "Products event owner insert" on storage.objects;
drop policy if exists "Products event owner update" on storage.objects;
drop policy if exists "Products event owner delete" on storage.objects;

-- Anyone may read (the app stores public URLs in the DB).
create policy "Products public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'products');

-- Write only under events/<id>/ for an event the caller created.
create policy "Products event owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'events'
    and exists (
      select 1 from events.events e
      where e.id::text = (storage.foldername(storage.objects.name))[2]
        and e.created_by = auth.uid()
    )
  );

create policy "Products event owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'events'
    and exists (
      select 1 from events.events e
      where e.id::text = (storage.foldername(storage.objects.name))[2]
        and e.created_by = auth.uid()
    )
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'events'
    and exists (
      select 1 from events.events e
      where e.id::text = (storage.foldername(storage.objects.name))[2]
        and e.created_by = auth.uid()
    )
  );

create policy "Products event owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'events'
    and exists (
      select 1 from events.events e
      where e.id::text = (storage.foldername(storage.objects.name))[2]
        and e.created_by = auth.uid()
    )
  );
