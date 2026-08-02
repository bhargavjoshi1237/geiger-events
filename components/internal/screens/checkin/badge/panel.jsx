"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Shared chrome for the two inspector rails that flank the canvas. Both sides
// use the same rhythm so the workbench reads as one surface.
export function PanelSection({ label, children, className }) {
  return (
    <section className={cn("px-3 py-4", className)}>
      {label ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </p>
      ) : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// A label/description pair with a control pinned right — the row shape used for
// toggles and other single-control settings.
export function PanelRow({ title, description, control, className, muted }) {
  return (
    <div className={cn("flex items-center gap-3", muted && "opacity-50", className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{title}</p>
        {description ? (
          <p className="truncate text-xs text-text-tertiary">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function PanelDivider({ className }) {
  return <div className={cn("h-px bg-border", className)} />;
}

export default PanelSection;
