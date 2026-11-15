"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { allowedMoves } from "@/lib/workspace/process/stages.js";
import { recordLabel } from "../state/format";
import { FieldValue, OptionChip } from "../ws_ui";

// Columns by status or a single-select field; drag a card to another column to change it.
export function BoardView({ object, fields, columns, rows, groupBy, eventId, timeZone, can, stageRules, onOpen, onMove }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const by = groupBy || "status";
  // Status lanes the stage rules don't allow from the dragged card's stage; people who can configure may still drop (and move anyway).
  const draggedRow = rows.find((item) => item.id === dragging);
  const allowed = by === "status" && draggedRow ? allowedMoves(stageRules, object, draggedRow.status ?? null) : null;
  const refused = (laneId) => Boolean(allowed) && laneId !== (draggedRow?.status ?? null) && !allowed.includes(laneId);
  const field = fields.find((item) => item.id === by);
  const options = by === "status"
    ? (object.statuses ?? []).map((status) => ({ id: status.key, label: status.label, color: status.color }))
    : field?.config?.options ?? [];
  const valueOf = (row) => (by === "status" ? row.status : row.values?.[by]) ?? null;
  const lanes = [{ id: null, label: by === "status" ? "No status" : "No value" }, ...options];
  const shown = columns.filter((column) => !column.hidden && column.fieldId !== object.titleFieldId)
    .map((column) => fields.find((item) => item.id === column.fieldId)).filter(Boolean).slice(0, 3);

  if (!options.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle px-6 py-12 text-center text-sm text-text-secondary">
        {by === "status" ? "Add statuses to this list to see it as a board." : "Add options to this field to see it as a board."}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {lanes.map((lane) => {
        const cards = rows.filter((row) => (lane.id === null ? !options.some((o) => o.id === valueOf(row)) : valueOf(row) === lane.id));
        if (lane.id === null && !cards.length) return null;
        return (
          <div key={lane.id ?? "none"}
            onDragOver={(event) => { if (dragging && can.update) { event.preventDefault(); setOver(lane.id ?? "none"); } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              const row = draggedRow;
              const blocked = refused(lane.id);
              setDragging(null);
              setOver(null);
              if (!row || valueOf(row) === lane.id) return;
              if (blocked && !can.configure) { toast.error(`The stage rules don't allow moving to ${lane.label}.`); return; }
              onMove(row, by, lane.id);
            }}
            className={cn("flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface-subtle", over === (lane.id ?? "none") && "border-foreground/30",
              dragging && refused(lane.id) && "opacity-50")}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              {lane.id ? <OptionChip option={lane} /> : <span className="text-sm text-text-secondary">{lane.label}</span>}
              <span className="text-xs text-text-tertiary">{cards.length}</span>
            </div>
            <div className="flex min-h-16 flex-col gap-2 px-2 pb-2">
              {cards.map((row) => (
                <button key={row.id} type="button" draggable={can.update}
                  onDragStart={() => setDragging(row.id)} onDragEnd={() => { setDragging(null); setOver(null); }}
                  onClick={() => onOpen(row.id)}
                  className={cn("space-y-1.5 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-left hover:border-foreground/20", dragging === row.id && "opacity-50")}>
                  <p className="truncate text-sm font-medium text-foreground">{recordLabel(object, row)}</p>
                  {shown.map((item) => (
                    <div key={item.id} className="flex min-h-5 items-center gap-2 overflow-hidden text-xs text-text-secondary">
                      <span className="shrink-0 text-text-tertiary">{item.name}</span>
                      <span className="min-w-0 truncate text-foreground"><FieldValue field={item} record={row} eventId={eventId} timeZone={timeZone} /></span>
                    </div>
                  ))}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
