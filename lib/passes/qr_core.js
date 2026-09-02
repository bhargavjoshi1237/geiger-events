// Server-and-client-safe QR building blocks — no "use client" directive, so
// this can be imported from Route Handlers as well as browser components.
// lib/passes/qr.js (the badge/pass designer's cached client version) and the
// ticket-QR routes both build on the same matrix/path math so a printed badge,
// a settings preview, and an emailed ticket all render byte-identical codes.

import QRCode from "qrcode";

export function createQrMatrix(payload, errorCorrectionLevel = "M") {
  const text = String(payload || "");
  if (!text) return null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel });
    return { size: qr.modules.size, data: qr.modules.data };
  } catch (e) {
    console.error("[passes.qr_core]", e);
    return null;
  }
}

export function qrPathData(matrix) {
  if (!matrix) return "";
  const { size, data } = matrix;
  const parts = [];
  for (let y = 0; y < size; y += 1) {
    let run = 0;
    for (let x = 0; x <= size; x += 1) {
      const dark = x < size && data[y * size + x];
      if (dark) {
        run += 1;
        continue;
      }
      if (run) {
        parts.push(`M${x - run} ${y}h${run}v1h-${run}z`);
        run = 0;
      }
    }
  }
  return parts.join("");
}

export function qrErrorCorrection(level) {
  const ec = String(level || "M").toUpperCase();
  return ["L", "M", "Q", "H"].includes(ec) ? ec : "M";
}

// A logo knocked out of the center only survives a scan once the code carries
// enough redundancy — Quartile (25%) or High (30%). Below that the missing
// modules are just data loss, so callers must gate the overlay on this.
export function logoEligible(errorCorrection) {
  return qrErrorCorrection(errorCorrection) === "Q" || qrErrorCorrection(errorCorrection) === "H";
}

const escapeXml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]),
  );

// A standalone, branded ticket QR as an SVG string: white background, modules
// in `brandColor`, and — only when the error correction level can absorb it —
// a knockout plate with `logoHref` centered on top. `logoHref` can be a
// relative path (inline DOM use), a data: URI, or an absolute URL.
export function qrTicketSvg({
  payload,
  errorCorrection = "M",
  brandColor = "",
  showLogo = false,
  logoHref = "",
  size = 240,
  margin = 2,
} = {}) {
  const ec = qrErrorCorrection(errorCorrection);
  const matrix = createQrMatrix(payload, ec);
  if (!matrix) return "";

  const dark = brandColor || "#111111";
  const dim = matrix.size + margin * 2;

  const inner = [`<path d="${qrPathData(matrix)}" fill="${dark}" shape-rendering="crispEdges"/>`];

  if (showLogo && logoHref && logoEligible(ec)) {
    const plate = matrix.size * 0.24;
    const at = (matrix.size - plate) / 2;
    inner.push(
      `<rect x="${at.toFixed(2)}" y="${at.toFixed(2)}" width="${plate.toFixed(2)}"` +
        ` height="${plate.toFixed(2)}" rx="${(plate * 0.15).toFixed(2)}" fill="${dark}"/>`,
      `<image href="${escapeXml(logoHref)}" x="${(at + plate * 0.16).toFixed(2)}"` +
        ` y="${(at + plate * 0.16).toFixed(2)}" width="${(plate * 0.68).toFixed(2)}"` +
        ` height="${(plate * 0.68).toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}">` +
    `<rect x="0" y="0" width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g transform="translate(${margin} ${margin})">${inner.join("")}</g>` +
    `</svg>`
  );
}
