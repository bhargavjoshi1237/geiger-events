

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

// Was an empty array, so the "Hero layout" control in Page design rendered
// nothing even though resolveHero() and every THEME_PRESETS entry already
// consume these four keys. Restored to match the recognised values.
export const HERO_STYLES = [
  { key: "classic", label: "Classic" },
  { key: "banner", label: "Banner" },
  { key: "centered", label: "Centered" },
  { key: "minimal", label: "Minimal" },
];

export const PAGE_LAYOUT_CATEGORIES = [
  {
    key: "structured",
    label: "Structured",
    desc: "Information first. Best when the page has a lot to say and people come to read it.",
  },
  {
    key: "immersive",
    label: "Immersive",
    desc: "The artwork leads. Best when you have a strong cover or a gallery worth showing.",
  },
  {
    key: "editorial",
    label: "Editorial",
    desc: "Typography leads. Best for long-form copy, or when there's no artwork at all.",
  },
  {
    key: "marketing",
    label: "Marketing",
    desc: "Persuasion in bands, with the call to action repeated. The conference microsite shape.",
  },
  {
    key: "conversion",
    label: "Conversion",
    desc: "The purchase is the page. Best when the audience already knows what the event is.",
  },
];

export const PAGE_LAYOUTS = [
  {
    key: "classic",
    label: "Classic",
    category: "structured",
    desc: "Cover and detail in a wide column, tickets in a sticky rail beside it.",
  },
  {
    key: "anchored",
    label: "Anchored nav",
    category: "structured",
    desc: "A section rail that tracks scroll on the left, content centre, tickets right.",
  },
  {
    key: "agenda",
    label: "Agenda first",
    category: "structured",
    desc: "The schedule is the spine of the page; the hero compresses to a strip above it.",
  },
  {
    key: "appshell",
    label: "App shell",
    category: "structured",
    desc: "A fixed brand rail down the left with nav and a buy button; content fills the rest.",
  },
  {
    key: "spotlight",
    label: "Spotlight",
    category: "immersive",
    desc: "Full-screen cover with the title over it. Everything else stacks below a sticky buy bar.",
  },
  {
    key: "split",
    label: "Split stage",
    category: "immersive",
    desc: "A pinned brand panel on one side, the whole page scrolling past it.",
  },
  {
    key: "glass",
    label: "Glass panel",
    category: "immersive",
    desc: "The cover stays fixed behind the page while the content floats over it in one panel.",
  },
  {
    key: "gallery",
    label: "Gallery wall",
    category: "immersive",
    desc: "Your photos are the hero — a full-width mosaic on top, everything else beneath it.",
  },
  {
    key: "marquee",
    label: "Marquee",
    category: "immersive",
    desc: "The event name scrolls edge to edge as an oversized band. Flyer energy.",
  },
  {
    key: "magazine",
    label: "Magazine",
    category: "editorial",
    desc: "One narrow reading column between full-bleed image bands. Long-form and editorial.",
  },
  {
    key: "poster",
    label: "Poster",
    category: "editorial",
    desc: "Oversized type as the hero, the facts set as a data table. Works with no cover at all.",
  },
  {
    key: "showcase",
    label: "Split hero",
    category: "editorial",
    desc: "Type on one side, the cover shaped on the other, then a wide two-column body.",
  },
  {
    key: "landing",
    label: "Landing page",
    category: "marketing",
    desc: "Full-width alternating bands with the call to action repeated down the page.",
  },
  {
    key: "zigzag",
    label: "Zigzag",
    category: "marketing",
    desc: "Sections alternate image left and image right down the page, feature-row style.",
  },
  {
    key: "bento",
    label: "Bento grid",
    category: "marketing",
    desc: "Cover, date, venue, tickets and sections as tiles in an asymmetric grid.",
  },
  {
    key: "checkout",
    label: "Registration first",
    category: "conversion",
    desc: "The ticket panel is the page; event detail compresses into a summary rail.",
  },
  {
    key: "boxoffice",
    label: "Box office",
    category: "conversion",
    desc: "Ticket tiers laid out side by side as a price comparison, the way a box office sells.",
  },
  {
    key: "stack",
    label: "Card stack",
    category: "conversion",
    desc: "One narrow column of full-width cards with a thumb-reach buy bar. Mobile-shaped.",
  },
];

export const OVERLAY_STYLES = [
  { key: "none", label: "None" },
  { key: "scrim", label: "Dark scrim" },
  { key: "brand", label: "Brand tint" },
];

export const SIDEBAR_SIDES = [
  { key: "right", label: "Right" },
  { key: "left", label: "Left" },
];

export const BG_TYPES = [
  { key: "surface", label: "Base" },
  { key: "gradient", label: "Gradient" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
];

export const BG_OVERLAYS = [
  { key: "base", label: "Page color" },
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "none", label: "None" },
];

export const HEADER_ALIGNS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Centered" },
];

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

const LEGACY_ACCENTS = {
  white: { brand: "#ffffff", brandText: "#161616" },
  violet: { brand: "#8b5cf6", brandText: "#ffffff" },
  emerald: { brand: "#10b981", brandText: "#06281d" },
  sky: { brand: "#0ea5e9", brandText: "#06212e" },
  amber: { brand: "#f59e0b", brandText: "#161616" },
  rose: { brand: "#f43f5e", brandText: "#ffffff" },
};

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


export const DEFAULT_LOGO = {
  url: "",
  height: 32,
  link: "",
  showBar: true,
  showInFooter: true,
};

export const DEFAULT_FOOTER_LOGO = {
  url: "",
  height: 32,
  link: "",
};

export const LOGO_HEIGHTS = [
  { key: 24, label: "Small" },
  { key: 32, label: "Medium" },
  { key: 44, label: "Large" },
];

export const DEFAULT_HEADER = {
  show: true,
  cta: { label: "", url: "" },
  align: "left",
  sticky: false,
  border: true,
  navUpper: false,
  navWeight: "",
};

export const DEFAULT_THEME = {
  base: "dark",
  colors: {
    brand: "#ffffff",
    brandText: "#161616",
    accent: "",
    link: "",
    brandHover: "",
    brandTo: "",
    ...BASE_PALETTES.dark,
  },
  font: {
    heading: "sans",
    body: "sans",
    scale: "md",
    headingFamily: "",
    bodyFamily: "",
    webfonts: [],
    faces: [],
  },
  logo: { ...DEFAULT_LOGO },
  footerLogo: { ...DEFAULT_FOOTER_LOGO },
  source: { url: "", siteName: "", importedAt: "" },
  header: { ...DEFAULT_HEADER },
  headingWeight: "bold",
  headingUpper: false,
  bodyWeight: "",
  radius: "rounded",
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
  layout: "classic",
  hero: "classic",
  coverOverlay: "none",
  sidebar: "right",
  background: { type: "surface", value: "", overlay: "base", dim: 80 },
  footerStyle: { background: "", text: "" },
  favicon: "",
  tagline: "",
  themeColor: "",
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


function mergeTheme(base, patch) {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    colors: { ...base.colors, ...(patch.colors || {}) },
    font: { ...base.font, ...(patch.font || {}) },
    background: { ...base.background, ...(patch.background || {}) },
    footerStyle: { ...base.footerStyle, ...(patch.footerStyle || {}) },
    logo: { ...base.logo, ...(patch.logo || {}) },
    footerLogo: { ...base.footerLogo, ...(patch.footerLogo || {}) },
    source: { ...base.source, ...(patch.source || {}) },
    header: {
      ...base.header,
      ...(patch.header || {}),
      cta: { ...base.header.cta, ...(patch.header?.cta || {}) },
    },
  };
}

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

export function themeAccent(theme) {
  const t = theme || DEFAULT_THEME;
  return { color: t.colors.brand, text: t.colors.brandText };
}

function brightness(hex) {
  const h = String(hex || "").replace("#", "");
  const n = h.length === 6 ? parseInt(h, 16) : NaN;
  if (Number.isNaN(n)) return null;
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

export function themeIsLight(theme) {
  const t = theme || DEFAULT_THEME;
  const y = brightness(t.colors?.bg);
  return y === null ? t.base === "light" : y > 140;
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

export function resolveLayout(theme) {
  const key = theme?.layout ?? "classic";
  return PAGE_LAYOUTS.some((l) => l.key === key) ? key : "classic";
}

export function resolveSidebar(theme) {
  return theme?.sidebar ?? "right";
}

function bandTokens(background, text, pageBg) {
  if (!background) return null;
  const y = brightness(background);
  if (y === null) return null;
  const yPage = brightness(pageBg);
  if (yPage !== null && Math.abs(y - yPage) < 12) return null;
  const fg = text || (y > 140 ? "#161616" : "#ffffff");
  return {
    backgroundColor: background,
    color: fg,
    "--foreground": fg,
    "--text-secondary": `color-mix(in srgb, ${fg} 72%, ${background})`,
    "--text-tertiary": `color-mix(in srgb, ${fg} 52%, ${background})`,
    "--border": `color-mix(in srgb, ${fg} 18%, ${background})`,
    "--surface-card": `color-mix(in srgb, ${background} 92%, ${fg})`,
  };
}

export function resolveHeader(theme, hasLogo) {
  const h = { ...DEFAULT_HEADER, ...(theme?.header || {}) };
  if (h.show === false) return null;
  const links = (Array.isArray(h.links) ? h.links : []).filter(
    (l) => l && l.label,
  );
  const cta = h.cta && h.cta.label ? h.cta : null;
  if (!hasLogo && !links.length && !cta) return null;
  const fill = brightness(h.background) === null ? null : h.background;
  const surface = bandTokens(h.background, "", (theme || DEFAULT_THEME).colors?.bg);
  return {
    links,
    cta,
    align: h.align || "left",
    sticky: !!h.sticky && !!fill,
    fill,
    surface,
    border: h.border !== false,
    navStyle: {
      ...(h.navUpper ? { textTransform: "uppercase" } : null),
      ...(h.navWeight ? { fontWeight: h.navWeight } : null),
      ...(Number(h.navTracking) ? { letterSpacing: `${Number(h.navTracking)}em` } : null),
      ...(Number(h.navSize) ? { fontSize: `${Number(h.navSize)}px` } : null),
    },
  };
}

export function resolveFooterSurface(theme) {
  const t = theme || DEFAULT_THEME;
  return bandTokens(t.footerStyle?.background, t.footerStyle?.text, t.colors?.bg);
}

export function ctaHoverClass(theme) {
  const t = theme || DEFAULT_THEME;
  const style = t.button ?? "solid";
  if (style !== "solid") return "ev-cta-fill";
  if (t.colors?.brandTo && t.colors.brandTo !== t.colors.brand) return "";
  return "ev-cta";
}

function pxOverride(value) {
  if (value === null || value === undefined || value === "") return null;
  const px = Number(value);
  if (!Number.isFinite(px) || px < 0) return null;
  return `${Math.min(px, 48)}px`;
}

function radiusValue(theme) {
  return pxOverride(theme?.radiusPx) || pick(RADIUS_OPTIONS, theme?.radius, 1).value;
}

function buttonRadiusValue(theme) {
  return pxOverride(theme?.buttonRadiusPx) || radiusValue(theme);
}

export function brandFill(theme, accent) {
  const a = accent || themeAccent(theme);
  const to = theme?.colors?.brandTo;
  if (to && to !== a.color) {
    return { backgroundImage: `linear-gradient(135deg, ${a.color}, ${to})` };
  }
  return { backgroundColor: a.color };
}

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

export function themeButtonStyle(theme, accent) {
  const a = accent || themeAccent(theme);
  const style = theme?.button ?? "solid";
  const bw = Math.max(0, Number(theme?.borderWidth ?? 1)) || 0;
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
    const scrim = backgroundScrim(bg, c);
    return {
      backgroundImage: scrim
        ? `linear-gradient(${scrim}, ${scrim}), url("${bg.value}")`
        : `url("${bg.value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    };
  }
  return null;
}

function backgroundScrim(bg, colors) {
  const overlay = bg.overlay || "base";
  if (overlay === "none") return null;
  const dim = Math.min(100, Math.max(0, Number(bg.dim ?? 80)));
  if (!dim) return null;
  const tint =
    overlay === "dark" ? "#000000" : overlay === "light" ? "#ffffff" : colors.bg;
  return `color-mix(in srgb, ${tint} ${dim}%, transparent)`;
}

export function pageBackgroundVideo(theme) {
  const bg = theme?.background;
  if (!bg || bg.type !== "video" || !bg.value) return null;
  return {
    url: bg.value,
    scrim: backgroundScrim(bg, (theme || DEFAULT_THEME).colors),
  };
}

export function resolveFontCss(key, family) {
  if (key === "custom" && family) {
    const generic = /serif/i.test(family) ? "Georgia, serif" : "ui-sans-serif, sans-serif";
    return `"${family.replace(/"/g, "")}", ${generic}`;
  }
  return pick(FONT_OPTIONS, key, 0).css;
}

export function themeFontOptions(theme) {
  const family = theme?.font?.headingFamily || theme?.font?.bodyFamily;
  if (!family) return FONT_OPTIONS;
  return [...FONT_OPTIONS, { key: "custom", label: family, css: "" }];
}

export function themeWebfonts(theme) {
  const list = theme?.font?.webfonts;
  if (!Array.isArray(list)) return [];
  const uses = [theme.font?.heading, theme.font?.body].includes("custom");
  return uses ? list.filter((w) => w && w.css) : [];
}

export function resolveLogo(theme, surface = "bar") {
  const logo = theme?.logo;

  if (surface === "footer") {
    const foot = theme?.footerLogo;
    if (foot?.url) {
      return {
        url: foot.url,
        height: Number(foot.height) || Number(logo?.height) || DEFAULT_LOGO.height,
        link: foot.link || "",
      };
    }
    if (logo?.showInFooter === false || !logo?.url) return null;
    return {
      url: logo.url,
      height: Number(logo.height) || DEFAULT_LOGO.height,
      link: logo.link || "",
    };
  }

  if (!logo?.url) return null;
  if (surface === "bar" && logo.showBar === false) return null;
  return {
    url: logo.url,
    height: Number(logo.height) || DEFAULT_LOGO.height,
    link: logo.link || "",
  };
}

export const VIEWER_MODES = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Follow system" },
];

export function themeForMode(theme, mode) {
  const palette = BASE_PALETTES[mode];
  if (!theme || !palette || (mode !== "light" && mode !== "dark")) return theme;
  return {
    ...theme,
    base: mode,
    colors: { ...theme.colors, ...palette },
  };
}

export function themeChromeStyle(theme) {
  const t = theme || DEFAULT_THEME;
  const c = t.colors;
  const radius = radiusValue(t);
  const scale = pick(FONT_SCALES, t.font?.scale, 1).value;
  const weight = pick(HEADING_WEIGHTS, t.headingWeight, 2).value;
  const elevation = pick(ELEVATIONS, t.elevation, 1).value;
  const sectionGap = pick(DENSITIES, t.density, 1).value;
  return {
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
    "--input": c.border,
    "--radius": radius,
    "--ring": c.brand,
    "--muted": c.surface,
    "--secondary": c.surface,
    "--secondary-foreground": c.text,
    "--accent": `color-mix(in srgb, ${c.surface} 86%, ${c.text})`,
    "--accent-foreground": c.text,
    "--destructive": themeIsLight(t) ? "#dc2626" : "#7f1d1d",
    "--destructive-foreground": "#ffffff",
    "--scrollbar-thumb": c.border,
    "--scrollbar-thumb-hover": `color-mix(in srgb, ${c.border} 60%, ${c.text})`,
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
    "--ev-brand-hover":
      c.brandHover || `color-mix(in srgb, ${c.brand} 88%, ${c.text})`,
    "--ev-elevation": elevation,
    "--ev-section-gap": sectionGap,
    fontFamily: "var(--ev-font-body)",
    fontSize: "var(--ev-fs-base)",
    color: c.text,
  };
}

export function themeStyle(theme) {
  const t = theme || DEFAULT_THEME;
  return { ...(pageBackgroundStyle(t) || {}), ...themeChromeStyle(t) };
}
