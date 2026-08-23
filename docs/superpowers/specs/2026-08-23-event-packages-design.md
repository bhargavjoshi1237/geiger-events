# Event Packages — design

Date: 2026-08-23
Status: approved for implementation

Sell premium hospitality bundles ("VIP packages") against an event: a tiered set
of experiences, each with its own inclusions, price and imagery, on a standalone
sales page separate from the event's own live page.

Reference: UFC / On Location "UFC 331 VIP Tickets" — hero, intro, a row of
package cards (image, name, tagline, inclusions with icons, More details, price,
buy button), a "Why choose" band, and an enquiry form.

## Scope

Three surfaces, gated behind one project-wide switch.

1. **Packages** — a workspace sidebar area directly under Events, whose screen
   is the global enable switch and nothing else.
2. **Packages** — an event-editor section, visible only while the switch is on,
   where the event's packages are authored.
3. **The packages page** — a standalone public route per event, with its own
   full page editor, where packages are actually sold.

Packages are **not** offered on the event's own live page. That page keeps
selling tickets; packages have their own point-of-sale page.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Selling | Existing checkout, from the packages page only | A package is a premium ticket; reusing checkout brings orders, payment and refunds for free |
| Storage | Event metadata bag | `event.tickets` already lives there — packages are the same kind of thing, so no migration and no new access layer |
| Enquiries | A table, `events.package_enquiries` | Deviation from the above, and unavoidable: enquiries are written by anonymous visitors. The metadata bag is members-only and would race between concurrent submissions |
| Page customisation | Its own full page editor | Reuses `PageDesignSection` against a second config key rather than a parallel builder |
| Enablement | `events.project_addons` | Per-project `enabled` + `config` already exists; no new table |

## Data

Four metadata keys on the event, all through `useEventConfig`:

```js
event.packages        // { intro, items: [Package] }
event.packagesPage    // { enabled, hero, intro, pitch, leads… } — page content
event.packagesDesign  // the design object PageDesignSection already edits
```

Enquiry *config* lives on `packagesPage`; enquiry *submissions* go to
`events.package_enquiries`, because they are written by anonymous visitors.
anon gets INSERT and deliberately not SELECT — a readable enquiries table would
be a scrapeable lead list of names, emails and phone numbers.

```js
Package = {
  id, name,                  // "Rising Star"
  tagline,                   // "Ticket + Hospitality"
  image,                     // cover
  inclusions: [{ id, icon, text }],
  details,                   // rich text behind "More details"
  price, priceSuffix,        // 1000, "/pp"  → "Starting at $1,000.00/pp"
  currency,
  stock,                     // null = unlimited
  ctaLabel,                  // default "Buy package"
  mode,                      // "buy" | "enquire"
  visible,
}
```

Enablement is a `config.enabled` flag on the project's `packages` addon row, read
once in the shell and passed down — the same read the sidebar already does.

## Surfaces

### 1. Sidebar area + switch

`sidebar_nav.jsx` gains a `Packages` entry immediately after the `Events` block.
Its screen (`screens/packages/packages_settings.jsx`) is a single `SettingRow`
writing `enabled` to the project's addon row. While off, the event-editor section
is hidden — authored packages are kept, not deleted.

### 2. Event editor section

`event_packages.jsx`, registered in `event_sections.js` under the Tickets group
with a `showIf` on the global switch. A list editor over `event.packages.items`,
each row expanding to name, tagline, image, inclusions (icon + text, reorderable),
rich details, price, stock, and mode. Mirrors the existing list-editor sections
(offerings, bundles) in structure and component vocabulary.

### 3. Public packages page

Route `app/e/[id]/packages`, resolving the same event the live page does.
Composed of four bands, each toggleable:

- **Hero** — event name, venue, date over the event's cover, with a page title
  override ("UFC 331 VIP Tickets").
- **Intro** — a paragraph plus optional link.
- **Packages grid** — the cards, from `event.packages.items`.
- **Why choose / enquiry** — an optional split band and the lead form.

Design and theme come from `PageDesignSection` bound to `event.packagesDesign`,
so the packages page gets layout, theme and block editing without a second
implementation. Its editor lives as a "Page design" tab inside the Packages
section rather than in the event's own design section, so the two pages stay
independently styleable.

### Buying

A package card's button opens the existing `TicketCheckout` with the package
mapped onto the ticket shape (`id`, `name`, `price`, `remaining`). Nothing in the
checkout needs to know it is selling a package; the order records the package's
name and id the way it records a ticket's.

Packages in `mode: "enquire"` open the lead form instead and write to
`event.packagesLeads` submissions rather than taking payment.

## Out of scope

- Packages on the event's own live page (explicitly excluded).
- Per-package seat assignment; a package points at a seating tier by text only.
- Sharing packages across events — they are authored per event.

## Build order

1. Global switch: sidebar entry, settings screen, addon config read.
2. Event editor section over `event.packages` (content only, no page yet).
3. Public route rendering the four bands with the event's own theme.
4. Bind `PageDesignSection` to `event.packagesDesign` for full customisation.
5. Wire the buy button into `TicketCheckout`; then the enquiry form.
