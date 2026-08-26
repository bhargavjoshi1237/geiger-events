
import { ADDON_NAV, getAddon } from "./index";

const TRAILING_ANCHOR = "Settings";

function insertBeforeAnchor(list, item) {
  const anchor = list.findIndex((i) => i.title === TRAILING_ANCHOR);
  if (anchor === -1) list.push(item);
  else list.splice(anchor, 0, item);
}

export function mergeAddonNav(baseNav, enabledIds = [], positions = {}) {
  const enabled = new Set(enabledIds);
  const items = ADDON_NAV.filter((n) => enabled.has(n.addonId));
  if (items.length === 0) return baseNav;

  const merged = [...baseNav];

  items.forEach((item) => {
    if (!item.insertAfter) {
      insertBeforeAnchor(merged, item);
      return;
    }
    const idx = merged.findIndex((i) => i.title === item.insertAfter);
    const anchor = merged.findIndex((i) => i.title === TRAILING_ANCHOR);
    if (idx !== -1 && (anchor === -1 || idx < anchor)) {
      merged.splice(idx + 1, 0, item);
    } else {
      insertBeforeAnchor(merged, item);
    }
  });

  const pinned = items
    .filter((i) => Number.isInteger(positions[i.addonId]))
    .sort((a, b) => positions[a.addonId] - positions[b.addonId]);

  pinned.forEach((item) => {
    const from = merged.findIndex((i) => i.addonId === item.addonId);
    if (from === -1) return;
    merged.splice(from, 1);
    const target = Math.max(0, Math.min(positions[item.addonId], merged.length));
    merged.splice(target, 0, item);
  });

  return merged;
}

export function navPositionOptions(baseNav) {
  return [
    { value: "auto", label: "Auto (manifest default)" },
    ...baseNav.map((item, index) => ({
      value: String(index),
      label: `Before "${item.title}"`,
    })),
  ];
}

export function addonScreenTitles(addonId) {
  const addon = getAddon(addonId);
  return addon ? addon.screens.map((s) => s.title) : [];
}
