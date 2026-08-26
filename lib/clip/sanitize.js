
const DROP_ELEMENTS = new Set([
  "script",
  "noscript",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "option",
  "meta",
  "base",
  "link",
  "template",
  "slot",
  "dialog",
]);

const REPORT_AS = {
  script: "script",
  noscript: "script",
  iframe: "embedded frame",
  frame: "embedded frame",
  object: "embedded frame",
  embed: "embedded frame",
  form: "form",
  input: "form field",
  button: "button",
  select: "form field",
  textarea: "form field",
};

const DROP_ATTR_EXACT = new Set([
  "srcdoc",
  "formaction",
  "ping",
  "integrity",
  "nonce",
  "contenteditable",
  "draggable",
  "tabindex",
  "autofocus",
]);

const EVENT_ATTR = /^on/i;
const DATA_FRAMEWORK_ATTR =
  /^(data-(reactroot|reactid|react-|v-|ng-|svelte-|astro-|turbo-|hydrate)|v-|ng-|@|:)/i;

const URL_ATTRS = ["src", "href", "poster", "action", "xlink:href", "data-src"];
const UNSAFE_URL = /^\s*(javascript|vbscript|data:text\/html|about|blob|file)/i;

function bump(counts, key) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
}

const PICKER_ATTRS = ["data-ev-hover", "data-ev-picked", "data-ev-href-stripped"];

export function sanitizeSubtree(root) {
  const counts = {};
  if (!root) return { removed: counts };

  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 1 );
  const doomed = [];
  const elements = [root];

  while (walker.nextNode()) elements.push(walker.currentNode);

  for (const el of elements) {
    const tag = el.tagName?.toLowerCase();

    if (DROP_ELEMENTS.has(tag)) {
      if (el === root) continue;
      doomed.push(el);
      bump(counts, REPORT_AS[tag]);
      continue;
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();

      if (EVENT_ATTR.test(name)) {
        el.removeAttribute(attr.name);
        bump(counts, "inline handler");
        continue;
      }
      if (
        DROP_ATTR_EXACT.has(name) ||
        DATA_FRAMEWORK_ATTR.test(name) ||
        PICKER_ATTRS.includes(name)
      ) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRS.includes(name) && UNSAFE_URL.test(attr.value || "")) {
        el.removeAttribute(attr.name);
        bump(counts, "unsafe link");
      }
    }

    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }

    if (tag === "img" || tag === "source" || tag === "video" || tag === "picture") {
      el.setAttribute("referrerpolicy", "no-referrer");
    }
  }

  for (const el of doomed) el.remove();

  if (DROP_ELEMENTS.has(root.tagName?.toLowerCase())) {
    const div = doc.createElement("div");
    for (const attr of [...root.attributes]) {
      if (attr.name.toLowerCase() === "class" || attr.name.toLowerCase() === "style") {
        div.setAttribute(attr.name, attr.value);
      }
    }
    while (root.firstChild) div.appendChild(root.firstChild);
    root.replaceWith(div);
    bump(counts, REPORT_AS[root.tagName.toLowerCase()]);
    return { removed: counts, root: div };
  }

  return { removed: counts, root };
}

const BANNED_AT_RULE = /^@(import|charset|namespace|document|page)\b/i;

export function isBannedAtRule(text) {
  return BANNED_AT_RULE.test(String(text || "").trim());
}

const BANNED_DECL = /(^|[\s;{])(position\s*:\s*fixed|behavior\s*:|expression\s*\()/i;

export function scrubDeclarations(cssText) {
  let out = String(cssText || "");
  out = out.replace(/position\s*:\s*fixed/gi, "position: absolute");
  out = out.replace(/expression\s*\([^)]*\)/gi, "");
  out = out.replace(/behavior\s*:[^;}]*/gi, "");
  out = out.replace(/-moz-binding\s*:[^;}]*/gi, "");
  return out;
}

export { BANNED_DECL };
