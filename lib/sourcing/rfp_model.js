// Pure RFP domain model shared by the dashboard, the API routes and the public response page.

export const RFP_STATUSES = ["draft", "sent", "closed", "awarded", "cancelled"];
export const RECIPIENT_STATUSES = ["invited", "viewed", "declined", "responded", "awarded", "lost"];
export const BID_STATUSES = ["submitted", "shortlisted", "awarded", "rejected"];
export const RECIPIENT_SOURCES = ["venue", "pipeline", "manual"];

export const LINE_CATEGORIES = [
  { value: "room", label: "Meeting space" },
  { value: "fnb", label: "Food & beverage" },
  { value: "av", label: "AV & production" },
  { value: "sleeping", label: "Sleeping rooms" },
  { value: "fees", label: "Fees & service" },
  { value: "other", label: "Other" },
];
export const LINE_CATEGORY_KEYS = LINE_CATEGORIES.map((c) => c.value);
export const lineCategoryLabel = (key) =>
  LINE_CATEGORIES.find((c) => c.value === key)?.label || "Other";

export const SETUP_STYLES = [
  { value: "theatre", label: "Theatre" },
  { value: "classroom", label: "Classroom" },
  { value: "banquet", label: "Banquet" },
  { value: "cabaret", label: "Cabaret" },
  { value: "reception", label: "Reception" },
  { value: "boardroom", label: "Boardroom" },
  { value: "u_shape", label: "U-shape" },
  { value: "exhibition", label: "Exhibition" },
];
export const setupStyleLabel = (key) =>
  SETUP_STYLES.find((s) => s.value === key)?.label || "Any setup";

export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "INR", "CHF", "JPY"];

export const DEFAULT_WEIGHTS = { price: 40, capacity: 25, concessions: 15, terms: 20 };
export const WEIGHT_KEYS = ["price", "capacity", "concessions", "terms"];

const DAY_MS = 86400000;

export const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
const text = (v, max = 2000) => String(v ?? "").slice(0, max);

let keySeq = 0;
// Stable row keys for list editors; persisted with the row so React keys survive reloads.
export function rowKey(prefix = "r") {
  keySeq += 1;
  return `${prefix}${Date.now().toString(36)}${keySeq.toString(36)}`;
}

export function normalizeRoomRequirements(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && typeof r === "object")
    .map((r, i) => ({
      id: r.id ? String(r.id) : `room${i}`,
      label: text(r.label, 200),
      setupStyle: String(r.setup_style ?? r.setupStyle ?? "theatre"),
      capacity: clampInt(r.capacity, 0, 1000000),
      days: clampInt(r.days ?? 1, 0, 365),
    }));
}

export function roomRequirementsToJson(list) {
  return normalizeRoomRequirements(list).map((r) => ({
    id: r.id,
    label: r.label,
    setup_style: r.setupStyle,
    capacity: r.capacity,
    days: r.days,
  }));
}

export function normalizeSleepingRooms(value) {
  const nights = Array.isArray(value?.nights) ? value.nights : [];
  return {
    nights: nights
      .filter((n) => n && typeof n === "object")
      .map((n) => ({ date: String(n.date || ""), rooms: clampInt(n.rooms, 0, 100000) }))
      .sort((a, b) => (a.date || "~").localeCompare(b.date || "~")),
  };
}

export const roomNights = (sleeping) =>
  normalizeSleepingRooms(sleeping).nights.reduce((sum, n) => sum + n.rooms, 0);
export const peakRooms = (sleeping) =>
  normalizeSleepingRooms(sleeping).nights.reduce((max, n) => Math.max(max, n.rooms), 0);

export function normalizeAlternateDates(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((d) => d && typeof d === "object")
    .map((d) => ({ start: String(d.start || ""), end: String(d.end || "") }));
}

export function normalizeLineItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && typeof l === "object")
    .map((l, i) => {
      const qty = toNumber(l.qty) ?? 0;
      const unitPrice = toNumber(l.unit_price ?? l.unitPrice) ?? 0;
      return {
        id: l.id ? String(l.id) : `line${i}`,
        category: LINE_CATEGORY_KEYS.includes(l.category) ? l.category : "other",
        label: text(l.label, 200),
        qty,
        unitPrice,
        total: toNumber(l.total) ?? round2(qty * unitPrice),
      };
    });
}

export function bidTotals(lineItems, taxesFees) {
  const subtotal = round2(
    (lineItems || []).reduce((sum, l) => sum + round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)), 0),
  );
  const fees = round2(Math.max(0, Number(taxesFees) || 0));
  return { subtotal, taxesFees: fees, total: round2(subtotal + fees) };
}

export function normalizeConcessions(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 30);
}

export function normalizeWeights(w) {
  const src = w && typeof w === "object" ? w : {};
  const out = {};
  for (const k of WEIGHT_KEYS) {
    const n = toNumber(src[k]);
    out[k] = n === null ? DEFAULT_WEIGHTS[k] : Math.max(0, Math.min(100, n));
  }
  return out;
}

// Inclusive day count between two YYYY-MM-DD dates (1 when only one is set).
export function dayCount(start, end) {
  if (!start) return 0;
  if (!end) return 1;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.round((b - a) / DAY_MS) + 1;
}

export function addDays(date, days) {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(base)) return "";
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

const MONEY_CACHE = new Map();
export function formatMoney(value, currency = "USD", { cents = false } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "—";
  const key = `${currency}|${cents}`;
  let fmt = MONEY_CACHE.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
      });
    } catch {
      fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    }
    MONEY_CACHE.set(key, fmt);
  }
  return fmt.format(n);
}

export const formatPct = (n, { signed = false } = {}) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  const body = `${Math.abs(v) % 1 === 0 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)}%`;
  if (!signed) return `${v < 0 ? "-" : ""}${body}`;
  return v > 0 ? `+${body}` : v < 0 ? `-${body}` : body;
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatDay(value) {
  if (!value) return "";
  const t = Date.parse(String(value).length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(t) ? DATE_FMT.format(new Date(t)) : "";
}

export function formatDateRange(start, end) {
  if (!start) return "";
  if (!end || end === start) return formatDay(start);
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return formatDay(start);
  const sameYear = new Date(a).getUTCFullYear() === new Date(b).getUTCFullYear();
  return `${sameYear ? SHORT_FMT.format(new Date(a)) : DATE_FMT.format(new Date(a))} – ${DATE_FMT.format(new Date(b))}`;
}

export function formatDeadline(value, timeZone) {
  if (!value) return "";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(t));
  } catch {
    return new Date(t).toUTCString();
  }
}

// Countdown to a response deadline: { label, tone, past }. Tone feeds a badge variant.
export function deadlineInfo(deadline, now) {
  if (!deadline) return { label: "No deadline", tone: "neutral", past: false };
  const t = Date.parse(deadline);
  if (!Number.isFinite(t)) return { label: "No deadline", tone: "neutral", past: false };
  const diff = t - now;
  const hours = Math.abs(diff) / 3600000;
  const days = Math.floor(hours / 24);
  if (diff < 0) {
    if (hours < 24) return { label: "Closed today", tone: "neutral", past: true };
    return { label: `Closed ${days}d ago`, tone: "neutral", past: true };
  }
  if (hours < 1) return { label: "Under 1h left", tone: "danger", past: false };
  if (hours < 24) return { label: `${Math.floor(hours)}h left`, tone: "danger", past: false };
  if (days < 3) return { label: `${days}d left`, tone: "warning", past: false };
  return { label: `${days}d left`, tone: "info", past: false };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (v) => EMAIL_RE.test(String(v || "").trim());

// Everything that must be true before an RFP can go out. Returns human-readable issues.
export function validateRfpForSend(rfp, now) {
  const issues = [];
  if (!String(rfp?.title || "").trim()) issues.push("Give the RFP a title.");
  if (!rfp?.startDate && !rfp?.datesFlexible) issues.push("Set the event dates, or mark them flexible.");
  if (rfp?.startDate && rfp?.endDate && rfp.endDate < rfp.startDate) issues.push("The end date is before the start date.");
  if (!(Number(rfp?.attendees) > 0)) issues.push("Set the expected number of attendees.");
  const hasNeeds =
    normalizeRoomRequirements(rfp?.roomRequirements).length > 0 ||
    roomNights(rfp?.sleepingRooms) > 0 ||
    String(rfp?.fnbRequirements || "").trim() ||
    String(rfp?.avNeeds || "").trim();
  if (!hasNeeds) issues.push("Add at least one requirement — meeting space, sleeping rooms, F&B or AV.");
  if (!rfp?.responseDeadline) issues.push("Set a response deadline.");
  else if (Date.parse(rfp.responseDeadline) <= now) issues.push("The response deadline has already passed.");
  if (
    toNumber(rfp?.budgetMin) !== null &&
    toNumber(rfp?.budgetMax) !== null &&
    Number(rfp.budgetMax) < Number(rfp.budgetMin)
  ) {
    issues.push("The budget maximum is below the minimum.");
  }
  return issues;
}

// A starting set of line items matching the brief, so a venue only has to price them.
export function suggestedLineItems(rfp) {
  const items = [];
  const days = Math.max(1, dayCount(rfp?.startDate, rfp?.endDate));
  for (const room of normalizeRoomRequirements(rfp?.roomRequirements)) {
    const style = setupStyleLabel(room.setupStyle);
    const pax = room.capacity ? `${room.capacity} pax` : "capacity tbc";
    items.push({
      id: rowKey("l"),
      category: "room",
      label: room.label ? `${room.label} (${style.toLowerCase()}, ${pax}) per day` : `${style} room, ${pax}, per day`,
      qty: room.days || days,
      unitPrice: 0,
    });
  }
  const nights = roomNights(rfp?.sleepingRooms);
  if (nights > 0) {
    items.push({ id: rowKey("l"), category: "sleeping", label: "Sleeping rooms (room nights)", qty: nights, unitPrice: 0 });
  }
  if (String(rfp?.fnbRequirements || "").trim() || toNumber(rfp?.fnbMinimum)) {
    items.push({ id: rowKey("l"), category: "fnb", label: "Food & beverage package", qty: 1, unitPrice: 0 });
  }
  if (String(rfp?.avNeeds || "").trim()) {
    items.push({ id: rowKey("l"), category: "av", label: "AV & production", qty: 1, unitPrice: 0 });
  }
  if (!items.length) items.push({ id: rowKey("l"), category: "room", label: "Venue hire", qty: days, unitPrice: 0 });
  return items;
}

// What the public form posts. The server recomputes every total.
export function bidPayloadFromDraft(draft) {
  return {
    lineItems: (Array.isArray(draft.lineItems) ? draft.lineItems : []).filter((l) => l && typeof l === "object").map((l) => ({
      category: l.category,
      label: text(l.label, 200).trim(),
      qty: toNumber(l.qty) ?? 0,
      unitPrice: toNumber(l.unitPrice) ?? 0,
    })),
    taxesFees: toNumber(draft.taxesFees) ?? 0,
    capacity: toNumber(draft.capacity),
    concessions: normalizeConcessions(draft.concessions),
    depositPct: toNumber(draft.depositPct),
    attritionPct: toNumber(draft.attritionPct),
    cancellationPolicy: text(draft.cancellationPolicy, 2000),
    availabilityNotes: text(draft.availabilityNotes, 2000),
    validUntil: draft.validUntil || null,
    message: text(draft.message, 4000),
    submittedByName: text(draft.submittedByName, 200).trim(),
  };
}

// Client-side check mirroring rfp_public_submit, so the venue sees problems before posting.
export function validateBidDraft(draft) {
  const items = (draft.lineItems || []).filter((l) => String(l.label || "").trim() || Number(l.qty) * Number(l.unitPrice) > 0);
  if (!items.length) return "Add at least one priced line item.";
  if (items.length > 60) return "A proposal can have at most 60 line items.";
  for (const l of items) {
    const qty = toNumber(l.qty) ?? 0;
    const price = toNumber(l.unitPrice) ?? 0;
    if (qty < 0 || price < 0) return "Quantities and prices can't be negative.";
    if (qty > 100000 || price > 100000000) return "A line item has an out-of-range quantity or price.";
  }
  if (bidTotals(items, 0).subtotal <= 0) return "Add a price to at least one line item.";
  for (const key of ["depositPct", "attritionPct"]) {
    const v = toNumber(draft[key]);
    if (v !== null && (v < 0 || v > 100)) return "Percentages must be between 0 and 100.";
  }
  if ((toNumber(draft.taxesFees) ?? 0) < 0) return "Taxes and fees can't be negative.";
  return null;
}
