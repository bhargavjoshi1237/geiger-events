"use client";

import { collectImageUrls } from "./layout";

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
