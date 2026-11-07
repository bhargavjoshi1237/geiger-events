"use client";

import React, { useState } from "react";

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { inputValue, parseLength, SETUP_STYLES } from "@/lib/event_design";
import { cn } from "@/lib/utils";

// Small form controls shared by the Event Design dialogs, drawers and inspector (lengths are always metres outside).

const UNIT_TABS = [
  { value: "m", label: "m" },
  { value: "ft", label: "ft" },
];

export function UnitToggle({ value, onChange, className }) {
  return (
    <SegmentedTabs
      tabs={UNIT_TABS}
      value={value === "ft" ? "ft" : "m"}
      onChange={onChange}
      className={cn("w-auto sm:w-auto", className)}
      buttonClassName="h-7 px-2.5 text-xs"
    />
  );
}

// A length typed in the display unit; reports metres. Keeps its own text while typing so "6." survives.
export function LengthInput({ metres, unit = "m", onChange, min = 0.01, placeholder, className, ...props }) {
  const shown = inputValue(metres, unit);
  const [draft, setDraft] = useState(shown);
  const [synced, setSynced] = useState(shown);
  if (shown !== synced) {
    setSynced(shown);
    setDraft(shown);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const m = parseLength(text, unit);
          if (m !== null && m >= min) {
            setSynced(inputValue(m, unit));
            onChange(m);
          }
        }}
        onBlur={() => setDraft(shown)}
        className="pr-9 tabular-nums"
        {...props}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
        {unit}
      </span>
    </div>
  );
}

// Whole-number input (seats, rows) that never reports NaN.
export function CountInput({ value, onChange, min = 0, max = 999, className, ...props }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
      }}
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
}

export function SetupStyleSelect({ value, onChange, className, triggerClassName }) {
  return (
    <Select value={value || "custom"} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", triggerClassName)} aria-label="Setup style">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={className}>
        {SETUP_STYLES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Sentinel for "no selection" inside a Radix Select (which can't hold an empty value).
export const NONE = "__none__";

export function EventSelect({ events, value, onChange, allowNone = true, placeholder = "Pick an event" }) {
  return (
    <Select value={value || (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {allowNone ? <SelectItem value={NONE}>No event</SelectItem> : null}
        {(events || []).map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name || "Untitled event"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
