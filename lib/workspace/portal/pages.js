import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { BLOCK_ID, COLUMN_WIDTHS, GRID, LAYOUTS, PORTAL_LIMITS, SLUG } from "./contracts.js";
import { BLOCK_HEIGHTS, validateBlock } from "./blocks.js";

const bad = (message) => { throw new WorkspaceError("invalid_page", 422, message); };
const ROW_ID = /^r_[a-z0-9]{4,24}$/;

// Runs in the browser (builder) and on the server, so it uses Web Crypto rather than node:crypto.
const randomHex = (bytes) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
export const newBlockId = () => `b_${randomHex(6)}`;
export const newRowId = () => `r_${randomHex(6)}`;

export function slugifyPage(text) {
  const slug = String(text ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "page";
}

// Blocks in reading order for the page's current layout (rows/columns, or top-to-bottom then left-to-right on a canvas).
export function orderedBlocks(page) {
  const blocks = page.body?.blocks ?? [];
  if (page.layout === "canvas") {
    return [...blocks].sort((a, b) => (a.grid?.y ?? 0) - (b.grid?.y ?? 0) || (a.grid?.x ?? 0) - (b.grid?.x ?? 0));
  }
  const rowIndex = new Map((page.body?.rows ?? []).map((row, index) => [row.id, index]));
  return [...blocks].sort((a, b) => (rowIndex.get(a.at?.row) ?? 1e6) - (rowIndex.get(b.at?.row) ?? 1e6)
    || (a.at?.col ?? 0) - (b.at?.col ?? 0) || (a.at?.order ?? 0) - (b.at?.order ?? 0));
}

// Places every block on the 12-column grid to match its row/column position.
export function toCanvas(body) {
  const rows = body.rows ?? [];
  const blocks = body.blocks ?? [];
  let y = 0;
  const placed = new Map();
  for (const row of rows) {
    const starts = row.widths.reduce((acc, width, index) => [...acc, index ? acc[index - 1] + row.widths[index - 1] : 0], []);
    let rowHeight = 0;
    row.widths.forEach((width, col) => {
      let cy = y;
      for (const block of blocks.filter((item) => item.at?.row === row.id && item.at?.col === col).sort((a, b) => a.at.order - b.at.order)) {
        const h = block.grid?.h ?? BLOCK_HEIGHTS[block.kind] ?? 8;
        placed.set(block.id, { x: starts[col], y: cy, w: width, h });
        cy += h;
      }
      rowHeight = Math.max(rowHeight, cy - y);
    });
    y += rowHeight;
  }
  return { ...body, blocks: blocks.map((block) => ({ ...block, grid: placed.get(block.id) ?? block.grid ?? { x: 0, y: y++, w: 12, h: BLOCK_HEIGHTS[block.kind] ?? 8 } })) };
}

// Groups canvas blocks into rows by overlapping height and into columns by position, keeping reading order. A block
// sitting just under one column of the previous row (and no wider than it) stays in that column.
export function toBlocks(body) {
  const blocks = [...(body.blocks ?? [])].sort((a, b) => (a.grid?.y ?? 0) - (b.grid?.y ?? 0) || (a.grid?.x ?? 0) - (b.grid?.x ?? 0));
  const bands = [];
  for (const block of blocks) {
    const { x = 0, y = 0, w = 12, h = 1 } = block.grid ?? {};
    let band = bands.find((item) => y < item.bottom);
    if (!band) {
      const last = bands[bands.length - 1];
      if (last?.columns.length > 1 && last.columns.some((column) => x >= column.start && x + w <= column.end && y <= column.bottom + 2)) band = last;
    }
    if (!band) {
      band = { bottom: y + h, columns: [] };
      bands.push(band);
    }
    const column = band.columns.find((item) => x < item.end && x + w > item.start);
    if (column) {
      column.items.push(block);
      column.start = Math.min(column.start, x);
      column.end = Math.max(column.end, x + w);
      column.bottom = Math.max(column.bottom, y + h);
    } else band.columns.push({ start: x, end: x + w, bottom: y + h, items: [block] });
    band.bottom = Math.max(band.bottom, y + h);
  }
  const rows = [];
  const out = [];
  for (const band of bands) {
    const columns = [...band.columns].sort((a, b) => a.start - b.start);
    while (columns.length > PORTAL_LIMITS.columns) {
      const last = columns.pop();
      columns[columns.length - 1].items.push(...last.items);
      columns[columns.length - 1].end = last.end;
    }
    const row = { id: newRowId(), widths: fitWidths(columns.map((column) => column.end - column.start)) };
    rows.push(row);
    columns.forEach((column, col) => column.items.sort((a, b) => (a.grid?.y ?? 0) - (b.grid?.y ?? 0))
      .forEach((block, order) => out.push({ ...block, at: { row: row.id, col, order } })));
  }
  return { ...body, rows, blocks: out };
}

// Snaps column widths to the nearest allowed split.
function fitWidths(widths) {
  const options = COLUMN_WIDTHS.filter((option) => option.length === widths.length);
  if (!options.length) return [12];
  const total = widths.reduce((sum, width) => sum + width, 0) || 12;
  const scaled = widths.map((width) => (width / total) * 12);
  return options.reduce((best, option) => {
    const cost = option.reduce((sum, width, i) => sum + Math.abs(width - scaled[i]), 0);
    return cost < best.cost ? { cost, option } : best;
  }, { cost: Infinity, option: options[0] }).option;
}

function validateBody(body, ctx) {
  if (body === undefined) return { rows: [], blocks: [] };
  if (!isObject(body) || !Array.isArray(body.rows ?? []) || !Array.isArray(body.blocks ?? [])) bad("Invalid page layout.");
  const rows = (body.rows ?? []).map((row) => {
    if (!isObject(row) || !ROW_ID.test(row.id ?? "")) bad("Invalid page row.");
    if (!COLUMN_WIDTHS.some((option) => JSON.stringify(option) === JSON.stringify(row.widths))) bad("Choose one of the column layouts.");
    return { id: row.id, widths: row.widths };
  });
  if (rows.length > PORTAL_LIMITS.rows) bad(`A page can have up to ${PORTAL_LIMITS.rows} rows.`);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) bad("Invalid page row.");
  const blocks = body.blocks ?? [];
  if (blocks.length > PORTAL_LIMITS.blocks) bad(`A page can have up to ${PORTAL_LIMITS.blocks} blocks.`);
  const seen = new Set();
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const out = blocks.map((block) => {
    if (!isObject(block) || !BLOCK_ID.test(block.id ?? "") || seen.has(block.id)) bad("Invalid block.");
    seen.add(block.id);
    const at = isObject(block.at) && rowsById.has(block.at.row) ? {
      row: block.at.row,
      col: Math.min(Math.max(0, Number.isInteger(block.at.col) ? block.at.col : 0), rowsById.get(block.at.row).widths.length - 1),
      order: Number.isInteger(block.at.order) ? block.at.order : 0,
    } : null;
    const g = block.grid;
    const grid = isObject(g) ? {
      x: clamp(g.x, 0, GRID.columns - 1), y: clamp(g.y, 0, GRID.maxRows),
      w: clamp(g.w, 1, GRID.columns), h: clamp(g.h, 1, 120),
    } : null;
    if (grid && grid.x + grid.w > GRID.columns) grid.w = GRID.columns - grid.x;
    return { id: block.id, kind: block.kind, config: validateBlock(block, ctx), ...(at ? { at } : {}), ...(grid ? { grid } : {}) };
  });
  return { rows, blocks: out };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isInteger(value) ? value : min));

// Validates a page from the builder; blocks are validated against the workspace definition and roles.
export function validatePageInput(input, { definition, roles, pages, pageId = null }) {
  if (!isObject(input)) bad("Describe the page.");
  const existing = pageId ? pages.find((page) => page.id === pageId && !page.deletedAt) : null;
  if (pageId && !existing) throw new WorkspaceError("not_found", 404, "That page no longer exists.");
  const kind = existing?.kind ?? (input.kind === "record" ? "record" : "page");
  const objectId = existing?.objectId ?? (kind === "record" ? input.objectId : null);
  if (kind === "record") {
    if (!UUID.test(objectId ?? "") || !definition.objects.some((object) => object.id === objectId && !object.deletedAt)) bad("Choose a list for this record page.");
    if (!existing && pages.some((page) => !page.deletedAt && page.kind === "record" && page.objectId === objectId)) bad("That list already has a record page.");
  }
  const title = typeof (input.title ?? existing?.title) === "string" ? (input.title ?? existing.title).trim() : "";
  if (!title || title.length > 80) bad("Name the page (up to 80 characters).");
  let slug = input.slug ?? existing?.slug ?? slugifyPage(title);
  if (kind === "record") slug = existing?.slug ?? `record-${slugifyPage(definition.objects.find((object) => object.id === objectId).key)}`;
  if (!SLUG.test(slug)) bad("Use lowercase letters, numbers and dashes for the address.");
  if (kind === "page" && ["r", "sign-in", "invite", "api", "account"].includes(slug)) bad("That address is reserved. Choose another.");
  if (kind === "page" && pages.some((page) => !page.deletedAt && page.id !== pageId && page.kind === "page" && page.slug === slug)) bad("Another page already uses that address.");
  const icon = typeof (input.icon ?? existing?.icon) === "string" ? (input.icon ?? existing.icon).slice(0, 60) : "file";
  const layout = input.layout ?? existing?.layout ?? "blocks";
  if (!LAYOUTS.includes(layout)) bad("Choose blocks or canvas.");
  const audienceInput = input.audience ?? existing?.audience ?? {};
  if (!isObject(audienceInput)) bad("Choose who sees this page.");
  const roleIds = new Set(roles.filter((role) => !role.deletedAt).map((role) => role.id));
  const audience = {
    roles: Array.isArray(audienceInput.roles) ? [...new Set(audienceInput.roles.filter((id) => roleIds.has(id)))] : [],
    public: audienceInput.public === true,
    team: audienceInput.team === true,
    nav: audienceInput.nav !== false,
  };
  const ctx = { definition, kind, objectId, audience };
  const body = validateBody(input.body ?? existing?.body, ctx);
  if (layout === "blocks" && body.blocks.some((block) => !block.at)) {
    if (!body.rows.length) body.rows.push({ id: newRowId(), widths: [12] });
    const last = body.rows[body.rows.length - 1];
    let order = Math.max(-1, ...body.blocks.filter((block) => block.at?.row === last.id).map((block) => block.at.order));
    for (const block of body.blocks) if (!block.at) block.at = { row: last.id, col: 0, order: ++order };
  }
  if (layout === "canvas" && body.blocks.some((block) => !block.grid)) Object.assign(body, toCanvas(body));
  return { slug, title, icon, kind, objectId, audience, layout, body };
}

// Whether a page is open to a viewer with these roles (record pages follow the record's own rules instead).
export function pageOpenTo(page, { roleIds = [], publicRoleId = null, team = false }) {
  if (page.deletedAt) return false;
  if (page.kind === "record") return true;
  if (team) return page.audience?.team === true;
  if (page.audience?.public) return true;
  const allowed = new Set(page.audience?.roles ?? []);
  return roleIds.some((id) => id !== publicRoleId && allowed.has(id)) || (publicRoleId ? allowed.has(publicRoleId) : false);
}

// Navigation entries for a viewer, in builder order.
export function navigationFor(pages, viewer) {
  return pages.filter((page) => page.kind === "page" && page.audience?.nav !== false && pageOpenTo(page, viewer))
    .sort((a, b) => a.position - b.position)
    .map((page) => ({ id: page.id, slug: page.slug, title: page.title, icon: page.icon }));
}
