"use client";

import { useState } from "react";
import { CircleDot, Download, Loader2, PencilLine, Trash2, X } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Popover, PopoverContent, PopoverTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator,
} from "@geiger/ui";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { plural } from "../state/format";
import { Muted, OptionChip } from "../ws_ui";
import { FieldInput } from "../record/field_input";

const ACTION = "h-[30px] gap-1.5 px-2.5 text-[13px] font-normal text-foreground hover:bg-surface-strong";

// Floating actions for the selected rows: change status, set a field, export, delete.
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
    <div className="absolute bottom-14 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-[10px] border border-border bg-surface-dialog py-1.5 pl-3.5 pr-1.5 shadow-xl">
      <span className="mr-2 shrink-0 text-[13px] font-medium text-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : plural(count, "selected", "selected")}</span>
      <Separator orientation="vertical" className="mx-1 shrink-0 bg-border-strong data-[orientation=vertical]:h-5" />
      {can.update && object.statuses?.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className={ACTION}><CircleDot className="h-3.5 w-3.5" />Status</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            {stageRules?.enforce ? null : <DropdownMenuItem onSelect={() => apply({ status: null })}><Muted>No status</Muted></DropdownMenuItem>}
            {object.statuses.map((status) => (
              <DropdownMenuItem key={status.key} onSelect={() => apply({ status: status.key })}><OptionChip option={status} /></DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {can.update && editable.length ? (
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="ghost" className={ACTION}><PencilLine className="h-3.5 w-3.5" />Set field</Button></PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-80 space-y-3 p-3">
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
      <Button size="sm" variant="ghost" className={ACTION} onClick={onExport}><Download className="h-3.5 w-3.5" />Export</Button>
      {can.delete ? (
        <Button size="sm" variant="ghost" className={`${ACTION} text-red-600 hover:text-red-600 dark:text-red-400`} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
      ) : null}
      <Separator orientation="vertical" className="mx-1 shrink-0 bg-border-strong data-[orientation=vertical]:h-5" />
      <Button size="icon" variant="ghost" className="h-[30px] w-[30px] shrink-0 text-muted-foreground hover:bg-surface-strong" aria-label="Clear selection" onClick={onClear}><X className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
