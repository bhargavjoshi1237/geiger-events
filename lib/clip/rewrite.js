// Rewrites a fetched page so it can be rendered inside the clip picker.
//
// The picker needs three things a raw remote page can't give it:
//   same-origin      — so the parent frame can read contentDocument and run the
//                      element picker against a real, laid-out DOM
//   no page scripts  — the iframe is sandboxed without allow-scripts, but the
//                      tags are stripped too so nothing is left to revive
//   working assets   — every subresource URL is pointed back at our own asset
//                      proxy, because a page served from our origin can't reach
//                      the target's relative paths
//
// Regex-based, like lib/brand/extract.js: the project carries no HTML parser and
// this is a rendering aid, not a security boundary. The security boundary is the
// sandbox attribute plus the extraction-time sanitiser.

import { absoluteUrl } from "@/lib/net/url_safety";

// basePath ("/events" in production) rewrites <Link>, the router, and static
// assets — but not URLs we write into markup ourselves. These proxy URLs are
// baked into the served document and requested by the browser directly, so they
// must carry the prefix or every asset 404s in production and the picker shows
// an unstyled page. Same trap as lib/portal/portal_fetch.js.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CLIP_PAGE_PATH = `${BASE}/api/clip/page`;
export const CLIP_ASSET_PATH = `${BASE}/api/clip/asset`;

// Attributes that hold a single fetchable URL.
const URL_ATTRS = ["src", "href", "poster", "data-src"];

// Tags dropped outright — script and its friends can't run in the sandbox, but
// leaving them in means the extractor has to filter them later, and noscript
// bodies would render as visible duplicate content.
const DROP_TAGS = /<(script|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
// An unterminated <script src> is invalid but browsers accept it, so sweep for
// any tag the paired pattern missed.
const DROP_ORPHAN_SCRIPT = /<\/?\s*(script|noscript|template)\b[^>]*>/gi;

/** Absolute URL for our own asset proxy. */
export function assetProxyUrl(target, base) {
  // Already ours. Without this guard a second rewrite pass would resolve the
  // relative proxy path against the *target's* origin and proxy the proxy.
  if (String(target).trim().startsWith(CLIP_ASSET_PATH)) return String(target).trim();
  const abs = absoluteUrl(base, target);
  if (!abs) return null;
  return `${CLIP_ASSET_PATH}?url=${encodeURIComponent(abs)}`;
}

// srcset is "url 1x, url 2x" — each candidate's URL needs rewriting, the
// descriptors are left alone.
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

// url(...) inside inline style attributes and <style> bodies.
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

// @import pulls in another sheet; it has to go through the proxy too or the
// browser will try to fetch it from our origin and 404.
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

// Rewrite one tag's URL-bearing attributes. Anchors are neutralised rather than
// proxied: a click inside the picker must never navigate the frame away from
// the page being clipped.
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

  // Inline background images.
  out = out.replace(
    /\sstyle\s*=\s*"([^"]*)"/gi,
    (match, css) => ` style="${rewriteCssUrls(css, base)}"`,
  );

  // Event handlers can't fire in the sandbox, but they're noise in the DOM the
  // extractor walks, so drop them at the source.
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Lazy-loading placeholders never resolve without scripts — force eager so
  // the picker shows real images instead of empty boxes.
  if (name === "img") {
    out = out.replace(/\sloading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/^<\s*img\b/i, '<img loading="eager"');
  }

  return out;
}

// Marks the picker adds to the served document. Kept out of the extracted clip
// by the sanitiser.
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

/**
 * Turn a fetched page into the document the picker iframe loads.
 * `base` is the page's final URL after redirects — every relative path resolves
 * against it, so passing the pre-redirect URL silently breaks every asset.
 */
export function rewriteDocument(html, base) {
  let out = String(html);

  out = out.replace(DROP_TAGS, "");

  // <base href> would re-point everything at the origin site and defeat the
  // proxy. Remove it; our rewrites already resolved against the real base.
  out = out.replace(/<base\b[^>]*>/gi, "");

  // Stylesheets stay as <link> so the browser fetches them through the asset
  // proxy, which rewrites their contents. Preload/prefetch hints are dropped —
  // they fetch things nothing will use.
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = (tag.match(/\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || [])
      .slice(2)
      .find(Boolean);
    const kind = String(rel || "").toLowerCase();
    if (kind.includes("stylesheet")) return rewriteTag(tag, base);
    return "";
  });

  out = out.replace(DROP_ORPHAN_SCRIPT, "");

  // Inline <style> bodies need their url() and @import rewritten.
  out = out.replace(
    /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
    (match, attrs, css) => `<style${attrs}>${rewriteStylesheet(css, base)}</style>`,
  );

  // One pass over every opening tag. It has to be a single pass: a tag that
  // carries both a src and a style attribute would otherwise be rewritten
  // twice, and the second pass would re-proxy the proxy URL the first one wrote.
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
