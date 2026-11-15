import { defineType, invalid, isBlank } from "./_shared.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_OPS = ["eq", "before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"];

export function validDate(text) {
  if (!ISO_DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export const date = defineType({
  type: "date", label: "Date", group: "Time", cast: "date", operators: DATE_OPS,
  validateConfig: () => ({}),
  normalise(value) {
    if (isBlank(value)) return null;
    if (typeof value !== "string" || !validDate(value.trim())) invalid("Enter a date like 2026-05-21.");
    return value.trim();
  },
  fromText(text) {
    if (text === "") return null;
    const trimmed = String(text).trim();
    if (validDate(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
  },
});

export const datetime = defineType({
  type: "datetime", label: "Date & time", group: "Time", cast: "timestamptz",
  operators: DATE_OPS.filter((op) => op !== "eq"),
  validateConfig: () => ({}),
  normalise(value) {
    if (isBlank(value)) return null;
    if (typeof value !== "string" || !ISO_DATETIME.test(value.trim())) invalid("Enter a date and time.");
    const parsed = new Date(value.trim());
    if (Number.isNaN(parsed.getTime()) || !validDate(value.trim().slice(0, 10))) invalid("Enter a date and time.");
    return parsed.toISOString();
  },
  fromText(text) {
    if (text === "") return null;
    const parsed = new Date(String(text).trim());
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  },
});

// Durations are stored as whole seconds and shown as h:mm.
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function parseDuration(text) {
  const trimmed = String(text).trim();
  const clock = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
  const words = /^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?$/i.exec(trimmed);
  if (words && (words[1] || words[2])) return Number(words[1] ?? 0) * 3600 + Number(words[2] ?? 0) * 60;
  return /^\d+$/.test(trimmed) ? Number(trimmed) * 60 : undefined;
}

export const duration = defineType({
  type: "duration", label: "Duration", group: "Time", cast: "numeric",
  operators: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  validateConfig: () => ({}),
  normalise(value) {
    if (value === null || value === undefined || value === "") return null;
    if (!Number.isInteger(value) || value < 0 || value > 31_536_000) invalid("Enter a duration.");
    return value;
  },
  toText: formatDuration,
  fromText: (text) => (text === "" ? null : parseDuration(text)),
});
