"use client";

import { cn } from "@/lib/utils";
import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";

// A labelled number input with an optional unit suffix — the common shape
// across the ticketing edit forms (percent, quantity, days).
export function NumField({ label, value, onChange, unit, hint, min = 0, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 tabular-nums"
        />
        {unit ? <span className="text-sm text-text-secondary">{unit}</span> : null}
      </div>
    </Field>
  );
}

// A compact segmented toggle for a section's "mode" choice (e.g. group
// purchasing Automatic ↔ Manual, refunds Auto ↔ Manual). Mirrors the
// Registrations view switch styling so it reads native to the suite.
export function Segmented({ value, onChange, options, className, size = "md" }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active
                ? "bg-surface-hover text-foreground"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
