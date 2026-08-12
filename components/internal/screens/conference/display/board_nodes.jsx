"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Presentation } from "lucide-react";

import { catalogEntry, summarizeSlide } from "@/lib/display/constants";

// The one node type on the board canvas: a slide in the playback queue. Every
// slide is the same shape (unlike workflows, which distinguishes trigger /
// condition / action), so the queue reads as a filmstrip rather than a
// branching graph. Semantic tokens only — no hardcoded hex.
export const SlideNode = memo(function SlideNode({ data, selected }) {
  const entry = catalogEntry(data?.type);
  const Icon = entry?.icon || Presentation;
  const summary = summarizeSlide({ type: data?.type, config: data?.config });

  return (
    <div
      className={`w-[260px] rounded-xl border bg-surface-subtle p-3 shadow-md transition-colors ${
        selected ? "border-foreground" : "border-border hover:border-border-strong"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-text-tertiary"
      />

      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              {typeof data?.index === "number" ? `Slide ${data.index + 1}` : "Slide"}
            </p>
            <span className="shrink-0 rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-secondary">
              {data?.duration ?? entry?.duration ?? 10}s
            </span>
          </div>
          <p className="truncate text-sm font-medium text-foreground">
            {entry?.label || data?.type || "Slide"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{summary}</p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-foreground"
      />
    </div>
  );
});

// Map consumed by ReactFlow's `nodeTypes`.
export const nodeTypes = { slide: SlideNode };
