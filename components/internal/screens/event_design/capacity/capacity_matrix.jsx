"use client";

import React, { useState } from "react";
import { ArrowDownToLine, Ruler } from "lucide-react";

import { Button, Input } from "@geiger/ui";
import { DataTable, EmptyState } from "@/components/internal/shared/screen_kit";
import { CAPACITY_STYLES, formatArea, formatDimensions, setupStyleLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";

// Venue spaces × setup styles: the rules-based estimate, what the space lists, and the best plan drawn for it.

const SHORT_LABEL = { u_shape: "U-shape", hollow_square: "Hollow sq." };

// Max occupancy typed inline; saves on blur / Enter when it changed.
function MaxOccupancyInput({ value, onSave }) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value ? String(value) : "");
  }
  const commit = () => {
    const n = Math.floor(Number(draft));
    const next = Number.isFinite(n) && n > 0 ? n : null;
    if (next !== (value || null)) onSave(next);
  };
  return (
    <Input
      inputMode="numeric"
      value={draft}
      placeholder="—"
      aria-label="Max occupancy"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="w-24 tabular-nums"
    />
  );
}

function StyleCell({ row, style, onOpenPlan }) {
  const est = row.estimates?.[style];
  if (!est) return <span className="text-text-tertiary">—</span>;
  const capped = row.maxOccupancy && est.estimate > row.maxOccupancy;
  const shown = capped ? row.maxOccupancy : est.estimate;
  const stated = row.space.capacities?.[style] ? Number(row.space.capacities[style]) : null;
  const statedHigh = stated && est.estimate && stated > est.estimate;
  const plan = row.bestPlans[style];
  return (
    <div className="min-w-[4.5rem] space-y-0.5">
      <div
        className={cn("text-sm font-semibold tabular-nums", shown ? "text-foreground" : "text-text-tertiary")}
        title={capped ? `Rules allow ${est.estimate}; capped at the max occupancy` : `${est.method === "area" ? "Area" : "Table-edge"} estimate`}
      >
        {shown || "—"}
        {capped ? <span className="ml-1 text-[10px] font-normal text-text-tertiary">max</span> : null}
      </div>
      <div
        className={cn("text-[11px] tabular-nums", statedHigh ? "text-amber-700 dark:text-amber-400" : "text-text-tertiary")}
        title={statedHigh ? "Listed above what the planning rules support" : undefined}
      >
        Listed {stated ?? "—"}
      </div>
      {plan ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPlan(plan.plan.id);
          }}
          className={cn(
            "text-[11px] tabular-nums underline-offset-2 hover:underline",
            shown && plan.seats > shown ? "text-red-600 dark:text-red-400" : "text-primary",
          )}
          title={plan.plan.name}
        >
          Plan {plan.seats}
        </button>
      ) : null}
    </div>
  );
}

export function CapacityMatrix({ rows, unit, onApply, onMaxOccupancy, onOpenPlan, busyId }) {
  const columns = [
    {
      key: "space",
      header: "Space",
      className: "min-w-[12rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.space.name || "Untitled space"}</p>
          <p className="truncate text-xs text-text-secondary">
            {[row.venue?.name, row.room ? `${formatDimensions(row.space.widthM, row.space.lengthM, unit)} · ${formatArea(row.room.widthM * row.room.lengthM, unit)}` : "No dimensions yet"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ),
    },
    {
      key: "max",
      header: "Max occupancy",
      render: (row) => <MaxOccupancyInput value={row.maxOccupancy} onSave={(n) => onMaxOccupancy(row.space, n)} />,
    },
    ...CAPACITY_STYLES.map((style) => ({
      key: style,
      header: SHORT_LABEL[style] || setupStyleLabel(style),
      render: (row) => <StyleCell row={row} style={style} onOpenPlan={onOpenPlan} />,
    })),
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          disabled={!row.room || busyId === row.space.id}
          onClick={() => onApply([row])}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          title="Write these estimates to the space's listed capacities"
        >
          <ArrowDownToLine className="h-4 w-4" /> Apply
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.space.id}
      empty={
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Ruler}
            title="No venue spaces yet"
            description="Add rooms with their width and length under Venues → Spaces, and their capacities appear here."
          />
        </div>
      }
    />
  );
}

export default CapacityMatrix;
