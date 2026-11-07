"use client";

import React from "react";
import { CircleCheck, ClipboardCheck } from "lucide-react";

import { Badge } from "@geiger/ui";
import { DataTable, EmptyState } from "@/components/internal/shared/screen_kit";
import { setupStyleLabel } from "@/lib/event_design";
import { formatRelative } from "date-fns";

// Validation report: every plan with its seats against capacity and its issue counts; a row opens the editor.

const KIND_LABEL = { plan: "Event plan", template: "Template", library: "Venue diagram" };

function IssueBadges({ check }) {
  const capacity = check.issues.filter((i) => i.group === "capacity");
  const layout = check.issues.filter((i) => i.group === "layout");
  if (!check.issues.length) {
    return (
      <Badge variant="success">
        <CircleCheck /> Clear
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {check.counts.egress ? <Badge variant="warning">{check.counts.egress} egress</Badge> : null}
      {capacity.length ? (
        <Badge variant={capacity.some((i) => i.severity === "error") ? "danger" : "warning"}>
          {capacity.length} capacity
        </Badge>
      ) : null}
      {layout.length ? (
        <Badge variant={layout.some((i) => i.severity === "error") ? "danger" : "neutral"}>
          {layout.length} layout
        </Badge>
      ) : null}
    </div>
  );
}

export function PlanChecks({ rows, onOpen, emptyTitle, emptyDescription }) {
  const columns = [
    {
      key: "plan",
      header: "Plan",
      className: "min-w-[14rem]",
      render: ({ plan, place, eventName }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{plan.name || "Untitled plan"}</p>
          <p className="truncate text-xs text-text-secondary">
            {[KIND_LABEL[plan.kind], eventName, place].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    {
      key: "style",
      header: "Setup",
      render: ({ plan }) => <span className="text-sm text-text-secondary">{setupStyleLabel(plan.setupStyle)}</span>,
    },
    {
      key: "seats",
      header: "Seats / capacity",
      render: ({ check }) => {
        const over = check.capacity && check.occupancy > check.capacity;
        return (
          <span className={over ? "text-sm font-medium text-red-600 tabular-nums dark:text-red-400" : "text-sm tabular-nums text-foreground"}>
            {check.standing ? `~${check.occupancy} standing` : check.seats}
            {check.capacity && !check.standing ? <span className="text-text-tertiary"> / {check.capacity}</span> : null}
          </span>
        );
      },
    },
    { key: "issues", header: "Checks", render: ({ check }) => <IssueBadges check={check} /> },
    {
      key: "updated",
      header: "Updated",
      align: "right",
      render: ({ plan }) => (
        <span className="whitespace-nowrap text-xs text-text-tertiary">
          {plan.updatedAt ? formatRelative(new Date(plan.updatedAt), new Date()) : "—"}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.plan.id}
      onRowClick={(row) => onOpen(row.plan.id)}
      empty={
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={ClipboardCheck} title={emptyTitle} description={emptyDescription} />
        </div>
      }
    />
  );
}

export default PlanChecks;
