"use client";

import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Small theme-editing primitives shared by the per-event Design section
// (page_design.jsx) and the Event Wall's Design section — both compile edits
// through lib/events/theme.js's theme model.

// Above this many choices a segmented row wraps onto three lines and stops
// being scannable, so it becomes a dropdown instead.
const SEGMENTED_MAX = 4;

const optionKey = (o) => o.key ?? o.value;

// Compact dropdown over the same `{ key|value, label }` options a Segmented
// takes. Keys are coerced to strings for the Select and mapped back on the way
// out, so numeric option keys (column counts, sizes) survive the round trip.
export function OptionSelect({ value, onChange, options, placeholder }) {
  const pick = (raw) => {
    const hit = options.find((o) => String(optionKey(o)) === raw);
    onChange(hit ? optionKey(hit) : raw);
  };
  return (
    <Select value={value === undefined || value === null ? "" : String(value)} onValueChange={pick}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder || "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={optionKey(o)} value={String(optionKey(o))}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Segmented control — even buttons over a row, one selected. `options` are
// `{ key|value, label }`; the resolved key is passed to `onChange`. Long option
// lists fall through to OptionSelect so a design panel stays compact; pass
// `alwaysSegmented` when the row itself is the point (a 5-way alignment picker).
export function Segmented({ value, onChange, options, alwaysSegmented = false }) {
  if (!alwaysSegmented && options.length > SEGMENTED_MAX) {
    return <OptionSelect value={value} onChange={onChange} options={options} />;
  }
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
