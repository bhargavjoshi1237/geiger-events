"use client";

import { useState } from "react";
import { Calendar, CalendarClock, CircleDot, GripVertical, Hash, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { ActionMenu, Button, SegmentedTabs } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { typeIcon, typeLabel } from "../state/format";
import { OptionChip } from "../ws_ui";
import { useProcess } from "../process/use_process";
import { ObjectSettingsForm } from "./object_sheet";

function SystemRow({ icon: Icon, name, detail }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-md pl-[30px] pr-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/70 text-text-tertiary"><Icon className="h-3.5 w-3.5" /></span>
      <span className="flex-1 truncate text-[13px] text-muted-foreground">{name}</span>
      <span className="text-xs text-text-tertiary">{detail}</span>
      <Lock className="h-3.5 w-3.5 text-text-tertiary" />
    </div>
  );
}

function FieldsTab({ object, fields, run, onEditField, onDeleteField }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (targetId) => {
    if (!dragging || dragging === targetId) return;
    const order = fields.map((field) => field.id);
    order.splice(order.indexOf(dragging), 1);
    order.splice(order.indexOf(targetId), 0, dragging);
    run("field.reorder", { objectId: object.id, order }, { quiet: true });
  };
  return (
    <div className="p-2">
      {fields.map((field) => {
        const Icon = typeIcon(field.type);
        return (
          <div key={field.id} draggable onDragStart={() => setDragging(field.id)} onDragEnd={() => { setDragging(null); setOver(null); }}
            onDragOver={(event) => { if (dragging) { event.preventDefault(); setOver(field.id); } }} onDrop={() => { drop(field.id); setDragging(null); setOver(null); }}
            className={cn("group flex h-[38px] items-center gap-2 rounded-md px-2 hover:bg-surface-card", dragging === field.id && "opacity-50", over === field.id && dragging !== field.id && "shadow-[inset_0_2px_0_var(--foreground)]")}>
            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-text-tertiary" />
            <button type="button" onClick={() => onEditField(field)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{field.name}{field.required ? <span className="ml-0.5 text-red-500">*</span> : null}</span>
              <span className="shrink-0 text-xs text-text-secondary">{typeLabel(field.type)}</span>
            </button>
            <ActionMenu label={`${field.name} options`} items={[
              { icon: Pencil, label: "Edit field", onSelect: () => onEditField(field) },
              { separator: true },
              { icon: Trash2, label: "Delete field", destructive: true, onSelect: () => onDeleteField(field) },
            ]} />
          </div>
        );
      })}
      {!fields.length ? <p className="px-2 py-6 text-center text-sm text-text-secondary">No fields yet. Add the first one below.</p> : null}
      <div className="flex items-center justify-between px-2.5 pb-1.5 pt-4">
        <span className="text-xs font-medium text-text-secondary">Built in</span>
        <span className="text-[11px] text-text-tertiary">Can&apos;t be removed</span>
      </div>
      {object.statuses?.length ? <SystemRow icon={CircleDot} name="Status" detail={`${object.statuses.length} stage${object.statuses.length === 1 ? "" : "s"}`} /> : null}
      <SystemRow icon={Hash} name="Number" detail={`${object.numberPrefix}-`} />
      <SystemRow icon={Calendar} name="Created" detail="Date and time" />
      <SystemRow icon={CalendarClock} name="Last changed" detail="Date and time" />
    </div>
  );
}

function StagesTab({ eventId, object, onSettings, onRules }) {
  const process = useProcess(eventId);
  const rules = process.processes[object.id];
  const statuses = object.statuses ?? [];
  return (
    <div className="grid gap-4 p-4">
      {statuses.length ? (
        <ol className="grid gap-1">
          {statuses.map((status, index) => (
            <li key={status.key} className="flex h-9 items-center gap-2.5 rounded-md px-2">
              <span className="w-4 text-right text-xs tabular-nums text-text-tertiary">{index + 1}</span>
              <OptionChip option={status} />
              {rules?.requires?.[status.key]?.length ? <span className="ml-auto text-xs text-text-secondary">{rules.requires[status.key].length} required</span> : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-text-secondary">This list has no statuses. Add some in List settings to move records through stages.</p>}
      <p className="text-xs text-text-secondary">
        {rules?.enforce ? `Stage rules are on: ${rules.moves?.length ?? 0} allowed move${rules.moves?.length === 1 ? "" : "s"}.` : "Stage rules are off, so any status change is allowed."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onSettings}><Pencil className="h-4 w-4" />Edit statuses</Button>
        {statuses.length ? <Button variant="outline" size="sm" onClick={onRules}>Stage rules</Button> : null}
      </div>
    </div>
  );
}

// "Edit structure" side panel: the list's fields (drag to reorder), its stages and its settings. Changes apply straight away.
export function StructurePanel({ eventId, data, object, fields, run, onClose, onAddField, onEditField, onDeleteField, onStageRules, onDeleted }) {
  const [tab, setTab] = useState("fields");
  const tabs = [
    { label: <span className="inline-flex items-center gap-1.5">Fields<span className="text-xs text-text-secondary">{fields.length}</span></span>, value: "fields" },
    { label: <span className="inline-flex items-center gap-1.5">Stages<span className="text-xs text-text-secondary">{object.statuses?.length ?? 0}</span></span>, value: "stages" },
    { label: "List settings", value: "settings" },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 gap-3 border-b border-border/70 p-4 pb-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Structure of {object.plural}</p>
            <p className="mt-0.5 text-xs text-text-secondary">Changes apply straight away and can be undone.</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <SegmentedTabs fullWidth value={tab} onChange={setTab} tabs={tabs} buttonClassName="h-7" />
      </div>
      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "fields" ? <FieldsTab object={object} fields={fields} run={run} onEditField={onEditField} onDeleteField={onDeleteField} /> : null}
        {tab === "stages" ? <StagesTab eventId={eventId} object={object} onSettings={() => setTab("settings")} onRules={onStageRules} /> : null}
        {tab === "settings" ? <ObjectSettingsForm data={data} object={object} run={run} onDeleted={onDeleted} /> : null}
      </div>
      {tab === "fields" ? (
        <div className="shrink-0 border-t border-border/70 px-4 py-3">
          <Button size="sm" className="w-full" onClick={onAddField}><Plus className="h-4 w-4" />Add field</Button>
        </div>
      ) : null}
    </div>
  );
}
