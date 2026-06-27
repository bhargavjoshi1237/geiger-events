// Shared sample data for the Events area. Stands in for the backend until the
// Supabase data model is wired up. Kept topic-specific so each screen reads like
// real event-management content rather than lorem placeholders.

export const EVENT_STATUS_MAP = {
  "On sale": { label: "On sale", variant: "success", dotClass: "bg-emerald-400" },
  "Sold out": { label: "Sold out", variant: "info", dotClass: "bg-sky-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "purple", dotClass: "bg-violet-300" },
  Ended: { label: "Ended", variant: "outline", dotClass: "bg-[#525252]" },
};

export const EVENT_TYPE_MAP = {
  "In-person": { label: "In-person", variant: "neutral" },
  Online: { label: "Online", variant: "info" },
  Hybrid: { label: "Hybrid", variant: "purple" },
};

export const EVENTS = [
  {
    id: "7b1c0e9a-4d2f-4a1b-9c3e-1f5a8d6b2c01",
    name: "Summer Product Launch",
    status: "On sale",
    type: "Hybrid",
    date: "2026-06-18",
    time: "18:00",
    venue: "The Glasshouse",
    address: "61 Southwark Street, London SE1 0HL",
    city: "London",
    timezone: "Europe/London",
    capacity: 400,
    sold: 312,
    revenue: 9840,
    visibility: "Public",
    organizer: "Ava Mitchell",
    summary:
      "An evening unveiling our biggest release yet — talks, live demos, and drinks.",
  },
  {
    id: "a2d4f6e8-1b3c-4d5e-8f90-2a3b4c5d6e02",
    name: "Local Music Night",
    status: "Sold out",
    type: "In-person",
    date: "2026-06-12",
    time: "20:00",
    venue: "Basement 45",
    address: "Frogmore Street, Bristol BS1 5NA",
    city: "Bristol",
    timezone: "Europe/London",
    capacity: 300,
    sold: 300,
    revenue: 5400,
    visibility: "Public",
    organizer: "Marco Reyes",
    summary:
      "Three local bands, one tiny basement, and a very loud night out.",
  },
  {
    id: "c3e5079b-2c4d-4e6f-9a01-3b4c5d6e7f03",
    name: "Founder AMA — Live",
    status: "On sale",
    type: "Online",
    date: "2026-06-20",
    time: "16:00",
    venue: "Zoom Webinar",
    address: "Online — link sent on registration",
    city: "Remote",
    timezone: "Europe/London",
    capacity: 150,
    sold: 128,
    revenue: 3120,
    visibility: "Unlisted",
    organizer: "Ava Mitchell",
    summary:
      "Ask our founders anything — product, fundraising, and lessons learned.",
    seriesId: "22222222-2222-4222-8222-000000000001",
  },
  {
    id: "d4f618ac-3d5e-4f70-ab12-4c5d6e7f8004",
    name: "Design Systems Workshop",
    status: "Draft",
    type: "In-person",
    date: "2026-07-02",
    time: "10:00",
    venue: "WeWork Moorgate",
    address: "1 Fore Street Avenue, London EC2Y 9DT",
    city: "London",
    timezone: "Europe/London",
    capacity: 80,
    sold: 54,
    revenue: 2160,
    visibility: "Private",
    organizer: "Priya Shah",
    summary:
      "A hands-on day building a scalable design system from tokens to components.",
    seriesId: "22222222-2222-4222-8222-000000000002",
  },
  {
    id: "e50729bd-4e6f-4081-bc23-5d6e7f809105",
    name: "Indie Film Screening",
    status: "On sale",
    type: "In-person",
    date: "2026-06-28",
    time: "19:30",
    venue: "The Ritzy",
    address: "Brixton Oval, London SW2 1JG",
    city: "London",
    timezone: "Europe/London",
    capacity: 120,
    sold: 74,
    revenue: 1480,
    visibility: "Public",
    organizer: "Marco Reyes",
    summary:
      "A première screening followed by a Q&A with the director and cast.",
  },
  {
    id: "f61830ce-5f70-4192-cd34-6e7f8091a206",
    name: "Startup Networking Brunch",
    status: "Scheduled",
    type: "In-person",
    date: "2026-07-11",
    time: "11:00",
    venue: "Caravan King's Cross",
    address: "1 Granary Square, London N1C 4AA",
    city: "London",
    timezone: "Europe/London",
    capacity: 90,
    sold: 0,
    revenue: 0,
    visibility: "Public",
    organizer: "Priya Shah",
    summary:
      "Founders, operators, and investors over brunch — relaxed, no pitches.",
  },
  {
    id: "072941df-6081-42a3-de45-7f8091a2b307",
    name: "Q2 Customer Webinar",
    status: "Ended",
    type: "Online",
    date: "2026-05-22",
    time: "15:00",
    venue: "Geiger Live",
    address: "Online — link sent on registration",
    city: "Remote",
    timezone: "Europe/London",
    capacity: 500,
    sold: 438,
    revenue: 0,
    visibility: "Public",
    organizer: "Ava Mitchell",
    summary:
      "A walkthrough of everything we shipped this quarter, plus a live roadmap Q&A.",
    seriesId: "22222222-2222-4222-8222-000000000001",
  },
  {
    id: "183a52e0-7192-43b4-ef56-8091a2b3c408",
    name: "Pottery Masterclass",
    status: "On sale",
    type: "In-person",
    date: "2026-07-05",
    time: "14:00",
    venue: "Turning Earth",
    address: "Argall Avenue, London E10 7QE",
    city: "London",
    timezone: "Europe/London",
    capacity: 24,
    sold: 19,
    revenue: 1140,
    visibility: "Public",
    organizer: "Lena Okafor",
    summary:
      "A beginner-friendly afternoon at the wheel — clay, glaze, and a piece to take home.",
    seriesId: "22222222-2222-4222-8222-000000000002",
  },
];

export const ORGANIZERS = [
  "Ava Mitchell",
  "Marco Reyes",
  "Priya Shah",
  "Lena Okafor",
];

export const VENUES = [
  "The Glasshouse",
  "Basement 45",
  "WeWork Moorgate",
  "The Ritzy",
  "Caravan King's Cross",
  "Turning Earth",
  "Online — Geiger Live",
];

export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function currency(n) {
  return `$${n.toLocaleString()}`;
}

export function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// --- Identity & lookup -------------------------------------------------------

// Real RFC-4122 v4 id for a new row. Falls back to a compatible generator on
// the rare runtime without crypto.randomUUID so creation never throws.
export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Back-compat alias — events mint ids through this name.
export const newEventId = newId;

// URL-safe slug derived from an event name (e.g. "Summer Product Launch" →
// "summer-product-launch"). Used for the public link and SEO surfaces.
export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A stable public slug for an event — an explicit `slug` wins, otherwise it's
// derived from the name.
export function eventSlug(event) {
  return event?.slug || slugify(event?.name || "event");
}

export function findEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}

// --- Templates ---------------------------------------------------------------

// Category → badge styling for template cards (mirrors EVENT_STATUS_MAP shape).
export const TEMPLATE_CATEGORY_MAP = {
  Community: { label: "Community", variant: "neutral" },
  Music: { label: "Music", variant: "purple" },
  Education: { label: "Education", variant: "info" },
  Online: { label: "Online", variant: "info" },
  Conference: { label: "Conference", variant: "success" },
  Social: { label: "Social", variant: "neutral" },
};

// Filter options — "all" sentinel first, then one per category in the map.
export const TEMPLATE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...Object.keys(TEMPLATE_CATEGORY_MAP).map((c) => ({ value: c, label: c })),
];

// Icon options for the create/edit dialog — value is a Lucide name the screen
// resolves to a component via TEMPLATE_ICONS.
export const TEMPLATE_ICON_OPTIONS = [
  { value: "Users", label: "Community" },
  { value: "Music", label: "Music" },
  { value: "GraduationCap", label: "Education" },
  { value: "Video", label: "Online" },
  { value: "Mic", label: "Speaker" },
  { value: "PartyPopper", label: "Social" },
  { value: "Sparkles", label: "General" },
];

// Each template carries a `blueprint`: the event defaults applied when you
// "Use" it to spin up a new draft event. Ids match supabase/sqls/templates.sql.
export const EVENT_TEMPLATES = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    name: "Meetup",
    description: "Talks + networking, free RSVP, one ticket type.",
    category: "Community",
    icon: "Users",
    uses: 42,
    blueprint: { type: "In-person", capacity: 80, visibility: "Public", timezone: "Europe/London", summary: "An evening of short talks and relaxed networking." },
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    name: "Concert / Gig",
    description: "Paid tickets, tiers, door sales, capacity cap.",
    category: "Music",
    icon: "Music",
    uses: 28,
    blueprint: { type: "In-person", capacity: 300, visibility: "Public", timezone: "Europe/London", summary: "A live night out — doors, support, and a headline set." },
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    name: "Workshop",
    description: "Limited seats, custom questions, materials add-on.",
    category: "Education",
    icon: "GraduationCap",
    uses: 35,
    blueprint: { type: "In-person", capacity: 30, visibility: "Public", timezone: "Europe/London", summary: "A hands-on session with limited seats and materials provided." },
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    name: "Webinar",
    description: "Online, registration form, automated reminders.",
    category: "Online",
    icon: "Video",
    uses: 51,
    blueprint: { type: "Online", capacity: 500, visibility: "Public", timezone: "Europe/London", summary: "A live online session — register to get the join link." },
  },
  {
    id: "11111111-1111-4111-8111-000000000005",
    name: "Conference Talk",
    description: "Multi-session agenda, speakers, sponsor slots.",
    category: "Conference",
    icon: "Mic",
    uses: 17,
    blueprint: { type: "Hybrid", capacity: 250, visibility: "Public", timezone: "Europe/London", summary: "A flagship talk with speakers, an agenda, and sponsor moments." },
  },
  {
    id: "11111111-1111-4111-8111-000000000006",
    name: "Party",
    description: "Guest list, plus-ones, who's going, photo album.",
    category: "Social",
    icon: "PartyPopper",
    uses: 23,
    blueprint: { type: "In-person", capacity: 120, visibility: "Unlisted", timezone: "Europe/London", summary: "A guest-list party with plus-ones and a shared photo album." },
  },
];

// --- Event Series ------------------------------------------------------------

// Series reuse EVENT_STATUS_MAP for their StatusPill.
export const SERIES_CADENCE_OPTIONS = [
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Custom", label: "Custom" },
];

export const SERIES_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "On sale", label: "On sale" },
  { value: "Ended", label: "Ended" },
];

export const SERIES_VISIBILITY_OPTIONS = [
  { value: "Public", label: "Public" },
  { value: "Unlisted", label: "Unlisted" },
  { value: "Private", label: "Private" },
];

export const SERIES_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...SERIES_STATUS_OPTIONS,
];

// Sample series. Ids + membership match supabase/sqls/series.sql so the same
// rows resolve once the DB is live.
export const EVENT_SERIES = [
  {
    id: "22222222-2222-4222-8222-000000000001",
    name: "Founder Sessions",
    description: "A monthly run of founder AMAs and live customer webinars.",
    status: "On sale",
    cadence: "Monthly",
    visibility: "Public",
    settings: {
      defaults: { type: "Online", visibility: "Public", timezone: "Europe/London", organizer: "Ava Mitchell" },
      recurrence: {},
      eventOrder: [],
      followPage: true,
    },
  },
  {
    id: "22222222-2222-4222-8222-000000000002",
    name: "Hands-on Workshops",
    description: "Practical, limited-seat workshops across design and craft.",
    status: "On sale",
    cadence: "Monthly",
    visibility: "Public",
    settings: {
      defaults: { type: "In-person", visibility: "Public", timezone: "Europe/London" },
      recurrence: {},
      eventOrder: [],
      followPage: true,
    },
  },
  {
    id: "22222222-2222-4222-8222-000000000003",
    name: "Quarterly Town Hall",
    description: "Company-wide town halls, once a quarter.",
    status: "Scheduled",
    cadence: "Quarterly",
    visibility: "Unlisted",
    settings: {
      defaults: { type: "Hybrid", visibility: "Unlisted", timezone: "Europe/London" },
      recurrence: {},
      eventOrder: [],
      followPage: false,
    },
  },
  {
    id: "22222222-2222-4222-8222-000000000004",
    name: "Summer Concert Run",
    description: "A themed run of summer gigs at partner venues.",
    status: "Draft",
    cadence: "Custom",
    visibility: "Public",
    settings: {
      defaults: { type: "In-person", visibility: "Public", timezone: "Europe/London" },
      recurrence: {},
      eventOrder: [],
      followPage: true,
    },
  },
];

// Default shape for a brand-new series (before any settings are saved).
export function emptySeriesSettings() {
  return { defaults: {}, recurrence: {}, eventOrder: [], followPage: false };
}
