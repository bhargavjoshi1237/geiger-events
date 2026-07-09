-- ===========================================================================
-- Geiger Events — conference records store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.conference_records table, its indexes, an updated_at trigger, RLS, and
-- the storage owner policies for conference media (headshots / logos).
--
-- One uniform store shared by every Conference module screen (Speakers,
-- Sponsors, Sponsorship Packages, Expo Booths, Venue Sourcing, Housing & Travel,
-- Call for Papers, CEU & Certificates), discriminated by `module`. Mirrors the
-- events.ticketing_records pattern. Module-specific fields live in the `config`
-- jsonb bag; only name/status/cover are promoted columns.
--
-- Project scoping (project_id NOT NULL, org-scoped RLS) is applied last in
-- zz_project_access.sql, alongside the other dashboard entities.
-- Depends on events.touch_updated_at() (defined in events.sql).
-- ===========================================================================

create extension if not exists pgcrypto;
create schema if not exists events;

-- Shared updated_at trigger fn (declared locally so this file stands alone).
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists events.conference_records (
  id uuid primary key default gen_random_uuid(),
  -- Discriminator: speaker | sponsor | package | booth | venue_lead | housing |
  -- paper | certificate.
  module text not null,
  name text not null default 'Untitled',
  status text not null default 'Draft',
  -- Cover image (Supabase Storage, bucket "products", folder conference/<id>/).
  -- Headshot for speakers, logo for sponsors; null for the other modules.
  cover_url text,
  -- Every module-specific field (tier, price, abstract, contact, …).
  config jsonb not null default '{}'::jsonb,
  -- Expansion bag for not-yet-promoted attributes.
  metadata jsonb not null default '{}'::jsonb,
  -- The owner. Only this user may upload/replace this record's cover image.
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.conference_records add column if not exists cover_url text;
alter table events.conference_records add column if not exists config jsonb not null default '{}'::jsonb;
alter table events.conference_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.conference_records add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.conference_records add column if not exists deleted_at timestamptz;

drop trigger if exists conference_records_touch_updated_at on events.conference_records;
create trigger conference_records_touch_updated_at
before update on events.conference_records
for each row execute function events.touch_updated_at();

create index if not exists events_conference_records_module_idx
  on events.conference_records (module) where deleted_at is null;
create index if not exists events_conference_records_created_idx
  on events.conference_records (created_at desc);

-- RLS. Open demo policy (anon key) — replaced with an org-scoped member policy
-- in zz_project_access.sql.
alter table events.conference_records enable row level security;

drop policy if exists events_conference_records_demo_all on events.conference_records;
create policy events_conference_records_demo_all on events.conference_records
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Conference media storage RLS (products bucket, conference/<id>/).
--
-- Public read is already granted for the whole bucket in storage.sql; these add
-- owner writes for the conference/ prefix, mirroring the event/venue-owner
-- policies. Lives here (not storage.sql) because it references
-- events.conference_records, which storage.sql runs before.
-- ---------------------------------------------------------------------------
drop policy if exists "Products conference owner insert" on storage.objects;
drop policy if exists "Products conference owner update" on storage.objects;
drop policy if exists "Products conference owner delete" on storage.objects;

create policy "Products conference owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'conference'
    and exists (
      select 1 from events.conference_records r
      where r.id::text = (storage.foldername(storage.objects.name))[2]
        and r.created_by = auth.uid()
    )
  );

create policy "Products conference owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'conference'
    and exists (
      select 1 from events.conference_records r
      where r.id::text = (storage.foldername(storage.objects.name))[2]
        and r.created_by = auth.uid()
    )
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'conference'
    and exists (
      select 1 from events.conference_records r
      where r.id::text = (storage.foldername(storage.objects.name))[2]
        and r.created_by = auth.uid()
    )
  );

create policy "Products conference owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'conference'
    and exists (
      select 1 from events.conference_records r
      where r.id::text = (storage.foldername(storage.objects.name))[2]
        and r.created_by = auth.uid()
    )
  );
