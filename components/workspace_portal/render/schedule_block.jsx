"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dayWindow, findClashes, movedTimes, scheduleItems, SLOT, snap } from "@/lib/workspace/components/schedule.js";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { addDays, parseDay, useAnchor } from "./dated";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue, fieldName, isVisibleOn } from "./values";

const PX = 1.1;
const LANE_WIDTH = 168;
const NO_LANE = "__none__";
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const dayLabel = (day) => parseDay(day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// Side-by-side columns for items that overlap inside one lane.
function columnsFor(items) {
  const ends = [];
  const placed = new Map();
  for (const item of [...items].sort((a, b) => a.startMin - b.startMin)) {
    let column = ends.findIndex((end) => end <= item.startMin);
    if (column < 0) { column = ends.length; ends.push(0); }
    ends[column] = item.endMin;
    placed.set(item.id, column);
  }
  return { placed, count: Math.max(1, ends.length) };
}

// Sessions on a day grid: lanes (rooms, tracks) as columns, 15-minute rows; drag to move or resize when allowed.
export function ScheduleBlock({ block, fill }) {
  const config = block.config;
  const { api, timeZone, refresh } = usePortalView();
  const { list, byId } = useList(config.source?.objectId);
  const startField = byId.get(config.startField);
  const laneField = config.laneField ? byId.get(config.laneField) : null;
  const days = config.days ?? 3;
  const { anchor: start, setAnchor, today } = useAnchor(block, config, startField, timeZone);
  const from = start ?? today;
  const to = addDays(from, days - 1);
  const [day, setDay] = useState(null);
  const shownDay = day && day >= from && day <= to ? day : from;
  const { data, error, loading, refreshing, reload } = useBlockData(block, { range: { from, to } }, { enabled: start !== null });
  const openRecord = useOpenRecord();
  const [drag, setDrag] = useState(null);
  const [moved, setMoved] = useState({});

  const items = useMemo(() => scheduleItems((data?.rows ?? []).map((row) => (moved[row.id] ? { ...row, values: { ...row.values, ...moved[row.id] } } : row)), {
    startField: config.startField, endField: config.endField, durationField: config.durationField,
    laneField: laneField ? { id: laneField.id, type: laneField.type } : null, peopleField: config.peopleField, timeZone,
  }), [data, moved, config.startField, config.endField, config.durationField, config.peopleField, laneField, timeZone]);
  const clashes = useMemo(() => {
    const out = findClashes(items);
    if (config.peopleField) for (const [id, others] of findClashes(items, { by: "people" })) out.set(id, new Set([...(out.get(id) ?? []), ...others]));
    return out;
  }, [items, config.peopleField]);

  const lanes = useMemo(() => {
    const known = laneField ? (data?.lanes ?? []) : [];
    const ids = new Set(known.map((lane) => lane.id));
    const unknown = items.some((item) => !item.lanes.length || item.lanes.every((id) => !ids.has(id)));
    return [...known, ...(unknown || !known.length ? [{ id: NO_LANE, label: laneField ? "Unassigned" : list?.plural ?? "Items" }] : [])];
  }, [data, items, laneField, list]);
  const laneOf = (item) => item.lanes.find((id) => lanes.some((lane) => lane.id === id)) ?? NO_LANE;
  const dayItems = items.filter((item) => item.day === shownDay);
  const span = dayWindow(dayItems);
  const height = (span.to - span.from) * PX;

  const editable = (row) => !api.readOnly && row.access?.editable?.includes(config.startField) && (!config.endField || row.access.editable.includes(config.endField));
  const laneEditable = (row) => laneField && ["single_select", "link_record"].includes(laneField.type) && row.access?.editable?.includes(laneField.id);

  const commit = async (item, { startMin, endMin, laneId }) => {
    const times = movedTimes(item, { startMin, endMin: endMin ?? null, timeZone });
    const values = {};
    if (config.endField) { values[config.startField] = times.start; values[config.endField] = times.end; }
    else {
      values[config.startField] = times.start;
      if (endMin !== undefined && config.durationField) values[config.durationField] = Math.round((Date.parse(times.end) - Date.parse(times.start)) / 1000);
    }
    if (laneId && laneId !== laneOf(item) && laneEditable(item.row)) {
      values[laneField.id] = laneId === NO_LANE ? (laneField.type === "single_select" ? null : []) : laneField.type === "single_select" ? laneId : [{ kind: "record", id: laneId }];
    }
    setMoved((current) => ({ ...current, [item.id]: values }));
    const { error: failed } = await api.command({ action: "record.update", recordId: item.row.id, expectedRevision: item.row.revision, values });
    if (failed) {
      toast.error(failed.message);
      setMoved((current) => { const copy = { ...current }; delete copy[item.id]; return copy; });
      return;
    }
    refresh();
  };

  const startDrag = (event, item, mode) => {
    if (!editable(item.row)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ id: item.id, mode, x: event.clientX, y: event.clientY, dMin: 0, dLane: 0, movedPx: 0 });
  };
  const moveDrag = (event) => {
    if (!drag) return;
    const dy = event.clientY - drag.y;
    const dx = event.clientX - drag.x;
    setDrag({ ...drag, dMin: snap(dy / PX, SLOT), dLane: drag.mode === "move" ? Math.round(dx / LANE_WIDTH) : 0, movedPx: Math.max(drag.movedPx, Math.abs(dx) + Math.abs(dy)) });
  };
  const endDrag = (item) => {
    const current = drag;
    setDrag(null);
    if (!current) return;
    if (current.movedPx < 4) { if (config.open) openRecord(item.row); return; }
    if (current.mode === "resize") { if (current.dMin) commit(item, { startMin: item.startMin, endMin: item.endMin + current.dMin }); return; }
    const laneIndex = lanes.findIndex((lane) => lane.id === laneOf(item));
    const target = lanes[Math.max(0, Math.min(lanes.length - 1, laneIndex + current.dLane))]?.id;
    if (current.dMin || (target && target !== laneOf(item))) commit(item, { startMin: Math.max(0, item.startMin + current.dMin), laneId: target });
  };

  const actions = (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Earlier days" onClick={() => setAnchor(addDays(from, -days))}><ChevronLeft className="h-4 w-4" /></Button>
      <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Today</Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Later days" onClick={() => setAnchor(addDays(from, days))}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );

  let body;
  if (!list || !startField) body = <Restricted />;
  else if (loading || start === null) body = <BlockLoading label="Loading the schedule" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else {
    const dayTabs = Array.from({ length: days }, (_, i) => addDays(from, i));
    const shown = (config.fields ?? []).filter((id) => id !== list.titleFieldId);
    const flag = (item) => (clashes.has(item.id)
      ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-label={`Clashes with ${[...clashes.get(item.id)].map((id) => items.find((other) => other.id === id)?.row.title ?? "another item").join(", ")}`} /> : null);
    body = (
      <div className={cn("@container/block transition-opacity", refreshing && "opacity-60")}>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {dayTabs.map((value) => {
            const count = items.filter((item) => item.day === value).length;
            return (
              <button key={value} type="button" onClick={() => setDay(value)}
                className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs", value === shownDay ? "bg-surface-active font-medium text-foreground" : "text-text-secondary hover:text-foreground")}>
                {dayLabel(value)}{count ? <span className="ml-1 tabular-nums text-text-tertiary">{count}</span> : null}{value === today ? " · Today" : ""}
              </button>
            );
          })}
        </div>
        {!dayItems.length ? <EmptyRows text="Nothing on this day." /> : (
          <>
            <div className="hidden overflow-x-auto p-3 @2xl/block:block">
              <div className="flex min-w-max">
                <div className="relative w-12 shrink-0" style={{ height: height + 28 }}>
                  {Array.from({ length: (span.to - span.from) / 60 + 1 }, (_, i) => (
                    <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-text-tertiary" style={{ top: 28 + i * 60 * PX }}>{clock(span.from + i * 60)}</span>
                  ))}
                </div>
                <div className="flex">
                  {lanes.map((lane) => {
                    const laneItems = dayItems.filter((item) => laneOf(item) === lane.id);
                    const { placed, count } = columnsFor(laneItems);
                    return (
                      <div key={lane.id} className="shrink-0 border-l border-border" style={{ width: LANE_WIDTH }}>
                        <p className="h-7 truncate px-2 text-xs font-medium leading-7 text-text-secondary">{lane.label}</p>
                        <div className="relative" style={{ height }}>
                          {Array.from({ length: (span.to - span.from) / SLOT }, (_, i) => (
                            <div key={i} className={cn("absolute inset-x-0 border-t", i % 4 === 0 ? "border-border" : "border-border/40")} style={{ top: i * SLOT * PX }} />
                          ))}
                          {laneItems.map((item) => {
                            const dragging = drag?.id === item.id;
                            const top = (item.startMin - span.from + (dragging && drag.mode === "move" ? drag.dMin : 0)) * PX;
                            const length = Math.max(SLOT, item.endMin - item.startMin + (dragging && drag.mode === "resize" ? drag.dMin : 0));
                            const width = 100 / count;
                            return (
                              <div key={item.id} role="button" tabIndex={0}
                                onPointerDown={(event) => (editable(item.row) ? startDrag(event, item, "move") : undefined)}
                                onPointerMove={moveDrag} onPointerUp={() => (drag ? endDrag(item) : config.open ? openRecord(item.row) : null)}
                                onKeyDown={(event) => { if (event.key === "Enter" && config.open) openRecord(item.row); }}
                                className={cn("absolute overflow-hidden rounded-md border bg-surface-card px-1.5 py-1 text-left text-xs shadow-none",
                                  clashes.has(item.id) ? "border-amber-500/70" : "border-border", editable(item.row) ? "cursor-grab touch-none" : config.open && "cursor-pointer",
                                  dragging && "z-10 opacity-80")}
                                style={{ top, height: length * PX - 2, left: `calc(${placed.get(item.id) * width}% + 2px)`, width: `calc(${width}% - 4px)`,
                                  transform: dragging && drag.dLane ? `translateX(${drag.dLane * LANE_WIDTH}px)` : undefined }}>
                                <p className="flex items-center gap-1 font-medium text-foreground">{flag(item)}<span className="truncate">{item.row.title || `${list.numberPrefix}-${item.row.number}`}</span></p>
                                <p className="tabular-nums text-text-tertiary">{clock(item.startMin)}–{clock(Math.min(24 * 60, item.endMin))}</p>
                                {shown.filter((id) => isVisibleOn(item.row, id)).map((id) => (
                                  <p key={id} className="flex min-w-0 gap-1 truncate"><span className="text-text-tertiary">{fieldName(list, id)}</span><span className="flex min-w-0 text-foreground"><CellValue list={list} fieldId={id} record={item.row} /></span></p>
                                ))}
                                {editable(item.row) ? (
                                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onPointerDown={(event) => startDrag(event, item, "resize")} />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <ol className="grid gap-1.5 p-3 @2xl/block:hidden">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <button type="button" disabled={!config.open} onClick={() => openRecord(item.row)}
                    className={cn("grid w-full grid-cols-[3.25rem_minmax(0,1fr)] gap-2 rounded-lg border px-3 py-2 text-left text-sm", clashes.has(item.id) ? "border-amber-500/70" : "border-border")}>
                    <span className="tabular-nums text-text-secondary">{clock(item.startMin)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-medium text-foreground">{flag(item)}<span className="truncate">{item.row.title || `${list.numberPrefix}-${item.row.number}`}</span></span>
                      <span className="block truncate text-xs text-text-tertiary">{clock(Math.min(24 * 60, item.endMin))} end{laneField ? ` · ${lanes.find((lane) => lane.id === laneOf(item))?.label ?? ""}` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    );
  }

  return <BlockFrame title={config.title} actions={actions} fill={fill}>{body}</BlockFrame>;
}
