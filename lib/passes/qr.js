"use client";

import QRCode from "qrcode";

const CACHE_LIMIT = 400;
const cache = new Map();

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

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, matrix);
  return matrix;
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

export function qrErrorCorrection(qrSettings) {
  const level = String(qrSettings?.errorCorrection || "M").toUpperCase();
  return ["L", "M", "Q", "H"].includes(level) ? level : "M";
}
