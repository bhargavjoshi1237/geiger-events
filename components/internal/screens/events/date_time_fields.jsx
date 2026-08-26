"use client";

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

export function EventTimeSelect({
  value,
  onChange,
  placeholder = "Select time",
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
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
