"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Button, IconPicker, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { liveFieldsOf } from "../state/use_workspace";
import { toKebab } from "../state/format";
import { OptionsEditor } from "./options_editor";

const tempKey = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;
const NUMBER = "__number__";

// Create or edit a list: names, icon, record numbering, title field and statuses.
export function ObjectSheet({ open, onOpenChange, data, object, run, onCreated, onDeleted }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {open ? <ObjectSheetBody key={object?.id ?? "new"} onOpenChange={onOpenChange} data={data} object={object} run={run} onCreated={onCreated} onDeleted={onDeleted} /> : null}
      </SheetContent>
    </Sheet>
  );
}

// The same settings inline, for the Edit structure panel's "List settings" tab.
export function ObjectSettingsForm({ data, object, run, onDeleted }) {
  return <ObjectSheetBody key={`${object.id}:${object.revision}`} inline onOpenChange={() => {}} data={data} object={object} run={run} onDeleted={onDeleted} />;
}

function ObjectSheetBody({ onOpenChange, data, object, run, onCreated, onDeleted, inline = false }) {
  const [name, setName] = useState(object?.name ?? "");
  const [plural, setPlural] = useState(object?.plural ?? "");
  const [icon, setIcon] = useState(object?.icon ?? "database");
  const [prefix, setPrefix] = useState(object?.numberPrefix ?? "");
  const [titleFieldId, setTitleFieldId] = useState(object?.titleFieldId ?? null);
  const [statuses, setStatuses] = useState(() => object?.statuses?.map((status) => ({ ...status })) ?? []);
  const [busy, setBusy] = useState(false);
  const fields = useMemo(() => (object ? liveFieldsOf(data, object.id) : []), [data, object]);
  const titleChoices = fields.filter((field) => getType(field.type).titleable || field.type === "formula");

  const submit = async () => {
    setBusy(true);
    const cleanStatuses = statuses.filter((status) => status.label.trim())
      .map(({ key, label, color }) => (key && !key.startsWith("tmp_") ? { key, label: label.trim(), color } : { label: label.trim(), color }));
    const values = {
      name: name.trim(), plural: plural.trim() || undefined, icon: toKebab(icon) || "database",
      ...(prefix.trim() ? { numberPrefix: prefix.trim().toUpperCase() } : {}), statuses: cleanStatuses,
    };
    const result = object
      ? await run("object.update", { objectId: object.id, expectedRevision: object.revision, patch: { ...values, titleFieldId } })
      : await run("object.create", { object: values });
    setBusy(false);
    if (result.error) return;
    onOpenChange(false);
    if (!object) onCreated?.(result.data.object);
  };

  const remove = async () => {
    const result = await run("object.delete", { objectId: object.id });
    if (!result.error) { onOpenChange(false); onDeleted?.(); }
  };

  return (
    <>
        {inline ? null : (
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-base">{object ? "List settings" : "New list"}</SheetTitle>
            <SheetDescription>{object ? "Names, numbering, the title field and statuses." : "A list holds one kind of thing, like papers, reviewers or booths."}</SheetDescription>
          </SheetHeader>
        )}
        <div className={cn("min-h-0 flex-1 space-y-5 overflow-y-auto", inline ? "p-4" : "px-5 py-4")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws-object-name">One is called</Label>
              <Input id="ws-object-name" autoFocus value={name} maxLength={100} placeholder="Paper"
                onChange={(e) => { setName(e.target.value); if (!object && (!plural || plural === `${name}s`)) setPlural(e.target.value ? `${e.target.value}s` : ""); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-object-plural">Many are called</Label>
              <Input id="ws-object-plural" value={plural} maxLength={100} placeholder="Papers" onChange={(e) => setPlural(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <IconPicker value={icon} onValueChange={(next) => setIcon(next)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-object-prefix">Record numbers</Label>
              <Input id="ws-object-prefix" value={prefix} maxLength={6} placeholder="PAP" onChange={(e) => setPrefix(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} />
              <p className="text-xs text-text-tertiary">Records are numbered {prefix || "PAP"}-1, {prefix || "PAP"}-2…</p>
            </div>
          </div>
          {object ? (
            <div className="space-y-1.5">
              <Label>Title field</Label>
              <Select value={titleFieldId ?? NUMBER} onValueChange={(next) => setTitleFieldId(next === NUMBER ? null : next)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NUMBER}>Record number</SelectItem>
                  {titleChoices.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-tertiary">What a record is called in links, boards and search.</p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Statuses</Label>
            <p className="text-xs text-text-tertiary">Optional stages a record moves through, like Submitted, Under review, Accepted.</p>
            <OptionsEditor items={statuses} idKey="key" makeId={tempKey} onChange={setStatuses} addLabel="Add status" placeholder="Status name" />
          </div>
        </div>
        <SheetFooter className={cn("flex-row items-center justify-between gap-2 border-t border-border", inline ? "px-4 py-3" : "px-5 py-3")}>
          <div>
            {object ? (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={remove}>
                <Trash2 className="h-4 w-4" />Delete list
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {inline ? null : <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
            <Button size={inline ? "sm" : "default"} onClick={submit} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{object ? "Save" : "Create list"}</Button>
          </div>
        </SheetFooter>
    </>
  );
}

