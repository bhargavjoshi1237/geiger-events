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

// The ticketing screens used to carry their own pill toggle here. It is now a
// re-export of the canonical control in events/theme_controls, which picks a
// geiger-ui SegmentedTabs pair for two options and a geiger-ui Select for
// three or more. Re-exported (rather than re-pointed at the 11 call sites) so
// those imports stay as they are.
export { Segmented, withIcons } from "../events/theme_controls";
