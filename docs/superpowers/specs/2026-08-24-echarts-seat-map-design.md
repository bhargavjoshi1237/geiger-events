# ECharts seat map and seat-selection redesign

Date: 2026-08-24
Status: implemented — all five steps below are built, lint-clean, and covered by
119 passing `node:test` cases. NOT yet verified visually in a browser.

## Why

Two problems, one investigation.

**The buyer-facing list is broken.** In the `Get Tickets` dialog the offers rail
lists rows in an order that carries no information. Confirmed from the code:

1. The dialog runs in **type-first** mode (`seat_picker.jsx:378` only renders
   `Back` in that mode). `disabledSectionIds` (`seat_picker.jsx:156-164`) then
   drops every section not mapped to the chosen ticket, so every surviving offer
   carries that one ticket's price (`lib/seating/offers.js:106`). In
   `sortOffers` (`offers.js:133-139`) `a.price - b.price` is therefore always
   `0` and the sort falls through to section then row. **"Lowest price" and
   "Section" render identical lists** — 14 near-identical rows of one section
   before any other section appears.
2. **The price slider empties the list.** `offerPriceRange` floors min and ceils
   max (`offers.js:152`), so a single price of `2015.3` becomes
   `{min: 2015, max: 2016}`. `hasRange` is then true (`seat_offers.jsx:220`) and
   a slider renders for what is really one price. With `step={1}` the only other
   notch is `2015`, and `filterOffers` drops `price > maxPrice`, so one drag
   removes every offer and shows "No seats match this filter."
3. **Prices render as `$2,015.3`.** `currency`
   (`components/internal/screens/tickets/constants.js:8`) is `toLocaleString("en-US")`
   with no fraction digits.
4. `1 together · 14 open` (`seat_offers.jsx:91`) is wrong copy at quantity 1.
5. Every offer row renders a full `VenueThumb` (`seat_offers.jsx:52`), which maps
   *all* sections into absolutely-positioned spans — sections x rows x sections
   nodes, each 56px wide and illegible.

**The map has hit the ceiling of what DOM can do.** The existing renderer's own
comments record the strain: strokes counter-scaled against a zoom of 15, chair
boxes landing sub-pixel and rounding to different device pixels, and a hard
"only one section's seats exist as DOM nodes at a time" budget. The drill-down
modal exists to serve that budget, not the buyer.

## Scope

In scope:

- The buyer seat picker on the live event page (`seat_picker.jsx`,
  `seat_map_view.jsx`).
- The venue seat map editor / bowl generator (`seat_map_editor.jsx`).

Out of scope, keeping the current DOM renderer:

- The box office (`event_seating.jsx`).
- Expo booths (`hall_map_view.jsx`, `hall_map_editor.jsx`, `booth_picker.jsx`).

Both renderers coexist during this work. That is accepted: the pairing that has
to agree is the organiser's editor and the buyer's view, and both are in scope.

## Decisions

| Question | Decision |
|---|---|
| Renderer | Apache ECharts 6.1.0, canvas |
| Dialog layout | **B** — map bleeds edge to edge, rail earns its space |
| Detail model | **Hybrid LOD** — continuous zoom, no drill-down mode |
| Ranking | **Geometric quality score**, derived, no organiser setup |
| Editor | **Hybrid** — ECharts draws, DOM edits |
| Accessibility | Canvas is `aria-hidden`; the rail is the accessible path |

### Two corrections made during design

ECharts has **no seat-map chart type**. The v6 `echarts-custom-series` project
ships violin, contour, stage, bar-range and line-range — nothing seating
related. The seat renderer is ours either way; ECharts supplies canvas, the
coordinate system, and the zoom plumbing.

ECharts **cannot replace `bowl.js`**. That is 789 lines of pure geometry
generation (plus 413 lines of tests) producing section and seat records for the
database. Generation and rendering are separate concerns and only the renderer
is being replaced.

## Architecture

### Coordinate space

Unchanged. `lib/seating/geometry.js` already defines the contract: geometry is
stored as percent-of-canvas on both axes, and any maths mixing the axes works in
**units** (1 unit = 1% of canvas height). The ECharts grid is a hidden cartesian
system over that same percent space, so nothing about storage, `bowl.js`,
`generate.js` or `section_grid.js` changes.

### Level of detail

One continuous zoom replaces the drill-in/drill-out mode. `activeSectionId`, the
`zoomToRect` glide and the `Whole venue` back button all go away.

- Below the seat threshold: price-tinted section polygons only (~30 elements).
- Above it: seats fade in for whatever is **in the viewport**, recomputed from
  the `dataZoom` event.

Bounding by viewport rather than by section keeps the element count flat no
matter how large the venue, which is what makes the
[documented roam-with-custom-series slowness](https://github.com/apache/echarts/issues/11870)
and the [dataZoom `inside` re-render cost](https://github.com/apache/echarts/issues/15409)
non-issues: ECharts is never asked to draw 20,000 things.

### Ranking

New pure module `lib/seating/quality.js`. Score each row from geometry already
stored:

- distance from the row to the field centre,
- row depth within its section,
- angle off the field's main axis.

No DB columns, no organiser configuration, works on every existing venue on
deploy. It drives the "best first" sort, the Best Value hero card, and
optionally tints the map by quality.

### Editor

ECharts renders the bowl, the seats and the generate-bowl preview. The ~30
section boxes stay as positioned DOM layered over the canvas, keeping
`onPointerDown(e, section, "move")` (line 1101), the resize handle (1131) and the
keyboard nudge (1102) exactly as they are. The two layers share the chart's zoom
transform.

### Accessibility

Canvas has no DOM, so today's per-seat `<button>` with an `aria-label`
disappears. The offers rail becomes the accessible path: keyboard-navigable
rows, `aria-live` on selection changes, and the canvas marked `aria-hidden`.
This is a deliberate trade, and it is how major ticketing sites handle it.

## Testing

`lib/seating/*` is pure and already covered by `node:test` (`node --test
lib/seating/offers.test.js`; the directory form does not glob on Windows).
`quality.js` gets full coverage, and each confirmed bug above gets a failing
test before its fix.

The ECharts component is not unit-tested; it is verified by running the app.

## Sequence

1. Fix the confirmed offers/pricing bugs (test-first). Independent of ECharts,
   and it is the defect that was actually reported.
2. Build and test `quality.js`.
3. Build the ECharts venue canvas with LOD.
4. Rebuild the picker dialog to layout B on top of 1-3.
5. Move the venue editor to the hybrid renderer.
