import { ApiError } from "../staff_access/errors.js";

// Control's editable event fields, mirroring the dashboard's Basics + Location & time + Publishing sections.

export const EVENT_STATUSES = ["Draft", "Scheduled", "On Sale", "Sold out", "Ended"];
export const EVENT_TYPES = ["In-person", "Online", "Hybrid"];
export const EVENT_VISIBILITIES = ["Public", "Unlisted", "Private"];

// Only the metadata keys Control shows are selected, so a page-builder tree never crosses the wire.
export const EVENT_DETAIL_COLUMNS =
  "id,project_id,name,status,type,event_date,event_time,venue,address,city,timezone,capacity,sold,revenue,visibility,organizer,summary,cover_url,is_listable,currency:metadata->payments->>currency";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

function invalid(message, field) {
  return new ApiError("invalid_input", 400, message, field ? { [field]: message } : undefined);
}

function text(value, field, { max, required = false, label }) {
  if (value === null || value === undefined) {
    if (required) throw invalid(`${label} is required.`, field);
    return "";
  }
  if (typeof value !== "string") throw invalid(`${label} must be text.`, field);
  const trimmed = value.trim();
  if (required && !trimmed) throw invalid(`${label} is required.`, field);
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`, field);
  return trimmed;
}

function oneOf(value, field, options, label) {
  if (!options.includes(value)) throw invalid(`${label} must be one of ${options.join(", ")}.`, field);
  return value;
}

function validTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// Field name in the app → [column, parser]; a key missing from the body is left untouched.
const FIELDS = {
  name: ["name", (v) => text(v, "name", { max: 200, required: true, label: "Name" })],
  type: ["type", (v) => oneOf(v, "type", EVENT_TYPES, "Type")],
  date: [
    "event_date",
    (v) => {
      if (v === null || v === "") return null;
      if (typeof v !== "string" || !DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
        throw invalid("Date must be YYYY-MM-DD.", "date");
      }
      return v;
    },
  ],
  time: [
    "event_time",
    (v) => {
      if (v === null || v === "") return null;
      if (typeof v !== "string" || !TIME.test(v)) throw invalid("Time must be HH:MM.", "time");
      return v.slice(0, 5);
    },
  ],
  timezone: [
    "timezone",
    (v) => {
      const zone = text(v, "timezone", { max: 64, required: true, label: "Time zone" });
      if (!validTimeZone(zone)) throw invalid("That time zone isn't recognised.", "timezone");
      return zone;
    },
  ],
  venue: ["venue", (v) => text(v, "venue", { max: 200, label: "Venue" })],
  address: ["address", (v) => text(v, "address", { max: 300, label: "Address" })],
  city: ["city", (v) => text(v, "city", { max: 120, label: "City" })],
  capacity: [
    "capacity",
    (v) => {
      const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10_000_000) {
        throw invalid("Capacity must be a whole number, 0 or more.", "capacity");
      }
      return n;
    },
  ],
  visibility: ["visibility", (v) => oneOf(v, "visibility", EVENT_VISIBILITIES, "Visibility")],
  organizer: ["organizer", (v) => text(v, "organizer", { max: 200, label: "Organiser" })],
  summary: ["summary", (v) => text(v, "summary", { max: 5000, label: "Summary" })],
  isListable: [
    "is_listable",
    (v) => {
      if (typeof v !== "boolean") throw invalid("Listing must be on or off.", "isListable");
      return v;
    },
  ],
  status: ["status", (v) => oneOf(v, "status", EVENT_STATUSES, "Status")],
};

// Columns that change what the public sees, so they also need the publish permission.
export const PUBLIC_COLUMNS = ["status", "visibility", "is_listable"];

// A camelCase body → a column patch; `publicChange` tells the route to also require the publish permission.
export function parseEventPatch(body, { create = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("Send the fields to change.");
  const row = {};
  for (const [key, [column, parse]] of Object.entries(FIELDS)) {
    if (key in body) row[column] = parse(body[key]);
  }
  if (create && !("name" in row)) throw invalid("Name is required.", "name");
  if (create && "status" in row) delete row.status;
  if (!Object.keys(row).length) throw invalid("Send at least one field to change.");
  return { row, publicChange: PUBLIC_COLUMNS.some((column) => column in row) };
}

export function eventDetails(row) {
  return {
    type: row.type ?? "In-person",
    address: row.address ?? "",
    revenue: Number(row.revenue ?? 0),
    visibility: row.visibility ?? "Public",
    organizer: row.organizer ?? "",
    summary: row.summary ?? "",
    isListable: Boolean(row.is_listable),
    currency: String(row.currency || "usd").toLowerCase(),
  };
}

const TICKET_LIMIT = 100;

function ticketInput(raw, index) {
  if (!raw || typeof raw !== "object") throw invalid(`Ticket ${index + 1} is malformed.`);
  const name = text(raw.name, "name", { max: 120, required: true, label: `Ticket ${index + 1}'s name` });
  const price = Number(raw.price);
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw invalid(`${name}: price must be 0 or more.`);
  const qty = Number(raw.qty);
  if (!Number.isInteger(qty) || qty < 0 || qty > 10_000_000) throw invalid(`${name}: quantity must be a whole number, 0 or more.`);
  const description = text(raw.description ?? "", "description", { max: 1000, label: `${name}'s description` });
  const id = typeof raw.id === "string" && raw.id ? raw.id.slice(0, 64) : null;
  return { id, name, price: Math.round(price * 100) / 100, qty, description };
}

// Replaces the list the app edits but merges by id, so keys only the dashboard edits (type, group, releases, discounts) survive.
export function mergeTickets(current, incoming, newId) {
  if (!Array.isArray(incoming)) throw invalid("Send the full ticket list.");
  if (incoming.length > TICKET_LIMIT) throw invalid(`An event can have at most ${TICKET_LIMIT} tickets.`);
  const byId = new Map((Array.isArray(current) ? current : []).filter((t) => t?.id).map((t) => [String(t.id), t]));
  const seen = new Set();
  return incoming.map((raw, i) => {
    const input = ticketInput(raw, i);
    const existing = input.id ? byId.get(input.id) : null;
    if (existing && !seen.has(input.id)) {
      seen.add(input.id);
      return { ...existing, name: input.name, price: input.price, qty: input.qty, description: input.description };
    }
    return {
      id: newId(),
      name: input.name,
      price: input.price,
      qty: input.qty,
      description: input.description,
      ticketTypeId: null,
      groupId: null,
      discountIds: [],
      releases: [],
    };
  });
}

export function ticketView(ticket) {
  return {
    id: String(ticket.id ?? ""),
    name: String(ticket.name ?? "Ticket"),
    price: Number(ticket.price) || 0,
    qty: Number(ticket.qty) || 0,
    description: String(ticket.description ?? ""),
    hasType: Boolean(ticket.ticketTypeId),
    releases: Array.isArray(ticket.releases) ? ticket.releases.length : 0,
  };
}
