"use client";

import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { SegmentedTabs } from "@geiger/ui/segmented-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";

// One control for every "pick one of a fixed set" field in the editor.
//
//   <= 2 options -> geiger-ui SegmentedTabs, an icon+label pair. A dropdown for
//                   two choices costs two clicks and hides the other option.
//   >= 3 options -> geiger-ui Select. Past two, a tab rail stops fitting the
//                   column and a dropdown scans better.
//
// Controls whose options are *art* (page layouts, image framing, colour
// swatches) deliberately keep their own renderers — collapsing a thumbnail
// gallery into a dropdown loses the thing being chosen.
const TAB_MAX = 2;

// Options are written as `{ key, label }` in lib/ and `{ value, label }` in the
// ticket screens; both spellings are accepted everywhere.
export const optionKey = (o) => o.key ?? o.value;

// Attaches a lucide component per option without pulling lucide into the lib
// data modules, which the public event page also imports.
export const withIcons = (options, icons) =>
  options.map((o) => ({ ...o, icon: icons[optionKey(o)] }));

// Radix works in strings; callers store numbers (logo heights, border widths),
// so map the picked string back through the options to restore its type.
function resolve(options, raw) {
  const hit = options.find((o) => String(optionKey(o)) === raw);
  return hit ? optionKey(hit) : raw;
}

export function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}) {
  return (
    <Select
      disabled={disabled}
      value={value === undefined || value === null ? "" : String(value)}
      onValueChange={(raw) => onChange(resolve(options, raw))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder || "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(optionKey(o))} value={String(optionKey(o))}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Segmented({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}) {
  if (!options?.length) return null;

  if (options.length <= TAB_MAX) {
    return (
      <SegmentedTabs
        // The component ships `w-full sm:w-auto`; inside a Field (a stretched
        // flex column) `w-auto` resolves back to full width, so both
        // breakpoints have to be overridden to actually fit the content.
        className={cn("w-fit sm:w-fit", disabled && "opacity-50", className)}
        buttonClassName={disabled ? "pointer-events-none" : undefined}
        value={value === undefined || value === null ? "" : String(value)}
        // SegmentedTabs has no disabled prop, so a readonly control drops both
        // the pointer target and the handler.
        onChange={disabled ? undefined : (raw) => onChange(resolve(options, raw))}
        tabs={options.map((o) => ({
          value: String(optionKey(o)),
          label: o.label,
          icon: o.icon,
        }))}
      />
    );
  }

  return (
    <OptionSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
    />
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
