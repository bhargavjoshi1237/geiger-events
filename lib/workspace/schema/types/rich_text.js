import { LIMITS } from "../../contracts.js";
import { defineType, intSetting, invalid, isBlank, pick } from "./_shared.js";

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "blockquote", "code"]);
const VOID = new Set(["br"]);
const DROP_CONTENT = /<(script|style|iframe|object|embed|template|noscript|textarea|title)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

const escapeText = (text) => text.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function safeHref(raw) {
  const decoded = raw
    .replace(/&#(x?)([0-9a-f]+);?/gi, (_, hex, code) => String.fromCharCode(parseInt(code, hex ? 16 : 10)))
    .replace(/[\u0000- ]/g, "");
  return /^(https?:|mailto:)/i.test(decoded) ? decoded : null;
}

// Allowlist sanitiser: unknown tags and every attribute except a safe link are dropped; stray brackets are escaped.
export function sanitiseHtml(html) {
  const source = String(html).replace(/<!--[\s\S]*?(-->|$)/g, "").replace(DROP_CONTENT, "");
  let out = "";
  let last = 0;
  for (const match of source.matchAll(TAG)) {
    out += escapeText(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [, closing, rawName, attrs] = match;
    const name = rawName.toLowerCase();
    if (!ALLOWED.has(name)) continue;
    if (closing) {
      if (!VOID.has(name)) out += `</${name}>`;
      continue;
    }
    if (name === "a") {
      const href = HREF.exec(attrs);
      const link = href ? safeHref(href[1] ?? href[2] ?? href[3]) : null;
      out += link ? `<a href="${escapeAttr(link)}" rel="noopener noreferrer" target="_blank">` : "<a>";
    } else out += `<${name}>`;
  }
  return out + escapeText(source.slice(last));
}

export const htmlToText = (html) => String(html)
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h2|h3|blockquote)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();

export const richText = defineType({
  type: "rich_text", label: "Rich text", group: "Text", cast: "text",
  operators: ["contains", "not_contains", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["maxChars"]);
    return { maxChars: intSetting(out.maxChars, { min: 1, max: LIMITS.longText, fallback: LIMITS.longText, label: "Character limit" }) };
  },
  normalise(value, config) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter text.");
    const html = sanitiseHtml(value).trim();
    if (!htmlToText(html)) return null;
    if (html.length > (config.maxChars ?? LIMITS.longText)) invalid("This text is too long.");
    return html;
  },
  toText: (value) => (value ? htmlToText(value) : ""),
  fromText: (text) => (text === "" ? null : `<p>${escapeText(text)}</p>`),
});
