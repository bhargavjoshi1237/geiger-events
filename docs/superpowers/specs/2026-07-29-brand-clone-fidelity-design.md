# Brand Clone Fidelity

Raise how much of a source website the "Import from a site" flow can reproduce on
an event's public page. Closes the three gaps found in the survey of
`lib/brand/extract.js` → `lib/brand/to-theme.js` → `lib/events/theme.js` →
`event_public_page.jsx`.

## The problem

The importer captures six signals — logo, seven colors, two fonts, a radius
bucket, a button style, and `og:image`. Everything else about a brand is either
extractable but never extracted, or has nowhere in the theme model to live.

Three gaps:

1. **Fields the page already renders that the importer never fills** —
   `headingWeight`, `headingUpper`, `font.scale`, `elevation`, `width`,
   `density`, gradient backgrounds, and the entire footer config (`PageFooter`
   renders links/socials/text; extraction never looks at `<footer>`).
2. **The renderer's ceiling** — no site header/nav, one brand color, a 3-bucket
   radius, no button-specific shape, no typographic detail, self-hosted fonts
   dropped, fixed 1px borders, unthemed favicon, no tagline.
3. **Extraction robustness** — no `@font-face` parsing, a 10-sheet budget, no
   `rel="preload"` sheets, no non-Google `@import` following.

## Design

### Theme model (`lib/events/theme.js`)

New fields, every one defaulted so an existing saved page renders byte-identical:

| Field | Purpose |
|---|---|
| `radiusPx` | numeric px, overrides the `radius` bucket when set |
| `colors.accent` / `colors.link` / `colors.brandTo` | secondary, link, gradient end |
| `buttonRadiusPx`, `buttonUpper`, `buttonWeight`, `buttonTracking` | button shape independent of card shape |
| `headingTracking`, `headingLineHeight`, `bodyWeight` | typographic detail |
| `borderWidth` | px; drives a scoped `.ev-themed .border*` rule |
| `font.faces[]` | self-hosted `@font-face` (family, src, weight, style) |
| `header` | `{ show, links[], cta, align, sticky, background, border }` |
| `favicon`, `tagline` | tab icon and hero sub-line |

`themeStyle()` compiles the new fields to CSS variables; `themeButtonStyle()`
gains gradient, radius, casing, tracking, and weight. `resolveHeader()` and
`themeFontFaceCss()` are new resolvers. `mergeTheme` learns `header`.

### Extraction (`lib/brand/extract.js`)

Adds, all regex-based over the same fetched HTML/CSS (no new dependency, no
headless browser):

- **Typography** — heading weight/case/tracking/line-height, body weight and
  size, from the same `eachRule` walk already in place.
- **Shape** — numeric median radius, button radius, border width, shadow
  classification, container width, section padding.
- **Color** — a second chromatic accent, link color from `a { color }`, and
  button gradient detection.
- **Fonts** — `@font-face` blocks, resolved to absolute `src` URLs.
- **Header** — nav links from the header region, plus a CTA detected by class or
  by label (`sign up`, `get started`, `contact`…).
- **Footer** — footer links, social profile URLs matched to `SOCIAL_PLATFORMS`,
  and a copyright line.
- **Content** — favicon, tagline (meta description), hero image.
- **Robustness** — sheet budget 10 → 16, `rel="preload" as="style"` accepted,
  one level of non-Google `@import` followed.

### Mapping (`lib/brand/to-theme.js`)

`buildThemePatch` grows from four categories to eight: `logo`, `colors`,
`fonts`, `shape`, `layout`, `header`, `footer`, `content`. It now returns
`{ patch, footer, notes }` — `footer` is separate because it lives at
`design.footer`, not inside the theme.

### Rendering (`event_public_page.jsx`)

The logo-only `brandBar` becomes a real site header: logo (left or centered),
nav links, an optional CTA button, optional sticky positioning, an optional bar
background, and an optional bottom rule. A `<style>` tag emits `@font-face` for
self-hosted families. The tagline renders under the hero title.

### Editors

`brand_import.jsx` gains the four new categories with previews.
`page_design.jsx` gains a Site header editor and controls for every new theme
field. `app/e/[id]/page.js` injects the brand favicon.

## Non-goals

- **No headless browser.** JS-rendered SPAs still yield little; the typed
  `empty` error already handles that honestly.
- **No content scraping beyond the tagline.** Body copy stays the organizer's.
- **No light/dark pair.** One base, as today.
