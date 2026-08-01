import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { ADDON_TITLES } from "@/addons";

// Workspace tab <-> URL slug mapping. The active tab lives in the path
// (/project/<id>/<slug>), so it must be a small, lowercase, no-caps token with
// no spaces or punctuation. e.g. "All Events" -> "allevents",
// "Dietary & Accessibility" -> "dietaryaccessibility". Reverse lookup resolves a
// path slug back to its exact sidebar title (the registry keys on titles).

export function tabToSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// slug -> exact title, built once from every nav destination (top-level + subs)
// plus every addon-contributed title.
//
// Addon titles are seeded from the whole INSTALLED catalog, not just the addons
// a project has enabled: slug resolution has to stay synchronous (the tab comes
// out of the path on first render), and resolving a disabled addon's URL to its
// title lets the screen host show a "turned off" state instead of a 404.
// Core titles are inserted first, so they win any slug collision.
const SLUG_TO_TAB = (() => {
  const map = new Map();
  const add = (title) => {
    if (!title) return;
    const slug = tabToSlug(title);
    if (!map.has(slug)) map.set(slug, title);
  };
  for (const item of workspaceNav) {
    add(item.title);
    for (const sub of item.subItems || []) add(sub.title);
  }
  for (const title of ADDON_TITLES) add(title);
  return map;
})();

export function slugToTab(slug) {
  if (!slug) return null;
  return SLUG_TO_TAB.get(String(slug).toLowerCase()) || null;
}
