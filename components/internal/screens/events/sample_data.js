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
    id: "evt_001",
    name: "Summer Product Launch",
    status: "On sale",
    type: "Hybrid",
    date: "2026-06-18",
    time: "18:00",
    venue: "The Glasshouse",
    city: "London",
    capacity: 400,
    sold: 312,
    revenue: 9840,
    visibility: "Public",
    organizer: "Ava Mitchell",
  },
  {
    id: "evt_002",
    name: "Local Music Night",
    status: "Sold out",
    type: "In-person",
    date: "2026-06-12",
    time: "20:00",
    venue: "Basement 45",
    city: "Bristol",
    capacity: 300,
    sold: 300,
    revenue: 5400,
    visibility: "Public",
    organizer: "Marco Reyes",
  },
  {
    id: "evt_003",
    name: "Founder AMA — Live",
    status: "On sale",
    type: "Online",
    date: "2026-06-20",
    time: "16:00",
    venue: "Zoom Webinar",
    city: "Remote",
    capacity: 150,
    sold: 128,
    revenue: 3120,
    visibility: "Unlisted",
    organizer: "Ava Mitchell",
  },
  {
    id: "evt_004",
    name: "Design Systems Workshop",
    status: "Draft",
    type: "In-person",
    date: "2026-07-02",
    time: "10:00",
    venue: "WeWork Moorgate",
    city: "London",
    capacity: 80,
    sold: 54,
    revenue: 2160,
    visibility: "Private",
    organizer: "Priya Shah",
  },
  {
    id: "evt_005",
    name: "Indie Film Screening",
    status: "On sale",
    type: "In-person",
    date: "2026-06-28",
    time: "19:30",
    venue: "The Ritzy",
    city: "London",
    capacity: 120,
    sold: 74,
    revenue: 1480,
    visibility: "Public",
    organizer: "Marco Reyes",
  },
  {
    id: "evt_006",
    name: "Startup Networking Brunch",
    status: "Scheduled",
    type: "In-person",
    date: "2026-07-11",
    time: "11:00",
    venue: "Caravan King's Cross",
    city: "London",
    capacity: 90,
    sold: 0,
    revenue: 0,
    visibility: "Public",
    organizer: "Priya Shah",
  },
  {
    id: "evt_007",
    name: "Q2 Customer Webinar",
    status: "Ended",
    type: "Online",
    date: "2026-05-22",
    time: "15:00",
    venue: "Geiger Live",
    city: "Remote",
    capacity: 500,
    sold: 438,
    revenue: 0,
    visibility: "Public",
    organizer: "Ava Mitchell",
  },
  {
    id: "evt_008",
    name: "Pottery Masterclass",
    status: "On sale",
    type: "In-person",
    date: "2026-07-05",
    time: "14:00",
    venue: "Turning Earth",
    city: "London",
    capacity: 24,
    sold: 19,
    revenue: 1140,
    visibility: "Public",
    organizer: "Lena Okafor",
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
