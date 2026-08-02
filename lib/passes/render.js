"use client";

import { qrMatrix, qrPathData, qrErrorCorrection } from "./qr";
import { stockSize, dotsPerMm } from "./stock";
import { elementText, fontStack } from "./layout";

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
// --- Free layout -------------------------------------------------------------

// The href to draw for a stored image URL. The exporter passes a url -> data-URI
// map because an SVG inside an <img> can't fetch remote files; everywhere else
// the URL is used directly.
const hrefFor = (url, images) => (url ? images?.[url] || url : "");

const SVG_FIT = { cover: "xMidYMid slice", contain: "xMidYMid meet", stretch: "none" };

function borderRect(border, w, h, radius) {
  if (!border || border.style === "none") return "";
  const width = Math.max(0.05, Number(border.width) || 0.4);
  const dash =
    border.style === "dashed"
      ? ` stroke-dasharray="${(width * 4).toFixed(2)} ${(width * 2.5).toFixed(2)}"`
      : border.style === "dotted"
        ? ` stroke-dasharray="0.01 ${(width * 2).toFixed(2)}" stroke-linecap="round"`
        : "";
  const inset = width / 2;
  const rect = (stroke, at, strokeW) =>
    `<rect x="${at.toFixed(2)}" y="${at.toFixed(2)}"` +
    ` width="${(w - at * 2).toFixed(2)}" height="${(h - at * 2).toFixed(2)}"` +
    (radius ? ` rx="${Number(radius).toFixed(2)}"` : "") +
    ` fill="none" stroke="${stroke}" stroke-width="${strokeW.toFixed(2)}"${dash}/>`;
  // A double border is two hairlines with a gap, the way CSS draws it.
  if (border.style === "double") {
    const line = width / 3;
    return (
      rect(border.color || "#111111", line / 2, line) +
      rect(border.color || "#111111", width - line / 2, line)
    );
  }
  return rect(border.color || "#111111", inset, width);
}

// Image adjustments as a real SVG filter rather than the CSS `filter` shorthand:
// a filter primitive chain is what rasterises reliably when the SVG is loaded
// into an <img> for PNG export.
function adjustFilter(el) {
  const a = el.adjust;
  if (!a) return null;
  const brightness = (Number(a.brightness) ?? 100) / 100;
  const contrast = (Number(a.contrast) ?? 100) / 100;
  const saturation = (Number(a.saturation) ?? 100) / 100;
  const grayscale = clamp((Number(a.grayscale) || 0) / 100, 0, 1);
  const blur = Math.max(0, Number(a.blur) || 0);
  if (brightness === 1 && contrast === 1 && saturation === 1 && !grayscale && !blur) {
    return null;
  }

  const id = `adj-${el.id}`;
  const stages = [];
  if (brightness !== 1 || contrast !== 1) {
    // Contrast pivots around mid-grey, exactly like the CSS function.
    const slope = brightness * contrast;
    const intercept = (1 - contrast) / 2;
    const fn = ["R", "G", "B"]
      .map(
        (c) =>
          `<feFunc${c} type="linear" slope="${slope.toFixed(4)}" intercept="${intercept.toFixed(4)}"/>`,
      )
      .join("");
    stages.push(`<feComponentTransfer>${fn}</feComponentTransfer>`);
  }
  // Grayscale is just desaturation, so the two controls compose.
  const sat = saturation * (1 - grayscale);
  if (sat !== 1) stages.push(`<feColorMatrix type="saturate" values="${sat.toFixed(4)}"/>`);
  if (blur) stages.push(`<feGaussianBlur stdDeviation="${blur.toFixed(3)}"/>`);

  return { id, def: `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">${stages.join("")}</filter>` };
}

// The wrapper an element is drawn inside: opacity and rotation about its own
// centre.
function wrapElement(el, body) {
  if (!body) return "";
  const opacity = el.opacity === undefined ? 1 : Number(el.opacity);
  const rotation = Number(el.rotation) || 0;
  const attrs = [];
  if (opacity < 1) attrs.push(` opacity="${clamp(opacity, 0, 1).toFixed(3)}"`);
  if (rotation) {
    const cx = Number(el.x) + (Number(el.w) || Number(el.size) || 0) / 2;
    const cy =
      el.kind === "text"
        ? Number(el.y) - (Number(el.size) || 4) / 2
        : Number(el.y) + (Number(el.h) || Number(el.size) || 0) / 2;
    attrs.push(` transform="rotate(${rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`);
  }
  return attrs.length ? `<g${attrs.join("")}>${body}</g>` : body;
}

// A flat colour laid over artwork at `tintStrength` percent — the quick way to
// key a photo to the event's palette.
function tintRect(el) {
  const a = el.adjust;
  const strength = clamp((Number(a?.tintStrength) || 0) / 100, 0, 1);
  if (!a?.tint || !strength) return "";
  return (
    `<rect x="${Number(el.x).toFixed(2)}" y="${Number(el.y).toFixed(2)}"` +
    ` width="${Number(el.w).toFixed(2)}" height="${Number(el.h).toFixed(2)}"` +
    (el.radius ? ` rx="${Number(el.radius).toFixed(2)}"` : "") +
    ` fill="${a.tint}" opacity="${strength.toFixed(3)}"/>`
  );
}

// One element -> SVG: its drawing, its colour adjustments and tint (artwork
// only), then opacity and rotation over the lot. Order in the elements array is
// z-order; hidden elements are skipped by the caller.
function elementSvg(el, ctx, opts) {
  const body = elementBody(el, ctx, opts);
  if (!body) return "";
  const artwork = el.kind === "image" || el.kind === "box";
  const filter = artwork ? adjustFilter(el) : null;
  const inner = filter ? `${filter.def}<g filter="url(#${filter.id})">${body}</g>` : body;
  return wrapElement(el, inner + (artwork ? tintRect(el) : ""));
}

// The raw drawing for an element, before opacity, rotation and adjustments.
function elementBody(el, ctx, { w, h, images, preview, cardBg }) {
  if (el.kind === "box") {
    const parts = [
      `<rect x="${Number(el.x).toFixed(2)}" y="${Number(el.y).toFixed(2)}"` +
        ` width="${Number(el.w).toFixed(2)}" height="${Number(el.h).toFixed(2)}"` +
        (el.radius ? ` rx="${Number(el.radius).toFixed(2)}"` : "") +
        ` fill="${el.fill || "none"}"/>`,
    ];
    // A section can hold its own artwork, clipped to the section's box.
    const sectionImage = hrefFor(el.image, images);
    if (sectionImage) {
      const clip = el.radius ? ` clip-path="inset(0 round ${Number(el.radius).toFixed(2)})"` : "";
      parts.push(
        `<image href="${escapeXml(sectionImage)}" x="${Number(el.x).toFixed(2)}"` +
          ` y="${Number(el.y).toFixed(2)}" width="${Number(el.w).toFixed(2)}"` +
          ` height="${Number(el.h).toFixed(2)}"` +
          ` preserveAspectRatio="${SVG_FIT[el.fit] || SVG_FIT.cover}"${clip}/>`,
      );
    }
    if (el.border && el.border.style !== "none") {
      parts.push(
        `<g transform="translate(${Number(el.x).toFixed(2)} ${Number(el.y).toFixed(2)})">` +
          borderRect(el.border, Number(el.w), Number(el.h), el.radius) +
          `</g>`,
      );
    }
    return parts.join("");
  }

  if (el.kind === "image") {
    const href = hrefFor(el.url, images);
    if (!href) {
      // An empty image slot is a dashed placeholder in the designer only — it
      // must never print.
      return preview
        ? `<rect x="${Number(el.x).toFixed(2)}" y="${Number(el.y).toFixed(2)}"` +
            ` width="${Number(el.w).toFixed(2)}" height="${Number(el.h).toFixed(2)}"` +
            ` fill="none" stroke="#9ca3af" stroke-width="0.3" stroke-dasharray="1 1"/>`
        : "";
    }
    const clip = el.radius ? ` clip-path="inset(0 round ${Number(el.radius).toFixed(2)})"` : "";
    return (
      `<image href="${escapeXml(href)}" x="${Number(el.x).toFixed(2)}"` +
      ` y="${Number(el.y).toFixed(2)}" width="${Number(el.w).toFixed(2)}"` +
      ` height="${Number(el.h).toFixed(2)}"` +
      ` preserveAspectRatio="${SVG_FIT[el.fit] || SVG_FIT.contain}"${clip}/>`
    );
  }

  if (el.kind === "qr") {
    const size = Number(el.size) || 18;
    const payload = ctx.attendee?.payload;
    const matrix = payload ? qrMatrix(payload, qrErrorCorrection(ctx.qrSettings)) : null;
    if (!matrix) return "";
    const unit = size / matrix.size;
    // A transparent code drops its quiet-zone plate so whatever is behind it —
    // card colour, background art, a section — shows through.
    const qrBg = el.bgTransparent ? "" : el.bg || "#ffffff";
    const inner = [];
    if (qrBg) {
      inner.push(
        `<rect x="0" y="0" width="${matrix.size}" height="${matrix.size}" fill="${qrBg}"/>`,
      );
    }
    inner.push(
      `<path d="${qrPathData(matrix)}" fill="${el.fg || "#111111"}" shape-rendering="crispEdges"/>`,
    );
    // Only Q and H tolerate the ~6% of modules a centre mark knocks out.
    const ec = qrErrorCorrection(ctx.qrSettings);
    const logo = hrefFor(el.logoUrl, images);
    if (logo && (ec === "Q" || ec === "H")) {
      const plate = matrix.size * 0.24;
      const at = (matrix.size - plate) / 2;
      inner.push(
        `<rect x="${at.toFixed(2)}" y="${at.toFixed(2)}" width="${plate.toFixed(2)}"` +
          ` height="${plate.toFixed(2)}" rx="${(plate * 0.15).toFixed(2)}"` +
          ` fill="${qrBg || cardBg || "#ffffff"}"/>`,
        `<image href="${escapeXml(logo)}" x="${(at + plate * 0.12).toFixed(2)}"` +
          ` y="${(at + plate * 0.12).toFixed(2)}" width="${(plate * 0.76).toFixed(2)}"` +
          ` height="${(plate * 0.76).toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }
    return (
      `<g transform="translate(${Number(el.x).toFixed(2)} ${Number(el.y).toFixed(2)})` +
      ` scale(${unit.toFixed(4)})">${inner.join("")}</g>`
    );
  }

  // text
  const value = elementText(el, ctx, { preview });
  if (!value) return "";
  const size = Number(el.size) || 4;
  const boxW = Number(el.w) || w - Number(el.x);
  const weight = el.weight === "bold" ? "bold" : el.font === "mono" ? "mono" : "regular";
  const fitted = fitText(value, boxW, size, weight);
  const anchor = el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
  const tx = el.align === "center" ? Number(el.x) + boxW / 2 : el.align === "right" ? Number(el.x) + boxW : Number(el.x);
  const parts = [];

  // A pill is the tier treatment: a rounded plate sized to the text.
  if (el.pill) {
    const padX = size * 0.5;
    const pillW = Math.min(fitted.length * size * WIDTH_FACTOR.bold + padX * 2, boxW);
    const pillH = size * 1.6;
    const px = el.align === "center" ? tx - pillW / 2 : el.align === "right" ? tx - pillW : tx;
    parts.push(
      `<rect x="${px.toFixed(2)}" y="${(Number(el.y) - size).toFixed(2)}"` +
        ` width="${pillW.toFixed(2)}" height="${pillH.toFixed(2)}"` +
        ` rx="${(pillH / 2).toFixed(2)}" fill="${el.pillFill || "#6366f1"}"/>`,
    );
  }

  parts.push(
    `<text x="${tx.toFixed(2)}" y="${(Number(el.y) + (el.pill ? size * 0.15 : 0)).toFixed(2)}"` +
      ` font-size="${size.toFixed(2)}" fill="${el.color || "#111111"}"` +
      ` font-family="${escapeXml(fontStack(el.font))}" text-anchor="${anchor}"` +
      (el.weight === "bold" ? ' font-weight="700"' : "") +
      (el.italic ? ' font-style="italic"' : "") +
      (el.spacing ? ` letter-spacing="${Number(el.spacing).toFixed(2)}"` : "") +
      `>${escapeXml(fitted)}</text>`,
  );
  return parts.join("");
}

// A pass drawn from its free layout. Same signature and output contract as the
// legacy path below, so print/export/preview need no branching.
function layoutSvg(template, ctx, opts) {
  const { wMm: w, hMm: h } = stockSize(template.stock);
  const layout = template.layout || {};
  const images = ctx.images || {};
  const preview = Boolean(opts.preview);
  const radius = Number(layout.border?.radius) || 0;
  const parts = [`<rect x="0" y="0" width="${w}" height="${h}"` +
    (radius ? ` rx="${radius.toFixed(2)}"` : "") +
    ` fill="${template.bg || "#ffffff"}"/>`];

  const bg = layout.bgImage || {};
  const bgHref = hrefFor(bg.url, images);
  if (bgHref) {
    const opacity = bg.opacity === undefined ? 1 : Number(bg.opacity);
    parts.push(
      `<image href="${escapeXml(bgHref)}" x="0" y="0" width="${w}" height="${h}"` +
        ` preserveAspectRatio="${SVG_FIT[bg.fit] || SVG_FIT.cover}"` +
        (opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : "") +
        `/>`,
    );
  }

  for (const el of layout.elements || []) {
    if (!el || el.hidden) continue;
    parts.push(
      elementSvg(el, ctx, { w, h, images, preview, cardBg: template.bg || "#ffffff" }),
    );
  }

  parts.push(borderRect(layout.border, w, h, radius));

  const dim = opts.dpi
    ? `width="${Math.round(w * dotsPerMm(opts.dpi))}" height="${Math.round(h * dotsPerMm(opts.dpi))}"`
    : `width="${w}mm" height="${h}mm"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${dim} viewBox="0 0 ${w} ${h}">` +
    parts.join("") +
    `</svg>`
  );
}

export function passSvg(template = {}, ctx = {}, opts = {}) {
  // A design with a free layout draws element by element; older ones keep the
  // auto-flow below until they're opened in the editor and converted.
  if (template.layout?.elements?.length) return layoutSvg(template, ctx, opts);
  return autoFlowSvg(template, ctx, opts);
}

function autoFlowSvg(template = {}, ctx = {}, opts = {}) {
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
