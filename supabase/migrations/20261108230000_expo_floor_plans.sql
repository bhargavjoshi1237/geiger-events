-- @up
-- Expo halls are drawn in the Event Design editor: floor_plans kind 'expo' (one per hall map), an 'expo' object
-- category with standard booth objects, and events.sync_hall_booths() — a plan's booths projected into the sellable
-- events.hall_booths rows that checkout, holds and the buyer's booth map already read. Row ids are the plan's instance
-- ids, so a booth keeps its assignments across every save.

alter table events.floor_plans drop constraint if exists floor_plans_kind_check;
alter table events.floor_plans add constraint floor_plans_kind_check
  check (kind in ('plan', 'template', 'library', 'expo'));

-- An expo plan is its hall's design; the hall map keeps the ids event config and booth assignments point at.
alter table events.floor_plans
  add column if not exists hall_map_id uuid references events.hall_maps(id) on delete set null;
create unique index if not exists floor_plans_hall_map_key
  on events.floor_plans (hall_map_id)
  where hall_map_id is not null and deleted_at is null;

alter table events.design_objects drop constraint if exists design_objects_category_check;
alter table events.design_objects add constraint design_objects_category_check
  check (category in ('tables', 'seating', 'staging', 'bars_catering', 'dance_entertainment', 'av', 'decor', 'structure', 'expo'));

-- Standard booths; fixed ids mirror lib/event_design/standard_catalog.js (rows 41-46).
insert into events.design_objects
  (id, key, name, category, shape, width_m, depth_m, height_m, seats, chair_layout, sort_order, config, description)
values
  ('e0d00000-0000-4000-a000-000000000041', 'booth-3x2', 'Booth 3×2 m', 'expo', 'rect', 3, 2, 2.5, 0, '{"mode":"none"}'::jsonb, 41, '{}'::jsonb, 'Compact shell-scheme stand.'),
  ('e0d00000-0000-4000-a000-000000000042', 'booth-3x3', 'Booth 3×3 m', 'expo', 'rect', 3, 3, 2.5, 0, '{"mode":"none"}'::jsonb, 42, '{}'::jsonb, 'The standard shell-scheme stand.'),
  ('e0d00000-0000-4000-a000-000000000043', 'booth-6x3', 'Booth 6×3 m', 'expo', 'rect', 6, 3, 2.5, 0, '{"mode":"none"}'::jsonb, 43, '{}'::jsonb, 'Double-width stand.'),
  ('e0d00000-0000-4000-a000-000000000044', 'booth-island-6x6', 'Island booth 6×6 m', 'expo', 'rect', 6, 6, 2.5, 0, '{"mode":"none"}'::jsonb, 44, '{}'::jsonb, 'Open on all four sides.'),
  ('e0d00000-0000-4000-a000-000000000045', 'booth-10x10ft', 'Booth 10×10 ft', 'expo', 'rect', 3.048, 3.048, 2.438, 0, '{"mode":"none"}'::jsonb, 45, '{}'::jsonb, 'US inline standard.'),
  ('e0d00000-0000-4000-a000-000000000046', 'booth-10x20ft', 'Booth 10×20 ft', 'expo', 'rect', 6.096, 3.048, 2.438, 0, '{"mode":"none"}'::jsonb, 46, '{}'::jsonb, '')
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  category = excluded.category,
  shape = excluded.shape,
  width_m = excluded.width_m,
  depth_m = excluded.depth_m,
  height_m = excluded.height_m,
  seats = excluded.seats,
  chair_layout = excluded.chair_layout,
  sort_order = excluded.sort_order,
  config = excluded.config,
  description = excluded.description,
  deleted_at = null;

-- Booth numbers are unique among LIVE booths only: a booth taken off the plan keeps its number for its sales history.
drop index if exists events.events_hall_booths_code_idx;
create unique index if not exists events_hall_booths_code_idx
  on events.hall_booths (hall_map_id, code)
  where code <> '' and active;

-- Replaces a hall's live booths with `p_booths` (the hall_booths shape, camelCase keys) in one transaction.
-- Booths missing from the payload go inactive — never deleted, because booth_assignments cascade on delete.
-- Invoker rights: the member RLS on hall_maps / hall_booths decides who may sync.
create or replace function events.sync_hall_booths(p_hall_map_id uuid, p_booths jsonb, p_aspect text default null)
returns integer
language plpgsql
security invoker
set search_path = events, public
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  if p_hall_map_id is null or jsonb_typeof(coalesce(p_booths, 'null'::jsonb)) <> 'array' then
    raise exception 'sync_hall_booths: a hall map id and a booth array are required';
  end if;
  if not exists (select 1 from events.hall_maps where id = p_hall_map_id and deleted_at is null) then
    raise exception 'sync_hall_booths: hall map % not found', p_hall_map_id;
  end if;

  select coalesce(array_agg((b->>'id')::uuid), '{}'::uuid[])
    into v_ids
    from jsonb_array_elements(p_booths) b;

  update events.hall_booths
    set active = false
    where hall_map_id = p_hall_map_id and active and not (id = any(v_ids));

  -- Free the incoming booths' numbers first, so renumbering (A1 ↔ A2) can't collide mid-upsert.
  update events.hall_booths
    set code = ''
    where hall_map_id = p_hall_map_id and code <> '' and id = any(v_ids);

  insert into events.hall_booths
    (id, hall_map_id, code, name, kind, hall, size_class, price, x, y, width, height, rotation, active, sort_order)
  select
    (b->>'id')::uuid,
    p_hall_map_id,
    coalesce(b->>'code', ''),
    coalesce(b->>'name', ''),
    case when b->>'kind' in ('booth', 'zone', 'feature') then b->>'kind' else 'booth' end,
    coalesce(b->>'hall', ''),
    coalesce(nullif(b->>'sizeClass', ''), 'Standard'),
    greatest(coalesce((b->>'price')::numeric, 0), 0),
    coalesce((b->>'x')::numeric, 0),
    coalesce((b->>'y')::numeric, 0),
    coalesce((b->>'width')::numeric, 1),
    coalesce((b->>'height')::numeric, 1),
    coalesce((b->>'rotation')::numeric, 0),
    true,
    coalesce((b->>'sortOrder')::integer, 0)
  from jsonb_array_elements(p_booths) b
  on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    kind = excluded.kind,
    hall = excluded.hall,
    size_class = excluded.size_class,
    price = excluded.price,
    x = excluded.x,
    y = excluded.y,
    width = excluded.width,
    height = excluded.height,
    rotation = excluded.rotation,
    active = true,
    sort_order = excluded.sort_order
  -- An id already owned by another hall is left alone rather than moved across halls.
  where events.hall_booths.hall_map_id = p_hall_map_id;
  get diagnostics v_count = row_count;

  if p_aspect ~ '^[0-9]+(\.[0-9]+)?/[0-9]+(\.[0-9]+)?$' then
    update events.hall_maps
      set config = jsonb_set(coalesce(config, '{}'::jsonb), '{aspect}', to_jsonb(p_aspect))
      where id = p_hall_map_id;
  end if;

  return v_count;
end;
$$;

revoke all on function events.sync_hall_booths(uuid, jsonb, text) from public, anon;
grant execute on function events.sync_hall_booths(uuid, jsonb, text) to authenticated;

-- @down
drop function if exists events.sync_hall_booths(uuid, jsonb, text);

drop index if exists events.events_hall_booths_code_idx;
update events.hall_booths set code = '' where not active and code <> '';
create unique index if not exists events_hall_booths_code_idx
  on events.hall_booths (hall_map_id, code)
  where code <> '';

delete from events.design_objects where category = 'expo' and project_id is null;
update events.design_objects set category = 'decor' where category = 'expo';
alter table events.design_objects drop constraint if exists design_objects_category_check;
alter table events.design_objects add constraint design_objects_category_check
  check (category in ('tables', 'seating', 'staging', 'bars_catering', 'dance_entertainment', 'av', 'decor', 'structure'));

drop index if exists events.floor_plans_hall_map_key;
alter table events.floor_plans drop column if exists hall_map_id;
update events.floor_plans set kind = 'plan' where kind = 'expo';
alter table events.floor_plans drop constraint if exists floor_plans_kind_check;
alter table events.floor_plans add constraint floor_plans_kind_check
  check (kind in ('plan', 'template', 'library'));
