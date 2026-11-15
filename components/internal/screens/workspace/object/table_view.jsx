"use client";

import { Fragment, useRef, useState } from "react";
import { CircleDot, EyeOff, GripVertical, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import {
  ActionMenu, Button, Checkbox,
  Popover, PopoverAnchor, PopoverContent,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { recordLabel, typeIcon } from "../state/format";
import { FieldValue, OptionChip, TypeIcon } from "../ws_ui";
import { FieldInput } from "../record/field_input";

const INLINE = new Set(["short_text", "email", "phone", "url", "number", "currency", "percent", "rating", "single_select", "multi_select", "date", "datetime", "duration", "long_text"]);
const NUMERIC = new Set(["number", "currency", "percent", "rollup", "duration"]);
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

// Full-width rows under a sticky header; cells edit in place. `activeId` marks the record open in the side panel.
export function TableView({
  object, fields, columns, rows, eventId, timeZone, can, editMode, selected, onSelect, onOpen, onCellSave,
  onEditField, onHideField, onDeleteField, onReorder, onResize, groupBy, activeId = null, density = "comfortable",
}) {
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(null);
  const resize = useRef(null);
  const visible = columns.map((column) => ({ ...column, field: fields.find((field) => field.id === column.fieldId) })).filter((column) => column.field && !column.hidden);
  const selectable = can.update || can.delete;
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const groups = groupRows(rows, groupBy, object, fields);
  const statusColumn = Boolean(object.statuses?.length) && groupBy !== "status";
  const span = (selectable ? 1 : 0) + 1 + (statusColumn ? 1 : 0) + visible.filter((column) => column.fieldId !== object.titleFieldId).length + 1;

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

  const statusOptions = (object.statuses ?? []).map((s) => ({ id: s.key, label: s.label, color: s.color }));
  const titleField = object.titleFieldId ? fields.find((field) => field.id === object.titleFieldId) : null;

  return (
    // Every column has a set width and the empty last column takes what's left, so the table is exactly as wide as its columns
    // (never a 100%-wide column, which made browsers stretch it to an enormous width).
    <div className="w-max min-w-full">
      <table className="w-max min-w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-30 bg-background">
          <tr className="h-9 border-b border-border/70">
            {selectable ? (
              <th className="sticky left-0 z-20 w-12 bg-background pl-6 pr-2">
                <Checkbox aria-label="Select all" checked={allSelected} onCheckedChange={() => onSelect(allSelected ? new Set() : new Set(rows.map((row) => row.id)))} />
              </th>
            ) : null}
            <th className={cn("sticky z-20 w-64 min-w-64 bg-background px-3 text-left text-xs font-medium text-text-secondary", selectable ? "left-12" : "left-0 pl-6")}>
              <span className="flex items-center gap-1.5">
                {editMode ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" /> : null}
                <TypeIcon type={titleField?.type ?? "short_text"} className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                {titleField?.name ?? "Record"}{titleField?.required ? <span className="text-red-500" aria-hidden>*</span> : null}
              </span>
            </th>
            {statusColumn ? (
              <th className="w-32 px-3 text-left text-xs font-medium text-text-secondary">
                <span className="flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-text-tertiary" />Status</span>
              </th>
            ) : null}
            {visible.filter((column) => column.fieldId !== object.titleFieldId).map((column) => {
              const Icon = typeIcon(column.field.type);
              const width = column.width ?? DEFAULT_WIDTH;
              const right = NUMERIC.has(column.field.type) && !editMode;
              return (
                <th key={column.fieldId} style={{ width, minWidth: width, maxWidth: width }}
                  draggable={editMode}
                  onDragStart={() => setDragging(column.fieldId)}
                  onDragOver={(event) => { if (dragging) event.preventDefault(); }}
                  onDrop={() => { if (dragging && dragging !== column.fieldId) onReorder(dragging, column.fieldId); setDragging(null); }}
                  className={cn("group relative px-3 text-left text-xs font-medium text-text-secondary", dragging === column.fieldId && "opacity-50")}>
                  <div className={cn("flex items-center gap-1.5", right && "justify-end")}>
                    {editMode ? <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-text-tertiary" /> : null}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <span className="truncate">{column.field.name}</span>
                    {column.field.required ? <span className="text-red-500" aria-hidden>*</span> : null}
                    {editMode ? (
                      <ActionMenu className="ml-auto" triggerClassName="size-6" label={`${column.field.name} options`} items={[
                        { icon: Pencil, label: "Edit field", onSelect: () => onEditField(column.field) },
                        { icon: EyeOff, label: "Hide in this view", onSelect: () => onHideField(column.field.id) },
                        { separator: true },
                        { icon: Trash2, label: "Delete field", destructive: true, onSelect: () => onDeleteField(column.field) },
                      ]} />
                    ) : null}
                  </div>
                  <span role="separator" aria-orientation="vertical" onPointerDown={(event) => startResize(event, column.fieldId, width)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 hover:bg-border group-hover:opacity-100" />
                </th>
              );
            })}
            <th aria-hidden />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {groupBy ? (
                <tr className="border-b border-border/70 bg-surface-subtle">
                  <td colSpan={span} className="py-2 pl-6 pr-3 text-[13px]">
                    <span className="inline-flex items-center gap-2">
                      {group.option ? <OptionChip option={group.option} /> : <span className="text-text-secondary">No value</span>}
                      <span className="text-xs tabular-nums text-text-tertiary">{group.rows.length}</span>
                    </span>
                  </td>
                </tr>
              ) : null}
              {group.rows.map((row) => {
                const active = selected.has(row.id) || row.id === activeId;
                return (
                <tr key={row.id} className={cn("group/row border-b border-border/70", density === "comfortable" ? "h-11" : "h-9", active ? "bg-surface-card" : "bg-background hover:bg-surface-subtle")}>
                  {selectable ? (
                    <td className="sticky left-0 z-10 bg-inherit pl-6 pr-2">
                      <Checkbox aria-label={`Select ${recordLabel(object, row)}`} checked={selected.has(row.id)}
                        onCheckedChange={() => { const next = new Set(selected); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); onSelect(next); }} />
                    </td>
                  ) : null}
                  <td className={cn("sticky z-10 bg-inherit px-3", selectable ? "left-12" : "left-0 pl-6")}>
                    <button type="button" onClick={() => onOpen(row.id)} className="flex max-w-72 items-center gap-2 text-left">
                      <span className="w-11 shrink-0 text-xs tabular-nums text-text-tertiary">{object.numberPrefix}-{row.number}</span>
                      <span className="truncate font-medium text-foreground hover:underline">{row.title && row.title !== `${object.numberPrefix}-${row.number}` ? row.title : ""}</span>
                    </button>
                  </td>
                  {statusColumn ? (
                    <td className="px-3" onClick={() => onOpen(row.id)}>
                      <OptionChip option={statusOptions.find((s) => s.id === row.status)} />
                    </td>
                  ) : null}
                  {visible.filter((column) => column.fieldId !== object.titleFieldId).map((column) => {
                    const isEditing = editing?.rowId === row.id && editing.fieldId === column.fieldId;
                    const width = column.width ?? DEFAULT_WIDTH;
                    return (
                      <td key={column.fieldId} style={{ width, minWidth: width, maxWidth: width }} className="cursor-default px-3 align-middle"
                        onClick={() => cellClick(row, column.field)}>
                        <Popover open={isEditing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                          <PopoverAnchor asChild>
                            <div className={cn("flex min-h-5 items-center overflow-hidden text-foreground", NUMERIC.has(column.field.type) && "justify-end")}>
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
                  <td />
                </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

