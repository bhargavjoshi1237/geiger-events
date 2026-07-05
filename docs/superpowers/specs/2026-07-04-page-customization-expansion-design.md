# Page Customization Expansion — Design Spec

**Date:** 2026-07-04
**Area:** Events module — per-event Page Design (Themed mode) + Event Wall Design
**Status:** Draft design, pending user approval

## 1. Summary

The two public-facing customization surfaces — an event's **Page design** (Themed mode,
`page_design.jsx`) and the **Event Wall** **Design** section (`event_wall/design.jsx`) —
share one theme model (`lib/events/theme.js`) but expose only a thin slice of what a brand
would want. This spec expands both to "truly to the user's needs" by:

1. **Activating dormant model fields** (`button`, `elevation`, `density`) that are defined
   and, in one case, compiled — but **never rendered** — so they become real, visible knobs.
2. **Adding new theme fields** (page background, hero/header style, cover overlay, sidebar
   position) that reshape the page, not just recolor it.
3. **Giving the Event Wall genuine layout control** (grid columns, card style, card meta,
   hero banner, featured spotlight) — it is by far the least customizable surface today.
4. **A shared footer/social block** so both pages can end with the brand's own footer
   instead of the fixed "Powered by Geiger" line.

Everything extends the existing `theme` object + `metadata` bags. Presets, the `themeStyle`
compiler, and both editors stay consistent — no new storage tables, no route changes.

### Confirmed starting facts (from code audit)

- `theme.button` (`BUTTON_STYLES` solid/outline/soft) — in `DEFAULT_THEME`, **never
  compiled or read anywhere**. Fully dead.
- `theme.density` (`DENSITIES`) — `resolveDensity()` exists and is exported but **never
  imported/called**. Fully dead.
- `theme.elevation` (`ELEVATIONS`) — compiled to `--ev-elevation` in `themeStyle`, but **no
  CSS or component reads that variable**. Emitted-but-unused.
- `.ev-themed` CSS (globals.css) only consumes `--ev-font-*`, `--ev-heading-*`. Everything
  else in `themeStyle` maps app semantic tokens.

So "surface the hidden controls" is real work: add the editor control **and** wire the
field into the rendered output.

## 2. Scope

### In scope
- Shared theme-model additions in `lib/events/theme.js` + `.ev-themed` CSS wiring.
- Event page (`page_design.jsx` editor + `event_public_page.jsx` renderer): hero style,
  cover overlay, sidebar position, spacing/elevation/button, page background, footer.
- Event Wall (`event_wall/design.jsx` editor + `wall_public_page.jsx` renderer + a new
  `listing`-side layout section or extension): grid/card/hero/featured/footer.
- A shared `<PageFooter>` component + a shared footer-config editor block.

### Out of scope (deliberate)
- The freeform canvas/"Custom" builder (separate, shelved spec 2026-06-27). Untouched.
- Standard mode (still the tuned default; ignores theme tweaks).
- Per-breakpoint editing, animation, custom font uploads, custom CSS injection.
- New DB tables. All new config lives in existing `metadata`/`pageDesign` bags.

### Unchanged
- `standard`/`themed` mode split; the block show/hide/reorder list; checkout flow; the
  wall's filter/sort/featured **selection** logic (`selectWallEvents`) — only its
  **presentation** gains options.

## 3. Phasing

Ordered by value-to-risk so the user can approve/build incrementally.

- **Phase 1 — Theme depth (both pages).** Activate `button`/`elevation`/`density`; add
  `background`. Touches the shared model, CSS, and both renderers' surfaces. Lowest risk,
  immediately visible on both pages.
- **Phase 2 — Event page layout.** `hero`, `coverOverlay`, `sidebar`, footer.
- **Phase 3 — Event Wall.** grid/card/meta, hero banner, featured spotlight, footer.

## 4. Shared theme model changes (`lib/events/theme.js`)

### 4.1 New / activated option catalogs
Reuse existing `BUTTON_STYLES`, `ELEVATIONS`, `DENSITIES`. Add:

```js
export const HERO_STYLES = [
  { key: "classic",  label: "Classic" },   // current: cover top, sidebar right
  { key: "banner",   label: "Banner" },     // full-bleed cover, title overlaid
  { key: "centered", label: "Centered" },   // centered title above a contained cover
  { key: "minimal",  label: "Minimal" },    // no cover; title + meta only
];

export const OVERLAY_STYLES = [
  { key: "none",     label: "None" },
  { key: "scrim",    label: "Dark scrim" },   // linear-gradient black 0→60%
  { key: "brand",    label: "Brand tint" },   // accent color at low alpha
];

export const SIDEBAR_SIDES = [
  { key: "right", label: "Right" },
  { key: "left",  label: "Left" },
];

export const BG_TYPES = [
  { key: "surface",  label: "Base" },       // = theme.colors.bg (today's behavior)
  { key: "gradient", label: "Gradient" },   // brand→bg diagonal
  { key: "image",    label: "Image" },      // uploaded/linked url, covered
];
```

### 4.2 New fields on the theme object
Added to `DEFAULT_THEME` (back-compat: absent → default, via existing `mergeTheme`):

```js
button: "solid",          // ACTIVATE
elevation: "subtle",      // ACTIVATE (already default)
density: "comfortable",   // ACTIVATE (already default)
hero: "classic",
coverOverlay: "none",
sidebar: "right",
background: { type: "surface", value: "" }, // value = gradient css or image url
```

### 4.3 Compiler (`themeStyle`) additions
Emit new CSS variables consumed by `.ev-themed` rules and inline styles:

- `--ev-section-gap` ← `resolveDensity(theme)` (compact 2rem / comfortable 2.75 / spacious 4).
- Keep `--ev-elevation` (already emitted) and start **consuming** it (see 4.4).
- Page background: when `background.type === "image"` set `backgroundImage:url(...)`,
  `backgroundSize:cover`; `gradient` sets a `linear-gradient(135deg, brand 0%, bg 60%)`;
  `surface` leaves `--background` as today.

New helpers:
```js
export function themeButtonStyle(theme, accent) {
  // returns { style, className } for a primary CTA per theme.button:
  //   solid   → bg accent, text accent.text
  //   outline → transparent bg, 1px accent border, accent text
  //   soft    → accent at 15% alpha bg, accent text
}
export function resolveHero(theme)   { return theme?.hero ?? "classic"; }
export function resolveSidebar(theme){ return theme?.sidebar ?? "right"; }
export function coverOverlayStyle(theme, accent) { /* returns bg image gradient or null */ }
export function pageBackgroundStyle(theme, accent) { /* returns style overrides for wrapper */ }
```

### 4.4 CSS wiring (`app/globals.css`, `.ev-themed`)
```css
.ev-themed .ev-surface { box-shadow: var(--ev-elevation, none); }
/* section gap applied inline via --ev-section-gap on the content column flex */
```
`.ev-surface` is added to the elevated card containers (registration sidebar, "Good to
know", "At registration" on the event page; each event card on the wall).

### 4.5 Preset updates
Each of the 6 `THEME_PRESETS` gains sensible `button`/`hero`/`sidebar`/`background` values
so presets showcase the new range (e.g. Bold → `hero:"banner"`, Minimal → `hero:"minimal"`,
Elegant → `hero:"centered"`). Back-compat resolution unchanged.

## 5. Event page — editor (`page_design.jsx`)

Add controls inside the existing Themed-mode `SectionCard`s (no layout churn):

- **"Shape & style" card** gains: **Button style** (`Segmented BUTTON_STYLES`), **Card
  shadow** (`Segmented ELEVATIONS`), **Spacing** (`Segmented DENSITIES`).
- **New "Layout" card**: **Hero style** (`Segmented HERO_STYLES`), **Cover overlay**
  (`Segmented OVERLAY_STYLES`, disabled when hero=minimal), **Sidebar position**
  (`Segmented SIDEBAR_SIDES`).
- **New "Background" card**: **Type** (`Segmented BG_TYPES`); when `gradient` show nothing
  extra; when `image` show a URL `Input` + reuse `uploadEventImage` upload button
  (`events/<id>/`).
- **New "Footer" card** (shared block, see §7).

All write through the existing `setTheme`/`set` helpers; footer writes to `pageDesign.footer`.

## 6. Event page — renderer (`event_public_page.jsx`)

`EventPublicPageContent` currently hardcodes: cover-in-main-column, `lg:grid-cols-[1fr_380px]`,
`space-y-10`. Changes (Themed mode only; Standard unchanged):

- **Hero style** switches the header region:
  - `classic` → today's layout.
  - `banner` → full-bleed cover (breaks container to page width or content width), title +
    meta overlaid bottom-left, `coverOverlay` scrim applied for legibility.
  - `centered` → centered title/meta block above a contained cover.
  - `minimal` → no cover block; title/meta/hosts only.
- **Sidebar position** flips the two-column grid to `[380px_1fr]` and column order when `left`.
- **Spacing density** → content column uses `style={{ gap: 'var(--ev-section-gap)' }}` instead
  of `space-y-10`.
- **Elevation** → add `ev-surface` class to the three sidebar cards.
- **Button style** → hero/ticket CTA uses `themeButtonStyle(theme, accent)` in place of the
  raw `accentStyle` (checkout keeps `accentStyle`; only the page-level primary CTAs re-skin).
- **Page background** → wrapper style merges `pageBackgroundStyle(theme, accent)`.
- **Footer** → `<PageFooter config={design.footer} accent={accent} />` replaces the fixed line.

## 7. Shared footer (`components/internal/screens/events/page_footer.jsx` + editor block)

Config shape (stored in `pageDesign.footer` for events, `metadata.footer` for the wall):
```js
footer = {
  showBranding: true,          // keep "Powered by Geiger"
  text: "",                    // free custom line (copyright, etc.)
  links:  [{ label, url }],    // simple nav links
  socials:[{ platform, url }], // platform ∈ known set → lucide icon
}
```
- `<PageFooter>` renders a centered footer: optional socials row (icon buttons), links row,
  custom text, and the branding line (if `showBranding`). Semantic tokens only.
- `<FooterEditor value onChange>` — a reusable `SectionCard` body: a branding `SettingRow`,
  a text `Input`, and add/remove/reorder rows for links and socials (mirrors the
  offerings/questions editors' add-row pattern). Used by both editors.

## 8. Event Wall — editor + renderer

### 8.1 New layout config (`metadata.layout`, via `useWallConfig(wall, "layout", DEFAULT_LAYOUT)`)
```js
DEFAULT_LAYOUT = {
  columns: "auto",             // auto | 2 | 3 | 4  (auto = today's responsive rule)
  cardStyle: "classic",        // classic (meta below) | overlay (text on image)
  cardMeta: { type: true, date: true, venue: true, price: false },
  featuredStyle: "badge",      // badge (today) | spotlight (large hero row)
  header: { align: "center", bannerUrl: "" }, // banner image behind header; align center|left
}
```

### 8.2 Editor (`event_wall/design.jsx`)
Add three `SectionCard`s below the existing ones (all persisted through `useWallConfig`,
same Save button):
- **Grid & cards**: columns `Segmented`, card style `Segmented`, card-meta `SettingRow`
  toggles.
- **Header**: alignment `Segmented`, banner image URL `Input` + upload (reuse storage helper
  with a `walls/<wallId>/` prefix), plus the shared **Background** control (§4) via
  `theme.background`.
- **Featured**: `featuredStyle` `Segmented` (Badge vs Spotlight).
- **Footer**: the shared `<FooterEditor>` (§7).

### 8.3 Renderer (`wall_public_page.jsx`)
- **Columns** → replace the hardcoded `lg:grid-cols-*` rule with a class derived from
  `layout.columns` (auto keeps the width-based rule).
- **Card style** → `EventCard` gains a `style` prop: `overlay` renders name/meta over a
  darkened image (uses `coverOverlay`-style scrim), `classic` = today. `cardMeta` toggles
  which lines render; `price` shows the event's lead ticket price when enabled.
- **Header** → optional banner image (with overlay) behind the logo/title/tagline; alignment
  left vs center; page background from `theme.background`.
- **Featured spotlight** → when `featuredStyle==="spotlight"`, featured events render as a
  full-width hero card row above the normal grid; else today's in-grid badge.
- **Footer** → `<PageFooter config={wall.footer} accent={accent} />` replaces the fixed line.
- **Elevation/button/density** flow in automatically via the shared theme wiring (cards get
  `ev-surface`; a wall-level CTA, if any, uses `themeButtonStyle`).

## 9. Data / persistence

No schema changes. New keys ride existing bags:

| Key | Stored where | Editor path |
|---|---|---|
| `theme.button/elevation/density/hero/coverOverlay/sidebar/background` | event: `pageDesign.theme`; wall: `metadata.theme` | existing `setTheme` / `useWallConfig(…, "theme")` |
| `footer` | event: `pageDesign.footer`; wall: `metadata.footer` | `<FooterEditor>` |
| `layout` (wall only) | `metadata.layout` | `useWallConfig(…, "layout")` |

Event side saves through the existing `updateEventMeta(id, { pageDesign })` path; wall side
through `updateWallMeta` (shallow-merge RPC) — both already merge per-section, so a new key
never clobbers another.

## 10. Integration points (files)

| File | Change |
|---|---|
| `lib/events/theme.js` | new catalogs/fields, `themeButtonStyle`/`coverOverlayStyle`/`pageBackgroundStyle`/`resolveHero`/`resolveSidebar`, emit `--ev-section-gap`, preset updates |
| `app/globals.css` | `.ev-themed .ev-surface { box-shadow: var(--ev-elevation) }` |
| `components/internal/screens/events/page_design.jsx` | new Layout/Background/Footer cards; button/shadow/spacing in Shape & style |
| `components/internal/screens/events/event_public_page.jsx` | hero switch, sidebar side, density gap, `ev-surface`, `themeButtonStyle`, bg, `<PageFooter>` |
| `components/internal/screens/events/page_footer.jsx` | **new** — `<PageFooter>` + `<FooterEditor>` |
| `components/internal/screens/events/event_wall/design.jsx` | new Grid/Header/Featured/Footer cards |
| `components/internal/screens/events/event_wall/wall_public_page.jsx` | columns, card styles + meta, hero banner, featured spotlight, footer |
| `lib/supabase/storage.js` | (if needed) allow a `walls/<id>/` prefix for the banner upload |

## 11. Risks & mitigations

- **Button style everywhere is invasive.** Mitigate: `themeButtonStyle` applies only to
  page-level primary CTAs; the checkout dialog keeps `accentStyle`. Scope-bounded.
- **Banner hero legibility.** Always pair `banner` with a default `coverOverlay:"scrim"` so
  overlaid title text stays readable; expose the control to override.
- **Overlay card style with no cover image.** Fall back to the accent-tint gradient block
  (already the no-cover placeholder) so text-on-image never renders on nothing.
- **Preset back-compat.** Old saved themes lack the new keys; `mergeTheme` + field defaults
  cover this (verified pattern). No migration.
- **Standard mode must stay pristine.** All new rendering branches are gated on
  `themed`/`mode !== "standard"`, mirroring the existing `wrapperStyle` gate.

## 12. Build sequence

1. `lib/events/theme.js` model + helpers + `--ev-section-gap`; `globals.css` `ev-surface`.
2. Event editor controls (Shape&style additions, Layout, Background cards).
3. Event renderer wiring (density, elevation, button, background) — verify Themed page.
4. Hero styles + sidebar side + cover overlay in the event renderer.
5. Shared `page_footer.jsx` (`PageFooter` + `FooterEditor`); wire into event editor/renderer.
6. Wall layout config + editor cards (grid/header/featured/footer).
7. Wall renderer (columns, card styles/meta, hero banner, featured spotlight, footer).
8. Preset updates showcasing the new range.
9. `npx eslint` clean on all changed files; verify preview + `/e/<id>` + `/w/<slug>`.
