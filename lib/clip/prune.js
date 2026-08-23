"use client";

// Removing parts of an already-captured clip.
//
// Picking the perfect element on a live page is rare — you usually want the
// card but not its "Buy tickets" button, or the table but not its filter bar.
// Rather than making the picker smarter, this lets the clip be edited after the
// fact.
//
// Nodes are addressed by child-index path ("0.3.2") rather than by selector or
// by holding DOM references. A path survives serialising the clip to a string
// and parsing it back, which is exactly what happens between the editor and
// storage — a held reference would not.

const PATH_ATTR = "data-ev-path";

function parse(html) {
  const doc = new DOMParser().parseFromString(
    `<div id="ev-clip-root">${html}</div>`,
    "text/html",
  );
  return { doc, root: doc.getElementById("ev-clip-root") };
}

function serialize(root) {
  return root ? root.innerHTML : "";
}

/** Stamp every element with its path, so a click can be resolved back to it. */
export function withPaths(html) {
  const { root } = parse(html);
  if (!root) return html;

  const walk = (node, prefix) => {
    [...node.children].forEach((child, i) => {
      const path = prefix ? `${prefix}.${i}` : String(i);
      child.setAttribute(PATH_ATTR, path);
      walk(child, path);
    });
  };
  walk(root, "");

  return serialize(root);
}

/** Strip the editing marks. Always run before storing. */
export function stripPaths(html) {
  const { root } = parse(html);
  if (!root) return html;
  for (const el of root.querySelectorAll(`[${PATH_ATTR}]`)) {
    el.removeAttribute(PATH_ATTR);
  }
  return serialize(root);
}

function nodeAt(root, path) {
  let node = root;
  for (const part of String(path).split(".")) {
    const i = Number(part);
    if (!Number.isInteger(i) || !node?.children?.[i]) return null;
    node = node.children[i];
  }
  return node;
}

/**
 * Remove one node from a clip's markup.
 *
 * Returns new html, or null when the path doesn't resolve or the removal would
 * empty the clip — deleting the last thing in it is never what was meant.
 */
export function removeNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  target.remove();
  const next = serialize(root);
  return next.trim() ? next : null;
}

/**
 * Replace a node with its children, keeping the contents.
 *
 * This is the one that matters for clip quality. A picked element is almost
 * never the component alone — it arrives wrapped in the site's layout
 * containers, which carry the page's own padding, max-width and grid rules.
 * Those wrappers are what put dead space around a clip and make it scale as if
 * it were far wider than it looks. Deleting them would take the component with
 * them; unwrapping strips the box and leaves what was inside.
 */
export function unwrapNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  // Nothing to promote — unwrapping would just delete it, which is the other
  // tool's job.
  if (!target.childNodes.length) return null;

  const parent = target.parentNode;
  if (!parent) return null;
  while (target.firstChild) parent.insertBefore(target.firstChild, target);
  target.remove();

  const next = serialize(root);
  return next.trim() ? next : null;
}

/**
 * Reduce a clip to one node — that element and its contents, nothing else.
 *
 * The inverse of picking away at a clip. When the thing you wanted is one card
 * inside a captured grid, unwrapping ancestors and removing siblings one at a
 * time is a dozen clicks; this is the same result in one. Ancestors go with the
 * siblings, since a wrapper with a single child left in it is exactly what
 * unwrapping exists to delete.
 *
 * Returns null when the node is already the whole clip, so the caller can treat
 * a no-op as "nothing happened" rather than pushing an identical undo step.
 */
export function isolateNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  // Already the entire clip — isolating would change nothing.
  if (target.parentNode === root && root.children.length === 1) return null;

  const next = target.outerHTML;
  return next.trim() ? next : null;
}

// A wrapper for our purposes: an element whose only job is to hold one other
// element. Text content of its own disqualifies it, as does a second child.
function isRedundantWrapper(node) {
  if (!node || node.children.length !== 1) return false;
  if (/^(img|svg|picture|video|table|ul|ol)$/i.test(node.tagName)) return false;
  const ownText = [...node.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .join("");
  return !ownText;
}

/**
 * Collapse the chain of single-child wrappers at the top of a clip.
 *
 * The automated version of unwrapNode, for the common case: the picked element
 * sits three or four nested layout divs above the thing you actually wanted.
 * Stops at the first element that holds more than one child, which is where the
 * real component begins.
 *
 * Returns `{ html, removed }` — `removed` is how many wrappers came off, so the
 * caller can say nothing happened rather than silently doing nothing.
 */
export function trimWrappers(html, { max = 8 } = {}) {
  const { root } = parse(html);
  if (!root) return { html, removed: 0 };

  let removed = 0;
  while (removed < max) {
    // Only meaningful while the clip has a single top-level element.
    if (root.children.length !== 1) break;
    const outer = root.children[0];
    if (!isRedundantWrapper(outer)) break;
    const inner = outer.children[0];
    outer.replaceWith(inner);
    removed += 1;
  }

  return removed ? { html: serialize(root), removed } : { html, removed: 0 };
}

/** How many wrappers `trimWrappers` would take off, without doing it. */
export function countTrimmableWrappers(html) {
  return trimWrappers(html).removed;
}

/** A short description of a node, for the editor's confirm affordance. */
export function describeNode(html, path) {
  const { root } = parse(html);
  const node = root ? nodeAt(root, path) : null;
  if (!node) return "";
  const tag = node.tagName.toLowerCase();
  const kids = node.children.length;
  const text = (node.textContent || "").trim().replace(/\s+/g, " ");
  if (text) {
    return `${tag} · ${text.slice(0, 36)}${text.length > 36 ? "…" : ""}`;
  }
  const media = node.querySelectorAll("img, svg, picture").length;
  if (media) return `${tag} · ${media} image${media === 1 ? "" : "s"}`;
  return kids ? `${tag} · ${kids} child${kids === 1 ? "" : "ren"}` : tag;
}
