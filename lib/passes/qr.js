"use client";

import QRCode from "qrcode";

// Real, scannable QR codes for printed passes. The `qrcode` package's browser
// build exports `create`, which hands back the raw module matrix — so the pass
// renderer draws its own rects instead of parsing a generated SVG string.
//
// The payload is the raw id (order id or registration id), matching the buyer
// portal's QR (app/api/portal/ticket/[id]/qr) so the existing door scanner
// reads a printed pass with no changes.

const CACHE_LIMIT = 400;
const cache = new Map();

// { size, data } where data[y * size + x] is truthy for a dark module, or null
// when the payload can't be encoded. Memoised — a sheet re-renders the same
// payloads on every design tweak.
export function qrMatrix(payload, errorCorrectionLevel = "M") {
  const text = String(payload || "");
  if (!text) return null;
  const key = `${errorCorrectionLevel}:${text}`;
  if (cache.has(key)) return cache.get(key);

  let matrix = null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel });
    matrix = { size: qr.modules.size, data: qr.modules.data };
  } catch (e) {
    console.error("[passes.qr]", e);
  }

  // Evict oldest-first so a long print run can't grow this without bound.
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, matrix);
  return matrix;
}

// One SVG path covering every dark module, in a 0..size unit grid. Adjacent
// modules in a row are merged into a single horizontal run, which cuts the path
// length (and the print/raster cost) roughly in half.
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

// Error-correction level from the project's QR Tickets settings slice, falling
// back to M. Higher levels stay scannable when a printed badge gets scuffed.
export function qrErrorCorrection(qrSettings) {
  const level = String(qrSettings?.errorCorrection || "M").toUpperCase();
  return ["L", "M", "Q", "H"].includes(level) ? level : "M";
}
