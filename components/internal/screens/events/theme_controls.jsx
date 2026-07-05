"use client";

import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Small theme-editing primitives shared by the per-event Design section
// (page_design.jsx) and the Event Wall's Design section — both compile edits
// through lib/events/theme.js's theme model.

// Segmented control — even buttons over a row, one selected. `options` are
// `{ key|value, label }`; the resolved key is passed to `onChange`.
export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const key = o.key ?? o.value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "min-w-[72px] flex-1 break-words rounded-lg border px-3 py-2 text-xs font-medium leading-tight transition-colors",
              value === key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Color picker — a native swatch plus an editable hex field.
export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <span className="relative h-9 w-10 shrink-0 overflow-hidden rounded-md border border-border">
          <span
            className="block h-full w-full"
            style={{ backgroundColor: value || "#000000" }}
          />
          <input
            type="color"
            aria-label={label}
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs"
        />
      </div>
    </Field>
  );
}
