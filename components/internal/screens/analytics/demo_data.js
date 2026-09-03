"use client";

// Frontend demo data for all twelve analytics dashboards.
// Shapes here mirror the real tables (orders, registrations, check-ins,
// page events, email sends, chat/polls, sponsors, surveys) so screens can
// later swap these imports for lib/supabase queries without changing UI.

export const EVENTS = [
  { id: "e1", name: "Summer Product Launch", date: "Aug 2026" },
  { id: "e2", name: "Local Music Night", date: "Jul 2026" },
  { id: "e3", name: "Founder AMA — Live", date: "Aug 2026" },
  { id: "e4", name: "Design Systems Workshop", date: "Sep 2026" },
  { id: "e5", name: "Indie Film Screening", date: "Sep 2026" },
  { id: "e6", name: "SaaS Growth Summit", date: "Oct 2026" },
];

export const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last quarter" },
];

export const EVENT_OPTIONS = [
  { value: "all", label: "All events" },
  ...EVENTS.map((e) => ({ value: e.id, label: e.name })),
];

// ---- Sales ----
export const SALES_WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12", "W13", "W14"];
export const SALES_REVENUE = [4200, 6100, 5800, 8400, 9200, 11800, 12400, 14200, 15600, 18900, 21400, 23800, 26100, 28400];
export const SALES_TICKETS = [120, 168, 152, 224, 248, 312, 328, 372, 408, 472, 528, 592, 648, 702];

export const TICKET_MIX = [
  { name: "General Admission", value: 2148 },
  { name: "VIP", value: 684 },
  { name: "Early-bird", value: 1120 },
  { name: "Student", value: 512 },
  { name: "Group", value: 348 },
];

export const SALES_BY_EVENT = [
  { event: "Summer Product Launch", revenue: 98400, sold: 3120, capacity: 4000, status: "On sale" },
  { event: "SaaS Growth Summit", revenue: 72400, sold: 1840, capacity: 2500, status: "On sale" },
  { event: "Local Music Night", revenue: 54000, sold: 3000, capacity: 3000, status: "Sold out" },
  { event: "Founder AMA — Live", revenue: 31200, sold: 1280, capacity: 1500, status: "On sale" },
  { event: "Design Systems Workshop", revenue: 21600, sold: 540, capacity: 800, status: "On sale" },
  { event: "Indie Film Screening", revenue: 14800, sold: 740, capacity: 1200, status: "Draft" },
];

// ---- Attendance ----
export const ARRIVAL_BUCKETS = ["5:00", "5:15", "5:30", "5:45", "6:00", "6:15", "6:30", "6:45", "7:00", "7:15", "7:30"];
export const ARRIVALS = [42, 128, 264, 412, 588, 724, 812, 690, 512, 318, 142];
export const ARRIVALS_CUM = (() => {
  let s = 0;
  return ARRIVALS.map((v) => (s += v));
})();

export const GATE_SPLIT = [
  { name: "Gate A — Main", value: 1842 },
  { name: "Gate B — East", value: 1218 },
  { name: "Gate C — VIP", value: 486 },
  { name: "Gate D — Staff", value: 214 },
];

export const ATTENDANCE_ROWS = [
  { event: "Summer Product Launch", registered: 3420, checkedIn: 2894, rate: 85 },
  { event: "Local Music Night", registered: 3100, checkedIn: 2874, rate: 93 },
  { event: "Founder AMA — Live", registered: 1420, checkedIn: 1108, rate: 78 },
  { event: "Design Systems Workshop", registered: 620, checkedIn: 518, rate: 84 },
  { event: "Indie Film Screening", registered: 840, checkedIn: 612, rate: 73 },
  { event: "SaaS Growth Summit", registered: 2100, checkedIn: 1612, rate: 77 },
];

// ---- Cross-event ----
export const PORTFOLIO_ROWS = SALES_BY_EVENT.map((r) => {
  const att = ATTENDANCE_ROWS.find((a) => a.event === r.event);
  return {
    ...r,
    sellThrough: Math.round((r.sold / r.capacity) * 100),
    attendance: att ? att.rate : 80,
  };
});

export const BENCHMARK_DIMS = ["Revenue", "Sell-through", "Attendance", "Repeat rate", "NPS"];
export const BENCHMARK_AVG = [72, 68, 75, 58, 64];
export const BENCHMARK_TOP = [94, 96, 90, 82, 88];

// ---- Traffic ----
export const SOURCES = [
  { name: "Direct", sessions: 12400, revenue: 38400 },
  { name: "Instagram", sessions: 9800, revenue: 24800 },
  { name: "Google", sessions: 8600, revenue: 21400 },
  { name: "Email", sessions: 6200, revenue: 18900 },
  { name: "Referral", sessions: 3400, revenue: 8200 },
  { name: "TikTok", sessions: 2800, revenue: 5100 },
];

export const TRAFFIC_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TRAFFIC_SERIES = {
  Direct: [820, 900, 860, 940, 1100, 1240, 1180, 880, 920, 900, 980, 1150, 1300, 1240],
  Instagram: [620, 680, 720, 780, 900, 1020, 980, 660, 700, 740, 820, 940, 1080, 1020],
  Google: [540, 580, 600, 640, 720, 800, 780, 560, 600, 620, 680, 760, 840, 820],
  Email: [380, 420, 460, 520, 580, 480, 360, 400, 440, 480, 560, 620, 520, 400],
};

// ---- Funnels ----
export const FUNNEL_STEPS = [
  { step: "Event page views", count: 18420, pctPrev: "—", pctAll: "100%" },
  { step: "Ticket selected", count: 6240, pctPrev: "33.9%", pctAll: "33.9%" },
  { step: "Checkout started", count: 3120, pctPrev: "50.0%", pctAll: "16.9%" },
  { step: "Payment completed", count: 1932, pctPrev: "61.9%", pctAll: "10.5%" },
];

export const FUNNEL_BY_SOURCE = [
  { source: "Email", views: 6200, paid: 980 },
  { source: "Direct", views: 5200, paid: 420 },
  { source: "Instagram", views: 4100, paid: 280 },
  { source: "Google", views: 1900, paid: 152 },
  { source: "Referral", views: 1020, paid: 100 },
];

// ---- Email ----
export const EMAIL_DAYS = ["Aug 3", "Aug 6", "Aug 9", "Aug 12", "Aug 15", "Aug 18", "Aug 21", "Aug 24"];
export const EMAIL_OPENS = [42.1, 44.8, 41.2, 45.6, 43.9, 46.2, 44.1, 42.8];
export const EMAIL_CLICKS = [6.8, 7.2, 5.9, 7.8, 6.9, 7.5, 6.4, 6.1];

export const EMAIL_CAMPAIGNS = [
  { name: "Early-bird ends Friday", sent: 18400, open: 48.2, click: 8.4 },
  { name: "Lineup just dropped", sent: 16200, open: 44.6, click: 7.1 },
  { name: "Last call — 50 seats left", sent: 14800, open: 52.4, click: 11.2 },
  { name: "Welcome + 10% off", sent: 12600, open: 38.9, click: 5.2 },
  { name: "Aftermovie + next date", sent: 9400, open: 36.1, click: 4.8 },
];

// ---- Engagement ----
export const ENGAGE_HOURS = ["9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p"];
export const ENGAGE_DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
export const ENGAGE_HEAT = [
  [12, 24, 38, 52, 68, 84, 96, 88, 64, 42, 28, 16],
  [18, 32, 48, 66, 82, 104, 122, 110, 84, 56, 34, 20],
  [14, 28, 42, 58, 74, 92, 108, 96, 72, 48, 30, 18],
  [22, 38, 56, 78, 96, 118, 138, 124, 96, 64, 40, 24],
  [10, 18, 28, 40, 52, 64, 74, 66, 48, 32, 20, 12],
];

export const POLL_SESSIONS = [
  { session: "Opening Keynote", votes: 1842 },
  { session: "Growth Panel", votes: 1428 },
  { session: "Design Crit Live", votes: 1104 },
  { session: "Founder AMA", votes: 986 },
  { session: "Closing Party Vote", votes: 842 },
  { session: "Workshop: Pricing", votes: 618 },
];

export const CHAT_VOLUME = [120, 240, 380, 520, 780, 1120, 1480, 1320, 980, 640, 380, 180];

// ---- Sponsors ----
export const SPONSOR_ROWS = [
  { sponsor: "Northwind Bank", tier: "Platinum", impressions: 48200, scans: 1842, leads: 486, spend: 12000 },
  { sponsor: "Acme Cloud", tier: "Platinum", impressions: 41800, scans: 1528, leads: 402, spend: 10000 },
  { sponsor: "Brew & Co", tier: "Gold", impressions: 28400, scans: 1218, leads: 318, spend: 6000 },
  { sponsor: "TransitPay", tier: "Gold", impressions: 24200, scans: 986, leads: 264, spend: 5500 },
  { sponsor: "Pixelware", tier: "Silver", impressions: 16800, scans: 642, leads: 148, spend: 3000 },
  { sponsor: "Loop Audio", tier: "Silver", impressions: 12400, scans: 418, leads: 96, spend: 2500 },
];

// ---- Forecast ----
export const FORECAST_WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
export const FORECAST_ACTUAL = [4200, 6100, 8400, 11800, 14200, 18900, null, null];
export const FORECAST_MEAN = [null, null, null, null, null, 18900, 22400, 26800, 31200].slice(0, 8);
export const FORECAST_UPPER = [null, null, null, null, null, 19800, 24200, 29400, 34200].slice(0, 8);
export const FORECAST_LOWER = [null, null, null, null, null, 18000, 20600, 24200, 28200].slice(0, 8);

// ---- Surveys ----
export const NPS_SPLIT = [
  { name: "Promoters (9–10)", value: 1184 },
  { name: "Passives (7–8)", value: 402 },
  { name: "Detractors (0–6)", value: 256 },
];

export const RATING_DIST = [
  { stars: "5 ★", count: 986 },
  { stars: "4 ★", count: 512 },
  { stars: "3 ★", count: 208 },
  { stars: "2 ★", count: 84 },
  { stars: "1 ★", count: 52 },
];

export const SATIS_DIMS = ["Content", "Speakers", "Venue", "Food", "Networking", "Value"];

// ---- Demographics ----
export const AGE_SPLIT = [
  { name: "18–24", value: 842 },
  { name: "25–34", value: 1842 },
  { name: "35–44", value: 1108 },
  { name: "45–54", value: 486 },
  { name: "55+", value: 214 },
];

export const CITY_ROWS = [
  { city: "New York", attendees: 1242 },
  { city: "San Francisco", attendees: 986 },
  { city: "Chicago", attendees: 724 },
  { city: "Austin", attendees: 618 },
  { city: "Los Angeles", attendees: 542 },
  { city: "Seattle", attendees: 386 },
  { city: "Boston", attendees: 294 },
];

export const AGE_SPEND = [
  [22, 68], [24, 84], [27, 92], [29, 110], [31, 98], [33, 124], [36, 118],
  [38, 142], [41, 128], [44, 156], [47, 148], [52, 132], [58, 118], [62, 96],
];
