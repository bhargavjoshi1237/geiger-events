"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { PAGE_LAYOUTS, PAGE_LAYOUT_CATEGORIES } from "@/lib/events/theme";
import { cn } from "@/lib/utils";

// Wireframe primitives. Everything is drawn from the current text colour so a
// thumbnail reads correctly in either viewer theme without its own palette.
const Fill = ({ className }) => (
  <div className={cn("rounded-[2px] bg-foreground/15", className)} />
);
const Solid = ({ className }) => (
  <div className={cn("rounded-[2px] bg-foreground/45", className)} />
);
const Line = ({ className }) => (
  <div className={cn("h-[3px] rounded-full bg-foreground/25", className)} />
);
const Lines = ({ n = 3, className }) => (
  <div className={cn("space-y-1", className)}>
    {Array.from({ length: n }).map((_, i) => (
      <Line key={i} className={i === n - 1 ? "w-2/3" : "w-full"} />
    ))}
  </div>
);

// One wireframe per PAGE_LAYOUTS key. They exist to make the difference between
// eighteen arrangements legible at a glance — they are not previews of content.
const THUMBS = {
  classic: () => (
    <div className="flex h-full gap-1.5">
      <div className="flex flex-1 flex-col gap-1.5">
        <Fill className="h-8" />
        <Lines n={3} />
      </div>
      <div className="flex w-1/3 flex-col gap-1.5">
        <Solid className="h-7" />
        <Fill className="h-4" />
      </div>
    </div>
  ),
  anchored: () => (
    <div className="flex h-full gap-1.5">
      <div className="w-1/5 space-y-1 border-l border-foreground/20 pl-1">
        <Line className="w-full bg-foreground/50" />
        <Line className="w-3/4" />
        <Line className="w-3/4" />
      </div>
      <div className="flex-1 space-y-1.5">
        <Fill className="h-6" />
        <Lines n={3} />
      </div>
      <Solid className="w-1/5" />
    </div>
  ),
  agenda: () => (
    <div className="flex h-full flex-col gap-1.5">
      <Fill className="h-4 shrink-0" />
      <div className="flex flex-1 gap-1.5">
        <div className="flex-1 space-y-1.5 rounded-[2px] bg-foreground/[0.07] p-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <Line className="w-1/5 bg-foreground/40" />
              <Line className="flex-1" />
            </div>
          ))}
        </div>
        <Solid className="w-1/4" />
      </div>
    </div>
  ),
  appshell: () => (
    <div className="flex h-full gap-1.5">
      <div className="w-1/4 space-y-1 rounded-[2px] bg-foreground/[0.09] p-1">
        <Line className="w-3/4 bg-foreground/50" />
        <Solid className="h-2" />
        <Line className="w-full" />
        <Line className="w-2/3" />
      </div>
      <div className="flex-1 space-y-1.5">
        <Fill className="h-7" />
        <Lines n={3} />
      </div>
    </div>
  ),
  spotlight: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="relative flex-1">
        <Fill className="h-full" />
        <div className="absolute inset-x-1.5 bottom-1.5 space-y-1">
          <Line className="w-2/3 bg-foreground/50" />
          <Solid className="h-2 w-1/3" />
        </div>
      </div>
      <Solid className="h-3 shrink-0" />
    </div>
  ),
  split: () => (
    <div className="flex h-full gap-1.5">
      <div className="relative w-1/2">
        <Fill className="h-full" />
        <div className="absolute inset-x-1.5 bottom-1.5 space-y-1">
          <Line className="w-3/4 bg-foreground/50" />
          <Solid className="h-2 w-1/2" />
        </div>
      </div>
      <div className="flex w-1/2 flex-col gap-2 pt-1">
        <Lines n={3} />
        <Lines n={2} />
      </div>
    </div>
  ),
  glass: () => (
    <div className="relative h-full">
      <Fill className="absolute inset-0" />
      <div className="absolute inset-x-3 inset-y-1.5 space-y-1 rounded-[3px] border border-foreground/25 bg-foreground/10 p-1.5">
        <Line className="w-2/3 bg-foreground/50" />
        <Lines n={2} />
      </div>
    </div>
  ),
  gallery: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid grid-cols-4 grid-rows-2 gap-1">
        <Fill className="col-span-2 row-span-2 h-full" />
        <Fill />
        <Fill />
        <Fill />
        <Fill />
      </div>
      <Lines n={2} className="pt-0.5" />
    </div>
  ),
  marquee: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center gap-2 border-y border-foreground/20 py-1.5">
        <div className="h-2.5 w-1/2 shrink-0 rounded-[2px] bg-foreground/45" />
        <div className="h-2.5 w-1/2 shrink-0 rounded-[2px] bg-foreground/45" />
      </div>
      <div className="flex flex-1 gap-1.5">
        <div className="flex-1 space-y-1">
          <Fill className="h-5" />
          <Lines n={2} />
        </div>
        <Solid className="w-1/4" />
      </div>
    </div>
  ),
  magazine: () => (
    <div className="flex h-full flex-col items-center gap-1.5">
      <Line className="w-1/2 bg-foreground/50" />
      <Fill className="h-6 w-full" />
      <div className="w-2/3 space-y-1 pt-0.5">
        <Lines n={2} />
        <Solid className="h-3 w-full" />
        <Lines n={2} />
      </div>
    </div>
  ),
  poster: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="space-y-1">
        <div className="h-2 w-full rounded-[2px] bg-foreground/45" />
        <div className="h-2 w-3/4 rounded-[2px] bg-foreground/45" />
      </div>
      <div className="flex flex-1 gap-1.5 pt-1">
        <div className="flex-1 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Line className="w-1/6" />
              <Line className="flex-1" />
            </div>
          ))}
        </div>
        <Fill className="w-1/4" />
      </div>
    </div>
  ),
  showcase: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex flex-1 items-center gap-1.5">
        <div className="flex-1 space-y-1">
          <Line className="w-3/4 bg-foreground/50" />
          <Line className="w-1/2" />
          <Solid className="h-2 w-1/3" />
        </div>
        <Fill className="h-full w-2/5" />
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Fill className="h-4 flex-1" />
        <Fill className="h-4 flex-1" />
      </div>
    </div>
  ),
  landing: () => (
    <div className="flex h-full flex-col gap-1">
      <Fill className="h-7" />
      <div className="flex-1 rounded-[2px] bg-foreground/[0.07] p-1">
        <Lines n={2} />
      </div>
      <Solid className="h-3" />
      <div className="h-3 rounded-[2px] bg-foreground/[0.07]" />
    </div>
  ),
  zigzag: () => (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex items-center gap-1.5">
        <Fill className="h-5 w-2/5" />
        <Lines n={2} className="flex-1" />
      </div>
      <div className="flex items-center gap-1.5">
        <Lines n={2} className="flex-1" />
        <Fill className="h-5 w-2/5" />
      </div>
    </div>
  ),
  bento: () => (
    <div className="grid h-full grid-cols-3 grid-rows-3 gap-1.5">
      <Fill className="col-span-2 row-span-2" />
      <Solid className="row-span-2" />
      <Fill />
      <Fill />
      <Fill />
    </div>
  ),
  checkout: () => (
    <div className="flex h-full gap-1.5">
      <div className="flex flex-1 flex-col gap-1.5">
        <Line className="w-1/2 bg-foreground/50" />
        <Solid className="h-10" />
        <Lines n={2} />
      </div>
      <div className="flex w-1/4 flex-col gap-1.5">
        <Fill className="h-5" />
        <Lines n={3} />
      </div>
    </div>
  ),
  boxoffice: () => (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Fill className="h-5 flex-1" />
        <Line className="mt-2 w-1/3" />
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-[2px] border border-foreground/20 p-1"
          >
            <Line className="w-2/3" />
            <Solid className="h-2" />
          </div>
        ))}
      </div>
    </div>
  ),
  stack: () => (
    <div className="mx-auto flex h-full w-3/5 flex-col gap-1.5">
      <Fill className="h-6" />
      <Solid className="h-4" />
      <Fill className="h-3" />
      <Fill className="h-3" />
    </div>
  ),
};

function LayoutCard({ layout, active, onChange }) {
  const Thumb = THUMBS[layout.key];
  return (
    <button
      type="button"
      onClick={() => onChange(layout.key)}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-surface-active"
          : "border-border bg-surface-subtle hover:bg-surface-active",
      )}
    >
      <div className="aspect-[16/10] w-full rounded-lg border border-border bg-surface-card p-2">
        {Thumb ? <Thumb /> : null}
      </div>
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {layout.label}
          {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
        </p>
        <p className="text-xs leading-relaxed text-text-secondary">
          {layout.desc}
        </p>
      </div>
    </button>
  );
}

export function LayoutPicker({ value, onChange }) {
  const current = value || "classic";
  // "All" groups by category so the whole set can be read top to bottom; a
  // single category narrows it once the organizer knows what they're after.
  const [filter, setFilter] = useState("all");
  const shown = PAGE_LAYOUT_CATEGORIES.filter(
    (c) => filter === "all" || c.key === filter,
  );

  const chip = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        filter === key
          ? "border-primary bg-surface-active text-foreground"
          : "border-border text-text-secondary hover:bg-surface-active hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {chip("all", `All ${PAGE_LAYOUTS.length}`)}
        {PAGE_LAYOUT_CATEGORIES.map((c) => chip(c.key, c.label))}
      </div>

      {shown.map((cat) => (
        <div key={cat.key} className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">{cat.label}</p>
            <p className="text-xs text-text-secondary">{cat.desc}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PAGE_LAYOUTS.filter((l) => l.category === cat.key).map((l) => (
              <LayoutCard
                key={l.key}
                layout={l}
                active={current === l.key}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
