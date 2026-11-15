"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, SegmentedTabs } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { timelineBars } from "@/lib/workspace/components/schedule.js";
import { zonedInstant } from "@/lib/venue_booking/time.js";
import { COLOR_SWATCH } from "@/components/internal/screens/workspace/state/format";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { addDays, parseDay, useAnchor, weekStart } from "./dated";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";

const SCALES = [{ label: "Day", value: "day" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }];

function windowFor(scale, anchor) {
  if (scale === "day") return { from: anchor, to: anchor, days: [anchor] };
  if (scale === "week") {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const next = parseDay(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const to = addDays(next.toISOString().slice(0, 10), -1);
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return { from, to, days };
}

// A stored date or date-time as an instant; a date-only end covers the whole of its day.
function instant(value, type, timeZone, { end = false } = {}) {
  if (!value) return NaN;
  if (type === "date") {
    const day = String(value).slice(0, 10);
    return zonedInstant(end ? addDays(day, 1) : day, "00:00", timeZone)?.getTime() ?? NaN;
  }
  return Date.parse(value);
}

// Bars from start to end on a day, week or month axis, one row per group; click a bar to open its record.
export function TimelineBlock({ block, fill }) {
  const config = block.config;
  const { timeZone } = usePortalView();
  const { list, byId } = useList(config.source?.objectId);
  const startField = byId.get(config.startField);
  const endField = config.endField ? byId.get(config.endField) : null;
  const groupField = config.groupBy && config.groupBy !== "status" ? byId.get(config.groupBy) : null;
  const [scale, setScale] = useState(config.scale ?? "week");
  const [now] = useState(() => Date.now());
  const { anchor: start, setAnchor, today } = useAnchor(block, config, startField, timeZone);
  const range = windowFor(scale, start ?? today);
  const { data, error, loading, refreshing, reload } = useBlockData(block, { range: { from: range.from, to: range.to } }, { enabled: start !== null });
  const openRecord = useOpenRecord();

  const step = (direction) => {
    const anchor = start ?? today;
    if (scale === "day") setAnchor(addDays(anchor, direction));
    else if (scale === "week") setAnchor(addDays(anchor, direction * 7));
    else {
      const date = parseDay(`${anchor.slice(0, 7)}-01`);
      date.setUTCMonth(date.getUTCMonth() + direction);
      setAnchor(date.toISOString().slice(0, 10));
    }
  };
  const actions = (
    <>
      <SegmentedTabs value={scale} onChange={setScale} className="w-auto" tabs={SCALES} />
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Earlier" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Today</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Later" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </>
  );

  let body;
  if (!list || !startField) body = <Restricted />;
  else if (loading || start === null) body = <BlockLoading label="Loading the timeline" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else {
    const from = zonedInstant(range.from, "00:00", timeZone)?.getTime() ?? 0;
    const to = zonedInstant(addDays(range.to, 1), "00:00", timeZone)?.getTime() ?? from + 86_400_000;
    const items = (data?.rows ?? []).map((row) => {
      const begin = instant(row.values?.[startField.id], startField.type, timeZone);
      let finish = endField ? instant(row.values?.[endField.id], endField.type, timeZone, { end: true }) : NaN;
      if (!Number.isFinite(finish) || finish <= begin) finish = begin + (startField.type === "date" ? 86_400_000 : 3_600_000);
      return { id: row.id, row, start: begin, end: finish };
    }).filter((item) => Number.isFinite(item.start));
    const bars = timelineBars(items, from, to);
    const groupOf = (row) => {
      if (config.groupBy === "status") return [row.status ?? null];
      if (!groupField) return [null];
      if (groupField.type === "single_select") return [row.values?.[groupField.id] ?? null];
      const links = row.links?.[groupField.id] ?? [];
      return links.length ? links.map((link) => link.id) : [null];
    };
    const labelOf = (key, row) => {
      if (key === null) return { label: config.groupBy ? "None" : list.plural, color: "gray" };
      if (config.groupBy === "status") { const status = list.statuses?.find((item) => item.key === key); return { label: status?.label ?? key, color: status?.color ?? "gray" }; }
      if (groupField?.type === "single_select") { const option = groupField.config?.options?.find((item) => item.id === key); return { label: option?.label ?? "Removed option", color: option?.color ?? "gray" }; }
      return { label: row.links?.[groupField.id]?.find((link) => link.id === key)?.label ?? "Linked record", color: "blue" };
    };
    const groups = new Map();
    for (const bar of bars) {
      for (const key of groupOf(bar.row)) {
        if (!groups.has(key)) groups.set(key, { key, ...labelOf(key, bar.row), bars: [] });
        groups.get(key).bars.push(bar);
      }
    }
    const ticks = scale === "day" ? Array.from({ length: 12 }, (_, i) => ({ key: i, left: i / 12, label: `${String(i * 2).padStart(2, "0")}:00` }))
      : range.days.map((day, i) => ({ key: day, left: i / range.days.length, label: scale === "week" ? parseDay(day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" }) : String(Number(day.slice(8))) }));
    const nowLeft = (now - from) / (to - from);
    body = !bars.length ? <EmptyRows text="Nothing in this period." /> : (
      <div className={cn("overflow-x-auto p-4 transition-opacity", refreshing && "opacity-60")}>
        <div className="min-w-[40rem]">
          <div className="relative ml-36 h-6 border-b border-border">
            {ticks.map((tick) => <span key={tick.key} className="absolute top-0 truncate pl-1 text-[11px] text-text-tertiary" style={{ left: `${tick.left * 100}%` }}>{tick.label}</span>)}
          </div>
          {[...groups.values()].map((group) => (
            <div key={group.key ?? "none"} className="flex border-b border-border/60 py-1.5">
              <div className="flex w-36 shrink-0 items-start gap-1.5 pr-2 pt-1 text-xs text-text-secondary">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", COLOR_SWATCH[group.color] ?? COLOR_SWATCH.gray)} /><span className="truncate">{group.label}</span>
              </div>
              <div className="relative min-w-0 flex-1 space-y-1">
                {ticks.map((tick) => <span key={tick.key} aria-hidden className="absolute inset-y-0 border-l border-border/40" style={{ left: `${tick.left * 100}%` }} />)}
                {nowLeft > 0 && nowLeft < 1 ? <span aria-hidden className="absolute inset-y-0 border-l border-red-500/60" style={{ left: `${nowLeft * 100}%` }} /> : null}
                {group.bars.map((bar) => (
                  <div key={bar.id} className="relative h-6">
                    <button type="button" disabled={!config.open} onClick={() => openRecord(bar.row)}
                      title={bar.row.title || `${list.numberPrefix}-${bar.row.number}`}
                      className="absolute inset-y-0 truncate rounded border border-border bg-surface-active px-1.5 text-left text-xs text-foreground enabled:hover:border-foreground/30"
                      style={{ left: `${bar.left * 100}%`, width: `max(${bar.width * 100}%, 1.5rem)` }}>
                      {bar.row.title || `${list.numberPrefix}-${bar.row.number}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <BlockFrame title={config.title} actions={actions} fill={fill}>{body}</BlockFrame>;
}
