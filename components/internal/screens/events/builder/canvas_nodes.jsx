"use client";

// Editing chrome for the canvas.
//
// The canvas renders the *same* PageTree the published page does. Rather than
// wrapping nodes in extra elements — which would break the grid, since a column
// has to stay a direct child of its row — this decorates the elements the
// renderer already produced: it adds classes, a click-to-select handler, and
// absolutely-positioned overlays as extra children.

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

// Injected into the canvas document. Everything here is editor-only chrome, so
// it hangs off `.ev-editing` and never reaches the published page.
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
  /* Anything switched off would otherwise vanish from the canvas and be
     unreachable. In the editor it stays visible, faded, so you can select it
     and switch it back on — each kind restored to the display the compiler
     gives it. Breakpoint hiding is left alone on purpose: previewing a device
     should show what that device shows. */
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

/** Small floating toolbar shown on the selected node. */
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

/** The divider handle between two columns; drags the grid split in 1/12 steps. */
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

/**
 * Precompute each node's index among its siblings once per tree, so the
 * decorator can answer "is this the last column?" without re-walking.
 */
function buildIndex(tree) {
  const map = new Map();
  walk(tree, (node, path, kind) => {
    map.set(node.id, { path, kind, index: path[path.length - 1] });
  });
  // Sibling counts come from a second pass over the parents we already saw.
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

/**
 * Builds the `editing` object PageTree takes.
 *
 * @param tree        current tree
 * @param selectedId  selected node id
 * @param onSelect    (id) => void
 * @param onDragStart (event, payload) => void
 * @param onResize    (event, rowId, columnIndex) => void
 * @param onDuplicate (id) => void
 * @param onDelete    (id) => void
 * @param onAddInto   (columnId) => void
 */
export function useEditingChrome({
  tree,
  selectedId,
  onSelect,
  onDragStart,
  onResize,
  onDuplicate,
  onDelete,
  onAddInto,
}) {
  const index = useMemo(() => buildIndex(tree), [tree]);

  const wrapNode = useCallback(
    (node, kind, element) => {
      const selected = selectedId === node.id;
      const entry = index.get(node.id) || {};
      // The last section is the only thing keeping the canvas droppable, so it
      // never offers a delete.
      const canDelete = kind !== "section" || tree.sections.length > 1;
      const isLastColumn =
        kind === "column" && entry.index === (entry.siblingCount || 1) - 1;

      const overlays = (
        <React.Fragment key="ev-chrome">
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
    [index, selectedId, tree.sections.length, onSelect, onDragStart, onResize, onDuplicate, onDelete],
  );

  // An empty column is invisible without this, and an invisible column is one
  // you cannot drop into.
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

/**
 * The floating rail that shows where a drop will land. Rendered in the parent
 * document, in viewport coordinates, because the drag already works there.
 */
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
