// API & Webhooks catalog: scopes, event types, delivery rules and limits shared by the dashboard, the routes and docs.

export const API_KEY_PREFIX = "gev_live_";

const isProd = process.env.NODE_ENV === "production";

// In production Events is served under Dash's domain at /events, so the request origin isn't the public one.
export const API_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN || (isProd ? "https://geiger.studio" : "http://localhost:3000");
export const API_BASE_URL = `${API_PUBLIC_ORIGIN}${isProd ? "/events" : ""}/api/v1`;

export const API_SCOPES = [
  { key: "read:events", label: "Read events", description: "List events and fetch one by id." },
  { key: "read:orders", label: "Read orders", description: "List ticket orders, with buyer, amounts and status." },
  { key: "read:attendees", label: "Read attendees", description: "List registrations and whether they've checked in." },
  { key: "read:checkins", label: "Read check-ins", description: "List door and session check-ins." },
  { key: "write:checkins", label: "Check guests in", description: "Admit a ticket by its code, as a door scanner would." },
];

export const API_SCOPE_KEYS = API_SCOPES.map((s) => s.key);

export const API_KEY_EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires", days: null },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
];

// Per-key fixed window; the API answers 429 past it.
export const RATE_LIMIT = { limit: 120, windowSeconds: 60 };

export const PAGE_LIMIT = { default: 25, max: 100 };

export const DELIVERY_TIMEOUT_MS = 10_000;

// Waits after attempt 1, 2, … fails; after the last one the delivery is given up as failed.
export const RETRY_SCHEDULE_SECONDS = [60, 300, 1800, 7200, 21600, 43200];
export const MAX_ATTEMPTS = RETRY_SCHEDULE_SECONDS.length + 1;

// Consecutive failed attempts (with no success for a day) before an endpoint is turned off.
export const AUTO_DISABLE_AFTER = 50;

export const RESPONSE_SNIPPET_BYTES = 2048;

export const TEST_EVENT_TYPE = "webhook.test";

// The delay before the next attempt, or null once attempts are used up.
export function retryDelaySeconds(attemptsMade) {
  const n = Number(attemptsMade) || 0;
  if (n < 1 || n >= MAX_ATTEMPTS) return null;
  return RETRY_SCHEDULE_SECONDS[n - 1];
}

export function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

const SAMPLE_IDS = {
  event: "9b1f2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
  order: "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c",
  registration: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  checkin: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
  refund: "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f",
};

const SAMPLE_EVENT = {
  object: "event",
  id: SAMPLE_IDS.event,
  name: "Creative Summit 2026",
  status: "on_sale",
  type: "in_person",
  visibility: "public",
  date: "2026-12-04",
  time: "09:30",
  timezone: "Europe/London",
  venue: "Halcyon Hall",
  address: "12 Wharf Road",
  city: "London",
  summary: "A day of talks and workshops.",
  cover_url: null,
  capacity: 400,
  tickets_sold: 212,
  revenue: 10388,
  currency: "gbp",
  created_at: "2026-09-01T10:00:00+00:00",
  updated_at: "2026-11-08T09:12:44+00:00",
};

const SAMPLE_ORDER = {
  object: "order",
  id: SAMPLE_IDS.order,
  event_id: SAMPLE_IDS.event,
  ticket_code: "3F2B9C1E",
  status: "paid",
  buyer: { name: "Ada Lovelace", email: "ada@example.com" },
  ticket_name: "General Admission",
  quantity: 2,
  unit_price: 49,
  total: 98,
  refunded_total: 0,
  currency: "gbp",
  payment_intent: "pi_3Q0abc123",
  cancelled_at: null,
  created_at: "2026-11-08T09:12:44+00:00",
  updated_at: "2026-11-08T09:12:44+00:00",
};

const SAMPLE_ATTENDEE = {
  object: "attendee",
  id: SAMPLE_IDS.registration,
  event_id: SAMPLE_IDS.event,
  ticket_code: "A1B2C3D4",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  status: "confirmed",
  source: "online",
  party_size: 1,
  checked_in_at: null,
  created_at: "2026-11-08T09:12:44+00:00",
  updated_at: "2026-11-08T09:12:44+00:00",
};

const SAMPLE_CHECKIN = {
  object: "checkin",
  id: SAMPLE_IDS.checkin,
  event_id: SAMPLE_IDS.event,
  registration_id: null,
  order_id: SAMPLE_IDS.order,
  attendee_name: "Ada Lovelace",
  ticket_code: "3F2B9C1E",
  gate: "North",
  zone: null,
  session_id: null,
  method: "qr",
  status: "in",
  checked_in_by: "Door team",
  checked_in_at: "2026-12-04T09:02:10+00:00",
  created_at: "2026-12-04T09:02:10+00:00",
};

export const WEBHOOK_EVENT_TYPES = [
  {
    type: "order.created",
    group: "Orders",
    label: "Order created",
    description: "A ticket order was placed, paid or free.",
    sample: SAMPLE_ORDER,
  },
  {
    type: "order.paid",
    group: "Orders",
    label: "Order paid",
    description: "A paid order's payment was confirmed.",
    sample: SAMPLE_ORDER,
  },
  {
    type: "order.refunded",
    group: "Orders",
    label: "Order refunded",
    description: "A refund was issued against an order, in full or in part.",
    sample: {
      ...SAMPLE_ORDER,
      status: "refunded",
      refunded_total: 98,
      updated_at: "2026-11-09T14:03:00+00:00",
      refund: {
        object: "refund",
        id: SAMPLE_IDS.refund,
        order_id: SAMPLE_IDS.order,
        event_id: SAMPLE_IDS.event,
        amount: 98,
        status: "issued",
        reason_code: "requested_by_customer",
        reason: null,
        method: "original",
        created_at: "2026-11-09T14:03:00+00:00",
      },
    },
  },
  {
    type: "order.cancelled",
    group: "Orders",
    label: "Order cancelled",
    description: "An order was cancelled; its tickets no longer admit.",
    sample: { ...SAMPLE_ORDER, status: "cancelled", cancelled_at: "2026-11-09T14:03:00+00:00" },
  },
  {
    type: "registration.created",
    group: "Registrations",
    label: "Registration created",
    description: "Someone registered for an event, including paid buyers.",
    sample: SAMPLE_ATTENDEE,
  },
  {
    type: "registration.cancelled",
    group: "Registrations",
    label: "Registration cancelled",
    description: "A registration was cancelled.",
    sample: { ...SAMPLE_ATTENDEE, status: "cancelled" },
  },
  {
    type: "checkin.created",
    group: "Check-in",
    label: "Guest checked in",
    description: "A ticket or registration was admitted at a door or session.",
    sample: SAMPLE_CHECKIN,
  },
  {
    type: "event.published",
    group: "Events",
    label: "Event published",
    description: "An event left draft and went on sale or was scheduled.",
    sample: SAMPLE_EVENT,
  },
  {
    type: "event.updated",
    group: "Events",
    label: "Event updated",
    description: "An event's name, status, date, venue, capacity or visibility changed.",
    sample: SAMPLE_EVENT,
  },
];

export const WEBHOOK_EVENT_TYPE_KEYS = WEBHOOK_EVENT_TYPES.map((t) => t.type);

export const WEBHOOK_EVENT_GROUPS = [...new Set(WEBHOOK_EVENT_TYPES.map((t) => t.group))].map((group) => ({
  group,
  types: WEBHOOK_EVENT_TYPES.filter((t) => t.group === group),
}));

export const TEST_EVENT_SAMPLE = {
  object: "test",
  message: "This is a test event from Geiger Events. Your endpoint is set up correctly if it answered with a 2xx.",
};

// The JSON body every delivery POSTs.
export function webhookEnvelope({ id, type, occurredAt, projectId, data }) {
  const created = Math.floor(new Date(occurredAt || Date.now()).getTime() / 1000);
  return { id, type, created, project_id: projectId, data: data ?? {} };
}

// Keeps only known event types ('*' means all, including types added later).
export function normalizeEventTypes(list) {
  const values = Array.isArray(list) ? list.map(String) : [];
  if (values.includes("*")) return ["*"];
  return WEBHOOK_EVENT_TYPE_KEYS.filter((t) => values.includes(t));
}

export function normalizeScopes(list) {
  const values = Array.isArray(list) ? list.map(String) : [];
  return API_SCOPE_KEYS.filter((s) => values.includes(s));
}
