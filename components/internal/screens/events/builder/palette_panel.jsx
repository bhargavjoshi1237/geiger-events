"use client";

// The palette: everything you can add to a page.
//
// Two ways to add, because both are natural and people reach for different ones:
// drag an item onto the canvas to place it exactly, or click it to append to
// whatever is selected. Dragging is the same pointer engine the canvas uses, so
// a palette item and an existing block behave identically once in flight.

import { useMemo, useState } from "react";
import { Search, Rows3 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { COLUMN_PRESETS } from "@/lib/events/page_tree";
import { cn } from "@/lib/utils";
import {
  COMPONENT_CATEGORIES,
  componentsInCategory,
} from "./components";

// A preset's spans drawn as proportional bars — faster to read than "8 / 4".
function PresetGlyph({ spans }) {
  return (
    <span className="flex h-4 w-full items-stretch gap-0.5">
      {spans.map((span, i) => (
        <span
          key={i}
          className="rounded-[2px] bg-text-tertiary/40"
          style={{ flexGrow: span }}
        />
      ))}
    </span>
  );
}

function PaletteTile({ label, icon: Icon, glyph, onPointerDown, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={disabled ? undefined : onPointerDown}
      onClick={disabled ? undefined : onClick}
      title={disabled ? `${label} is already on this page` : label}
      className={cn(
        "flex select-none flex-col items-start gap-2 rounded-xl border border-border bg-surface-card p-2.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-grab hover:border-border-strong hover:bg-surface-active active:cursor-grabbing",
      )}
    >
      {glyph || (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        </span>
      )}
      <span className="text-[0.7rem] font-medium leading-tight text-foreground">
        {label}
      </span>
    </button>
  );
}

/**
 * @param usedTypes   types already on the page, to grey out singletons
 * @param canUseCustomCode gates the raw-HTML / code components
 * @param onDragItem  (event, payload) => void
 * @param onAddItem   (payload) => void
 */
export function PalettePanel({
  usedTypes,
  canUseCustomCode,
  onDragItem,
  onAddItem,
}) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();

  const categories = useMemo(
    () =>
      COMPONENT_CATEGORIES.map((category) => ({
        ...category,
        items: componentsInCategory(category.key).filter(
          (item) =>
            (!item.requiresCustomCode || canUseCustomCode) &&
            (!search || item.label.toLowerCase().includes(search)),
        ),
      })).filter((category) => category.items.length),
    [search, canUseCustomCode],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks"
            className="h-8 bg-surface-card pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {!search ? (
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-text-tertiary">
              <Rows3 className="h-3 w-3" /> Sections
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_PRESETS.map((preset) => (
                <PaletteTile
                  key={preset.key}
                  label={preset.label}
                  glyph={<PresetGlyph spans={preset.spans} />}
                  onPointerDown={(e) =>
                    onDragItem(e, { kind: "section", spans: preset.spans })
                  }
                  onClick={() => onAddItem({ kind: "section", spans: preset.spans })}
                />
              ))}
            </div>
          </section>
        ) : null}

        {categories.map((category) => (
          <section key={category.key} className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-tertiary">
              {category.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {category.items.map((item) => {
                // A smart event section describes one thing about the event, so
                // a second copy would just repeat itself.
                const disabled = item.singleton && usedTypes.has(item.type);
                return (
                  <PaletteTile
                    key={item.type}
                    label={item.label}
                    icon={item.icon}
                    disabled={disabled}
                    onPointerDown={(e) =>
                      onDragItem(e, { kind: "component", type: item.type })
                    }
                    onClick={() => onAddItem({ kind: "component", type: item.type })}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {!categories.length ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-tertiary">
            No blocks match “{query}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default PalettePanel;
