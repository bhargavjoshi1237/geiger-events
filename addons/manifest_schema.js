// Addon manifest contract.
//
// A manifest is METADATA ONLY — it declares what an addon contributes (nav,
// screens, permissions, a settings panel, default config) and never imports a
// screen component directly. Screens travel as `() => import(...)` thunks so a
// project that has the addon turned off pays nothing for its code.
//
// defineAddon() normalises and validates one manifest at module load, then
// freezes it. A malformed manifest throws here rather than half-rendering later.

// Accent colours are semantic token KEYS, never hex — see crafting.md. Each maps
// to tailwind utilities used at /10 background + /20 border, matching how status
// badges are rendered across the app.
export const ADDON_ACCENTS = {
  violet: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  slate: { text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

export const DEFAULT_ACCENT = "slate";

export function accentClasses(accent) {
  return ADDON_ACCENTS[accent] || ADDON_ACCENTS[DEFAULT_ACCENT];
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function fail(id, message) {
  throw new Error(`[addons] ${id ? `"${id}": ` : ""}${message}`);
}

// Normalise one screen declaration. `key` is stable and slug-safe; `title` is
// the display label that also routes (matching how core screens work). The
// derived `id` (<addonId>.<key>) is what survives a title rename.
function normalizeScreen(addonId, screen, index) {
  if (!screen || typeof screen !== "object") {
    fail(addonId, `screens[${index}] must be an object`);
  }
  const { key, title, icon, load, fullBleed } = screen;
  if (!key || !ID_PATTERN.test(key)) {
    fail(addonId, `screens[${index}].key must be kebab-case, got ${JSON.stringify(key)}`);
  }
  if (!title || typeof title !== "string") {
    fail(addonId, `screens[${index}].title is required`);
  }
  if (typeof load !== "function") {
    fail(
      addonId,
      `screens[${index}].load must be a () => import(...) thunk — a manifest must not import components directly`,
    );
  }
  return Object.freeze({
    id: `${addonId}.${key}`,
    key,
    title,
    icon: icon || null,
    load,
    fullBleed: Boolean(fullBleed),
  });
}

export function defineAddon(input) {
  if (!input || typeof input !== "object") fail(null, "defineAddon() needs an object");

  const { id } = input;
  if (!id || !ID_PATTERN.test(id)) {
    fail(null, `id must be kebab-case, got ${JSON.stringify(id)}`);
  }
  if (!input.name) fail(id, "name is required");
  if (!Array.isArray(input.screens) || input.screens.length === 0) {
    fail(id, "at least one screen is required");
  }
  if (input.accent && !ADDON_ACCENTS[input.accent]) {
    fail(id, `unknown accent "${input.accent}" — use one of ${Object.keys(ADDON_ACCENTS).join(", ")}`);
  }

  const screens = input.screens.map((s, i) => normalizeScreen(id, s, i));

  const duplicateKey = screens.find(
    (s, i) => screens.findIndex((o) => o.key === s.key) !== i,
  );
  if (duplicateKey) fail(id, `duplicate screen key "${duplicateKey.key}"`);

  // Nav is optional: an addon can contribute screens reachable only from another
  // addon's UI. When present, a multi-screen addon defaults to a collapsible
  // section listing its screens.
  let nav = null;
  if (input.nav) {
    const { title, icon, insertAfter, subItems } = input.nav;
    if (!title) fail(id, "nav.title is required when nav is declared");
    const resolvedSubItems =
      subItems ||
      (screens.length > 1
        ? screens.map((s) => ({ title: s.title, icon: s.icon || icon || null }))
        : null);
    nav = Object.freeze({
      title,
      icon: icon || null,
      insertAfter: insertAfter || null,
      subItems: resolvedSubItems ? Object.freeze(resolvedSubItems) : null,
    });
  }

  const permissions = Object.freeze(
    (input.permissions || []).map((p) => {
      if (!p?.key?.startsWith("view.") && !p?.key?.includes(".")) {
        fail(id, `permission "${p?.key}" must be dot-namespaced`);
      }
      return Object.freeze({
        key: p.key,
        label: p.label || p.key,
        group: p.group || "Workspace views",
      });
    }),
  );

  if (input.settings && typeof input.settings.load !== "function") {
    fail(id, "settings.load must be a () => import(...) thunk");
  }

  return Object.freeze({
    id,
    name: input.name,
    description: input.description || "",
    version: input.version || "1.0.0",
    category: input.category || "General",
    icon: input.icon || null,
    accent: input.accent || DEFAULT_ACCENT,
    features: Object.freeze(input.features || []),
    nav,
    screens: Object.freeze(screens),
    permissions,
    settings: input.settings ? Object.freeze({ load: input.settings.load }) : null,
    defaultConfig: Object.freeze(input.defaultConfig || {}),
  });
}
