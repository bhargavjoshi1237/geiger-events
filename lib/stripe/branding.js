
import { DEFAULT_THEME } from "@/lib/events/theme";

const STRIPE_FONTS = new Set([
  "be_vietnam_pro", "bitter", "chakra_petch", "hahmlet", "inconsolata", "inter",
  "lato", "lora", "m_plus_1_code", "montserrat", "noto_sans", "noto_sans_jp",
  "noto_serif", "nunito", "open_sans", "pridi", "pt_sans", "pt_serif", "raleway",
  "roboto", "roboto_slab", "source_sans_pro", "titillium_web", "ubuntu_mono",
  "zen_maru_gothic",
]);

function exactFont(family) {
  const key = String(family || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return STRIPE_FONTS.has(key) ? key : null;
}

const FONT_BY_KEY = {
  sans: "inter",
  grotesk: "montserrat",
  poppins: "montserrat",
  playfair: "lora",
  merriweather: "pt_serif",
  mono: "inconsolata",
};

const FONT_ALIASES = [
  [/^(helvetica|arial|system|geist|dm_sans|work_sans|manrope|outfit|figtree)/, "inter"],
  [/^(poppins|futura|avenir|circular|gilroy|proxima)/, "montserrat"],
  [/^(georgia|times|garamond|didot|bodoni|canela|tiempos|cormorant|playfair)/, "lora"],
  [/^(merriweather|charter|freight|source_serif|libre_baskerville)/, "pt_serif"],
  [/^(courier|consolas|menlo|monaco|sf_mono|jetbrains|ibm_plex_mono)/, "inconsolata"],
];

function fontFamily(theme) {
  const font = theme.font || {};
  const families = [font.bodyFamily, font.headingFamily].filter(Boolean);
  for (const family of families) {
    const exact = exactFont(family);
    if (exact) return exact;
  }
  for (const family of families) {
    const key = String(family).trim().toLowerCase().replace(/[\s-]+/g, "_");
    for (const [re, stripe] of FONT_ALIASES) if (re.test(key)) return stripe;
  }
  return FONT_BY_KEY[font.body] || FONT_BY_KEY[font.heading] || null;
}

function borderStyle(theme) {
  const px = Number(theme.radiusPx ?? theme.buttonRadiusPx ?? Number.NaN);
  if (Number.isFinite(px)) {
    if (px < 3) return "rectangular";
    if (px >= 22) return "pill";
    return "rounded";
  }
  if (theme.radius === "sharp") return "rectangular";
  if (theme.radius === "pill") return "pill";
  return theme.radius === "rounded" ? "rounded" : null;
}

function hex(value) {
  const v = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
}

function imageUrl(value) {
  const v = String(value || "").trim();
  if (!/^https?:\/\//i.test(v)) return null;
  if (/\.ico(\?|#|$)/i.test(v)) return null;
  return v;
}

export function checkoutBranding(design) {
  if (!design || design.mode === "standard") return null;
  const theme = { ...DEFAULT_THEME, ...(design.theme || {}) };
  const colors = { ...DEFAULT_THEME.colors, ...(design.theme?.colors || {}) };

  const settings = {};
  const background = hex(colors.bg);
  const button = hex(colors.brand);
  const font = fontFamily(theme);
  const border = borderStyle(theme);
  const logo = imageUrl(theme.logo?.url);
  const icon = imageUrl(theme.favicon);

  if (background) settings.background_color = background;
  if (button) settings.button_color = button;
  if (font) settings.font_family = font;
  if (border) settings.border_style = border;
  if (logo) settings.logo = { type: "url", url: logo };
  if (icon) settings.icon = { type: "url", url: icon };

  return Object.keys(settings).length ? settings : null;
}
