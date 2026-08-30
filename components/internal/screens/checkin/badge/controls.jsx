"use client";

import React from "react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Slider } from "@geiger/ui";
import { cn } from "@/lib/utils";

// Full-size form controls for the inspector rails. Everything is the standard
// shadcn size — labels above, control below — so the rail matches the rest of
// the app instead of shrinking its own miniature widgets.

export function NumberField({ label, hint, value, onChange, min, max, step = 1, suffix, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("bg-surface-card", suffix && "pr-10")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

export function SelectField({ label, hint, value, onChange, options, placeholder, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-surface-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// Hex swatch + text entry. The native picker keeps colour choice quick without
// pulling in a colour-picker component.
export function ColorField({ label, hint, value, fallback, onChange, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-surface-card p-1"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="bg-surface-card font-mono text-xs"
        />
      </div>
    </Field>
  );
}

export function SliderField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "",
  className,
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex items-center gap-3">
        <Slider
          value={[Number(value)]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className="w-14 shrink-0 text-right text-xs text-text-tertiary">
          {Math.round(Number(value) * 100) / 100}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

export function TextField({ label, hint, value, onChange, placeholder, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-surface-card"
      />
    </Field>
  );
}
