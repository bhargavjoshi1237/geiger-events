"use client";

import React from "react";
import { Tag } from "lucide-react";

import { cn } from "@/lib/utils";

// A discount code rendered as a coupon: a tinted value panel on the left, a
// pinched "waist" (semicircle notches punched into the left and right edges at
// mid-height) and the code itself in a dashed cut-out chip. Deliberately a
// different silhouette from TicketStub — that one tears vertically, this one
// pinches horizontally. Clicking anywhere fires `onToggle`; `control` (the
// attach Switch) stops propagation so it doesn't double-fire.
export function DiscountStub({
  code,
  discountType,
  value,
  usageLimit,
  active = true,
  attached = false,
  onToggle,
  control,
}) {
  const isFlat = discountType === "flat";
  const amount = Number(value) || 0;

  const metaItems = [
    { label: Number(usageLimit) > 0 ? `${usageLimit} uses` : "Unlimited uses" },
    active ? null : { label: "Inactive", muted: true },
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle?.();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer overflow-hidden rounded-xl bg-surface-card text-left transition-colors hover:bg-surface-active",
        !active && "opacity-70",
      )}
    >
      {/* Value panel — the coupon's headline number. */}
      <div
        className={cn(
          "flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-4 transition-colors",
          attached ? "bg-primary/15 text-primary" : "bg-surface-subtle text-muted-foreground",
        )}
      >
        <span className="text-xl font-semibold leading-none tabular-nums">
          {isFlat ? `$${amount}` : amount}
          {isFlat ? null : <span className="text-sm">%</span>}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest">off</span>
      </div>

      {/* Tear line between the value panel and the body. */}
      <div
        aria-hidden
        className="w-px shrink-0 self-stretch border-l border-dashed border-border"
      />

      {/* Body — code chip + meta. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface-subtle px-2 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-foreground">
              <Tag className="h-3 w-3 text-text-tertiary" />
              {code || "NO CODE"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-text-secondary">
            <span className={attached ? "text-text-secondary" : "text-text-tertiary"}>
              {attached ? "Works on this event" : "Not attached"}
            </span>
            {metaItems.map((item) => (
              <React.Fragment key={item.label}>
                <span aria-hidden className="text-text-tertiary/40">|</span>
                <span className={item.muted ? "text-text-tertiary" : undefined}>
                  {item.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
        {control ? (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {control}
          </div>
        ) : null}
      </div>

      {/* Pinched waist — notches punched to the canvas colour on both edges. */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background"
      />
      <span
        aria-hidden
        className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-background"
      />
    </div>
  );
}

export default DiscountStub;
