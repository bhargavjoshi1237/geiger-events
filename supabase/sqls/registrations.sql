-- ===========================================================================
-- Geiger Events — registrations store
--
-- The workspace-level "people-coming" pipeline: one row per person per event
-- (flow_registrations) plus reusable form definitions (flow_registration_forms),
-- and two RPCs for the waitlist + approval flows. Separate from paid ticket
-- orders (flow_event_orders) — these are the RSVP / registration records.
--
-- Self-contained and idempotent: safe to run repeatedly. Seeds demo rows against
-- the same flow_events UUIDs shipped in sample_data.js so the screens have real
-- cross-event data to render.
--
-- Apply via the Supabase SQL editor (or `npm run db:push`) for the project in
-- .env.
-- ===========================================================================

create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger function (suite convention). Defined here so
-- this migration doesn't depend on the events migration having run.
create or replace function public.flow_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reusable registration forms (field sets the per-event "Custom Questions" tab
-- and the public registration flow consume).
-- ---------------------------------------------------------------------------
create table if not exists public.flow_registration_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled form',
  description text,
  status text not null default 'Draft',
  -- Ordered field defs: [{ id, label, type, required, options?, showWhen? }].
  -- showWhen = { fieldId, equals } drives Conditional Questions.
  fields jsonb not null default '[]'::jsonb,
  -- Access + behaviour: { tokenGated, memberOnly, group, autofill, opensAt,
  -- closesAt, confirmation: { title, body, showCalendar, showShare } }.
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.flow_registration_forms add column if not exists description text;
alter table public.flow_registration_forms add column if not exists fields jsonb not null default '[]'::jsonb;
alter table public.flow_registration_forms add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.flow_registration_forms add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.flow_registration_forms add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.flow_registration_forms add column if not exists deleted_at timestamptz;

drop trigger if exists flow_registration_forms_touch_updated_at on public.flow_registration_forms;
create trigger flow_registration_forms_touch_updated_at
before update on public.flow_registration_forms
for each row execute function public.flow_touch_updated_at();

create index if not exists flow_registration_forms_status_idx
  on public.flow_registration_forms (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Registrations — one row per person per event.
-- ---------------------------------------------------------------------------
create table if not exists public.flow_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.flow_events(id) on delete cascade,
  form_id uuid references public.flow_registration_forms(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text,
  -- Confirmed · Pending · Waitlisted · Declined · Cancelled · Checked-in
  status text not null default 'Confirmed',
  -- Online · Organizer · Import · API
  source text not null default 'Online',
  -- Total seats incl. the registrant; plus_ones holds named extra guests.
  party_size integer not null default 1,
  plus_ones jsonb not null default '[]'::jsonb,
  dietary text,
  accessibility text,
  -- Answers to a form's custom/conditional questions: { [fieldId]: value }.
  answers jsonb not null default '{}'::jsonb,
  -- Rank in the event's waitlist; null unless status = 'Waitlisted'.
  waitlist_position integer,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Back-fill any missing columns on older copies of the table.
alter table public.flow_registrations add column if not exists form_id uuid references public.flow_registration_forms(id) on delete set null;
alter table public.flow_registrations add column if not exists phone text;
alter table public.flow_registrations add column if not exists source text not null default 'Online';
alter table public.flow_registrations add column if not exists party_size integer not null default 1;
alter table public.flow_registrations add column if not exists plus_ones jsonb not null default '[]'::jsonb;
alter table public.flow_registrations add column if not exists dietary text;
alter table public.flow_registrations add column if not exists accessibility text;
alter table public.flow_registrations add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.flow_registrations add column if not exists waitlist_position integer;
alter table public.flow_registrations add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.flow_registrations add column if not exists approved_at timestamptz;
alter table public.flow_registrations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.flow_registrations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.flow_registrations add column if not exists deleted_at timestamptz;

drop trigger if exists flow_registrations_touch_updated_at on public.flow_registrations;
create trigger flow_registrations_touch_updated_at
before update on public.flow_registrations
for each row execute function public.flow_touch_updated_at();

create index if not exists flow_registrations_event_idx
  on public.flow_registrations (event_id) where deleted_at is null;
create index if not exists flow_registrations_status_idx
  on public.flow_registrations (status) where deleted_at is null;
create index if not exists flow_registrations_created_idx
  on public.flow_registrations (created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Promote the next N waitlisted registrations (lowest waitlist_position) for an
-- event to Confirmed, then resequence the remaining waitlist to stay contiguous
-- from 1. Returns the promoted rows. Respects nothing about capacity here — the
-- caller (or auto-promotion rules) decides how many to promote.
create or replace function public.flow_promote_waitlist(
  p_event_id uuid,
  p_count integer default 1
)
returns setof public.flow_registrations
language plpgsql
as $$
declare
  r public.flow_registrations;
begin
  for r in
    select * from public.flow_registrations
    where event_id = p_event_id
      and status = 'Waitlisted'
      and deleted_at is null
    order by waitlist_position asc nulls last, created_at asc
    limit greatest(1, coalesce(p_count, 1))
  loop
    update public.flow_registrations
      set status = 'Confirmed', waitlist_position = null
      where id = r.id
      returning * into r;
    return next r;
  end loop;

  -- Resequence whoever is still waiting so positions stay 1..n with no gaps.
  with ranked as (
    select id, row_number() over (
      order by waitlist_position asc nulls last, created_at asc
    ) as pos
    from public.flow_registrations
    where event_id = p_event_id
      and status = 'Waitlisted'
      and deleted_at is null
  )
  update public.flow_registrations f
    set waitlist_position = ranked.pos
    from ranked
    where f.id = ranked.id
      and f.waitlist_position is distinct from ranked.pos;

  return;
end;
$$;

-- Approve or decline a pending registration, stamping who acted and when.
create or replace function public.flow_approve_registration(
  p_id uuid,
  p_approve boolean,
  p_by uuid default null
)
returns public.flow_registrations
language plpgsql
as $$
declare
  r public.flow_registrations;
begin
  update public.flow_registrations
    set status = case when p_approve then 'Confirmed' else 'Declined' end,
        approved_by = p_by,
        approved_at = now()
    where id = p_id
    returning * into r;
  return r;
end;
$$;

-- Public registration entry point. Computes the right status from the event's
-- capacity + the form's approval/waitlist policy, then inserts. Called by the
-- public /e/<id> page so a sign-up lands in the RSVPs / Approval / Waitlist
-- screens with the correct state. Returns the created row.
create or replace function public.flow_register(
  p_event_id uuid,
  p_form_id uuid default null,
  p_name text default '',
  p_email text default '',
  p_phone text default null,
  p_party_size integer default 1,
  p_plus_ones jsonb default '[]'::jsonb,
  p_dietary text default null,
  p_accessibility text default null,
  p_answers jsonb default '{}'::jsonb,
  p_require_approval boolean default false,
  p_allow_waitlist boolean default true,
  p_source text default 'Online'
)
returns public.flow_registrations
language plpgsql
as $$
declare
  v_cap integer;
  v_taken integer;
  v_party integer := greatest(1, coalesce(p_party_size, 1));
  v_status text;
  v_pos integer;
  r public.flow_registrations;
begin
  select capacity into v_cap from public.flow_events where id = p_event_id;
  select coalesce(sum(party_size), 0) into v_taken
    from public.flow_registrations
    where event_id = p_event_id
      and status in ('Confirmed', 'Checked-in')
      and deleted_at is null;

  if p_require_approval then
    v_status := 'Pending';
  elsif coalesce(v_cap, 0) > 0
        and (v_taken + v_party) > v_cap
        and p_allow_waitlist then
    v_status := 'Waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into v_pos
      from public.flow_registrations
      where event_id = p_event_id
        and status = 'Waitlisted'
        and deleted_at is null;
  else
    v_status := 'Confirmed';
  end if;

  insert into public.flow_registrations
    (event_id, form_id, name, email, phone, status, source, party_size,
     plus_ones, dietary, accessibility, answers, waitlist_position)
  values
    (p_event_id, p_form_id, p_name, p_email, nullif(p_phone, ''), v_status,
     coalesce(p_source, 'Online'), v_party, coalesce(p_plus_ones, '[]'::jsonb),
     nullif(p_dietary, ''), nullif(p_accessibility, ''),
     coalesce(p_answers, '{}'::jsonb), v_pos)
  returning * into r;

  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS. The dashboard currently runs unauthenticated (anon key), so the demo
-- policy grants open access. Replace with an org-scoped policy when auth lands.
-- ---------------------------------------------------------------------------
alter table public.flow_registration_forms enable row level security;
drop policy if exists flow_registration_forms_demo_all on public.flow_registration_forms;
create policy flow_registration_forms_demo_all on public.flow_registration_forms
  for all to anon, authenticated using (true) with check (true);

alter table public.flow_registrations enable row level security;
drop policy if exists flow_registrations_demo_all on public.flow_registrations;
create policy flow_registrations_demo_all on public.flow_registrations
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed — reusable forms (stable UUIDs).
-- ---------------------------------------------------------------------------
insert into public.flow_registration_forms (id, name, description, status, fields, settings)
values
  (
    '5e1f0a00-0000-4000-a000-000000000001',
    'Standard RSVP',
    'Name, email, and dietary needs — the default for community meetups.',
    'Published',
    '[
      {"id":"name","label":"Full name","type":"text","required":true},
      {"id":"email","label":"Email","type":"email","required":true},
      {"id":"dietary","label":"Dietary requirements","type":"select","required":false,"options":["None","Vegetarian","Vegan","Gluten-free","Nut allergy"]},
      {"id":"diet_other","label":"Tell us more","type":"text","required":false,"showWhen":{"fieldId":"dietary","equals":"Nut allergy"}}
    ]'::jsonb,
    '{"tokenGated":false,"memberOnly":false,"group":false,"autofill":true,"opensAt":"","closesAt":"","confirmation":{"title":"You''re in!","body":"Thanks for registering — we''ve emailed your confirmation.","showCalendar":true,"showShare":true}}'::jsonb
  ),
  (
    '5e1f0a00-0000-4000-a000-000000000002',
    'Conference Registration',
    'Fuller form with company, role, and accessibility — for ticketed conferences.',
    'Published',
    '[
      {"id":"name","label":"Full name","type":"text","required":true},
      {"id":"email","label":"Work email","type":"email","required":true},
      {"id":"company","label":"Company","type":"text","required":false},
      {"id":"role","label":"Role","type":"select","required":false,"options":["Founder","Engineer","Designer","Product","Other"]},
      {"id":"accessibility","label":"Accessibility needs","type":"textarea","required":false}
    ]'::jsonb,
    '{"tokenGated":false,"memberOnly":true,"group":true,"autofill":true,"opensAt":"","closesAt":"","confirmation":{"title":"See you there","body":"Your badge will be ready at the door.","showCalendar":true,"showShare":false}}'::jsonb
  ),
  (
    '5e1f0a00-0000-4000-a000-000000000003',
    'Token-gated Drop',
    'Wallet-gated registration for holders-only events.',
    'Draft',
    '[
      {"id":"name","label":"Display name","type":"text","required":true},
      {"id":"wallet","label":"Wallet address","type":"text","required":true}
    ]'::jsonb,
    '{"tokenGated":true,"memberOnly":false,"group":false,"autofill":false,"opensAt":"","closesAt":"","confirmation":{"title":"Verified","body":"Your spot is reserved.","showCalendar":true,"showShare":true}}'::jsonb
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed — registrations across the 8 demo events (stable UUIDs). A spread of
-- statuses and sources, a few with plus-ones / dietary / accessibility, and a
-- waitlist with positions on the sold-out event.
-- ---------------------------------------------------------------------------
insert into public.flow_registrations
  (id, event_id, form_id, name, email, phone, status, source, party_size, plus_ones, dietary, accessibility, waitlist_position)
values
  -- Summer Product Launch (7b1c0e9a…) — healthy mix
  ('a0000000-0000-4000-a000-000000000001','7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01','5e1f0a00-0000-4000-a000-000000000001','Olivia Bennett','olivia.bennett@example.com','+44 7700 900111','Confirmed','Online',2,'[{"name":"Tom Bennett"}]'::jsonb,'Vegetarian',null,null),
  ('a0000000-0000-4000-a000-000000000002','7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01','5e1f0a00-0000-4000-a000-000000000001','James Carter','james.carter@example.com',null,'Confirmed','Online',1,'[]'::jsonb,null,'Step-free access please',null),
  ('a0000000-0000-4000-a000-000000000003','7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01','5e1f0a00-0000-4000-a000-000000000001','Sophia Turner','sophia.turner@example.com',null,'Pending','Online',1,'[]'::jsonb,'Vegan',null,null),
  ('a0000000-0000-4000-a000-000000000004','7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01','5e1f0a00-0000-4000-a000-000000000001','Liam Walsh','liam.walsh@example.com',null,'Checked-in','Organizer',1,'[]'::jsonb,null,null,null),

  -- Local Music Night (a2d4f6e8…) — sold out: confirmed + a waitlist
  ('a0000000-0000-4000-a000-000000000010','a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02','5e1f0a00-0000-4000-a000-000000000001','Emma Hughes','emma.hughes@example.com',null,'Confirmed','Online',2,'[{"name":"Noah Hughes"}]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000011','a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02','5e1f0a00-0000-4000-a000-000000000001','Mason Reid','mason.reid@example.com',null,'Waitlisted','Online',1,'[]'::jsonb,null,null,1),
  ('a0000000-0000-4000-a000-000000000012','a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02','5e1f0a00-0000-4000-a000-000000000001','Ava Collins','ava.collins@example.com',null,'Waitlisted','Online',1,'[]'::jsonb,'Gluten-free',null,2),
  ('a0000000-0000-4000-a000-000000000013','a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02','5e1f0a00-0000-4000-a000-000000000001','Ethan Brooks','ethan.brooks@example.com',null,'Waitlisted','Online',2,'[{"name":"Mia Brooks"}]'::jsonb,null,null,3),

  -- Founder AMA — Live (c3e5079b…) — online, mostly confirmed
  ('a0000000-0000-4000-a000-000000000020','c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03','5e1f0a00-0000-4000-a000-000000000002','Charlotte Price','charlotte.price@example.com',null,'Confirmed','Online',1,'[]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000021','c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03','5e1f0a00-0000-4000-a000-000000000002','Benjamin Gray','benjamin.gray@example.com',null,'Confirmed','API',1,'[]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000022','c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03','5e1f0a00-0000-4000-a000-000000000002','Amelia Ward','amelia.ward@example.com',null,'Cancelled','Online',1,'[]'::jsonb,null,null,null),

  -- Design Systems Workshop (d4f618ac…) — approval-gated draft
  ('a0000000-0000-4000-a000-000000000030','d4f618ac-3d5e-4f70-ab12-4c5d6e7f8004','5e1f0a00-0000-4000-a000-000000000002','Harry Foster','harry.foster@example.com',null,'Pending','Online',1,'[]'::jsonb,null,'Wheelchair user — please reserve front-row',null),
  ('a0000000-0000-4000-a000-000000000031','d4f618ac-3d5e-4f70-ab12-4c5d6e7f8004','5e1f0a00-0000-4000-a000-000000000002','Isla Murray','isla.murray@example.com',null,'Pending','Online',1,'[]'::jsonb,'Nut allergy',null,null),
  ('a0000000-0000-4000-a000-000000000032','d4f618ac-3d5e-4f70-ab12-4c5d6e7f8004','5e1f0a00-0000-4000-a000-000000000002','Jack Hammond','jack.hammond@example.com',null,'Confirmed','Organizer',1,'[]'::jsonb,null,null,null),

  -- Indie Film Screening (e50729bd…)
  ('a0000000-0000-4000-a000-000000000040','e50729bd-4e6f-4081-bc23-5d6e7f809105','5e1f0a00-0000-4000-a000-000000000001','Grace Sullivan','grace.sullivan@example.com',null,'Confirmed','Online',2,'[{"name":"Leo Sullivan"}]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000041','e50729bd-4e6f-4081-bc23-5d6e7f809105','5e1f0a00-0000-4000-a000-000000000001','Oscar Dawson','oscar.dawson@example.com',null,'Confirmed','Online',1,'[]'::jsonb,'Vegetarian',null,null),
  ('a0000000-0000-4000-a000-000000000042','e50729bd-4e6f-4081-bc23-5d6e7f809105','5e1f0a00-0000-4000-a000-000000000001','Freya Knight','freya.knight@example.com',null,'Checked-in','Online',1,'[]'::jsonb,null,null,null),

  -- Startup Networking Brunch (f61830ce…) — pre-sale, organizer comps
  ('a0000000-0000-4000-a000-000000000050','f61830ce-5f70-4192-cd34-6e7f8091a206','5e1f0a00-0000-4000-a000-000000000002','Daniel Webb','daniel.webb@example.com',null,'Confirmed','Organizer',1,'[]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000051','f61830ce-5f70-4192-cd34-6e7f8091a206','5e1f0a00-0000-4000-a000-000000000002','Ruby Marshall','ruby.marshall@example.com',null,'Confirmed','Import',1,'[]'::jsonb,'Vegan',null,null),

  -- Q2 Customer Webinar (072941df…) — ended, large
  ('a0000000-0000-4000-a000-000000000060','072941df-6081-42a3-de45-7f8091a2b307','5e1f0a00-0000-4000-a000-000000000002','Henry Cole','henry.cole@example.com',null,'Checked-in','Online',1,'[]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000061','072941df-6081-42a3-de45-7f8091a2b307','5e1f0a00-0000-4000-a000-000000000002','Lily Page','lily.page@example.com',null,'Checked-in','API',1,'[]'::jsonb,null,null,null),

  -- Pottery Masterclass (183a52e0…) — small, near capacity + waitlist
  ('a0000000-0000-4000-a000-000000000070','183a52e0-7192-43b4-ef56-8091a2b3c408','5e1f0a00-0000-4000-a000-000000000001','Evie Barnes','evie.barnes@example.com',null,'Confirmed','Online',1,'[]'::jsonb,null,null,null),
  ('a0000000-0000-4000-a000-000000000071','183a52e0-7192-43b4-ef56-8091a2b3c408','5e1f0a00-0000-4000-a000-000000000001','Theo Fleming','theo.fleming@example.com',null,'Waitlisted','Online',1,'[]'::jsonb,null,null,1),
  ('a0000000-0000-4000-a000-000000000072','183a52e0-7192-43b4-ef56-8091a2b3c408','5e1f0a00-0000-4000-a000-000000000001','Poppy Norton','poppy.norton@example.com',null,'Pending','Online',1,'[]'::jsonb,'Gluten-free',null,null)
on conflict (id) do nothing;
