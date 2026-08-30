# Shared Action Menu — design

Date: 2026-08-29
Repos touched: `geiger-ui` (new component + tokens), `geiger-events` (adoption)

## Problem

Every list screen renders the same triple-dot row-action menu, but each one is
hand-assembled from the `DropdownMenu*` primitives with its own classNames. The
result is three visual dialects of what should be one control.

Measured across `geiger-events`:

| Signal | Count |
| --- | --- |
| Files rendering an ellipsis-triggered action menu | 41 |
| Menu instances in those files | 42 |
| `text-red-400` occurrences | 141 |
| `text-red-300` occurrences | 111 |
| `text-destructive` occurrences | 9 |

All 41 are row/card action menus. The suite's nav and filter dropdowns trigger
from avatars and chevrons, not an ellipsis, so none of them appear in this set.

The three dialects, all rendering a different popover background in dark mode:

- `all_events.jsx`, shared `records_kit.jsx` — `bg-surface-card shadow-xl w-44`, delete as `text-red-300`
- `templates.jsx` — `bg-surface-subtle`, separator `bg-surface-hover`, delete as `text-red-400` *and* `variant="destructive"` fighting each other
- everything else — scattered between, some falling through to the primitive default `bg-surface-dialog`

### Root cause

`@geiger/ui`'s `DropdownMenuItem` already ships a `variant="destructive"`, and
`DropdownMenuContent` already defaults to a correct floating surface. Nobody uses
either, because `--destructive` in dark mode is `#7f1d1d` (red-900) — a *fill*
colour. As text on `#161616` it is effectively illegible, so every author reached
for `text-red-300`/`text-red-400` by hand.

Shipping a shared component without fixing that token would not stop the drift:
the next author would override it again for the same reason.

## Non-goals

- Navigation and filter menus keep their current bespoke layouts. They are not
  action menus: they trigger from avatars and chevrons rather than an ellipsis,
  and they carry headers, footers and custom rows. Explicitly out of scope:
  `internal/topbar/dialogue/profile_dropdown`, `internal/topbar/project_switcher`,
  `internal/topbar/dialogue/notifications_dropdown`,
  `internal/screens/overview/filter_dropdown`, `portal/portal_topbar`.
- `--destructive` itself is not repointed. It is a real fill colour used by
  `<Button variant="destructive">` across all three suite apps.
- No unrelated refactoring of the screens being touched.

## Design

### 1. `ActionMenu` — `geiger-ui/src/ui/action-menu.jsx`

Config-driven, not compositional. A survey of all 42 action menus found **no**
submenus, labels, checkbox items, radio items or shortcuts. The only per-item
extra in use is `disabled` (one call site, `orders/all_orders.jsx:258`). A flat
items array therefore covers 100% of call sites with no escape hatch needed.

```jsx
<ActionMenu
  label={`Actions for ${e.title}`}
  items={[
    { icon: Pencil, label: "Edit", onSelect: () => openEvent(e.id) },
    { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(e) },
    { icon: ExternalLink, label: "View page", onSelect: () => handleViewPage(e) },
    { separator: true },
    { icon: Trash2, label: "Delete", variant: "destructive", onSelect: () => setDeleteTarget(e) },
  ]}
/>
```

**Props**

| Prop | Default | Notes |
| --- | --- | --- |
| `items` | required | array; falsy entries skipped |
| `label` | `"Actions"` | `aria-label` on the trigger |
| `align` | `"end"` | forwarded to `DropdownMenuContent` |
| `side` | — | forwarded |
| `icon` | `MoreHorizontal` | trigger glyph |
| `disabled` | `false` | disables the trigger |
| `triggerClassName` | — | genuine one-offs only |
| `contentClassName` | — | genuine one-offs only |

**Item shape** — `{ icon, label, onSelect, variant, disabled }`, or
`{ separator: true }`.

- `variant` is `"default"` or `"destructive"`.
- Falsy entries are filtered, so `canRefund && { ... }` reads naturally.
- Leading, trailing and adjacent separators are collapsed, so conditional items
  never leave a stray divider.

**Baked-in behaviour**

- Trigger is `Button variant="ghost" size="icon-sm"` with the standard
  `text-muted-foreground hover:bg-surface-active hover:text-foreground`.
  Call sites pass no className.
- The component owns the `<div onClick={e => e.stopPropagation()}>` wrapper.
  Nearly every call site hand-writes this today because table rows are clickable.
- Content is `align="end" w-44`, inheriting `bg-surface-dialog`, `border-border`
  and `shadow-md` from the primitive.
- Items pass **zero** classNames. Destructive styling comes from
  `variant="destructive"` alone.

**Popover background: `surface-dialog` (`#2e2e2e` dark).** This is the
primitive's own default and the palette's overlay elevation (it matches
`--popover`), so the component sets no background at all — the 42 scattered
`bg-surface-card` / `bg-surface-subtle` overrides are simply deleted. Menus now
sit visibly above the page rather than blending into the row behind them.

**Two extras on the item shape**, both behaviour rather than styling:

- `href` — renders the row as an `<a>` via `asChild`, preserving middle-click
  and "open in new tab". External hrefs get `target`/`rel` automatically.
  Needed by `settings/custom_domains` ("Visit").
- `spin` — spins the item's icon for a row mid-flight. Needed by the same
  screen's "Verifying…" state.

Without these two, both cases would have had to degrade to `window.open` and a
lost spinner. Everything else in the sweep needed neither.

### 2. Destructive text token — `geiger-ui/src/tokens.css`

Add a token for danger *text and icons*, legible on both themes:

```css
:root { --destructive-text: #b91c1c; }  /* red-700 */
.dark { --destructive-text: #f87171; }  /* red-400 — the app's most-used value */
```

Register it as `--color-destructive-text` in the `@theme` block, then wire it
into the `data-[variant=destructive]` rules of **both** `DropdownMenuItem` and
`ContextMenuItem`:

```
data-[variant=destructive]:text-destructive-text
data-[variant=destructive]:focus:bg-destructive-text/10
data-[variant=destructive]:focus:text-destructive-text
data-[variant=destructive]:*:[svg]:!text-destructive-text
```

`--destructive` and `--destructive-foreground` are untouched, so every
`<Button variant="destructive">` in the suite renders exactly as it does today.

This is the load-bearing change. It is what makes `variant="destructive"`
legible, which is what stops the next author reaching for `text-red-300`.

### 3. Sonner toast elevation — `geiger-ui/src/ui/sonner.jsx`

`sonner.jsx:60` sets the toast to `bg-background`, which in dark mode is
`#161616` — byte-identical to the page background. Toasts therefore read as
having no elevation at all.

Change the toast classNames to:

- `bg-surface-dialog` — `#2e2e2e` dark, the palette's overlay/popover elevation
  (matches `--popover`). Light mode is `#ffffff`, same as the current
  `--background`, so light mode is visually unchanged.
- `border-border-strong` — `#474747` dark. At the existing `--border` `#333333`
  the outline would be nearly invisible against the lighter `#2e2e2e` fill.

If `#2e2e2e` still reads too dark in review, `--surface-strong` (`#333333`) is
the next step up. This is a visual judgement to confirm on screen.

The error toast's icon also moves from `text-destructive` to
`text-destructive-text` for the same legibility reason.

### 4. Adoption sweep — `geiger-events`, 41 files / 42 menus

Convert every ellipsis row/card action menu to `ActionMenu` and drop the now
unused `DropdownMenu*` imports and `MoreHorizontal` imports from each file.

Order, highest leverage first:

1. `components/internal/shared/records/records_kit.jsx` — backs 6 config-driven
   module screens (advertising, analytics, community, conference ×2, housing).
2. `components/internal/screens/events/all_events.jsx` — the reference screen.
3. `components/internal/screens/events/templates.jsx` — the worst dialect.
4. `components/internal/screens/tickets/records_kit.jsx`.
5. The remaining 37 files: orders (4), guests (5), inventory (5),
   registrations (3), settings (3), tickets (2 more), venues (3), events (3
   more), conference (2), memberships, campaigns, checkin, workflows, chat,
   and the two affiliates addon screens.

The authoritative file list is whatever
`grep -rlE '<(MoreHorizontal|MoreVertical|EllipsisVertical|Ellipsis)\b' --include=*.jsx .`
returns, minus `node_modules`.

## Sequencing

`geiger-events` consumes `@geiger/ui` by git ref. The work must land in order:

1. Build `ActionMenu`, the token and the sonner change in `C:\Pro\geiger-ui`.
2. Commit and push `geiger-ui`.
3. Pin the new SHA in `geiger-events/package.json` (replacing `#master`), install.
4. Sweep the ~35 call sites.

Per project convention, no local fork of `components/ui/*` is patched — the
change lands in `@geiger/ui` and is imported from there.

## Verification

- `npm run lint` in `geiger-ui`; `npm run build` in `geiger-events`. A build is
  warranted here: this is a broad UI change across 41 files.
- Visual pass in **both** light and dark on: `all_events`, `templates`, and one
  `records_kit`-backed screen. Confirm identical menu geometry, `#202020`
  popover fill, and a legible red Delete row.
- Confirm a toast renders visibly raised off the page background in dark mode.
- Confirm row-click still fires on the row but not through the menu trigger
  (the `stopPropagation` wrapper moved into the component).
- Grep check after the sweep: no `text-red-300`/`text-red-400` remaining inside
  a `DropdownMenuItem` in any converted file.

## Risk

`@geiger/ui` is shared with Geiger Flow and Geiger Notes. `ActionMenu` and the
new token are purely additive and safe for them. Changing `DropdownMenuItem`'s
destructive styling *will* change existing `variant="destructive"` items in
those apps — from near-black red to a legible red. That is a fix rather than a
regression, but it is a cross-app visual change that will appear on their next
`ui:update`.

The sonner change likewise affects toasts suite-wide, by design.
