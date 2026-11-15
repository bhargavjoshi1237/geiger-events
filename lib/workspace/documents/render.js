import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { layoutDocument, MM } from "./layout.js";

// Draws a laid-out document with pdf-lib: Noto fonts (subset on embed), PNG/JPEG images, vector QR codes.
const FONT_FILES = { sans: ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"], serif: ["NotoSerif-Regular.ttf", "NotoSerif-Bold.ttf"] };
const fontCache = new Map();
const fontBytes = (name) => {
  if (!fontCache.has(name)) {
    const pending = readFile(path.join(process.cwd(), "lib", "workspace", "documents", "fonts", name));
    pending.catch(() => fontCache.delete(name));
    fontCache.set(name, pending);
  }
  return fontCache.get(name);
};

const hex = (value, fallback = "#111827") => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value ?? "") ?? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(fallback);
  return rgb(parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255);
};
// Control characters have no glyphs; tabs become spaces.
const printable = (value) => String(value ?? "").replace(/\t/g, "    ").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");

export function imageKind(bytes) {
  if (bytes?.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes?.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

export function qrModules(value) {
  const qr = QRCode.create(String(value || " ").slice(0, 1200), { errorCorrectionLevel: "M" });
  return { count: qr.modules.size, bits: Array.from(qr.modules.data, (bit) => (bit ? 1 : 0)) };
}

function drawQr(page, op, height) {
  const { count, bits } = op.modules;
  const cell = op.size / (count + 4);
  const dark = rgb(0, 0, 0);
  page.drawRectangle({ x: op.x, y: height - op.y - op.size, width: op.size, height: op.size, color: rgb(1, 1, 1) });
  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let col = 0; col <= count; col += 1) {
      const on = col < count && bits[row * count + col] === 1;
      if (on && start < 0) start = col;
      if (!on && start >= 0) {
        page.drawRectangle({
          x: op.x + (start + 2) * cell, y: height - op.y - (row + 3) * cell,
          width: (col - start) * cell + 0.05, height: cell + 0.05, color: dark,
        });
        start = -1;
      }
    }
  }
}

// blocks: rendered blocks (text already filled in; images as https URLs); loadImage(url) → bytes or throws.
export async function renderPdf({ page, blocks, title = "Document", loadImage }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(printable(title).slice(0, 200));
  pdf.setCreator("Geiger Events");
  pdf.setProducer("Geiger Events");
  const [regular, bold] = await Promise.all(FONT_FILES[page.font === "serif" ? "serif" : "sans"].map(async (name) => pdf.embedFont(await fontBytes(name), { subset: true })));
  const measure = (text, style = {}) => (style.bold ? bold : regular).widthOfTextAtSize(printable(text), style.size ?? 11);

  const warnings = [];
  const images = new Map();
  const byUrl = new Map();
  const embed = async (url, label) => {
    if (!url) return null;
    if (!byUrl.has(url)) {
      byUrl.set(url, (async () => {
        try {
          const bytes = await loadImage(url);
          const kind = imageKind(bytes);
          if (!kind) throw new Error("use a PNG or JPEG image");
          const image = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const key = `i${images.size}`;
          images.set(key, image);
          return { key, width: image.width, height: image.height };
        } catch (error) {
          warnings.push(`${label} couldn't be loaded: ${String(error?.message ?? error).replace(/\.$/, "")}.`);
          return null;
        }
      })());
    }
    return byUrl.get(url);
  };

  const prepare = async (block) => {
    switch (block.kind) {
      case "image": {
        const image = await embed(block.url, "An image");
        const width = block.width * MM;
        return { ...block, key: image?.key ?? null, width, height: image ? width * (image.height / image.width) : width * 0.6 };
      }
      case "signature":
        return { ...block, image: block.url ? await embed(block.url, "A signature image") : null };
      case "qr":
        return block.value ? { ...block, size: block.size * MM, modules: qrModules(block.value) } : null;
      case "columns":
        return { ...block, left: (await Promise.all(block.left.map(prepare))).filter(Boolean), right: (await Promise.all(block.right.map(prepare))).filter(Boolean) };
      case "heading":
      case "text":
        return { ...block, text: printable(block.text) };
      default:
        return block;
    }
  };
  const prepared = (await Promise.all(blocks.map(prepare))).filter(Boolean);
  const background = page.background ? await embed(page.background, "The background image") : null;
  const layout = layoutDocument(prepared, { page, measure });

  for (const ops of layout.pages) {
    const sheet = pdf.addPage([layout.width, layout.height]);
    if (background) {
      const image = images.get(background.key);
      const scale = Math.max(layout.width / image.width, layout.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      sheet.drawImage(image, { x: (layout.width - w) / 2, y: (layout.height - h) / 2, width: w, height: h });
    }
    for (const op of ops) {
      if (op.op === "text") {
        sheet.drawText(printable(op.text), { x: op.x, y: layout.height - op.y, size: op.size, font: op.bold ? bold : regular, color: hex(op.color) });
      } else if (op.op === "image") {
        sheet.drawImage(images.get(op.key), { x: op.x, y: layout.height - op.y - op.height, width: op.width, height: op.height });
      } else if (op.op === "rect") {
        sheet.drawRectangle({ x: op.x, y: layout.height - op.y - op.height, width: op.width, height: op.height, color: hex(op.color) });
      } else if (op.op === "line") {
        sheet.drawLine({ start: { x: op.x1, y: layout.height - op.y1 }, end: { x: op.x2, y: layout.height - op.y2 }, thickness: op.width, color: hex(op.color) });
      } else if (op.op === "qr") {
        drawQr(sheet, op, layout.height);
      }
    }
  }
  return { bytes: await pdf.save(), warnings, pages: layout.pages.length };
}
