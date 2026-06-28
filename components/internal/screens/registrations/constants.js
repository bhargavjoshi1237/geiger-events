// Lookups & formatters for the Registrations area. Config, not data — never put
// fetched rows here. Mirrors the Events area's constants.js conventions so the
// two areas read alike.

// Registration status -> { label, variant, dotClass } for StatusPill / Badge.
export const REGISTRATION_STATUS_MAP = {
  Confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
  Pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  Waitlisted: { label: "Waitlisted", variant: "purple", dotClass: "bg-violet-300" },
  "Checked-in": { label: "Checked-in", variant: "info", dotClass: "bg-sky-400" },
  Declined: { label: "Declined", variant: "outline", dotClass: "bg-[#525252]" },
  Cancelled: { label: "Cancelled", variant: "outline", dotClass: "bg-[#525252]" },
};

// Event format -> badge variant (lite, so the area doesn't import event sample
// data just for a colour).
export const EVENT_TYPE_MAP_LITE = {
  "In-person": "neutral",
  Online: "info",
  Hybrid: "purple",
};

// How the registration came in.
export const SOURCE_MAP = {
  Online: { label: "Online", variant: "neutral" },
  Organizer: { label: "Organizer", variant: "purple" },
  Import: { label: "Import", variant: "info" },
  API: { label: "API", variant: "neutral" },
};

// Registration form status.
export const FORM_STATUS_MAP = {
  Published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

// Field types offered by the form builder.
export const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "number", label: "Number" },
];

// Filter option lists — an "all" sentinel first, matching the events pattern.
export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Pending", label: "Pending" },
  { value: "Waitlisted", label: "Waitlisted" },
  { value: "Checked-in", label: "Checked-in" },
  { value: "Declined", label: "Declined" },
  { value: "Cancelled", label: "Cancelled" },
];

export const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "Online", label: "Online" },
  { value: "Organizer", label: "Organizer" },
  { value: "Import", label: "Import" },
  { value: "API", label: "API" },
];

export const FORM_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All forms" },
  { value: "Published", label: "Published" },
  { value: "Draft", label: "Draft" },
];

// Common dietary tags used to bucket the Dietary & Accessibility report.
export const DIETARY_TAGS = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Nut allergy",
  "Halal",
  "Kosher",
  "Dairy-free",
];

// "2026-06-18" -> "Jun 18, 2026". Mirrors events/sample_data.js formatDate.
export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

// A relative-ish timestamp for list rows ("Jun 18, 2026") from an ISO datetime.
export function formatDateTime(iso) {
  if (!iso) return "—";
  return formatDate(String(iso).split("T")[0]);
}

// Two-initial avatar seed from a name.
export function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
