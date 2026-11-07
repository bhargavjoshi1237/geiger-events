"use client";

import React, { useMemo } from "react";

import { ActionMenu } from "@geiger/ui";
import { StatusPill } from "@/components/internal/shared/screen_kit";
import { formatDimensions, planSummary, setupStyleLabel } from "@/lib/event_design";
import { PlanRenderer } from "./plan_renderer";
import { PLAN_STATUS_MAP } from "./constants";

// Gallery card for a plan / template / library diagram: a live read-only render, name, links and counts.
export function PlanCard({ plan, subtitle, badges, actions, onOpen, showStatus = true, footerAction }) {
  const summary = useMemo(() => planSummary(plan), [plan]);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle transition-colors hover:border-border-strong">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
        aria-label={`Open ${plan.name}`}
        className="relative block h-44 w-full cursor-pointer border-b border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <PlanRenderer plan={plan} showLabels={false} padding={0.08} className="pointer-events-none" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{plan.name || "Untitled plan"}</h3>
            <p className="mt-0.5 truncate text-xs text-text-secondary">
              {subtitle || setupStyleLabel(plan.setupStyle)}
            </p>
          </div>
          {actions?.length ? <ActionMenu label={`Actions for ${plan.name}`} items={actions} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {showStatus ? <StatusPill status={plan.status} map={PLAN_STATUS_MAP} /> : null}
          {badges}
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs tabular-nums text-text-tertiary">
            <span>{formatDimensions(plan.widthM, plan.lengthM, plan.unit)}</span>
            {footerAction || (
              <span>
                {summary.seats} seat{summary.seats === 1 ? "" : "s"} · {summary.objectCount} object
                {summary.objectCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanCard;
