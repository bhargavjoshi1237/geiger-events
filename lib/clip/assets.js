"use client";

import { pathFromPublicUrl, removeEventImage } from "@/lib/supabase/storage";

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

export async function removeClipAssets(clip, { keep } = {}) {
  const doomed = clipAssetPaths(clip);
  if (!doomed.length) return 0;
  const spared = new Set(clipAssetPaths(keep));
  const targets = doomed.filter((path) => !spared.has(path));
  const results = await Promise.all(targets.map((path) => removeEventImage(path)));
  return results.filter(Boolean).length;
}
