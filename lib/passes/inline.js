"use client";

import { collectImageUrls } from "./layout";

// An SVG loaded into an <img> can't fetch external resources, so every image a
// pass references has to become a data URI before it is rasterized. Shared by
// the PNG/ZIP exporters and the 3D showcase's card textures, which both draw the
// same `passSvg` string through an Image.

// Returns "" when the file can't be read (usually a missing CORS header) so the
// caller can warn rather than fail.
export async function inlineLogo(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("[passes.inlineLogo]", e);
    return "";
  }
}

// Every image a template references, as a url -> data-URI map. One pass per
// template, so a 500-pass ZIP fetches each asset once.
export async function inlineTemplateImages(template) {
  const images = {};
  let failed = false;
  for (const url of collectImageUrls(template)) {
    const href = await inlineLogo(url);
    if (href) images[url] = href;
    else failed = true;
  }
  return { images, failed };
}
