"use client";

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

export function removeNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  target.remove();
  const next = serialize(root);
  return next.trim() ? next : null;
}

export function unwrapNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  if (!target.childNodes.length) return null;

  const parent = target.parentNode;
  if (!parent) return null;
  while (target.firstChild) parent.insertBefore(target.firstChild, target);
  target.remove();

  const next = serialize(root);
  return next.trim() ? next : null;
}

export function isolateNode(html, path) {
  const { root } = parse(html);
  if (!root) return null;
  const target = nodeAt(root, path);
  if (!target || target === root) return null;
  if (target.parentNode === root && root.children.length === 1) return null;

  const next = target.outerHTML;
  return next.trim() ? next : null;
}

function isRedundantWrapper(node) {
  if (!node || node.children.length !== 1) return false;
  if (/^(img|svg|picture|video|table|ul|ol)$/i.test(node.tagName)) return false;
  const ownText = [...node.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .join("");
  return !ownText;
}

export function trimWrappers(html, { max = 8 } = {}) {
  const { root } = parse(html);
  if (!root) return { html, removed: 0 };

  let removed = 0;
  while (removed < max) {
    if (root.children.length !== 1) break;
    const outer = root.children[0];
    if (!isRedundantWrapper(outer)) break;
    const inner = outer.children[0];
    outer.replaceWith(inner);
    removed += 1;
  }

  return removed ? { html: serialize(root), removed } : { html, removed: 0 };
}

export function countTrimmableWrappers(html) {
  return trimWrappers(html).removed;
}

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
