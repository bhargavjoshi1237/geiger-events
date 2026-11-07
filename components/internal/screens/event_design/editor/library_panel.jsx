"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { formatDimensions, groupByCategory, searchCatalog } from "@/lib/event_design";
import { CATEGORY_FILTER_OPTIONS } from "../constants";
import { ObjectGlyph } from "../object_glyph";
import { DRAG_MIME } from "./editor_canvas";

// Left zone: what can be added. Search + category filter; drag a row onto the canvas, or click to drop it in view.
export function LibraryPanel({ catalog, unit, onAdd }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const groups = useMemo(
    () => groupByCategory(searchCatalog(catalog, { query, category })),
    [catalog, query, category],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search objects…"
            aria-label="Search objects"
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-text-secondary">No objects match.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-3 last:mb-0">
              <p className="px-2 pb-1 pt-1 text-xs font-medium text-text-tertiary">{group.label}</p>
              <ul className="space-y-0.5">
                {group.objects.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_MIME, o.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onAdd(o)}
                      title={`${o.name} — drag onto the plan or click to add`}
                      className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover active:cursor-grabbing"
                    >
                      <ObjectGlyph object={o} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{o.name}</span>
                        <span className="block truncate text-[11px] tabular-nums text-text-tertiary">
                          {formatDimensions(o.widthM, o.depthM, unit)}
                          {o.seats ? ` · ${o.seats} seat${o.seats === 1 ? "" : "s"}` : ""}
                          {o.projectId ? " · Custom" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LibraryPanel;
