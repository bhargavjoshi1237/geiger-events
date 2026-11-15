"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Checkbox, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/internal/screens/workspace/state/format";
import { OptionChip } from "@/components/internal/screens/workspace/ws_ui";

// Options for a choice filter: the list's statuses or a select field's options.
function choicesFor(list, field) {
  if (field.id === "status") return (list.statuses ?? []).map((status) => ({ id: status.key, label: status.label, color: status.color }));
  return field.config?.options ?? [];
}

function summary(list, field, value) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return null;
  if (Array.isArray(value)) {
    const labels = value.map((id) => choicesFor(list, field).find((option) => option.id === id)?.label).filter(Boolean);
    return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0] ?? null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (value.from && value.to) return `${formatDate(value.from)} – ${formatDate(value.to)}`;
    if (value.from) return `From ${formatDate(value.from)}`;
    if (value.to) return `Until ${formatDate(value.to)}`;
    return null;
  }
  return String(value);
}

function FilterChip({ list, field, value, onChange }) {
  const [open, setOpen] = useState(false);
  const text = summary(list, field, value);
  const type = field.id === "status" ? "status" : field.type;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("inline-flex h-8 shrink-0 items-center rounded-md border text-sm",
        text ? "border-foreground/30 bg-surface-active text-foreground" : "border-border bg-surface-card text-text-secondary")}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex h-full items-center gap-1.5 pl-2.5 pr-2 hover:text-foreground">
            <span className="font-medium">{field.name}</span>
            {text ? <span className="max-w-[10rem] truncate">· {text}</span> : null}
            {!text ? <ChevronDown className="h-3.5 w-3.5" /> : null}
          </button>
        </PopoverTrigger>
        {text ? (
          <button type="button" aria-label={`Clear ${field.name}`} className="flex h-full items-center pr-2 text-text-tertiary hover:text-foreground"
            onClick={() => onChange(undefined)}>
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-64 p-2">
        {["status", "single_select", "multi_select"].includes(type) ? (
          <div className="max-h-64 overflow-y-auto">
            {choicesFor(list, field).map((option) => {
              const chosen = Array.isArray(value) && value.includes(option.id);
              return (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-subtle">
                  <Checkbox checked={chosen} onCheckedChange={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(chosen ? current.filter((id) => id !== option.id) : [...current, option.id]);
                  }} />
                  <OptionChip option={option} />
                </label>
              );
            })}
          </div>
        ) : type === "checkbox" ? (
          <div className="grid gap-1">
            {[["Any", undefined], ["Yes", true], ["No", false]].map(([label, next]) => (
              <button key={label} type="button" onClick={() => { onChange(next); setOpen(false); }}
                className={cn("rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-subtle", value === next && "bg-surface-active font-medium")}>
                {label}
              </button>
            ))}
          </div>
        ) : type === "date" || type === "datetime" ? (
          <div className="grid gap-2">
            <div className="grid gap-1"><Label className="text-xs">From</Label>
              <Input type="date" value={value?.from ?? ""} onChange={(e) => onChange({ ...(value ?? {}), from: e.target.value || undefined })} /></div>
            <div className="grid gap-1"><Label className="text-xs">To</Label>
              <Input type="date" value={value?.to ?? ""} onChange={(e) => onChange({ ...(value ?? {}), to: e.target.value || undefined })} /></div>
          </div>
        ) : type === "number" ? (
          <Input type="number" autoFocus placeholder="Equals…" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        ) : (
          <Input autoFocus placeholder="Contains…" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />
        )}
      </PopoverContent>
    </Popover>
  );
}

// The filters a block lets viewers use; only fields every one of their roles can see are offered.
export function ExposedFilters({ list, fieldIds, value, onChange }) {
  if (!list || !fieldIds?.length) return null;
  const queryable = new Set(list.queryable ?? []);
  const fields = fieldIds.map((id) => (id === "status" ? (list.statuses?.length ? { id: "status", name: "Status", type: "status" } : null)
    : list.fields.find((field) => field.id === id && queryable.has(id)))).filter(Boolean);
  if (!fields.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {fields.map((field) => (
        <FilterChip key={field.id} list={list} field={field} value={value?.[field.id]}
          onChange={(next) => {
            const copy = { ...(value ?? {}) };
            if (next === undefined || (Array.isArray(next) && !next.length)) delete copy[field.id];
            else copy[field.id] = next;
            onChange(copy);
          }} />
      ))}
    </div>
  );
}
