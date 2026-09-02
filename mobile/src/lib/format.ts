
export const money = (n: number | string | null | undefined): string =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export const fmtDate = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

export const fmtDateTime = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export const fmtDay = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

export function fmtTimeAgo(d: string | null | undefined): string {
  if (!d) return "";
  const then = new Date(d).getTime();
  if (Number.isNaN(then)) return "";
  const ms = Date.now() - then;
  if (ms < 0) return fmtDate(d);
  const mins = Math.floor(ms / 6e4);
  if (mins < 1) return "Just now";
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `${mins}m ago`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h ago`;
  if (days <= 7) return `${days}d ago`;
  return fmtDate(d);
}

// The tight timestamp the inbox uses: "12m", "11:04", "Yest", "3d", then a date.
export function fmtCompactTime(d: string | null | undefined): string {
  if (!d) return "";
  const then = new Date(d).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 6e4);
  if (mins < 0) return fmtDate(d);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (isToday(d)) return fmtClock(d);
  const days = Math.floor(mins / 1440);
  if (days <= 1) return "Yest";
  if (days <= 6) return `${days}d`;
  return fmtDate(d);
}

export function initials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const src = (name || "").trim() || (email || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function firstName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const n = (name || "").trim();
  if (n) return n.split(/\s+/)[0];
  const e = (email || "").trim();
  return e ? e.split("@")[0] : "there";
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const fmtShortDay = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

export const fmtMonthYear = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

export const fmtClock = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 864e5);
}

// "In 28 days" / "Today" / "Tomorrow" — the relative label on ticket and live rows.
export function relativeDayLabel(dateStr: string | null | undefined): string {
  if (isToday(dateStr)) return "Today";
  const days = daysUntil(dateStr);
  if (days === null) return "";
  if (days < 0) return fmtDate(dateStr);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function isUpcoming(dateStr: string | null | undefined): boolean {
  if (!dateStr) return true;
  const d = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now();
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
