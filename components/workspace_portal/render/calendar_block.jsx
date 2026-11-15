"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, SegmentedTabs } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading, Restricted } from "./block_frame";
import { addDays, parseDay, toDay, useAnchor, weekStart } from "./dated";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The event-time-zone day (and time, for date-times) a stored value falls on.
function dayOf(value, type, timeZone) {
  if (!value) return null;
  if (type === "date") return String(value).slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
  return { day, time };
}

function rangeFor(view, anchor) {
  if (view === "week") {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const from = weekStart(first);
  const lastOfMonth = toDay(new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0)));
  const to = addDays(weekStart(lastOfMonth), 6);
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return { from, to, days };
}

function title(view, anchor, range) {
  const month = (day, options = {}) => parseDay(day).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC", ...options });
  if (view === "month") return month(anchor);
  const a = parseDay(range.from).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  const b = parseDay(range.to).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${a} – ${b}`;
}

function Entry({ item, onOpen }) {
  return (
    <button type="button" onClick={onOpen ? () => onOpen(item.row) : undefined} disabled={!onOpen}
      className="flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs text-foreground hover:bg-surface-active disabled:hover:bg-transparent">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      {item.time ? <span className="shrink-0 tabular-nums text-text-tertiary">{item.time}</span> : null}
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function CalendarBlock({ block, fill }) {
  const config = block.config;
  const { timeZone } = usePortalView();
  const { list, byId } = useList(config.source?.objectId);
  const dateField = byId.get(config.dateField);
  const endField = config.endField ? byId.get(config.endField) : null;
  const [view, setView] = useState(config.view ?? "month");
  const { anchor: start, setAnchor, today } = useAnchor(block, config, dateField, timeZone);
  const anchor = start ?? today;
  const range = rangeFor(view, anchor);
  const { data, error, loading, refreshing, reload } = useBlockData(block, { range: { from: range.from, to: range.to } }, { enabled: start !== null });
  const openRecord = useOpenRecord();
  const open = config.open ? openRecord : null;

  // Each record on every day it spans inside the visible range (at most six weeks).
  const byDay = new Map();
  for (const row of data?.rows ?? []) {
    const start = dateField ? dayOf(row.values?.[dateField.id], dateField.type, timeZone) : null;
    if (!start) continue;
    const startDay = typeof start === "string" ? start : start.day;
    const end = endField ? dayOf(row.values?.[endField.id], endField.type, timeZone) : null;
    const endDay = end ? (typeof end === "string" ? end : end.day) : startDay;
    const item = { row, label: row.title || `${list?.numberPrefix}-${row.number}`, time: typeof start === "object" ? start.time : null };
    for (let day = startDay < range.from ? range.from : startDay, n = 0; day <= endDay && day <= range.to && n < 42; day = addDays(day, 1), n += 1) {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(day === startDay ? item : { ...item, time: null });
    }
  }

  const step = (direction) => {
    if (view === "week") setAnchor(addDays(anchor, direction * 7));
    else {
      const date = parseDay(`${anchor.slice(0, 7)}-01`);
      setAnchor(toDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1))));
    }
  };

  const actions = (
    <>
      <SegmentedTabs value={view} onChange={setView} className="w-auto" tabs={[{ label: "Month", value: "month" }, { label: "Week", value: "week" }]} />
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Today</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </>
  );

  let body;
  if (!list || !dateField) body = <Restricted />;
  else if (loading || start === null) body = <BlockLoading label="Loading calendar" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else {
    const month = anchor.slice(0, 7);
    const agenda = range.days.filter((day) => byDay.has(day) && (view === "week" || day.startsWith(month)));
    body = (
      <div className={cn("@container/block transition-opacity", refreshing && "opacity-60")}>
        <p className="px-4 pt-3 text-sm font-medium text-foreground">{title(view, anchor, range)}</p>
        <div className="hidden p-4 @2xl/block:block">
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border">
            {WEEKDAYS.map((name) => (
              <div key={name} className="border-b border-border bg-surface-subtle px-2 py-1.5 text-xs font-medium text-text-secondary">{name}</div>
            ))}
            {range.days.map((day, index) => {
              const items = byDay.get(day) ?? [];
              const outside = view === "month" && !day.startsWith(month);
              const limit = view === "week" ? 12 : 3;
              return (
                <div key={day} className={cn("min-h-24 min-w-0 border-border p-1", index % 7 !== 6 && "border-r", index < range.days.length - 7 && "border-b",
                  view === "week" && "min-h-56", outside && "bg-surface-subtle/60")}>
                  <span className={cn("mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums",
                    day === today ? "bg-primary font-semibold text-primary-foreground" : outside ? "text-text-tertiary" : "text-text-secondary")}>
                    {Number(day.slice(8))}
                  </span>
                  <div className="grid gap-0.5">
                    {items.slice(0, limit).map((item) => <Entry key={item.row.id} item={item} onOpen={open} />)}
                    {items.length > limit ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="px-1.5 text-left text-xs text-text-secondary hover:text-foreground">+{items.length - limit} more</button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-1">
                          {items.map((item) => <Entry key={item.row.id} item={item} onOpen={open} />)}
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 @2xl/block:hidden">
          {agenda.length ? (
            <ol className="grid gap-3">
              {agenda.map((day) => (
                <li key={day} className="grid gap-1">
                  <p className={cn("text-xs font-medium", day === today ? "text-foreground" : "text-text-secondary")}>
                    {parseDay(day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{day === today ? " · Today" : ""}
                  </p>
                  <div className="grid gap-0.5 rounded-lg border border-border p-1">
                    {byDay.get(day).map((item) => <Entry key={item.row.id} item={item} onOpen={open} />)}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="py-6 text-center text-sm text-text-secondary">Nothing scheduled.</p>}
        </div>
      </div>
    );
  }

  return <BlockFrame title={config.title} actions={actions} fill={fill}>{body}</BlockFrame>;
}
