// Turn raw brand signals (lib/brand/extract.js) into a page theme patch.
//
// Pure and dependency-free so both the API route and the import dialog can run
// it. Two jobs: assign scraped colors to theme roles, and guarantee the result
// is readable — a site whose colors we misread should still produce a legible
// page, never dark text on a dark background.

import { BASE_PALETTES, FONT_OPTIONS } from "@/lib/events/theme";

// --- Color math --------------------------------------------------------------

export function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// 0 for a pure grey, 1 for a fully saturated hue.
export function saturation(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

// Greys, including the near-blacks dark themes are built from. Relative
// saturation alone misjudges those — #1e2327 is only 9 levels wide but reads as
// 0.23 saturated — so a small absolute channel spread counts as neutral too.
function isNeutral(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  return spread <= 12 || saturation(hex) < 0.14;
}

// Hue angle in degrees, or null for a grey. Used to tell a real secondary color
// apart from a tint of the brand.
function hue(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

// Shortest angular distance between two hues (0–180). A grey is maximally far
// from everything, so it never passes for a related color.
export function hueDistance(a, b) {
  const ha = hue(a);
  const hb = hue(b);
  if (ha === null || hb === null) return 180;
  const d = Math.abs(ha - hb);
  return d > 180 ? 360 - d : d;
}

export function mix(a, b, amount) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const t = Math.max(0, Math.min(1, amount));
  const to = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${to(ra.r, rb.r)}${to(ra.g, rb.g)}${to(ra.b, rb.b)}`;
}

// Black or white — whichever is readable on top of `hex`.
export function readableOn(hex) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#161616") ? "#ffffff" : "#161616";
}

// --- Palette → theme roles ---------------------------------------------------

const BRAND_VAR = /(^|-)(brand|primary|accent|cta)(-|$)/;
const BG_VAR = /(^|-)(bg|background|page)(-|$)/;
const TEXT_VAR = /(^|-)(text|fg|foreground|copy)(-|$)/;
const BORDER_VAR = /(^|-)(border|divider|rule|stroke|outline)(-|$)/;
const SURFACE_VAR = /(^|-)(surface|card|panel|paper)(-|$)/;

/**
 * Best-scoring custom property for a role. A design system defines dozens of
 * `--bg-*` variables; taking the first match picks an arbitrary one, so score by
 * how close the name is to the bare role word and let the caller demand a
 * neutral (backgrounds, text) or a chromatic (brand) value.
 */
function fromVars(vars, pattern, { neutral = null, exact = false } = {}) {
  let best = null;
  let bestScore = -Infinity;
  for (const [name, hex] of Object.entries(vars || {})) {
    const m = name.match(pattern);
    if (!m) continue;
    if (neutral === true && !isNeutral(hex)) continue;
    if (neutral === false && isNeutral(hex)) continue;
    const core = m[2];
    // `exact` keeps only the bare role name (`--bg`, not `--bg-subtle`), for
    // roles where a wrong pick is worse than falling back to frequency.
    if (exact && name !== core) continue;
    // `--bg` beats `--bg-subtle` beats `--bg-surface-hover-2`.
    const score = name === core ? 200 : 100 - (name.length - core.length) * 8;
    if (score > bestScore) {
      bestScore = score;
      best = hex;
    }
  }
  return best;
}

/**
 * Assign scraped colors to the theme's seven roles. Named CSS variables win over
 * raw frequency; anything we can't source is derived from what we could.
 * Returns `{ base, colors }`.
 */
export function classifyPalette(extraction) {
  const vars = extraction?.cssVars || {};
  const palette = Array.isArray(extraction?.palette) ? extraction.palette : [];
  const neutrals = palette.filter((p) => isNeutral(p.hex));
  const chromatics = palette.filter((p) => !isNeutral(p.hex));

  // Background: the site's own <meta name="theme-color"> is the most direct
  // statement of what its page looks like, so it leads — but only when neutral,
  // since plenty of sites set it to their brand color instead. Then a named
  // neutral variable, then the most-used near-white or near-black.
  const metaBg =
    extraction?.themeColor && isNeutral(extraction.themeColor)
      ? extraction.themeColor
      : null;
  // Extremes first — a page background is near-white or near-black, not mid-grey.
  const extremes = neutrals.filter(
    (p) => luminance(p.hex) > 0.75 || luminance(p.hex) < 0.12,
  );
  // On a thin palette the light/dark counts land close together and picking the
  // larger is a coin flip, so a near-tie resolves to the light candidate.
  const lightest = extremes.find((p) => luminance(p.hex) > 0.75);
  const topExtreme = extremes[0];
  const tieBreak =
    lightest && topExtreme && topExtreme.count < lightest.count * 1.5
      ? lightest
      : topExtreme;
  // A bare `--bg` is authoritative; a `--bg-elevated-hover` is one cell in a
  // ramp and loses to what the stylesheet actually uses most.
  const bg =
    extraction?.pageBg ||
    metaBg ||
    fromVars(vars, BG_VAR, { neutral: true, exact: true }) ||
    tieBreak?.hex ||
    neutrals[0]?.hex ||
    fromVars(vars, BG_VAR, { neutral: true }) ||
    "#ffffff";
  const base = luminance(bg) > 0.5 ? "light" : "dark";
  const fallback = BASE_PALETTES[base];

  // Brand: a named variable, then the site's theme-color, then the color that
  // best combines "used a lot" with "actually colorful". Weighting by count
  // keeps a one-off accent from beating the real brand color.
  const ranked = chromatics
    .filter((p) => {
      const l = luminance(p.hex);
      return l > 0.03 && l < 0.9 && contrast(p.hex, bg) > 1.25;
    })
    .sort((a, b) => b.count * (0.5 + saturation(b.hex)) - a.count * (0.5 + saturation(a.hex)));
  // A named variable only wins if it actually reads as a brand color — design
  // systems carry pale `--brand-100` tints that would otherwise be picked.
  const namedBrand = fromVars(vars, BRAND_VAR, { neutral: false });
  // A brand color has to survive being a button fill: colorful, and clearly
  // separated from the page behind it.
  const strongEnough = (hex) =>
    hex && saturation(hex) >= 0.35 && contrast(hex, bg) >= 2.5;
  // A monochrome brand has no chromatic worth promoting, and picking the most
  // colorful thing in its stylesheet lands on a stray illustration or
  // customer-logo swatch. Judge the top candidate against how much the page's
  // dominant color is used: a real brand color earns a visible share of the
  // stylesheet, an incidental one does not.
  const dominant = palette[0]?.count || 0;
  const brandFloor = Math.max(3, dominant * 0.1);
  const topRanked = ranked[0] && ranked[0].count >= brandFloor ? ranked[0].hex : null;
  const brand =
    (strongEnough(namedBrand) ? namedBrand : null) ||
    (strongEnough(extraction?.themeColor) ? extraction.themeColor : null) ||
    topRanked ||
    namedBrand ||
    // Nothing chromatic earned it — the brand really is black or white.
    fallback.text;

  // Text: named variable, else the neutral that contrasts best with the page.
  const textCandidates = neutrals
    .map((p) => p.hex)
    .filter((hex) => contrast(hex, bg) >= 4.5)
    .sort((a, b) => contrast(b, bg) - contrast(a, bg));
  let text =
    extraction?.pageText ||
    fromVars(vars, TEXT_VAR, { neutral: true, exact: true }) ||
    textCandidates[0] ||
    fromVars(vars, TEXT_VAR, { neutral: true }) ||
    fallback.text;
  // Contrast fix-up — a misread pairing falls back to the base palette, and if
  // that still collides we go to the readable extreme.
  if (contrast(text, bg) < 4.5) text = fallback.text;
  if (contrast(text, bg) < 4.5) text = readableOn(bg);

  // Surface: near the background but distinguishable from it. A site that ships
  // both a light and a dark palette exposes variables for both, so a candidate
  // that doesn't sit close to *this* background is the wrong theme's value.
  const nearBg = (hex, max) => hex && contrast(hex, bg) < max;
  // Cards step *toward* the text color — lighter than a dark page, darker than a
  // light one. A surface on the wrong side reads as a hole in the page.
  const dir = luminance(text) > luminance(bg) ? 1 : -1;
  const towardText = (hex) => {
    const delta = (luminance(hex) - luminance(bg)) * dir;
    return delta > 0.004 && delta < 0.16;
  };
  const namedSurface = fromVars(vars, SURFACE_VAR, { neutral: true });
  const surface =
    (nearBg(namedSurface, 1.8) && towardText(namedSurface) ? namedSurface : null) ||
    neutrals.map((p) => p.hex).find(towardText) ||
    mix(bg, text, 0.06);

  // Borders must read as a line, not as another panel — so a border that landed
  // on the same value as the surface is derived instead.
  // A border has to be visible against the page as well as subtle — pure black
  // on a near-black background satisfies "subtle" and nothing else.
  const visibleRule = (hex) => {
    const c = contrast(hex, bg);
    return c > 1.12 && c < 3.5;
  };
  const namedBorder = fromVars(vars, BORDER_VAR, { neutral: true });
  let border =
    (namedBorder && visibleRule(namedBorder) ? namedBorder : null) ||
    neutrals.map((p) => p.hex).find((hex) => hex !== surface && visibleRule(hex)) ||
    mix(bg, text, 0.16);
  if (border === surface || border === bg || !visibleRule(border)) {
    border = mix(bg, text, 0.16);
  }

  // Muted text still has to be legible — WCAG's large-text floor.
  let muted = mix(text, bg, 0.38);
  if (contrast(muted, bg) < 3) muted = mix(text, bg, 0.2);

  // Secondary brand color: the next chromatic that is genuinely a different hue
  // from the brand. A near-duplicate is the same color in a hover state, and
  // carrying it over adds nothing but noise.
  const accent =
    ranked.find((p) => p.hex !== brand && hueDistance(p.hex, brand) > 25)?.hex || "";

  // Link color, only when the site declared one that reads on this background
  // and isn't just the brand again.
  const declaredLink = extraction?.linkColor;
  const link =
    declaredLink && contrast(declaredLink, bg) >= 3 && declaredLink !== brand
      ? declaredLink
      : "";

  return {
    base,
    colors: {
      brand,
      brandText: readableOn(brand),
      accent,
      link,
      bg,
      surface,
      text,
      muted,
      border,
    },
  };
}

// --- Fonts -------------------------------------------------------------------

// Families we can serve locally. Anything else either loads from Google Fonts
// (when the site links it) or maps to the nearest of these.
const FONT_ALIASES = [
  [/space\s*grotesk|grotesk|gt\s*walsheim|greycliff/i, "grotesk"],
  [/poppins|montserrat|nunito|raleway|quicksand|rubik|manrope|outfit/i, "poppins"],
  [/playfair|didot|bodoni|canela|tiempos|cormorant|libre\s*baskerville/i, "playfair"],
  [/merriweather|georgia|lora|pt\s*serif|source\s*serif|noto\s*serif|times|garamond|serif/i, "merriweather"],
  [/mono|courier|consolas|menlo|ibm\s*plex\s*mono|jetbrains/i, "mono"],
  [/inter|roboto|helvetica|arial|open\s*sans|lato|work\s*sans|source\s*sans|dm\s*sans|geist|system/i, "sans"],
];

// Nearest built-in key for a family name (defaults to Geist Sans).
export function nearestFontKey(family) {
  const name = String(family || "").trim();
  if (!name) return "sans";
  const exact = FONT_OPTIONS.find(
    (o) => o.label.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact.key;
  for (const [re, key] of FONT_ALIASES) if (re.test(name)) return key;
  return "sans";
}

// Resolve one role's font. Best case the site links it on Google Fonts; next
// best it self-hosts it and we can load the file straight from their server;
// failing both, fall back to the closest thing we already ship.
function resolveRole(family, webfonts, faces) {
  if (!family) return null;
  const key = family.toLowerCase();
  const hit = (webfonts || []).find((w) => w.family.toLowerCase() === key);
  if (hit) return { key: "custom", family: hit.family, webfont: hit, hosted: false };
  const face = (faces || []).find((f) => f.family.toLowerCase() === key);
  if (face) return { key: "custom", family: face.family, webfont: null, hosted: true };
  return { key: nearestFontKey(family), family, webfont: null, hosted: false };
}

/** `{ font, notes }` — notes explain any substitution to the user. */
export function buildFontPatch(extraction, current) {
  const fonts = extraction?.fonts || {};
  const webfonts = fonts.webfonts || [];
  const faces = fonts.faces || [];
  const heading = resolveRole(fonts.heading || fonts.body, webfonts, faces);
  const body = resolveRole(fonts.body || fonts.heading, webfonts, faces);
  if (!heading && !body) return null;

  const used = [heading, body]
    .filter((r) => r?.webfont)
    .reduce((acc, r) => {
      if (!acc.some((w) => w.family === r.webfont.family)) acc.push(r.webfont);
      return acc;
    }, []);

  // Ship every weight of a self-hosted family we picked, so bold headings don't
  // come back synthesised from the regular face.
  const hostedFamilies = new Set(
    [heading, body].filter((r) => r?.hosted).map((r) => r.family.toLowerCase()),
  );
  const usedFaces = faces.filter((f) =>
    hostedFamilies.has(String(f.family).toLowerCase()),
  );

  const notes = [];
  for (const role of [heading, body]) {
    if (role && role.key !== "custom" && role.family) {
      const label = FONT_OPTIONS.find((o) => o.key === role.key)?.label || role.key;
      const note = `${role.family} → ${label}`;
      if (!notes.includes(note)) notes.push(note);
    }
  }

  return {
    font: {
      ...(current || {}),
      heading: heading?.key || current?.heading || "sans",
      body: body?.key || current?.body || "sans",
      headingFamily: heading?.key === "custom" ? heading.family : "",
      bodyFamily: body?.key === "custom" ? body.family : "",
      webfonts: used,
      faces: usedFaces,
    },
    notes,
  };
}

// --- Full patch --------------------------------------------------------------

export const IMPORT_CATEGORIES = [
  "logo",
  "colors",
  "fonts",
  "shape",
  "layout",
  "header",
  "footer",
  "content",
];

const ALL_CATEGORIES = Object.fromEntries(IMPORT_CATEGORIES.map((k) => [k, true]));

/**
 * Build the patch to merge over the current theme.
 *
 * `apply` is the set of ticked categories; `logoUrl` is the already-uploaded
 * (or hotlinked) logo, since uploading happens in the browser. Returns
 * `{ patch, footer, notes }` — `footer` is separate because it lives at
 * `design.footer`, alongside the theme rather than inside it.
 */
export function buildThemePatch(extraction, options = {}) {
  const {
    apply = ALL_CATEGORIES,
    current = {},
    currentFooter = null,
    logoUrl = "",
    background = false,
  } = options;

  const patch = {};
  const notes = [];
  let footer = null;

  if (apply.colors) {
    const { base, colors } = classifyPalette(extraction);
    patch.base = base;
    patch.colors = { ...(current.colors || {}), ...colors };
    // A gradient CTA is part of the color story, not the shape one.
    const grad = extraction?.buttonGradient;
    if (grad?.from && grad?.to && grad.from !== grad.to) {
      patch.colors.brand = grad.from;
      patch.colors.brandTo = grad.to;
      patch.colors.brandText = readableOn(grad.from);
    }
  }

  if (apply.fonts) {
    const built = buildFontPatch(extraction, current.font);
    if (built) {
      patch.font = built.font;
      notes.push(...built.notes);
    }
    const type = extraction?.type || {};
    if (type.headingWeight) patch.headingWeight = type.headingWeight;
    if (type.headingUpper) patch.headingUpper = true;
    if (type.headingTracking) patch.headingTracking = type.headingTracking;
    if (type.headingLineHeight) patch.headingLineHeight = type.headingLineHeight;
    if (type.bodyWeight) patch.bodyWeight = type.bodyWeight;
    if (type.scale) {
      patch.font = { ...(patch.font || current.font || {}), scale: type.scale };
    }
  }

  if (apply.shape) {
    if (extraction?.radius) patch.radius = extraction.radius;
    if (Number.isFinite(extraction?.radiusPx)) patch.radiusPx = extraction.radiusPx;
    if (Number.isFinite(extraction?.buttonRadiusPx)) {
      patch.buttonRadiusPx = extraction.buttonRadiusPx;
    }
    if (extraction?.button) patch.button = extraction.button;
    if (extraction?.buttonUpper) patch.buttonUpper = true;
    if (extraction?.buttonWeight) patch.buttonWeight = extraction.buttonWeight;
    if (extraction?.buttonTracking) patch.buttonTracking = extraction.buttonTracking;
    if (Number.isFinite(extraction?.borderWidth)) {
      patch.borderWidth = extraction.borderWidth;
    }
    if (extraction?.elevation) patch.elevation = extraction.elevation;
    if (background && extraction?.background) {
      patch.background = { type: "image", value: extraction.background };
    }
  }

  if (apply.layout) {
    if (extraction?.width) patch.width = extraction.width;
    if (extraction?.density) patch.density = extraction.density;
    // The site paints a gradient on its own page — reproduce that rather than
    // flattening it to the base color. An explicit background image wins.
    if (!patch.background && extraction?.pageGradient) {
      patch.background = { type: "gradient", value: "" };
    }
  }

  if (apply.header) {
    const links = Array.isArray(extraction?.nav) ? extraction.nav : [];
    const cta = extraction?.cta || null;
    if (links.length || cta) {
      patch.header = {
        ...(current.header || {}),
        show: true,
        links,
        cta: cta ? { label: cta.label, url: cta.url } : { label: "", url: "" },
        // A bar with real nav reads as a site header, so it splits by default.
        align: links.length ? "split" : current.header?.align || "left",
      };
    }
  }

  if (apply.footer) {
    const f = extraction?.footer || {};
    const links = Array.isArray(f.links) ? f.links : [];
    const socials = Array.isArray(f.socials) ? f.socials : [];
    if (links.length || socials.length || f.text) {
      const base = currentFooter && typeof currentFooter === "object" ? currentFooter : {};
      footer = {
        ...base,
        showBranding: base.showBranding !== false,
        text: f.text || base.text || "",
        links,
        socials,
      };
    }
  }

  if (apply.content) {
    if (extraction?.favicon) patch.favicon = extraction.favicon;
    if (extraction?.tagline) patch.tagline = extraction.tagline;
    // The hero image is a better page background than the share card: it was
    // authored to sit behind content, and og:image usually carries text.
    if (extraction?.heroImage) {
      patch.background = { type: "image", value: extraction.heroImage };
    }
  }

  if (apply.logo && logoUrl) {
    patch.logo = {
      ...(current.logo || {}),
      url: logoUrl,
      height: current.logo?.height || 32,
      link: extraction?.site?.url || current.logo?.link || "",
      showBar: current.logo?.showBar !== false,
      showInFooter: current.logo?.showInFooter !== false,
    };
  }

  patch.source = {
    url: extraction?.site?.url || "",
    siteName: extraction?.site?.name || extraction?.site?.host || "",
    importedAt: new Date().toISOString(),
  };

  return { patch, footer, notes };
}
