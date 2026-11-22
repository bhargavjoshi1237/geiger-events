import { ApiError } from "../../staff_access/errors.js";

// Control's Guests and Registrations view models and request parsers, mirroring the dashboard's lib/supabase data layers.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message, field) {
  return new ApiError("invalid_input", 400, message, field ? { [field]: message } : undefined);
}

function text(value, field, label, max, { required = false } = {}) {
  if (value == null) {
    if (required) throw invalid(`${label} is required.`, field);
    return "";
  }
  if (typeof value !== "string") throw invalid(`${label} must be text.`, field);
  const trimmed = value.trim();
  if (required && !trimmed) throw invalid(`${label} is required.`, field);
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`, field);
  return trimmed;
}

// --- Contacts ------------------------------------------------------------------

export function contactView(row) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    title: row.title ?? "",
    location: row.location ?? "",
    status: row.status ?? "Active",
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    blocked: Boolean(row.blocked),
    notes: notesOf(meta).map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
    createdAt: row.created_at ?? null,
  };
}

function cleanTags(value) {
  if (!Array.isArray(value)) throw invalid("Tags must be a list.", "tags");
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const tag = text(raw, "tags", "A tag", 60);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  if (out.length > 50) throw invalid("A contact can have at most 50 tags.", "tags");
  return out;
}

// Same columns the dashboard's contact drawer edits; a key missing from the body is left alone.
export function parseContact(body, { create = false } = {}) {
  if (!body || typeof body !== "object") throw invalid("Send the contact's details.");
  const row = {};
  if (create || "name" in body) row.name = text(body.name, "name", "Name", 200, { required: true });
  if ("email" in body) {
    const email = text(body.email, "email", "Email", 254).toLowerCase();
    if (email && !EMAIL.test(email)) throw invalid("Enter a valid email address.", "email");
    row.email = email;
  }
  for (const [key, label, max] of [
    ["phone", "Phone", 40],
    ["company", "Company", 200],
    ["title", "Title", 200],
    ["location", "Location", 200],
  ]) {
    if (key in body) row[key] = text(body[key], key, label, max);
  }
  if ("tags" in body) row.tags = cleanTags(body.tags);
  if (!create && !Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

// --- Notes (contacts.metadata.notes, newest first, as the dashboard writes them) -

function notesOf(meta) {
  return (Array.isArray(meta?.notes) ? meta.notes : [])
    .filter((n) => n && typeof n === "object")
    .map((n) => ({ id: String(n.id ?? ""), body: String(n.body ?? ""), createdAt: n.createdAt ?? null, createdBy: n.createdBy ?? null }));
}

export function parseNote(body) {
  return text(body?.body, "body", "Note", 4000, { required: true });
}

export function withNote(metadata, note) {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  return { ...meta, notes: [note, ...(Array.isArray(meta.notes) ? meta.notes : [])] };
}

export function withoutNote(metadata, noteId) {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  return { ...meta, notes: (Array.isArray(meta.notes) ? meta.notes : []).filter((n) => n?.id !== noteId) };
}

// Every contact's notes as one newest-first feed (Guests → Notes).
export function notesFeed(rows) {
  const out = [];
  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    for (const note of notesOf(meta)) {
      out.push({ ...note, contactId: row.id, contactName: row.name || "", contactEmail: row.email || "" });
    }
  }
  return out.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

// --- Tags (contacts.tags arrays + the contact_tags catalog) ------------------------

export function tagList(catalogRows, contactRows) {
  const counts = new Map();
  for (const c of contactRows) for (const t of Array.isArray(c.tags) ? c.tags : []) counts.set(t, (counts.get(t) || 0) + 1);
  const byName = new Map();
  for (const row of catalogRows) {
    byName.set(row.name, { id: row.id, name: row.name ?? "", color: row.color ?? "slate", description: row.description ?? "", count: counts.get(row.name) || 0 });
  }
  for (const [name, count] of counts) if (!byName.has(name)) byName.set(name, { id: null, name, color: "slate", description: "", count });
  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function parseTagRename(body) {
  const from = text(body?.from, "from", "The tag", 60, { required: true });
  const to = text(body?.to, "to", "The new name", 60, { required: true });
  if (from === to) throw invalid("That's already its name.", "to");
  return { from, to, catalogId: typeof body?.catalogId === "string" && body.catalogId ? body.catalogId : null };
}

export function parseTagDelete(body) {
  return {
    name: text(body?.name, "name", "The tag", 60, { required: true }),
    catalogId: typeof body?.catalogId === "string" && body.catalogId ? body.catalogId : null,
  };
}

// --- Segments (read-only on the phone; rules are built on the dashboard) ----------

const RULE_FIELDS = {
  status: "Status",
  tag: "Tag",
  consentEmail: "Email consent",
  consentSms: "SMS consent",
  blocked: "Blocked",
  attending: "Attending",
  event: "Event",
  location: "Location",
  company: "Company",
};

export function ruleText(rule) {
  const label = RULE_FIELDS[rule?.field] || String(rule?.field || "Rule");
  const not = rule?.op === "isNot" ? "is not" : rule?.field === "location" || rule?.field === "company" ? "contains" : "is";
  return `${label} ${not} ${String(rule?.value ?? "")}`.trim();
}

export function segmentView(row, members) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const rules = Array.isArray(row.rules) ? row.rules : [];
  return {
    id: row.id,
    name: row.name ?? "Untitled segment",
    description: row.description ?? "",
    color: row.color ?? "slate",
    rules: rules.map(ruleText),
    handPicked: Array.isArray(meta.manualIds) ? meta.manualIds.length : 0,
    members,
  };
}

// --- Data requests ----------------------------------------------------------------

export const DATA_REQUEST_STATUSES = ["New", "In Progress", "Completed", "Rejected"];

// Overdue is decided here, so every phone agrees with the server's clock.
export function dataRequestView(row, now = new Date()) {
  const status = row.status ?? "New";
  const due = row.due_at ? Date.parse(row.due_at) : NaN;
  return {
    id: row.id,
    email: row.email ?? "",
    type: row.type ?? "Export",
    status,
    note: row.note ?? "",
    dueAt: row.due_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    overdue: (status === "New" || status === "In Progress") && Number.isFinite(due) && due < now.getTime(),
    createdAt: row.created_at ?? null,
  };
}

// Closing a request stamps when it was resolved; reopening clears it, as the dashboard does.
export function parseDataRequestStatus(body, now = new Date()) {
  const status = body?.status;
  if (!DATA_REQUEST_STATUSES.includes(status)) throw invalid("That status isn't one of the choices.", "status");
  return { status, resolved_at: status === "Completed" || status === "Rejected" ? now.toISOString() : null };
}

// --- Registration forms -----------------------------------------------------------

export const FORM_STATUSES = ["Published", "Draft"];

export function formView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    fields: Array.isArray(row.fields) ? row.fields.length : 0,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

export function parseFormStatus(body) {
  if (!FORM_STATUSES.includes(body?.status)) throw invalid("A form is Published or Draft.", "status");
  return { status: body.status };
}

// --- Waitlist ---------------------------------------------------------------------

export function parsePromoteCount(body) {
  const count = Number(body?.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw invalid("Promote between 1 and 500 people.", "count");
  return count;
}

export function waitlistView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    partySize: Number(row.party_size ?? 1),
    position: row.waitlist_position ?? null,
    createdAt: row.created_at ?? null,
  };
}

// Oldest place first, the order promote_waitlist works through.
export function sortWaitlist(rows) {
  return [...rows].sort((a, b) => {
    const pa = a.waitlist_position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.waitlist_position ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

// --- Dietary & accessibility ------------------------------------------------------

export const DIETARY_TAGS = ["Vegetarian", "Vegan", "Gluten-free", "Nut allergy", "Halal", "Kosher", "Dairy-free"];
export const DIETARY_ANSWER_PREFIX = "dietary:";

const LIVE = (r) => !["Cancelled", "Declined"].includes(r.status);

// The same figures as the dashboard's report: who has needs, the common dietary tags, and the inquiry answers.
export function dietaryReport(registrations, questions = []) {
  const live = registrations.filter(LIVE);
  const withNeeds = live.filter((r) => String(r.dietary || "").trim() || String(r.accessibility || "").trim());
  const dietary = withNeeds.filter((r) => String(r.dietary || "").trim());
  return {
    totals: {
      withNeeds: withNeeds.length,
      heads: withNeeds.reduce((sum, r) => sum + (Number(r.party_size) || 1), 0),
      dietary: dietary.length,
      accessibility: withNeeds.filter((r) => String(r.accessibility || "").trim()).length,
    },
    tags: DIETARY_TAGS.map((tag) => ({ tag, count: dietary.filter((r) => String(r.dietary).toLowerCase().includes(tag.toLowerCase())).length })).filter(
      (b) => b.count > 0,
    ),
    questions: (Array.isArray(questions) ? questions : [])
      .map((q) => {
        const key = `${DIETARY_ANSWER_PREFIX}${q.id}`;
        const counts = (q.options || []).map((opt) => ({
          label: String(opt.label ?? ""),
          count: live.filter((r) => {
            const v = r.answers?.[key];
            return Array.isArray(v) ? v.includes(opt.label) : v === opt.label;
          }).length,
        }));
        return { question: String(q.label ?? "Question"), counts, total: counts.reduce((s, c) => s + c.count, 0) };
      })
      .filter((b) => b.total > 0),
    guests: withNeeds
      .map((r) => ({
        id: r.id,
        name: r.name ?? "",
        email: r.email ?? "",
        partySize: Number(r.party_size ?? 1),
        dietary: String(r.dietary || "").trim(),
        accessibility: String(r.accessibility || "").trim(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// --- Attendee export --------------------------------------------------------------

export const EXPORT_COLUMNS = [
  ["Name", (r) => r.name],
  ["Email", (r) => r.email],
  ["Phone", (r) => r.phone],
  ["Status", (r) => r.status],
  ["Party size", (r) => r.party_size ?? 1],
  ["Dietary", (r) => r.dietary],
  ["Accessibility", (r) => r.accessibility],
  ["Company", (r) => r.company],
  ["Tags", (r) => (r.tags || []).join("; ")],
  ["Registered", (r) => (r.created_at ? String(r.created_at).slice(0, 10) : "")],
];

// Quotes every cell and defuses spreadsheet formulas, since the file leaves the phone for whatever app opens it.
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function attendeeCsv(rows, columns = EXPORT_COLUMNS) {
  const lines = [columns.map(([header]) => csvCell(header)).join(",")];
  for (const row of rows) lines.push(columns.map(([, get]) => csvCell(get(row))).join(","));
  return lines.join("\r\n");
}

export function exportFilename(eventName, now = new Date()) {
  const slug = String(eventName || "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "event";
  return `${slug}-attendees-${now.toISOString().slice(0, 10)}.csv`;
}
