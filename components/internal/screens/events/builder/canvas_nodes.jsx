"use client";

import React, { useCallback, useMemo } from "react";
import {
  GripVertical,
  Copy,
  Trash2,
  Plus,
  Columns3,
  Rows3,
  Square,
} from "lucide-react";

import { walk } from "@/lib/events/page_tree";
import { cn } from "@/lib/utils";

const KIND_LABEL = {
  section: "Section",
  row: "Row",
  column: "Column",
  component: "Block",
};

const KIND_ICON = {
  section: Rows3,
  row: Columns3,
  column: Square,
  component: Square,
};

export const EDITING_CSS = `
  .ev-editing [data-ev-kind="section"],
  .ev-editing [data-ev-kind="row"],
  .ev-editing [data-ev-kind="component"] { position: relative; }
  .ev-editing [data-ev] { outline: 1px dashed transparent; outline-offset: -1px; transition: outline-color .12s; }
  .ev-editing [data-ev]:hover { outline-color: color-mix(in srgb, var(--primary) 45%, transparent); }
  .ev-editing [data-ev].ev-selected { outline: 2px solid var(--primary); outline-offset: -2px; }
  .ev-editing [data-ev-kind="column"] { min-height: 3.5rem; }
  .ev-editing [data-ev-kind="row"] { min-height: 3.5rem; }
  .ev-editing .ev-chrome { position: absolute; z-index: 40; }
  .ev-editing .ev-off { opacity: .35; }
  .ev-editing [data-ev-kind="section"].ev-off { display: block; }
  .ev-editing [data-ev-kind="row"].ev-off { display: grid; }
  .ev-editing [data-ev-kind="column"].ev-off { display: flex; }
  .ev-editing [data-ev-kind="component"].ev-off { display: block; }
  .ev-editing .ev-off::after {
    content: "hidden"; position: absolute; top: 0; right: 0; z-index: 30;
    padding: 1px 5px; border-radius: 0 0 0 6px;
    background: var(--surface-active); color: var(--text-tertiary);
    font-size: 10px; letter-spacing: .04em; pointer-events: none;
  }
`;

function NodeToolbar({ kind, onDragStart, onDuplicate, onDelete, canDelete }) {
  const Icon = KIND_ICON[kind] || Square;
  return (
    <div className="ev-chrome -top-8 left-0 flex items-center gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5 shadow-lg">
      <span
        onPointerDown={onDragStart}
        role="button"
        tabIndex={-1}
        aria-label={`Move ${KIND_LABEL[kind]}`}
        className="flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-[0.7rem] font-medium text-text-secondary hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
        <Icon className="h-3 w-3" />
        {KIND_LABEL[kind]}
      </span>
      <button
        type="button"
        onClick={onDuplicate}
        aria-label="Duplicate"
        className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="rounded p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function ResizeHandle({ onPointerDown }) {
  return (
    <span
      onPointerDown={onPointerDown}
      role="separator"
      aria-label="Resize column"
      className="ev-chrome inset-y-0 -right-3 z-40 flex w-6 cursor-col-resize items-center justify-center"
    >
      <span className="h-10 w-1 rounded-full bg-primary/0 transition-colors hover:bg-primary" />
    </span>
  );
}

// The scale handles on a selected node: drag the bottom edge of a section to
// change its padding, the right edge of a row or block to change its gap or
// width. Each walks a named scale rather than setting free pixels, so what you
// drag out stays inside the design system.
function ScaleHandle({ axis, label, onPointerDown }) {
  const vertical = axis === "y";
  return (
    <span
      onPointerDown={onPointerDown}
      role="separator"
      aria-label={label}
      title={label}
      className={cn(
        "ev-chrome z-40 flex items-center justify-center",
        vertical
          ? "inset-x-0 -bottom-2 h-4 cursor-ns-resize"
          : "inset-y-0 -right-2 w-4 cursor-ew-resize",
      )}
    >
      <span
        className={cn(
          "rounded-full bg-primary/30 transition-colors hover:bg-primary",
          vertical ? "h-1 w-12" : "h-12 w-1",
        )}
      />
    </span>
  );
}

function buildIndex(tree) {
  const map = new Map();
  walk(tree, (node, path, kind) => {
    map.set(node.id, { path, kind, index: path[path.length - 1] });
  });
  walk(tree, (node) => {
    const children = node.rows || node.columns || node.components;
    if (!Array.isArray(children)) return;
    children.forEach((child) => {
      const entry = map.get(child.id);
      if (entry) {
        entry.siblingCount = children.length;
        entry.parentId = node.id;
      }
    });
  });
  return map;
}

const SCALE_HANDLE = {
  section: { axis: "y", label: "Drag to change this section's padding" },
  row: { axis: "x", label: "Drag to change the gap between columns" },
  component: { axis: "x", label: "Drag to change this block's width" },
};

export function useEditingChrome({
  tree,
  selectedId,
  onSelect,
  onDragStart,
  onResize,
  onScale,
  onDuplicate,
  onDelete,
  onAddInto,
}) {
  const index = useMemo(() => buildIndex(tree), [tree]);

  const wrapNode = useCallback(
    (node, kind, element) => {
      const selected = selectedId === node.id;
      const entry = index.get(node.id) || {};
      const canDelete = kind !== "section" || tree.sections.length > 1;
      const isLastColumn =
        kind === "column" && entry.index === (entry.siblingCount || 1) - 1;

      const scale = selected ? SCALE_HANDLE[kind] : null;

      const overlays = (
        <React.Fragment key="ev-chrome">
          {scale ? (
            <ScaleHandle
              axis={scale.axis}
              label={scale.label}
              onPointerDown={(e) => onScale(e, { kind, id: node.id })}
            />
          ) : null}
          {selected ? (
            <NodeToolbar
              kind={kind}
              canDelete={canDelete}
              onDragStart={(e) => onDragStart(e, { kind, nodeId: node.id })}
              onDuplicate={(e) => {
                e.stopPropagation();
                onDuplicate(node.id);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
            />
          ) : null}
          {kind === "column" && !isLastColumn ? (
            <ResizeHandle
              onPointerDown={(e) => onResize(e, entry.parentId, entry.index)}
            />
          ) : null}
        </React.Fragment>
      );

      return React.cloneElement(
        element,
        {
          className: cn(
            element.props.className,
            selected && "ev-selected",
            node.hidden === true && "ev-off",
          ),
          onClick: (e) => {
            e.stopPropagation();
            onSelect(node.id);
          },
        },
        element.props.children,
        overlays,
      );
    },
    [
      index,
      selectedId,
      tree.sections.length,
      onSelect,
      onDragStart,
      onResize,
      onScale,
      onDuplicate,
      onDelete,
    ],
  );

  const renderColumnAffordance = useCallback(
    (node) => {
      if ((node.components || []).length) return null;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddInto(node.id);
          }}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-6 text-xs text-text-tertiary transition-colors hover:border-primary hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add a block
        </button>
      );
    },
    [onAddInto],
  );

  return useMemo(
    () => ({ wrapNode, renderColumnAffordance }),
    [wrapNode, renderColumnAffordance],
  );
}

// Follows the cursor while a scale handle is being dragged, so the value being
// changed is readable without looking away at the inspector.
export function ScaleReadout({ scaling }) {
  if (!scaling) return null;
  return (
    <div
      className="pointer-events-none fixed z-[80] rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium tabular-nums text-foreground shadow-lg"
      style={{ left: scaling.x + 14, top: scaling.y + 14 }}
    >
      {scaling.label}
    </div>
  );
}

export function DropIndicator({ hit }) {
  if (!hit?.rect) return null;
  const { rect, orientation, after } = hit;

  if (orientation === "area") {
    return (
      <div
        className="pointer-events-none fixed z-[70] rounded-lg border-2 border-primary bg-primary/10"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      />
    );
  }

  const vertical = orientation === "vertical";
  return (
    <div
      className="pointer-events-none fixed z-[70] rounded-full bg-primary"
      style={
        vertical
          ? {
              left: (after ? rect.right : rect.left) - 1.5,
              top: rect.top,
              width: 3,
              height: rect.height,
            }
          : {
              left: rect.left,
              top: (after ? rect.bottom : rect.top) - 1.5,
              width: rect.width,
              height: 3,
            }
      }
    />
  );
}
