"use client";

const IGNORED = /^(script|style|link|meta|br|template)$/i;

export function measureInk(inner) {
  if (!inner || typeof inner.getBoundingClientRect !== "function") return null;

  const box = inner.getBoundingClientRect();
  const scale = inner.offsetWidth ? box.width / inner.offsetWidth : 1;
  if (!scale || !Number.isFinite(scale)) return null;

  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of inner.querySelectorAll("*")) {
    if (IGNORED.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.left < left) left = r.left;
    if (r.right > right) right = r.right;
    if (r.bottom > bottom) bottom = r.bottom;
  }

  if (!Number.isFinite(left) || right <= left) return null;

  return {
    width: Math.round((right - left) / scale),
    height: Math.round(Math.max(0, bottom - box.top) / scale),
    offset: Math.round(Math.max(0, left - box.left) / scale),
    renderedWidth: Math.round(inner.scrollWidth),
    renderedHeight: Math.round(inner.scrollHeight),
  };
}
