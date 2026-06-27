# Module Conventions (Screen ↔ Suite)

How to build a workspace screen (navigation, data, UI, permissions) so it matches
the rest of the app. Reference implementation: the **events** area
(`components/internal/screens/events`, `components/internal/screens/overview`)
and the shared kit (`components/internal/shared`).

## Where things go

| Concern | Location | Naming |
|---|---|---|
| Workspace screen | `components/internal/screens/<area>/<name>.jsx` | snake_case file, `*Screen` export |
| Screen ↔ nav wiring | `components/internal/screens/registry.jsx` | title → component map |
| Sidebar nav entries | `components/internal/sidebar/sidebar_nav.jsx` | `title` must match registry key |
| Shared screen primitives | `components/internal/shared/screen_kit.jsx` | `ScreenHeader`, `StatsBar`, `DataTable`… |
| Page-width wrappers | `components/internal/shared/screen_wrappers.jsx` | `MainScreenWrapper`, `SecondaryScreenWrapper` |
| Mock/sample data | `components/internal/screens/<area>/sample_data.js` | `EVENTS`, `*_MAP`, formatters |
| shadcn primitives | `components/ui/*` | `@/components/ui/<name>` |
| Permissions catalog | `lib/rbac.js` | `WORKSPACE_PERMISSIONS`, dot-namespaced keys |
| Supabase client | `lib/supabase/client.js` | `createClient()` (browser, activity-tracked) |
| Data layer (per area) | `lib/supabase/<area>.js` | `list*/get*/create*/update*/softDelete*`, `normalize*/toRow` |
| SQL (when persisted) | `supabase/sqls/*.sql` | plain, idempotent DDL |
| Migration runner | `scripts/run-sqls.js` (`npm run db:push`) | `pg` over `STRING_URI`, runs `supabase/sqls/*` in order |

Files use snake_case names; React components are PascalCase; permission keys are
dot-namespaced (`view.overview`, `team.invite`). All imports use the `@/` root
alias.

## Screens & navigation

- A screen is a `"use client"` component exporting a named `*Screen` (and a
  matching default). It renders inside a width wrapper — `MainScreenWrapper` for
  primary list/overview screens, `SecondaryScreenWrapper` for narrower
  detail/settings screens.
- **Wire it through the registry, never by ad-hoc routing.** Add the component to
  `SCREEN_REGISTRY` in `registry.jsx` keyed by the **exact** sidebar title from
  `sidebar_nav.jsx`. Unlisted titles fall back to `ComingSoonScreen`.
- **Per-entity features are tabs, not top-level screens.** Cover media, tickets,
  visibility, page design, publishing, etc. live as tabs inside the event editor
  (`events/event_detail.jsx`), reached by selecting a row in All Events — they do
  **not** get their own registry entry. Only workspace-level views (Overview,
  All Events, Templates, Event Series…) are registered.
- A list screen swaps to its detail screen by holding a `selectedEvent` in state
  and early-returning the detail component (`<EventDetailScreen … onBack={…} />`)
  — there is no router push for this.

## Data layer

This project is **UI-first**: screens are seeded from local sample data and own
their state. There is no per-feature data/actions layer yet.

- Keep mock data in the area's `sample_data.js` (`EVENTS`, lookup `*_MAP`s,
  `formatDate`/`currency` helpers). Screens import it and seed local state:
  `const [events, setEvents] = useState(EVENTS)`.
- Derive everything else with `useMemo` over that state — filtered lists, KPI
  stats, grouped views — keyed on `(data, search, filters)`.
- Mutations are **local and optimistic**: update the array in state and give
  feedback with `toast`. Generate ids as `evt_${Date.now()}`-style locals.
- **When a screen graduates to real persistence**, talk to Supabase only through
  `createClient()` from `@/lib/supabase/client` (a browser client whose `fetch`
  is wrapped for activity tracking — don't construct a raw client). The DB is
  snake_case; the UI is camelCase — map at that boundary and keep the screen
  rendering camelCase view models. Keep data access pure (validate,
  `console.error` on failure, return `null`/`false`/`[]`); the screen decides UX
  (toasts).

## Permissions (RBAC)

Authorization here is **advisory UI-gating only** — it hides/disables nav and
controls; it does not secure data.

- The catalog lives in `lib/rbac.js` as `WORKSPACE_PERMISSIONS` — dot-namespaced
  `{ key, label, group }` entries (`view.*` for nav visibility, plus
  `team.*`, `roles.*`, `billing.*`, `settings.*`).
- A nav tab's permission key derives from its title via `tabPermissionKey(title)`
  → `view.<normalized_title>`. Gate a tab by checking
  `roleHasPermission(roles, roleId, key)` (returns `true` when no roles are
  configured, so screens stay reachable by default).
- Role ids are normalized with `normalizeRoleId` and persisted under
  `ROLE_STORAGE_KEY`. To add a gated surface: add the permission to
  `WORKSPACE_PERMISSIONS`, then check it where the nav/control is rendered.

## UI conventions

- **Components:** prefer `shadcn/ui` primitives (`@/components/ui/*`) and
  **Lucide** icons. Build screens out of the shared kit
  (`@/components/internal/shared/screen_kit`) before writing bespoke layout —
  `ScreenHeader`, `StatsBar`/`StatGrid`, `SectionCard`, `Toolbar` + `SearchInput`,
  `DataTable`, `StatusPill`, `EmptyState`, `SettingsList`/`SettingRow`, `Field`.
- **Screen frame:** `MainScreenWrapper` → `ScreenHeader` (title + description over
  a bottom divider, primary action on the right; **no** icon chip or badge) →
  `StatsBar` → `Toolbar` → `DataTable`. Match the Events Overview / All Events
  rhythm.
- **Dialogs:** shadcn `Dialog` with `DialogHeader`/`DialogTitle`/`DialogDescription`,
  a `grid gap-4` of `Field`-wrapped controls, then `DialogFooter` with a ghost
  Cancel + a `bg-primary` primary action. Keep the default close button.
- **Feedback:** Sonner `toast` (`toast.success`/`toast.error`); the Toaster is
  global with `richColors` and **no close button** — don't re-add it.
- **State:** every list has loading, empty, and filtered-empty states (`EmptyState`
  with a "create/clear filters" action). Status is rendered via `StatusPill` +
  a `*_MAP` from `sample_data.js`.
- **Colors — semantic tokens only, never hardcode hex:**
  - Surfaces: `bg-background`, `bg-surface-subtle|card|hover|active|strong`
  - Text: `text-foreground`, `text-muted-foreground`, `text-text-secondary`,
    `text-text-tertiary`
  - Borders: `border-border`, `border-border-strong`
  - Brand/primary: `bg-primary` + `text-primary-foreground`
  - Destructive: `text-red-400` / `focus:bg-red-500/10` (delete actions)
  - Trend/status: `text-emerald-400` (up) / `text-red-400` (down); badges use
    tailwind color utilities at `/10` bg + `/20` border.

## New-screen checklist

1. Component at `components/internal/screens/<area>/<name>.jsx` — `"use client"`,
   `*Screen` export, wrapped in `MainScreenWrapper`/`SecondaryScreenWrapper`.
2. Register it in `registry.jsx` under the exact `sidebar_nav.jsx` title (and add
   the nav entry if it's new).
3. Seed from `sample_data.js`; derive lists/stats with `useMemo`; mutate state +
   `toast` (optimistic, local ids).
4. Build the UI from the shared kit + shadcn primitives; three list states;
   semantic color tokens only.
5. (If gated) add a `view.*` permission to `WORKSPACE_PERMISSIONS` and check it
   where the nav/control renders.
