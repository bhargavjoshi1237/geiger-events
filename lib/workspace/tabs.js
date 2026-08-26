import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { ADDON_TITLES } from "@/addons";

export function tabToSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

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
