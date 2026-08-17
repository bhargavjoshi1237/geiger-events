// Event theme → Stripe Checkout `branding_settings`.
//
// Stripe-hosted Checkout takes per-session branding, so an imported brand can
// carry through to the payment page without moving off the redirect flow. Only
// a fixed set of knobs exists — a background colour, a button colour, one font
// from Stripe's list, a corner style, and a logo/icon — so this maps our much
// richer theme down to those and drops anything that doesn't translate.
//
// Server-only (it is read by the checkout route), but pure and dependency-free
// apart from the theme model.

import { DEFAULT_THEME } from "@/lib/events/theme";

// Stripe renders one font family for the whole page, so the body font wins and
// the heading font is only a fallback. Anything not on Stripe's list maps to the
// nearest thing that is.
const STRIPE_FONTS = new Set([
  "be_vietnam_pro", "bitter", "chakra_petch", "hahmlet", "inconsolata", "inter",
  "lato", "lora", "m_plus_1_code", "montserrat", "noto_sans", "noto_sans_jp",
  "noto_serif", "nunito", "open_sans", "pridi", "pt_sans", "pt_serif", "raleway",
  "roboto", "roboto_slab", "source_sans_pro", "titillium_web", "ubuntu_mono",
  "zen_maru_gothic",
]);

// An imported family name → the Stripe font it actually is, when Stripe ships it.
function exactFont(family) {
  const key = String(family || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return STRIPE_FONTS.has(key) ? key : null;
}

// Our built-in font keys → the closest Stripe family. Poppins, Space Grotesk,
// Playfair and Merriweather aren't on Stripe's list, so each goes to the nearest
// match in the same genre rather than falling back to the default sans.
const FONT_BY_KEY = {
  sans: "inter",
  grotesk: "montserrat",
  poppins: "montserrat",
  playfair: "lora",
  merriweather: "pt_serif",
  mono: "inconsolata",
};

// Families we ship or import that Stripe also ships under a different spelling,
// plus the common substitutions. Checked before the genre fallback.
const FONT_ALIASES = [
  [/^(helvetica|arial|system|geist|dm_sans|work_sans|manrope|outfit|figtree)/, "inter"],
  [/^(poppins|futura|avenir|circular|gilroy|proxima)/, "montserrat"],
  [/^(georgia|times|garamond|didot|bodoni|canela|tiempos|cormorant|playfair)/, "lora"],
  [/^(merriweather|charter|freight|source_serif|libre_baskerville)/, "pt_serif"],
  [/^(courier|consolas|menlo|monaco|sf_mono|jetbrains|ibm_plex_mono)/, "inconsolata"],
];

function fontFamily(theme) {
  const font = theme.font || {};
  // An imported family, then the other role's, then whichever built-in is set.
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

// Stripe has three corner styles; we have a bucket and an optional exact px.
// `border_style` shapes the whole page — inputs and panels as well as the button
// — so the page radius leads and the button's is only a fallback. (A brand with
// 4px cards and a pill CTA otherwise sends Stripe the wrong signal.)
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

// Stripe takes `#rrggbb` only. Our palette is always six-digit hex, but the
// theme editor accepts hand-typed values and a malformed colour fails the whole
// session — so shorthand is expanded and anything else is dropped.
function hex(value) {
  const v = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
}

// A publicly fetchable image URL. `.ico` is excluded — favicons are routinely
// multi-resolution ICO, which Stripe won't render as an icon.
function imageUrl(value) {
  const v = String(value || "").trim();
  if (!/^https?:\/\//i.test(v)) return null;
  if (/\.ico(\?|#|$)/i.test(v)) return null;
  return v;
}

/**
 * `branding_settings` for a Checkout Session, or null when the event's page
 * isn't themed / nothing translates.
 *
 * Deliberately omits `display_name`. It overrides the business name at the top
 * of the payment page, and Stripe warns that an inconsistent name raises
 * chargeback risk and can breach card-network rules — an identity claim is a
 * different thing from a colour scheme. Every field Stripe doesn't receive falls
 * back to the account's Dashboard branding.
 */
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
