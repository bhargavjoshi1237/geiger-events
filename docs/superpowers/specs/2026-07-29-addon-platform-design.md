# Addon Platform — Design

**Date:** 2026-07-29
**Status:** Built. Contract documented in `ADDON_CONVENTIONS.md`.
**Proving case:** the Affiliates addon (see `2026-07-29-affiliates-addon-design.md`)

## Why

geiger-flow has an addon system. It works well enough to demo and badly enough to
be worth not copying. This ports the good idea — a manifest-declared feature
module that plugs into nav, screens, permissions and settings — onto
geiger-events' architecture, fixing each of flow's structural defects.

### What flow does

`addons/<id>/manifest.js` exports a plain object; `addons/<id>/index.js` calls
`loadAddon(manifest)` as an **import side-effect**; `addons/registry.js` keeps a
module-level mutable array plus a React context holding `enabledAddons`,
`navPositions` and `addonColors`; `app/project/[id]/page.js` imports every addon
for its side-effect, then consults `getAddonScreens(enabled)` before its own
`switch`; the sidebar splices addon nav in via `mergeNavWithAddons`.

### Its defects, and this design's answer

| flow's defect | answer here |
|---|---|
| Enablement is `useState` — every toggle, colour and position is lost on refresh | `events.project_addons`, one row per (project, addon) |
| Module-level mutable array mutated by import order; invisible to React, duplicates under Fast Refresh | A frozen, statically-derived catalog; all mutable state is React state fed from the DB |
| `import "@/addons/sql"` side-effects — eager bundling, and a forgotten import silently deletes an addon | One explicit `INSTALLED_ADDONS` array; screens are `() => import(...)` thunks, so a disabled addon costs nothing |
| Screens keyed by display title; an addon can silently shadow a core screen | Screens carry a stable `<addonId>.<key>` id; the title→screen index **throws at module load** on a collision with a core registry key or another addon |
| "Sidebar position" sorts addons among themselves, then the merge ignores it entirely — a broken shipped feature | `position` is an index into the *merged* top-level nav and is the value the merge actually applies |
| No RBAC, no per-project scoping, no data/migration/API contract, no lifecycle | Manifests declare permission keys; everything is project-scoped; addons own migrations and data-layer files like any other area |
| Hardcoded hex colours, against this repo's `crafting.md` | Semantic tokens only; manifests name an accent from a fixed token set |

## Constraint that shapes the design

geiger-events routes tabs by **path slug** (`/project/<id>/allevents`), and
`lib/workspace/tabs.js` builds `SLUG_TO_TAB` **once at module load** from
`workspaceNav`. Slug resolution must stay synchronous — an async lookup means a
route flicker on every refresh.

Therefore: **the installed catalog is static; only enablement is dynamic.** Nav
titles, slugs and permission keys are derived at module load from *all* installed
addons, whether or not a given project has them on. Enablement gates
**visibility and rendering**, not resolution. A disabled addon's URL still
resolves — to a clean "this add-on is turned off" screen rather than a 404.

## Architecture

```
addons/
  manifest_schema.js     defineAddon() — normalises + validates one manifest
  index.js               INSTALLED_ADDONS (explicit static imports) + derived indexes
  registry.js            pure derivation: nav merge, screen lookup, permission merge
  <addon-id>/
    manifest.js          metadata only — no component imports
    screens/*.jsx        lazily loaded via () => import(...)
    lib/*.js             the addon's data layer
context/addons-context.js  AddonsProvider — DB-backed enablement for the active project
lib/supabase/project_addons.js  data layer for events.project_addons
components/internal/screens/settings/addons_settings.jsx   Settings → Add-ons
components/internal/screens/addon_screen_host.jsx          lazy host + off/missing states
```

### The manifest

```js
export default defineAddon({
  id: "affiliates",                    // stable, kebab-case, never changes
  name: "Affiliates",
  description: "...",
  version: "1.0.0",
  category: "Revenue",
  icon: BadgeDollarSign,               // lucide component
  accent: "emerald",                   // semantic token key, NOT a hex value
  features: ["...", "..."],
  nav: {
    title: "Affiliates",               // top-level sidebar section
    icon: BadgeDollarSign,
    insertAfter: "Orders",             // placement default; DB position overrides
  },
  screens: [
    { key: "programs", title: "Programs", icon: Layers,
      load: () => import("./screens/programs") },
  ],
  permissions: [
    { key: "view.affiliates", label: "Affiliates", group: "Workspace views" },
  ],
  settings: { load: () => import("./screens/settings_panel") },
  defaultConfig: { attributionWindowDays: 30 },
});
```

`defineAddon` validates shape, freezes the result, defaults `screens[].id` to
`<addonId>.<key>`, and defaults `nav.subItems` to the screen list when the addon
declares more than one screen.

**Metadata only.** A manifest must not import a screen component — only a thunk.
This is what makes a disabled addon free.

### Derived indexes (`addons/index.js`)

Built once, at module load, from `INSTALLED_ADDONS`:

- `ADDON_BY_ID` — id → manifest
- `ADDON_NAV` — nav items, one per addon that declares `nav`
- `ADDON_TITLES` — every nav-reachable title (top-level + sub-items)
- `ADDON_SCREEN_BY_TITLE` — title → `{ addonId, screen }`
- `ADDON_PERMISSIONS` — flattened permission descriptors

`ADDON_SCREEN_BY_TITLE` construction **throws** if a title already exists in
`SCREEN_REGISTRY` or was claimed by another addon. A collision is a build-time
programming error, not a runtime surprise.

### Enablement (`context/addons-context.js`)

`AddonsProvider` sits under `ProjectProvider` in the workspace shell. On mount
and on project change it calls `listProjectAddons(projectId)` and exposes:

```
{ rows, enabledIds, positions, configById, loading,
  isEnabled(id), setEnabled(id, on), setPosition(id, n), setConfig(id, patch) }
```

Writes are optimistic against local state, persisted via
`upsertProjectAddon`, and rolled back with a `toast.error` on a falsy return —
the standard pattern in `SUPABASE_CONVENTIONS.md` §8.

Outside the workspace (public event pages, the portal) there is no provider;
`useAddons()` returns a null-object with everything disabled rather than
throwing, so shared components render safely anywhere.

### Integration points (5 edited files)

1. **`lib/workspace/tabs.js`** — seed `SLUG_TO_TAB` from `workspaceNav` *and*
   `ADDON_TITLES`. Core titles win a slug collision.
2. **`components/internal/screens/registry.jsx`** — register the new
   `"Add-ons"` settings screen; `getScreen(title)` falls through to
   `ADDON_SCREEN_BY_TITLE` and returns a host component bound to that screen.
3. **`components/internal/sidebar/sidebar.jsx`** — merge `getAddonNav(enabledIds,
   positions)` into `workspaceNav` before the existing permission filter, so
   addon nav is RBAC-gated on exactly the same code path as core nav.
4. **`app/project/[projectId]/[[...rest]]/page.js`** — wrap in `AddonsProvider`.
5. **`lib/rbac.js`** — `WORKSPACE_PERMISSIONS` concatenates `ADDON_PERMISSIONS`
   so addon views appear in the Roles & Permissions matrix automatically.

`sidebar_nav.jsx` gains one line: `{ title: "Add-ons", icon: Blocks }` under
Settings.

### Screen host

`AddonScreenHost` resolves the thunk with `next/dynamic` and renders, in order:

- addon not installed → `ComingSoonScreen` (the URL is stale)
- addon installed but disabled for this project → an `EmptyState` explaining it
  is off, with an "Enable in Settings" action for anyone holding
  `settings.manage`
- loading → the shared `LoadingArea`
- otherwise → the screen

### Settings → Add-ons

`MainScreenWrapper` → `ScreenHeader` → `StatsBar` (installed / enabled / screens
added) → a card per addon: icon chip in the addon's accent token, name, version
and category badges, description, an Active pill, and a `Switch`. Expanding a
card reveals its features, a working sidebar-position `Select`, and the addon's
own settings panel when it declares one. Semantic tokens throughout; three list
states; optimistic writes with `toast`.

## Testing

Manual, matching how this repo verifies UI work:

1. `npm run db:push` then `npm run db:status` clean.
2. Toggle an addon on → its nav section appears; hard-refresh → still there.
3. Deep-link a disabled addon's slug → the "turned off" state, not a 404.
4. Change sidebar position → the section actually moves, and survives refresh.
5. Switch projects → enablement differs per project.
6. Revoke the addon's `view.*` key on a role → its nav disappears.
7. `npx eslint` clean on every touched file.

## Out of scope

Third-party/runtime-installed addons, addon-to-addon dependencies, per-addon
version migrations, and an addon marketplace. The catalog is first-party code in
this repo; that is the whole reason a static index is safe.
