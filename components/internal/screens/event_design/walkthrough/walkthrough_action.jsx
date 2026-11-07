"use client";

import React, { useMemo, useState } from "react";
import { Box } from "lucide-react";

import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Switch } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { ceilingHeight, formatLength } from "@/lib/event_design";
import { Plan3DViewer } from "./plan_3d_viewer";

// The editor's "3D" header action: the plan being edited (unsaved changes included) in the walkthrough viewer.

export const DEFAULT_VIEW_OPTIONS = { showChairs: true, showLabels: true, showCeiling: false };

const TOGGLES = [
  ["showChairs", "Chairs"],
  ["showLabels", "Labels"],
  ["showCeiling", "Ceiling"],
];

export function ViewerToggles({ value, onChange, className, stacked }) {
  return (
    <div className={cn(stacked ? "space-y-2.5" : "flex flex-wrap items-center gap-x-5 gap-y-2", className)}>
      {TOGGLES.map(([key, label]) => (
        <label key={key} className="flex items-center justify-between gap-2.5 text-sm text-text-secondary">
          <span>{label}</span>
          <Switch checked={Boolean(value[key])} onCheckedChange={(checked) => onChange({ ...value, [key]: checked })} />
        </label>
      ))}
    </div>
  );
}

export function Walkthrough3DAction({ plan, doc, space, dirty }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const view = useMemo(() => (doc ? { ...doc, name: plan?.name } : null), [doc, plan?.name]);
  if (!view) return null;
  const ceiling = ceilingHeight(view, space?.heightM);

  return (
    <>
      <Button
        variant="outline"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Box className="h-4 w-4" /> 3D
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[88vh] max-w-[calc(100%-2rem)] flex-col gap-3 p-4 sm:max-w-6xl sm:p-5">
          <DialogHeader className="pr-8">
            <DialogTitle>{plan?.name || "Untitled plan"} in 3D</DialogTitle>
            <DialogDescription>
              {dirty ? "Showing your unsaved changes live. " : ""}
              Ceiling {formatLength(ceiling, view.unit)}
              {space?.heightM ? " from the venue space" : " (assumed — set the space's height for accuracy)"}.
            </DialogDescription>
          </DialogHeader>
          <ViewerToggles value={options} onChange={setOptions} />
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
            {open ? <Plan3DViewer plan={view} ceilingHeightM={space?.heightM} {...options} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const WALKTHROUGH_EXTENSION = { key: "walkthrough", HeaderAction: Walkthrough3DAction };
