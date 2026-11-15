import { BLOCK_HEIGHTS } from "@/lib/workspace/portal/blocks.js";
import { GRID } from "@/lib/workspace/portal/contracts.js";
import { newBlockId, newRowId } from "@/lib/workspace/portal/pages.js";

// Pure edits to a page body ({ rows, blocks }); every function returns a new body.
const blocksOf = (body) => body.blocks ?? [];
const rowsOf = (body) => body.rows ?? [];

// Renumbers each column's blocks 0..n so orders stay tidy after a move.
function tidy(body) {
  const byColumn = new Map();
  for (const block of blocksOf(body)) {
    if (!block.at) continue;
    const key = `${block.at.row}:${block.at.col}`;
    if (!byColumn.has(key)) byColumn.set(key, []);
    byColumn.get(key).push(block);
  }
  const orders = new Map();
  for (const list of byColumn.values()) list.sort((a, b) => a.at.order - b.at.order).forEach((block, index) => orders.set(block.id, index));
  return { ...body, blocks: blocksOf(body).map((block) => (block.at ? { ...block, at: { ...block.at, order: orders.get(block.id) } } : block)) };
}

export const canvasBottom = (body) => blocksOf(body).reduce((max, block) => Math.max(max, (block.grid?.y ?? 0) + (block.grid?.h ?? 0)), 0);

export function addRow(body, widths = [12]) {
  return { ...body, rows: [...rowsOf(body), { id: newRowId(), widths }] };
}

// Adds a block to a column (blocks layout) or under everything (canvas). Returns { body, id }.
export function addBlock(body, kind, config, { layout, row = null, col = 0 } = {}) {
  const id = newBlockId();
  if (layout === "canvas") {
    const grid = { x: 0, y: canvasBottom(body), w: GRID.columns, h: BLOCK_HEIGHTS[kind] ?? 8 };
    return { body: { ...body, blocks: [...blocksOf(body), { id, kind, config, grid }] }, id };
  }
  let next = body;
  let rowId = row;
  if (!rowId || !rowsOf(next).some((item) => item.id === rowId)) {
    next = addRow(next, [12]);
    rowId = rowsOf(next)[rowsOf(next).length - 1].id;
  }
  const order = blocksOf(next).filter((block) => block.at?.row === rowId && block.at?.col === col).length;
  return { body: { ...next, blocks: [...blocksOf(next), { id, kind, config, at: { row: rowId, col, order } }] }, id };
}

export function removeBlock(body, id) {
  return tidy({ ...body, blocks: blocksOf(body).filter((block) => block.id !== id) });
}

export function duplicateBlock(body, id) {
  const source = blocksOf(body).find((block) => block.id === id);
  if (!source) return { body, id: null };
  const copy = { ...structuredClone(source), id: newBlockId() };
  if (copy.at) copy.at = { ...copy.at, order: copy.at.order + 0.5 };
  if (copy.grid) copy.grid = { ...copy.grid, y: copy.grid.y + copy.grid.h };
  return { body: tidy({ ...body, blocks: [...blocksOf(body), copy] }), id: copy.id };
}

export function updateBlock(body, id, patch) {
  return { ...body, blocks: blocksOf(body).map((block) => (block.id === id ? { ...block, ...patch } : block)) };
}

// Moves a block to a column, before the block at `order` (or to the end).
export function moveBlock(body, id, { row, col, order }) {
  const moved = blocksOf(body).map((block) => (block.id === id ? { ...block, at: { row, col, order: order - 0.5 } } : block));
  return tidy({ ...body, blocks: moved });
}

// Moves a block one place up or down inside its column, or into the row above/below at the ends.
export function nudgeBlock(body, id, direction) {
  const block = blocksOf(body).find((item) => item.id === id);
  if (!block?.at) return body;
  const column = blocksOf(body).filter((item) => item.at?.row === block.at.row && item.at?.col === block.at.col).sort((a, b) => a.at.order - b.at.order);
  const index = column.findIndex((item) => item.id === id);
  if (direction < 0 && index > 0) return moveBlock(body, id, { row: block.at.row, col: block.at.col, order: column[index - 1].at.order });
  if (direction > 0 && index < column.length - 1) return moveBlock(body, id, { row: block.at.row, col: block.at.col, order: column[index + 1].at.order + 1 });
  const rows = rowsOf(body);
  const rowIndex = rows.findIndex((row) => row.id === block.at.row);
  const target = rows[rowIndex + direction];
  if (!target) return body;
  const col = Math.min(block.at.col, target.widths.length - 1);
  const order = direction < 0 ? 1e6 : -1;
  return moveBlock(body, id, { row: target.id, col, order });
}

// Changes a row's columns; blocks in columns that disappear move to the last remaining column.
export function setRowWidths(body, rowId, widths) {
  const last = widths.length - 1;
  return tidy({
    ...body,
    rows: rowsOf(body).map((row) => (row.id === rowId ? { ...row, widths } : row)),
    blocks: blocksOf(body).map((block) => (block.at?.row === rowId && block.at.col > last ? { ...block, at: { ...block.at, col: last, order: 1000 + block.at.order } } : block)),
  });
}

export function moveRow(body, rowId, direction) {
  const rows = [...rowsOf(body)];
  const index = rows.findIndex((row) => row.id === rowId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return body;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  return { ...body, rows };
}

export function removeRow(body, rowId) {
  return { ...body, rows: rowsOf(body).filter((row) => row.id !== rowId), blocks: blocksOf(body).filter((block) => block.at?.row !== rowId) };
}

// Keeps a canvas block inside the 12 columns.
export function placeOnGrid(grid) {
  const w = Math.max(1, Math.min(GRID.columns, Math.round(grid.w)));
  const x = Math.max(0, Math.min(GRID.columns - w, Math.round(grid.x)));
  return { x, y: Math.max(0, Math.min(GRID.maxRows, Math.round(grid.y))), w, h: Math.max(2, Math.min(120, Math.round(grid.h))) };
}
