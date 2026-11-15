"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Move, Plus, Trash2 } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BLOCK_KINDS } from "@/lib/workspace/portal/blocks.js";
import { COLUMN_WIDTHS, GRID } from "@/lib/workspace/portal/contracts.js";
import { BlockView } from "@/components/workspace_portal/render/block_view";
import { canvasBottom, duplicateBlock, moveBlock, moveRow, nudgeBlock, placeOnGrid, removeBlock, removeRow, setRowWidths, updateBlock } from "./body_ops";

const SPAN = { 3: "@3xl/page:col-span-3", 4: "@3xl/page:col-span-4", 6: "@3xl/page:col-span-6", 8: "@3xl/page:col-span-8", 9: "@3xl/page:col-span-9", 12: "@3xl/page:col-span-12" };
const GAP = 16;

// A tiny picture of a column split, for the row toolbar.
function SplitIcon({ widths }) {
  return (
    <span className="flex h-3.5 w-6 gap-px">
      {widths.map((width, index) => <span key={index} className="h-full rounded-[2px] bg-current" style={{ flex: width }} />)}
    </span>
  );
}

function ToolButton({ label, onClick, children, disabled }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30">
      {children}
    </button>
  );
}

// The selection outline and the small toolbar around a block in the editor.
function BlockChrome({ block, selected, onSelect, interactive, tools, dragProps, fill = false, children }) {
  return (
    <div onClick={(event) => { event.stopPropagation(); onSelect(block.id); }}
      className={cn("group/block relative rounded-xl outline-2 outline-offset-4", selected ? "outline outline-primary" : "hover:outline hover:outline-1 hover:outline-border", fill && "h-full")}>
      <div className={cn("absolute -top-3.5 left-3 z-20 items-center gap-0.5 rounded-md border border-border bg-surface-card px-1 py-0.5 shadow-sm",
        selected ? "flex" : "hidden group-hover/block:flex")}>
        <span {...dragProps} className={cn("flex h-6 items-center gap-1 px-1 text-xs font-medium text-text-secondary", dragProps && "cursor-grab active:cursor-grabbing")}>
          {dragProps?.onPointerDown ? <Move className="h-3.5 w-3.5" /> : <GripVertical className="h-3.5 w-3.5" />}{BLOCK_KINDS[block.kind]?.label}
        </span>
        {tools}
      </div>
      <div className={cn("min-w-0", !interactive && "pointer-events-none select-none", fill && "h-full")}>{children}</div>
    </div>
  );
}

function AddHere({ onAdd, label = "Add block" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" onClick={(event) => event.stopPropagation()}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-text-secondary hover:border-foreground/30 hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />{label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-1">
        <div className="grid grid-cols-2 gap-0.5">
          {Object.entries(BLOCK_KINDS).map(([kind, meta]) => (
            <button key={kind} type="button" onClick={() => onAdd(kind)} className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-subtle">{meta.label}</button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Blocks layout: rows of 1–3 columns. Drag a block by its label to move it; each row can change its split.
export function EditRows({ page, selected, onSelect, onBody, interactive, onAdd }) {
  const body = page.body ?? { rows: [], blocks: [] };
  const [dragging, setDragging] = useState(null);
  const [drop, setDrop] = useState(null);

  const columnBlocks = (rowId, col) => (body.blocks ?? []).filter((block) => block.at?.row === rowId && block.at?.col === col).sort((a, b) => a.at.order - b.at.order);
  const finish = (target) => {
    if (dragging && target) onBody(moveBlock(body, dragging, target));
    setDragging(null);
    setDrop(null);
  };
  const same = (a, b) => a && b && a.row === b.row && a.col === b.col && a.order === b.order;

  return (
    <div className="@container/page grid gap-6" onClick={() => onSelect(null)}>
      {(body.rows ?? []).map((row, rowIndex) => (
        <div key={row.id} className="group/row relative rounded-xl border border-dashed border-transparent p-2 hover:border-border">
          <div className="absolute -top-3.5 right-3 z-20 hidden items-center gap-0.5 rounded-md border border-border bg-surface-card px-1 py-0.5 shadow-sm group-hover/row:flex">
            {COLUMN_WIDTHS.map((widths) => (
              <button key={widths.join("-")} type="button" title={`Columns ${widths.join(" / ")}`}
                onClick={(event) => { event.stopPropagation(); onBody(setRowWidths(body, row.id, widths)); }}
                className={cn("flex h-6 items-center rounded px-1", JSON.stringify(widths) === JSON.stringify(row.widths) ? "bg-surface-active text-foreground" : "text-text-tertiary hover:text-foreground")}>
                <SplitIcon widths={widths} />
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-border" />
            <ToolButton label="Move row up" disabled={rowIndex === 0} onClick={() => onBody(moveRow(body, row.id, -1))}><ArrowUp className="h-3.5 w-3.5" /></ToolButton>
            <ToolButton label="Move row down" disabled={rowIndex === body.rows.length - 1} onClick={() => onBody(moveRow(body, row.id, 1))}><ArrowDown className="h-3.5 w-3.5" /></ToolButton>
            <ToolButton label="Delete row" onClick={() => onBody(removeRow(body, row.id))}><Trash2 className="h-3.5 w-3.5" /></ToolButton>
          </div>
          <div className="grid grid-cols-1 gap-4 @3xl/page:grid-cols-12">
            {row.widths.map((width, col) => {
              const blocks = columnBlocks(row.id, col);
              const end = { row: row.id, col, order: blocks.length };
              return (
                <div key={col} className={cn("grid min-w-0 content-start gap-5", SPAN[width])}>
                  {blocks.map((block) => {
                    const before = { row: row.id, col, order: block.at.order };
                    const after = { row: row.id, col, order: block.at.order + 1 };
                    return (
                      <div key={block.id} className="relative"
                        onDragOver={(event) => {
                          if (!dragging) return;
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setDrop(event.clientY < rect.top + rect.height / 2 ? before : after);
                        }}
                        onDrop={(event) => { event.preventDefault(); finish(drop); }}>
                        {same(drop, before) ? <div className="absolute -top-3 left-0 right-0 h-0.5 rounded bg-primary" /> : null}
                        <BlockChrome block={block} selected={selected === block.id} onSelect={onSelect} interactive={interactive}
                          dragProps={{ draggable: true, onDragStart: (event) => { event.dataTransfer.effectAllowed = "move"; setDragging(block.id); }, onDragEnd: () => finish(null) }}
                          tools={(
                            <>
                              <ToolButton label="Move up" onClick={() => onBody(nudgeBlock(body, block.id, -1))}><ArrowUp className="h-3.5 w-3.5" /></ToolButton>
                              <ToolButton label="Move down" onClick={() => onBody(nudgeBlock(body, block.id, 1))}><ArrowDown className="h-3.5 w-3.5" /></ToolButton>
                              <ToolButton label="Duplicate" onClick={() => { const next = duplicateBlock(body, block.id); onBody(next.body); onSelect(next.id); }}><Copy className="h-3.5 w-3.5" /></ToolButton>
                              <ToolButton label="Delete" onClick={() => { onBody(removeBlock(body, block.id)); onSelect(null); }}><Trash2 className="h-3.5 w-3.5" /></ToolButton>
                            </>
                          )}>
                          <BlockView block={block} />
                        </BlockChrome>
                        {same(drop, after) ? <div className="absolute -bottom-3 left-0 right-0 h-0.5 rounded bg-primary" /> : null}
                      </div>
                    );
                  })}
                  <div onDragOver={(event) => { if (dragging) { event.preventDefault(); setDrop(end); } }} onDrop={(event) => { event.preventDefault(); finish(end); }}
                    className={cn("rounded-lg", same(drop, end) && "ring-2 ring-primary")}>
                    <AddHere onAdd={(kind) => onAdd(kind, { row: row.id, col })} label={blocks.length ? "Add" : "Add block"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-5">
        <span className="text-sm text-text-secondary">New row</span>
        {COLUMN_WIDTHS.map((widths) => (
          <Button key={widths.join("-")} type="button" variant="outline" size="sm" title={`Columns ${widths.join(" / ")}`}
            onClick={(event) => { event.stopPropagation(); onAdd(null, { widths }); }}>
            <SplitIcon widths={widths} />
          </Button>
        ))}
      </div>
    </div>
  );
}

// Canvas layout: free placement on a 12-column grid. Drag a block by its label; drag the corner to resize.
export function EditCanvas({ page, selected, onSelect, onBody, interactive, onAdd }) {
  const body = page.body ?? { rows: [], blocks: [] };
  const ref = useRef(null);
  const liveRef = useRef(null);
  const [width, setWidth] = useState(960);
  const [live, setLive] = useState(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const colWidth = (width + GAP) / GRID.columns;
  const rows = Math.max(canvasBottom(body), live ? live.grid.y + live.grid.h : 0) + 8;

  const start = (event, block, kind) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(block.id);
    const origin = { x: event.clientX, y: event.clientY, grid: block.grid ?? { x: 0, y: 0, w: 12, h: 8 } };
    const move = (e) => {
      const dx = (e.clientX - origin.x) / colWidth;
      const dy = (e.clientY - origin.y) / GRID.rowHeight;
      const g = origin.grid;
      const grid = kind === "move" ? placeOnGrid({ ...g, x: g.x + dx, y: g.y + dy }) : placeOnGrid({ ...g, w: g.w + dx, h: g.h + dy });
      liveRef.current = { id: block.id, grid };
      setLive(liveRef.current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (liveRef.current) onBody(updateBlock(body, liveRef.current.id, { grid: liveRef.current.grid }));
      liveRef.current = null;
      setLive(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="@container/page grid gap-4" onClick={() => onSelect(null)}>
      <div ref={ref} className="relative" style={{ height: rows * GRID.rowHeight }}>
        {live ? (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-12 gap-4">
            {Array.from({ length: GRID.columns }, (_, i) => <div key={i} className="h-full rounded bg-surface-active/40" />)}
          </div>
        ) : null}
        {(body.blocks ?? []).map((block) => {
          const g = live?.id === block.id ? live.grid : block.grid ?? { x: 0, y: 0, w: 12, h: 8 };
          return (
            <div key={block.id} className="absolute" style={{ left: g.x * colWidth, top: g.y * GRID.rowHeight, width: g.w * colWidth - GAP, height: g.h * GRID.rowHeight - GAP }}>
              <BlockChrome block={block} selected={selected === block.id} onSelect={onSelect} interactive={interactive} fill
                dragProps={{ onPointerDown: (event) => start(event, block, "move") }}
                tools={(
                  <>
                    <ToolButton label="Duplicate" onClick={() => { const next = duplicateBlock(body, block.id); onBody(next.body); onSelect(next.id); }}><Copy className="h-3.5 w-3.5" /></ToolButton>
                    <ToolButton label="Delete" onClick={() => { onBody(removeBlock(body, block.id)); onSelect(null); }}><Trash2 className="h-3.5 w-3.5" /></ToolButton>
                  </>
                )}>
                <div className="h-full overflow-hidden"><BlockView block={block} fill /></div>
              </BlockChrome>
              <span onPointerDown={(event) => start(event, block, "resize")} aria-label="Resize" role="presentation"
                className={cn("absolute -bottom-1.5 -right-1.5 z-20 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-border bg-surface-card", selected === block.id ? "block" : "hidden")} />
            </div>
          );
        })}
      </div>
      <AddHere onAdd={(kind) => onAdd(kind, null)} label="Add block at the bottom" />
    </div>
  );
}
