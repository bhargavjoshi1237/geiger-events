"use client";

import React from "react";
import { Copy, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { stockSize } from "@/lib/passes/stock";
import { BADGE_TEMPLATES } from "../constants";

// The saved-designs rail. Selecting a template loads it into the editor; the
// per-row menu covers duplicate / make default / delete.
export function TemplateList({
  templates,
  selectedId,
  counts,
  onSelect,
  onAdd,
  onDuplicate,
  onSetDefault,
  onDelete,
}) {
  return (
    <SectionCard
      title="Templates"
      description="One design per ticket tier, or a single default for everyone."
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 border-border bg-surface-subtle shadow-xl">
            <DropdownMenuLabel className="text-xs text-text-tertiary">
              Start from a preset
            </DropdownMenuLabel>
            {BADGE_TEMPLATES.map((preset) => (
              <DropdownMenuItem
                key={preset.value}
                className="flex-col items-start gap-0.5"
                onClick={() => onAdd(preset.value)}
              >
                <span className="text-sm text-foreground">{preset.label}</span>
                <span className="text-xs text-text-tertiary">{preset.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="space-y-2">
        {templates.map((t) => {
          const { wMm, hMm } = stockSize(t.stock);
          const tiers = Array.isArray(t.tiers) ? t.tiers : [];
          const count = counts?.[t.id] ?? 0;
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 transition-colors",
                t.id === selectedId
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-card hover:border-border-strong",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {t.name || "Untitled"}
                  {t.isDefault ? (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Default" />
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-text-secondary">
                  {wMm} × {hMm} mm · {count} pass{count === 1 ? "" : "es"}
                </p>
                {tiers.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {tiers.map((tier) => (
                      <span
                        key={tier}
                        className="rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] text-text-secondary"
                      >
                        {tier}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[10px] text-text-tertiary">
                    {t.isDefault ? "Fallback for unmatched tiers" : "No tiers bound"}
                  </p>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Actions for ${t.name || "template"}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 border-border bg-surface-subtle shadow-xl">
                  <DropdownMenuItem onClick={() => onDuplicate(t.id)}>
                    <Copy className="h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={t.isDefault} onClick={() => onSetDefault(t.id)}>
                    <Star className="h-4 w-4" /> Make default
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-surface-strong" />
                  <DropdownMenuItem
                    variant="destructive"
                    className="text-red-400 focus:bg-red-500/10"
                    disabled={templates.length === 1}
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export default TemplateList;
