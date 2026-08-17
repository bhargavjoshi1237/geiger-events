"use client";

// The layers outline.
//
// A canvas alone makes deep or overlapping structure hard to reach — an empty
// column, a section behind a full-bleed hero. This lists the tree, mirrors
// selection both ways, and offers the operations that are fiddly to hit on the
// canvas: rename a section, hide a block, drag something a long way.

import React from "react";
import {
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  GripVertical,
  Rows3,
  Square,
} from "lucide-react";

import { getComponentMeta } from "./components";
import { cn } from "@/lib/utils";

const INDENT = 12;

function labelFor(node, kind) {
  if (kind === "section") return node.name || "Section";
  if (kind === "row") return "Row";
  if (kind === "column") return `Column · ${node.span}/12`;
  return getComponentMeta(node.type)?.label || node.type;
}

const KIND_ICON = { section: Rows3, row: Columns3, column: Square, component: Square };

function LayerRow({
  node,
  kind,
  depth,
  selected,
  onSelect,
  onDragStart,
  onToggleVisible,
}) {
  const Icon = KIND_ICON[kind] || Square;
  const hidden = node.hidden === true;

  return (
    <div
      onClick={() => onSelect(node.id)}
      role="treeitem"
      aria-selected={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1 text-xs transition-colors",
        selected
          ? "bg-surface-active text-foreground"
          : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
      )}
      style={{ paddingLeft: depth * INDENT + 4 }}
    >
      <span
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart(e, { kind, nodeId: node.id });
        }}
        aria-label={`Move ${labelFor(node, kind)}`}
        className="cursor-grab text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <Icon className="h-3 w-3 shrink-0 text-text-tertiary" />
      <span className={cn("min-w-0 flex-1 truncate", hidden && "line-through opacity-50")}>
        {labelFor(node, kind)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible(node.id);
        }}
        aria-label={hidden ? "Show" : "Hide"}
        className={cn(
          "shrink-0 rounded p-0.5 text-text-tertiary transition-opacity hover:text-foreground group-hover:opacity-100",
          // A hidden node keeps its eye showing, otherwise the only clue it is
          // off is the strikethrough.
          hidden ? "opacity-100" : "opacity-0",
        )}
      >
        {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

// Recursive so a container component's children appear nested, exactly as they
// sit in the document.
function ComponentBranch({ nodes, depth, ...rest }) {
  return nodes.map((node) => (
    <React.Fragment key={node.id}>
      <LayerRow node={node} kind="component" depth={depth} selected={rest.selectedId === node.id} {...rest} />
      {Array.isArray(node.components) && node.components.length ? (
        <ComponentBranch nodes={node.components} depth={depth + 1} {...rest} />
      ) : null}
    </React.Fragment>
  ));
}

export function LayersPanel({
  tree,
  selectedId,
  onSelect,
  onDragStart,
  onToggleVisible,
}) {
  const shared = { selectedId, onSelect, onDragStart, onToggleVisible };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-text-tertiary">
        <ChevronRight className="h-3 w-3" /> Page structure
      </div>
      <div role="tree" className="flex-1 overflow-y-auto p-1.5">
        {(tree.sections || []).map((section) => (
          <React.Fragment key={section.id}>
            <LayerRow
              node={section}
              kind="section"
              depth={0}
              selected={selectedId === section.id}
              {...shared}
            />
            {(section.rows || []).map((row) => (
              <React.Fragment key={row.id}>
                <LayerRow
                  node={row}
                  kind="row"
                  depth={1}
                  selected={selectedId === row.id}
                  {...shared}
                />
                {(row.columns || []).map((column) => (
                  <React.Fragment key={column.id}>
                    <LayerRow
                      node={column}
                      kind="column"
                      depth={2}
                      selected={selectedId === column.id}
                      {...shared}
                    />
                    <ComponentBranch
                      nodes={column.components || []}
                      depth={3}
                      {...shared}
                    />
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default LayersPanel;
