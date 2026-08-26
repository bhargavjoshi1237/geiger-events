"use client";

import React, { useMemo, useState } from "react";
import { Clock, Tag, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatScheduleTime,
  isClockTime,
  parseTimeInput,
  timeOptions,
} from "@/lib/events/schedule_items";

export function ScheduleTimeField({ value, onChange, afterTime, id }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(null);

  const display = typed !== null ? typed : formatScheduleTime(value);
  const parsed = typed !== null ? parseTimeInput(typed) : null;
  const isLabel = !!value && !isClockTime(value);

  const options = useMemo(() => {
    const all = timeOptions(afterTime);
    const query = (typed || "").trim().toLowerCase();
    if (!query) return all.slice(0, 24);
    const hits = all.filter(
      (t) =>
        t.startsWith(query) ||
        formatScheduleTime(t).toLowerCase().replace(/\s/g, "").startsWith(query.replace(/\s/g, "")),
    );
    return hits.slice(0, 12);
  }, [typed, afterTime]);

  const commit = (next) => {
    onChange(next);
    setTyped(null);
    setOpen(false);
  };

  const commitTyped = () => {
    if (typed === null) return;
    const text = typed.trim();
    if (!text) return commit("");
    commit(parseTimeInput(text) || text);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            id={id}
            value={display}
            placeholder="Set a time"
            spellCheck={false}
            autoComplete="off"
            className={cn("pl-9", value && "pr-8")}
            onFocus={() => {
              setTyped(isClockTime(value) ? "" : value || "");
              setOpen(true);
            }}
            onChange={(e) => {
              setTyped(e.target.value);
              setOpen(true);
            }}
            onBlur={() => {
              setTimeout(commitTyped, 120);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTyped();
              } else if (e.key === "Escape") {
                setTyped(null);
                setOpen(false);
              }
            }}
          />
          {value ? (
            <button
              type="button"
              aria-label="Clear time"
              onClick={() => commit("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-tertiary transition-colors hover:bg-surface-active hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        role="listbox"
        className="w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {parsed ? (
          <button
            type="button"
            role="option"
            aria-selected={parsed === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit(parsed)}
            className="flex w-full items-center justify-between rounded-md bg-primary/15 px-2 py-1.5 text-left text-sm text-foreground"
          >
            {formatScheduleTime(parsed)}
            <span className="text-xs text-text-tertiary">↵</span>
          </button>
        ) : null}

        {options
          .filter((t) => t !== parsed)
          .map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(t)}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-active",
                t === value ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {formatScheduleTime(t)}
            </button>
          ))}

        {typed && typed.trim() && !parsed ? (
          <button
            type="button"
            role="option"
            aria-selected={typed.trim() === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit(typed.trim())}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-active"
          >
            <Tag className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            Use “{typed.trim()}” as a label
          </button>
        ) : null}

        {!options.length && !parsed && !typed?.trim() ? (
          <p className="px-2 py-1.5 text-sm text-text-tertiary">No matches</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function TimeLabelBadge({ value }) {
  if (!value || isClockTime(value)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
      <Tag className="h-3 w-3" /> label, not a time
    </span>
  );
}

export default ScheduleTimeField;
