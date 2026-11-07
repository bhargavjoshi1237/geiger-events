-- @up
-- Venues are publicly readable (venues_public_read), so agreed contract terms move out of venues.metadata into a member-only table.

create table if not exists events.venue_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  venue_id uuid not null references events.venues(id) on delete cascade,
  rfp_id uuid,
  -- The award snapshot written by events.rfp_award (rates, line items, concessions, terms).
  terms jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists venue_contracts_venue_rfp_key
  on events.venue_contracts (venue_id, rfp_id);
create index if not exists venue_contracts_venue_idx
  on events.venue_contracts (venue_id, awarded_at desc)
  where deleted_at is null;

drop trigger if exists venue_contracts_touch on events.venue_contracts;
create trigger venue_contracts_touch
  before update on events.venue_contracts
  for each row execute function events.touch_updated_at();

alter table events.venue_contracts enable row level security;

drop policy if exists venue_contracts_member_all on events.venue_contracts;
create policy venue_contracts_member_all on events.venue_contracts
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

revoke all on events.venue_contracts from anon;
grant select, insert, update, delete on events.venue_contracts to authenticated;

-- events.rfp_award appends contracts to venues.metadata; this moves them into venue_contracts and strips the public copy.
create or replace function events.venues_extract_contracts()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_item jsonb;
  v_rfp text;
  v_at timestamptz;
begin
  if jsonb_typeof(new.metadata->'contracts') = 'array' then
    for v_item in select value from jsonb_array_elements(new.metadata->'contracts') loop
      continue when jsonb_typeof(v_item) <> 'object';
      v_rfp := v_item->>'rfpId';
      begin
        v_at := (v_item->>'awardedAt')::timestamptz;
      exception when others then
        v_at := null;
      end;
      insert into events.venue_contracts (project_id, venue_id, rfp_id, terms, awarded_at)
      values (
        new.project_id,
        new.id,
        case when v_rfp ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_rfp::uuid end,
        v_item,
        coalesce(v_at, now())
      )
      on conflict (venue_id, rfp_id) do update
        set terms = excluded.terms, awarded_at = excluded.awarded_at, deleted_at = null;
    end loop;
  end if;
  update events.venues set metadata = metadata - 'contracts' where id = new.id;
  return null;
end;
$$;

revoke all on function events.venues_extract_contracts() from public, anon, authenticated;

drop trigger if exists venues_extract_contracts on events.venues;
create trigger venues_extract_contracts
  after insert or update of metadata on events.venues
  for each row
  when (new.metadata ? 'contracts')
  execute function events.venues_extract_contracts();

-- Move anything already awarded.
update events.venues set metadata = metadata where metadata ? 'contracts';

-- @down
drop trigger if exists venues_extract_contracts on events.venues;

update events.venues v
  set metadata = jsonb_set(coalesce(v.metadata, '{}'::jsonb), '{contracts}', c.items)
  from (
    select venue_id, jsonb_agg(terms order by awarded_at) as items
    from events.venue_contracts
    where deleted_at is null
    group by venue_id
  ) c
  where c.venue_id = v.id;

drop function if exists events.venues_extract_contracts();
drop table if exists events.venue_contracts;
