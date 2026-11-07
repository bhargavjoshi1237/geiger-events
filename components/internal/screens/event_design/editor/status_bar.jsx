"use client";

import React from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";

import { formatArea, setupStyleLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";

// Bottom dock, always visible: counts, capacity against the space, and the validation flags (click to select them).

function Item({ children, className }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>{children}</span>;
}

function FlagButton({ count, label, onClick }) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
    >
      <TriangleAlert className="h-3.5 w-3.5" />
      {count} {label}
    </button>
  );
}

export function StatusBar({ stats, unit, setupStyle, capacity, dirty, version, saving, onSelectIds, extra }) {
  const over = capacity && stats.seats > capacity;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-subtle px-4 py-2.5 text-xs text-text-secondary tabular-nums">
      <Item>
        <span className="font-medium text-foreground">{stats.objectCount}</span> objects
      </Item>
      <Item>
        <span className={cn("font-medium", over ? "text-red-600 dark:text-red-400" : "text-foreground")}>
          {stats.seats}
          {capacity ? ` / ${capacity}` : ""}
        </span>
        seats{capacity ? ` · ${setupStyleLabel(setupStyle).toLowerCase()} capacity` : " placed"}
      </Item>
      <Item>{formatArea(stats.areaM2, unit)}</Item>
      <FlagButton count={stats.outsideIds.length} label="outside the room" onClick={() => onSelectIds(stats.outsideIds)} />
      <FlagButton count={stats.overlappingIds.length} label="overlapping" onClick={() => onSelectIds(stats.overlappingIds)} />
      {!stats.flaggedIds.length && stats.objectCount ? (
        <Item className="text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="h-3.5 w-3.5" /> Everything fits
        </Item>
      ) : null}
      {extra}
      <span className="ml-auto whitespace-nowrap text-text-tertiary">
        {saving ? "Saving…" : dirty ? "Unsaved changes" : `Saved · v${version}`}
      </span>
    </div>
  );
}

export default StatusBar;
