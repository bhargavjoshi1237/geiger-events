# Brand Import — "Import from URL" page design mode

**Date:** 2026-07-26
**Area:** Event editor → Page design

## Problem

The event page design offers two modes: **Standard** (Geiger's tuned layout) and
**Themed** (a full brand-theme editor). Setting up Themed to match an organizer's
existing website means hand-picking seven colors, two fonts, a radius, and a
button style — everything the organizer's site already encodes.

Add a third mode that reads a URL, extracts the site's brand (logo, palette,
fonts, shape), and applies it to the event page.

## Approach

Import produces the **same `theme` object** Themed does. There is no second
renderer and no parallel model — `mode: "imported"` renders exactly like
`themed`, and every existing theme control stays available for fine-tuning after
the import. This keeps the change additive: one widened condition on the public
page, three new fields on the theme.

## 1. Model (`lib/events/theme.js`)

Three additions to the theme:

```js
theme.logo   = { url: "", height: 32, link: "", showBar: true, showInFooter: true }
theme.source = { url: "", siteName: "", importedAt: "" }
theme.font   = {
  heading: "sans" | "custom",   // "custom" → headingFamily
  body:    "sans" | "custom",
  scale:   "md",
  headingFamily: "",            // raw family name, e.g. "Inter"
  bodyFamily:    "",
  webfonts: [{ family, css }],  // Google Fonts stylesheet URLs to load
}
```

- `resolveFontCss(key, theme)` returns a quoted family stack when the key is
  `"custom"`, falling back to the built-in list otherwise.
- `themeFontOptions(theme)` appends an **Imported** entry to `FONT_OPTIONS` when
  a custom family is present, so the picker shows what is active and lets the
  user switch back to a built-in.
- `resolveTheme` back-compat is unchanged; the new fields default empty.

`PAGE_MODES` in `page_design.jsx` gains `{ key: "imported", label: "Import" }`.

## 2. Extraction (`lib/brand/extract.js` + `app/api/brand/extract/route.js`)

Server-side only. Regex parsing — no HTML-parser dependency is added.

**Guards:** http(s) only, ports 80/443 only; DNS-independent block on
private/loopback/link-local hosts (SSRF); 8s timeout; 2 MB HTML cap; at most 10
linked stylesheets at 400 KB each; images capped at 512 KB; no JavaScript
execution. One `<meta http-equiv="refresh">` hop is followed, since region
gateways redirect that way.

**Signals:**

| Field | Sources (ranked) |
|---|---|
| `logos[]` | `<img>` whose src/alt/class/id matches `logo\|brand\|wordmark`, `apple-touch-icon`, `<link rel=icon>`, `og:image` |
| `pageBg` / `pageText` | `background`/`color` on the `body`/`html`/`:root` rule — the most reliable read of what the page looks like |
| `palette` | frequency-ranked hex/rgb() across all CSS, **excluding translucent values** (shadows and scrims otherwise make every site look black) |
| `cssVars` | custom properties whose value is a color |
| `fonts` | `fonts.googleapis.com/css2?family=` links; `font-family` declarations, with `h1..h3` rules preferred for heading |
| `radius` | `border-radius` values → `sharp` / `rounded` / `pill` |
| `button` | button/`.btn` rules → `solid` / `outline` / `soft` |
| `background` | `og:image`, offered as an optional page background |
| `site` | `<title>`, `og:site_name`, final URL after redirects |

Stylesheets are prioritized by filename (`color.css`, `global.css` before
`Tooltip.css`) — component-per-file bundlers emit dozens, and the budget has to
land on the ones that carry the brand.

Image candidates are returned as **base64 data URLs** so the browser can upload
them without hitting CORS.

Response: `{ site, logos, colors, palette, fonts, radius, button, background }`
or `{ error: { code, message } }` with codes `bad_url`, `blocked`, `timeout`,
`unreachable`, `empty`.

## 3. Mapping (`lib/brand/to-theme.js`)

Pure, client-safe. Takes the extraction payload plus which categories the user
ticked and returns a theme patch. Owns:

- light/dark base detection from background luminance,
- role assignment — background from the `body` rule, then `theme-color`, then an
  exact `--bg` variable, then palette frequency; brand from an exact variable or
  the color that best combines frequency with saturation,
- **validation of every scraped value against the resolved background**: a brand
  color must survive as a button fill, a card must step *toward* the text color,
  a border must be visible without being a second panel. Sites ship light and
  dark palettes side by side, so an unvalidated variable is as likely to be the
  wrong theme's as the right one.
- **contrast fix-up** — if scraped text and background collide, text is pushed to
  a readable value rather than shipping an unreadable page.

Verified against stripe.com, github.com, notion.com, linear.app, vercel.com, and
ycombinator.com: every one yields the correct light/dark base and passes the
4.5:1 text and 3:1 muted contrast floors.

## 4. UI (`components/internal/screens/events/brand_import.jsx`)

`ImportBrandDialog`: URL input → fetch → preview (pickable logo tiles, labelled
swatch row, detected fonts, radius/button chips) with four apply toggles (logo,
colors, fonts, shape & imagery) → **Apply to page**.

On apply the chosen logo is converted to a `File` and uploaded via the existing
`uploadEventImage(eventId, file, { compress: false })` — compression off, since
canvas re-encoding destroys SVGs and transparent PNGs. It lands in
`products/events/<id>/`. When Supabase is unconfigured or the upload fails, the
remote URL is kept as a hotlink fallback.

`BrandLogoSection`: a `SectionCard` in the themed panel — logo preview,
replace/remove, height, link target, header/footer switches, and an
"Imported from x.com · Re-import" row.

Only categories that actually returned data are offered. A one-line hint notes
that using another brand's logo is the user's call.

## 5. Renderer

- `event_public_page.jsx`: `themed = cfg.mode !== "standard"`; a slim **brand
  bar** above the hero when `theme.logo.url && showBar`; webfont `<link>` tags
  rendered inline (React 19 hoists them to `<head>`).
- `page_footer.jsx`: `PageFooter` takes an optional `logo` prop and renders the
  mark above the footer content when `showInFooter`.

## 6. Persistence

None. Everything lives inside `pageDesign` in the events `metadata` bag and is
saved through the existing merge RPC. The logo file goes to the existing
`products` bucket. **No migration.**

## Non-goals

- Rendering JS-heavy SPAs (no headless browser) — such sites typically yield only
  a favicon, and the dialog says so rather than applying a blank theme.
- Copying layout, markup, or content from the source site. Brand tokens only.
- Inline `<svg>` logos (v1 takes raster + linked SVG files only).
