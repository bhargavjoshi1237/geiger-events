"use client";

// Shared date + start-time controls for an event. Used by the create dialog and
// by the editor's Event details / Location & Time sections so every surface
// writes the same shapes toRow persists: date "YYYY-MM-DD", time "HH:mm".

import React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Convert to/from a Date for the Calendar using local parts so the picked day
// never shifts across a timezone boundary.
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

// Half-hour slots ("HH:mm" value, 12-hour label) for the time Select.
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${min}`;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${hour12}:${min} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

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
          <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
          {selected ? format(selected, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Clicking the selected day deselects it in single mode — ignore that,
            an event always has a date. Pick another day to change it. */}
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

export function EventTimeSelect({
  value,
  onChange,
  placeholder = "Select time",
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <Clock className="mr-2 size-4 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
