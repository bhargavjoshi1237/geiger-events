"use client";

import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

// The per-event selector used by Offline Check-in and Capacity Control.
export function EventPicker({ events, value, onChange, className }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={className || "h-9 w-full bg-surface-card sm:w-auto sm:max-w-[240px]"}>
        <SelectValue placeholder="Select an event" />
      </SelectTrigger>
      <SelectContent>
        {events.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name || "Untitled event"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default EventPicker;
