
import { absoluteUrl } from "@/lib/net/url_safety";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CLIP_PAGE_PATH = `${BASE}/api/clip/page`;
export const CLIP_ASSET_PATH = `${BASE}/api/clip/asset`;

const URL_ATTRS = ["src", "href", "poster", "data-src"];

const DROP_TAGS = /<(script|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DROP_ORPHAN_SCRIPT = /<\/?\s*(script|noscript|template)\b[^>]*>/gi;

export function assetProxyUrl(target, base) {
  if (String(target).trim().startsWith(CLIP_ASSET_PATH)) return String(target).trim();
  const abs = absoluteUrl(base, target);
  if (!abs) return null;
  return `${CLIP_ASSET_PATH}?url=${encodeURIComponent(abs)}`;
}

function rewriteSrcset(value, base) {
  return String(value)
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      const [url, ...rest] = trimmed.split(/\s+/);
      const proxied = assetProxyUrl(url, base);
      if (!proxied) return null;
      return [proxied, ...rest].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

export function rewriteCssUrls(css, base) {
  return String(css).replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, target) => {
      if (/^(data:|about:|#)/i.test(target.trim())) return match;
      const proxied = assetProxyUrl(target, base);
      return proxied ? `url(${quote}${proxied}${quote})` : match;
    },
  );
}

function rewriteCssImports(css, base) {
  return String(css).replace(
    /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?/gi,
    (match, quote, target) => {
      const proxied = assetProxyUrl(target, base);
      return proxied ? `@import url(${quote}${proxied}${quote})` : match;
    },
  );
}

export function rewriteStylesheet(css, base) {
  return rewriteCssUrls(rewriteCssImports(css, base), base);
}

function rewriteTag(tag, base) {
  const name = (tag.match(/^<\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase();
  let out = tag;

  if (name === "a") {
    out = out.replace(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/^<\s*a\b/i, '<a data-ev-href-stripped="1"');
  } else {
    for (const attr of URL_ATTRS) {
      out = out.replace(
        new RegExp(`\\s${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "gi"),
        (match, _raw, dq, sq, bare) => {
          const value = dq ?? sq ?? bare ?? "";
          if (/^(data:|about:|#)/i.test(value.trim())) return match;
          const proxied = assetProxyUrl(value, base);
          return proxied ? ` ${attr}="${proxied}"` : "";
        },
      );
    }
  }

  out = out.replace(
    /\ssrcset\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (match, _raw, dq, sq) => {
      const rewritten = rewriteSrcset(dq ?? sq ?? "", base);
      return rewritten ? ` srcset="${rewritten}"` : "";
    },
  );

  out = out.replace(
    /\sstyle\s*=\s*"([^"]*)"/gi,
    (match, css) => ` style="${rewriteCssUrls(css, base)}"`,
  );

  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  if (name === "img") {
    out = out.replace(/\sloading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/^<\s*img\b/i, '<img loading="eager"');
  }

  return out;
}

const PICKER_STYLE = `
<style data-ev-picker="1">
  html { scroll-behavior: auto !important; }
  /* Animations that start off-screen never finish without scripts, leaving
     content invisible. Force the settled state. */
  [data-aos], [data-scroll], .reveal, .fade-in, .animate-on-scroll {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
  [data-ev-hover] { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; cursor: crosshair !important; }
  [data-ev-picked] { outline: 2px solid #22c55e !important; outline-offset: -2px !important; }
</style>`;

export function rewriteDocument(html, base) {
  let out = String(html);

  out = out.replace(DROP_TAGS, "");

  out = out.replace(/<base\b[^>]*>/gi, "");

  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = (tag.match(/\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || [])
      .slice(2)
      .find(Boolean);
    const kind = String(rel || "").toLowerCase();
    if (kind.includes("stylesheet")) return rewriteTag(tag, base);
    return "";
  });

  out = out.replace(DROP_ORPHAN_SCRIPT, "");

  out = out.replace(
    /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
    (match, attrs, css) => `<style${attrs}>${rewriteStylesheet(css, base)}</style>`,
  );

  out = out.replace(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*>/g, (tag) =>
    rewriteTag(tag, base),
  );

  const head = out.search(/<\/head\s*>/i);
  if (head >= 0) {
    out = `${out.slice(0, head)}${PICKER_STYLE}${out.slice(head)}`;
  } else {
    out = PICKER_STYLE + out;
  }

  return out;
}
