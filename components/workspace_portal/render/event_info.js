import { todayIn } from "./dated";

// Event naming and dates for the portal chrome: "ICAML 2026 — International Conference…" reads as "ICAML 2026" in tight spots.
const SEPARATOR = /\s+[—–-]\s+/;

export const eventShortName = (name) => String(name ?? "").split(SEPARATOR)[0].trim() || String(name ?? "");

// Two letters for the event tile: an acronym's first two ("IC"), otherwise the first letter of the first two words.
export function eventInitials(name) {
  const words = eventShortName(name).split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (/^[A-Z0-9]{2,}$/.test(words[0])) return words[0].slice(0, 2);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

const dayOf = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);

// Whole days from today (in the event's time zone) to a YYYY-MM-DD date; negative once it's past.
export function daysUntil(date, timeZone) {
  if (!date) return null;
  return Math.round((dayOf(date) - dayOf(todayIn(timeZone || "UTC"))) / 86_400_000);
}

export function relativeDay(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export const shortDate = (date) => (date ? dayOf(date).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" }) : "");

// "8 Dec · Lisbon" under the event name.
export const eventMeta = (event) => [shortDate(event?.date), event?.place].filter(Boolean).join(" · ");
