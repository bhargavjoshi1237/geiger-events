const pad = (n: number) => String(n).padStart(2, "0");

// A booking's calendar date on the venue's clock, so the date stub agrees with the times printed beside it.
export function venueDate(iso: string | null | undefined, timeZone: string): string | null {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (kind: string) => parts.find((p) => p.type === kind)?.value ?? "";
    if (get("year") && get("month") && get("day")) return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // An engine without that zone falls back to the phone's own calendar below.
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "09:00 – 17:00 GMT" out of the server's "Tue 12 Dec, 09:00 – 17:00 GMT"; a multi-day range keeps its days.
export function whenTimes(when: string): string {
  const i = when.indexOf(", ");
  return i >= 0 ? when.slice(i + 2) : when;
}
