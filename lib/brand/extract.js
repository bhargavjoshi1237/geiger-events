// Brand extraction — reads a public website and pulls out its brand signals
// (logo candidates, color palette, fonts, corner radius, button style).
//
// Server-only: it makes outbound fetches and returns base64 data URLs, so it must
// never be imported into a client component. Parsing is regex-based on purpose —
// the project carries no HTML parser and a brand sniff doesn't warrant adding one.
// Nothing here executes the page's JavaScript, so JS-rendered sites will yield
// little more than their icons; the caller surfaces that instead of guessing.

import {
  absoluteUrl,
  isBlockedHost,
  normalizeUrl,
} from "@/lib/net/url_safety";

const TIMEOUT_MS = 8000;
const MAX_HTML = 2 * 1024 * 1024;
const MAX_CSS = 400 * 1024;
const MAX_SHEETS = 16;
// One extra round of sheets pulled in by @import from the sheets we already read.
const MAX_IMPORTED_SHEETS = 4;
const MAX_IMAGE = 512 * 1024;
const MAX_LOGOS = 5;
// Self-hosted font files travel back base64-encoded like the logos do, so they
// get their own budget on top of the logo one. A single woff2 weight runs
// 15-60 KB, but one variable font covering every weight is routinely 300-400 KB
// (Linear ships InterVariable at 352 KB) — so the per-file cap has to clear that
// or the feature misses the modern case it exists for. The total is what keeps
// the response short of a serverless body limit; a face over budget is skipped
// and falls back to hotlinking.
const MAX_FONT = 500 * 1024;
const MAX_FONT_BYTES = 900 * 1024;
// Every logo travels back base64-encoded (~1.34x its size), and a serverless
// response has a hard body limit — five maximum-size candidates would blow past
// it and fail the whole import. Budget the set, keeping the best-scored first.
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;
const MAX_NAV_LINKS = 6;
const MAX_FOOTER_LINKS = 8;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// --- URL safety --------------------------------------------------------------

// The guards live in lib/net/url_safety.js so brand import and web clip share
// one copy. Re-exported because callers already import them from this module.
export { isBlockedHost, normalizeUrl };

const absolute = absoluteUrl;

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

const FONT_EXT_MIME = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
};

function fontExtension(url, mime) {
  const ext = (String(url || "").split("?")[0].split(".").pop() || "").toLowerCase();
  if (FONT_EXT_MIME[ext]) return ext;
  const fromMime = String(mime || "").split("/")[1]?.split(";")[0]?.trim();
  return FONT_EXT_MIME[fromMime] ? fromMime : "woff2";
}

// Pull down one self-hosted font file. Fonts are the one asset a brand import
// can't hotlink: a cross-origin @font-face needs the serving host to send
// `Access-Control-Allow-Origin`, and most sites' CDNs only allow their own
// domain — so the rule silently fails on our page and the type falls back. We
// fetch the bytes here and the browser re-hosts them alongside the logo.
async function fetchFont(url) {
  try {
    // A stylesheet can point @font-face anywhere, so re-run the SSRF host check
    // on the resolved source rather than trusting it came from the same site.
    if (!normalizeUrl(url)) return null;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    // CDNs serve fonts as everything from font/woff2 to application/octet-stream,
    // so only rule out what is definitely not a font file.
    if (/^(text|image|video|audio)\//i.test(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_FONT) return null;
    const mime = FONT_EXT_MIME[fontExtension(url, type)] || "font/woff2";
    return {
      bytes: buf.byteLength,
      mime,
      dataUrl: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
    };
  } catch {
    return null;
  }
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

// The site's own chrome. Matched loosely because every framework names these
// differently, but anchored on word boundaries so `.header-cta-icon` still
// counts as header and `.cardholder` does not count as a card.
const HEADER_SEL =
  /(^|[\s,.#>~+])(header|navbar|nav-bar|site-header|page-header|masthead|topbar|top-bar)(\W|$)/;
const FOOTER_SEL = /(^|[\s,.#>~+])(footer|site-footer|page-footer)(\W|$)/;
const CARD_SEL = /(^|[\s,.#>~+])(card|panel|tile|well)(\W|$)/;
// A nav link, either named as one or reached through the header.
const NAV_LINK_SEL = /\bnav-?link\b|\bmenu-?(item|link)\b/;

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

// --- Regions, links, socials -------------------------------------------------

// Inner HTML of the first `<tag>…</tag>` block, or "". Used to scope link
// harvesting to the site's own header and footer instead of the whole document.
function region(html, tag) {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html);
  if (!open) return "";
  const close = new RegExp(`</${tag}\\s*>`, "i");
  const rest = html.slice(open.index + open[0].length);
  const end = close.exec(rest);
  return end ? rest.slice(0, end.index) : rest.slice(0, 30000);
}

// Block-level tags a band's fill could plausibly sit on. Inline elements and
// controls are excluded so a button inside the footer can't pass for the slab.
const BAND_TAGS = /^<(div|section|nav|header|footer|aside|ul)\b/i;
// How many of those to look at. A footer is very often a bare <footer> wrapping
// one styled container, so the element's own attributes are rarely enough — but
// go much deeper and you start reading the content instead of the band.
const BAND_DEPTH = 4;

// A band's fill and text color, read from its markup rather than from a
// `header {}` / `footer {}` rule. Modern sites paint these with a utility class
// (`.bg-gray-900`) or an inline style and never write an element rule at all, so
// the element selector alone finds almost nothing. `classBg`/`classFg` are the
// single-class rules harvested while walking the stylesheets.
function bandFromMarkup(html, tag, classBg, classFg) {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html);
  if (!open) return { background: null, text: null };
  const scope = html.slice(open.index, open.index + 2000);

  let background = null;
  let text = null;
  let seen = 0;
  for (const m of scope.matchAll(/<[a-z][\w-]*\b[^>]*>/gi)) {
    if (!BAND_TAGS.test(m[0])) continue;
    if (seen++ >= BAND_DEPTH) break;
    const a = attrs(m[0]);
    const inline = a.style || "";
    background ||= firstColorIn(
      declaration(inline, "background-color") || declaration(inline, "background"),
    );
    text ||= firstColorIn(declaration(inline, "color"));
    for (const cls of String(a.class || "").toLowerCase().split(/\s+/)) {
      if (!cls) continue;
      background ||= classBg.get(cls) || null;
      text ||= classFg.get(cls) || null;
    }
    if (background && text) break;
  }
  return { background, text };
}

function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// A link label, de-duplicated. Nav anchors routinely carry the same words twice
// — a visually-hidden copy for screen readers beside the visible one — and
// flattening the tags turns that into "Sign in Sign in".
function linkLabel(html) {
  const text = stripTags(html);
  const words = text.split(" ");
  if (words.length % 2 === 0 && words.length <= 12) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(" ");
    if (a.toLowerCase() === words.slice(half).join(" ").toLowerCase()) return a;
  }
  return text;
}

// Every `<a>` in a chunk of markup as { label, url, className }. Anchors whose
// content is an image (a logo) come back with an empty label and are dropped by
// the callers — a nav link without words can't be rendered as one.
function anchors(html, base) {
  const out = [];
  for (const m of String(html || "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = attrs(`<a ${m[1]}>`);
    const url = absolute(base, a.href);
    const label = linkLabel(m[2]);
    if (!url) continue;
    out.push({ label, url, className: `${a.class || ""} ${a.id || ""}` });
  }
  return out;
}

// Social platforms keyed by the domain that identifies them. `website` and
// `email` are deliberately absent — they're catch-alls, not detections.
const SOCIAL_DOMAINS = [
  [/(^|\.)instagram\.com$/i, "instagram"],
  [/(^|\.)facebook\.com$/i, "facebook"],
  [/(^|\.)(linkedin\.com)$/i, "linkedin"],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "youtube"],
  [/(^|\.)github\.com$/i, "github"],
];

function socialPlatform(url) {
  try {
    const host = new URL(url).hostname;
    for (const [re, key] of SOCIAL_DOMAINS) if (re.test(host)) return key;
  } catch {
    /* ignore */
  }
  return null;
}

// Junk that is never a nav item worth reproducing.
const SKIP_LINK =
  /^(skip|menu|close|open|toggle|search|cart|basket|back to top|share|next|previous|\d+)$/i;
// Language switchers sit in the footer of most large sites and read as links.
// Reproducing them would put "Bahasa Indonesia" on an event page. Anchored at
// both ends (with an optional region suffix) so a real link that merely starts
// with a language name — "English lessons" — is left alone. A word boundary
// can't be used here: `\b` does not fire after a non-Latin script character.
const LOCALE_NAMES =
  "english|español|espanol|français|francais|deutsch|italiano|português|portugues|nederlands|polski|svenska|dansk|norsk|suomi|íslenska|čeština|cestina|slovenčina|magyar|română|romana|български|türkçe|turkce|ελληνικά|русский|українська|עברית|العربية|فارسی|हिन्दी|বাংলা|ไทย|ภาษาไทย|tiếng việt|bahasa indonesia|bahasa melayu|filipino|日本語|한국어|中文|简体中文|繁體中文|한국|にほんご";
const LOCALE_LINK = new RegExp(`^(?:${LOCALE_NAMES})(?:\\s*\\([^)]*\\))?$`, "i");

function navItems(html, base, limit) {
  const seen = new Set();
  const out = [];
  for (const a of anchors(html, base)) {
    const label = a.label;
    if (!label || label.length > 28 || SKIP_LINK.test(label)) continue;
    if (LOCALE_LINK.test(label)) continue;
    if (/^(mailto|tel):/i.test(a.url)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, url: a.url, className: a.className });
    if (out.length >= limit) break;
  }
  return out;
}

// A header's primary call to action — flagged by its class or by reading like
// one. Sites put their CTA last in the bar, so a later match wins a tie.
const CTA_CLASS = /\b(btn|button|cta)\b/i;
const CTA_LABEL =
  /^(sign ?up|sign ?in|log ?in|get started|book( now| a demo)?|contact( us)?|register|join( us)?|start( free)?|request a demo|try( it)? free|buy( now| tickets)?|shop( now)?|donate|subscribe|get tickets)$/i;

function pickCta(items) {
  let hit = null;
  for (const item of items) {
    if (CTA_CLASS.test(item.className) || CTA_LABEL.test(item.label)) hit = item;
  }
  return hit ? { label: hit.label, url: hit.url } : null;
}

// --- Self-hosted fonts -------------------------------------------------------

// `@font-face` families with their first usable source, resolved against the
// stylesheet they were declared in (not the page) so relative URLs hold up.
function fontFaces(css, base) {
  const out = [];
  for (const m of String(css || "").matchAll(/@font-face\s*\{([^}]{0,800})\}/gi)) {
    const body = m[1];
    const family = (declaration(body, "font-family") || "")
      .replace(/["']/g, "")
      .split(",")[0]
      .trim();
    if (!family) continue;
    const src = declaration(body, "src");
    if (!src) continue;
    // Prefer woff2, then woff — the formats every current browser reads.
    const urls = [...src.matchAll(/url\(\s*["']?([^"')]+)/gi)].map((u) => u[1]);
    const best =
      urls.find((u) => /\.woff2(\?|$)/i.test(u)) ||
      urls.find((u) => /\.woff(\?|$)/i.test(u)) ||
      urls[0];
    const url = absolute(base, best);
    if (!url) continue;
    const weight = (declaration(body, "font-weight") || "").trim();
    const style = /italic/i.test(declaration(body, "font-style") || "")
      ? "italic"
      : "normal";
    out.push({ family, src: url, weight, style });
  }
  return out;
}

// --- Shape / shadow ----------------------------------------------------------

// Classify a box-shadow declaration into the theme's three elevation steps.
// The vertical offset carries the intent: a hairline is a rule, a big soft drop
// is a lifted card.
function shadowStep(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || v === "none") return "flat";
  const offsets = [...v.matchAll(/(-?[\d.]+)px/g)].map((m) => Math.abs(Number(m[1])));
  const spread = Math.max(0, ...offsets);
  if (spread >= 16) return "lifted";
  if (spread >= 2) return "subtle";
  return "flat";
}

function widthStep(px) {
  if (!px) return null;
  if (px <= 800) return "narrow";
  if (px >= 1250) return "wide";
  return "standard";
}

function densityStep(px) {
  if (!px) return null;
  if (px <= 40) return "compact";
  if (px >= 80) return "spacious";
  return "comfortable";
}

function weightStep(value) {
  const raw = String(value || "").trim().toLowerCase();
  const n = raw === "bold" ? 700 : raw === "normal" ? 400 : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 800) return "black";
  if (n >= 700) return "bold";
  if (n >= 600) return "semibold";
  if (n >= 500) return "medium";
  return null;
}

function scaleStep(px) {
  if (!px) return null;
  if (px <= 15) return "sm";
  if (px >= 17.5) return "lg";
  return "md";
}

// Letter-spacing in em. A px value is converted against the rule's own font-size
// when there is one, else the 16px default — tracking is a ratio, not a length.
function trackingEm(value, fontSizePx) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "normal") return 0;
  const m = raw.match(/^(-?[\d.]+)(px|em|rem)?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n === 0) return 0;
  const em = m[2] === "em" || m[2] === "rem" ? n : n / (fontSizePx || 16);
  // Anything past this is a display flourish, not a brand-wide setting.
  return Math.max(-0.1, Math.min(0.3, Math.round(em * 1000) / 1000));
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

  // Stylesheets: inline <style> blocks plus the first few linked sheets. Each
  // part keeps the URL it came from, so a relative @font-face src resolves
  // against its own sheet rather than the page.
  const cssParts = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    cssParts.push({ text: m[1].slice(0, MAX_CSS), base });
  }
  const sheetUrls = [];
  const fontLinks = [];
  for (const a of tags(html, "link")) {
    const rel = (a.rel || "").toLowerCase();
    // A `preload as=style` is how most build tools ship the critical sheet, so
    // skipping it used to lose the brand on exactly the sites that have one.
    const isSheet =
      rel.includes("stylesheet") ||
      (rel.includes("preload") && (a.as || "").toLowerCase() === "style");
    if (!a.href || !isSheet) continue;
    const href = absolute(base, a.href);
    if (!href || sheetUrls.includes(href)) continue;
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
  sheets.forEach((s, i) => {
    if (s.status === "fulfilled" && s.value?.text) {
      cssParts.push({ text: s.value.text, base: s.value.finalUrl || chosen[i] });
    }
  });

  // @import chains. Google Fonts URLs become webfont candidates; anything else
  // is a real sheet worth one more round — a `main.css` that is nothing but
  // imports is a common enough shape to be worth following.
  const imported = [];
  for (const part of cssParts) {
    for (const m of part.text.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) {
      const href = absolute(part.base, m[1]);
      if (!href) continue;
      const gf = googleFamilies(href);
      if (gf.length) fontLinks.push(...gf);
      else if (!chosen.includes(href) && !imported.includes(href)) {
        imported.push(href);
      }
    }
  }
  const extra = await Promise.allSettled(
    imported.slice(0, MAX_IMPORTED_SHEETS).map((href) => fetchText(href, MAX_CSS)),
  );
  extra.forEach((s, i) => {
    if (s.status === "fulfilled" && s.value?.text) {
      cssParts.push({ text: s.value.text, base: s.value.finalUrl || imported[i] });
    }
  });

  const allCss = cssParts.map((p) => p.text).join("\n");

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
  const buttonRadii = [];
  const borderWidths = [];
  const shadows = [];
  const containerWidths = [];
  const sectionPads = [];
  let buttonStyle = null;
  let buttonGradient = null;
  let buttonUpper = false;
  let buttonWeight = null;
  let buttonTracking = 0;
  let headingWeight = null;
  let headingUpper = false;
  let headingTracking = 0;
  let headingLineHeight = 0;
  let bodyWeight = null;
  let bodySize = null;
  let linkColor = null;
  let pageGradient = null;
  let buttonHover = null;
  let cardBg = null;
  // The source's own header bar and footer slab — the two pieces of chrome that
  // most say "this is that site".
  let headerSticky = false;
  let headerBg = null;
  let navUpper = false;
  let navTracking = 0;
  let navWeight = null;
  let navSize = null;
  let footerBg = null;
  let footerFg = null;
  // Single-class rules, keyed by class name — what bandFromMarkup resolves the
  // header's and footer's own class lists against.
  const classBg = new Map();
  const classFg = new Map();
  // What the page rule itself declares. Far more reliable than frequency: `#000`
  // is all over a light site's CSS as a *text* color, not a background.
  let pageBg = null;
  let pageText = null;

  const isHeadingSelector = (s) =>
    /(^|[\s,>+~])h[12](\W|$)|\b(heading|display|hero-?title)\b/.test(s);

  eachRule(allCss, (selector, body) => {
    if (isPageSelector(selector)) {
      const bgDecl =
        declaration(body, "background-color") || declaration(body, "background");
      if (!pageBg && bgDecl) pageBg = firstColorIn(bgDecl);
      const colorDecl = declaration(body, "color");
      if (!pageText && colorDecl) pageText = firstColorIn(colorDecl);
      // A gradient painted on the page itself, kept so the import can reproduce
      // it rather than flattening the site to its base color.
      const bgImage =
        declaration(body, "background-image") || declaration(body, "background");
      if (!pageGradient && bgImage && /linear-gradient/i.test(bgImage)) {
        pageGradient = bgImage.trim().slice(0, 200);
      }
      if (!bodyWeight) bodyWeight = weightStep(declaration(body, "font-weight"));
      if (!bodySize) bodySize = toPx(declaration(body, "font-size"));
    }

    // Headings: the brand's display treatment.
    if (isHeadingSelector(selector)) {
      if (!headingWeight) headingWeight = weightStep(declaration(body, "font-weight"));
      const transform = declaration(body, "text-transform");
      if (transform && /uppercase/i.test(transform)) headingUpper = true;
      if (!headingTracking) {
        headingTracking = trackingEm(
          declaration(body, "letter-spacing"),
          toPx(declaration(body, "font-size")),
        );
      }
      if (!headingLineHeight) {
        const lh = declaration(body, "line-height");
        const n = Number(String(lh || "").trim());
        // Unitless only — a `line-height: 48px` belongs to one heading size, not
        // to every heading on the page.
        if (Number.isFinite(n) && n >= 0.8 && n <= 2) headingLineHeight = n;
      }
    }

    // Links pick up the brand's interaction color, which is often distinct from
    // the button fill.
    if (/(^|[\s,>+~])a(\W|$)/.test(selector) && !/\.btn|button/.test(selector)) {
      const c = declaration(body, "color");
      if (!linkColor && c) linkColor = firstColorIn(c);
    }

    // A bare `.thing { }` rule — the only shape that can be attributed back to a
    // class name in the markup.
    const single = selector.match(/^\.([\w-]+)$/);
    if (single) {
      const name = single[1];
      if (!classBg.has(name)) {
        const bg =
          declaration(body, "background-color") || declaration(body, "background");
        const hex = firstColorIn(bg);
        if (hex) classBg.set(name, hex);
      }
      if (!classFg.has(name)) {
        const hex = firstColorIn(declaration(body, "color"));
        if (hex) classFg.set(name, hex);
      }
    }

    // Header chrome. A site header is nearly always pinned with a solid fill;
    // reproducing both is most of what makes the bar read as theirs.
    const inHeader = HEADER_SEL.test(selector);
    if (inHeader) {
      if (!headerSticky && /sticky|fixed/i.test(declaration(body, "position") || "")) {
        headerSticky = true;
      }
      if (!headerBg) {
        const bg =
          declaration(body, "background-color") || declaration(body, "background");
        if (bg) headerBg = firstColorIn(bg);
      }
    }
    // Nav lettering — brands set their nav in small uppercase far more often
    // than they set anything else in it.
    if (
      NAV_LINK_SEL.test(selector) ||
      (inHeader && /(^|[\s>+~])a(\W|$)/.test(selector))
    ) {
      const size = toPx(declaration(body, "font-size"));
      if (/uppercase/i.test(declaration(body, "text-transform") || "")) navUpper = true;
      if (!navWeight) navWeight = weightStep(declaration(body, "font-weight"));
      if (!navTracking) {
        navTracking = trackingEm(declaration(body, "letter-spacing"), size);
      }
      if (!navSize && size && size >= 10 && size <= 22) navSize = size;
    }

    // Footer slab. A dark footer under a light page is one of the most
    // recognisable things a site does, and it is one declaration to read.
    if (FOOTER_SEL.test(selector)) {
      if (!footerBg) {
        const bg =
          declaration(body, "background-color") || declaration(body, "background");
        if (bg) footerBg = firstColorIn(bg);
      }
      if (!footerFg) {
        const col = declaration(body, "color");
        if (col) footerFg = firstColorIn(col);
      }
    }

    // Layout rhythm: the content container's width and the gap between sections.
    if (/\b(container|wrapper|content|inner|shell)\b|^main$/.test(selector)) {
      const mw = toPx(declaration(body, "max-width"));
      if (mw && mw >= 480 && mw <= 1800) containerWidths.push(mw);
    }
    if (/(^|[\s,.#])section\b|\bpy-|\bsection-/.test(selector)) {
      const pad =
        toPx(declaration(body, "padding-top")) ||
        toPx(String(declaration(body, "padding") || "").split(/\s+/)[0]);
      if (pad && pad >= 8 && pad <= 200) sectionPads.push(pad);
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
    // The real card fill, rather than one derived from the page color. Cards are
    // where a brand's second surface actually lives.
    if (!cardBg && !isButton && CARD_SEL.test(selector)) {
      const bg = declaration(body, "background-color");
      if (bg) cardBg = firstColorIn(bg);
    }
    // A button's hover fill. Inline styles can't express :hover, so the page
    // carries this as its own custom property.
    if (!buttonHover && isButton && /:hover/.test(selector)) {
      const bg =
        declaration(body, "background-color") || declaration(body, "background");
      if (bg) buttonHover = firstColorIn(bg);
    }
    const radius = declaration(body, "border-radius");
    if (radius && (isButton || /card|panel|input|modal|box/.test(selector))) {
      const px = toPx(radius.split(/\s+/)[0]);
      if (px !== null && px <= 200) {
        // A bare `button { border-radius: 0 }` is a CSS reset, not a design
        // decision — only a class-scoped rule describes the brand's button.
        if (isButton) {
          if (/[.#]/.test(selector)) buttonRadii.push(px);
        } else radii.push(px);
      }
    }

    // Border weight, read off the shorthand or the explicit width.
    const borderDecl = declaration(body, "border") || declaration(body, "border-width");
    if (borderDecl && /card|panel|input|modal|box|btn|button|table|hr/.test(selector)) {
      if (/^\s*(none|0)\b/.test(borderDecl)) borderWidths.push(0);
      else {
        const bw = toPx(borderDecl.trim().split(/\s+/)[0]);
        if (bw !== null && bw <= 6) borderWidths.push(bw);
      }
    }

    // Elevation, sampled from the surfaces a brand actually shadows.
    if (/card|panel|modal|dropdown|popover|btn|button/.test(selector)) {
      const shadow = declaration(body, "box-shadow");
      if (shadow) shadows.push(shadowStep(shadow));
    }

    if (isButton) {
      const bg = declaration(body, "background-color") || declaration(body, "background");
      const bgImage = declaration(body, "background-image") || bg;
      const border = declaration(body, "border") || declaration(body, "border-color");
      const bgColor = bg ? parseColor(bg.split(/\s+/)[0]) : null;
      if (!buttonStyle) {
        if (bgColor) buttonStyle = "solid";
        else if (border && !/none|0/.test(border)) buttonStyle = "outline";
      }
      // A gradient CTA is a brand signature a flat fill can't stand in for —
      // keep both stops so the page can rebuild it.
      if (!buttonGradient && bgImage && /linear-gradient/i.test(bgImage)) {
        const stops = [...bgImage.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)]
          .map((m) => parseColor(m[0]))
          .filter(Boolean);
        if (stops.length >= 2) buttonGradient = { from: stops[0], to: stops[stops.length - 1] };
      }
      const transform = declaration(body, "text-transform");
      if (transform && /uppercase/i.test(transform)) buttonUpper = true;
      if (!buttonWeight) buttonWeight = weightStep(declaration(body, "font-weight"));
      if (!buttonTracking) {
        buttonTracking = trackingEm(
          declaration(body, "letter-spacing"),
          toPx(declaration(body, "font-size")),
        );
      }
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

  // Self-hosted families, resolved per sheet so relative sources hold up.
  const faces = [];
  const seenFaces = new Set();
  for (const part of cssParts) {
    for (const face of fontFaces(part.text, part.base)) {
      const key = `${face.family.toLowerCase()}|${face.weight}|${face.style}`;
      if (seenFaces.has(key)) continue;
      seenFaces.add(key);
      faces.push(face);
    }
  }
  // Only the families this page's heading/body actually use — a site ships
  // @font-face for its icon set and every weight it owns.
  const wanted = new Set([headingFamily, rankedBody].filter(Boolean).map((f) => f.toLowerCase()));
  const usedFaces = faces
    .filter((f) => wanted.has(f.family.toLowerCase()))
    .filter((f) => f.style !== "italic")
    .slice(0, 4);

  const medianRadius = median(radii.length ? radii : buttonRadii);
  const radius =
    medianRadius === null
      ? null
      : medianRadius < 3
        ? "sharp"
        : medianRadius >= 22
          ? "pill"
          : "rounded";
  const medianButtonRadius = median(buttonRadii);

  // Border weight: the mode, so a single `border: 3px` accent rule can't speak
  // for the whole site.
  let borderWidth = null;
  if (borderWidths.length) {
    const tally = new Map();
    for (const w of borderWidths) tally.set(w, (tally.get(w) || 0) + 1);
    borderWidth = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Reporting 0 strips every rule and divider from the event page, so it has
    // to mean "this site draws no borders at all" — one `border: none` reset
    // outvoting a handful of real borders is not that.
    if (borderWidth === 0 && borderWidths.some((w) => w > 0)) borderWidth = 1;
  }

  // Elevation: the strongest step the site uses on its own surfaces — a brand
  // with one lifted modal and ten flat cards still reads as a flat brand, so
  // `lifted` needs more than a single sighting.
  let elevation = null;
  if (shadows.length) {
    const lifted = shadows.filter((s) => s === "lifted").length;
    const subtle = shadows.filter((s) => s === "subtle").length;
    elevation = lifted >= 2 ? "lifted" : subtle >= 1 ? "subtle" : "flat";
  }

  // --- Page chrome: header nav, footer, hero imagery -------------------------

  // What the header and footer elements themselves declare beats what a loose
  // `header`/`footer` selector match found, so it goes first.
  const headerMarkup = (() => {
    const own = bandFromMarkup(html, "header", classBg, classFg);
    return own.background ? own : bandFromMarkup(html, "nav", classBg, classFg);
  })();
  const footerMarkup = bandFromMarkup(html, "footer", classBg, classFg);
  headerBg = headerMarkup.background || headerBg;
  footerBg = footerMarkup.background || footerBg;
  footerFg = footerMarkup.text || footerFg;

  const headerHtml = region(html, "header") || region(html, "nav");
  const footerHtml = region(html, "footer");
  const headerItems = headerHtml ? navItems(headerHtml, base, MAX_NAV_LINKS + 2) : [];
  const cta = pickCta(headerItems);
  const nav = headerItems
    .filter((i) => !cta || i.url !== cta.url)
    .slice(0, MAX_NAV_LINKS)
    .map((i) => ({ label: i.label, url: i.url }));

  const footerAnchors = footerHtml ? anchors(footerHtml, base) : [];
  const socials = [];
  const seenSocial = new Set();
  for (const a of footerAnchors) {
    const platform = socialPlatform(a.url);
    if (!platform || seenSocial.has(platform)) continue;
    seenSocial.add(platform);
    socials.push({ platform, url: a.url });
  }
  const footerLinks = footerHtml
    ? navItems(footerHtml, base, MAX_FOOTER_LINKS + socials.length)
        .filter((l) => !socialPlatform(l.url))
        .slice(0, MAX_FOOTER_LINKS)
        .map((l) => ({ label: l.label, url: l.url }))
    : [];
  // The copyright line — the one piece of footer prose worth carrying over.
  const footerText = footerHtml
    ? (stripTags(footerHtml).match(/(©|\(c\)|copyright)[^.|]{0,90}/i)?.[0] || "").trim()
    : "";

  // Hero imagery: a `.hero` background, else the first sizeable image below the
  // header. Used as the page background, so a small icon is worse than nothing.
  let heroImage = null;
  eachRule(allCss, (selector, ruleBody) => {
    if (heroImage || !/\b(hero|banner|masthead|jumbotron|splash)\b/.test(selector)) return;
    const bg =
      declaration(ruleBody, "background-image") || declaration(ruleBody, "background");
    const m = bg && bg.match(/url\(\s*["']?([^"')]+)/i);
    if (m) heroImage = absolute(base, m[1]);
  });
  if (!heroImage) {
    const boundary = headerBoundary(html);
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      if (m.index < boundary) continue;
      const a = attrs(m[0]);
      const w = Number(a.width) || 0;
      const src = a.src || a["data-src"] || "";
      if (!src || (w && w < 640)) continue;
      if (LOGO_HINT.test(`${src} ${a.alt || ""} ${a.class || ""}`)) continue;
      heroImage = absolute(base, src);
      break;
    }
  }

  const faviconTag = tags(html, "link").find((a) => {
    const rel = (a.rel || "").toLowerCase();
    return a.href && (/(^|\s)icon(\s|$)/.test(rel) || rel.includes("shortcut icon"));
  });
  const favicon = absolute(base, faviconTag?.href || "/favicon.ico");
  const tagline = metaContent(metas, [
    "og:description",
    "description",
    "twitter:description",
  ]).slice(0, 180);

  // Fetch the best logo candidates as data URLs so the browser can upload one
  // without tripping over CORS.
  const candidates = logoCandidates(html, base, metas).slice(0, MAX_LOGOS);
  const fetched = await Promise.allSettled(candidates.map((c) => fetchImage(c.url)));
  const logos = [];
  let logoBytes = 0;
  fetched.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    if (logoBytes + r.value.bytes > MAX_LOGO_BYTES) return;
    logoBytes += r.value.bytes;
    logos.push({ ...r.value, kind: candidates[i].kind });
  });

  // Same trick for the self-hosted faces: fetch the bytes so the browser can
  // re-host them under our own domain. `src` keeps the source URL either way, so
  // a face we couldn't download (or couldn't store) still hotlinks as before.
  const fontData = await Promise.allSettled(usedFaces.map((f) => fetchFont(f.src)));
  let fontBytes = 0;
  const hostableFaces = usedFaces.map((face, i) => {
    const r = fontData[i];
    if (r.status !== "fulfilled" || !r.value) return face;
    if (fontBytes + r.value.bytes > MAX_FONT_BYTES) return face;
    fontBytes += r.value.bytes;
    return { ...face, ...r.value };
  });

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
    pageGradient,
    linkColor,
    buttonHover,
    cardBg,
    headerStyle: {
      sticky: headerSticky,
      background: headerBg,
      navUpper,
      navTracking,
      navWeight,
      navSize,
    },
    footerStyle: { background: footerBg, text: footerFg },
    cssVars: Object.fromEntries(vars),
    fonts: {
      heading: headingFamily,
      body: rankedBody,
      webfonts: webfonts.slice(0, 2),
      faces: hostableFaces,
    },
    type: {
      headingWeight,
      headingUpper,
      headingTracking,
      headingLineHeight,
      bodyWeight,
      scale: scaleStep(bodySize),
    },
    radius,
    radiusPx: medianRadius,
    buttonRadiusPx: medianButtonRadius,
    borderWidth,
    elevation,
    width: widthStep(median(containerWidths)),
    density: densityStep(median(sectionPads)),
    button: buttonStyle,
    buttonGradient,
    buttonUpper,
    buttonWeight,
    buttonTracking,
    nav,
    cta,
    footer: { links: footerLinks, socials, text: footerText },
    favicon,
    tagline,
    heroImage,
    background: ogImage,
  };
}
