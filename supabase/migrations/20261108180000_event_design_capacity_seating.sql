-- @up
-- Event Design: project planning rules for the capacity engine (design_settings), and Seating Charts —
-- guests assigned to seats / tables on a floor plan (seating_chart_assignments) plus seating rules (seating_chart_rules).
-- Named seating_chart_* so they never get confused with Reserved Seating's ticketed seat_assignments / seat_maps.

create schema if not exists events;

-- One row per project: overrides for lib/event_design/capacity.js DEFAULT_PLANNING_RULES (m² per person, aisle widths, exit clearance…).
create table if not exists events.design_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists design_settings_touch on events.design_settings;
create trigger design_settings_touch
  before update on events.design_settings
  for each row execute function events.touch_updated_at();

alter table events.design_settings enable row level security;

drop policy if exists design_settings_member_all on events.design_settings;
create policy design_settings_member_all on events.design_settings
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.design_settings to authenticated;

-- Seating rows take project_id from their plan, so RLS rejects rows aimed at another project's plan (seat / guest-key squatting).
create or replace function events.seating_chart_plan_project()
returns trigger
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from events.floor_plans where id = new.floor_plan_id;
  if v_project is null then
    raise exception 'FLOOR_PLAN_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;
  new.project_id := v_project;
  return new;
end;
$$;

revoke all on function events.seating_chart_plan_project() from public, anon, authenticated;

-- A guest's place on one floor plan. item_id + seat_index = a seat; item_id alone = at that table, seat TBD; neither = not seated yet
-- (the row still carries meal choice, VIP and notes). The guest is the event roster key from lib/passes/attendees.js.
create table if not exists events.seating_chart_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_id uuid not null references events.floor_plans(id) on delete cascade,
  -- Placed instance id inside floor_plans.objects (client-made, stable across saves).
  item_id text,
  seat_index integer check (seat_index is null or seat_index >= 0),
  -- Source record: order (event_orders.id), registration (registrations.id), team / speaker / sponsor / booth, or a hand-added guest.
  guest_kind text not null default 'manual'
    check (guest_kind in ('order', 'registration', 'team', 'speaker', 'sponsor', 'booth', 'manual')),
  guest_ref text,
  -- Roster key: "order:<id>:<n>", "reg:<id>", "reg:<id>:guest:<n>", "speaker:<id>", "manual:<uuid>"…
  guest_key text not null,
  -- Snapshot so printouts survive a cancelled ticket.
  guest_name text not null default '',
  guest_email text not null default '',
  -- Party / group name; empty = the order or registration the guest came with.
  party text not null default '',
  meal text not null default '',
  dietary text not null default '',
  vip boolean not null default false,
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint seating_chart_assignments_seat_needs_item check (seat_index is null or item_id is not null)
);

create unique index if not exists seating_chart_assignments_seat_uidx
  on events.seating_chart_assignments (floor_plan_id, item_id, seat_index)
  where deleted_at is null and seat_index is not null;
create unique index if not exists seating_chart_assignments_guest_uidx
  on events.seating_chart_assignments (floor_plan_id, guest_key)
  where deleted_at is null;
create index if not exists seating_chart_assignments_project_idx
  on events.seating_chart_assignments (project_id)
  where deleted_at is null;

drop trigger if exists seating_chart_assignments_project on events.seating_chart_assignments;
create trigger seating_chart_assignments_project
  before insert or update of floor_plan_id, project_id on events.seating_chart_assignments
  for each row execute function events.seating_chart_plan_project();

drop trigger if exists seating_chart_assignments_touch on events.seating_chart_assignments;
create trigger seating_chart_assignments_touch
  before update on events.seating_chart_assignments
  for each row execute function events.touch_updated_at();

alter table events.seating_chart_assignments enable row level security;

drop policy if exists seating_chart_assignments_member_all on events.seating_chart_assignments;
create policy seating_chart_assignments_member_all on events.seating_chart_assignments
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.seating_chart_assignments to authenticated;

-- together / apart: `guests` (roster keys). vip_table / reserved_table: `items` (table instance ids), reserved optionally for `guests`.
create table if not exists events.seating_chart_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_id uuid not null references events.floor_plans(id) on delete cascade,
  kind text not null check (kind in ('together', 'apart', 'vip_table', 'reserved_table')),
  label text not null default '',
  guests jsonb not null default '[]'::jsonb check (jsonb_typeof(guests) = 'array'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists seating_chart_rules_plan_idx
  on events.seating_chart_rules (floor_plan_id)
  where deleted_at is null;

drop trigger if exists seating_chart_rules_project on events.seating_chart_rules;
create trigger seating_chart_rules_project
  before insert or update of floor_plan_id, project_id on events.seating_chart_rules
  for each row execute function events.seating_chart_plan_project();

drop trigger if exists seating_chart_rules_touch on events.seating_chart_rules;
create trigger seating_chart_rules_touch
  before update on events.seating_chart_rules
  for each row execute function events.touch_updated_at();

alter table events.seating_chart_rules enable row level security;

drop policy if exists seating_chart_rules_member_all on events.seating_chart_rules;
create policy seating_chart_rules_member_all on events.seating_chart_rules
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.seating_chart_rules to authenticated;

-- Applies a batch of guest rows to a plan atomically: upserts each guest by key (only the keys present change), then moves seats
-- in two passes (clear every moved row, then set) so swaps and bulk auto-seating never trip the one-guest-per-seat index.
-- SECURITY INVOKER: the caller's RLS decides what they can touch.
create or replace function events.seating_chart_apply(p_plan uuid, p_rows jsonb)
returns setof events.seating_chart_assignments
language plpgsql
security invoker
set search_path = events, public
as $$
declare
  v_project uuid;
  v_row jsonb;
  v_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_moves uuid[] := array[]::uuid[];
  v_targets jsonb[] := array[]::jsonb[];
  v_item text;
  i integer;
begin
  select project_id into v_project from events.floor_plans where id = p_plan and deleted_at is null;
  if v_project is null then
    raise exception 'floor plan not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'rows must be a json array' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(btrim(v_row->>'guest_key'), '') = '' then
      continue;
    end if;
    v_id := null;
    select a.id into v_id from events.seating_chart_assignments a
      where a.floor_plan_id = p_plan and a.guest_key = v_row->>'guest_key' and a.deleted_at is null;
    if v_id is null then
      insert into events.seating_chart_assignments
        (project_id, floor_plan_id, guest_key, guest_kind, guest_ref, guest_name, guest_email, party, meal, dietary, vip, notes, created_by)
      values (
        v_project,
        p_plan,
        v_row->>'guest_key',
        coalesce(nullif(v_row->>'guest_kind', ''), 'manual'),
        nullif(v_row->>'guest_ref', ''),
        coalesce(v_row->>'guest_name', ''),
        coalesce(v_row->>'guest_email', ''),
        coalesce(v_row->>'party', ''),
        coalesce(v_row->>'meal', ''),
        coalesce(v_row->>'dietary', ''),
        coalesce((v_row->>'vip')::boolean, false),
        coalesce(v_row->>'notes', ''),
        auth.uid()
      )
      returning id into v_id;
    else
      update events.seating_chart_assignments a set
        guest_name = case when v_row ? 'guest_name' then coalesce(v_row->>'guest_name', '') else a.guest_name end,
        guest_email = case when v_row ? 'guest_email' then coalesce(v_row->>'guest_email', '') else a.guest_email end,
        party = case when v_row ? 'party' then coalesce(v_row->>'party', '') else a.party end,
        meal = case when v_row ? 'meal' then coalesce(v_row->>'meal', '') else a.meal end,
        dietary = case when v_row ? 'dietary' then coalesce(v_row->>'dietary', '') else a.dietary end,
        vip = case when v_row ? 'vip' then coalesce((v_row->>'vip')::boolean, false) else a.vip end,
        notes = case when v_row ? 'notes' then coalesce(v_row->>'notes', '') else a.notes end
      where a.id = v_id;
    end if;
    v_ids := v_ids || v_id;
    if v_row ? 'item_id' then
      update events.seating_chart_assignments set item_id = null, seat_index = null where id = v_id;
      v_moves := v_moves || v_id;
      v_targets := v_targets || v_row;
    end if;
  end loop;

  for i in 1 .. coalesce(array_length(v_moves, 1), 0) loop
    v_item := nullif(v_targets[i]->>'item_id', '');
    update events.seating_chart_assignments
      set item_id = v_item,
          seat_index = case when v_item is null then null else nullif(v_targets[i]->>'seat_index', '')::integer end
      where id = v_moves[i];
  end loop;

  return query select * from events.seating_chart_assignments where id = any(v_ids);
end;
$$;

revoke all on function events.seating_chart_apply(uuid, jsonb) from public, anon;
grant execute on function events.seating_chart_apply(uuid, jsonb) to authenticated;

-- @down
drop function if exists events.seating_chart_apply(uuid, jsonb);
drop table if exists events.seating_chart_rules;
drop table if exists events.seating_chart_assignments;
drop function if exists events.seating_chart_plan_project();
drop table if exists events.design_settings;
