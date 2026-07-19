// Lookups & formatters for the organiser Messages inbox. Config only — the data
// layer (lib/supabase/messages.js) owns the rows.

export const THREAD_STATUS_MAP = {
  open: { label: "Open", dotClass: "bg-emerald-400" },
  closed: { label: "Closed", dotClass: "bg-text-tertiary" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All threads" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export function formatDateTime(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
