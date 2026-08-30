"use client";

import { cn } from "@/lib/utils";
import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";

// A labelled number input with an optional unit suffix — the common shape
// across the ticketing edit forms (percent, quantity, days). By default the
// input is a compact `w-24` with the unit sitting beside it; `fullWidth` lets
// it span its grid cell and moves the unit inside the field as a right-aligned
// suffix so nothing is squeezed out.
export function NumField({
  label,
  value,
  onChange,
  unit,
  hint,
  min = 0,
  fullWidth = false,
  className,
}) {
  const input = (
    <Input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={cn(
        "tabular-nums",
        fullWidth ? cn("w-full", unit && "pr-16") : "w-24",
      )}
    />
  );

  return (
    <Field label={label} hint={hint} className={className}>
      {fullWidth && unit ? (
        <div className="relative w-full">
          {input}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-secondary">
            {unit}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {input}
          {unit ? <span className="text-sm text-text-secondary">{unit}</span> : null}
        </div>
      )}
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
