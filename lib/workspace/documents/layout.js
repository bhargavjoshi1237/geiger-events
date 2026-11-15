import { PAGE_SIZES } from "./model.js";

// Flows prepared blocks onto pages as draw operations. Pure: text widths come from `measure(text, { bold, size })`,
// and y grows downwards from the top of the page (the renderer flips it for PDF).
export const MM = 72 / 25.4;
const LINE = 1.3;
const GAP = 8;
const MUTED = "#6b7280";
const RULE = "#e5e7eb";
const HEADING = { 1: 22, 2: 16, 3: 13 };

export function pageGeometry(page = {}) {
  const [w, h] = PAGE_SIZES[page.size] ?? PAGE_SIZES.A4;
  const [width, height] = page.orientation === "landscape" ? [h, w] : [w, h];
  const margin = (page.margin ?? 20) * MM;
  return { width, height, margin, contentWidth: width - margin * 2, top: margin, bottom: height - margin };
}

// Splits text into lines no wider than `width`; explicit newlines start new lines and words longer than a line are cut.
export function wrapText(value, width, measure, style) {
  const lines = [];
  for (const paragraph of String(value ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.split(/ +/).filter((word, index, all) => word || all.length === 1);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, style) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = "";
      let rest = word;
      while (measure(rest, style) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut), style) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

const alignX = (align, x, width, used) => (align === "center" ? x + (width - used) / 2 : align === "right" ? x + width - used : x);

function textLines(lines, { x, width, size, bold = false, color, align = "left", measure }) {
  const height = size * LINE;
  return lines.map((line) => ({
    height,
    draw: (ops, top) => {
      if (!line) return;
      ops.push({ op: "text", x: alignX(align, x, width, measure(line, { bold, size })), y: top + size, text: line, size, bold, color });
    },
  }));
}

const single = (height, draw, extra = {}) => ({ height, draw, ...extra });

// One prepared block → chunks that stack vertically; text and tables give one chunk per line or row so they can break across pages.
function chunksFor(block, { x, width, measure, theme, nested = false }) {
  const after = (chunks, gap = GAP) => {
    if (chunks.length) chunks[chunks.length - 1].after = (chunks[chunks.length - 1].after ?? 0) + gap;
    return chunks;
  };
  switch (block.kind) {
    case "heading": {
      const size = HEADING[block.level] ?? HEADING[1];
      const lines = textLines(wrapText(block.text, width, measure, { bold: true, size }), { x, width, size, bold: true, color: theme.accent, align: block.align, measure });
      lines.forEach((line) => { line.keepWithNext = true; });
      return after(lines, block.level === 1 ? 10 : GAP);
    }
    case "text": {
      const size = block.size ?? 11;
      return after(textLines(wrapText(block.text, width, measure, { bold: block.bold, size }),
        { x, width, size, bold: block.bold, color: block.muted ? MUTED : theme.color, align: block.align, measure }));
    }
    case "field": {
      const label = block.label ? textLines([block.name], { x, width, size: 8.5, color: MUTED, align: block.align, measure }) : [];
      label.forEach((line) => { line.keepWithNext = true; });
      const value = textLines(wrapText(block.value || "—", width, measure, { size: 11 }), { x, width, size: 11, color: block.value ? theme.color : MUTED, align: block.align, measure });
      return after([...label, ...value]);
    }
    case "image": {
      const w = Math.min(block.width, width);
      const h = block.height * (w / block.width);
      return after([single(h, (ops, top) => {
        const left = alignX(block.align, x, width, w);
        if (block.key) ops.push({ op: "image", key: block.key, x: left, y: top, width: w, height: h });
        else ops.push({ op: "rect", x: left, y: top, width: w, height: h, color: "#e5e7eb" }, { op: "text", x: left + 6, y: top + 14, text: "Image unavailable", size: 8, bold: false, color: MUTED });
      })]);
    }
    case "qr": {
      const size = Math.min(block.size, width);
      const caption = block.caption ? wrapText(block.caption, Math.max(size, 120), measure, { size: 8.5 }) : [];
      const height = size + (caption.length ? 4 + caption.length * 8.5 * LINE : 0);
      return after([single(height, (ops, top) => {
        const left = alignX(block.align, x, width, size);
        ops.push({ op: "qr", x: left, y: top, size, modules: block.modules });
        const box = Math.max(size, 120);
        const boxLeft = block.align === "center" ? left + size / 2 - box / 2 : block.align === "right" ? left + size - box : left;
        caption.forEach((line, i) => {
          ops.push({ op: "text", x: alignX(block.align, boxLeft, box, measure(line, { size: 8.5 })), y: top + size + 4 + 8.5 + i * 8.5 * LINE, text: line, size: 8.5, bold: false, color: MUTED });
        });
      })]);
    }
    case "signature": {
      const lineWidth = Math.min(170, width);
      const image = block.image;
      const imageHeight = image ? Math.min(42, image.height * (Math.min(lineWidth, image.width) / image.width)) : 28;
      const imageWidth = image ? image.width * (imageHeight / image.height) : 0;
      const height = imageHeight + 4 + (block.name ? 10.5 * LINE : 0) + (block.role ? 9 * LINE : 0) + 2;
      return after([single(height, (ops, top) => {
        const left = alignX(block.align, x, width, lineWidth);
        if (image?.key) ops.push({ op: "image", key: image.key, x: alignX(block.align, left, lineWidth, imageWidth), y: top, width: imageWidth, height: imageHeight });
        const ruleY = top + imageHeight + 2;
        ops.push({ op: "line", x1: left, y1: ruleY, x2: left + lineWidth, y2: ruleY, width: 0.75, color: theme.color });
        let y = ruleY + 2;
        if (block.name) { ops.push({ op: "text", x: alignX(block.align, left, lineWidth, measure(block.name, { bold: true, size: 10.5 })), y: y + 10.5, text: block.name, size: 10.5, bold: true, color: theme.color }); y += 10.5 * LINE; }
        if (block.role) ops.push({ op: "text", x: alignX(block.align, left, lineWidth, measure(block.role, { size: 9 })), y: y + 9, text: block.role, size: 9, bold: false, color: MUTED });
      })], GAP + 4);
    }
    case "spacer":
      return [single(block.height * MM, () => {})];
    case "divider":
      return after([single(10, (ops, top) => ops.push({ op: "line", x1: x, y1: top + 5, x2: x + width, y2: top + 5, width: 0.75, color: RULE }))], 2);
    case "table":
      return tableChunks(block, { x, width, measure, theme, after });
    case "columns": {
      if (nested) return [];
      const gap = 18;
      const side = (width - gap) / 2;
      const stack = (blocks, left) => blocks.flatMap((inner) => chunksFor(inner, { x: left, width: side, measure, theme, nested: true }));
      const left = stack(block.left ?? [], x);
      const right = stack(block.right ?? [], x + side + gap);
      const total = (chunks) => chunks.reduce((sum, chunk) => sum + chunk.height + (chunk.after ?? 0), 0);
      const height = Math.max(total(left), total(right));
      return [single(height, (ops, top) => {
        for (const chunks of [left, right]) {
          let y = top;
          for (const chunk of chunks) { chunk.draw(ops, y); y += chunk.height + (chunk.after ?? 0); }
        }
      }, { after: 0 })];
    }
    default:
      return [];
  }
}

function tableChunks(block, { x, width, measure, theme, after }) {
  const columns = block.header.length || 1;
  const pad = 4;
  const cell = width / columns;
  const row = (cells, bold, size) => {
    const wrapped = cells.map((value) => wrapText(value || "", cell - pad * 2, measure, { bold, size }));
    const height = Math.max(1, ...wrapped.map((lines) => lines.length)) * size * LINE + pad * 2;
    return {
      height,
      draw: (ops, top) => {
        wrapped.forEach((lines, i) => lines.forEach((line, n) => {
          if (line) ops.push({ op: "text", x: x + i * cell + pad, y: top + pad + size + n * size * LINE, text: line, size, bold, color: bold ? theme.accent : theme.color });
        }));
        ops.push({ op: "line", x1: x, y1: top + height, x2: x + width, y2: top + height, width: bold ? 0.9 : 0.5, color: bold ? theme.accent : RULE });
      },
    };
  };
  const header = row(block.header, true, 9);
  const chunks = [];
  if (block.title) chunks.push(...textLines([block.title], { x, width, size: 12, bold: true, color: theme.accent, measure }).map((line) => ({ ...line, keepWithNext: true, after: 4 })));
  chunks.push({ ...header, keepWithNext: true });
  if (!block.rows.length) chunks.push(...textLines(["Nothing linked yet."], { x: x + pad, width, size: 9.5, color: MUTED, measure }));
  for (const cells of block.rows) chunks.push({ ...row(cells, false, 9.5), repeat: header });
  return after(chunks, GAP + 2);
}

// Prepared blocks → { width, height, pages: [ops[]] }.
export function layoutDocument(prepared, { page = {}, measure }) {
  const geometry = pageGeometry(page);
  const theme = { color: page.color ?? "#111827", accent: page.accent ?? "#111827" };
  const chunks = prepared.flatMap((block) => chunksFor(block, { x: geometry.margin, width: geometry.contentWidth, measure, theme }));
  const pages = [[]];
  let y = geometry.top;
  const room = geometry.bottom - geometry.top;
  const newPage = () => { pages.push([]); y = geometry.top; };
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const next = chunk.keepWithNext ? chunks[i + 1] : null;
    const needed = chunk.height + (next ? next.height : 0);
    if (y > geometry.top && y + Math.min(needed, room) > geometry.bottom) {
      newPage();
      if (chunk.repeat) { chunk.repeat.draw(pages.at(-1), y); y += chunk.repeat.height; }
    }
    chunk.draw(pages.at(-1), y);
    y += chunk.height + (chunk.after ?? 0);
  }
  return { width: geometry.width, height: geometry.height, pages };
}
