export const THREAD_STATUS_MAP = {
  open: { label: "Open", dotClass: "bg-emerald-400" },
  closed: { label: "Closed", dotClass: "bg-zinc-500" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All threads" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export function formatDateTime(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
