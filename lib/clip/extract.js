"use client";

import { CLIP_ASSET_PATH } from "./rewrite";
import { isBannedAtRule, sanitizeSubtree, scrubDeclarations } from "./sanitize";
import { CLIP_VERSION, newScopeId, scopeClass } from "./model";

const MAX_CSS_BYTES = 256 * 1024;
const MAX_HTML_BYTES = 256 * 1024;

const STATE_PSEUDO =
  /::?(hover|focus|focus-within|focus-visible|active|visited|target|checked|disabled|enabled|placeholder-shown|autofill|before|after|first-line|first-letter|selection|placeholder|marker|backdrop|file-selector-button)\b(\([^)]*\))?/gi;

function isTransparent(value) {
  const v = String(value || "").trim().toLowerCase();
  return !v || v === "transparent" || v === "rgba(0, 0, 0, 0)" || v === "none";
}

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
  return { "background-color": view.getComputedStyle(el.ownerDocument.body).backgroundColor };
}

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

function selectorApplies(selector, elements) {
  const testable = selector.replace(STATE_PSEUDO, "").trim();
  if (!testable || testable === "*") return false;
  for (const el of elements) {
    try {
      if (el.matches(testable)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

const ROOT_SEL = /^(:root|html|body)\b/i;

function scopeSelector(selector, scope) {
  const trimmed = selector.trim();
  if (!trimmed) return null;
  if (ROOT_SEL.test(trimmed)) {
    const rest = trimmed.replace(ROOT_SEL, "").trim();
    return rest ? `.${scope} ${rest}` : `.${scope}`;
  }
  return `.${scope} ${trimmed}`;
}

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

function collectRules(rules, elements, scope, acc, depth = 0) {
  if (depth > 4) return;

  for (const rule of rules) {
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

    if (rule.name && rule.cssRules) {
      acc.keyframes.set(rule.name, rule.cssText);
      continue;
    }

    if (/^@font-face/i.test(at)) {
      acc.out.push(scrubDeclarations(at));
    }
  }
}

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

export function extractClip(el, meta = {}) {
  if (!el || !el.ownerDocument) return null;

  const doc = el.ownerDocument;
  const view = doc.defaultView;
  const scope = scopeClass(newScopeId());

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
    }
  }

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

  const keyframes = [...acc.keyframes.entries()]
    .filter(([name]) => acc.animations.has(name))
    .map(([, text]) => text)
    .join("\n");

  const wrapperRule = `.${scope} { ${vars} ${backdrop} ${inherited} box-sizing: border-box; }
.${scope} *, .${scope} *::before, .${scope} *::after { box-sizing: border-box; }`;

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
