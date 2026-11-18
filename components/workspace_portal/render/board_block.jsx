"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COLOR_SWATCH } from "@/components/internal/screens/workspace/state/format";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue, fieldName, isVisibleOn, statusChoices } from "./values";

// A field with nothing in it, so its card row shows a dash instead of a bare label.
const isBlank = (record, id) => {
  if (id === "status") return !record.status;
  if (record.links?.[id]?.length) return false;
  const value = record.values?.[id] ?? record.computed?.[id];
  return value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length);
};

// Columns by status or a choice field. People who may change that value can drag cards between columns.
export function BoardBlock({ block, fill }) {
  const config = block.config;
  const { api, refresh } = usePortalView();
  const { list, byId } = useList(config.source?.objectId);
  const { data, error, loading, reload } = useBlockData(block, {});
  const openRecord = useOpenRecord();
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [moved, setMoved] = useState({});

  const byStatus = config.groupBy === "status";
  const field = byStatus ? null : byId.get(config.groupBy);
  const options = byStatus
    ? (list?.statuses ?? []).map((status) => ({ id: status.key, label: status.label, color: status.color }))
    : field?.config?.options ?? [];
  const valueOf = (row) => moved[row.id] ?? (byStatus ? row.status : row.values?.[config.groupBy]) ?? null;
  const canMove = (row) => !api.readOnly && (byStatus ? row.access?.status : row.access?.editable?.includes(config.groupBy));
  // Status columns the stage rules allow for the card being dragged.
  const draggedRow = data?.rows.find((item) => item.id === dragging);
  const openKeys = byStatus && draggedRow ? new Set(statusChoices(list, valueOf(draggedRow)).map((item) => item.key)) : null;
  const accepts = (key) => !openKeys || openKeys.has(key);

  const move = async (row, optionId) => {
    if (valueOf(row) === optionId) return;
    setMoved((current) => ({ ...current, [row.id]: optionId }));
    const { error: failed } = await api.command({
      action: "record.update", recordId: row.id, expectedRevision: row.revision,
      ...(byStatus ? { status: optionId } : { values: { [config.groupBy]: optionId } }),
    });
    if (failed) {
      toast.error(failed.message);
      setMoved((current) => { const copy = { ...current }; delete copy[row.id]; return copy; });
      return;
    }
    refresh();
  };

  let body;
  if (!list || (!byStatus && !field)) body = <Restricted />;
  else if (loading) body = <BlockLoading label={`Loading ${list.plural}`} />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!data?.rows.length) body = <EmptyRows text={config.emptyText} />;
  else {
    const columns = options.map((option) => ({ key: option.id, option, rows: data.rows.filter((row) => valueOf(row) === option.id) }));
    const rest = data.rows.filter((row) => !options.some((option) => option.id === valueOf(row)));
    if (rest.length) columns.push({ key: null, option: { id: null, label: byStatus ? "No status" : "None", color: "gray" }, rows: rest });
    const shown = (config.fields ?? []).filter((id) => id !== list.titleFieldId);
    body = (
      <div className={cn("scrollbar-subtle flex gap-3 overflow-x-auto pb-2", fill && "@4xl/page:min-h-0 @4xl/page:flex-1")}>
        {columns.map((column) => (
          <div key={column.key ?? "none"}
            onDragOver={(event) => { if (dragging && accepts(column.key)) { event.preventDefault(); setOver(column.key); } }}
            onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const row = draggedRow;
              const allowed = accepts(column.key);
              setDragging(null);
              setOver(null);
              if (row && column.key !== null && allowed) move(row, column.key);
            }}
            className={cn("flex min-w-60 flex-1 basis-0 flex-col rounded-xl border border-border bg-surface-subtle", over === column.key && dragging && "border-foreground/30",
              dragging && !accepts(column.key) && "opacity-50")}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", COLOR_SWATCH[column.option.color] ?? COLOR_SWATCH.gray)} />
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{column.option.label}</span>
              <span className="ml-auto rounded-full bg-surface-card px-1.5 text-xs tabular-nums text-text-secondary">{column.rows.length}</span>
            </div>
            <div className={cn("flex min-h-16 flex-col gap-2 px-2 pb-2", fill && "scrollbar-subtle @4xl/page:min-h-0 @4xl/page:flex-1 @4xl/page:overflow-y-auto")}>
              {column.rows.map((row) => (
                <article key={row.id} draggable={canMove(row)}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDragging(row.id); }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onClick={config.open ? () => openRecord(row) : undefined}
                  className={cn("rounded-lg border border-border bg-surface-card p-3 transition-colors", config.open && "cursor-pointer hover:border-border-strong",
                    canMove(row) && "active:cursor-grabbing", dragging === row.id && "opacity-50")}>
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{row.title || `${list.numberPrefix}-${row.number}`}</p>
                  {shown.some((id) => isVisibleOn(row, id)) ? (
                    <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
                      {shown.filter((id) => isVisibleOn(row, id)).map((id) => (
                        <Fragment key={id}>
                          <dt className="text-text-secondary">{fieldName(list, id)}</dt>
                          <dd className="flex min-w-0 font-medium tabular-nums text-foreground">
                            {isBlank(row, id) ? <span className="font-normal text-text-tertiary">—</span> : <CellValue list={list} fieldId={id} record={row} />}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <BlockFrame bare title={config.title} fill={fill}>{body}</BlockFrame>;
}
