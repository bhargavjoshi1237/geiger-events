# Addon Conventions

An **addon** is an optional feature module a project turns on. It declares what
it contributes — nav, screens, permissions, settings, defaults — in a manifest,
and the platform wires it into the workspace. Reference implementation:
`addons/affiliates`.

Read `MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md`, `MIGRATION_CONVENTIONS.md`
and `crafting.md` first — an addon follows **all** of them. This doc only covers
what is different because the module is pluggable.

---

## 0. The rules, in one place

1. **The catalog is static.** `addons/index.js` imports every manifest
   explicitly. No side-effect imports, no filesystem scanning.
2. **A manifest is metadata only.** Screens travel as `() => import(...)`
   thunks; a manifest must never import a component.
3. **Only enablement is dynamic.** It lives per project in
   `events.project_addons` and gates *visibility and rendering*, never
   *resolution*.
4. **A screen title must be globally unique.** Colliding with `SCREEN_REGISTRY`
   or another addon throws at module load.
5. **Semantic tokens only.** A manifest names an `accent` key, never a hex value.
6. **An addon owns its own migrations, data layer and screens**, all under
   `addons/<id>/`.

---

## 1. Layout

```
addons/
  manifest_schema.js       defineAddon() — normalises, validates, freezes
  index.js                 INSTALLED_ADDONS + derived indexes
  registry.js              pure nav-merge / placement helpers
  <addon-id>/
    manifest.js            what this addon contributes
    screens/*.jsx          one file per screen, lazily loaded
    lib/*.js               the addon's data layer + constants
```

Its SQL still lives in `supabase/migrations/` and runs through `@geiger/orm` like
any other migration — an addon's tables are ordinary tables in the `events`
schema. Nothing about being pluggable changes the migration playbook.

## 2. The manifest

```js
export default defineAddon({
  id: "affiliates",              // kebab-case, stable, never changes
  name: "Affiliates",
  description: "...",
  version: "1.0.0",
  category: "Revenue",
  icon: BadgeDollarSign,         // lucide component
  accent: "emerald",             // token key from ADDON_ACCENTS — never a hex
  features: ["...", "..."],      // shown in Settings → Add-ons
  nav: {
    title: "Affiliates",         // top-level sidebar section
    icon: BadgeDollarSign,
    insertAfter: "Orders",       // default placement; the project can override
  },
  screens: [
    { key: "programs",           // kebab-case; the stable id is <addonId>.<key>
      title: "Programs",         // display label — ALSO the route token
      icon: Layers,
      load: () => import("./screens/programs") },
  ],
  permissions: [
    { key: "view.affiliates", label: "Affiliates", group: "Workspace views" },
  ],
  defaultConfig: { attributionWindowDays: 30 },
});
```

A screen module may export a named `*Screen` or a default; both work.

**Naming screens:** the title is the route token, so it must not collide with a
core `SCREEN_REGISTRY` key. `Payouts`, `Templates`, `Refunds`, `Members`,
`Segments`, `Tags`, `Notes`, `Budgets`, `Insights`, `Connections` and
`Transactions` are already taken — qualify yours (`Affiliate Payouts`,
`Program Templates`).

## 3. Enablement

`events.project_addons` holds one row per (project, addon): `enabled`,
`position`, `config`. `AddonsProvider` (in the workspace shell) loads it and
exposes `useAddons()`:

```js
const { enabledIds, positions, isEnabled, getConfig,
        setEnabled, setPosition, setConfig, loading } = useAddons();
```

Writes are optimistic and persist through `lib/supabase/project_addons.js`; a
falsy return rolls back and the caller toasts. Outside the workspace
`useAddons()` returns an everything-off stand-in rather than throwing, so shared
components render anywhere.

**An addon is opt-in.** A fresh project has none enabled.

## 4. Why the catalog is static

Workspace tabs route from a **path slug**, resolved through a map built once at
module load (`lib/workspace/tabs.js`). Slug resolution must stay synchronous or
every refresh flickers. So nav titles, slugs and permission keys derive from the
whole *installed* catalog, and enablement only decides what renders.

The payoff: a disabled addon's URL still resolves, to a clear "this add-on is
turned off" screen instead of a 404 — and its code still never loads, because
screens are lazy.

## 5. Placement

`position` (set in Settings → Add-ons) is an **index into the merged top-level
nav**, and it is the value the merge actually applies. Unset, the manifest's
`insertAfter` decides; failing that, the section lands just above Settings.

## 6. Permissions

Manifest `permissions` are appended to `WORKSPACE_PERMISSIONS`, so an addon's
keys appear in Roles & Permissions automatically. Addon nav is merged **before**
the sidebar's permission filter, so it is gated on the same code path as core nav
— an addon cannot route around RBAC by contributing nav.

## 7. Checklist for a new addon

- [ ] `addons/<id>/manifest.js` via `defineAddon`, metadata only, lazy screens
- [ ] Registered in `addons/index.js`
- [ ] Screen titles don't collide with `SCREEN_REGISTRY` (it throws if they do)
- [ ] Migration(s) scaffolded with `npm run db:new`, schema-qualified, `@up`/`@down`, RLS on
- [ ] Data layer under `addons/<id>/lib/`, following `SUPABASE_CONVENTIONS.md`
- [ ] Screens built from the shared kit, three list states, semantic tokens only
- [ ] `accent` is a token key, not a hex value
- [ ] `npx eslint addons` clean
