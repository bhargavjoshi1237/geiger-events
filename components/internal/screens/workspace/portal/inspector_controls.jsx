"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Filter, Plus, X } from "lucide-react";
import {
  Button, Input, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { typeIcon } from "../state/format";
import { liveFieldsOf } from "../state/use_workspace";
import { cleanRule, RuleBuilder, ruleSummary } from "./rule_builder";

const NONE = "__none__";
export const STATUS = { id: "status", name: "Status", type: "status" };

export function Row({ label, hint, children, htmlFor }) {
  return (
    <div className="grid gap-1.5">
      {label ? <Label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="grid gap-0.5"><span className="text-sm text-foreground">{label}</span>{hint ? <span className="text-xs text-text-tertiary">{hint}</span> : null}</span>
      <Switch checked={Boolean(checked)} onCheckedChange={onChange} />
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength = 120, id }) {
  return <Input id={id} value={value ?? ""} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Choice({ value, onChange, options, placeholder = "Choose…", allowNone = false, noneLabel = "None" }) {
  return (
    <Select value={value ?? (allowNone ? NONE : "")} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ListChoice({ ws, value, onChange }) {
  return <Choice value={value} onChange={onChange} options={ws.objects.map((object) => ({ value: object.id, label: object.plural }))} placeholder="Choose a list" />;
}

export const fieldsOf = (ws, objectId) => liveFieldsOf(ws.data, objectId);

export function FieldChoice({ ws, objectId, value, onChange, test = () => true, allowStatus = false, allowNone = false, noneLabel }) {
  const statuses = ws.objects.find((object) => object.id === objectId)?.statuses ?? [];
  const options = [
    ...(allowStatus && statuses.length ? [{ value: "status", label: "Status" }] : []),
    ...fieldsOf(ws, objectId).filter(test).map((field) => ({ value: field.id, label: field.name })),
  ];
  return <Choice value={value} onChange={onChange} options={options} allowNone={allowNone} noneLabel={noneLabel} />;
}

// An ordered set of fields: chosen ones with up/down/remove, and a picker for the rest.
export function FieldList({ ws, objectId, value = [], onChange, test = () => true, allowStatus = false, max = 30, addLabel = "Add field" }) {
  const fields = fieldsOf(ws, objectId);
  const statuses = ws.objects.find((object) => object.id === objectId)?.statuses ?? [];
  const all = [...(allowStatus && statuses.length ? [STATUS] : []), ...fields.filter(test)];
  const byId = new Map(all.map((field) => [field.id, field]));
  const chosen = value.filter((id) => byId.has(id));
  const rest = all.filter((field) => !chosen.includes(field.id));
  const move = (index, dir) => {
    const next = [...chosen];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    onChange(next);
  };
  return (
    <div className="grid gap-1.5">
      {chosen.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {chosen.map((id, index) => {
            const field = byId.get(id);
            const Icon = field.type === "status" ? Filter : typeIcon(field.type);
            return (
              <li key={id} className="flex items-center gap-1.5 py-1 pl-2.5 pr-1 text-sm">
                <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-foreground">{field.name}</span>
                <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-text-tertiary hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Move down" disabled={index === chosen.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-text-tertiary hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Remove ${field.name}`} onClick={() => onChange(chosen.filter((item) => item !== id))} className="rounded p-1 text-text-tertiary hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {rest.length && chosen.length < max ? (
        <Select value="" onValueChange={(id) => onChange([...chosen, id])}>
          <SelectTrigger className="h-8 w-full border-dashed text-text-secondary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />{addLabel}</span></SelectTrigger>
          <SelectContent>{rest.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

// A block's own filter (rows it shows), edited in a popover with the portal rule builder.
export function RuleField({ ws, objectId, value, onChange, eventId, tokens, label = "Only show", hint }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? null);
  return (
    <Row label={label} hint={hint}>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setDraft(value ?? null); else onChange(cleanRule(draft)); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("justify-start", !value && "text-text-secondary")}>
            <Filter className="h-4 w-4" />{value ? ruleSummary(value) : "Every record they can see"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="left" className="max-h-[70vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto p-3">
          <RuleBuilder data={ws.data} objectId={objectId} value={draft} onChange={setDraft} eventId={eventId} tokens={tokens}
            emptyText="No conditions: every record the viewer's roles let them see." />
        </PopoverContent>
      </Popover>
    </Row>
  );
}

export function SortField({ ws, objectId, value, onChange }) {
  const first = value?.[0] ?? null;
  const fields = fieldsOf(ws, objectId).filter((field) => !["link_record", "link_event", "multi_select", "attachments", "rich_text"].includes(field.type));
  const options = [{ value: "number", label: "Number" }, { value: "title", label: "Title" }, { value: "created_at", label: "Created" }, { value: "updated_at", label: "Last changed" },
    ...fields.map((field) => ({ value: field.id, label: field.name }))];
  return (
    <Row label="Sort by">
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
        <Choice value={first?.field ?? null} allowNone noneLabel="Record number" options={options}
          onChange={(field) => onChange(field ? [{ field, dir: first?.dir ?? "asc" }] : [])} />
        <Choice value={first?.dir ?? "asc"} options={[{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }]}
          onChange={(dir) => onChange(first ? [{ ...first, dir }] : [])} />
      </div>
    </Row>
  );
}
