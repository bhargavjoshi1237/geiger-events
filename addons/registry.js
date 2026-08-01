// Pure derivation helpers over the addon catalog. No React, no state, no I/O —
// enablement and placement come in as arguments so these stay trivially
// testable and safe to call during render.

import { ADDON_NAV, getAddon } from "./index";

// Where an addon lands when it declares no `insertAfter` and the project has set
// no explicit position: just above Settings, so addons never bury the settings
// entry at the bottom of the sidebar.
const TRAILING_ANCHOR = "Settings";

function insertBeforeAnchor(list, item) {
  const anchor = list.findIndex((i) => i.title === TRAILING_ANCHOR);
  if (anchor === -1) list.push(item);
  else list.splice(anchor, 0, item);
}

// Merge the enabled addons' nav entries into the base workspace nav.
//
// Placement, in order of precedence:
//   1. An explicit `positions[addonId]` — an index into the MERGED top-level
//      nav. This is the value the settings screen writes, and unlike flow's
//      version it is the value actually applied.
//   2. The manifest's `insertAfter` title — the entry lands directly after that
//      section, provided the section exists and sits above Settings.
//   3. Just above Settings.
export function mergeAddonNav(baseNav, enabledIds = [], positions = {}) {
  const enabled = new Set(enabledIds);
  const items = ADDON_NAV.filter((n) => enabled.has(n.addonId));
  if (items.length === 0) return baseNav;

  const merged = [...baseNav];

  // Pass 1 — manifest-relative placement for everything.
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

  // Pass 2 — apply explicit positions over the merged list, lowest first so the
  // outcome doesn't depend on catalog order.
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

// The sidebar-position options offered in Settings → Add-ons: "before <section>"
// for each core section, plus the auto default. Values are indexes into the
// merged nav, which is exactly what mergeAddonNav consumes.
export function navPositionOptions(baseNav) {
  return [
    { value: "auto", label: "Auto (manifest default)" },
    ...baseNav.map((item, index) => ({
      value: String(index),
      label: `Before "${item.title}"`,
    })),
  ];
}

// Screens an addon contributes, for the settings card's summary line.
export function addonScreenTitles(addonId) {
  const addon = getAddon(addonId);
  return addon ? addon.screens.map((s) => s.title) : [];
}
