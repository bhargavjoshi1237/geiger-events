-- @up
-- Smart Custom Proposals: venue RFPs, the venues invited to bid, and their tokenised bid responses.
-- Venues answer at /rfp/<token> without an account; only a sha256 of the token is stored, and anon reaches the data solely through the rfp_public_* definer functions.

create schema if not exists events;

create table if not exists events.rfps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  title text not null default 'Untitled RFP',
  summary text not null default '',
  start_date date,
  end_date date,
  dates_flexible boolean not null default false,
  -- [{ "start": "2027-03-10", "end": "2027-03-11" }]
  alternate_dates jsonb not null default '[]'::jsonb,
  attendees integer not null default 0 check (attendees >= 0),
  location text not null default '',
  -- [{ "id", "label", "setup_style", "capacity", "days" }]
  room_requirements jsonb not null default '[]'::jsonb,
  -- { "nights": [{ "date": "2027-03-10", "rooms": 120 }] }
  sleeping_rooms jsonb not null default '{"nights": []}'::jsonb,
  fnb_requirements text not null default '',
  fnb_minimum numeric(14, 2),
  av_needs text not null default '',
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  currency text not null default 'USD',
  -- Whether venues see the budget range on the response page.
  share_budget boolean not null default false,
  response_deadline timestamptz,
  decision_date date,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'closed', 'awarded', 'cancelled')),
  awarded_bid_id uuid,
  awarded_venue_id uuid references events.venues(id) on delete set null,
  awarded_at timestamptz,
  sent_at timestamptz,
  -- Relative weights for bid scoring: { "price", "capacity", "concessions", "terms" }.
  scoring_weights jsonb not null default '{"price": 40, "capacity": 25, "concessions": 15, "terms": 20}'::jsonb,
  contact_name text not null default '',
  contact_email text not null default '',
  -- Internal only, never shown to venues.
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists events.rfp_recipients (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references events.rfps(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source text not null default 'manual' check (source in ('venue', 'pipeline', 'manual')),
  venue_id uuid references events.venues(id) on delete set null,
  pipeline_record_id uuid references events.conference_records(id) on delete set null,
  name text not null default '',
  contact_name text not null default '',
  email text not null default '',
  -- Snapshot for ranking and venue conversion: { city, address, country, capacity, latitude, longitude, phone, website }.
  details jsonb not null default '{}'::jsonb,
  -- sha256 hex of the emailed link token; rotated on every resend.
  token_hash text,
  status text not null default 'invited'
    check (status in ('invited', 'viewed', 'declined', 'responded', 'awarded', 'lost')),
  invited_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  declined_at timestamptz,
  decline_reason text not null default '',
  last_emailed_at timestamptz,
  -- Outcome of the latest email: { kind, status: sent | failed | off, at, error }.
  email_status jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists events.rfp_bids (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references events.rfps(id) on delete cascade,
  recipient_id uuid not null references events.rfp_recipients(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Every revision is its own row; is_current marks the one in play.
  revision integer not null default 1,
  is_current boolean not null default true,
  -- [{ "category": room | fnb | av | sleeping | fees | other, "label", "qty", "unit_price", "total" }]
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(14, 2) not null default 0,
  taxes_fees numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  -- Largest group the offered space holds.
  capacity integer,
  -- ["Complimentary Wi-Fi", "1 comp room per 40 booked"]
  concessions jsonb not null default '[]'::jsonb,
  deposit_pct numeric(5, 2),
  -- Share of the room block that can be released without penalty.
  attrition_pct numeric(5, 2),
  cancellation_policy text not null default '',
  availability_notes text not null default '',
  valid_until date,
  message text not null default '',
  submitted_by_name text not null default '',
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'awarded', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Reusable requirement sets ("Conference 300 pax, 2 days") saved by the organiser.
create table if not exists events.rfp_presets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Untitled preset',
  description text not null default '',
  -- { attendees, days, roomRequirements, sleepingRooms, fnbRequirements, fnbMinimum, avNeeds }
  requirements jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rfps_awarded_bid_fk') then
    alter table events.rfps
      add constraint rfps_awarded_bid_fk foreign key (awarded_bid_id)
      references events.rfp_bids(id) on delete set null;
  end if;
end;
$$;

create index if not exists rfps_project_idx
  on events.rfps (project_id, created_at desc)
  where deleted_at is null;
create index if not exists rfps_event_idx
  on events.rfps (event_id)
  where deleted_at is null;

create index if not exists rfp_recipients_rfp_idx
  on events.rfp_recipients (rfp_id)
  where deleted_at is null;
create index if not exists rfp_recipients_project_idx
  on events.rfp_recipients (project_id)
  where deleted_at is null;
create unique index if not exists rfp_recipients_token_idx
  on events.rfp_recipients (token_hash)
  where token_hash is not null;
create unique index if not exists rfp_recipients_email_idx
  on events.rfp_recipients (rfp_id, lower(email))
  where deleted_at is null and email <> '';

create index if not exists rfp_bids_rfp_idx
  on events.rfp_bids (rfp_id, recipient_id)
  where deleted_at is null;
create index if not exists rfp_bids_project_idx
  on events.rfp_bids (project_id)
  where deleted_at is null and is_current;
create unique index if not exists rfp_bids_current_idx
  on events.rfp_bids (recipient_id)
  where is_current and deleted_at is null;
create unique index if not exists rfp_bids_revision_idx
  on events.rfp_bids (recipient_id, revision);

create index if not exists rfp_presets_project_idx
  on events.rfp_presets (project_id)
  where deleted_at is null;

-- Recipients and bids always inherit their RFP's project, so a row can't be filed under another project.
create or replace function events.rfp_child_project()
returns trigger
language plpgsql
set search_path = events, public
as $$
begin
  new.project_id := (select r.project_id from events.rfps r where r.id = new.rfp_id);
  if new.project_id is null then
    raise exception 'RFP_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists rfp_recipients_project on events.rfp_recipients;
create trigger rfp_recipients_project
  before insert or update of rfp_id, project_id on events.rfp_recipients
  for each row execute function events.rfp_child_project();

drop trigger if exists rfp_bids_project on events.rfp_bids;
create trigger rfp_bids_project
  before insert or update of rfp_id, project_id on events.rfp_bids
  for each row execute function events.rfp_child_project();

drop trigger if exists rfps_touch on events.rfps;
create trigger rfps_touch
  before update on events.rfps
  for each row execute function events.touch_updated_at();

drop trigger if exists rfp_recipients_touch on events.rfp_recipients;
create trigger rfp_recipients_touch
  before update on events.rfp_recipients
  for each row execute function events.touch_updated_at();

drop trigger if exists rfp_bids_touch on events.rfp_bids;
create trigger rfp_bids_touch
  before update on events.rfp_bids
  for each row execute function events.touch_updated_at();

drop trigger if exists rfp_presets_touch on events.rfp_presets;
create trigger rfp_presets_touch
  before update on events.rfp_presets
  for each row execute function events.touch_updated_at();

alter table events.rfps enable row level security;
alter table events.rfp_recipients enable row level security;
alter table events.rfp_bids enable row level security;
alter table events.rfp_presets enable row level security;

drop policy if exists rfps_member_all on events.rfps;
create policy rfps_member_all on events.rfps
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists rfp_recipients_member_all on events.rfp_recipients;
create policy rfp_recipients_member_all on events.rfp_recipients
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists rfp_bids_member_all on events.rfp_bids;
create policy rfp_bids_member_all on events.rfp_bids
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

drop policy if exists rfp_presets_member_all on events.rfp_presets;
create policy rfp_presets_member_all on events.rfp_presets
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.rfps to authenticated;
grant select, insert, update, delete on events.rfp_recipients to authenticated;
grant select, insert, update, delete on events.rfp_bids to authenticated;
grant select, insert, update, delete on events.rfp_presets to authenticated;

-- ---------------------------------------------------------------------------
-- Token-gated public surface. The raw token only ever travels in the emailed link.
-- ---------------------------------------------------------------------------

create or replace function events.rfp_safe_numeric(p text)
returns numeric
language plpgsql
immutable
set search_path = events, public
as $$
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  return btrim(p)::numeric;
exception when others then
  return null;
end;
$$;

-- The live recipient a link token belongs to, or null.
create or replace function events.rfp_public_recipient_id(p_token text)
returns uuid
language sql
stable
security definer
set search_path = events, public
as $$
  select r.id
  from events.rfp_recipients r
  where p_token ~ '^[A-Za-z0-9_-]{32,128}$'
    and r.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and r.deleted_at is null
  limit 1;
$$;

-- What the response page should show: open | expired | closed | awarded | lost | cancelled.
create or replace function events.rfp_public_state(p_rfp events.rfps, p_recipient events.rfp_recipients)
returns text
language sql
stable
set search_path = events, public
as $$
  select case
    when p_rfp.status = 'cancelled' then 'cancelled'
    when p_recipient.status = 'awarded' then 'awarded'
    when p_rfp.status = 'awarded' then 'lost'
    when p_rfp.status <> 'sent' then 'closed'
    when p_rfp.response_deadline is not null and p_rfp.response_deadline < now() then 'expired'
    else 'open'
  end;
$$;

-- The brief, this venue's own current bid and the deadline. Marks the invitation viewed.
create or replace function events.rfp_public_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_id uuid := events.rfp_public_recipient_id(p_token);
  v_rec events.rfp_recipients;
  v_rfp events.rfps;
  v_bid events.rfp_bids;
  v_event_name text;
  v_event_date date;
  v_org text;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_rec from events.rfp_recipients where id = v_id;
  select * into v_rfp from events.rfps where id = v_rec.rfp_id and deleted_at is null;
  if not found or v_rfp.status = 'draft' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_rec.viewed_at is null then
    update events.rfp_recipients
      set viewed_at = now(),
          status = case when status = 'invited' then 'viewed' else status end
      where id = v_rec.id
      returning * into v_rec;
  end if;

  select * into v_bid from events.rfp_bids
    where recipient_id = v_rec.id and is_current and deleted_at is null;
  select e.name, e.event_date into v_event_name, v_event_date
    from events.events e
    where e.id = v_rfp.event_id and e.project_id = v_rfp.project_id and e.deleted_at is null;
  select p.name into v_org from public.projects p where p.id = v_rfp.project_id;

  return jsonb_build_object(
    'ok', true,
    'state', events.rfp_public_state(v_rfp, v_rec),
    'rfp', jsonb_build_object(
      'title', v_rfp.title,
      'summary', v_rfp.summary,
      'startDate', v_rfp.start_date,
      'endDate', v_rfp.end_date,
      'datesFlexible', v_rfp.dates_flexible,
      'alternateDates', v_rfp.alternate_dates,
      'attendees', v_rfp.attendees,
      'location', v_rfp.location,
      'roomRequirements', v_rfp.room_requirements,
      'sleepingRooms', v_rfp.sleeping_rooms,
      'fnbRequirements', v_rfp.fnb_requirements,
      'fnbMinimum', v_rfp.fnb_minimum,
      'avNeeds', v_rfp.av_needs,
      'budgetMin', case when v_rfp.share_budget then v_rfp.budget_min end,
      'budgetMax', case when v_rfp.share_budget then v_rfp.budget_max end,
      'currency', v_rfp.currency,
      'responseDeadline', v_rfp.response_deadline,
      'decisionDate', v_rfp.decision_date,
      'contactName', v_rfp.contact_name,
      'contactEmail', v_rfp.contact_email,
      'organizerName', coalesce(v_org, ''),
      'eventName', coalesce(v_event_name, ''),
      'eventDate', v_event_date
    ),
    'recipient', jsonb_build_object(
      'name', v_rec.name,
      'contactName', v_rec.contact_name,
      'status', v_rec.status,
      'declineReason', v_rec.decline_reason
    ),
    'bid', case when v_bid.id is null then null else jsonb_build_object(
      'revision', v_bid.revision,
      'lineItems', v_bid.line_items,
      'subtotal', v_bid.subtotal,
      'taxesFees', v_bid.taxes_fees,
      'total', v_bid.total,
      'currency', v_bid.currency,
      'capacity', v_bid.capacity,
      'concessions', v_bid.concessions,
      'depositPct', v_bid.deposit_pct,
      'attritionPct', v_bid.attrition_pct,
      'cancellationPolicy', v_bid.cancellation_policy,
      'availabilityNotes', v_bid.availability_notes,
      'validUntil', v_bid.valid_until,
      'message', v_bid.message,
      'submittedByName', v_bid.submitted_by_name,
      'submittedAt', v_bid.submitted_at
    ) end
  );
end;
$$;

-- Files a new bid revision. Totals are recomputed here; the browser's arithmetic is never trusted.
create or replace function events.rfp_public_submit(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_id uuid := events.rfp_public_recipient_id(p_token);
  v_rec events.rfp_recipients;
  v_rfp events.rfps;
  v_prev events.rfp_bids;
  v_bid events.rfp_bids;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_cat text;
  v_label text;
  v_qty numeric;
  v_price numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_fees numeric;
  v_concessions jsonb := '[]'::jsonb;
  v_c text;
  v_deposit numeric;
  v_attrition numeric;
  v_capacity numeric;
  v_valid date;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_rec from events.rfp_recipients where id = v_id for update;
  select * into v_rfp from events.rfps where id = v_rec.rfp_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_rfp.status <> 'sent' or v_rec.status in ('awarded', 'lost') then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_rfp.response_deadline is not null and v_rfp.response_deadline < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload->'lineItems') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Add at least one priced line item.');
  end if;
  if jsonb_array_length(p_payload->'lineItems') > 60 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'A proposal can have at most 60 line items.');
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'lineItems') loop
    continue when jsonb_typeof(v_item) <> 'object';
    v_cat := coalesce(v_item->>'category', 'other');
    if v_cat not in ('room', 'fnb', 'av', 'sleeping', 'fees', 'other') then
      v_cat := 'other';
    end if;
    v_label := left(btrim(coalesce(v_item->>'label', '')), 200);
    v_qty := coalesce(events.rfp_safe_numeric(v_item->>'qty'), 0);
    v_price := coalesce(events.rfp_safe_numeric(v_item->>'unitPrice'), 0);
    if v_qty < 0 or v_qty > 100000 or v_price < 0 or v_price > 100000000 then
      return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'A line item has an out-of-range quantity or price.');
    end if;
    v_line := round(v_qty * v_price, 2);
    continue when v_label = '' and v_line = 0;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'category', v_cat, 'label', v_label, 'qty', v_qty, 'unit_price', v_price, 'total', v_line
    ));
    v_subtotal := v_subtotal + v_line;
  end loop;
  if jsonb_array_length(v_items) = 0 or v_subtotal <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Add at least one priced line item.');
  end if;

  v_fees := round(coalesce(events.rfp_safe_numeric(p_payload->>'taxesFees'), 0), 2);
  v_deposit := events.rfp_safe_numeric(p_payload->>'depositPct');
  v_attrition := events.rfp_safe_numeric(p_payload->>'attritionPct');
  v_capacity := events.rfp_safe_numeric(p_payload->>'capacity');
  if v_fees < 0 or v_fees > 100000000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Taxes and fees are out of range.');
  end if;
  if (v_deposit is not null and (v_deposit < 0 or v_deposit > 100))
    or (v_attrition is not null and (v_attrition < 0 or v_attrition > 100)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Percentages must be between 0 and 100.');
  end if;
  if v_capacity is not null and (v_capacity < 0 or v_capacity > 1000000) then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Capacity is out of range.');
  end if;
  begin
    v_valid := nullif(btrim(coalesce(p_payload->>'validUntil', '')), '')::date;
  exception when others then
    v_valid := null;
  end;

  if jsonb_typeof(p_payload->'concessions') = 'array' then
    for v_c in
      select left(btrim(value), 300) from jsonb_array_elements_text(p_payload->'concessions')
    loop
      if v_c <> '' and jsonb_array_length(v_concessions) < 30 then
        v_concessions := v_concessions || to_jsonb(v_c);
      end if;
    end loop;
  end if;

  select * into v_prev from events.rfp_bids
    where recipient_id = v_rec.id and is_current and deleted_at is null;
  if v_prev.id is not null then
    update events.rfp_bids set is_current = false where id = v_prev.id;
  end if;

  insert into events.rfp_bids (
    rfp_id, recipient_id, project_id, revision, is_current, line_items, subtotal, taxes_fees, total,
    currency, capacity, concessions, deposit_pct, attrition_pct, cancellation_policy,
    availability_notes, valid_until, message, submitted_by_name, status
  ) values (
    v_rfp.id, v_rec.id, v_rfp.project_id,
    coalesce((select max(b.revision) from events.rfp_bids b where b.recipient_id = v_rec.id), 0) + 1,
    true, v_items, v_subtotal, v_fees, v_subtotal + v_fees,
    v_rfp.currency, round(v_capacity)::integer, v_concessions, v_deposit, v_attrition,
    left(coalesce(p_payload->>'cancellationPolicy', ''), 2000),
    left(coalesce(p_payload->>'availabilityNotes', ''), 2000),
    v_valid,
    left(coalesce(p_payload->>'message', ''), 4000),
    left(btrim(coalesce(p_payload->>'submittedByName', '')), 200),
    case when v_prev.status = 'shortlisted' then 'shortlisted' else 'submitted' end
  )
  returning * into v_bid;

  update events.rfp_recipients
    set status = 'responded', responded_at = now(), declined_at = null, decline_reason = ''
    where id = v_rec.id;

  return jsonb_build_object('ok', true, 'revision', v_bid.revision, 'total', v_bid.total);
end;
$$;

-- The venue passes on this RFP. Any bid already filed stays on record but leaves the comparison.
create or replace function events.rfp_public_decline(p_token text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_id uuid := events.rfp_public_recipient_id(p_token);
  v_rec events.rfp_recipients;
  v_rfp events.rfps;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_rec from events.rfp_recipients where id = v_id for update;
  select * into v_rfp from events.rfps where id = v_rec.rfp_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_rfp.status <> 'sent' or v_rec.status in ('awarded', 'lost') then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  update events.rfp_recipients
    set status = 'declined', declined_at = now(), decline_reason = left(btrim(coalesce(p_reason, '')), 1000)
    where id = v_rec.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Awards a bid in one transaction: winner/loser statuses, the venue (linked or created from p_venue),
-- the agreed rates and terms appended to venues.metadata.contracts, the pipeline lead marked Booked,
-- and optionally the RFP's event pointed at the venue.
create or replace function events.rfp_award(p_bid uuid, p_venue jsonb default '{}'::jsonb, p_link_event boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_bid events.rfp_bids;
  v_rec events.rfp_recipients;
  v_rfp events.rfps;
  v_venue events.venues;
  v_created boolean := false;
  v_linked boolean := false;
  v_lat numeric;
  v_lng numeric;
  v_contract jsonb;
  v_venue_in jsonb := coalesce(p_venue, '{}'::jsonb);
begin
  select * into v_bid from events.rfp_bids where id = p_bid and deleted_at is null;
  if not found then
    raise exception 'BID_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  select * into v_rfp from events.rfps where id = v_bid.rfp_id and deleted_at is null for update;
  if not found or not events.can_access_project(v_rfp.project_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if v_rfp.status not in ('sent', 'closed') then
    raise exception 'RFP_NOT_AWARDABLE' using errcode = 'check_violation';
  end if;
  if not v_bid.is_current then
    raise exception 'BID_SUPERSEDED' using errcode = 'check_violation';
  end if;
  select * into v_rec from events.rfp_recipients
    where id = v_bid.recipient_id and deleted_at is null for update;
  if not found or v_rec.status = 'declined' then
    raise exception 'RECIPIENT_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  if v_rec.venue_id is not null then
    select * into v_venue from events.venues
      where id = v_rec.venue_id and project_id = v_rfp.project_id and deleted_at is null;
  end if;

  if v_venue.id is null then
    v_lat := events.rfp_safe_numeric(v_venue_in->>'latitude');
    v_lng := events.rfp_safe_numeric(v_venue_in->>'longitude');
    if v_lat is not null and (v_lat < -90 or v_lat > 90) then v_lat := null; end if;
    if v_lng is not null and (v_lng < -180 or v_lng > 180) then v_lng := null; end if;
    insert into events.venues (
      project_id, name, address, city, country, latitude, longitude, seated_capacity,
      contact_name, contact_email, contact_phone, website, created_by
    ) values (
      v_rfp.project_id,
      coalesce(nullif(left(btrim(coalesce(v_venue_in->>'name', '')), 200), ''), nullif(v_rec.name, ''), 'Untitled venue'),
      nullif(left(btrim(coalesce(v_venue_in->>'address', '')), 500), ''),
      nullif(left(btrim(coalesce(v_venue_in->>'city', '')), 200), ''),
      nullif(left(btrim(coalesce(v_venue_in->>'country', '')), 200), ''),
      round(v_lat, 6),
      round(v_lng, 6),
      greatest(0, least(1000000, coalesce(events.rfp_safe_numeric(v_venue_in->>'seatedCapacity'), 0)))::integer,
      coalesce(nullif(left(btrim(coalesce(v_venue_in->>'contactName', '')), 200), ''), nullif(v_rec.contact_name, '')),
      coalesce(nullif(left(btrim(coalesce(v_venue_in->>'contactEmail', '')), 320), ''), nullif(v_rec.email, '')),
      nullif(left(btrim(coalesce(v_venue_in->>'contactPhone', '')), 100), ''),
      nullif(left(btrim(coalesce(v_venue_in->>'website', '')), 500), ''),
      auth.uid()
    )
    returning * into v_venue;
    v_created := true;
  end if;

  v_contract := jsonb_build_object(
    'source', 'rfp',
    'rfpId', v_rfp.id,
    'rfpTitle', v_rfp.title,
    'eventId', v_rfp.event_id,
    'bidId', v_bid.id,
    'revision', v_bid.revision,
    'awardedAt', now(),
    'startDate', v_rfp.start_date,
    'endDate', v_rfp.end_date,
    'attendees', v_rfp.attendees,
    'currency', v_bid.currency,
    'subtotal', v_bid.subtotal,
    'taxesFees', v_bid.taxes_fees,
    'total', v_bid.total,
    'lineItems', v_bid.line_items,
    'concessions', v_bid.concessions,
    'depositPct', v_bid.deposit_pct,
    'attritionPct', v_bid.attrition_pct,
    'cancellationPolicy', v_bid.cancellation_policy,
    'validUntil', v_bid.valid_until
  );
  update events.venues
    set metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{contracts}',
      coalesce((
        select jsonb_agg(c.value)
        from jsonb_array_elements(
          case when jsonb_typeof(metadata->'contracts') = 'array' then metadata->'contracts' else '[]'::jsonb end
        ) as c(value)
        where c.value->>'rfpId' is distinct from v_rfp.id::text
      ), '[]'::jsonb) || jsonb_build_array(v_contract)
    )
    where id = v_venue.id;

  update events.rfp_bids
    set status = case when id = v_bid.id then 'awarded' else 'rejected' end
    where rfp_id = v_rfp.id and is_current and deleted_at is null
      and (id = v_bid.id or status in ('submitted', 'shortlisted'));

  update events.rfp_recipients
    set status = case when id = v_rec.id then 'awarded' else 'lost' end,
        venue_id = case when id = v_rec.id then v_venue.id else venue_id end
    where rfp_id = v_rfp.id and deleted_at is null
      and (id = v_rec.id or (invited_at is not null and status in ('invited', 'viewed', 'responded')));

  update events.rfps
    set status = 'awarded', awarded_bid_id = v_bid.id, awarded_venue_id = v_venue.id, awarded_at = now()
    where id = v_rfp.id;

  if v_rec.pipeline_record_id is not null then
    update events.conference_records
      set status = 'Booked',
          config = coalesce(config, '{}'::jsonb) || jsonb_build_object('venueId', v_venue.id)
      where id = v_rec.pipeline_record_id and project_id = v_rfp.project_id and deleted_at is null;
  end if;

  if p_link_event and v_rfp.event_id is not null then
    update events.events
      set venue_id = v_venue.id,
          venue = v_venue.name,
          address = coalesce(nullif(v_venue.address, ''), address),
          city = coalesce(nullif(v_venue.city, ''), city)
      where id = v_rfp.event_id and project_id = v_rfp.project_id and deleted_at is null;
    v_linked := found;
  end if;

  return jsonb_build_object(
    'ok', true,
    'venueId', v_venue.id,
    'venueName', v_venue.name,
    'venueCreated', v_created,
    'eventLinked', v_linked
  );
end;
$$;

revoke all on function events.rfp_safe_numeric(text) from public, anon, authenticated;
revoke all on function events.rfp_public_recipient_id(text) from public, anon, authenticated;
revoke all on function events.rfp_public_state(events.rfps, events.rfp_recipients) from public, anon, authenticated;
revoke all on function events.rfp_public_get(text) from public, anon, authenticated;
revoke all on function events.rfp_public_submit(text, jsonb) from public, anon, authenticated;
revoke all on function events.rfp_public_decline(text, text) from public, anon, authenticated;
revoke all on function events.rfp_award(uuid, jsonb, boolean) from public, anon, authenticated;

grant execute on function events.rfp_public_get(text) to anon, authenticated;
grant execute on function events.rfp_public_submit(text, jsonb) to anon, authenticated;
grant execute on function events.rfp_public_decline(text, text) to anon, authenticated;
grant execute on function events.rfp_award(uuid, jsonb, boolean) to authenticated;

-- @down
drop function if exists events.rfp_award(uuid, jsonb, boolean);
drop function if exists events.rfp_public_decline(text, text);
drop function if exists events.rfp_public_submit(text, jsonb);
drop function if exists events.rfp_public_get(text);
drop function if exists events.rfp_public_state(events.rfps, events.rfp_recipients);
drop function if exists events.rfp_public_recipient_id(text);
drop function if exists events.rfp_safe_numeric(text);
alter table if exists events.rfps drop constraint if exists rfps_awarded_bid_fk;
drop table if exists events.rfp_presets;
drop table if exists events.rfp_bids;
drop table if exists events.rfp_recipients;
drop table if exists events.rfps;
drop function if exists events.rfp_child_project();
