"use client";

// What a rendered clip actually paints, as opposed to how big it was recorded.
//
// A clip's geometry comes from the bounding box of the element that was picked,
// but the clip does not always reproduce that box. Two things pull it apart:
//
//   Width   the picked box is as wide as the source page's content row, while
//           the design inside it can be much narrower — so the clip arrives with
//           dead gutters, and gets scaled down to fit space nothing uses.
//   Height  the clip re-lays-out inside our page rather than inside the source
//           page's ancestors. Anything that depended on those ancestors settles
//           differently, and the drift shows up as trailing empty space below
//           the design.
//
// Neither is an element, which is why neither can be deleted in the pruner —
// there is nothing there to click. Measuring the ink instead (the union of what
// the descendants actually cover) gives the size the clip should have been.

// Elements that occupy no visual space, or whose box says nothing about the
// design's extent.
const IGNORED = /^(script|style|link|meta|br|template)$/i;

/**
 * The painted bounds of a rendered clip, in the clip's own (unscaled) pixels.
 *
 * `inner` is the element the renderer sizes and scales — see ClipContent.
 * Width is the design's own width; height is measured from the top of the clip
 * rather than from the first ink, because the clip stays anchored at its top and
 * only trailing space is reclaimable. Returns null when nothing is measurable.
 */
export function measureInk(inner) {
  if (!inner || typeof inner.getBoundingClientRect !== "function") return null;

  const box = inner.getBoundingClientRect();
  // Rects come back after the renderer's scale transform. Undoing it against the
  // untransformed layout width puts every measurement back in source pixels, so
  // the answer doesn't depend on how wide the preview column happens to be.
  const scale = inner.offsetWidth ? box.width / inner.offsetWidth : 1;
  if (!scale || !Number.isFinite(scale)) return null;

  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of inner.querySelectorAll("*")) {
    if (IGNORED.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    // Collapsed and hidden elements have a box but paint nothing.
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
    // Layout values, so already in source pixels whatever the transform is —
    // what the clip currently occupies, against which the ink is the surplus.
    renderedWidth: Math.round(inner.scrollWidth),
    renderedHeight: Math.round(inner.scrollHeight),
  };
}
