"use client";

// Section-level schedule styling.
//
// Layout, gap, frame and the section note describe the whole Schedule section,
// not one item — the public renderer reads them off the first item, so the
// editor fans any change across the list. They used to sit in the per-item
// dialog, where changing "Gap" while adding one item silently rewrote every
// other item in the schedule. Here their scope is stated instead of hidden.

import React from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const SCHEDULE_LAYOUTS = [
  { key: "list", label: "List", hint: "Stacked rows" },
  { key: "flex", label: "Grid", hint: "Two columns" },
  { key: "timeline", label: "Timeline", hint: "Vertical rail" },
];

export const SCHEDULE_GAPS = [
  { key: "tight", label: "Tight" },
  { key: "normal", label: "Normal" },
  { key: "wide", label: "Wide" },
];

export const SCHEDULE_FRAMES = [
  { key: "boxed", label: "Boxed", hint: "In a panel" },
  { key: "bare", label: "Bare", hint: "No panel" },
];

// Miniature drawings of each layout — the same idea as the image-position
// pickers in the item dialog. A word like "Flex" tells you nothing; a shape does.
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

function GapArt({ kind }) {
  const gap = kind === "tight" ? "gap-[2px]" : kind === "wide" ? "gap-[7px]" : "gap-1";
  return (
    <div className={cn("flex h-7 w-full flex-col justify-center opacity-70", gap)}>
      <span className="h-1.5 rounded-[2px] bg-current" />
      <span className="h-1.5 rounded-[2px] bg-current" />
    </div>
  );
}

function FrameArt({ kind }) {
  return (
    <div
      className={cn(
        "flex h-7 w-full flex-col justify-center gap-1 rounded p-1 opacity-70",
        kind === "boxed" ? "border border-current" : "border border-dashed border-current/30",
      )}
    >
      <span className="h-1.5 rounded-[2px] bg-current" />
      <span className="h-1.5 w-2/3 rounded-[2px] bg-current" />
    </div>
  );
}

/** A row of illustrated choices. Replaces the old text-pill Segmented rows. */
export function ChoiceRow({ label, hint, value, onChange, options, render, columns }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="text-[11px] text-text-tertiary">{hint}</span>
        ) : null}
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              aria-pressed={active}
              title={o.hint || o.label}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-active hover:text-foreground",
              )}
            >
              {render ? render(o) : null}
              <span className="text-[11px] font-medium leading-none">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleStyleButton({ section, onChange, disabled }) {
  const set = (key) => (value) => onChange({ ...section, [key]: value });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" /> Schedule style
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Schedule style</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
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
          render={(o) => <GapArt kind={o.key} />}
        />
        <ChoiceRow
          label="Frame"
          value={section.frame}
          onChange={set("frame")}
          options={SCHEDULE_FRAMES}
          render={(o) => <FrameArt kind={o.key} />}
        />

        <div className="space-y-1.5">
          <label
            htmlFor="sched-section-note"
            className="text-xs font-medium text-foreground"
          >
            Section note
          </label>
          <Textarea
            id="sched-section-note"
            rows={2}
            value={section.sectionNote || ""}
            onChange={(e) => set("sectionNote")(e.target.value)}
            placeholder="e.g. All times are in Pacific Time."
          />
          <p className="text-[11px] text-text-tertiary">
            Shown under the “Schedule” heading.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ScheduleStyleButton;
