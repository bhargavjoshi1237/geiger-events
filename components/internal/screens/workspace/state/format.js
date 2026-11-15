import {
  AlignLeft, AtSign, Calculator, Calendar, CalendarClock, CheckSquare, CircleDot, Clock, Coins, FileText, Hash, Link2,
  ListChecks, Paperclip, Percent, Phone, Search, Sigma, Star, Text, Type, Globe,
} from "lucide-react";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { formatDuration } from "@/lib/workspace/schema/types/time.js";
import { EVENT_TARGET_LABELS } from "@/lib/workspace/schema/types/links.js";

export { EVENT_TARGET_LABELS };

export const OPTION_COLORS = {
  gray: "border-border bg-surface-card text-muted-foreground",
  blue: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  red: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  pink: "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  teal: "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300",
};
export const COLOR_NAMES = Object.keys(OPTION_COLORS);
export const COLOR_SWATCH = {
  gray: "bg-zinc-400", blue: "bg-sky-500", green: "bg-emerald-500", amber: "bg-amber-500",
  red: "bg-red-500", violet: "bg-violet-500", pink: "bg-pink-500", teal: "bg-teal-500",
};

export const TYPE_META = {
  short_text: { icon: Type, hint: "A name, title or short answer" },
  long_text: { icon: AlignLeft, hint: "Paragraphs, with an optional word limit" },
  rich_text: { icon: FileText, hint: "Formatted text with bold, lists and links" },
  email: { icon: AtSign, hint: "An email address" },
  phone: { icon: Phone, hint: "A phone number" },
  url: { icon: Globe, hint: "A web address" },
  number: { icon: Hash, hint: "A number, with optional decimals and limits" },
  currency: { icon: Coins, hint: "An amount of money" },
  percent: { icon: Percent, hint: "A percentage" },
  rating: { icon: Star, hint: "A 1–5 (or up to 10) star rating" },
  single_select: { icon: CircleDot, hint: "One choice from a list" },
  multi_select: { icon: ListChecks, hint: "Several choices from a list" },
  checkbox: { icon: CheckSquare, hint: "Yes or no" },
  date: { icon: Calendar, hint: "A day" },
  datetime: { icon: CalendarClock, hint: "A day and time in the event's time zone" },
  duration: { icon: Clock, hint: "A length of time, like 1:30" },
  link_record: { icon: Link2, hint: "Records from another list" },
  link_event: { icon: Link2, hint: "Contacts, ticket holders, orders, team or rooms" },
  attachments: { icon: Paperclip, hint: "Files such as papers, slides or photos" },
  formula: { icon: Calculator, hint: "Calculated from other fields" },
  lookup: { icon: Search, hint: "Shows a field from linked records" },
  rollup: { icon: Sigma, hint: "Counts or totals linked records" },
};
export const typeIcon = (type) => TYPE_META[type]?.icon ?? Text;
export const typeLabel = (type) => getType(type)?.label ?? type;

export const OPERATOR_LABELS = {
  eq: "is", neq: "is not", contains: "contains", not_contains: "doesn't contain", starts_with: "starts with",
  any_of: "is any of", none_of: "is none of", is_empty: "is empty", is_not_empty: "is not empty",
  gt: "is more than", gte: "is at least", lt: "is less than", lte: "is at most",
  is_true: "is checked", is_false: "is not checked",
  before: "is before", after: "is after", on_or_before: "is on or before", on_or_after: "is on or after",
  has_any: "has any of", has_all: "has all of", has_none: "has none of",
};
export const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty", "is_true", "is_false"]);
export const LIST_OPERATORS = new Set(["any_of", "none_of", "has_any", "has_all", "has_none"]);

export const SYSTEM_COLUMNS = [
  { id: "status", name: "Status", type: "status" },
  { id: "number", name: "Number", type: "number" },
  { id: "created_at", name: "Created", type: "datetime" },
  { id: "updated_at", name: "Last changed", type: "datetime" },
];

export const recordLabel = (object, record) => record?.title || `${object?.numberPrefix ?? "REC"}-${record?.number ?? ""}`;
export const optionOf = (field, id) => field?.config?.options?.find((option) => option.id === id);

const numberFormat = (value, options) => new Intl.NumberFormat(undefined, options).format(value);

// Plain text for a stored value (CSV export, previews, sorting labels).
export function valueText(field, value, { timeZone = "UTC", computed } = {}) {
  const raw = computed !== undefined ? computed : value;
  if (raw === null || raw === undefined || raw === "") return "";
  switch (field.type) {
    case "number": return numberFormat(raw, { maximumFractionDigits: field.config.decimals ?? 0 });
    case "currency": return numberFormat(raw, { style: "currency", currency: field.config.currency || "USD" });
    case "percent": return `${numberFormat(raw, { maximumFractionDigits: field.config.decimals ?? 0 })}%`;
    case "rollup": return numberFormat(Number(raw), { maximumFractionDigits: 2 });
    case "duration": return formatDuration(raw);
    case "date": return formatDate(raw);
    case "datetime": return formatDateTime(raw, timeZone);
    case "formula":
      if (field.config.result === "boolean") return raw ? "Yes" : "No";
      if (field.config.result === "number" && typeof raw === "number") return numberFormat(raw, { maximumFractionDigits: 4 });
      if (field.config.result === "date") return formatDate(raw);
      return String(raw);
    default: return getType(field.type)?.toText(raw, field.config) ?? String(raw);
  }
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(value, timeZone = "UTC") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return date.toLocaleString();
  }
}

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(String(value).slice(0, 10));
}

// datetime-local strings are wall-clock time in the event's zone; storage is UTC.
function zoneOffsetMinutes(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUtc - date.getTime()) / 60000;
}

export function localInputToUtc(local, timeZone = "UTC") {
  if (!local) return null;
  const [day, time = "00:00"] = local.split("T");
  const guess = new Date(`${day}T${time.slice(0, 5)}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const offset = zoneOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  const corrected = zoneOffsetMinutes(result, timeZone);
  return new Date(guess.getTime() - corrected * 60000).toISOString();
}

export function utcToLocalInput(iso, timeZone = "UTC") {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + zoneOffsetMinutes(date, timeZone) * 60000);
  return shifted.toISOString().slice(0, 16);
}

export const toKebab = (name) => String(name || "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").toLowerCase();
export const newOptionId = () => `opt_${Math.random().toString(36).slice(2, 10)}`;
export const plural = (count, word, many = `${word}s`) => `${count.toLocaleString()} ${count === 1 ? word : many}`;
