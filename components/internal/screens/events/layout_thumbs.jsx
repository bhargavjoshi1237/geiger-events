"use client";

import { cn } from "@/lib/utils";

// Wireframes for the layout gallery. Two kinds: hand-drawn glyphs for the built
// in code layouts, and a generic one derived from a builder tree — which means
// presets and anything a user saves get an honest thumbnail for free.

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

export const CLASSIC_THUMBS = {
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

// How each block type reads in a wireframe: its height, and whether it is a
// "buy" surface that should carry the brand colour.
const BLOCK_HEIGHT = {
  "hero-banner": 22,
  "hero-split": 18,
  "hero-centered": 16,
  gallery: 18,
  image: 14,
  video: 14,
  speakers: 12,
  testimonials: 10,
  pricing: 14,
  register: 16,
  table: 10,
  schedule: 12,
  marquee: 7,
  divider: 2,
  spacer: 4,
  titlebar: 5,
  "sticky-cta": 5,
  "checkout-button": 5,
  stats: 6,
  "logo-wall": 6,
  urgency: 4,
  countdown: 8,
};

const BRANDED = new Set([
  "pricing",
  "register",
  "checkout-button",
  "cta",
  "sticky-cta",
  "email-capture",
  "urgency",
  "countdown",
  "buttons",
]);

const GRIDDED = { gallery: 6, speakers: 4, testimonials: 3, "logo-wall": 4 };

function ThumbBlock({ node, accent }) {
  const height = BLOCK_HEIGHT[node.type] ?? 8;
  const cells = GRIDDED[node.type];

  if (cells) {
    return (
      <div className="grid grid-cols-3 gap-[2px]" style={{ height }}>
        {Array.from({ length: cells }).map((_, i) => (
          <div key={i} className="rounded-[1px] bg-foreground/20" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="rounded-[2px]"
      style={{
        height,
        backgroundColor: BRANDED.has(node.type)
          ? accent
          : "color-mix(in srgb, currentColor 16%, transparent)",
        opacity: BRANDED.has(node.type) ? 0.85 : 1,
      }}
    />
  );
}

// A wireframe of a real builder tree: sections stacked, columns weighted by
// their span, blocks drawn at a height that hints at what they are.
export function TreeThumb({ tree, accent = "currentColor", maxSections = 7 }) {
  const sections = (tree?.sections || []).slice(0, maxSections);
  if (!sections.length) {
    return (
      <div className="flex h-full items-center justify-center text-[0.6rem] text-text-tertiary">
        Empty page
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1 overflow-hidden text-foreground">
      {sections.map((section) => {
        const tinted = section.style?.background?.type !== "none";
        return (
          <div
            key={section.id}
            className={cn(
              "flex flex-col gap-1 rounded-[2px] px-1 py-1",
              tinted && "bg-foreground/[0.06]",
            )}
          >
            {(section.rows || []).slice(0, 3).map((row) => (
              <div key={row.id} className="flex gap-1">
                {(row.columns || []).map((column) => (
                  <div
                    key={column.id}
                    className="flex min-w-0 flex-col gap-[3px]"
                    style={{ flexGrow: column.span || 12, flexBasis: 0 }}
                  >
                    {(column.components || []).slice(0, 4).map((node) => (
                      <ThumbBlock key={node.id} node={node} accent={accent} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
