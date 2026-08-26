
import affiliates from "./affiliates/manifest";

export const INSTALLED_ADDONS = Object.freeze([affiliates]);

export const ADDON_BY_ID = Object.freeze(
  Object.fromEntries(INSTALLED_ADDONS.map((a) => [a.id, a])),
);

export function getAddon(addonId) {
  return ADDON_BY_ID[addonId] || null;
}

export const ADDON_NAV = Object.freeze(
  INSTALLED_ADDONS.filter((a) => a.nav).map((a) =>
    Object.freeze({ ...a.nav, addonId: a.id }),
  ),
);

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

export const ADDON_TITLES = Object.freeze(
  Array.from(
    new Set([
      ...Object.keys(ADDON_SCREEN_BY_TITLE),
      ...ADDON_NAV.filter((n) => !n.subItems).map((n) => n.title),
    ]),
  ),
);

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

export function getAddonScreenEntry(title) {
  return ADDON_SCREEN_BY_TITLE[title] || ADDON_SECTION_SCREEN[title] || null;
}
