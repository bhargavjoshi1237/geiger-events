-- ===========================================================================
-- Geiger Events — venues store
--
-- Self-contained and idempotent: safe to run repeatedly. Creates the
-- events.venues table, its indexes, a metadata-merge RPC, RLS, and links
-- events to a venue via a venue_id FK on events.events.
--
-- A venue is a reusable place an event is held at. Events keep a denormalized
-- text snapshot (venue / address / city) for display and free-text fallback;
-- venue_id points at the managed row when one is chosen, so the public event
-- page can load the full venue detail (map, capacity, amenities, contact).
--
-- Runs after events.sql (filename order), so events.events already exists when
-- we add its venue_id column. Depends on events.touch_updated_at().
-- Project scoping (project_id, NOT NULL, org-scoped RLS) is applied last in
-- zz_project_access.sql, alongside the other dashboard entities.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists events.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled venue',
  type text not null default 'Indoor',
  status text not null default 'Active',
  description text,
  -- Location
  address text,
  city text,
  region text,
  postcode text,
  country text,
  timezone text not null default 'Europe/London',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  parking_notes text,
  transit_notes text,
  -- Capacity & amenities
  seated_capacity integer not null default 0,
  standing_capacity integer not null default 0,
  spaces integer not null default 1,
  amenities jsonb not null default '[]'::jsonb,
  -- Contact
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  -- Media. Direct public URLs (Supabase Storage, bucket "products", folder
  -- venues/<id>/). cover_url is the hero; gallery is an ordered list.
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,
  -- The owner. Only this user may upload/replace this venue's images.
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag: not-yet-promoted attributes, merged a section at a time via
  -- venue_merge_meta below.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table events.venues add column if not exists description text;
alter table events.venues add column if not exists region text;
alter table events.venues add column if not exists postcode text;
alter table events.venues add column if not exists country text;
alter table events.venues add column if not exists latitude numeric(9, 6);
alter table events.venues add column if not exists longitude numeric(9, 6);
alter table events.venues add column if not exists parking_notes text;
alter table events.venues add column if not exists transit_notes text;
alter table events.venues add column if not exists seated_capacity integer not null default 0;
alter table events.venues add column if not exists standing_capacity integer not null default 0;
alter table events.venues add column if not exists spaces integer not null default 1;
alter table events.venues add column if not exists amenities jsonb not null default '[]'::jsonb;
alter table events.venues add column if not exists contact_name text;
alter table events.venues add column if not exists contact_email text;
alter table events.venues add column if not exists contact_phone text;
alter table events.venues add column if not exists website text;
alter table events.venues add column if not exists cover_url text;
alter table events.venues add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table events.venues add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events.venues add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table events.venues add column if not exists deleted_at timestamptz;

-- The link: an event is held at at most one managed venue. ON DELETE SET NULL
-- so deleting a venue leaves the event's text snapshot intact.
alter table events.events
  add column if not exists venue_id uuid references events.venues(id) on delete set null;

create index if not exists events_events_venue_idx
  on events.events (venue_id) where deleted_at is null;

drop trigger if exists venues_touch_updated_at on events.venues;
create trigger venues_touch_updated_at
before update on events.venues
for each row execute function events.touch_updated_at();

create index if not exists events_venues_status_idx
  on events.venues (status) where deleted_at is null;
create index if not exists events_venues_created_idx
  on events.venues (created_at desc);

-- Shallow-merge a metadata patch into the venue (one top-level key per editor
-- section) so saving one section never clobbers another.
create or replace function events.venue_merge_meta(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events
as $$
declare
  v_meta jsonb;
begin
  update events.venues
    set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id and deleted_at is null
    returning metadata into v_meta;
  return v_meta;
end;
$$;

grant execute on function events.venue_merge_meta(uuid, jsonb)
  to anon, authenticated;

-- RLS. Open demo policy (anon key) — replaced with an org-scoped member policy
-- plus a public read in zz_project_access.sql.
alter table events.venues enable row level security;

drop policy if exists events_venues_demo_all on events.venues;
create policy events_venues_demo_all on events.venues
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- No demo seed. Venues are project-scoped (see zz_project_access.sql) and
-- created in-app against a real project.

-- ---------------------------------------------------------------------------
-- Venue media storage RLS (products bucket, venues/<id>/).
--
-- Lives here (not storage.sql) because the policies reference events.venues,
-- and the db:push runner executes files in filename order — storage.sql runs
-- before venues.sql, so the table wouldn't exist yet there. Public read is
-- already granted for the whole bucket in storage.sql; these add owner writes
-- for the venues/ prefix, mirroring the event-owner policies.
-- ---------------------------------------------------------------------------
drop policy if exists "Products venue owner insert" on storage.objects;
drop policy if exists "Products venue owner update" on storage.objects;
drop policy if exists "Products venue owner delete" on storage.objects;

create policy "Products venue owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'venues'
    and exists (
      select 1 from events.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[2]
        and v.created_by = auth.uid()
    )
  );

create policy "Products venue owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'venues'
    and exists (
      select 1 from events.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[2]
        and v.created_by = auth.uid()
    )
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'venues'
    and exists (
      select 1 from events.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[2]
        and v.created_by = auth.uid()
    )
  );

create policy "Products venue owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'venues'
    and exists (
      select 1 from events.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[2]
        and v.created_by = auth.uid()
    )
  );
