// The installed addon catalog.
//
// Every addon is listed here EXPLICITLY. This is the one file to edit when
// adding or removing an addon — there are no side-effect imports and no
// filesystem scanning, so the dependency graph stays visible to the editor and
// a bundler can code-split each addon's screens on its own.
//
// The catalog is STATIC on purpose. geiger-events resolves sidebar tabs from a
// path slug through a map built once at module load (lib/workspace/tabs.js), so
// nav titles and slugs must be known synchronously. Only *enablement* is
// dynamic — it lives per project in events.project_addons and gates visibility
// and rendering, never resolution. A disabled addon's URL still resolves, to a
// clean "turned off" screen instead of a 404.

import affiliates from "./affiliates/manifest";

export const INSTALLED_ADDONS = Object.freeze([affiliates]);

export const ADDON_BY_ID = Object.freeze(
  Object.fromEntries(INSTALLED_ADDONS.map((a) => [a.id, a])),
);

export function getAddon(addonId) {
  return ADDON_BY_ID[addonId] || null;
}

// Nav item per addon that declares one, tagged with its addon id so the merge
// and the permission filter can trace an entry back to its owner.
export const ADDON_NAV = Object.freeze(
  INSTALLED_ADDONS.filter((a) => a.nav).map((a) =>
    Object.freeze({ ...a.nav, addonId: a.id }),
  ),
);

// title -> { addonId, screen }. Built once; a title claimed by two addons is a
// programming error and throws at module load rather than silently shadowing.
// The core-registry collision check lives in screens/registry.jsx (it owns that
// map, and checking it here would be a circular import).
export const ADDON_SCREEN_BY_TITLE = Object.freeze(
  INSTALLED_ADDONS.reduce((acc, addon) => {
    addon.screens.forEach((screen) => {
      if (acc[screen.title]) {
        throw new Error(
          `[addons] screen title "${screen.title}" is claimed by both "${acc[screen.title].addonId}" and "${addon.id}"`,
        );
      }
      acc[screen.title] = { addonId: addon.id, screen };
    });
    return acc;
  }, {}),
);

// Every nav-reachable title: screen titles plus any top-level section title that
// is itself a destination (a single-screen addon). Feeds the slug map so an
// addon URL resolves whether or not the project has it enabled.
export const ADDON_TITLES = Object.freeze(
  Array.from(
    new Set([
      ...Object.keys(ADDON_SCREEN_BY_TITLE),
      ...ADDON_NAV.filter((n) => !n.subItems).map((n) => n.title),
    ]),
  ),
);

// A single-screen addon's section title routes to that screen, so "Affiliates"
// and its one screen resolve to the same component (mirrors how core areas like
// Orders → All Orders behave).
export const ADDON_SECTION_SCREEN = Object.freeze(
  INSTALLED_ADDONS.reduce((acc, addon) => {
    if (addon.nav && !addon.nav.subItems && addon.screens.length === 1) {
      acc[addon.nav.title] = { addonId: addon.id, screen: addon.screens[0] };
    }
    return acc;
  }, {}),
);

export const ADDON_PERMISSIONS = Object.freeze(
  INSTALLED_ADDONS.flatMap((a) => a.permissions),
);

// Resolve a routed title to its addon screen (section title or screen title).
export function getAddonScreenEntry(title) {
  return ADDON_SCREEN_BY_TITLE[title] || ADDON_SECTION_SCREEN[title] || null;
}
