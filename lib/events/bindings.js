// Dynamic text for the page builder.
//
// Any string a component renders may carry tokens that resolve against the live
// event at render time:
//
//   {{event.name}}
//   {{event.startsAt | date:long | fallback:Date to be announced}}
//   {{tickets.lowestPrice | currency}}
//
// One mechanism, not two: because it is plain string interpolation it works
// identically in headings, rich text, button labels, link URLs and image URLs,
// and the inspector only has to insert a token at the cursor.

const TOKEN_RE = /\{\{([^{}]+)\}\}/g;

// --- Formatting --------------------------------------------------------------

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FORMATS = {
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  medium: { day: "numeric", month: "long", year: "numeric" },
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  day: { day: "numeric" },
  weekday: { weekday: "long" },
  month: { month: "long" },
  year: { year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
  datetime: {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

// Whole days between now and `date`, rounded toward the event so "today" reads
// as today right up to midnight.
function daysBetween(date, from = new Date()) {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86400000);
}

function relativeDate(date) {
  const days = daysBetween(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) {
    if (days < 7) return `in ${days} days`;
    if (days < 30) return `in ${Math.round(days / 7)} weeks`;
    if (days < 365) return `in ${Math.round(days / 30)} months`;
    return `in ${Math.round(days / 365)} years`;
  }
  const past = Math.abs(days);
  if (past < 7) return `${past} days ago`;
  if (past < 30) return `${Math.round(past / 7)} weeks ago`;
  if (past < 365) return `${Math.round(past / 30)} months ago`;
  return `${Math.round(past / 365)} years ago`;
}

// Filters are (value, arg, ctx) -> value. An unknown filter is ignored rather
// than throwing — a typo in a token must never take the page down.
const FILTERS = {
  date(value, arg) {
    const d = toDate(value);
    if (!d) return "";
    if (arg === "relative") return relativeDate(d);
    if (arg === "iso") return d.toISOString().slice(0, 10);
    const opts = DATE_FORMATS[arg || "medium"] || DATE_FORMATS.medium;
    return new Intl.DateTimeFormat("en-GB", opts).format(d);
  },
  currency(value, arg, ctx) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const code = arg || ctx?.tickets?.currency || "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: n % 1 === 0 ? 0 : 2,
      }).format(n);
    } catch {
      return `${code} ${n}`;
    }
  },
  number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
  },
  upper(value) {
    return String(value ?? "").toUpperCase();
  },
  lower(value) {
    return String(value ?? "").toLowerCase();
  },
  title(value) {
    return String(value ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
  },
  truncate(value, arg) {
    const limit = Number(arg) || 80;
    const text = String(value ?? "");
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  },
  // Terminal filter: substitutes when everything before it produced nothing.
  fallback(value, arg) {
    const empty =
      value == null ||
      value === "" ||
      (Array.isArray(value) && !value.length) ||
      (typeof value === "number" && Number.isNaN(value));
    return empty ? (arg ?? "") : value;
  },
};

export const FILTER_HINTS = [
  { key: "date:long", label: "Long date", sample: "Saturday, 12 September 2026" },
  { key: "date:medium", label: "Date", sample: "12 September 2026" },
  { key: "date:short", label: "Short date", sample: "12/09/2026" },
  { key: "date:weekday", label: "Weekday", sample: "Saturday" },
  { key: "date:time", label: "Time", sample: "19:00" },
  { key: "date:relative", label: "Relative", sample: "in 3 weeks" },
  { key: "currency", label: "Currency", sample: "$49" },
  { key: "number", label: "Number", sample: "1,240" },
  { key: "upper", label: "UPPERCASE", sample: "SUMMER FEST" },
  { key: "title", label: "Title Case", sample: "Summer Fest" },
  { key: "truncate:120", label: "Truncate", sample: "First 120 characters…" },
  { key: "fallback:TBA", label: "Fallback", sample: "shown when empty" },
];

// --- Context -----------------------------------------------------------------

function get(obj, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function combine(date, time) {
  if (!date) return "";
  return time ? `${date}T${time}` : date;
}

function ticketPrices(event) {
  const tiers = Array.isArray(event?.tickets) ? event.tickets : [];
  return tiers
    .map((t) => Number(t?.price))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/**
 * Flatten the event view model into the shape tokens address. Every value is
 * already display-ready or a primitive a filter can format; nothing here throws
 * on a half-filled event.
 */
export function buildBindingContext(event, extra = {}) {
  const e = event || {};
  const location = e.location || {};
  const map = e.map || {};
  const prices = ticketPrices(e);
  const lowest = prices.length ? Math.min(...prices) : null;
  const highest = prices.length ? Math.max(...prices) : null;
  const capacity = Number(e.capacity) || 0;
  const sold = Number(e.sold) || 0;
  const start = toDate(combine(e.date, e.time));

  return {
    event: {
      id: e.id || "",
      name: e.name || "",
      tagline: e.summary || "",
      description: e.description || "",
      status: e.status || "",
      type: e.type || "",
      date: e.date || "",
      time: e.time || "",
      startsAt: combine(e.date, e.time),
      endsAt: combine(e.endDate || e.date, location.ends || e.endTime || ""),
      doorsOpen: combine(e.date, location.doorsOpen || ""),
      timezone: e.timezone || "",
      coverUrl: e.coverUrl || "",
      organizer: e.organizer || "",
      url: e.id ? `/e/${e.id}` : "",
    },
    venue: {
      name: e.venue || "",
      room: location.room || "",
      address: e.address || "",
      city: e.city || "",
      full: [e.venue, e.address, e.city].filter(Boolean).join(", "),
      transport: map.transport || "",
      parking: map.parking || "",
      isOnline: /online|virtual/i.test(e.type || "") ? "yes" : "",
    },
    tickets: {
      currency: e.payments?.currency || "USD",
      lowestPrice: lowest,
      highestPrice: highest,
      // A single-price event reads "$49", a spread reads "$49 – $149".
      priceRange:
        lowest == null
          ? ""
          : lowest === highest
            ? FILTERS.currency(lowest, null, { tickets: { currency: e.payments?.currency } })
            : `${FILTERS.currency(lowest, null, { tickets: { currency: e.payments?.currency } })} – ${FILTERS.currency(highest, null, { tickets: { currency: e.payments?.currency } })}`,
      tierNames: (Array.isArray(e.tickets) ? e.tickets : [])
        .map((t) => t?.name)
        .filter(Boolean)
        .join(", "),
      tierCount: (Array.isArray(e.tickets) ? e.tickets : []).length,
      capacity,
      sold,
      remaining: capacity > 0 ? Math.max(0, capacity - sold) : null,
      soldOut: capacity > 0 && sold >= capacity ? "yes" : "",
    },
    counts: {
      going: sold,
      guests: (Array.isArray(e.guests) ? e.guests : []).length,
      sessions: (Array.isArray(e.schedule) ? e.schedule : []).length,
      highlights: (Array.isArray(e.highlights) ? e.highlights : []).length,
      daysUntil: start ? Math.max(0, daysBetween(start)) : null,
      percentSold: capacity > 0 ? Math.round((sold / capacity) * 100) : null,
    },
    brand: {
      organizer: e.organizer || "",
      logo: extra.logo || "",
      siteName: extra.siteName || "",
      accent: extra.accent || "",
    },
  };
}

// --- Catalog -----------------------------------------------------------------
//
// Drives the "Insert dynamic value" dropdown. `defaultFilter` is appended when
// the raw value needs formatting to be readable.

export const BINDING_GROUPS = [
  {
    key: "event",
    label: "Event",
    items: [
      { token: "event.name", label: "Event name" },
      { token: "event.tagline", label: "Tagline" },
      { token: "event.description", label: "Description" },
      { token: "event.type", label: "Event type" },
      { token: "event.status", label: "Status" },
      { token: "event.startsAt", label: "Start date", defaultFilter: "date:long" },
      { token: "event.startsAt", label: "Start time", defaultFilter: "date:time" },
      { token: "event.endsAt", label: "End date", defaultFilter: "date:long" },
      { token: "event.doorsOpen", label: "Doors open", defaultFilter: "date:time" },
      { token: "event.startsAt", label: "Countdown", defaultFilter: "date:relative" },
      { token: "event.timezone", label: "Timezone" },
      { token: "event.coverUrl", label: "Cover image URL" },
      { token: "event.url", label: "Public page link" },
    ],
  },
  {
    key: "venue",
    label: "Venue & location",
    items: [
      { token: "venue.name", label: "Venue name" },
      { token: "venue.room", label: "Room" },
      { token: "venue.address", label: "Street address" },
      { token: "venue.city", label: "City" },
      { token: "venue.full", label: "Full address" },
      { token: "venue.transport", label: "Getting there" },
      { token: "venue.parking", label: "Parking notes" },
    ],
  },
  {
    key: "tickets",
    label: "Tickets & pricing",
    items: [
      { token: "tickets.lowestPrice", label: "Lowest price", defaultFilter: "currency" },
      { token: "tickets.highestPrice", label: "Highest price", defaultFilter: "currency" },
      { token: "tickets.priceRange", label: "Price range" },
      { token: "tickets.tierNames", label: "Ticket tier names" },
      { token: "tickets.tierCount", label: "Number of tiers" },
      { token: "tickets.capacity", label: "Capacity", defaultFilter: "number" },
      { token: "tickets.sold", label: "Tickets sold", defaultFilter: "number" },
      { token: "tickets.remaining", label: "Tickets remaining", defaultFilter: "number" },
    ],
  },
  {
    key: "counts",
    label: "Organizer & counts",
    items: [
      { token: "brand.organizer", label: "Organizer name" },
      { token: "brand.logo", label: "Brand logo URL" },
      { token: "brand.siteName", label: "Brand site name" },
      { token: "counts.going", label: "People going", defaultFilter: "number" },
      { token: "counts.guests", label: "Guest count" },
      { token: "counts.sessions", label: "Session count" },
      { token: "counts.daysUntil", label: "Days until event" },
      { token: "counts.percentSold", label: "Percent sold" },
    ],
  },
];

/** The token text an inspector inserts for a catalog entry. */
export function tokenFor(item) {
  return item.defaultFilter
    ? `{{${item.token} | ${item.defaultFilter}}}`
    : `{{${item.token}}}`;
}

// --- Resolution --------------------------------------------------------------

function applyFilters(value, parts, ctx) {
  return parts.reduce((acc, part) => {
    const at = part.indexOf(":");
    const name = (at === -1 ? part : part.slice(0, at)).trim();
    const arg = at === -1 ? null : part.slice(at + 1).trim();
    const filter = FILTERS[name];
    return filter ? filter(acc, arg, ctx) : acc;
  }, value);
}

/**
 * Replace every token in `input` using `ctx`. Non-strings pass through
 * untouched, and an unresolvable token with no `fallback` collapses to "" so a
 * half-filled event renders short rather than showing raw braces to a visitor.
 */
export function resolveTokens(input, ctx) {
  if (typeof input !== "string" || !input.includes("{{")) return input;
  if (!ctx) return input;
  return input.replace(TOKEN_RE, (_match, body) => {
    const [path, ...filters] = String(body).split("|");
    const raw = get(ctx, path.trim());
    const value = applyFilters(raw, filters, ctx);
    return value == null ? "" : String(value);
  });
}

/** Deep-resolve every string in a props bag. Arrays and objects are walked. */
export function resolveProps(props, ctx) {
  if (!ctx || !props) return props;
  if (typeof props === "string") return resolveTokens(props, ctx);
  if (Array.isArray(props)) return props.map((v) => resolveProps(v, ctx));
  if (typeof props !== "object") return props;
  const out = {};
  for (const [key, value] of Object.entries(props)) out[key] = resolveProps(value, ctx);
  return out;
}

/** True when the string carries at least one token — used to badge a field. */
export function hasTokens(value) {
  return typeof value === "string" && /\{\{[^{}]+\}\}/.test(value);
}
