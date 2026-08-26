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


const SEGMENTED_MAX = 4;

const optionKey = (o) => o.key ?? o.value;

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
                ? "border-primary bg-primary/10 text-foreground"
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

export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <span className="relative h-9 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
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
