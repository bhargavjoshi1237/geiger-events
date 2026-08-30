"use client";

import React from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  GitCommitVertical,
  LayoutGrid,
  Rows2,
  Rows3,
  Settings2,
  Square,
  SquareDashed,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@geiger/ui/popover";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

export const SCHEDULE_LAYOUTS = [
  { key: "list", label: "List", hint: "Stacked rows", icon: Rows3 },
  { key: "flex", label: "Grid", hint: "Two columns", icon: LayoutGrid },
  { key: "timeline", label: "Timeline", hint: "Vertical rail", icon: GitCommitVertical },
];

export const SCHEDULE_GAPS = [
  { key: "tight", label: "Tight", icon: ChevronsDownUp },
  { key: "normal", label: "Normal", icon: Rows2 },
  { key: "wide", label: "Wide", icon: ChevronsUpDown },
];

export const SCHEDULE_FRAMES = [
  { key: "boxed", label: "Boxed", hint: "In a panel", icon: Square },
  { key: "bare", label: "Bare", hint: "No panel", icon: SquareDashed },
];

function LayoutArt({ kind }) {
  const bar = "rounded-[2px] bg-current";
  if (kind === "flex") {
    return (
      <div className="grid h-7 w-full grid-cols-2 gap-1 opacity-70">
        <span className={cn(bar, "h-full")} />
        <span className={cn(bar, "h-full")} />
      </div>
    );
  }
  if (kind === "timeline") {
    return (
      <div className="flex h-7 w-full items-stretch gap-1 opacity-70">
        <span className="w-px shrink-0 bg-current" />
        <div className="flex flex-1 flex-col justify-between py-px">
          <span className={cn(bar, "h-1.5 w-3/4")} />
          <span className={cn(bar, "h-1.5 w-2/3")} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-7 w-full flex-col justify-between opacity-70">
      <span className={cn(bar, "h-1.5")} />
      <span className={cn(bar, "h-1.5")} />
      <span className={cn(bar, "h-1.5 w-2/3")} />
    </div>
  );
}

// A tile in a ChoiceRow. Either draws purpose-made art (spatial options, where a
// tiny diagram beats any icon) or falls back to the option's icon.
function ChoiceTile({ option, active, onClick, render }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={option.hint || option.label}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border px-2 py-2.5 transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface-card text-muted-foreground hover:border-border-strong hover:bg-surface-active hover:text-foreground",
      )}
    >
      {render ? render(option) : Icon ? <Icon className="h-5 w-5" /> : null}
      <span className="text-[11px] font-medium leading-none">{option.label}</span>
    </button>
  );
}

export function ChoiceRow({ label, hint, value, onChange, options, render, columns }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <ChoiceTile
            key={o.key}
            option={o}
            active={value === o.key}
            onClick={() => onChange(o.key)}
            render={render}
          />
        ))}
      </div>
    </div>
  );
}

export function ScheduleStyleButton({ section, onChange, disabled }) {
  const set = (key) => (value) => onChange({ ...section, [key]: value });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Settings2 className="h-4 w-4" /> Schedule style
        </Button>
      </PopoverTrigger>
      {/* Sits alongside the schedule dialogs, so it takes the dialog surface
          rather than the popover one — same panel, different trigger. */}
      <PopoverContent align="end" className="w-80 space-y-4 bg-surface-subtle p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Schedule style</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applies to the whole Schedule section on your public page.
          </p>
        </div>

        <ChoiceRow
          label="Layout"
          value={section.layout}
          onChange={set("layout")}
          options={SCHEDULE_LAYOUTS}
          render={(o) => <LayoutArt kind={o.key} />}
        />
        <ChoiceRow
          label="Gap"
          value={section.spacing}
          onChange={set("spacing")}
          options={SCHEDULE_GAPS}
        />
        <ChoiceRow
          label="Frame"
          value={section.frame}
          onChange={set("frame")}
          options={SCHEDULE_FRAMES}
        />

        <Field
          label="Section note"
          hint="Shown under the “Schedule” heading."
          htmlFor="sched-section-note"
        >
          <Textarea
            id="sched-section-note"
            rows={2}
            value={section.sectionNote || ""}
            onChange={(e) => set("sectionNote")(e.target.value)}
            placeholder="e.g. All times are in Pacific Time."
          />
        </Field>
      </PopoverContent>
    </Popover>
  );
}

export default ScheduleStyleButton;
