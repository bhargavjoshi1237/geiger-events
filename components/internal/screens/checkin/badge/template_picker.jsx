"use client";

import React from "react";
import { Check, ChevronDown, Copy, Layers, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { stockSize } from "@/lib/passes/stock";
import { BADGE_TEMPLATES } from "../constants";

const Swatch = ({ color, className }) => (
  <span
    className={cn("h-3 w-3 shrink-0 rounded-full border border-border", className)}
    style={{ background: color || "#6366f1" }}
  />
);

// One picker for the whole design set: which design is open, how many passes it
// covers, what to do with it, and how to start a new one. A dropdown rather
// than a chip row so it still reads well at a dozen designs.
export function TemplatePicker({
  templates,
  selectedId,
  counts,
  onSelect,
  onAdd,
  onDuplicate,
  onSetDefault,
  onDelete,
}) {
  const active = templates.find((t) => t.id === selectedId) || templates[0];
  if (!active) return null;
  const activeCount = counts?.[active.id] ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 min-w-[200px] justify-between border-border bg-surface-card px-3 font-normal text-foreground hover:bg-surface-hover"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Swatch color={active.accent} />
            <span className="truncate">{active.name || "Untitled"}</span>
            {active.isDefault ? (
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-tertiary">
                Default
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-text-tertiary">
              {activeCount} pass{activeCount === 1 ? "" : "es"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 border-border bg-surface-subtle shadow-xl">
        <DropdownMenuLabel className="text-xs text-text-tertiary">
          Designs · {templates.length}
        </DropdownMenuLabel>

        {templates.map((t) => {
          const count = counts?.[t.id] ?? 0;
          return (
            <DropdownMenuItem key={t.id} onClick={() => onSelect(t.id)} className="gap-2">
              <Swatch color={t.accent} />
              <span className="min-w-0 flex-1 truncate">{t.name || "Untitled"}</span>
              {t.isDefault ? (
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-tertiary">
                  Default
                </span>
              ) : null}
              <span className="shrink-0 text-xs text-text-tertiary">{count}</span>
              {t.id === active.id ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-surface-strong" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Plus className="h-4 w-4" /> New design
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 border-border bg-surface-subtle shadow-xl">
            <DropdownMenuLabel className="text-xs text-text-tertiary">
              Start from a preset
            </DropdownMenuLabel>
            {BADGE_TEMPLATES.map((preset) => {
              const { wMm, hMm } = stockSize(preset.design?.stock);
              return (
                <DropdownMenuItem
                  key={preset.value}
                  className="items-start gap-3 py-2"
                  onClick={() => onAdd(preset.value)}
                >
                  {/* The outline is drawn to the preset's real aspect ratio, so
                      the shape of the pass is the thing you pick. */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <span
                      className="rounded-[2px] border border-border-strong bg-surface-card"
                      style={{
                        width: wMm >= hMm ? 32 : (wMm / hMm) * 32,
                        height: hMm > wMm ? 32 : (hMm / wMm) * 32,
                      }}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm text-foreground">{preset.label}</span>
                    <span className="text-xs leading-snug text-text-tertiary">{preset.desc}</span>
                    <span className="text-[11px] text-text-tertiary">
                      {Math.round(wMm)} × {Math.round(hMm)} mm
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-surface-strong" />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-text-tertiary">
          <Layers className="h-3.5 w-3.5" /> {active.name || "Untitled"}
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => onDuplicate(active.id)}>
          <Copy className="h-4 w-4" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem disabled={active.isDefault} onClick={() => onSetDefault(active.id)}>
          <Star className="h-4 w-4" /> Make default
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="text-red-400 focus:bg-red-500/10"
          disabled={templates.length === 1}
          onClick={() => onDelete(active.id)}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TemplatePicker;
