"use client";

import { Link2, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { TOKENS } from "@/lib/workspace/portal/contracts.js";
import { LIST_OPERATORS, NO_VALUE_OPERATORS, OPERATOR_LABELS, optionOf } from "../state/format";
import { liveFieldsOf } from "../state/use_workspace";
import { OptionChip } from "../ws_ui";
import { filterTargets } from "../object/filter_builder";
import { LinkPicker } from "../record/link_picker";

const CREATED_BY = { id: "created_by", name: "Added by", cast: "created_by", operators: ["eq"], system: true };
const SPECIFIC = "__specific__";

// Everything a rule on this list can test: fields, system columns, and links to or from other lists.
function targetsFor(data, objectId, depth) {
  const fields = liveFieldsOf(data, objectId).filter((field) => field.type !== "attachments");
  const out = [...filterTargets(fields).filter((target) => !(depth > 0 && ["lookup", "rollup"].includes(target.field?.type))), CREATED_BY];
  if (depth < 2) {
    const objects = new Map((data?.objects ?? []).filter((object) => !object.deletedAt).map((object) => [object.id, object]));
    for (const field of fields.filter((item) => item.type === "link_record" && objects.has(item.config.targetObjectId))) {
      out.push({ id: `fwd:${field.id}`, related: field.id, direction: "forward", targetObjectId: field.config.targetObjectId,
        name: `${field.name} (linked ${objects.get(field.config.targetObjectId).plural.toLowerCase()})` });
    }
    for (const field of (data?.fields ?? []).filter((item) => !item.deletedAt && item.type === "link_record" && item.config.targetObjectId === objectId && objects.has(item.objectId))) {
      out.push({ id: `back:${field.id}`, related: field.id, direction: "back", targetObjectId: field.objectId,
        name: `${objects.get(field.objectId).plural} linking here (${field.name})` });
    }
  }
  return out;
}

const targetIdOf = (item) => ("related" in item ? `${item.direction === "back" ? "back" : "fwd"}:${item.related}` : item.field);

function blankFor(target) {
  if (target.related) return { related: target.related, direction: target.direction, match: null };
  if (target.id === "created_by") return { field: "created_by", operator: "eq", value: TOKENS.me };
  return { field: target.id, operator: target.operators[0] };
}

function LinkValue({ target, value, onChange, tokens, eventId }) {
  const ids = (Array.isArray(value) ? value : []).filter((id) => typeof id === "string");
  const targetObject = target.field.config.targetObjectId;
  const choices = [
    ...(tokens.me && tokens.me === targetObject ? [{ value: TOKENS.me, label: "Me (the viewer)" }] : []),
    ...(tokens.record && tokens.record === targetObject ? [{ value: TOKENS.record, label: "This record (the page's record)" }] : []),
  ];
  const token = ids.length === 1 && choices.some((choice) => choice.value === ids[0]) ? ids[0] : null;
  return (
    <div className="grid gap-2">
      {choices.length ? (
        <Select value={token ?? SPECIFIC} onValueChange={(next) => onChange(next === SPECIFIC ? [] : [next])}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
            <SelectItem value={SPECIFIC}>Specific records…</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {!token ? (
        <LinkPicker field={target.field} eventId={eventId} value={ids.map((id) => ({ id, label: "Selected record" }))}
          onChange={(links) => onChange(links.map((link) => link.id))} />
      ) : null}
    </div>
  );
}

function ValueInput({ target, operator, value, onChange, statuses, tokens, eventId }) {
  if (NO_VALUE_OPERATORS.has(operator) || target.cast === "created_by") return null;
  if (target.cast === "link") return <LinkValue target={target} value={value} onChange={onChange} tokens={tokens} eventId={eventId} />;
  const options = target.id === "status" ? statuses.map((status) => ({ id: status.key, label: status.label, color: status.color })) : target.field?.config?.options;
  if (options) {
    if (LIST_OPERATORS.has(operator)) {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {options.map((option) => (
            <button key={option.id} type="button" onClick={() => onChange(chosen.includes(option.id) ? chosen.filter((id) => id !== option.id) : [...chosen, option.id])}
              className={cn("rounded-md border px-1 py-0.5", chosen.includes(option.id) ? "border-foreground/40" : "border-transparent opacity-60 hover:opacity-100")}>
              <OptionChip option={option} />
            </button>
          ))}
        </div>
      );
    }
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Choose…">{value ? <OptionChip option={options.find((o) => o.id === value) ?? optionOf(target.field, value)} /> : null}</SelectValue></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}><OptionChip option={option} /></SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (target.cast === "date" || target.cast === "timestamptz") {
    const today = value === TOKENS.today;
    return (
      <div className="flex gap-2">
        <Select value={today ? "today" : "date"} onValueChange={(mode) => onChange(mode === "today" ? TOKENS.today : null)}>
          <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="date">A date</SelectItem></SelectContent>
        </Select>
        {!today ? <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} /> : null}
      </div>
    );
  }
  if (target.cast === "numeric") return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  const mine = value === TOKENS.myEmail;
  if (target.field?.type === "email" || target.field?.type === "short_text") {
    return (
      <div className="flex gap-2">
        <Select value={mine ? "mine" : "text"} onValueChange={(mode) => onChange(mode === "mine" ? TOKENS.myEmail : "")}>
          <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="mine">Their email</SelectItem><SelectItem value="text">Some text</SelectItem></SelectContent>
        </Select>
        {!mine ? <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" /> : null}
      </div>
    );
  }
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />;
}

function Condition({ item, targets, data, objectId, depth, tokens, eventId, onChange, onRemove }) {
  const target = targets.find((entry) => entry.id === targetIdOf(item)) ?? targets[0];
  const statuses = (data?.objects ?? []).find((object) => object.id === objectId)?.statuses ?? [];
  const pick = (
    <Select value={target.id} onValueChange={(id) => onChange(blankFor(targets.find((entry) => entry.id === id)))}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{targets.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.related ? <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />{entry.name}</span> : entry.name}</SelectItem>)}</SelectContent>
    </Select>
  );
  const remove = <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Remove condition" onClick={onRemove}><X className="h-4 w-4" /></Button>;

  if (target.related) {
    return (
      <div className="grid gap-2 rounded-lg border border-border bg-surface-subtle p-2">
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{pick}</div>{remove}</div>
        <p className="px-1 text-xs text-text-secondary">Matches when at least one linked record{item.match ? " also meets these conditions" : " exists"}.</p>
        <RuleBuilder data={data} objectId={target.targetObjectId} value={item.match ?? null} depth={depth + 1} tokens={tokens} eventId={eventId}
          onChange={(match) => onChange({ ...item, match })} compact />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_auto]">
      {pick}
      {target.cast === "created_by" ? (
        <div className="flex h-9 items-center px-1 text-sm text-text-secondary">is me (the viewer)</div>
      ) : (
        <Select value={item.operator} onValueChange={(operator) => onChange({ ...item, operator, value: LIST_OPERATORS.has(operator) === LIST_OPERATORS.has(item.operator) ? item.value : undefined })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{target.operators.map((op) => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <div className="min-w-0">
        <ValueInput target={target} operator={item.operator} value={item.value} statuses={statuses} tokens={tokens} eventId={eventId}
          onChange={(value) => onChange({ ...item, value })} />
      </div>
      {remove}
    </div>
  );
}

// Builds a portal rule: conditions joined by all/any, groups, and links to other lists. Tokens say which of
// "me" (a link to the people list) and "this record" (a link to a record page's list) can be offered.
export function RuleBuilder({ data, objectId, value, onChange, tokens = {}, eventId, depth = 0, compact = false, emptyText }) {
  const targets = targetsFor(data, objectId, depth);
  const node = value ?? { op: "and", items: [] };
  const setItems = (items) => onChange(items.length ? { ...node, items } : null);
  const blank = () => blankFor(targets[0]);
  const props = { targets, data, objectId, depth, tokens, eventId };
  if (!targets.length) return null;
  return (
    <div className="grid gap-2">
      {node.items.length > 1 ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          Match
          <Select value={node.op} onValueChange={(op) => onChange({ ...node, op })}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="and">all</SelectItem><SelectItem value="or">any</SelectItem></SelectContent>
          </Select>
          of these
        </div>
      ) : null}
      {!node.items.length && !compact ? <p className="text-sm text-text-secondary">{emptyText ?? "No conditions yet."}</p> : null}
      {node.items.map((item, index) => (item.items ? (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-2">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            Group matching
            <Select value={item.op} onValueChange={(op) => setItems(node.items.map((x, i) => (i === index ? { ...item, op } : x)))}>
              <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="and">all</SelectItem><SelectItem value="or">any</SelectItem></SelectContent>
            </Select>
            <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label="Remove group" onClick={() => setItems(node.items.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {item.items.map((inner, j) => (
            <Condition key={j} item={inner} {...props}
              onChange={(next) => setItems(node.items.map((x, i) => (i === index ? { ...item, items: item.items.map((y, k) => (k === j ? next : y)) } : x)))}
              onRemove={() => setItems(node.items.map((x, i) => (i === index ? { ...item, items: item.items.filter((_, k) => k !== j) } : x)).filter((x) => !x.items || x.items.length))} />
          ))}
          <Button type="button" variant="ghost" size="sm" className="justify-self-start"
            onClick={() => setItems(node.items.map((x, i) => (i === index ? { ...item, items: [...item.items, blank()] } : x)))}><Plus className="h-4 w-4" />Add condition</Button>
        </div>
      ) : (
        <Condition key={index} item={item} {...props}
          onChange={(next) => setItems(node.items.map((x, i) => (i === index ? next : x)))}
          onRemove={() => setItems(node.items.filter((_, i) => i !== index))} />
      )))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setItems([...node.items, blank()])}><Plus className="h-4 w-4" />{compact ? "Add condition" : "Add condition"}</Button>
        {depth === 0 && !compact ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...node.items, { op: node.op === "and" ? "or" : "and", items: [blank()] }])}>Add group</Button>
        ) : null}
      </div>
    </div>
  );
}

// Drops conditions that still need a value, so a half-built rule can be saved.
export function cleanRule(node) {
  if (!node) return null;
  const items = (node.items ?? []).map((item) => {
    if (item.items) return cleanRule(item);
    if ("related" in item) return { related: item.related, direction: item.direction, ...(item.match ? { match: cleanRule(item.match) ?? undefined } : {}) };
    if (item.field === "created_by") return item;
    if (NO_VALUE_OPERATORS.has(item.operator)) return { field: item.field, operator: item.operator };
    const value = item.value;
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return null;
    return { field: item.field, operator: item.operator, value };
  }).filter(Boolean);
  return items.length ? { op: node.op, items } : null;
}

// One line describing a rule, for summaries.
export function ruleSummary(node) {
  const count = (n) => (n?.items ?? []).reduce((sum, item) => sum + (item.items ? count(item) : 1), 0);
  const n = count(node);
  return n ? `${n} condition${n === 1 ? "" : "s"}` : "No conditions";
}
