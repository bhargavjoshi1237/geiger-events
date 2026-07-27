-- ===========================================================================
-- Geiger Events — Inventory module
--
-- Self-contained and idempotent. Backs the Inventory area (Items, Stock
-- Movements, Event Allocations, Suppliers & Purchase Orders). Runs after
-- events.sql (filename order) so it can reference events.events.
--
-- Physical stock & merch — t-shirts, swag, badges, print, F&B, staff supplies.
-- Distinct from ticket inventory (per-tier qty/sold/reserved in ticketing) and
-- from purchasables[].stock (a per-event soft cap on an add-on).
--
-- Adds:
--   * inventory_items           — project-wide catalog, self-referencing for
--                                 variants. Only leaf rows hold stock.
--   * inventory_movements       — the append-only signed ledger. A trigger
--                                 applies each qty to items.on_hand, so on-hand
--                                 can never drift from history.
--   * inventory_allocations     — an item committed to an event, carrying the
--                                 issuance mode (internal / ticket / addon).
--   * inventory_suppliers       — who you buy from.
--   * inventory_purchase_orders — POs whose lines receive into stock.
--
-- Also adds owner-write storage RLS for the products bucket's inventory/
-- prefix, where item photos live (see the end of this file).
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

-- Shared "touch updated_at" trigger fn (defined locally; suite convention).
create or replace function events.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- inventory_items — the catalog. parent_id null = top-level item; a row with
-- children is a variant *group* whose totals are summed from its children in
-- the UI. Stock (on_hand) is only ever meaningful on leaf rows.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  parent_id uuid references events.inventory_items(id) on delete cascade,
  sku text not null default '',
  name text not null default 'Untitled item',
  -- Variant discriminator on a child row ("Large", "Black / M").
  variant_label text not null default '',
  -- Merch · Swag · Badges & Credentials · Print & Signage · Food & Beverage ·
  -- Equipment · Supplies · Other
  category text not null default 'Merch',
  description text not null default '',
  -- Product photo. Direct public URL (Supabase Storage, bucket "products",
  -- folder inventory/<id>/). A variant with none falls back to its parent's.
  image_url text not null default '',
  unit_cost numeric(14, 2) not null default 0,
  unit_price numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  -- Low-stock threshold; 0 disables the alert for this item.
  reorder_point integer not null default 0,
  -- Trigger-maintained from inventory_movements — never written directly.
  on_hand numeric(14, 2) not null default 0,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  -- Actor (no FK: this DB has no shared public.users).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists inventory_items_touch_updated_at on events.inventory_items;
create trigger inventory_items_touch_updated_at
before update on events.inventory_items
for each row execute function events.touch_updated_at();

create index if not exists events_inventory_items_project_idx
  on events.inventory_items (project_id, created_at desc) where deleted_at is null;
create index if not exists events_inventory_items_parent_idx
  on events.inventory_items (parent_id) where deleted_at is null;

alter table events.inventory_items enable row level security;
drop policy if exists events_inventory_items_demo_all on events.inventory_items;
create policy events_inventory_items_demo_all on events.inventory_items
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- inventory_allocations — an item committed to an event. The issuance mode
-- lives here rather than on the item because ticket ids and purchasable ids are
-- per-event. Declared before movements so movements can FK it.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  item_id uuid not null references events.inventory_items(id) on delete cascade,
  event_id uuid not null references events.events(id) on delete cascade,
  planned_qty numeric(14, 2) not null default 0,
  issued_qty numeric(14, 2) not null default 0,
  -- Planned · Reserved · Issued · Closed
  status text not null default 'Planned',
  -- internal | ticket | addon
  issuance text not null default 'internal',
  -- Ticket ids from the event's metadata.tickets that entitle this item.
  ticket_ids jsonb not null default '[]'::jsonb,
  qty_per_attendee numeric(14, 2) not null default 1,
  -- Id from the event's metadata.purchasables when issuance = 'addon'.
  purchasable_id text not null default '',
  notes text not null default '',
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists inventory_allocations_touch_updated_at on events.inventory_allocations;
create trigger inventory_allocations_touch_updated_at
before update on events.inventory_allocations
for each row execute function events.touch_updated_at();

create index if not exists events_inventory_allocations_project_idx
  on events.inventory_allocations (project_id, created_at desc) where deleted_at is null;
create index if not exists events_inventory_allocations_event_idx
  on events.inventory_allocations (event_id) where deleted_at is null;
create index if not exists events_inventory_allocations_item_idx
  on events.inventory_allocations (item_id) where deleted_at is null;

alter table events.inventory_allocations enable row level security;
drop policy if exists events_inventory_allocations_demo_all on events.inventory_allocations;
create policy events_inventory_allocations_demo_all on events.inventory_allocations
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- inventory_movements — the append-only signed ledger and sole source of truth
-- for on-hand. qty is signed: + puts stock in, - takes it out. Corrections are
-- made with a counter-movement, never an edit.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  item_id uuid not null references events.inventory_items(id) on delete cascade,
  event_id uuid references events.events(id) on delete set null,
  allocation_id uuid references events.inventory_allocations(id) on delete set null,
  -- receive | adjust | issue | return | waste | transfer
  kind text not null default 'adjust',
  qty numeric(14, 2) not null default 0,
  reason text not null default '',
  note text not null default '',
  -- Free-form external reference (PO code, order ref, delivery note).
  reference text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists events_inventory_movements_project_idx
  on events.inventory_movements (project_id, created_at desc);
create index if not exists events_inventory_movements_item_idx
  on events.inventory_movements (item_id, created_at desc);
create index if not exists events_inventory_movements_event_idx
  on events.inventory_movements (event_id);

alter table events.inventory_movements enable row level security;
drop policy if exists events_inventory_movements_demo_all on events.inventory_movements;
create policy events_inventory_movements_demo_all on events.inventory_movements
  for all to anon, authenticated using (true) with check (true);

-- Keep items.on_hand in lockstep with the ledger. Insert adds the signed qty;
-- delete backs it out. There is no update path — movements are append-only.
create or replace function events.inventory_apply_movement()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update events.inventory_items
      set on_hand = on_hand + new.qty
      where id = new.item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update events.inventory_items
      set on_hand = on_hand - old.qty
      where id = old.item_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists inventory_movements_apply on events.inventory_movements;
create trigger inventory_movements_apply
after insert or delete on events.inventory_movements
for each row execute function events.inventory_apply_movement();

-- ---------------------------------------------------------------------------
-- inventory_suppliers — who you buy stock from.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled supplier',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  lead_time_days integer not null default 0,
  notes text not null default '',
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists inventory_suppliers_touch_updated_at on events.inventory_suppliers;
create trigger inventory_suppliers_touch_updated_at
before update on events.inventory_suppliers
for each row execute function events.touch_updated_at();

create index if not exists events_inventory_suppliers_project_idx
  on events.inventory_suppliers (project_id, created_at desc) where deleted_at is null;

alter table events.inventory_suppliers enable row level security;
drop policy if exists events_inventory_suppliers_demo_all on events.inventory_suppliers;
create policy events_inventory_suppliers_demo_all on events.inventory_suppliers
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- inventory_purchase_orders — lines live in the `lines` jsonb bag as
-- [{ itemId, name, qty, unitCost, receivedQty }]. Receiving a PO writes one
-- `receive` movement per line (done in the data layer, not here) and advances
-- the status to Partial or Received.
-- ---------------------------------------------------------------------------
create table if not exists events.inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  supplier_id uuid references events.inventory_suppliers(id) on delete set null,
  code text not null default '',
  -- Draft · Ordered · Partial · Received · Cancelled
  status text not null default 'Draft',
  expected_at date,
  ordered_at date,
  received_at date,
  currency text not null default 'USD',
  total numeric(14, 2) not null default 0,
  lines jsonb not null default '[]'::jsonb,
  notes text not null default '',
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists inventory_purchase_orders_touch_updated_at on events.inventory_purchase_orders;
create trigger inventory_purchase_orders_touch_updated_at
before update on events.inventory_purchase_orders
for each row execute function events.touch_updated_at();

create index if not exists events_inventory_pos_project_idx
  on events.inventory_purchase_orders (project_id, created_at desc) where deleted_at is null;
create index if not exists events_inventory_pos_supplier_idx
  on events.inventory_purchase_orders (supplier_id) where deleted_at is null;

alter table events.inventory_purchase_orders enable row level security;
drop policy if exists events_inventory_pos_demo_all on events.inventory_purchase_orders;
create policy events_inventory_pos_demo_all on events.inventory_purchase_orders
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Item photo storage RLS (products bucket, inventory/<item-id>/).
--
-- Lives here rather than storage.sql because the policies reference
-- events.inventory_items, and db:push runs files in filename order — storage.sql
-- runs first, when the table does not yet exist. Public read is already granted
-- for the whole bucket there; these add owner writes for the inventory/ prefix,
-- mirroring the event- and venue-owner policies.
-- ---------------------------------------------------------------------------
drop policy if exists "Products inventory owner insert" on storage.objects;
drop policy if exists "Products inventory owner update" on storage.objects;
drop policy if exists "Products inventory owner delete" on storage.objects;

create policy "Products inventory owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'inventory'
    and exists (
      select 1 from events.inventory_items i
      where i.id::text = (storage.foldername(storage.objects.name))[2]
        and i.created_by = auth.uid()
    )
  );

create policy "Products inventory owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'inventory'
    and exists (
      select 1 from events.inventory_items i
      where i.id::text = (storage.foldername(storage.objects.name))[2]
        and i.created_by = auth.uid()
    )
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'inventory'
    and exists (
      select 1 from events.inventory_items i
      where i.id::text = (storage.foldername(storage.objects.name))[2]
        and i.created_by = auth.uid()
    )
  );

create policy "Products inventory owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = 'inventory'
    and exists (
      select 1 from events.inventory_items i
      where i.id::text = (storage.foldername(storage.objects.name))[2]
        and i.created_by = auth.uid()
    )
  );
