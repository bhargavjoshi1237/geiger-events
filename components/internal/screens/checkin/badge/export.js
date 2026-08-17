"use client";

import { passSvg, resolveTemplate } from "@/lib/passes/render";
import { collectImageUrls, hasBackContent } from "@/lib/passes/layout";
import { zipStore } from "@/lib/passes/zip";

// Raster export. The SVG the preview and printer already use goes into an
// Image, onto a canvas, and out as a PNG — no rasterizing dependency.

const DPI = 300;

const slug = (s) =>
  String(s || "pass")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "pass";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the download a tick to start before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// An SVG loaded into an <img> can't fetch external resources, so a remote logo
// has to become a data URI before export. Returns "" when it can't be read
// (usually a missing CORS header) and the caller warns.
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

function svgToPngBlob(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
        "image/png",
      );
    };
    img.onerror = () => reject(new Error("The pass couldn't be rendered to an image."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// One PNG per requested side of the previewed pass. Returns null on success or
// an error message.
export async function exportPassPng({ template, event, attendee, qrSettings, sides = ["front"] }) {
  // Inlined whenever a URL is set: the renderer decides where each image is used
  // (background, section, badge corner, QR centre), so gating here would desync
  // export from what the preview shows.
  const { images, failed } = await inlineTemplateImages(template);
  const base = `${slug(event?.name)}-${slug(attendee?.name)}`;
  try {
    for (const side of sides) {
      const svg = passSvg(
        template,
        { event, attendee, qrSettings, images, logoHref: images[template.logoUrl] || "" },
        { dpi: DPI, side },
      );
      const blob = await svgToPngBlob(svg);
      // Only name the side when both were asked for, so the single-side download
      // keeps the filename it has always had.
      downloadBlob(blob, sides.length > 1 ? `${base}-${side}.png` : `${base}.png`);
    }
    return failed
      ? "Exported, but an image couldn't be loaded — check that its host allows cross-origin reads."
      : null;
  } catch (e) {
    console.error("[passes.png]", e);
    return e.message || "Couldn't export the PNG.";
  }
}

// Every pass as a PNG inside one ZIP. onProgress(done, total) drives the button
// label so a long run doesn't look frozen.
export async function exportPassesZip({
  templates,
  event,
  attendees,
  qrSettings,
  onProgress,
}) {
  if (!attendees.length) return "There are no passes to export.";

  // Inline each template's images once rather than per pass.
  const assets = new Map();
  let logoFailed = false;
  for (const template of templates) {
    const { images, failed } = await inlineTemplateImages(template);
    if (failed) logoFailed = true;
    assets.set(template.id, images);
  }

  const files = [];
  const used = new Map();
  try {
    for (let i = 0; i < attendees.length; i += 1) {
      const attendee = attendees[i];
      const template = resolveTemplate(templates, attendee.tier, attendee.role);
      if (!template) continue;
      const images = assets.get(template.id) || {};

      // Two attendees can share a name; suffix the duplicates.
      const stem = `${slug(attendee.name)}-${attendee.code || i + 1}`;
      const seen = (used.get(stem) || 0) + 1;
      used.set(stem, seen);
      const base = seen > 1 ? `${stem}-${seen}` : stem;

      // A double-sided design contributes both faces, side-suffixed.
      const sides = hasBackContent(template) ? ["front", "back"] : ["front"];
      for (const side of sides) {
        const svg = passSvg(
          template,
          { event, attendee, qrSettings, images, logoHref: images[template.logoUrl] || "" },
          { dpi: DPI, side },
        );
        const blob = await svgToPngBlob(svg);
        files.push({
          name: sides.length > 1 ? `${base}-${side}.png` : `${base}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      onProgress?.(i + 1, attendees.length);
    }

    downloadBlob(zipStore(files), `${slug(event?.name)}-passes.zip`);
    return logoFailed
      ? "Exported, but a logo couldn't be loaded — check that its host allows cross-origin reads."
      : null;
  } catch (e) {
    console.error("[passes.zip]", e);
    return e.message || "Couldn't build the ZIP.";
  }
}
