"use client";

// A clip's assets.
//
// Clips reference their images, fonts and media straight from the origin site.
// Nothing is copied into our storage bucket: an event page can carry a lot of
// clips, and persisting every asset of every one of them turns a lightweight
// embed into an open-ended storage bill for files we do not own.
//
// The trade-off is honest and worth stating: a clip is only as durable as the
// site it came from. If the origin redesigns, moves a CDN path, or starts
// blocking hotlinks, the clip's images go with it. Re-clipping fixes it.
//
// Hotlink blocking is usually done on the Referer header, so clipped media is
// marked no-referrer at extraction time (lib/clip/sanitize.js) to give it the
// best chance of loading.
//
// The functions here exist for the other direction — cleaning up assets that
// *were* uploaded, by clips captured while rehosting was the default.

import { pathFromPublicUrl, removeEventImage } from "@/lib/supabase/storage";

/**
 * Storage object paths a clip owns in our bucket.
 *
 * Only URLs in our own bucket come back — `pathFromPublicUrl` returns null for
 * anything else, so origin-hosted images and inlined data URLs are ignored.
 * Returns nothing for clips captured after rehosting was removed.
 */
export function clipAssetPaths(clip) {
  if (!clip) return [];
  const paths = new Set();
  const source = `${clip.html || ""}\n${clip.css || ""}`;
  const url = /https?:\/\/[^"')\s]+/g;
  let m;
  while ((m = url.exec(source))) {
    const path = pathFromPublicUrl(m[0]);
    if (path) paths.add(path);
  }
  return [...paths];
}

/**
 * Delete the storage objects an older clip owned.
 *
 * `keep` is the clip replacing it — anything both reference stays, so replacing
 * a legacy clip cannot delete files the new one still points at.
 *
 * Best-effort and non-blocking: a failed delete costs storage, and must never
 * take down the save that triggered it.
 */
export async function removeClipAssets(clip, { keep } = {}) {
  const doomed = clipAssetPaths(clip);
  if (!doomed.length) return 0;
  const spared = new Set(clipAssetPaths(keep));
  const targets = doomed.filter((path) => !spared.has(path));
  const results = await Promise.all(targets.map((path) => removeEventImage(path)));
  return results.filter(Boolean).length;
}
