// Member push catalog shared by the dispatcher, the settings routes and the dashboard. Pure data, safe on the client.

export const PUSH_CATEGORIES = [
  { key: "tickets", label: "Tickets & orders", description: "Confirmations, cancellations, refunds, registrations and check-ins." },
  { key: "reminders", label: "Reminders", description: "Before the event, meetings, live rooms and membership renewals." },
  { key: "updates", label: "Event updates", description: "Time, venue and cancellation changes." },
  { key: "messages", label: "Messages", description: "Organiser replies and announcements." },
  { key: "community", label: "Community & Q&A", description: "Replies to you, organiser posts and answers to your questions." },
  { key: "meetings", label: "Meetings", description: "Meeting requests, confirmations and changes." },
];

// quiet: held until quiet hours end when the project has them on.
export const PUSH_TYPES = [
  { key: "order_confirmed", category: "tickets", label: "Order confirmed", description: "A ticket order is confirmed, including free, kiosk and door orders." },
  { key: "ticket_gifted", category: "tickets", label: "Ticket from a group booking", description: "A guest receives their own ticket from someone else's group order." },
  { key: "order_cancelled", category: "tickets", label: "Order cancelled", description: "An order is cancelled." },
  { key: "refund_update", category: "tickets", label: "Refund update", description: "A refund is approved, declined or issued." },
  { key: "payment_failed", category: "tickets", label: "Payment failed", description: "A delayed card or bank payment fails." },
  { key: "registration_update", category: "tickets", label: "Registration status", description: "Registered, approved, declined, waitlisted or promoted from the waitlist." },
  { key: "checked_in", category: "tickets", label: "Checked in", description: "A ticket is scanned at the door. Doubles as an alert if someone else used it." },
  { key: "event_starting", category: "reminders", label: "Event reminder", description: "Before the event starts, at the times set under Reminder timings." },
  { key: "meeting_soon", category: "reminders", label: "Meeting reminder", description: "10 minutes before a confirmed meeting." },
  { key: "live_starting", category: "reminders", label: "Live room open", description: "When a live room the member can watch opens." },
  { key: "membership_expiring", category: "reminders", label: "Membership expiring", description: "Before a membership expires, at the times set under Reminder timings." },
  { key: "membership_expired", category: "reminders", label: "Membership expired", description: "When a membership has expired." },
  { key: "event_changed", category: "updates", label: "Event changed", description: "The date, time, venue or address changes." },
  { key: "event_cancelled", category: "updates", label: "Event cancelled", description: "An upcoming event with ticket holders is cancelled." },
  { key: "thread_reply", category: "messages", label: "Organiser reply", description: "An organiser replies to a member's message or sends them a broadcast." },
  { key: "announcement", category: "messages", label: "Announcement", description: "An announcement is sent to its audience.", quiet: true },
  { key: "chat_reply", category: "community", label: "Chat reply", description: "Someone replies to the member's message in event chat.", quiet: true },
  { key: "chat_organiser_post", category: "community", label: "Organiser post", description: "An organiser posts in an organiser-only event channel.", quiet: true },
  { key: "qa_answer", category: "community", label: "Q&A answer", description: "An organiser answers the member's question.", quiet: true },
  { key: "meeting_request", category: "meetings", label: "Meeting request", description: "Someone asks to meet." },
  { key: "meeting_declined", category: "meetings", label: "Meeting declined", description: "A meeting request is declined." },
  { key: "meeting_confirmed", category: "meetings", label: "Meeting confirmed", description: "A meeting is booked." },
  { key: "meeting_cancelled", category: "meetings", label: "Meeting cancelled", description: "A meeting is cancelled." },
  { key: "meeting_rescheduled", category: "meetings", label: "Meeting moved", description: "A meeting is moved to a new time." },
];

export const PUSH_TYPE_KEYS = PUSH_TYPES.map((t) => t.key);
export const CATEGORY_KEYS = PUSH_CATEGORIES.map((c) => c.key);

const BY_KEY = new Map(PUSH_TYPES.map((t) => [t.key, t]));

export function pushType(key) {
  return BY_KEY.get(key) || null;
}

export function categoryOf(type) {
  return BY_KEY.get(type)?.category || null;
}

export const DEFAULT_EVENT_OFFSETS = [1440, 60];
export const DEFAULT_MEMBERSHIP_DAYS = [7, 1];
export const DEFAULT_QUIET_HOURS = { enabled: false, start: "22:00", end: "08:00" };

// Offsets the dashboard offers; minutes before the event starts.
export const EVENT_OFFSET_OPTIONS = [
  { value: 10080, label: "1 week before" },
  { value: 2880, label: "2 days before" },
  { value: 1440, label: "1 day before" },
  { value: 180, label: "3 hours before" },
  { value: 60, label: "1 hour before" },
  { value: 30, label: "30 minutes before" },
];

export const MEMBERSHIP_DAY_OPTIONS = [30, 14, 7, 3, 1];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Settings as stored, coerced to a complete, valid shape (unknown types dropped, offsets bounded).
export function normalizeSettings(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const types = {};
  const rawTypes = src.types && typeof src.types === "object" ? src.types : {};
  for (const key of PUSH_TYPE_KEYS) {
    if (typeof rawTypes[key] === "boolean") types[key] = rawTypes[key];
  }
  const ints = (list, fallback, min, max) => {
    if (!Array.isArray(list)) return [...fallback];
    const clean = [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max))];
    return clean.sort((a, b) => b - a).slice(0, 4);
  };
  const qh = src.quietHours && typeof src.quietHours === "object" ? src.quietHours : {};
  return {
    types,
    eventOffsets: ints(src.eventOffsets, DEFAULT_EVENT_OFFSETS, 5, 20160),
    membershipDays: ints(src.membershipDays, DEFAULT_MEMBERSHIP_DAYS, 1, 60),
    quietHours: {
      enabled: Boolean(qh.enabled),
      start: HHMM.test(qh.start || "") ? qh.start : DEFAULT_QUIET_HOURS.start,
      end: HHMM.test(qh.end || "") ? qh.end : DEFAULT_QUIET_HOURS.end,
    },
    paused: Boolean(src.paused),
  };
}

export function isTypeEnabled(settings, type) {
  return settings?.types?.[type] !== false;
}

export function normalizeCategories(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(CATEGORY_KEYS.map((key) => [key, src[key] !== false]));
}
