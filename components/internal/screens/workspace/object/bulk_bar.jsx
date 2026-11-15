"use client";

import { useState } from "react";
import { Download, Loader2, PencilLine, Trash2, X } from "lucide-react";
import {
  Button, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { plural } from "../state/format";
import { Muted, OptionChip } from "../ws_ui";
import { FieldInput } from "../record/field_input";

const NONE = "__none__";

// Actions for the selected rows: set a field, change status, export, delete.
export function BulkBar({ object, fields, count, can, eventId, timeZone, stageRules, onApply, onExport, onDelete, onClear }) {
  const editable = fields.filter((field) => getType(field.type).editable && field.type !== "attachments");
  const [fieldId, setFieldId] = useState(editable[0]?.id ?? "");
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const field = editable.find((item) => item.id === fieldId);
  const apply = async (payload) => {
    setBusy(true);
    await onApply(payload);
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2">
      <span className="text-sm font-medium text-foreground">{plural(count, "selected", "selected")}</span>
      <span className="h-4 w-px bg-border" aria-hidden />
      {can.update && editable.length ? (
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />Set a field</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3 p-3">
            <div className="space-y-1.5">
              <Label>Field</Label>
              <Select value={fieldId} onValueChange={(next) => { setFieldId(next); setValue(null); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{editable.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field ? (
              <div className="space-y-1.5">
                <Label>New value</Label>
                <FieldInput key={field.id} field={field} value={value} onChange={setValue} eventId={eventId} timeZone={timeZone} />
                <p className="text-xs text-text-tertiary">Leave empty to clear it.</p>
              </div>
            ) : null}
            <Button size="sm" className="w-full" disabled={busy || !field} onClick={() => apply({ values: { [field.id]: value } })}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Apply to {plural(count, "record")}
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}
      {can.update && object.statuses?.length ? (
        <Select value="" onValueChange={(status) => apply({ status: status === NONE ? null : status })}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Change status" /></SelectTrigger>
          <SelectContent>
            {stageRules?.enforce ? null : <SelectItem value={NONE}><Muted>No status</Muted></SelectItem>}
            {object.statuses.map((status) => <SelectItem key={status.key} value={status.key}><OptionChip option={status} /></SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onExport}><Download className="h-4 w-4" />Export</Button>
      {can.delete ? (
        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>
      ) : null}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}><X className="h-4 w-4" />Clear</Button>
    </div>
  );
}
