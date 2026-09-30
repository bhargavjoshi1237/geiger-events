-- @up
-- Move deals out of public event metadata; publish only a deliberate snapshot.

create table if not exists events.event_sponsorship (
  event_id uuid primary key references events.events(id) on delete cascade,
  spots jsonb not null default '[]'::jsonb check (jsonb_typeof(spots) = 'array'),
  updated_at timestamptz not null default now()
);

alter table events.event_sponsorship enable row level security;
revoke all on events.event_sponsorship from public, anon, authenticated;
grant select on events.event_sponsorship to authenticated;
grant all on events.event_sponsorship to service_role;

drop policy if exists event_sponsorship_member_read on events.event_sponsorship;
create policy event_sponsorship_member_read on events.event_sponsorship
  for select to authenticated
  using ((select auth.uid()) is not null and exists (
    select 1 from events.events e
    where e.id = event_id and events.can_access_project(e.project_id)
  ));

drop trigger if exists event_sponsorship_touch on events.event_sponsorship;
create trigger event_sponsorship_touch before update on events.event_sponsorship
  for each row execute function events.touch_updated_at();

create or replace function events.public_sponsorship(p_spots jsonb, p_include_pending boolean default false)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object('spots', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s->'id', 'name', s->'name', 'tier', s->'tier',
      'description', s->'description', 'benefits', s->'benefits',
      'price', s->'price', 'quantity', s->'quantity', 'open', s->'open',
      'reserved', jsonb_array_length(case when jsonb_typeof(s->'fills') = 'array' then s->'fills' else '[]'::jsonb end),
      'fills', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', f->'id', 'sponsorId', f->'sponsorId', 'status', f->'status',
        'sponsor', jsonb_build_object(
          'name', f->'sponsor'->'name', 'logoUrl', f->'sponsor'->'logoUrl',
          'website', f->'sponsor'->'website', 'description', f->'sponsor'->'description'
        )
      ) order by fill_order), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(s->'fills') = 'array' then s->'fills' else '[]'::jsonb end)
        with ordinality as fills(f, fill_order)
      where f->>'status' = 'confirmed' or (p_include_pending and f->>'status' = 'pending'))
    ) order by spot_order), '[]'::jsonb))
  from jsonb_array_elements(case when jsonb_typeof(p_spots) = 'array' then p_spots else '[]'::jsonb end)
    with ordinality as spots(s, spot_order);
$$;

-- Backfill before stripping metadata, preserving every existing private field.
insert into events.event_sponsorship (event_id, spots)
select id, metadata#>'{sponsorship,spots}' from events.events
where jsonb_typeof(metadata#>'{sponsorship,spots}') = 'array'
on conflict (event_id) do nothing;

-- Guard every metadata write, including generic merge RPCs and old clients.
create or replace function events.project_sponsorship_metadata()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_spots jsonb;
  v_ids jsonb;
begin
  select spots into v_spots from events.event_sponsorship where event_id = new.id;
  if v_spots is null and not (new.metadata ? 'sponsorship') then return new; end if;
  v_spots := coalesce(v_spots, new.metadata#>'{sponsorship,spots}', '[]'::jsonb);
  select coalesce(jsonb_agg(distinct f->'sponsorId'), '[]'::jsonb) into v_ids
  from jsonb_array_elements(case when jsonb_typeof(v_spots) = 'array' then v_spots else '[]'::jsonb end) as spots(s)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(s->'fills') = 'array' then s->'fills' else '[]'::jsonb end) as fills(f)
  where f->>'status' = 'confirmed' and nullif(f->>'sponsorId', '') is not null;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'sponsorship', events.public_sponsorship(v_spots,
      coalesce(new.metadata#>'{sponsorsDisplay,includePending}' = 'true'::jsonb, false)),
    'sponsorIds', v_ids
  );
  return new;
end;
$$;
revoke all on function events.project_sponsorship_metadata() from public, anon, authenticated;

drop trigger if exists events_sponsorship_public_snapshot on events.events;
create trigger events_sponsorship_public_snapshot before insert or update of metadata on events.events
  for each row execute function events.project_sponsorship_metadata();

update events.events set metadata = metadata where metadata ? 'sponsorship';

create or replace function events.save_event_sponsorship(p_event_id uuid, p_spots jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.events
    where id = p_event_id and deleted_at is null for update;
  if v_project is null or auth.uid() is null or not events.can_access_project(v_project) then
    raise exception 'Sponsorship access denied' using errcode = '42501';
  end if;
  if p_spots is null or jsonb_typeof(p_spots) <> 'array' then
    raise exception 'Spots must be an array' using errcode = '22023';
  end if;
  insert into events.event_sponsorship (event_id, spots) values (p_event_id, p_spots)
    on conflict (event_id) do update set spots = excluded.spots;
  update events.events set metadata = metadata where id = p_event_id;
  return true;
end;
$$;
revoke all on function events.save_event_sponsorship(uuid, jsonb) from public, anon, authenticated;
grant execute on function events.save_event_sponsorship(uuid, jsonb) to authenticated;

-- Generic editors must not let anonymous callers change publication settings.
create or replace function events.event_merge_meta(p_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_meta jsonb;
begin
  select project_id into v_project from events.events
    where id = p_id and deleted_at is null for update;
  if v_project is null or auth.uid() is null or not events.can_access_project(v_project) then
    raise exception 'Event configuration access denied' using errcode = '42501';
  end if;
  if p_patch is not null and jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Configuration patch must be an object' using errcode = '22023';
  end if;
  update events.events set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id returning metadata into v_meta;
  return v_meta;
end;
$$;
revoke all on function events.event_merge_meta(uuid, jsonb) from public, anon, authenticated;
grant execute on function events.event_merge_meta(uuid, jsonb) to authenticated;

-- A public lead must name the same project as the enabled, shareable prospectus.
drop policy if exists sponsor_enquiries_public_insert on events.sponsor_enquiries;
create policy sponsor_enquiries_public_insert on events.sponsor_enquiries
  for insert to anon, authenticated
  with check (status = 'new' and sponsor_id is null and deleted_at is null and exists (
    select 1 from events.events e
    where e.id = event_id and e.project_id = sponsor_enquiries.project_id
      and e.deleted_at is null and e.visibility <> 'Private'
      and e.metadata#>'{sponsorshipPage,enabled}' = 'true'::jsonb
      and coalesce(e.metadata#>'{sponsorshipPage,formEnabled}' <> 'false'::jsonb, true)
  ));

drop policy if exists sponsor_enquiries_member_all on events.sponsor_enquiries;
create policy sponsor_enquiries_member_all on events.sponsor_enquiries
  for all to authenticated
  using ((select auth.uid()) is not null and events.can_access_project(project_id) and exists (
    select 1 from events.events e where e.id = event_id and e.project_id = sponsor_enquiries.project_id
  ))
  with check ((select auth.uid()) is not null and events.can_access_project(project_id) and exists (
    select 1 from events.events e where e.id = event_id and e.project_id = sponsor_enquiries.project_id
  ));

-- No rollback: moving private deals back into public metadata would expose them.
