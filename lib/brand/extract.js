// Brand extraction — reads a public website and pulls out its brand signals
// (logo candidates, color palette, fonts, corner radius, button style).
//
// Server-only: it makes outbound fetches and returns base64 data URLs, so it must
// never be imported into a client component. Parsing is regex-based on purpose —
// the project carries no HTML parser and a brand sniff doesn't warrant adding one.
// Nothing here executes the page's JavaScript, so JS-rendered sites will yield
// little more than their icons; the caller surfaces that instead of guessing.

const TIMEOUT_MS = 8000;
const MAX_HTML = 2 * 1024 * 1024;
const MAX_CSS = 400 * 1024;
const MAX_SHEETS = 10;
const MAX_IMAGE = 512 * 1024;
const MAX_LOGOS = 5;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// --- URL safety --------------------------------------------------------------

// Hostnames that must never be fetched: loopback, link-local, and RFC1918 space.
// This is a hostname/literal-IP check, not a resolved-address one — combined with
// the port allow-list below it stops the obvious SSRF shapes without a DNS hop.
const PRIVATE_V4 =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/;

export function isBlockedHost(hostname) {
  const h = (hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true; // unique-local IPv6
  if (/^fe80:/i.test(h)) return true; // link-local IPv6
  if (PRIVATE_V4.test(h)) return true;
  if (!h.includes(".") && !h.includes(":")) return true; // bare host, no TLD
  return false;
}

// Accept "example.com" as well as a full URL. Returns a URL or null.
export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

function absolute(base, href) {
  if (!href) return null;
  const v = href.trim();
  if (!v || v.startsWith("data:") || v.startsWith("javascript:")) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

// --- Fetch helpers -----------------------------------------------------------

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": UA, ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Read at most `cap` bytes of a text response. Oversized bodies are truncated,
// not rejected — the head of a stylesheet is usually where the brand lives.
async function fetchText(url, cap) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf).subarray(0, cap);
  return { text: new TextDecoder("utf-8").decode(bytes), finalUrl: res.url || url };
}

async function fetchImage(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (type && !type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE) return null;
    const mime = type || guessMime(url);
    return {
      url,
      mime,
      bytes: buf.byteLength,
      dataUrl: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
    };
  } catch {
    return null;
  }
}

function guessMime(url) {
  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "ico") return "image/x-icon";
  return "image/jpeg";
}

// --- Markup parsing ----------------------------------------------------------

const ATTR_RE = /([a-zA-Z_:-][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

// Attribute values are entity-encoded in markup — an `&amp;` left in a query
// string produces a URL that 404s, which silently loses image candidates.
function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function attrs(tag) {
  const out = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(tag))) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return (html.match(re) || []).map(attrs);
}

function metaContent(metas, keys) {
  for (const key of keys) {
    const hit = metas.find(
      (a) =>
        (a.name || "").toLowerCase() === key ||
        (a.property || "").toLowerCase() === key,
    );
    if (hit?.content) return hit.content.trim();
  }
  return "";
}

// `<meta http-equiv="refresh" content="0; url=...">` target, absolute, or null.
function metaRefreshTarget(html, base) {
  for (const a of tags(html, "meta")) {
    if ((a["http-equiv"] || "").toLowerCase() !== "refresh") continue;
    const m = (a.content || "").match(/url\s*=\s*['"]?([^'";]+)/i);
    if (m) return absolute(base, m[1].trim());
  }
  return null;
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

// --- Color parsing -----------------------------------------------------------

function expandHex(hex) {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(0, 6)}`;
  return null;
}

function rgbToHex(r, g, b) {
  const to = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function parseColor(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) return expandHex(v);
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 0.35) return null; // near-transparent
    return rgbToHex(rgb[1], rgb[2], rgb[3]);
  }
  return null;
}

// Every color mentioned in a CSS blob, ranked by how often it appears. Frequency
// is a decent proxy for "part of the brand" — one-off colors sink to the bottom.
//
// Translucent values are skipped entirely: a stylesheet is full of
// `rgba(0,0,0,.1)` shadows and scrims, and counting them makes every site look
// like its background is black.
function collectColors(css, counts) {
  const bump = (hex) => hex && counts.set(hex, (counts.get(hex) || 0) + 1);

  const hexRe = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let m;
  while ((m = hexRe.exec(css))) {
    const raw = m[0].slice(1);
    if (raw.length === 4 && parseInt(raw[3] + raw[3], 16) < 230) continue;
    if (raw.length === 8 && parseInt(raw.slice(6), 16) < 230) continue;
    bump(expandHex(m[0]));
  }

  const rgbRe = /rgba?\(([^)]{3,40})\)/g;
  while ((m = rgbRe.exec(css))) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length > 3 && Number(parts[3]) < 0.9) continue;
    bump(parseColor(m[0]));
  }
}

// Named CSS custom properties whose value is a color. These outrank raw
// frequency: a `--brand` / `--primary` variable is an explicit declaration.
function collectCssVars(css, out) {
  const re = /--([\w-]+)\s*:\s*([^;}]{1,80})/g;
  let m;
  while ((m = re.exec(css))) {
    const hex = parseColor(m[2]);
    if (hex) out.set(m[1].toLowerCase(), hex);
  }
}

// --- Font / shape parsing ----------------------------------------------------

const GENERIC_FAMILIES = new Set([
  "inherit", "initial", "unset", "revert", "sans-serif", "serif", "monospace",
  "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "ui-rounded", "-apple-system", "blinkmacsystemfont", "emoji", "math", "fangsong",
]);

// First real typeface in a font stack. System stacks lead with `-apple-system`
// and friends, so walk past the generics rather than giving up on the first one.
function firstFamily(declaration) {
  for (const part of String(declaration || "").split(",")) {
    const name = part.replace(/["']/g, "").trim();
    if (!name || GENERIC_FAMILIES.has(name.toLowerCase())) continue;
    if (name.startsWith("var(") || name.length > 48) continue;
    // Emoji and symbol fonts ride along at the end of nearly every stack.
    if (/emoji|symbol|noto color|segoe ui symbol/i.test(name)) continue;
    return name;
  }
  return null;
}

// Google Fonts families referenced by a <link> or @import URL.
function googleFamilies(href) {
  const out = [];
  try {
    const url = new URL(href);
    if (!/fonts\.googleapis\.com$/i.test(url.hostname)) return out;
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "family") continue;
      const family = value.split(":")[0].replace(/\+/g, " ").trim();
      if (family) out.push({ family, css: url.toString() });
    }
  } catch {
    /* ignore */
  }
  return out;
}

// Walk `selector { body }` rules so heading fonts, radii, and button fills can be
// attributed to what they actually style.
function eachRule(css, fn) {
  const re = /([^{}]{1,300})\{([^{}]{0,2000})\}/g;
  let m;
  while ((m = re.exec(css))) fn(m[1].trim().toLowerCase(), m[2]);
}

// True only for the page rule itself. A loose match would accept `body code`,
// whose monospace stack and grey background are not the page's.
function isPageSelector(selector) {
  return selector
    .split(",")
    .some((part) => /^(body|html|:root)(:[\w-]+)?$/.test(part.trim()));
}

function declaration(body, prop) {
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "i"));
  return m ? m[1].trim() : null;
}

// First parseable color in a declaration — `background: url(bg.png) #fff` and
// `border: 1px solid #eee` both hide the color behind other tokens.
function firstColorIn(value) {
  for (const token of String(value || "").split(/[\s,]+/)) {
    const hex = parseColor(token);
    if (hex) return hex;
  }
  const fn = String(value || "").match(/rgba?\([^)]*\)/);
  return fn ? parseColor(fn[0]) : null;
}

function toPx(value) {
  const m = String(value || "").trim().match(/^([\d.]+)(px|rem|em)?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

// Which stylesheets are worth spending the budget on. Bundlers emit one file per
// component, and `Tooltip.css` says nothing about a brand while `color.css` and
// `global.css` say everything.
function sheetPriority(href) {
  const name = href.split("/").pop() || "";
  if (/theme|color|token|variable|global|main|app|index|root|base|style/i.test(name)) {
    return 3;
  }
  if (/button|header|nav|typograph|font|link|layout/i.test(name)) return 2;
  return 1;
}

function median(list) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// --- Logo candidates ---------------------------------------------------------

const LOGO_HINT = /logo|brand|wordmark|masthead|site-?title/i;
// Customer/partner logo walls use the same words as a site's own mark, so they
// have to be scored down explicitly or they outnumber the real thing.
const THIRD_PARTY = /customer|partner|client|press|award|badge|sponsor|testimonial|logo-?(wall|cloud|grid|strip|list)|integrations?/i;

// Where the site's own header ends — a logo above this point is almost certainly
// the brand mark, one below it is page content. Clamped at both ends: a tiny
// header still gets some slack, and a page-wide <nav> can't swallow the document.
function headerBoundary(html) {
  const close = html.match(/<\/(header|nav)>/i);
  const end = close ? close.index + close[0].length : 20000;
  return Math.min(Math.max(end, 6000), 40000);
}

function logoCandidates(html, base, metas) {
  const seen = new Set();
  const out = [];
  const push = (href, kind, score) => {
    const url = absolute(base, href);
    if (!url || seen.has(url)) return;
    // Sprites and tracking pixels are never a usable logo.
    if (/sprite|placeholder|1x1|pixel|spacer/i.test(url)) return;
    seen.add(url);
    out.push({ url, kind, score });
  };

  const boundary = headerBoundary(html);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const src =
      a.src ||
      a["data-src"] ||
      a["data-lazy-src"] ||
      (a.srcset || "").split(",")[0]?.trim().split(/\s+/)[0] ||
      "";
    if (!src) continue;
    const labels = `${a.alt || ""} ${a.class || ""} ${a.id || ""}`;
    const haystack = `${src} ${labels}`;
    if (!LOGO_HINT.test(haystack)) continue;
    // Being *labelled* a logo beats merely having it in the filename, and
    // sitting in the header beats both. The floor is deliberately under the
    // apple-touch-icon's score: an <img> from the body is a weaker signal than
    // an icon the site declared for itself.
    let score = 45;
    if (/logo|wordmark/i.test(labels)) score += 15;
    if (m.index <= boundary) score += 40;
    if (THIRD_PARTY.test(haystack)) score -= 50;
    push(src, "logo", score);
  }

  for (const a of tags(html, "link")) {
    const rel = (a.rel || "").toLowerCase();
    if (!a.href) continue;
    if (rel.includes("apple-touch-icon")) push(a.href, "icon", 70);
    else if (rel.includes("mask-icon")) push(a.href, "icon", 55);
    else if (/(^|\s)icon(\s|$)|shortcut icon/.test(rel)) push(a.href, "icon", 50);
  }

  const tile = metaContent(metas, ["msapplication-tileimage"]);
  if (tile) push(tile, "icon", 45);

  const og = metaContent(metas, ["og:image", "og:image:url", "twitter:image"]);
  if (og) push(og, "social", 40);

  if (!seen.has(absolute(base, "/favicon.ico"))) push("/favicon.ico", "icon", 20);

  return out.sort((a, b) => b.score - a.score);
}

// --- Main --------------------------------------------------------------------

/**
 * Read a site and return its brand signals. Never throws — failures come back as
 * `{ error: { code, message } }` so the route can map them straight to UI copy.
 */
export async function extractBrand(input) {
  const url = normalizeUrl(input);
  if (!url) {
    return {
      error: {
        code: "bad_url",
        message: "Enter a public website address, like acme.com.",
      },
    };
  }

  let page;
  try {
    page = await fetchText(url.toString(), MAX_HTML);
    // Region gateways and vanity domains often serve a bare interstitial that
    // redirects via markup rather than a status code. Follow it once.
    const hop = page?.text ? metaRefreshTarget(page.text, page.finalUrl) : null;
    if (hop && normalizeUrl(hop)) {
      const next = await fetchText(hop, MAX_HTML);
      if (next?.text) page = next;
    }
  } catch (e) {
    const timedOut = e?.name === "AbortError";
    return {
      error: {
        code: timedOut ? "timeout" : "unreachable",
        message: timedOut
          ? "That site took too long to respond."
          : "Couldn't reach that site. Check the address and try again.",
      },
    };
  }
  if (!page?.text) {
    return {
      error: { code: "unreachable", message: "That site didn't return a page." },
    };
  }

  const html = page.text;
  const base = page.finalUrl;
  const metas = tags(html, "meta");

  // Stylesheets: inline <style> blocks plus the first few same-site links.
  const css = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    css.push(m[1].slice(0, MAX_CSS));
  }
  const sheetUrls = [];
  const fontLinks = [];
  for (const a of tags(html, "link")) {
    const rel = (a.rel || "").toLowerCase();
    if (!a.href || !rel.includes("stylesheet")) continue;
    const href = absolute(base, a.href);
    if (!href) continue;
    const gf = googleFamilies(href);
    if (gf.length) fontLinks.push(...gf);
    else sheetUrls.push(href);
  }
  const chosen = sheetUrls
    .map((href, i) => ({ href, i, score: sheetPriority(href) }))
    // Ties keep document order — the first sheets are usually the global ones.
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, MAX_SHEETS)
    .map((s) => s.href);
  const sheets = await Promise.allSettled(
    chosen.map((href) => fetchText(href, MAX_CSS)),
  );
  for (const s of sheets) {
    if (s.status === "fulfilled" && s.value?.text) css.push(s.value.text);
  }
  const allCss = css.join("\n");

  // @import'ed Google Fonts inside the CSS we did read.
  for (const m of allCss.matchAll(/@import\s+url\(\s*["']?([^"')]+)/gi)) {
    const href = absolute(base, m[1]);
    if (href) fontLinks.push(...googleFamilies(href));
  }

  // Colors: named variables first, then everything ranked by frequency.
  const counts = new Map();
  const vars = new Map();
  collectColors(allCss, counts);
  collectCssVars(allCss, vars);
  const themeColor = parseColor(metaContent(metas, ["theme-color"]));
  const palette = [...counts.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  // Fonts: rank declared families, prefer heading rules for the heading font.
  const familyCounts = new Map();
  const headingCounts = new Map();
  let bodyFamily = null;
  const radii = [];
  let buttonStyle = null;
  // What the page rule itself declares. Far more reliable than frequency: `#000`
  // is all over a light site's CSS as a *text* color, not a background.
  let pageBg = null;
  let pageText = null;

  eachRule(allCss, (selector, body) => {
    if (isPageSelector(selector)) {
      const bgDecl =
        declaration(body, "background-color") || declaration(body, "background");
      if (!pageBg && bgDecl) pageBg = firstColorIn(bgDecl);
      const colorDecl = declaration(body, "color");
      if (!pageText && colorDecl) pageText = firstColorIn(colorDecl);
    }
    const ff = declaration(body, "font-family");
    if (ff) {
      const family = firstFamily(ff);
      if (family) {
        familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
        if (/(^|[\s,>+~])h[1-3](\W|$)|heading|\btitle\b/.test(selector)) {
          headingCounts.set(family, (headingCounts.get(family) || 0) + 1);
        }
        // First wins: sheets are read global-first, and a later `body` rule is
        // usually a component override rather than the page's own typeface.
        if (!bodyFamily && isPageSelector(selector)) bodyFamily = family;
      }
    }
    const isButton = /(^|[\s,.#])(btn|button)(\W|$)|\[type=["']?submit/.test(selector);
    const radius = declaration(body, "border-radius");
    if (radius && (isButton || /card|panel|input|modal|box/.test(selector))) {
      const px = toPx(radius.split(/\s+/)[0]);
      if (px !== null && px <= 200) radii.push(px);
    }
    if (isButton && !buttonStyle) {
      const bg = declaration(body, "background-color") || declaration(body, "background");
      const border = declaration(body, "border") || declaration(body, "border-color");
      const bgColor = bg ? parseColor(bg.split(/\s+/)[0]) : null;
      if (bgColor) buttonStyle = "solid";
      else if (border && !/none|0/.test(border)) buttonStyle = "outline";
    }
  });

  const rank = (map) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family);
  const headingFamily = rank(headingCounts)[0] || null;
  const rankedBody = bodyFamily || rank(familyCounts)[0] || null;

  // A Google family we saw declared is worth loading; the rest are noise.
  const declared = new Set(
    [headingFamily, rankedBody, ...rank(familyCounts).slice(0, 4)]
      .filter(Boolean)
      .map((f) => f.toLowerCase()),
  );
  const webfonts = [];
  const seenFamilies = new Set();
  for (const f of fontLinks) {
    const key = f.family.toLowerCase();
    if (seenFamilies.has(key)) continue;
    if (declared.size && !declared.has(key)) continue;
    seenFamilies.add(key);
    webfonts.push(f);
  }
  // Nothing matched but the site clearly loads Google Fonts — keep the first two.
  if (!webfonts.length && fontLinks.length) {
    for (const f of fontLinks.slice(0, 2)) {
      if (seenFamilies.has(f.family.toLowerCase())) continue;
      seenFamilies.add(f.family.toLowerCase());
      webfonts.push(f);
    }
  }

  const medianRadius = median(radii);
  const radius =
    medianRadius === null
      ? null
      : medianRadius < 3
        ? "sharp"
        : medianRadius >= 22
          ? "pill"
          : "rounded";

  // Fetch the best logo candidates as data URLs so the browser can upload one
  // without tripping over CORS.
  const candidates = logoCandidates(html, base, metas).slice(0, MAX_LOGOS);
  const fetched = await Promise.allSettled(candidates.map((c) => fetchImage(c.url)));
  const logos = fetched
    .map((r, i) =>
      r.status === "fulfilled" && r.value
        ? { ...r.value, kind: candidates[i].kind }
        : null,
    )
    .filter(Boolean);

  const ogImage = absolute(base, metaContent(metas, ["og:image", "og:image:url"]));

  return {
    site: {
      url: base,
      host: url.hostname.replace(/^www\./, ""),
      name:
        metaContent(metas, ["og:site_name", "application-name"]) ||
        titleOf(html) ||
        url.hostname.replace(/^www\./, ""),
    },
    logos,
    palette,
    themeColor,
    pageBg,
    pageText,
    cssVars: Object.fromEntries(vars),
    fonts: {
      heading: headingFamily,
      body: rankedBody,
      webfonts: webfonts.slice(0, 2),
    },
    radius,
    button: buttonStyle,
    background: ogImage,
  };
}
