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

// Header/hero treatment for a single event page. Drives the top of
// event_public_page.jsx (Themed mode only).
export const HERO_STYLES = [
  { key: "classic", label: "Classic" }, // cover in the main column, sidebar beside it
  { key: "banner", label: "Banner" }, // full-bleed cover with the title overlaid
  { key: "centered", label: "Centered" }, // centered title/meta above a contained cover
  { key: "minimal", label: "Minimal" }, // no cover; title + meta only
];

// Scrim painted over a cover image so overlaid text stays legible.
export const OVERLAY_STYLES = [
  { key: "none", label: "None" },
  { key: "scrim", label: "Dark scrim" },
  { key: "brand", label: "Brand tint" },
];

// Which side the registration sidebar sits on (event page).
export const SIDEBAR_SIDES = [
  { key: "right", label: "Right" },
  { key: "left", label: "Left" },
];

// Page background behind all content. `surface` keeps today's flat bg color;
// `gradient` and `image` paint over it (image value is a URL).
export const BG_TYPES = [
  { key: "surface", label: "Base" },
  { key: "gradient", label: "Gradient" },
  { key: "image", label: "Image" },
];

// Where the brand mark sits in the site header bar.
export const HEADER_ALIGNS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Centered" },
  { key: "split", label: "Split" }, // logo left, nav right
];

// Border thickness for the whole themed subtree.
export const BORDER_WIDTHS = [
  { key: 0, label: "None" },
  { key: 1, label: "Hairline" },
  { key: 2, label: "Medium" },
];

export const BUTTON_WEIGHTS = [
  { key: "", label: "Default" },
  { key: "500", label: "Medium" },
  { key: "600", label: "Semibold" },
  { key: "700", label: "Bold" },
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

// A brand mark imported from a website (or set by hand). `url` empty = no logo.
export const DEFAULT_LOGO = {
  url: "",
  height: 32,
  link: "",
  showBar: true,
  showInFooter: true,
};

export const LOGO_HEIGHTS = [
  { key: 24, label: "Small" },
  { key: 32, label: "Medium" },
  { key: 44, label: "Large" },
];

// The site header bar above the hero. Empty `links` renders the logo alone,
// which is exactly what the pre-header pages did — so this stays back-compatible.
export const DEFAULT_HEADER = {
  show: true,
  links: [], // [{ label, url }]
  cta: { label: "", url: "" },
  align: "left",
  sticky: false,
  background: "", // "" = transparent (inherits the page background)
  border: true,
};

export const DEFAULT_THEME = {
  base: "dark",
  colors: {
    brand: "#ffffff",
    brandText: "#161616",
    // Secondary brand color, link color, and the far end of a brand gradient.
    // Empty means "not set" — the renderer falls back to `brand`.
    accent: "",
    link: "",
    brandTo: "",
    ...BASE_PALETTES.dark,
  },
  // `heading`/`body` are FONT_OPTIONS keys, or "custom" — which reads the raw
  // family from headingFamily/bodyFamily and loads it from `webfonts`.
  font: {
    heading: "sans",
    body: "sans",
    scale: "md",
    headingFamily: "",
    bodyFamily: "",
    webfonts: [],
    // Self-hosted families lifted from the source's @font-face rules:
    // [{ family, src, weight, style }]. Loaded via a <style> tag on the page.
    faces: [],
  },
  logo: { ...DEFAULT_LOGO },
  // Where an imported brand came from; drives the "Re-import" affordance.
  source: { url: "", siteName: "", importedAt: "" },
  header: { ...DEFAULT_HEADER },
  headingWeight: "bold",
  headingUpper: false,
  // Typographic detail. 0/"" means "leave it to the base stylesheet".
  headingTracking: 0, // em, e.g. -0.02
  headingLineHeight: 0, // unitless, e.g. 1.1
  bodyWeight: "",
  radius: "rounded",
  // Exact corner radius in px. Set by an import; overrides the `radius` bucket.
  radiusPx: null,
  button: "solid",
  buttonRadiusPx: null,
  buttonUpper: false,
  buttonWeight: "",
  buttonTracking: 0,
  borderWidth: 1,
  elevation: "subtle",
  width: "standard",
  density: "comfortable",
  cover: "gradient",
  hero: "classic",
  coverOverlay: "none",
  sidebar: "right",
  background: { type: "surface", value: "" },
  // Brand favicon and tagline, both lifted from the source site.
  favicon: "",
  tagline: "",
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
      hero: "minimal",
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
      hero: "banner",
      coverOverlay: "scrim",
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
      hero: "centered",
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
    background: { ...base.background, ...(patch.background || {}) },
    logo: { ...base.logo, ...(patch.logo || {}) },
    source: { ...base.source, ...(patch.source || {}) },
    header: {
      ...base.header,
      ...(patch.header || {}),
      cta: { ...base.header.cta, ...(patch.header?.cta || {}) },
    },
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

export function resolveHero(theme) {
  return theme?.hero ?? "classic";
}

export function resolveSidebar(theme) {
  return theme?.sidebar ?? "right";
}

// The site header bar config, normalised. Returns null when the bar is switched
// off or has nothing to show (no logo, no links, no CTA) — the page then opens
// straight on the hero rather than on an empty rule.
export function resolveHeader(theme, hasLogo) {
  const h = { ...DEFAULT_HEADER, ...(theme?.header || {}) };
  if (h.show === false) return null;
  const links = (Array.isArray(h.links) ? h.links : []).filter(
    (l) => l && l.label,
  );
  const cta = h.cta && h.cta.label ? h.cta : null;
  if (!hasLogo && !links.length && !cta) return null;
  return {
    links,
    cta,
    align: h.align || "left",
    sticky: !!h.sticky,
    background: h.background || "",
    border: h.border !== false,
  };
}

// An explicit px override, or null when the field is unset. `null` and `""`
// both coerce to 0 through Number(), so they have to be rejected before the
// finite check — otherwise an unset override reads as a 0px (sharp) radius.
function pxOverride(value) {
  if (value === null || value === undefined || value === "") return null;
  const px = Number(value);
  if (!Number.isFinite(px) || px < 0) return null;
  return `${Math.min(px, 48)}px`;
}

// Numeric corner radius in px, falling back to the theme's bucket.
function radiusValue(theme) {
  return pxOverride(theme?.radiusPx) || pick(RADIUS_OPTIONS, theme?.radius, 1).value;
}

function buttonRadiusValue(theme) {
  return pxOverride(theme?.buttonRadiusPx) || radiusValue(theme);
}

// The brand fill for a CTA — a gradient when the source used one, else flat.
export function brandFill(theme, accent) {
  const a = accent || themeAccent(theme);
  const to = theme?.colors?.brandTo;
  if (to && to !== a.color) {
    return { backgroundImage: `linear-gradient(135deg, ${a.color}, ${to})` };
  }
  return { backgroundColor: a.color };
}

// `@font-face` CSS for self-hosted families lifted from the source site. Returns
// "" when the theme uses only built-in or Google families.
export function themeFontFaceCss(theme) {
  const faces = theme?.font?.faces;
  if (!Array.isArray(faces) || !faces.length) return "";
  const uses = [theme.font?.heading, theme.font?.body].includes("custom");
  if (!uses) return "";
  return faces
    .filter((f) => f && f.family && f.src)
    .slice(0, 6)
    .map((f) => {
      const family = String(f.family).replace(/["\\]/g, "");
      const src = String(f.src).replace(/["\\)]/g, "");
      const weight = f.weight ? `font-weight:${String(f.weight).replace(/[^\d\s]/g, "")};` : "";
      const style = f.style === "italic" ? "font-style:italic;" : "";
      return `@font-face{font-family:"${family}";src:url("${src}");${weight}${style}font-display:swap;}`;
    })
    .join("");
}

// Inline style for a page-level primary CTA, honoring the brand button style.
// Checkout/ghost buttons keep their own styling; this only re-skins the hero
// and ticket CTAs so `outline`/`soft` read as intentional brand choices.
export function themeButtonStyle(theme, accent) {
  const a = accent || themeAccent(theme);
  const style = theme?.button ?? "solid";
  const bw = Math.max(0, Number(theme?.borderWidth ?? 1)) || 0;
  // Shape and lettering are shared by all three fills — they describe the
  // brand's button, not its color treatment.
  const shape = {
    borderRadius: buttonRadiusValue(theme),
    ...(theme?.buttonUpper ? { textTransform: "uppercase" } : null),
    ...(theme?.buttonWeight ? { fontWeight: theme.buttonWeight } : null),
    ...(Number(theme?.buttonTracking)
      ? { letterSpacing: `${Number(theme.buttonTracking)}em` }
      : null),
  };
  if (style === "outline") {
    return {
      ...shape,
      backgroundColor: "transparent",
      color: a.color,
      border: `${bw || 1}px solid ${a.color}`,
    };
  }
  if (style === "soft") {
    return {
      ...shape,
      backgroundColor: `color-mix(in srgb, ${a.color} 16%, transparent)`,
      color: a.color,
      border: `${bw}px solid transparent`,
    };
  }
  return {
    ...shape,
    ...brandFill(theme, a),
    color: a.text,
    border: `${bw}px solid transparent`,
  };
}

// Overlay gradient painted over a cover image (banner hero / overlay cards).
// Returns null when no overlay is configured.
export function coverOverlayStyle(theme, accent) {
  const o = theme?.coverOverlay ?? "none";
  if (o === "scrim") {
    return {
      backgroundImage:
        "linear-gradient(to top, rgb(0 0 0 / 0.78), rgb(0 0 0 / 0.12) 55%, transparent)",
    };
  }
  if (o === "brand") {
    const a = accent || themeAccent(theme);
    return {
      backgroundImage: `linear-gradient(to top, ${a.color}d9, ${a.color}33 60%, transparent)`,
    };
  }
  return null;
}

// Extra background style merged onto the themed page wrapper. `surface` keeps
// the flat --background color; gradient/image paint over it.
export function pageBackgroundStyle(theme) {
  const bg = theme?.background;
  const c = (theme || DEFAULT_THEME).colors;
  if (!bg || bg.type === "surface") return null;
  if (bg.type === "gradient") {
    return {
      backgroundImage: `linear-gradient(160deg, ${c.brand}22 0%, ${c.bg} 55%)`,
      backgroundAttachment: "fixed",
    };
  }
  if (bg.type === "image" && bg.value) {
    return {
      backgroundImage: `linear-gradient(${c.bg}cc, ${c.bg}cc), url("${bg.value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    };
  }
  return null;
}

// Font stack for one role. "custom" quotes the imported family and keeps a
// built-in behind it, so the page still reads correctly if the webfont fails.
export function resolveFontCss(key, family) {
  if (key === "custom" && family) {
    const generic = /serif/i.test(family) ? "Georgia, serif" : "ui-sans-serif, sans-serif";
    return `"${family.replace(/"/g, "")}", ${generic}`;
  }
  return pick(FONT_OPTIONS, key, 0).css;
}

// The font picker's options, plus an "Imported" entry when a custom family is in
// play — so the user can see what's active and switch back to a built-in.
export function themeFontOptions(theme) {
  const family = theme?.font?.headingFamily || theme?.font?.bodyFamily;
  if (!family) return FONT_OPTIONS;
  return [...FONT_OPTIONS, { key: "custom", label: family, css: "" }];
}

// Google Fonts stylesheets this theme needs. React 19 hoists the <link> tags the
// page renders from these into <head>.
export function themeWebfonts(theme) {
  const list = theme?.font?.webfonts;
  if (!Array.isArray(list)) return [];
  const uses = [theme.font?.heading, theme.font?.body].includes("custom");
  return uses ? list.filter((w) => w && w.css) : [];
}

// The brand mark, or null when none is set / it's switched off for this surface.
export function resolveLogo(theme, surface = "bar") {
  const logo = theme?.logo;
  if (!logo?.url) return null;
  if (surface === "bar" && logo.showBar === false) return null;
  if (surface === "footer" && logo.showInFooter === false) return null;
  return {
    url: logo.url,
    height: Number(logo.height) || DEFAULT_LOGO.height,
    link: logo.link || "",
  };
}

// Compile a theme to the inline CSS-variable bag applied on the page wrapper.
export function themeStyle(theme) {
  const t = theme || DEFAULT_THEME;
  const c = t.colors;
  const radius = radiusValue(t);
  const scale = pick(FONT_SCALES, t.font?.scale, 1).value;
  const weight = pick(HEADING_WEIGHTS, t.headingWeight, 2).value;
  const elevation = pick(ELEVATIONS, t.elevation, 1).value;
  const sectionGap = pick(DENSITIES, t.density, 1).value;
  return {
    ...(pageBackgroundStyle(t) || {}),
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
    "--ev-font-heading": resolveFontCss(t.font?.heading, t.font?.headingFamily),
    "--ev-font-body": resolveFontCss(t.font?.body, t.font?.bodyFamily),
    "--ev-fs-base": scale,
    "--ev-heading-weight": weight,
    "--ev-heading-case": t.headingUpper ? "uppercase" : "none",
    "--ev-heading-tracking": Number(t.headingTracking)
      ? `${Number(t.headingTracking)}em`
      : "normal",
    "--ev-heading-lh": Number(t.headingLineHeight) || "inherit",
    "--ev-body-weight": t.bodyWeight || "inherit",
    "--ev-border-width": `${Math.max(0, Number(t.borderWidth ?? 1)) || 0}px`,
    "--ev-radius-button": buttonRadiusValue(t),
    "--ev-link": c.link || c.brand,
    "--ev-accent": c.accent || c.brand,
    "--ev-elevation": elevation,
    "--ev-section-gap": sectionGap,
    fontFamily: "var(--ev-font-body)",
    fontSize: "var(--ev-fs-base)",
    color: c.text,
  };
}
