# 04 — Event Design

| | |
|---|---|
| **Nav items** | 8 — Floor Plans, Object Library, Seating Charts, Setup Styles & Capacity, 3D Walkthrough, Room Templates, Collaboration & Sharing, Venue Diagram Library |
| **Registered** | **0/8 — the entire section is `ComingSoonScreen`** |
| **Tier** | **C — label-only** |
| **Blocked by** | [03 Venues](03-venues.md) per-space capacity; nothing else |

> The most misleading section in the sidebar after [15 Advertising](15-advertising.md):
> eight nav entries, zero screens. And the irony is that **most of the hard
> primitive already exists** — `venues/seat_map_editor.jsx` (1042 lines),
> `venues/hall_map_editor.jsx` (681), `conference/floor_plan.jsx` (730) and the
> shared `MapCanvas` / `MapFloorPanel` are a working 2D diagramming engine sitting
> one wire away from this section.

---

## 1. What this means in industry

This section's name promises **Cvent Event Diagramming (formerly Social Tables)**,
Allseated, or Prismm. That product does:

- **To-scale floor plans** — a room drawn at real dimensions, with a scale bar, snapping,
  and measurement, not a percentage-of-canvas sketch.
- **An object library** — 6ft rounds, 8ft banquets, classroom tables, staging, bars,
  dance floors, AV — each with **real physical dimensions and a seat count**, so dropping
  one changes the room's capacity math.
- **Setup-style capacity checks** — pick theatre / classroom / banquet / reception and the
  tool tells you what fits, and flags egress and fire-code violations.
- **Seating charts** — assign named guests to tables/seats, with meal choice, VIP and
  relationship rules ("don't seat A near B"), then print place cards and a seating list.
- **3D walkthrough** — a first-person view of the same diagram to sell the room to a client.
- **Collaboration** — share a read-only or comment-enabled diagram link with the venue,
  caterer and client, with versioning.

## 2. What exists today (verified)

Nothing in this section. But adjacent and reusable:

| Existing | Where | Reusable for |
|---|---|---|
| Seat map editor — floors, sections, rows, seats, percentage geometry | `venues/seat_map_editor.jsx` | Floor Plans, Seating Charts |
| Hall/booth map editor — same primitives, sellable stalls | `venues/hall_map_editor.jsx` | Floor Plans, Venue Diagram Library |
| Interactive expo floor plan | `conference/floor_plan.jsx` (730) | Floor Plans |
| Shared canvas + floor panel | `shared/map_canvas.jsx`, `map_field.jsx`, `map_floor_panel.jsx` | everything here |
| Pan/zoom bowl rework | seating module | Floor Plans |
| Seat holds with TTL, `buy_seats` | `supabase/migrations/*_seating.sql` | Seating Charts (paid) |

The gap is **physical units**. Everything today is percent-of-canvas, which is
fine for a seat picker and useless for a floor plan — you cannot answer "does a
6ft round fit here" without real dimensions.

## 3. Pending deliverables

### P0 — Make the existing canvas dimensional
- [ ] Add a real coordinate system to `MapCanvas`: room dimensions in feet/metres, a scale bar, and a unit toggle. Keep percent geometry as a derived value so existing seat maps keep working
- [ ] `events.design_objects` — the object library: name, category, footprint (w×h), seats, icon/SVG. Seed with the standard catalog (rounds 60"/72", 6ft/8ft banquets, chairs, staging, bars, dance floor)
- [ ] Drag-and-drop objects onto a plan with snapping + rotation; store instances in `events.floor_plans.objects jsonb`
- [ ] **Register the four screens that this unlocks:** Floor Plans, Object Library, Setup Styles & Capacity, Venue Diagram Library

### P1
- [ ] Setup-style capacity engine: given room dimensions + a style, compute max occupancy and compare to seats actually placed; flag aisle/egress minimums
- [ ] Seating Charts: assign contacts (from [07 Guests](07-guests.md)) to seats/tables, meal choice, and a printable seating list + place cards
- [ ] Room Templates: save a configured plan as a reusable starting point (the Templates pattern already exists in [02 Events](02-events.md))

### P2
- [ ] Collaboration & Sharing: a public read/comment link (the `/display/<id>` and `/e/<id>` public-route pattern already exists), comment pins on the canvas, version history
- [ ] 3D Walkthrough — the largest single item here. Only worth doing after the 2D plan is dimensional; a first-person camera over extruded 2D objects gets 80% of the value

### P0 alternative — if you are not building this
- [ ] **Collapse the section to one nav item** ("Floor Plans") pointing at the existing expo floor plan, and delete the other seven. Eight dead entries cost more credibility than one honest one.

## 4. UX & component placement

There is nothing to critique yet, so this is the layout to build to.

### Floor Plans (the hub)
`ScreenHeader` → `StatsBar` (plans, rooms covered, largest capacity) →
`Toolbar` → **gallery of plan thumbnails** (not a table — a diagram tool whose
index is a text list is immediately wrong).

### The editor — the important one
A three-zone layout, which is what every tool in this category converges on:

```
┌──────────────────────────────────────────────────────────────┐
│ [← Floor Plans]  Plan name        [Setup: Banquet ▾]  [Share] [Save] │
├────────────┬──────────────────────────────────┬──────────────┤
│  OBJECT    │                                  │  INSPECTOR   │
│  LIBRARY   │            CANVAS                │              │
│ (search +  │   (scale bar, snapping, floor    │  selected    │
│  category  │    switcher bottom-left, zoom     │  object:     │
│  filter)   │    bottom-right)                 │  size, seats │
│            │                                  │  rotation    │
├────────────┴──────────────────────────────────┴──────────────┤
│ Capacity: 148 / 180 banquet  ·  ⚠ 2 objects blocking egress   │
└──────────────────────────────────────────────────────────────┘
```

Placement rules that matter:
- **Library left, inspector right.** Left is "what can I add", right is "what did I select" — reversing these is the most common mistake and it costs users constantly.
- **The capacity/validation bar is docked to the bottom, always visible.** It is the answer the user came for; it must never require scrolling or a click.
- **Setup style lives in the header**, not the inspector — it re-scopes the whole canvas.
- Floor switcher bottom-left, zoom bottom-right — matches `seat_map_editor.jsx` today, so keep it for consistency.
- Share is in the header next to Save, and opens the same link-sharing dialog pattern used by Display Boards.

### Object Library
Gallery with category filters in the `Toolbar`; each card shows the footprint and seat
count. Editing an object opens a drawer, not a page — objects are small records.

## 5. Schema / API work
- [ ] `events.floor_plans` (venue_space_id, name, dimensions jsonb, objects jsonb, setup_style, metadata)
- [ ] `events.design_objects` (project_id nullable for the shared seed catalog, name, category, footprint jsonb, seats)
- [ ] `events.seating_assignments` (floor_plan_id, object_id, seat_index, contact_id, meal, notes)
- [ ] Reuse the public-link pattern from `display_boards_public.sql` for shared diagrams
