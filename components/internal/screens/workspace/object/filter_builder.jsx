"use client";

import { ArrowDownUp, Columns3, Filter, Plus, Save, Trash2, X } from "lucide-react";
import {
  Badge, Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { CAST_OPERATORS } from "@/lib/workspace/contracts.js";
import { FORMULA_RESULTS } from "@/lib/workspace/schema/types/computed.js";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { cn } from "@/lib/utils";
import { LIST_OPERATORS, NO_VALUE_OPERATORS, OPERATOR_LABELS } from "../state/format";
import { OptionChip } from "../ws_ui";
import { LinkPicker } from "../record/link_picker";

const SYSTEM = {
  status: { name: "Status", cast: "text", operators: ["eq", "neq", "any_of", "none_of", "is_empty", "is_not_empty"] },
  number: { name: "Number", cast: "numeric", operators: ["eq", "neq", "gt", "gte", "lt", "lte"] },
  created_at: { name: "Created", cast: "timestamptz", operators: CAST_OPERATORS.timestamptz },
  updated_at: { name: "Last changed", cast: "timestamptz", operators: CAST_OPERATORS.timestamptz },
};

export function filterTargets(fields) {
  const out = Object.entries(SYSTEM).map(([id, meta]) => ({ id, ...meta, system: true }));
  for (const field of fields) {
    const type = getType(field.type);
    const cast = field.type === "formula" ? FORMULA_RESULTS[field.config.result] ?? "text" : type.cast;
    out.push({ id: field.id, name: field.name, cast, field, operators: type.operators.filter((op) => CAST_OPERATORS[cast]?.includes(op)) });
  }
  return out;
}

function ValueInput({ target, operator, value, onChange, statuses, eventId }) {
  if (NO_VALUE_OPERATORS.has(operator)) return null;
  const options = target.id === "status"
    ? statuses.map((status) => ({ id: status.key, label: status.label, color: status.color }))
    : target.field?.config?.options;
  if (target.cast === "link") {
    return <LinkPicker field={target.field} eventId={eventId} value={(value ?? []).map((id) => (typeof id === "string" ? { id, label: "Selected" } : id))}
      onChange={(links) => onChange(links)} />;
  }
  if (options) {
    if (LIST_OPERATORS.has(operator)) {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-card px-2 py-1 text-left text-sm">
              {chosen.length ? chosen.map((id) => <OptionChip key={id} option={options.find((o) => o.id === id)} />) : <span className="text-text-tertiary">Choose…</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            {options.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-subtle">
                <Checkbox checked={chosen.includes(option.id)} onCheckedChange={() => onChange(chosen.includes(option.id) ? chosen.filter((id) => id !== option.id) : [...chosen, option.id])} />
                <OptionChip option={option} />
              </label>
            ))}
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}><OptionChip option={option} /></SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (target.cast === "numeric") return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  if (target.cast === "date" || target.cast === "timestamptz") return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />;
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />;
}

function Condition({ item, targets, onChange, onRemove, statuses, eventId }) {
  const target = targets.find((entry) => entry.id === item.field) ?? targets[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] items-start gap-2">
      <Select value={target.id} onValueChange={(field) => {
        const next = targets.find((entry) => entry.id === field);
        onChange({ field, operator: next.operators[0], value: undefined });
      }}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{targets.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={item.operator} onValueChange={(operator) => onChange({ ...item, operator, value: LIST_OPERATORS.has(operator) === LIST_OPERATORS.has(item.operator) ? item.value : undefined })}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{target.operators.map((op) => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>)}</SelectContent>
      </Select>
      <div className="min-w-0"><ValueInput target={target} operator={item.operator} value={item.value} onChange={(value) => onChange({ ...item, value })} statuses={statuses} eventId={eventId} /></div>
      <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove condition" onClick={onRemove}><X className="h-4 w-4" /></Button>
    </div>
  );
}

const countConditions = (node) => (node?.items ?? []).reduce((n, item) => n + (item.items ? countConditions(item) : 1), 0);

// Turns UI conditions into the API's filter, dropping conditions that still need a value.
export function toApiFilter(node) {
  if (!node) return undefined;
  const items = node.items.map((item) => {
    if (item.items) return toApiFilter(item);
    if (NO_VALUE_OPERATORS.has(item.operator)) return { field: item.field, operator: item.operator };
    const value = Array.isArray(item.value) ? item.value.map((v) => (typeof v === "string" ? v : v.id)) : item.value;
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return null;
    return { field: item.field, operator: item.operator, value };
  }).filter(Boolean);
  return items.length ? { op: node.op, items } : undefined;
}

export function FilterButton({ filter, onChange, fields, statuses, eventId, label = "Filter", intro = "Show records that match", emptyText = "No filters. Every record is shown.", align = "end", open, onOpenChange }) {
  const targets = filterTargets(fields);
  const node = filter ?? { op: "and", items: [] };
  const count = countConditions(node);
  const blank = () => ({ field: targets[0].id, operator: targets[0].operators[0] });
  const setItems = (items) => onChange(items.length ? { ...node, items } : null);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("shrink-0", count && "border-border-strong bg-surface-card")}>
          <Filter className="h-4 w-4" />{label}
          {count ? <Badge variant="neutral" className="px-1.5 py-0 tabular-nums">{count}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(40rem,calc(100vw-2rem))] space-y-3 p-3">
        {node.items.length ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            {intro}
            <Select value={node.op} onValueChange={(op) => onChange({ ...node, op })}>
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="and">all</SelectItem><SelectItem value="or">any</SelectItem></SelectContent>
            </Select>
            of these
          </div>
        ) : <p className="text-sm text-text-secondary">{emptyText}</p>}
        {node.items.map((item, index) => (item.items ? (
          <div key={index} className="space-y-2 rounded-lg border border-border bg-surface-subtle p-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              Group matching
              <Select value={item.op} onValueChange={(op) => setItems(node.items.map((x, i) => (i === index ? { ...item, op } : x)))}>
                <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="and">all</SelectItem><SelectItem value="or">any</SelectItem></SelectContent>
              </Select>
              <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label="Remove group" onClick={() => setItems(node.items.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            {item.items.map((inner, j) => (
              <Condition key={j} item={inner} targets={targets} statuses={statuses} eventId={eventId}
                onChange={(next) => setItems(node.items.map((x, i) => (i === index ? { ...item, items: item.items.map((y, k) => (k === j ? next : y)) } : x)))}
                onRemove={() => setItems(node.items.map((x, i) => (i === index ? { ...item, items: item.items.filter((_, k) => k !== j) } : x)).filter((x) => !x.items || x.items.length))} />
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setItems(node.items.map((x, i) => (i === index ? { ...item, items: [...item.items, blank()] } : x)))}>
              <Plus className="h-4 w-4" />Add condition
            </Button>
          </div>
        ) : (
          <Condition key={index} item={item} targets={targets} statuses={statuses} eventId={eventId}
            onChange={(next) => setItems(node.items.map((x, i) => (i === index ? next : x)))}
            onRemove={() => setItems(node.items.filter((_, i) => i !== index))} />
        )))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...node.items, blank()])}><Plus className="h-4 w-4" />Add condition</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...node.items, { op: node.op === "and" ? "or" : "and", items: [blank()] }])}>Add group</Button>
          {count ? <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onChange(null)}>Clear</Button> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SortButton({ sort, onChange, fields, compact = false }) {
  const targets = [
    { id: "number", name: "Number" }, { id: "title", name: "Title" }, { id: "created_at", name: "Created" }, { id: "updated_at", name: "Last changed" },
    ...fields.filter((field) => !["link_record", "link_event", "multi_select", "attachments"].includes(field.type)).map((field) => ({ id: field.id, name: field.name })),
  ];
  const rows = sort ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Sort" title="Sort"><ArrowDownUp className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button variant="outline" size="sm" className="shrink-0"><ArrowDownUp className="h-4 w-4" />Sort{rows.length ? ` · ${rows.length}` : ""}</Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] space-y-2 p-3">
        {!rows.length ? <p className="text-sm text-text-secondary">Sorted by record number.</p> : null}
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] gap-2">
            <Select value={row.field} onValueChange={(field) => onChange(rows.map((x, i) => (i === index ? { ...x, field } : x)))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={row.dir} onValueChange={(dir) => onChange(rows.map((x, i) => (i === index ? { ...x, dir } : x)))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="asc">Ascending</SelectItem><SelectItem value="desc">Descending</SelectItem></SelectContent>
            </Select>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove sort" onClick={() => onChange(rows.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        {rows.length < 3 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { field: targets[0].id, dir: "asc" }])}><Plus className="h-4 w-4" />Add sort</Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// Which fields show as columns in this view.
export function FieldsButton({ columns, fields, titleFieldId, onChange, compact = false, label = "Fields", heading = "Show in this view" }) {
  const shown = columns.filter((column) => column.fieldId !== titleFieldId);
  const hidden = shown.filter((column) => column.hidden).length;
  const toggle = (fieldId) => onChange(columns.map((column) => (column.fieldId === fieldId ? { ...column, hidden: !column.hidden } : column)));
  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={label} title={label}><Columns3 className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button variant="outline" size="sm" className="shrink-0"><Columns3 className="h-4 w-4" />{label}{hidden ? ` · ${hidden} hidden` : ""}</Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-1">
        <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-text-secondary">{heading}</p>
        {shown.map((column) => {
          const field = fields.find((item) => item.id === column.fieldId);
          if (!field) return null;
          return (
            <label key={column.fieldId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-hover">
              <Checkbox checked={!column.hidden} onCheckedChange={() => toggle(column.fieldId)} />
              <span className={cn("min-w-0 flex-1 truncate", column.hidden && "text-text-secondary")}>{field.name}</span>
            </label>
          );
        })}
        {hidden ? (
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => onChange(columns.map(({ hidden: _hidden, ...rest }) => rest))}>Show all</Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function valueLabel(target, value, statuses) {
  if (value === undefined || value === null || value === "") return null;
  const options = target.id === "status" ? statuses.map((status) => ({ id: status.key, label: status.label })) : target.field?.config?.options;
  const one = (item) => {
    if (typeof item === "object" && item) return item.label ?? "Selected";
    return options?.find((option) => option.id === item)?.label ?? String(item);
  };
  if (Array.isArray(value)) return value.length > 2 ? `${value.length} chosen` : value.map(one).join(", ");
  return one(value);
}

// The active conditions as removable chips under the toolbar, plus the view's unsaved-changes actions.
export function FilterChips({ filter, onChange, fields, statuses, onOpen, onAdd, dirtyLabel, onReset, onSave }) {
  const targets = filterTargets(fields);
  const items = filter?.items ?? [];
  const remove = (index) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.length ? { ...filter, items: next } : null);
  };
  return (
    <div className="flex min-h-[42px] shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/70 px-4 py-2 sm:px-6 [scrollbar-width:none]">
      {items.map((item, index) => {
        const target = item.items ? null : targets.find((entry) => entry.id === item.field);
        const value = target && !NO_VALUE_OPERATORS.has(item.operator) ? valueLabel(target, item.value, statuses) : null;
        return (
          <Badge key={index} variant="outline" className="h-6 shrink-0 gap-1 pr-0.5 text-xs font-normal">
            <button type="button" onClick={onOpen} className="max-w-[18rem] truncate hover:text-foreground">
              {item.items ? `Group · ${countConditions(item)} conditions` : (
                <><span className="text-foreground">{target?.name ?? "Field"}</span> {OPERATOR_LABELS[item.operator] ?? item.operator}{value ? <> <span className="text-foreground">{value}</span></> : null}</>
              )}
            </button>
            <Button variant="ghost" size="icon-xs" className="size-5 text-text-secondary" aria-label="Remove filter" onClick={() => remove(index)}><X /></Button>
          </Badge>
        );
      })}
      <Button variant="ghost" size="xs" className="shrink-0 text-text-secondary" onClick={onAdd}><Plus />Add filter</Button>
      <span className="flex-1" />
      {dirtyLabel ? <span className="hidden shrink-0 text-xs text-text-tertiary lg:inline">{dirtyLabel}</span> : null}
      {onReset ? <Button variant="ghost" size="xs" className="shrink-0 text-muted-foreground" onClick={onReset}>Reset</Button> : null}
      {onSave ? <Button variant="outline" size="xs" className="shrink-0" onClick={onSave}><Save className="h-3 w-3" />Save view</Button> : null}
    </div>
  );
}
