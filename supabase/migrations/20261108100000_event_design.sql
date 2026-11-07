-- @up
-- Event Design foundation: the object library (design_objects) and to-scale floor plans (floor_plans).
-- Everything is stored in metres; a plan's `unit` is only how it is displayed. Pure geometry lives in lib/event_design.

create schema if not exists events;

-- Object library. project_id null = the seeded global catalog (read-only for every signed-in user); set = a project's custom object.
create table if not exists events.design_objects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- Stable slug for global catalog rows (round-60, banquet-8ft…); free for custom objects.
  key text,
  name text not null default 'Untitled object',
  category text not null default 'decor'
    check (category in ('tables', 'seating', 'staging', 'bars_catering', 'dance_entertainment', 'av', 'decor', 'structure')),
  shape text not null default 'rect' check (shape in ('rect', 'round', 'oval', 'custom')),
  width_m numeric(8, 3) not null default 1 check (width_m > 0),
  depth_m numeric(8, 3) not null default 1 check (depth_m > 0),
  height_m numeric(8, 3),
  seats integer not null default 0 check (seats >= 0),
  -- How seats become chairs: {"mode": "none|integral|around|sides|one_side", "ends": bool}.
  chair_layout jsonb not null default '{"mode":"none"}'::jsonb,
  color text not null default '',
  icon text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  -- Extras: {"layer": "floor|furniture|structure", "symbol": "door|door_double|exit|power|dance|screen", "points": [[x, y]…] (custom outline, unit box -0.5..0.5)}.
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists design_objects_project_idx
  on events.design_objects (project_id, category, sort_order)
  where deleted_at is null;
create unique index if not exists design_objects_global_key_idx
  on events.design_objects (key)
  where project_id is null and key is not null;

drop trigger if exists design_objects_touch on events.design_objects;
create trigger design_objects_touch
  before update on events.design_objects
  for each row execute function events.touch_updated_at();

alter table events.design_objects enable row level security;

-- The global catalog is readable by any signed-in user and writable by no one through the API.
drop policy if exists design_objects_global_read on events.design_objects;
create policy design_objects_global_read on events.design_objects
  for select
  to authenticated
  using (project_id is null);

drop policy if exists design_objects_member_all on events.design_objects;
create policy design_objects_member_all on events.design_objects
  for all
  to authenticated
  using (project_id is not null and events.can_access_project(project_id))
  with check (project_id is not null and events.can_access_project(project_id));

grant select, insert, update, delete on events.design_objects to authenticated;

-- Floor plans. kind: plan (an event's working diagram), template (Room Templates), library (a venue space's standard diagram).
create table if not exists events.floor_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  venue_id uuid references events.venues(id) on delete set null,
  venue_space_id uuid references events.venue_spaces(id) on delete set null,
  event_id uuid references events.events(id) on delete set null,
  -- The template / library diagram this plan was copied from (plain uuid: the source may be deleted later).
  source_plan_id uuid,
  name text not null default 'Untitled plan',
  kind text not null default 'plan' check (kind in ('plan', 'template', 'library')),
  status text not null default 'draft' check (status in ('draft', 'final')),
  width_m numeric(8, 2) not null default 20 check (width_m > 0),
  length_m numeric(8, 2) not null default 15 check (length_m > 0),
  unit text not null default 'm' check (unit in ('m', 'ft')),
  -- {"type": "rect"} (the width × length box) or {"type": "polygon", "points": [[x, y]…]} in metres.
  outline jsonb not null default '{"type":"rect"}'::jsonb check (jsonb_typeof(outline) = 'object'),
  setup_style text not null default 'custom'
    check (setup_style in ('theatre', 'classroom', 'banquet', 'cabaret', 'reception', 'boardroom', 'u_shape', 'hollow_square', 'custom')),
  -- Placed instances: [{id (uuid, stable forever), objectId, name, category, shape, x_m, y_m (centre), rotation (deg cw),
  --   width_m, depth_m, height_m, seats, chairs {mode, ends}, label, locked, layer, symbol?, points?}].
  objects jsonb not null default '[]'::jsonb check (jsonb_typeof(objects) = 'array'),
  template_category text not null default '',
  notes text not null default '',
  -- Small standalone SVG of the last save (share previews / exports); the dashboard renders live instead.
  thumbnail text not null default '',
  -- Bumped by every content save; saves are conditional on the version they started from.
  version integer not null default 1 check (version >= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists floor_plans_project_kind_idx
  on events.floor_plans (project_id, kind, updated_at desc)
  where deleted_at is null;
create index if not exists floor_plans_space_idx
  on events.floor_plans (venue_space_id)
  where deleted_at is null and venue_space_id is not null;
create index if not exists floor_plans_event_idx
  on events.floor_plans (event_id)
  where deleted_at is null and event_id is not null;
create index if not exists floor_plans_venue_idx
  on events.floor_plans (venue_id)
  where deleted_at is null and venue_id is not null;

drop trigger if exists floor_plans_touch on events.floor_plans;
create trigger floor_plans_touch
  before update on events.floor_plans
  for each row execute function events.touch_updated_at();

alter table events.floor_plans enable row level security;

drop policy if exists floor_plans_member_all on events.floor_plans;
create policy floor_plans_member_all on events.floor_plans
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.floor_plans to authenticated;

-- Standard catalog; fixed ids mirror lib/event_design/standard_catalog.js so placed instances resolve in every environment.
insert into events.design_objects
  (id, key, name, category, shape, width_m, depth_m, height_m, seats, chair_layout, sort_order, config, description)
values
  ('e0d00000-0000-4000-a000-000000000001', 'round-48', '48" round table', 'tables', 'round', 1.219, 1.219, 0.76, 6, '{"mode":"around"}'::jsonb, 1, '{}'::jsonb, 'Seats 6 comfortably.'),
  ('e0d00000-0000-4000-a000-000000000002', 'round-60', '60" round table', 'tables', 'round', 1.524, 1.524, 0.76, 8, '{"mode":"around"}'::jsonb, 2, '{}'::jsonb, 'The banquet standard — 8, or 10 tight.'),
  ('e0d00000-0000-4000-a000-000000000003', 'round-72', '72" round table', 'tables', 'round', 1.829, 1.829, 0.76, 10, '{"mode":"around"}'::jsonb, 3, '{}'::jsonb, 'Seats 10, or 12 tight.'),
  ('e0d00000-0000-4000-a000-000000000004', 'banquet-5ft', 'Banquet table 5 ft', 'tables', 'rect', 1.524, 0.762, 0.76, 4, '{"mode":"sides"}'::jsonb, 4, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000005', 'banquet-6ft', 'Banquet table 6 ft', 'tables', 'rect', 1.829, 0.762, 0.76, 6, '{"mode":"sides"}'::jsonb, 5, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000006', 'banquet-8ft', 'Banquet table 8 ft', 'tables', 'rect', 2.438, 0.762, 0.76, 8, '{"mode":"sides"}'::jsonb, 6, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000007', 'classroom-6ft', 'Classroom table 6 ft', 'tables', 'rect', 1.829, 0.457, 0.76, 3, '{"mode":"one_side"}'::jsonb, 7, '{}'::jsonb, '18" deep, everyone facing front.'),
  ('e0d00000-0000-4000-a000-000000000008', 'classroom-8ft', 'Classroom table 8 ft', 'tables', 'rect', 2.438, 0.457, 0.76, 4, '{"mode":"one_side"}'::jsonb, 8, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000009', 'cocktail-30', 'Cocktail highboy 30"', 'tables', 'round', 0.762, 0.762, 1.07, 0, '{"mode":"none"}'::jsonb, 9, '{}'::jsonb, 'Standing-height poseur table.'),
  ('e0d00000-0000-4000-a000-000000000010', 'serpentine', 'Serpentine table', 'tables', 'custom', 1.829, 1.829, 0.76, 0, '{"mode":"none"}'::jsonb, 10, '{"points":[[-0.5,-0.5],[-0.305,-0.481],[-0.117,-0.424],[0.056,-0.331],[0.207,-0.207],[0.331,-0.056],[0.424,0.117],[0.481,0.305],[0.5,0.5],[0.08,0.5],[0.069,0.387],[0.036,0.278],[-0.018,0.178],[-0.09,0.09],[-0.178,0.018],[-0.278,-0.036],[-0.387,-0.069],[-0.5,-0.08]]}'::jsonb, 'Quarter-ring — buffets, bars and curved head tables.'),
  ('e0d00000-0000-4000-a000-000000000011', 'boardroom-12ft', 'Boardroom table 12 ft', 'tables', 'rect', 3.658, 1.219, 0.76, 12, '{"mode":"sides","ends":true}'::jsonb, 11, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000012', 'registration-desk', 'Registration desk', 'tables', 'rect', 1.829, 0.762, 0.76, 2, '{"mode":"one_side"}'::jsonb, 12, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000013', 'chair-banquet', 'Banquet chair', 'seating', 'rect', 0.45, 0.45, 0.9, 1, '{"mode":"integral"}'::jsonb, 13, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000014', 'chair-theatre', 'Theatre chair', 'seating', 'rect', 0.5, 0.5, 0.85, 1, '{"mode":"integral"}'::jsonb, 14, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000015', 'armchair', 'Lounge armchair', 'seating', 'rect', 0.85, 0.85, 0.8, 1, '{"mode":"integral"}'::jsonb, 15, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000016', 'sofa-3', 'Sofa (3-seat)', 'seating', 'rect', 2, 0.9, 0.85, 3, '{"mode":"integral"}'::jsonb, 16, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000017', 'lounge-set', 'Lounge set', 'seating', 'rect', 3, 2.4, 0.85, 5, '{"mode":"integral"}'::jsonb, 17, '{}'::jsonb, 'Sofa, two armchairs and a coffee table.'),
  ('e0d00000-0000-4000-a000-000000000018', 'stage-8x4', 'Stage riser 8×4 ft', 'staging', 'rect', 2.438, 1.219, 0.406, 0, '{"mode":"none"}'::jsonb, 18, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000019', 'stage-8x8', 'Stage riser 8×8 ft', 'staging', 'rect', 2.438, 2.438, 0.406, 0, '{"mode":"none"}'::jsonb, 19, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000020', 'stage-steps', 'Stage steps', 'staging', 'rect', 1.219, 0.61, 0.406, 0, '{"mode":"none"}'::jsonb, 20, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000021', 'podium', 'Podium / lectern', 'staging', 'rect', 0.6, 0.5, 1.2, 0, '{"mode":"none"}'::jsonb, 21, '{"layer":"furniture"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000022', 'bar-straight', 'Bar 8 ft (straight)', 'bars_catering', 'rect', 2.438, 0.762, 1.07, 0, '{"mode":"none"}'::jsonb, 22, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000023', 'bar-corner', 'Corner bar (L-shape)', 'bars_catering', 'custom', 2.438, 2.438, 1.07, 0, '{"mode":"none"}'::jsonb, 23, '{"points":[[-0.5,-0.5],[0.5,-0.5],[0.5,-0.1875],[-0.1875,-0.1875],[-0.1875,0.5],[-0.5,0.5]]}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000024', 'buffet-station', 'Buffet station 8 ft', 'bars_catering', 'rect', 2.438, 0.762, 0.76, 0, '{"mode":"none"}'::jsonb, 24, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000025', 'beverage-station', 'Beverage station 6 ft', 'bars_catering', 'rect', 1.829, 0.762, 0.76, 0, '{"mode":"none"}'::jsonb, 25, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000026', 'dance-panel-3ft', 'Dance floor panel 3×3 ft', 'dance_entertainment', 'rect', 0.914, 0.914, 0.02, 0, '{"mode":"none"}'::jsonb, 26, '{"symbol":"dance"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000027', 'dance-floor-12ft', 'Dance floor 12×12 ft', 'dance_entertainment', 'rect', 3.658, 3.658, 0.02, 0, '{"mode":"none"}'::jsonb, 27, '{"symbol":"dance"}'::jsonb, 'Sixteen 3 ft panels.'),
  ('e0d00000-0000-4000-a000-000000000028', 'dj-booth', 'DJ booth', 'dance_entertainment', 'rect', 2, 0.9, 1.1, 0, '{"mode":"none"}'::jsonb, 28, '{"layer":"furniture"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000029', 'projection-screen', 'Projection screen 10 ft', 'av', 'rect', 3.048, 0.6, 2.6, 0, '{"mode":"none"}'::jsonb, 29, '{"symbol":"screen"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000030', 'tv-stand', 'TV on stand (65")', 'av', 'rect', 1.5, 0.6, 1.8, 0, '{"mode":"none"}'::jsonb, 30, '{"symbol":"screen"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000031', 'speaker', 'Speaker on stand', 'av', 'round', 0.6, 0.6, 1.8, 0, '{"mode":"none"}'::jsonb, 31, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000032', 'foh-desk', 'AV / FOH desk', 'av', 'rect', 1.829, 0.762, 0.76, 2, '{"mode":"one_side"}'::jsonb, 32, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000033', 'pipe-drape-10ft', 'Pipe & drape 10 ft', 'decor', 'rect', 3.048, 0.3, 2.438, 0, '{"mode":"none"}'::jsonb, 33, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000034', 'plant', 'Plant / floral', 'decor', 'round', 0.6, 0.6, 1.2, 0, '{"mode":"none"}'::jsonb, 34, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000035', 'sign-easel', 'Sign easel', 'decor', 'rect', 0.6, 0.5, 1.6, 0, '{"mode":"none"}'::jsonb, 35, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000036', 'pillar', 'Pillar', 'structure', 'rect', 0.6, 0.6, null, 0, '{"mode":"none"}'::jsonb, 36, '{}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000037', 'door', 'Door', 'structure', 'rect', 0.914, 0.15, 2.1, 0, '{"mode":"none"}'::jsonb, 37, '{"symbol":"door"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000038', 'door-double', 'Double door', 'structure', 'rect', 1.829, 0.15, 2.1, 0, '{"mode":"none"}'::jsonb, 38, '{"symbol":"door_double"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000039', 'emergency-exit', 'Emergency exit', 'structure', 'rect', 1.2, 0.15, 2.1, 0, '{"mode":"none"}'::jsonb, 39, '{"symbol":"exit"}'::jsonb, ''),
  ('e0d00000-0000-4000-a000-000000000040', 'power-drop', 'Power drop', 'structure', 'rect', 0.3, 0.3, null, 0, '{"mode":"none"}'::jsonb, 40, '{"symbol":"power"}'::jsonb, '')
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

-- @down
drop table if exists events.floor_plans;
drop table if exists events.design_objects;
