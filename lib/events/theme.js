// Brand theme model for the Themed page mode.
//
// A page's theme is a plain object stored under `pageDesign.theme`. It compiles
// to a set of CSS custom properties (themeStyle) applied on the public page's
// wrapper, which override the app's own semantic tokens (--background,
// --foreground, --primary, --surface-*, --border, --radius, fonts) for that
// subtree — so the existing themed markup re-skins to the brand without being
// rewritten element by element.
//
// Back-compat: pages saved before this model carried flat { accent, cover, font }
// fields; resolveTheme() maps those onto the new shape so they keep rendering.

// --- Option catalogs (drive the editor panel and the compiler) ---------------

export const FONT_OPTIONS = [
  { key: "sans", label: "Geist Sans", css: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { key: "grotesk", label: "Space Grotesk", css: "var(--font-space-grotesk), ui-sans-serif, sans-serif" },
  { key: "poppins", label: "Poppins", css: "var(--font-poppins), ui-sans-serif, sans-serif" },
  { key: "playfair", label: "Playfair Display", css: "var(--font-playfair), Georgia, serif" },
  { key: "merriweather", label: "Merriweather", css: "var(--font-merriweather), Georgia, serif" },
  { key: "mono", label: "Geist Mono", css: "var(--font-geist-mono), ui-monospace, monospace" },
];

export const FONT_SCALES = [
  { key: "sm", label: "Small", value: "15px" },
  { key: "md", label: "Medium", value: "16px" },
  { key: "lg", label: "Large", value: "18px" },
];

export const HEADING_WEIGHTS = [
  { key: "medium", label: "Medium", value: "500" },
  { key: "semibold", label: "Semibold", value: "600" },
  { key: "bold", label: "Bold", value: "700" },
  { key: "black", label: "Black", value: "800" },
];

export const RADIUS_OPTIONS = [
  { key: "sharp", label: "Sharp", value: "0px" },
  { key: "rounded", label: "Rounded", value: "0.75rem" },
  { key: "pill", label: "Pill", value: "1.5rem" },
];

export const BUTTON_STYLES = [
  { key: "solid", label: "Solid" },
  { key: "outline", label: "Outline" },
  { key: "soft", label: "Soft" },
];

export const ELEVATIONS = [
  { key: "flat", label: "Flat", value: "none" },
  { key: "subtle", label: "Subtle", value: "0 1px 2px rgb(0 0 0 / 0.25)" },
  { key: "lifted", label: "Lifted", value: "0 16px 40px rgb(0 0 0 / 0.45)" },
];

export const WIDTHS = [
  { key: "narrow", label: "Narrow", value: "48rem" },
  { key: "standard", label: "Standard", value: "72rem" },
  { key: "wide", label: "Wide", value: "88rem" },
];

export const DENSITIES = [
  { key: "compact", label: "Compact", value: "2rem" },
  { key: "comfortable", label: "Comfortable", value: "2.75rem" },
  { key: "spacious", label: "Spacious", value: "4rem" },
];

export const COVER_OPTIONS = [
  { key: "gradient", label: "Gradient" },
  { key: "solid", label: "Solid" },
  { key: "accent", label: "Accent tint" },
];

export const BASES = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
];

// Legacy flat-accent → brand color, mirroring the old ACCENTS list.
const LEGACY_ACCENTS = {
  white: { brand: "#ffffff", brandText: "#161616" },
  violet: { brand: "#8b5cf6", brandText: "#ffffff" },
  emerald: { brand: "#10b981", brandText: "#06281d" },
  sky: { brand: "#0ea5e9", brandText: "#06212e" },
  amber: { brand: "#f59e0b", brandText: "#161616" },
  rose: { brand: "#f43f5e", brandText: "#ffffff" },
};

// Sensible base palettes the editor can drop in when the dark/light base flips.
export const BASE_PALETTES = {
  dark: {
    bg: "#161616",
    surface: "#1a1a1a",
    text: "#e7e7e7",
    muted: "#a3a3a3",
    border: "#333333",
  },
  light: {
    bg: "#ffffff",
    surface: "#f7f8fa",
    text: "#171717",
    muted: "#525252",
    border: "#e5e7eb",
  },
};

// --- Default + presets -------------------------------------------------------

export const DEFAULT_THEME = {
  base: "dark",
  colors: {
    brand: "#ffffff",
    brandText: "#161616",
    ...BASE_PALETTES.dark,
  },
  font: { heading: "sans", body: "sans", scale: "md" },
  headingWeight: "bold",
  headingUpper: false,
  radius: "rounded",
  button: "solid",
  elevation: "subtle",
  width: "standard",
  density: "comfortable",
  cover: "gradient",
};

export const THEME_PRESETS = [
  {
    key: "midnight",
    label: "Midnight",
    theme: {
      base: "dark",
      colors: { brand: "#8b5cf6", brandText: "#ffffff", ...BASE_PALETTES.dark },
      font: { heading: "grotesk", body: "sans", scale: "md" },
      headingWeight: "bold",
      headingUpper: false,
      radius: "rounded",
      button: "solid",
      elevation: "lifted",
      width: "standard",
      density: "comfortable",
      cover: "accent",
    },
  },
  {
    key: "minimal",
    label: "Minimal",
    theme: {
      base: "light",
      colors: { brand: "#171717", brandText: "#ffffff", ...BASE_PALETTES.light },
      font: { heading: "sans", body: "sans", scale: "md" },
      headingWeight: "semibold",
      headingUpper: false,
      radius: "sharp",
      button: "solid",
      elevation: "flat",
      width: "narrow",
      density: "spacious",
      cover: "solid",
    },
  },
  {
    key: "bold",
    label: "Bold",
    theme: {
      base: "dark",
      colors: { brand: "#f59e0b", brandText: "#161616", ...BASE_PALETTES.dark },
      font: { heading: "grotesk", body: "grotesk", scale: "lg" },
      headingWeight: "black",
      headingUpper: true,
      radius: "pill",
      button: "solid",
      elevation: "lifted",
      width: "wide",
      density: "comfortable",
      cover: "accent",
    },
  },
  {
    key: "elegant",
    label: "Elegant",
    theme: {
      base: "light",
      colors: { brand: "#7c5b3f", brandText: "#ffffff", bg: "#faf7f2", surface: "#f3ede3", text: "#2b2520", muted: "#6b6258", border: "#e4dccf" },
      font: { heading: "playfair", body: "merriweather", scale: "md" },
      headingWeight: "bold",
      headingUpper: false,
      radius: "rounded",
      button: "outline",
      elevation: "subtle",
      width: "narrow",
      density: "spacious",
      cover: "gradient",
    },
  },
  {
    key: "playful",
    label: "Playful",
    theme: {
      base: "dark",
      colors: { brand: "#f43f5e", brandText: "#ffffff", bg: "#1a1320", surface: "#241a2c", text: "#f3e9f0", muted: "#b09bb0", border: "#3a2c42" },
      font: { heading: "poppins", body: "poppins", scale: "md" },
      headingWeight: "bold",
      headingUpper: false,
      radius: "pill",
      button: "soft",
      elevation: "lifted",
      width: "standard",
      density: "comfortable",
      cover: "accent",
    },
  },
  {
    key: "corporate",
    label: "Corporate",
    theme: {
      base: "dark",
      colors: { brand: "#0ea5e9", brandText: "#06212e", bg: "#0f1620", surface: "#16202c", text: "#e6edf3", muted: "#90a2b3", border: "#26323f" },
      font: { heading: "sans", body: "sans", scale: "md" },
      headingWeight: "semibold",
      headingUpper: false,
      radius: "rounded",
      button: "solid",
      elevation: "subtle",
      width: "standard",
      density: "comfortable",
      cover: "solid",
    },
  },
];

// --- Resolution + compilation ------------------------------------------------

function mergeTheme(base, patch) {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    colors: { ...base.colors, ...(patch.colors || {}) },
    font: { ...base.font, ...(patch.font || {}) },
  };
}

// Build the effective theme for a page-design model. Honors an explicit
// `design.theme`; otherwise falls back to the legacy flat fields, then defaults.
export function resolveTheme(design) {
  if (design && design.theme) return mergeTheme(DEFAULT_THEME, design.theme);
  const legacy = {};
  if (design?.accent && LEGACY_ACCENTS[design.accent]) {
    legacy.colors = { ...LEGACY_ACCENTS[design.accent] };
  }
  if (design?.cover) legacy.cover = design.cover;
  if (design?.font) {
    legacy.font = { heading: design.font, body: design.font, scale: "md" };
  }
  return mergeTheme(DEFAULT_THEME, legacy);
}

function pick(list, key, fallbackIndex = 0) {
  return list.find((o) => o.key === key) || list[fallbackIndex];
}

// The brand call-to-action color, shared by the page's inline accent styles.
export function themeAccent(theme) {
  const t = theme || DEFAULT_THEME;
  return { color: t.colors.brand, text: t.colors.brandText };
}

export function resolveWidth(theme) {
  return pick(WIDTHS, theme?.width, 1).value;
}

export function resolveDensity(theme) {
  return pick(DENSITIES, theme?.density, 1).value;
}

export function resolveFontCss(key) {
  return pick(FONT_OPTIONS, key, 0).css;
}

// Compile a theme to the inline CSS-variable bag applied on the page wrapper.
export function themeStyle(theme) {
  const t = theme || DEFAULT_THEME;
  const c = t.colors;
  const radius = pick(RADIUS_OPTIONS, t.radius, 1).value;
  const scale = pick(FONT_SCALES, t.font?.scale, 1).value;
  const weight = pick(HEADING_WEIGHTS, t.headingWeight, 2).value;
  const elevation = pick(ELEVATIONS, t.elevation, 1).value;
  return {
    // App semantic tokens — overridden for this subtree.
    "--background": c.bg,
    "--foreground": c.text,
    "--card": c.surface,
    "--card-foreground": c.text,
    "--popover": c.surface,
    "--popover-foreground": c.text,
    "--surface-subtle": c.surface,
    "--surface-card": `color-mix(in srgb, ${c.surface} 92%, ${c.text})`,
    "--surface-active": `color-mix(in srgb, ${c.surface} 86%, ${c.text})`,
    "--surface-hover": `color-mix(in srgb, ${c.surface} 88%, ${c.text})`,
    "--surface-dialog": c.surface,
    "--surface-strong": `color-mix(in srgb, ${c.surface} 80%, ${c.text})`,
    "--primary": c.brand,
    "--primary-foreground": c.brandText,
    "--muted-foreground": c.muted,
    "--text-secondary": c.muted,
    "--text-tertiary": `color-mix(in srgb, ${c.muted} 70%, ${c.bg})`,
    "--border": c.border,
    "--border-strong": `color-mix(in srgb, ${c.border} 60%, ${c.text})`,
    "--input": c.surface,
    "--radius": radius,
    // Theme-only tokens consumed by the .ev-themed CSS rules.
    "--ev-font-heading": resolveFontCss(t.font?.heading),
    "--ev-font-body": resolveFontCss(t.font?.body),
    "--ev-fs-base": scale,
    "--ev-heading-weight": weight,
    "--ev-heading-case": t.headingUpper ? "uppercase" : "none",
    "--ev-elevation": elevation,
    fontFamily: "var(--ev-font-body)",
    fontSize: "var(--ev-fs-base)",
    color: c.text,
  };
}
