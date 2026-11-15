"use client";

import { useState } from "react";
import { useBlockData } from "./use_block_data";

// Days are "YYYY-MM-DD" strings handled in UTC, so grids never shift with the viewer's own time zone.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const toDay = (date) => date.toISOString().slice(0, 10);
export const parseDay = (day) => new Date(`${day}T00:00:00Z`);
export const addDays = (day, n) => toDay(new Date(parseDay(day).getTime() + n * 86_400_000));
export const weekStart = (day) => addDays(day, -((parseDay(day).getUTCDay() + 6) % 7));

export function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return toDay(new Date());
  }
}

// The event-time-zone day a stored date or date-time falls on.
export function dayOfValue(value, type, timeZone) {
  if (!value) return null;
  if (type === "date") return String(value).slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return toDay(date);
  }
}

// Where a dated block opens: a fixed day, the earliest record ("first"), or today. Until "first" is known, anchor is null.
export function useAnchor(block, config, field, timeZone) {
  const today = todayIn(timeZone);
  const fixed = DATE.test(config.startDate ?? "") ? config.startDate : null;
  const wantsFirst = config.startDate === "first" && Boolean(field);
  const first = useBlockData(block, { first: true }, { enabled: wantsFirst });
  const row = first.data?.rows?.[0];
  const firstDay = row && field ? dayOfValue(row.values?.[field.id], field.type, timeZone) : null;
  const initial = fixed ?? (wantsFirst ? (first.data || first.error ? firstDay ?? today : null) : today);
  const [chosen, setChosen] = useState(null);
  return { anchor: chosen ?? initial, setAnchor: setChosen, today };
}
