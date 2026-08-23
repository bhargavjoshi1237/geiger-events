// The hard strip.
//
// A clip lands on the public event page — the same page that runs checkout — and
// it is markup the organizer pointed at rather than markup they wrote. That is a
// different risk from lib/events/custom_code.js, where the author typed the code
// themselves and acknowledged a warning. So there is no override here: scripts,
// handlers, embedded frames, and forms come out, always.
//
// What survives is everything that makes a component look alive without
// executing anything — CSS transitions, @keyframes, :hover, gradients, images.
//
// Operates on live DOM nodes (a cloned subtree), not on a string. Parsing HTML
// with regex is fine for rewriting a page we are about to throw away; it is not
// fine for a security boundary.

// Elements removed outright, with their subtrees.
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

// Reported to the user by name, so the summary reads in plain language.
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

// Attributes stripped from every surviving element.
const DROP_ATTR_EXACT = new Set([
  "id", // ids collide with the host page
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

// The picker's own outline markers must not travel into the clip.
const PICKER_ATTRS = ["data-ev-hover", "data-ev-picked", "data-ev-href-stripped"];

/**
 * Sanitise a cloned subtree in place.
 * Returns `{ removed }` — a count per kind, for the review step's summary.
 */
export function sanitizeSubtree(root) {
  const counts = {};
  if (!root) return { removed: counts };

  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 1 /* SHOW_ELEMENT */);
  const doomed = [];
  const elements = [root];

  while (walker.nextNode()) elements.push(walker.currentNode);

  for (const el of elements) {
    const tag = el.tagName?.toLowerCase();

    if (DROP_ELEMENTS.has(tag)) {
      // Never drop the root itself — a clipped <form> should become a <div>
      // rather than vanish and leave the user with an empty clip.
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

    // An anchor that survived keeps its href but must not hijack the tab.
    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }

    // Clipped media loads straight from the origin site. Hotlink protection is
    // almost always keyed on the Referer header, so suppressing it is what
    // keeps those images resolving once the clip is on someone else's page.
    if (tag === "img" || tag === "source" || tag === "video" || tag === "picture") {
      // Not crossorigin="anonymous" — we only display these, and requesting
      // CORS would make them fail outright on any host that doesn't send the
      // headers.
      el.setAttribute("referrerpolicy", "no-referrer");
    }
  }

  for (const el of doomed) el.remove();

  // A root that was itself a form/button becomes a neutral container.
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

// CSS at-rules that either execute, load, or escape the scope. @media,
// @supports, @keyframes and @font-face are all kept — they are what makes a
// clip responsive and animated.
const BANNED_AT_RULE = /^@(import|charset|namespace|document|page)\b/i;

export function isBannedAtRule(text) {
  return BANNED_AT_RULE.test(String(text || "").trim());
}

// Declarations that can reach outside the clip or run code.
const BANNED_DECL = /(^|[\s;{])(position\s*:\s*fixed|behavior\s*:|expression\s*\()/i;

export function scrubDeclarations(cssText) {
  let out = String(cssText || "");
  // `position: fixed` inside a clip escapes its container and floats over the
  // whole event page. Pin it back into flow.
  out = out.replace(/position\s*:\s*fixed/gi, "position: absolute");
  // IE-era code execution vectors; cheap to remove, no legitimate use.
  out = out.replace(/expression\s*\([^)]*\)/gi, "");
  out = out.replace(/behavior\s*:[^;}]*/gi, "");
  out = out.replace(/-moz-binding\s*:[^;}]*/gi, "");
  return out;
}

export { BANNED_DECL };
