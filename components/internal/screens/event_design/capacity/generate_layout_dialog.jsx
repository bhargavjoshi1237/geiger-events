"use client";

import React, { useMemo, useState } from "react";
import { CircleCheck, TriangleAlert, WandSparkles } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import {
  cabaretSeats,
  CAPACITY_STYLES,
  generateLayout,
  LAYOUT_FEATURES,
  LAYOUT_FRONTS,
  LAYOUT_TABLES,
  setupStyleLabel,
  STANDARD_CATALOG,
  validatePlanCapacity,
} from "@/lib/event_design";
import { PlanRenderer } from "../plan_renderer";

// Generate layout: pick a style, headcount, table and extras → live preview of the generated plan → apply as one undoable edit.

const FEATURE_LABELS = { stage: "Stage at the front", danceFloor: "Dance floor", bar: "Bar on the back wall" };
const KEEP_OPTIONS = [
  { value: "fixtures", label: "Doors, exits & fixtures" },
  { value: "features", label: "Fixtures + stages, bars, AV" },
];

const catalogName = (key) => STANDARD_CATALOG.find((o) => o.key === key)?.name || key;

function tableOptionLabel(style, key) {
  const obj = STANDARD_CATALOG.find((o) => o.key === key);
  if (!obj) return key;
  if (style === "reception") return obj.name;
  const seats = style === "cabaret" && obj.shape === "round" ? cabaretSeats(obj.seats) : obj.seats;
  return style === "u_shape" || style === "hollow_square" ? `${obj.name} pieces` : `${obj.name} · ${seats} seat${seats === 1 ? "" : "s"}`;
}

function initialDraft(doc) {
  const style = doc?.setupStyle && doc.setupStyle !== "custom" ? doc.setupStyle : "banquet";
  return {
    style,
    attendees: "",
    tableKey: LAYOUT_TABLES[style][0],
    front: "top",
    stage: style === "theatre" || style === "classroom",
    danceFloor: false,
    bar: style === "reception",
    keep: "fixtures",
  };
}

function Body({ doc, rules, space, onApply, onClose }) {
  const [draft, setDraft] = useState(() => initialDraft(doc));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const result = useMemo(
    () =>
      generateLayout(doc, draft.style, {
        rules,
        attendees: Number(draft.attendees) || 0,
        tableKey: draft.tableKey,
        front: draft.front,
        stage: draft.stage,
        danceFloor: draft.danceFloor,
        bar: draft.bar,
        keep: draft.keep,
      }),
    [doc, draft, rules],
  );
  const preview = useMemo(() => ({ ...doc, setupStyle: draft.style, objects: result.objects }), [doc, draft.style, result]);
  const check = useMemo(() => validatePlanCapacity(preview, { rules, space }), [preview, rules, space]);
  const replaced = (doc?.objects || []).length - (result.objects.length - result.generated.length);
  const features = LAYOUT_FEATURES[draft.style] || [];
  const standing = draft.style === "reception";

  return (
    <>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Setup style">
              <Select
                value={draft.style}
                onValueChange={(style) =>
                  set({ style, tableKey: LAYOUT_TABLES[style][0], bar: style === "reception" ? true : draft.bar })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPACITY_STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {setupStyleLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={standing ? "Guests" : "Attendees"} hint="Blank fills the room">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Fill"
                value={draft.attendees}
                onChange={(e) => set({ attendees: e.target.value.replace(/[^\d]/g, "") })}
                className="tabular-nums"
              />
            </Field>
          </div>

          {LAYOUT_TABLES[draft.style].length > 1 || draft.style === "boardroom" ? (
            <Field label={draft.style === "theatre" ? "Chair" : "Table"}>
              <Select value={draft.tableKey} onValueChange={(tableKey) => set({ tableKey })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_TABLES[draft.style].map((key) => (
                    <SelectItem key={key} value={key}>
                      {tableOptionLabel(draft.style, key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-xs text-text-secondary">Uses {catalogName(LAYOUT_TABLES[draft.style][0]).toLowerCase()}s.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Front of the room">
              <Select value={draft.front} onValueChange={(front) => set({ front })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_FRONTS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Keep">
              <Select value={draft.keep} onValueChange={(keep) => set({ keep })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEEP_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {features.length ? (
            <div className="space-y-2.5 rounded-lg border border-border bg-surface-card px-3 py-3">
              {features.map((f) => (
                <label key={f} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  {FEATURE_LABELS[f]}
                  <Switch checked={Boolean(draft[f])} onCheckedChange={(on) => set({ [f]: on })} />
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="h-64 overflow-hidden rounded-lg border border-border md:h-72">
            <PlanRenderer plan={preview} flaggedIds={check.flaggedIds} showLabels={false} padding={0.05} aria-label="Layout preview" />
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-foreground tabular-nums">
              {standing
                ? `Standing for ${result.guests} · ${result.generated.filter((o) => o.category === "tables").length} highboys`
                : `${result.seats} seats${result.tables ? ` at ${result.tables} table${result.tables === 1 ? "" : "s"}` : ""}`}
            </p>
            {check.counts.egress ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" /> {check.counts.egress} egress issue{check.counts.egress === 1 ? "" : "s"} to review after applying
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CircleCheck className="h-3.5 w-3.5" /> Aisles and exits clear
              </p>
            )}
            {result.notes.map((n) => (
              <p key={n} className="text-xs text-text-secondary">
                {n}
              </p>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <p className="text-xs text-text-secondary">
          {replaced > 0
            ? `Replaces ${replaced} object${replaced === 1 ? "" : "s"} on the plan · Ctrl+Z undoes it`
            : "Ctrl+Z undoes it"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!result.generated.length}
            onClick={() => onApply(result, draft.style)}
          >
            <WandSparkles className="h-4 w-4" /> Apply layout
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function GenerateLayoutDialog({ open, onOpenChange, doc, rules, space, onApply }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate layout</DialogTitle>
          <DialogDescription>
            Lays the room out for a setup style with your planning rules — aisles, exit clear zones and the stage zone kept free.
          </DialogDescription>
        </DialogHeader>
        {open ? <Body doc={doc} rules={rules} space={space} onApply={onApply} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export default GenerateLayoutDialog;
