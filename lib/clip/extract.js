"use client";

// Turns a picked element into a self-contained clip.
//
// Runs in the parent frame against the picker iframe's live document, which is
// why it can do something a server-side HTML parser cannot: read real layout.
// `getComputedStyle` tells us what the element actually inherited from ancestors
// we are about to leave behind, and `matches()` tells us which of the page's
// thousands of CSS rules genuinely apply to the subtree.
//
// The output is scoped, not inlined. Inlining computed styles would freeze the
// clip at capture width and throw away @media, :hover and @keyframes — which is
// most of what makes a component worth clipping. Instead every surviving rule is
// rewritten under a generated scope class, and only the properties the root was
// inheriting from its old parents get flattened onto the wrapper.

import { CLIP_ASSET_PATH } from "./rewrite";
import { isBannedAtRule, sanitizeSubtree, scrubDeclarations } from "./sanitize";
import { CLIP_VERSION, newScopeId, scopeClass } from "./model";

// A clip is stored in an event's metadata bag and read on every public page
// load, so it has to stay small. Past this the extraction is still correct but
// no longer worth embedding.
const MAX_CSS_BYTES = 256 * 1024;
const MAX_HTML_BYTES = 256 * 1024;

// Pseudo-classes that describe a transient state. Stripped before testing
// whether a rule applies, kept in the emitted selector.
const STATE_PSEUDO =
  /::?(hover|focus|focus-within|focus-visible|active|visited|target|checked|disabled|enabled|placeholder-shown|autofill|before|after|first-line|first-letter|selection|placeholder|marker|backdrop|file-selector-button)\b(\([^)]*\))?/gi;

// A colour that paints nothing.
function isTransparent(value) {
  const v = String(value || "").trim().toLowerCase();
  return !v || v === "transparent" || v === "rgba(0, 0, 0, 0)" || v === "none";
}

/**
 * The nearest ancestor background the selection was sitting on.
 *
 * Backgrounds do not inherit, so a component picked out of a white section
 * arrives with no background at all and its dark text lands invisible on a dark
 * host page. Walking up for the first ancestor that actually paints something
 * and moving it onto the wrapper is what keeps a clip legible off-site.
 */
function findBackdrop(el, view) {
  let node = el;
  let depth = 0;
  while (node && depth < 12) {
    const style = view.getComputedStyle(node);
    const color = style.backgroundColor;
    const image = style.backgroundImage;
    if (!isTransparent(color) || !isTransparent(image)) {
      return {
        "background-color": isTransparent(color) ? "" : color,
        "background-image": isTransparent(image) ? "" : image,
        "background-size": isTransparent(image) ? "" : style.backgroundSize,
        "background-position": isTransparent(image) ? "" : style.backgroundPosition,
        "background-repeat": isTransparent(image) ? "" : style.backgroundRepeat,
      };
    }
    node = node.parentElement;
    depth += 1;
  }
  // Nothing opaque all the way up — the page's own canvas is the backdrop.
  return { "background-color": view.getComputedStyle(el.ownerDocument.body).backgroundColor };
}

// Properties the root inherits from ancestors that will not come along. Without
// these a clip pulled out of a styled section renders in the host page's font
// and colour instead of its own.
const INHERITED_PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-transform",
  "text-align",
  "color",
  "direction",
  "white-space",
];

// Split a selector list on top-level commas only — commas inside :is(),
// :not(), attribute values and strings are not separators.
function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let quote = "";
  let buf = "";
  for (const ch of String(list)) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// Does this selector apply to the subtree we are clipping?
function selectorApplies(selector, elements) {
  const testable = selector.replace(STATE_PSEUDO, "").trim();
  if (!testable || testable === "*") return false;
  for (const el of elements) {
    try {
      if (el.matches(testable)) return true;
    } catch {
      // Unsupported or vendor-prefixed selector — skip rather than throw away
      // the whole stylesheet.
      return false;
    }
  }
  return false;
}

// Selectors rooted at the document. Inside a clip these have to become the
// wrapper, or `body { font-family }` is silently lost.
const ROOT_SEL = /^(:root|html|body)\b/i;

function scopeSelector(selector, scope) {
  const trimmed = selector.trim();
  if (!trimmed) return null;
  if (ROOT_SEL.test(trimmed)) {
    const rest = trimmed.replace(ROOT_SEL, "").trim();
    return rest ? `.${scope} ${rest}` : `.${scope}`;
  }
  // Descendant scoping works for the root element too, because the clip's
  // markup is wrapped in the scope div rather than carrying the class itself.
  return `.${scope} ${trimmed}`;
}

// Custom properties declared on :root/html/body. The clip's own rules reference
// them by name, so they have to be re-declared on the wrapper or every
// var()-driven colour falls back to nothing. This is the token leak that bit
// brand import.
function collectRootVars(rule, into) {
  if (!ROOT_SEL.test(rule.selectorText || "")) return;
  const style = rule.style;
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    if (prop.startsWith("--")) into.set(prop, style.getPropertyValue(prop).trim());
  }
}

function declarationsOf(rule) {
  return scrubDeclarations(rule.style?.cssText || "");
}

// Walk a stylesheet, keeping only what the subtree needs. Recurses through
// @media and @supports so responsive behaviour survives.
function collectRules(rules, elements, scope, acc, depth = 0) {
  if (depth > 4) return;

  for (const rule of rules) {
    // CSSStyleRule
    if (rule.type === 1 || rule.selectorText !== undefined) {
      collectRootVars(rule, acc.vars);
      const kept = splitSelectors(rule.selectorText || "")
        .filter((sel) => selectorApplies(sel, elements))
        .map((sel) => scopeSelector(sel, scope))
        .filter(Boolean);
      if (!kept.length) continue;
      const body = declarationsOf(rule);
      if (!body.trim()) continue;
      acc.out.push(`${kept.join(", ")} { ${body} }`);
      // Remember animation names so the matching @keyframes is kept.
      const anim = /animation(?:-name)?\s*:\s*([^;]+)/gi;
      let m;
      while ((m = anim.exec(body))) {
        for (const token of m[1].split(/[\s,]+/)) {
          if (token && !/^\d/.test(token)) acc.animations.add(token.trim());
        }
      }
      continue;
    }

    const at = rule.cssText || "";
    if (isBannedAtRule(at)) continue;

    // CSSMediaRule / CSSSupportsRule / CSSContainerRule
    if (rule.cssRules && (rule.conditionText !== undefined || rule.media)) {
      const inner = { ...acc, out: [] };
      collectRules([...rule.cssRules], elements, scope, inner, depth + 1);
      if (inner.out.length) {
        const condition =
          rule.media?.mediaText || rule.conditionText || "all";
        const keyword = rule.media ? "@media" : "@supports";
        acc.out.push(`${keyword} ${condition} { ${inner.out.join("\n")} }`);
      }
      continue;
    }

    // CSSKeyframesRule — collected now, filtered by usage at the end.
    if (rule.name && rule.cssRules) {
      acc.keyframes.set(rule.name, rule.cssText);
      continue;
    }

    // CSSFontFaceRule — always kept; a clip in the wrong typeface is the most
    // visible possible failure and font-face blocks are small.
    if (/^@font-face/i.test(at)) {
      acc.out.push(scrubDeclarations(at));
    }
  }
}

// Our proxy URL carries the real address in a query param. Unwrap it so the
// stored clip points at the origin site rather than at a route that only exists
// while the picker is open.
export function unwrapProxyUrl(value) {
  const raw = String(value || "");
  const idx = raw.indexOf(`${CLIP_ASSET_PATH}?url=`);
  if (idx < 0) return raw;
  const query = raw.slice(idx + `${CLIP_ASSET_PATH}?url=`.length);
  const encoded = query.split(/["')\s]/)[0];
  try {
    return decodeURIComponent(encoded);
  } catch {
    return raw;
  }
}

function unwrapAll(text) {
  const pattern = new RegExp(
    `${CLIP_ASSET_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?url=([^"')\\s]+)`,
    "g",
  );
  return String(text).replace(pattern, (match, encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return match;
    }
  });
}

// Every remote URL the finished clip depends on, for the rehosting pass.
function collectAssetUrls(html, css) {
  const urls = new Set();
  const attr = /(?:src|href|poster)\s*=\s*"([^"]+)"/gi;
  const cssUrl = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  for (const source of [html, css]) {
    let m;
    while ((m = attr.exec(source))) if (/^https?:/i.test(m[1])) urls.add(m[1]);
    while ((m = cssUrl.exec(source))) if (/^https?:/i.test(m[1])) urls.add(m[1]);
  }
  return [...urls];
}

// A readable path to the picked element, shown in the review step so the user
// can tell two similar-looking picks apart.
export function describeElement(el) {
  if (!el) return "";
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute("class") || "")
    .split(/\s+/)
    .filter((c) => c && c.length < 24 && !/^(ev-|css-|sc-)/.test(c))
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join("");
  return `${tag}${cls}`;
}

/**
 * Extract a clip from a picked element.
 *
 * @param el   the element inside the picker iframe the user selected
 * @param meta { url, title } describing the page it came from
 * @returns    a clip object (see lib/clip/model.js), or null if nothing usable
 */
export function extractClip(el, meta = {}) {
  if (!el || !el.ownerDocument) return null;

  const doc = el.ownerDocument;
  const view = doc.defaultView;
  const scope = scopeClass(newScopeId());

  // Match against the live subtree — the clone has not been inserted, so
  // matches() on it would be unreliable for structural selectors.
  const liveElements = [el, ...el.querySelectorAll("*")];

  const acc = {
    out: [],
    vars: new Map(),
    keyframes: new Map(),
    animations: new Set(),
  };

  for (const sheet of [...doc.styleSheets]) {
    try {
      if (sheet.cssRules) collectRules([...sheet.cssRules], liveElements, scope, acc);
    } catch {
      // A sheet we cannot read (rare — everything is proxied same-origin).
      // Skipping it degrades fidelity, it does not break the clip.
    }
  }

  // Flatten what the root was inheriting from ancestors that are being left
  // behind, so the clip keeps its own typography inside our page.
  const computed = view.getComputedStyle(el);
  const inherited = INHERITED_PROPS.map((prop) => {
    const value = computed.getPropertyValue(prop);
    return value ? `${prop}: ${value};` : "";
  })
    .filter(Boolean)
    .join(" ");

  const backdrop = Object.entries(findBackdrop(el, view))
    .filter(([, value]) => value)
    .map(([prop, value]) => `${prop}: ${value};`)
    .join(" ");

  const vars = [...acc.vars.entries()]
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");

  // Keyframes only for animations something in the clip actually uses.
  const keyframes = [...acc.keyframes.entries()]
    .filter(([name]) => acc.animations.has(name))
    .map(([, text]) => text)
    .join("\n");

  // No `max-width: 100%` on media here. The renderer reproduces the clip at its
  // captured width and scales the whole thing down to fit, so images that the
  // original design deliberately lets overflow keep doing so — clamping them
  // was what cropped them into boxes.
  const wrapperRule = `.${scope} { ${vars} ${backdrop} ${inherited} box-sizing: border-box; }
.${scope} *, .${scope} *::before, .${scope} *::after { box-sizing: border-box; }`;

  // Clone, then sanitise the copy — the picker frame's own DOM is left intact
  // so the user can keep browsing and pick something else.
  const clone = el.cloneNode(true);
  const { removed, root } = sanitizeSubtree(clone);

  let html = unwrapAll((root || clone).outerHTML || "");
  let css = unwrapAll(
    [wrapperRule, keyframes, ...acc.out].filter(Boolean).join("\n"),
  );

  if (!html.trim()) return null;

  const oversize = {
    html: html.length > MAX_HTML_BYTES,
    css: css.length > MAX_CSS_BYTES,
  };
  if (oversize.css) css = css.slice(0, MAX_CSS_BYTES);

  return {
    version: CLIP_VERSION,
    html,
    css,
    scope,
    width: Math.round(el.getBoundingClientRect().width) || 0,
    removed,
    oversize: oversize.html || oversize.css ? oversize : undefined,
    assets: collectAssetUrls(html, css),
    source: {
      url: String(meta.url || ""),
      title: String(meta.title || ""),
      selector: describeElement(el),
      capturedAt: new Date().toISOString(),
    },
  };
}
