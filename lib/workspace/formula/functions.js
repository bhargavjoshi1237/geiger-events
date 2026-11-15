// Formula helpers. Every function returns null instead of throwing, so one bad record never breaks a list.
const isBlank = (value) => value === null || value === undefined || value === "";
const num = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};
export const toText = (value) => (isBlank(value) ? "" : typeof value === "boolean" ? (value ? "true" : "false") : String(value));
export const truthy = (value) => value === true || (typeof value === "number" && value !== 0) || (typeof value === "string" && value !== "");

const DAY = 86_400_000;
const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: DAY, weeks: 7 * DAY };

function toDate(value) {
  if (isBlank(value) || typeof value !== "string") return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
const isDateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const pad = (n) => String(n).padStart(2, "0");

function localParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { YYYY: parts.year, MM: parts.month, DD: parts.day, HH: parts.hour, mm: parts.minute };
}

const numbers = (args) => args.flat().map(num).filter((value) => value !== null);

// name → { min, max, run(args, ctx) }
export const FUNCTIONS = {
  IF: { min: 2, max: 3, run: ([cond, yes, no = null]) => (truthy(cond) ? yes : no) },
  AND: { min: 1, max: Infinity, run: (args) => args.every(truthy) },
  OR: { min: 1, max: Infinity, run: (args) => args.some(truthy) },
  NOT: { min: 1, max: 1, run: ([value]) => !truthy(value) },
  SUM: { min: 1, max: Infinity, run: (args) => numbers(args).reduce((a, b) => a + b, 0) },
  AVERAGE: { min: 1, max: Infinity, run: (args) => { const list = numbers(args); return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null; } },
  MIN: { min: 1, max: Infinity, run: (args) => { const list = numbers(args); return list.length ? Math.min(...list) : null; } },
  MAX: { min: 1, max: Infinity, run: (args) => { const list = numbers(args); return list.length ? Math.max(...list) : null; } },
  ROUND: { min: 1, max: 2, run: ([value, places = 0]) => {
    const n = num(value); const p = num(places);
    if (n === null || p === null) return null;
    const factor = 10 ** Math.trunc(p);
    return Math.round((n + Math.sign(n) * Number.EPSILON) * factor) / factor;
  } },
  FLOOR: { min: 1, max: 1, run: ([value]) => (num(value) === null ? null : Math.floor(num(value))) },
  CEILING: { min: 1, max: 1, run: ([value]) => (num(value) === null ? null : Math.ceil(num(value))) },
  ABS: { min: 1, max: 1, run: ([value]) => (num(value) === null ? null : Math.abs(num(value))) },
  LEN: { min: 1, max: 1, run: ([value]) => toText(value).length },
  UPPER: { min: 1, max: 1, run: ([value]) => toText(value).toUpperCase() },
  LOWER: { min: 1, max: 1, run: ([value]) => toText(value).toLowerCase() },
  TRIM: { min: 1, max: 1, run: ([value]) => toText(value).trim() },
  CONCAT: { min: 1, max: Infinity, run: (args) => args.map(toText).join("") },
  LEFT: { min: 2, max: 2, run: ([value, count]) => (num(count) === null ? null : toText(value).slice(0, Math.max(0, num(count)))) },
  RIGHT: { min: 2, max: 2, run: ([value, count]) => (num(count) === null || num(count) <= 0 ? (num(count) === 0 ? "" : null) : toText(value).slice(-num(count))) },
  CONTAINS: { min: 2, max: 2, run: ([value, part]) => toText(value).toLowerCase().includes(toText(part).toLowerCase()) },
  REPLACE: { min: 3, max: 3, run: ([value, find, replacement]) => (toText(find) === "" ? toText(value) : toText(value).split(toText(find)).join(toText(replacement))) },
  BLANK: { min: 0, max: 0, run: () => null },
  ISBLANK: { min: 1, max: 1, run: ([value]) => isBlank(value) },
  TODAY: { min: 0, max: 0, run: (_, ctx) => { const p = localParts(ctx.now, ctx.timeZone); return `${p.YYYY}-${p.MM}-${p.DD}`; } },
  NOW: { min: 0, max: 0, run: (_, ctx) => ctx.now.toISOString() },
  DATEADD: { min: 3, max: 3, run: ([value, amount, unit]) => {
    const date = toDate(value); const n = num(amount); const u = toText(unit).toLowerCase();
    if (!date || n === null) return null;
    const next = new Date(date);
    if (u === "months" || u === "years") next.setUTCMonth(next.getUTCMonth() + Math.trunc(n) * (u === "years" ? 12 : 1));
    else if (UNIT_MS[u]) next.setTime(next.getTime() + n * UNIT_MS[u]);
    else return null;
    return isDateOnly(value) ? next.toISOString().slice(0, 10) : next.toISOString();
  } },
  DATEDIFF: { min: 2, max: 3, run: ([start, end, unit = "days"]) => {
    const a = toDate(start); const b = toDate(end); const u = toText(unit).toLowerCase();
    if (!a || !b) return null;
    if (u === "months" || u === "years") {
      const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
      return u === "years" ? Math.trunc(months / 12) : months;
    }
    return UNIT_MS[u] ? Math.trunc((b - a) / UNIT_MS[u]) : null;
  } },
  YEAR: { min: 1, max: 1, run: ([value]) => toDate(value)?.getUTCFullYear() ?? null },
  MONTH: { min: 1, max: 1, run: ([value]) => (toDate(value) ? toDate(value).getUTCMonth() + 1 : null) },
  DAY: { min: 1, max: 1, run: ([value]) => toDate(value)?.getUTCDate() ?? null },
  FORMATDATE: { min: 2, max: 2, run: ([value, pattern], ctx) => {
    const date = toDate(value);
    if (!date) return null;
    const p = isDateOnly(value)
      ? { YYYY: String(date.getUTCFullYear()), MM: pad(date.getUTCMonth() + 1), DD: pad(date.getUTCDate()), HH: "00", mm: "00" }
      : localParts(date, ctx.timeZone);
    return toText(pattern).replace(/YYYY|MM|DD|HH|mm/g, (token) => p[token]);
  } },
  VALUE: { min: 1, max: 1, run: ([value]) => num(typeof value === "string" ? value.replace(/[,\s]/g, "") : value) },
  TEXT: { min: 1, max: 1, run: ([value]) => toText(value) },
};
