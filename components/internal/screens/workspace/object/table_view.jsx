"use client";

import { Fragment, useRef, useState } from "react";
import { EyeOff, GripVertical, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  Popover, PopoverAnchor, PopoverContent,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { recordLabel, typeIcon } from "../state/format";
import { FieldValue, OptionChip } from "../ws_ui";
import { FieldInput } from "../record/field_input";

const INLINE = new Set(["short_text", "email", "phone", "url", "number", "currency", "percent", "rating", "single_select", "multi_select", "date", "datetime", "duration", "long_text"]);
const DEFAULT_WIDTH = 180;

function CellEditor({ field, row, eventId, timeZone, onSave, onClose }) {
  const [value, setValue] = useState(row.values?.[field.id] ?? null);
  const [busy, setBusy] = useState(false);
  const save = async (next = value) => {
    setBusy(true);
    await onSave(next);
    setBusy(false);
  };
  return (
    <div className="space-y-2" onKeyDown={(event) => {
      if (event.key === "Enter" && !event.shiftKey && field.type !== "long_text") { event.preventDefault(); save(); }
      if (event.key === "Escape") onClose();
    }}>
      <FieldInput field={field} value={value} eventId={eventId} timeZone={timeZone} autoFocus
        onChange={(next) => { setValue(next); if (field.type === "single_select" || field.type === "rating") save(next); }} />
      {field.type !== "single_select" && field.type !== "rating" ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save()} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Save</Button>
        </div>
      ) : null}
    </div>
  );
}

function groupRows(rows, groupBy, object, fields) {
  if (!groupBy) return [{ key: "all", rows }];
  const field = fields.find((item) => item.id === groupBy);
  const options = groupBy === "status"
    ? (object.statuses ?? []).map((status) => ({ id: status.key, label: status.label, color: status.color }))
    : field?.config?.options ?? [];
  const valueOf = (row) => (groupBy === "status" ? row.status : row.values?.[groupBy]) ?? null;
  const groups = options.map((option) => ({ key: option.id, option, rows: rows.filter((row) => valueOf(row) === option.id) }));
  const none = rows.filter((row) => !options.some((option) => option.id === valueOf(row)));
  if (none.length) groups.push({ key: "none", option: null, rows: none });
  return groups.filter((group) => group.rows.length);
}

export function TableView({
  object, fields, columns, rows, eventId, timeZone, can, editMode, selected, onSelect, onOpen, onCellSave,
  onEditField, onAddField, onHideField, onDeleteField, onReorder, onResize, groupBy,
}) {
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(null);
  const resize = useRef(null);
  const visible = columns.map((column) => ({ ...column, field: fields.find((field) => field.id === column.fieldId) })).filter((column) => column.field && !column.hidden);
  const selectable = can.update || can.delete;
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const groups = groupRows(rows, groupBy, object, fields);
  const span = visible.length + 2 + (editMode ? 1 : 0);

  const startResize = (event, fieldId, width) => {
    event.preventDefault();
    event.stopPropagation();
    resize.current = { fieldId, startX: event.clientX, width };
    const move = (e) => onResize(resize.current.fieldId, Math.max(80, Math.min(800, resize.current.width + e.clientX - resize.current.startX)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); resize.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const cellClick = (row, field) => {
    const type = getType(field.type);
    if (!can.update || !type.editable) return onOpen(row.id);
    if (field.type === "checkbox") return onCellSave(row, field, !row.values?.[field.id]);
    if (INLINE.has(field.type)) return setEditing({ rowId: row.id, fieldId: field.id });
    return onOpen(row.id);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {selectable ? (
              <th className="sticky left-0 z-20 w-10 bg-surface-subtle px-3 py-2.5">
                <Checkbox aria-label="Select all" checked={allSelected} onCheckedChange={() => onSelect(allSelected ? new Set() : new Set(rows.map((row) => row.id)))} />
              </th>
            ) : null}
            <th className={cn("sticky z-20 min-w-56 bg-surface-subtle px-3 py-2.5 text-left font-medium text-text-secondary", selectable ? "left-10" : "left-0")}>
              {object.titleFieldId ? fields.find((field) => field.id === object.titleFieldId)?.name ?? "Title" : "Record"}
            </th>
            {visible.filter((column) => column.fieldId !== object.titleFieldId).map((column) => {
              const Icon = typeIcon(column.field.type);
              const width = column.width ?? DEFAULT_WIDTH;
              return (
                <th key={column.fieldId} style={{ width, minWidth: width, maxWidth: width }}
                  draggable={editMode}
                  onDragStart={() => setDragging(column.fieldId)}
                  onDragOver={(event) => { if (dragging) event.preventDefault(); }}
                  onDrop={() => { if (dragging && dragging !== column.fieldId) onReorder(dragging, column.fieldId); setDragging(null); }}
                  className={cn("group relative px-3 py-2.5 text-left font-medium text-text-secondary", dragging === column.fieldId && "opacity-50")}>
                  <div className="flex items-center gap-1.5">
                    {editMode ? <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-text-tertiary" /> : null}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <span className="truncate">{column.field.name}</span>
                    {column.field.required ? <span className="text-red-500" aria-hidden>*</span> : null}
                    {editMode ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`${column.field.name} options`} className="ml-auto rounded p-0.5 text-text-tertiary hover:bg-surface-active hover:text-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEditField(column.field)}><Pencil className="h-4 w-4" />Edit field</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onHideField(column.field.id)}><EyeOff className="h-4 w-4" />Hide in this view</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 dark:text-red-400" onSelect={() => onDeleteField(column.field)}><Trash2 className="h-4 w-4" />Delete field</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  <span role="separator" aria-orientation="vertical" onPointerDown={(event) => startResize(event, column.fieldId, width)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 hover:bg-border group-hover:opacity-100" />
                </th>
              );
            })}
            {editMode ? (
              <th className="w-32 px-2 py-1.5 text-left">
                <Button size="sm" variant="ghost" onClick={onAddField}><Plus className="h-4 w-4" />Add field</Button>
              </th>
            ) : null}
            <th aria-hidden className="w-full" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {groupBy ? (
                <tr className="border-b border-border bg-surface-card">
                  <td colSpan={span} className="px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      {group.option ? <OptionChip option={group.option} /> : <span className="text-text-secondary">No value</span>}
                      <span className="text-text-tertiary">{group.rows.length}</span>
                    </span>
                  </td>
                </tr>
              ) : null}
              {group.rows.map((row) => (
                <tr key={row.id} className={cn("border-b border-border last:border-b-0 hover:bg-surface-card", selected.has(row.id) && "bg-surface-card")}>
                  {selectable ? (
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5">
                      <Checkbox aria-label={`Select ${recordLabel(object, row)}`} checked={selected.has(row.id)}
                        onCheckedChange={() => { const next = new Set(selected); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); onSelect(next); }} />
                    </td>
                  ) : null}
                  <td className={cn("sticky z-10 bg-inherit px-3 py-2.5", selectable ? "left-10" : "left-0")}>
                    <button type="button" onClick={() => onOpen(row.id)} className="flex max-w-72 items-center gap-2 text-left">
                      <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{object.numberPrefix}-{row.number}</span>
                      <span className="truncate font-medium text-foreground hover:underline">{row.title && row.title !== `${object.numberPrefix}-${row.number}` ? row.title : ""}</span>
                      {row.status && !groupBy ? <OptionChip option={(object.statuses ?? []).map((s) => ({ id: s.key, label: s.label, color: s.color })).find((s) => s.id === row.status)} /> : null}
                    </button>
                  </td>
                  {visible.filter((column) => column.fieldId !== object.titleFieldId).map((column) => {
                    const isEditing = editing?.rowId === row.id && editing.fieldId === column.fieldId;
                    const width = column.width ?? DEFAULT_WIDTH;
                    return (
                      <td key={column.fieldId} style={{ width, minWidth: width, maxWidth: width }} className="cursor-default px-3 py-2.5 align-middle"
                        onClick={() => cellClick(row, column.field)}>
                        <Popover open={isEditing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                          <PopoverAnchor asChild>
                            <div className="flex min-h-5 items-center overflow-hidden text-foreground">
                              <FieldValue field={column.field} record={row} eventId={eventId} timeZone={timeZone} onOpenRecord={(id) => onOpen(id, column.field.config.targetObjectId)} />
                            </div>
                          </PopoverAnchor>
                          {isEditing ? (
                            <PopoverContent align="start" className="w-80 p-3" onClick={(event) => event.stopPropagation()}>
                              <CellEditor field={column.field} row={row} eventId={eventId} timeZone={timeZone}
                                onClose={() => setEditing(null)}
                                onSave={async (value) => { const ok = await onCellSave(row, column.field, value); if (ok) setEditing(null); }} />
                            </PopoverContent>
                          ) : null}
                        </Popover>
                      </td>
                    );
                  })}
                  {editMode ? <td /> : null}
                  <td />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

