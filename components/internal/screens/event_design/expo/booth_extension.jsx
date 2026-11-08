"use client";

import React, { useState } from "react";
import { Hash, Store, TriangleAlert } from "lucide-react";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import { currency } from "@/components/internal/screens/tickets/constants";
import {
  BOOTH_SIZE_CLASSES,
  DEFAULT_BOOTH_PREFIX,
  boothArea,
  boothIssues,
  boothSummary,
  formatArea,
  isBooth,
  normaliseBoothFields,
  numberBooths,
} from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { CountInput } from "../fields";

// Floor plan editor extension for expo halls: booth sale fields in the inspector, numbering, and the booth count / floor value in the dock.
// The booth number is the object's Label (edited in the object inspector above); everything here syncs to sales on save.

const outline = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function Section({ title, children }) {
  return (
    <div className="space-y-3 border-b border-border p-4 last:border-b-0">
      {title ? <p className="text-xs font-medium text-text-tertiary">{title}</p> : null}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// Undoable patch of the booth fields on every booth in `ids`; typing coalesces into one undo step per field.
const patchBooths = (apply, ids, patch, coalesce) =>
  apply(
    (d) => ({
      ...d,
      objects: d.objects.map((o) =>
        ids.includes(o.id) && isBooth(o) ? { ...o, booth: normaliseBoothFields({ ...o.booth, ...patch }) } : o,
      ),
    }),
    coalesce ? { coalesce } : undefined,
  );

function SizeClassSelect({ value, onChange, placeholder }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || "Size class"} />
      </SelectTrigger>
      <SelectContent>
        {BOOTH_SIZE_CLASSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PriceInput({ value, onChange, placeholder }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="tabular-nums"
    />
  );
}

function NumberingTool({ label, onNumber }) {
  const [prefix, setPrefix] = useState(DEFAULT_BOOTH_PREFIX);
  const [start, setStart] = useState(1);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Field label="Prefix" className="w-20 shrink-0">
          <Input value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value.trim())} />
        </Field>
        <Field label="Start at" className="min-w-0 flex-1">
          <CountInput value={start} min={0} max={9999} onChange={setStart} />
        </Field>
      </div>
      <Button variant="outline" size="sm" className={`h-8 w-full ${outline}`} onClick={() => onNumber(prefix, start)}>
        <Hash className="h-3.5 w-3.5" /> {label}
      </Button>
      <p className="text-xs text-text-tertiary">Rows top to bottom, left to right — {prefix}{start}, {prefix}{start + 1}…</p>
    </div>
  );
}

function SingleBooth({ booth, apply, unit }) {
  const fields = normaliseBoothFields(booth.booth);
  const set = (key) => (value) => patchBooths(apply, [booth.id], { [key]: value }, `booth-${key}-${booth.id}`);
  return (
    <Section title="Booth sale">
      <Field label="Size class">
        <SizeClassSelect value={fields.sizeClass} onChange={set("sizeClass")} />
      </Field>
      <Field label="Price" hint="Used when the event sells booths at their own price.">
        <PriceInput value={fields.price || ""} placeholder="0" onChange={set("price")} />
      </Field>
      <Field label="Zone or aisle" hint="Shown to exhibitors beside the booth number.">
        <Input value={fields.zone} placeholder="e.g. Hall B · Aisle 3" onChange={(e) => set("zone")(e.target.value)} />
      </Field>
      <Row label="Floor area" value={formatArea(boothArea(booth), unit)} />
    </Section>
  );
}

function BulkBooths({ booths, apply }) {
  const ids = booths.map((b) => b.id);
  const sizes = new Set(booths.map((b) => normaliseBoothFields(b.booth).sizeClass));
  const prices = new Set(booths.map((b) => normaliseBoothFields(b.booth).price));
  const key = ids.join();
  return (
    <>
      <Section title={`${booths.length} booths selected`}>
        <Field label="Size class">
          <SizeClassSelect
            value={sizes.size === 1 ? [...sizes][0] : ""}
            placeholder="Mixed"
            onChange={(v) => patchBooths(apply, ids, { sizeClass: v })}
          />
        </Field>
        <Field label="Price">
          <PriceInput
            value={prices.size === 1 ? [...prices][0] || "" : ""}
            placeholder={prices.size === 1 ? "0" : "Mixed"}
            onChange={(v) => patchBooths(apply, ids, { price: v }, `booths-price-${key}`)}
          />
        </Field>
      </Section>
      <Section title="Number these booths">
        <NumberingTool
          label={`Number ${booths.length} booths`}
          onNumber={(prefix, start) => apply((d) => ({ ...d, objects: numberBooths(d.objects, ids, { prefix, start }) }))}
        />
      </Section>
    </>
  );
}

function IssueButton({ count, label, onClick }) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-active"
    >
      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
      <span className="text-foreground">
        {count} {label}
      </span>
    </button>
  );
}

function HallSummary({ doc, apply, select }) {
  const booths = doc.objects.filter(isBooth);
  const summary = boothSummary(doc.objects);
  const issues = boothIssues(doc.objects);
  return (
    <>
      <Section title="Booths">
        <div className="space-y-1.5">
          <Row label="Booths" value={summary.count} />
          <Row label="Floor value" value={currency(summary.value)} />
          <Row label="Booth area" value={formatArea(summary.areaM2, doc.unit)} />
        </div>
        {issues.unnumbered.length || issues.duplicates.length ? (
          <div className="-mx-2">
            <IssueButton count={issues.unnumbered.length} label="without a number" onClick={() => select?.(issues.unnumbered)} />
            <IssueButton count={issues.duplicates.length} label="sharing a number" onClick={() => select?.(issues.duplicates)} />
          </div>
        ) : null}
        <p className="text-xs leading-relaxed text-text-tertiary">
          {booths.length
            ? "Saving publishes these booths to every event that sells this hall — numbers, sizes and prices included."
            : "Add booths from Expo booths in the library, then Repeat as grid to lay out a row."}
        </p>
      </Section>
      {booths.length ? (
        <Section title="Number all booths">
          <NumberingTool
            label={`Number all ${booths.length}`}
            onNumber={(prefix, start) =>
              apply((d) => ({ ...d, objects: numberBooths(d.objects, booths.map((b) => b.id), { prefix, start }) }))
            }
          />
        </Section>
      ) : null}
    </>
  );
}

function BoothInspector({ doc, selectedIds, apply, select }) {
  const selected = doc.objects.filter((o) => selectedIds.includes(o.id));
  const booths = selected.filter(isBooth);
  if (!selected.length) return <HallSummary doc={doc} apply={apply} select={select} />;
  if (booths.length === 1 && selected.length === 1) return <SingleBooth booth={booths[0]} apply={apply} unit={doc.unit} />;
  if (booths.length > 1) return <BulkBooths booths={booths} apply={apply} />;
  return null;
}

function BoothStatus({ doc, select }) {
  const summary = boothSummary(doc.objects);
  const issues = boothIssues(doc.objects);
  const flagged = [...issues.unnumbered, ...issues.duplicates];
  return (
    <>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Store className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="font-medium text-foreground">{summary.count}</span> booths · {currency(summary.value)}
      </span>
      {flagged.length ? (
        <button
          type="button"
          onClick={() => select?.(flagged)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400",
          )}
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {flagged.length} need a number
        </button>
      ) : null}
    </>
  );
}

export const EXPO_EXTENSION = {
  key: "expo",
  kinds: ["expo"],
  StatusItem: BoothStatus,
  InspectorSection: BoothInspector,
};
