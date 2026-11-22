import { moneyIn } from "@/lib/control_meta";
import { fmtShortDay } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The local calendar day as YYYY-MM-DD: DateStub reads the string itself, and a UTC timestamp's prefix can be tomorrow.
export function localDay(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

export const todayKey = () => localDay(new Date().toISOString());

// The 24-hour "19:42" in a day-grouped ledger's time column.
export function clock(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}

export function dayLabel(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "Earlier";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === new Date().toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return fmtShortDay(iso);
}

export type DayGroup<T> = { key: string; label: string; items: T[] };

// Newest-first rows bucketed by local day, in first-seen order; rows without a time collect under "Earlier".
export function byDay<T>(items: T[], at: (item: T) => string | null | undefined): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const iso = at(item);
    const key = localDay(iso) ?? "earlier";
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, label: dayLabel(iso), items: [item] });
  }
  return [...groups.values()];
}

// One currency's total, or null when the rows mix currencies and a sum across them would mean nothing.
export function totalIn<T>(items: T[], amount: (item: T) => number, currency: (item: T) => string): { total: number; currency: string } | null {
  if (!items.length) return null;
  const code = (currency(items[0]) || "usd").toLowerCase();
  let total = 0;
  for (const item of items) {
    if ((currency(item) || "usd").toLowerCase() !== code) return null;
    total += amount(item) || 0;
  }
  return { total: Math.round(total * 100) / 100, currency: code };
}

// Money with a true minus sign (and an optional plus), so ledger columns read like a statement.
export function signedMoney(amount: number, currency?: string, plus = false): string {
  if (amount < 0) return `−${moneyIn(-amount, currency)}`;
  return `${plus && amount > 0 ? "+" : ""}${moneyIn(amount, currency)}`;
}
