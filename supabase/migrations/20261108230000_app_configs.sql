-- @up
-- One mobile-app configuration per project (sections, home, white-label build settings). Shape: lib/app_config/model.js.

create schema if not exists events;

create table if not exists events.app_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_configs_touch on events.app_configs;
create trigger app_configs_touch
  before update on events.app_configs
  for each row execute function events.touch_updated_at();

alter table events.app_configs enable row level security;

drop policy if exists app_configs_member_all on events.app_configs;
create policy app_configs_member_all on events.app_configs
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.app_configs to authenticated;

-- Carry over the retired Mobile Event App screen's singleton so nobody loses their toggles.
-- That screen auto-created its row with placeholder copy on first visit, so its untouched defaults are dropped, not copied to phones.
insert into events.app_configs (project_id, config)
select distinct on (r.project_id)
  r.project_id,
  jsonb_build_object(
    'version', 1,
    'sections', jsonb_strip_nulls(jsonb_build_object(
      'agenda', r.config -> 'tabs' -> 'agenda',
      'speakers', r.config -> 'tabs' -> 'speakers',
      'map', r.config -> 'tabs' -> 'maps',
      'networking', r.config -> 'tabs' -> 'networking',
      'sponsors', r.config -> 'tabs' -> 'sponsors',
      'live', r.config -> 'tabs' -> 'live',
      'notifications', r.config -> 'tabs' -> 'notifications'
    )),
    'home', jsonb_strip_nulls(jsonb_build_object(
      'welcome', nullif(r.config ->> 'splashMessage', 'Welcome! Tap Agenda to plan your day.')
    )),
    'whiteLabel', jsonb_strip_nulls(jsonb_build_object(
      'appName', nullif(r.config ->> 'appName', 'Event App'),
      'tagline', nullif(r.config ->> 'tagline', 'Everything you need, in your pocket.'),
      'accent', r.config ->> 'accent',
      'iosUrl', r.config ->> 'iosUrl',
      'androidUrl', r.config ->> 'androidUrl'
    ))
  )
from events.conference_records r
where r.module = 'mobile_app'
  and r.deleted_at is null
  and r.project_id is not null
order by r.project_id, r.updated_at desc
on conflict (project_id) do nothing;

-- @down
drop table if exists events.app_configs;
