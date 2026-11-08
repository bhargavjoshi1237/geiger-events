"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Gauge, TriangleAlert, WandSparkles } from "lucide-react";

import { Button } from "@geiger/ui";
import { useProject } from "@/context/project-context";
import { cn } from "@/lib/utils";
import { footprintPolygon, formatArea, formatLength, setupStyleLabel } from "@/lib/event_design";
import { usePlanningRules, validateCached } from "./use_planning_rules";
import { formatPerPerson } from "./format";
import { GenerateLayoutDialog } from "./generate_layout_dialog";

// Floor plan editor extension: capacity status, egress overlay, capacity inspector and "Generate layout".

const NSS = "non-scaling-stroke";

function useValidation(doc, space) {
  const { projectId } = useProject();
  const { rules } = usePlanningRules(projectId);
  const result = useMemo(() => validateCached(doc, space, rules), [doc, space, rules]);
  return { result, rules };
}

const existingIds = (doc, ids) => {
  const have = new Set((doc?.objects || []).map((o) => o.id));
  return (ids || []).filter((id) => have.has(id));
};

function CapacityStatus({ doc, space, select }) {
  const { result: v } = useValidation(doc, space);
  if (!v) return null;
  const egressIds = existingIds(doc, v.issues.filter((i) => i.group === "egress").flatMap((i) => i.objectIds));
  const overMax = v.issues.some((i) => i.kind === "max_occupancy");
  const target = v.standing ? null : v.capacity;
  const style = setupStyleLabel(v.style).toLowerCase();
  const title = [
    v.estimate.estimate ? `Planning estimate ${v.estimate.estimate}` : null,
    v.stated ? `space lists ${v.stated}` : null,
    v.maxOccupancy ? `max occupancy ${v.maxOccupancy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={title || undefined}>
        <Gauge className="h-3.5 w-3.5 text-text-tertiary" />
        {v.standing ? (
          <>
            <span className={cn("font-medium", overMax ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              ~{v.estimate.estimate}
            </span>
            standing · reception
          </>
        ) : (
          <>
            <span
              className={cn(
                "font-medium",
                overMax || (target && v.seats > target) ? "text-red-600 dark:text-red-400" : "text-foreground",
              )}
            >
              {v.seats}
              {target ? ` / ${target}` : ""}
            </span>
            {style}
          </>
        )}
      </span>
      {v.counts.egress ? (
        <button
          type="button"
          onClick={() => select?.(egressIds)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {v.counts.egress} egress issue{v.counts.egress === 1 ? "" : "s"}
        </button>
      ) : null}
    </>
  );
}

function CapacityOverlay({ doc, space, view }) {
  const { result: v } = useValidation(doc, space);
  if (!v || !view?.pxPerMetre) return null;
  const px = view.pxPerMetre;
  const byId = view.objectById;
  const outlined = new Set();
  for (const issue of v.issues) {
    if (issue.group !== "egress") continue;
    for (const id of issue.objectIds) {
      const o = byId.get(id);
      if (o && o.category !== "structure") outlined.add(id);
    }
  }
  return (
    <g className="pointer-events-none">
      {v.zones.map((z) => (
        <polygon
          key={z.id}
          points={z.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
          className={z.blocked ? "fill-red-500/15 stroke-red-500" : "fill-emerald-500/[0.06] stroke-emerald-600/50 dark:stroke-emerald-400/50"}
          strokeWidth={1}
          strokeDasharray="5 4"
          vectorEffect={NSS}
        />
      ))}
      {[...outlined].map((id) => (
        <polygon
          key={id}
          points={footprintPolygon(byId.get(id), { withChairs: true }).map(([x, y]) => `${x},${y}`).join(" ")}
          className="fill-none stroke-red-500/80"
          strokeWidth={1.25}
          strokeDasharray="3 3"
          vectorEffect={NSS}
        />
      ))}
      {v.issues
        .filter((i) => i.segment)
        .map((i) => {
          const [[x1, y1], [x2, y2]] = i.segment;
          return (
            <g key={i.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-red-500" strokeWidth={2.5} vectorEffect={NSS} />
              <circle cx={x1} cy={y1} r={3 / px} className="fill-red-500" />
              <circle cx={x2} cy={y2} r={3 / px} className="fill-red-500" />
              {px > 18 ? (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6 / px}
                  textAnchor="middle"
                  fontSize={10 / px}
                  className="select-none fill-red-600 font-medium dark:fill-red-400"
                >
                  {formatLength(i.gapM, view.unit)}
                </text>
              ) : null}
            </g>
          );
        })}
    </g>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className={cn("font-medium tabular-nums", tone || "text-foreground")}>{value}</span>
    </div>
  );
}

const SEVERITY_ICON = { error: CircleAlert, warning: TriangleAlert };
const SEVERITY_TONE = {
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
};

function CapacityInspector({ doc, space, select }) {
  const { result: v } = useValidation(doc, space);
  if (!v) return null;
  const e = v.estimate;
  const unit = doc?.unit;
  return (
    <div className="space-y-3 border-b border-border p-4 last:border-b-0">
      <p className="text-xs font-medium text-text-tertiary">Capacity · {setupStyleLabel(v.style)}</p>
      <div className="space-y-1.5">
        {v.standing ? null : <Row label="Seats placed" value={v.seats} />}
        <Row label={v.standing ? "Standing estimate" : "Planning estimate"} value={e.estimate || "—"} />
        <Row label="Space lists" value={v.stated ?? "—"} />
        <Row
          label="Max occupancy"
          value={v.maxOccupancy ?? "—"}
          tone={v.issues.some((i) => i.kind === "max_occupancy") ? SEVERITY_TONE.error : undefined}
        />
      </div>
      {e.method === "area" ? (
        <p className="text-xs leading-relaxed text-text-tertiary">
          {formatArea(e.usableAreaM2, unit)} usable of {formatArea(e.grossAreaM2, unit)} at {formatPerPerson(e.areaPerPerson, unit)}
          /person
          {e.deductions.length ? ` · minus ${e.deductions.map((d) => d.label.toLowerCase()).join(", ")}` : ""}.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-text-tertiary">
          Table edge at {formatLength(e.seatPitchM, unit)} per seat inside the walkway setback.
        </p>
      )}

      {v.issues.length ? (
        <ul className="space-y-1">
          {v.issues.map((issue) => {
            const Icon = SEVERITY_ICON[issue.severity] || TriangleAlert;
            const ids = existingIds(doc, issue.objectIds);
            const body = (
              <>
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", SEVERITY_TONE[issue.severity])} />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">{issue.title}</span>
                  <span className="block text-xs text-text-secondary">{issue.detail}</span>
                </span>
              </>
            );
            return (
              <li key={issue.id}>
                {ids.length ? (
                  <button
                    type="button"
                    onClick={() => select?.(ids)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-active"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-2 px-2 py-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="h-3.5 w-3.5" /> Aisles, exits and capacity check out
        </p>
      )}
    </div>
  );
}

function GenerateLayoutAction({ doc, space, apply, select }) {
  const { projectId } = useProject();
  const { rules } = usePlanningRules(projectId);
  const [open, setOpen] = useState(false);
  if (typeof apply !== "function") return null;
  return (
    <>
      <Button
        variant="outline"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <WandSparkles className="h-4 w-4" /> Generate
      </Button>
      <GenerateLayoutDialog
        open={open}
        onOpenChange={setOpen}
        doc={doc}
        rules={rules}
        space={space}
        onApply={(result, style) => {
          apply((d) => ({ ...d, setupStyle: style, objects: result.objects }));
          select?.([]);
          setOpen(false);
          toast.success(
            style === "reception"
              ? `Laid out for ${result.guests} standing guests · Ctrl+Z to undo`
              : `Laid out ${result.seats} seats · Ctrl+Z to undo`,
          );
        }}
      />
    </>
  );
}

export const CAPACITY_EXTENSION = {
  key: "capacity",
  kinds: ["plan", "template", "library"],
  HeaderAction: GenerateLayoutAction,
  StatusItem: CapacityStatus,
  CanvasOverlay: CapacityOverlay,
  InspectorSection: CapacityInspector,
};
