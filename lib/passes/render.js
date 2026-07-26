"use client";

import { qrMatrix, qrPathData, qrErrorCorrection } from "./qr";
import { stockSize, dotsPerMm } from "./stock";

// The single source of truth for what a pass looks like. `passSvg()` returns one
// SVG string sized in real millimetres, used by the live preview, the print
// sheet, and the PNG/ZIP exporters — so the three can never drift.
//
// SVG rather than HTML because raster export then needs no dependency: the
// string goes straight into an Image, onto a canvas, and out as a PNG blob.

const escapeXml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]),
  );

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Rough advance width per character, as a fraction of the font size. Good
// enough to decide where to ellipsize without measuring text in a DOM.
const WIDTH_FACTOR = { bold: 0.58, regular: 0.52, mono: 0.6 };

function fitText(text, maxMm, fontMm, weight = "regular") {
  const str = String(text ?? "").trim();
  if (!str) return "";
  const per = fontMm * WIDTH_FACTOR[weight];
  const max = Math.floor(maxMm / per);
  if (max <= 0) return "";
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

// Blend a hex colour toward white/black to get a muted secondary tone without
// relying on opacity (which some print pipelines flatten badly).
function mix(hex, target, amount) {
  const parse = (h) => {
    const clean = String(h || "").replace("#", "");
    const full =
      clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean.padEnd(6, "0").slice(0, 6);
    const n = parseInt(full, 16);
    return Number.isNaN(n) ? [17, 17, 17] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = parse(hex);
  const b = parse(target);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const text = ({ x, y, size, fill, weight, family, spacing, value }) =>
  `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size.toFixed(2)}"` +
  ` fill="${fill}" font-family="${family || "system-ui, -apple-system, Segoe UI, sans-serif"}"` +
  (weight === "bold" ? ' font-weight="700"' : "") +
  (spacing ? ` letter-spacing="${spacing.toFixed(2)}"` : "") +
  `>${escapeXml(value)}</text>`;

// Every field the designer can toggle, with its default.
export const PASS_FIELDS = {
  eventName: true,
  name: true,
  company: true,
  tier: false,
  // Assigned seating: prints "Orchestra · F12". Off by default because most
  // events are general admission; the field is empty for them anyway.
  seat: false,
  ticketCode: true,
  date: false,
  qr: true,
};

const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// template: the saved design. ctx: { event, attendee, qrSettings, logoHref }.
// opts.dpi emits pixel dimensions instead of millimetres (for canvas raster).
export function passSvg(template = {}, ctx = {}, opts = {}) {
  const { wMm: w, hMm: h } = stockSize(template.stock);
  const fields = { ...PASS_FIELDS, ...(template.fields || {}) };
  const { event = {}, attendee = {}, qrSettings = {}, logoHref = "" } = ctx;

  const accent = template.accent || "#6366f1";
  const bg = template.bg || "#ffffff";
  const ink = template.textColor || "#111111";
  const muted = mix(ink, bg, 0.45);

  // One scale factor drives every size, so a design reads correctly on a 54 mm
  // card and on a 148 mm A6 sheet without being re-tuned.
  const s = clamp(Math.min(w, h) / 54, 0.75, 2.2);
  const pad = 4 * s;
  const band = Math.max(2, h * 0.05);

  const parts = [
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`,
    `<rect x="0" y="0" width="${w}" height="${band.toFixed(2)}" fill="${accent}"/>`,
  ];

  // --- QR placement (reserves space the text must flow around) ---------------
  const position = template.qr?.position || "bottom-right";
  const maxQr = Math.min(w, h) - pad * 2;
  const qrSize = clamp(Number(template.qr?.sizeMm) || 20 * s, 8, Math.max(8, maxQr));
  const matrix =
    fields.qr && attendee.payload
      ? qrMatrix(attendee.payload, qrErrorCorrection(qrSettings))
      : null;

  let qrX = 0;
  let qrY = 0;
  if (matrix) {
    if (position === "bottom-left") {
      qrX = pad;
      qrY = h - pad - qrSize;
    } else if (position === "bottom-center") {
      qrX = (w - qrSize) / 2;
      qrY = h - pad - qrSize;
    } else if (position === "right") {
      qrX = w - pad - qrSize;
      qrY = band + (h - band - qrSize) / 2;
    } else {
      qrX = w - pad - qrSize;
      qrY = h - pad - qrSize;
    }
  }

  // --- Text boxes ------------------------------------------------------------
  let bodyW = w - pad * 2;
  let footerX = pad;
  let footerW = bodyW;
  let footerBaseline = h - pad;
  let bodyBottom = h - pad;

  if (matrix) {
    const gap = pad * 0.8;
    if (position === "right") {
      bodyW = w - pad * 2 - qrSize - gap;
      footerW = bodyW;
    } else if (position === "bottom-right") {
      footerW = w - pad * 2 - qrSize - gap;
      bodyBottom = h - pad - qrSize;
    } else if (position === "bottom-left") {
      footerX = pad + qrSize + gap;
      footerW = w - footerX - pad;
      bodyBottom = h - pad - qrSize;
    } else {
      footerBaseline = h - pad - qrSize - pad * 0.5;
      bodyBottom = footerBaseline - 3 * s;
    }
  }

  // --- Header: event name + optional logo ------------------------------------
  const headerSize = 2.5 * s;
  const logoSize = 7 * s;
  const showLogo = template.showLogo && logoHref;
  const headerW = bodyW - (showLogo ? logoSize + pad * 0.6 : 0);
  let cursor = band + pad + headerSize;

  if (showLogo) {
    parts.push(
      `<image href="${escapeXml(logoHref)}" x="${(w - pad - logoSize).toFixed(2)}"` +
        ` y="${(band + pad * 0.6).toFixed(2)}" width="${logoSize.toFixed(2)}"` +
        ` height="${logoSize.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  if (fields.eventName && event.name) {
    parts.push(
      text({
        x: pad,
        y: cursor,
        size: headerSize,
        fill: accent,
        weight: "bold",
        spacing: headerSize * 0.08,
        value: fitText(String(event.name).toUpperCase(), headerW, headerSize, "bold"),
      }),
    );
    cursor += pad * 0.5;
  } else {
    cursor = band + pad;
  }

  // --- Body: name, company, tier, seat — vertically centred in what's left ---
  const lines = [];
  if (fields.name) {
    const size = 6 * s;
    lines.push({ size, weight: "bold", fill: ink, gap: size * 1.15, value: attendee.name || "Attendee" });
  }
  if (fields.company && attendee.company) {
    const size = 3 * s;
    lines.push({ size, weight: "regular", fill: muted, gap: size * 1.35, value: attendee.company });
  }
  if (fields.tier && attendee.tier) {
    const size = 2.7 * s;
    lines.push({ size, weight: "bold", fill: accent, gap: size * 1.5, value: attendee.tier, pill: true });
  }
  if (fields.seat && attendee.seatLabel) {
    const size = 3.4 * s;
    lines.push({ size, weight: "bold", fill: ink, gap: size * 1.3, value: attendee.seatLabel });
  }

  const bodyTop = cursor;
  const bodyH = lines.reduce((sum, l) => sum + l.gap, 0);
  let y = bodyTop + Math.max(0, (bodyBottom - bodyTop - bodyH) / 2);

  for (const line of lines) {
    const value = fitText(line.value, bodyW, line.size, line.weight);
    if (line.pill) {
      const padX = line.size * 0.5;
      const pillW = value.length * line.size * WIDTH_FACTOR.bold + padX * 2;
      const pillH = line.size * 1.6;
      parts.push(
        `<rect x="${pad.toFixed(2)}" y="${(y - line.size).toFixed(2)}"` +
          ` width="${Math.min(pillW, bodyW).toFixed(2)}" height="${pillH.toFixed(2)}"` +
          ` rx="${(pillH / 2).toFixed(2)}" fill="${accent}"/>`,
      );
      parts.push(
        text({
          x: pad + padX,
          y: y + line.size * 0.15,
          size: line.size,
          fill: "#ffffff",
          weight: "bold",
          value,
        }),
      );
    } else {
      parts.push(text({ x: pad, y, size: line.size, fill: line.fill, weight: line.weight, value }));
    }
    y += line.gap;
  }

  // --- Footer: ticket code + date --------------------------------------------
  const footerBits = [];
  if (fields.ticketCode && attendee.code) footerBits.push(attendee.code);
  if (fields.date && event.date) footerBits.push(fmtDay(event.date));
  if (attendee.of > 1) footerBits.push(`${attendee.seat}/${attendee.of}`);

  if (footerBits.length) {
    const size = 2.6 * s;
    parts.push(
      text({
        x: footerX,
        y: footerBaseline,
        size,
        fill: muted,
        family: "ui-monospace, SFMono-Regular, Menlo, monospace",
        value: fitText(footerBits.join("  ·  "), footerW, size, "mono"),
      }),
    );
  }

  // --- QR --------------------------------------------------------------------
  if (matrix) {
    const unit = qrSize / matrix.size;
    const dark = qrSettings.brandColor || "#111111";
    const inner = [
      `<rect x="0" y="0" width="${matrix.size}" height="${matrix.size}" fill="#ffffff"/>`,
      `<path d="${qrPathData(matrix)}" fill="${dark}" shape-rendering="crispEdges"/>`,
    ];

    // Centre mark, from the project's QR Tickets setting. Only drawn at error
    // correction Q or H — those tolerate the ~6% of modules it knocks out,
    // where L and M would risk the scan.
    const ec = qrErrorCorrection(qrSettings);
    if (qrSettings.showLogo && logoHref && (ec === "Q" || ec === "H")) {
      const plate = matrix.size * 0.24;
      const at = (matrix.size - plate) / 2;
      inner.push(
        `<rect x="${at.toFixed(2)}" y="${at.toFixed(2)}" width="${plate.toFixed(2)}"` +
          ` height="${plate.toFixed(2)}" rx="${(plate * 0.15).toFixed(2)}" fill="#ffffff"/>`,
        `<image href="${escapeXml(logoHref)}" x="${(at + plate * 0.12).toFixed(2)}"` +
          ` y="${(at + plate * 0.12).toFixed(2)}" width="${(plate * 0.76).toFixed(2)}"` +
          ` height="${(plate * 0.76).toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }

    parts.push(
      `<g transform="translate(${qrX.toFixed(2)} ${qrY.toFixed(2)}) scale(${unit.toFixed(4)})">` +
        inner.join("") +
        `</g>`,
    );
  }

  parts.push(
    `<rect x="0.1" y="0.1" width="${(w - 0.2).toFixed(2)}" height="${(h - 0.2).toFixed(2)}"` +
      ` fill="none" stroke="${mix(ink, bg, 0.85)}" stroke-width="0.2"/>`,
  );

  const dim = opts.dpi
    ? `width="${Math.round(w * dotsPerMm(opts.dpi))}" height="${Math.round(h * dotsPerMm(opts.dpi))}"`
    : `width="${w}mm" height="${h}mm"`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${dim} viewBox="0 0 ${w} ${h}">` +
    parts.join("") +
    `</svg>`
  );
}

// Which saved template prints for a given attendee: an explicit tier match wins,
// then the default, then the first. Tier ids are per-event but names are stable
// across them, so binding is by name.
export function resolveTemplate(templates, tier) {
  const list = Array.isArray(templates) ? templates.filter(Boolean) : [];
  if (!list.length) return null;
  const key = String(tier || "").trim().toLowerCase();
  if (key) {
    const match = list.find((t) =>
      (Array.isArray(t.tiers) ? t.tiers : []).some(
        (name) => String(name || "").trim().toLowerCase() === key,
      ),
    );
    if (match) return match;
  }
  return list.find((t) => t.isDefault) || list[0];
}
