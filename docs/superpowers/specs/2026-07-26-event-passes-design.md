# Event Passes — printing & design

Upgrades the Check-in → **Badge Printing** screen from a single non-persisted
badge layout into a real pass designer: saved templates, per-tier designs, true
physical stock sizes, paginated sheets, scannable QR, and PNG/ZIP export.

## Why

The existing screen (`components/internal/screens/checkin/badge_printing.jsx`)
already picks an event, offers four presets, previews, and prints — but:

1. the design lives in `useState` and is lost on navigate (`defaultBadge()` only
   stored `{ defaultTemplate }`);
2. the printed "QR" was a plain black `56×56` div — unscannable;
3. one hardcoded `240×150px` size, flex-wrapped — no badge stock, no page layout;
4. no tier variants — VIP and GA printed identically;
5. `BADGE_EXPORT_FORMATS` (PDF/PNG/ZIP) was declared but unused;
6. `QR Tickets` / `Wallet Passes` settings were stored but applied nowhere.

## Architecture

### Renderer — `lib/passes/render.js`

`passSvg(template, ctx)` returns **one SVG string sized in real millimetres**.
It is the single source of truth for preview, print, and raster export, so the
three can't drift.

SVG (not HTML) because PNG export then needs no dependency: SVG data-URI →
`Image` → `<canvas>` → `toBlob()`. It also gives exact physical control, which
pass stock requires.

Layout scales off `s = clamp(min(w,h)/54, 0.75, 2.2)` so one design reads
correctly on a 54 mm card and a 148 mm A6 sheet. Text is fitted with a
character-budget ellipsis (`fitText`) rather than clipped.

### QR — `lib/passes/qr.js`

Wraps the `qrcode` package (already a dependency; its `browser` field maps to
`lib/browser.js`, which exports `create`). Using `create` yields the raw module
matrix, so the renderer draws its own rects — no SVG string parsing.

**Payload = the raw id** (order id for orders, registration id for
registrations). This matches `app/api/portal/ticket/[id]/qr/route.js` exactly,
and `admitCheckin()` already accepts either, so printed passes scan on the
existing door scanner with **no scanner changes**.

Colour, error-correction level, and the centre logo read from the existing
**QR Tickets** settings slice, which finally makes that screen do something. The
centre logo is drawn **only at error correction Q or H** — those tolerate the
~6% of modules it knocks out, where L and M would risk the scan. The designer
says so inline rather than silently dropping it.

### Attendees — `lib/passes/attendees.js`

`listPassAttendees(eventId)` merges both sources:

- **orders** (`listOrders`) — expanded to `quantity` passes, `tier = ticket_name`,
  seat index for the printed label. Cancelled and fully-refunded orders are
  skipped.
- **registrations** (`listRegistrationsByEvent`) — the registrant plus each
  `plusOnes` entry gets its own pass. Waitlisted/cancelled/declined skipped.
- **dedupe by normalised email, preferring the order** (it carries the tier).
  Free and paid flows write to different tables, so overlap is rare, but a buyer
  who also RSVP'd would otherwise print twice.

`company` is not a column on either table; it is read from the registration
`answers`/metadata bag when present, and the row is **hidden when absent**
rather than falling back to the event name as the old code did.

Passes on the same order share one QR payload — that mirrors the buyer portal,
where a multi-seat order has a single code. The seat label distinguishes them.

### Templates — no SQL

`defaultBadge()` grows a `templates` array, persisted through the existing
`updateCheckinSettings(projectId, { badge })` merge RPC. It's the config bag, so
**no migration and no `db:push`**.

```js
{ id, name, isDefault, tiers: ["VIP", "Speaker"],
  stock:  { preset, wMm, hMm },
  sheet:  { page, marginMm, gutterMm, cropMarks },
  accent, bg, textColor, showLogo, logoUrl,
  fields: { eventName, name, company, tier, ticketCode, date, qr },
  qr:     { sizeMm, position } }
```

Tier binding is by tier **name**: tier ids are per-event, names are stable
across events, and orders store `ticket_name`. Resolution per attendee: first
template whose `tiers` matches (case-insensitively) → else the `isDefault`
template → else the first. The old `BADGE_TEMPLATES` presets become seeds for
"new template from preset" rather than a fixed set of four.

### Output

- **PDF** — browser print sheet, now a paginated grid honouring page size,
  margins, gutters, and optional crop marks.
- **PNG** — one file per pass, via canvas at 300 DPI.
- **ZIP** — all PNGs through `lib/passes/zip.js`, a store-only (uncompressed)
  writer with a CRC32 table. ~70 lines instead of a `jszip` dependency.

An external `logoUrl` taints the canvas and would break PNG export, so the
exporter inlines it as a data URI first and warns when it can't be fetched.

## Files

| New | Purpose |
|---|---|
| `lib/passes/stock.js` | stock + page presets in mm, grid maths |
| `lib/passes/qr.js` | memoised QR matrix from `qrcode` |
| `lib/passes/render.js` | `passSvg()` — the shared renderer |
| `lib/passes/attendees.js` | merged registrations + orders |
| `lib/passes/zip.js` | store-only ZIP writer |
| `components/internal/screens/checkin/badge/template_list.jsx` | template rail |
| `components/internal/screens/checkin/badge/design_form.jsx` | design editor |
| `components/internal/screens/checkin/badge/preview.jsx` | live preview |
| `components/internal/screens/checkin/badge/print.js` | paginated print sheet |
| `components/internal/screens/checkin/badge/export.js` | PNG / ZIP |

| Changed | Purpose |
|---|---|
| `components/internal/screens/checkin/badge_printing.jsx` | reduced to a shell |
| `components/internal/screens/checkin/constants.js` | template model + presets |

`badge_printing.jsx` is split rather than grown so no single file carries the
data loading, the editor, the renderer, and three exporters at once.
