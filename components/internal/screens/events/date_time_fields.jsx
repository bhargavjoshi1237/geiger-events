"use client";

import React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { DatePicker as Calendar } from "@geiger/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@geiger/ui/popover";
import { cn } from "@/lib/utils";
import { isClockTime } from "@/lib/events/schedule_items";

export const toDateValue = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseDateValue = (value) => {
  if (!value) return undefined;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

export function EventDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
}) {
  const selected = parseDateValue(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {selected ? format(selected, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onChange(toDateValue(d))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// A time input only accepts HH:MM, but callers split times out of ISO-ish
// strings that can carry seconds. Trim to what the control can render, and drop
// anything that isn't a clock time (older records held free-text labels).
const toTimeInputValue = (value) => {
  const raw = String(value || "").trim();
  const clock = raw.slice(0, 5);
  return isClockTime(clock) ? clock : "";
};

// Native time control: any minute, keyboard-first, and it follows the platform's
// own 12/24h convention. The picker glyph it draws on the right already follows
// the theme's color-scheme, so there's no leading icon here — one clock is enough.
export function EventTimeField({ value, onChange, className, ...props }) {
  return (
    <Input
      type="time"
      value={toTimeInputValue(value)}
      onChange={(e) => onChange(e.target.value)}
      className={cn("w-full", className)}
      {...props}
    />
  );
}
